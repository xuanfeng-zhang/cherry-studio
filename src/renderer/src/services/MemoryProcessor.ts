import { loggerService } from '@logger'
import { PendingMemoryItem } from '@renderer/components/MemoryConfirmModal'
import { getModel } from '@renderer/hooks/useModel'
import { AssistantMessage } from '@renderer/types'
import {
  FactRetrievalSchema,
  getFactRetrievalMessages,
  getUpdateMemoryMessages,
  MemoryUpdateSchema,
  updateMemorySystemPrompt
} from '@renderer/utils/memory-prompts'
import { MemoryConfig, MemoryItem } from '@types'
import jaison from 'jaison/lib/index.js'

// Use browser crypto API for UUID generation
import { fetchGenerate } from './ApiService'
import MemoryService from './MemoryService'

const logger = loggerService.withContext('MemoryProcessor')

export interface MemoryProcessorConfig {
  memoryConfig: MemoryConfig
  assistantId?: string
  userId?: string
  lastMessageId?: string
}

export class MemoryProcessor {
  private memoryService: MemoryService

  constructor() {
    this.memoryService = MemoryService.getInstance()
  }

  /**
   * Extract facts from conversation messages
   * @param messages - Array of conversation messages
   * @param config - Memory processor configuration
   * @returns Array of extracted facts
   */
  async extractFacts(messages: AssistantMessage[], config: MemoryProcessorConfig): Promise<string[]> {
    try {
      const { memoryConfig } = config

      if (!memoryConfig.llmApiClient) {
        throw new Error('No LLM model configured for memory processing')
      }

      // Convert messages to string format for processing
      const parsedMessages = messages.map((msg) => `${msg.role}: ${msg.content}`).join('\n')

      // Get fact extraction prompt
      const [systemPrompt, userPrompt] = getFactRetrievalMessages(parsedMessages)

      const responseContent = await fetchGenerate({
        prompt: systemPrompt,
        content: userPrompt,
        model: getModel(memoryConfig.llmApiClient.model, memoryConfig.llmApiClient.provider)
      })
      if (!responseContent || responseContent.trim() === '') {
        return []
      }

      // Parse response using Zod schema
      try {
        logger.debug(`Response content for extraction: ${responseContent}`)
        const jsonParsed = jaison(responseContent)
        // Handle both expected format and potential variations
        let dataToValidate = jsonParsed

        // If the response has a 'facts' key at the top level, use it directly
        if (!jsonParsed.facts && Array.isArray(jsonParsed)) {
          // If it's just an array, wrap it in the expected format
          dataToValidate = { facts: jsonParsed }
        }

        const parsed = FactRetrievalSchema.parse(dataToValidate)
        return parsed.facts
      } catch (error) {
        logger.error(`Failed to parse fact extraction response: responseContent: ${responseContent}`, error as Error)
        return []
      }
    } catch (error) {
      logger.error('Error extracting facts:', error as Error)
      return []
    }
  }

  /**
   * Update memories with new facts
   * @param facts - Array of new facts to process
   * @param config - Memory processor configuration
   * @returns Array of memory operations performed
   */
  async updateMemories(
    facts: string[],
    config: MemoryProcessorConfig
  ): Promise<Array<{ action: string; [key: string]: any }>> {
    if (facts.length === 0) {
      return []
    }

    const { memoryConfig, assistantId, userId, lastMessageId } = config

    if (!memoryConfig.llmApiClient) {
      throw new Error('No LLM model configured for memory processing')
    }

    const existingMemoriesResult = window.keyv.get(`memory-search-${lastMessageId}`) as MemoryItem[] | []

    const existingMemories = existingMemoriesResult.map((memory) => ({
      id: memory.id,
      text: memory.memory
    }))

    let parsed: Array<{ event: string; id: string; text: string; old_memory?: string }> = []
    const operations: Array<{ action: string; [key: string]: any }> = []
    if (existingMemories.length === 0) {
      facts.forEach((fact) => {
        parsed.push({ event: 'ADD', text: fact, id: '', old_memory: '' })
      })
    } else {
      // Generate update memory prompt
      const updateMemoryUserPrompt = getUpdateMemoryMessages(existingMemories, facts)

      const responseContent = await fetchGenerate({
        prompt: updateMemorySystemPrompt,
        content: updateMemoryUserPrompt,
        model: getModel(memoryConfig.llmApiClient.model, memoryConfig.llmApiClient.provider)
      })
      if (!responseContent || responseContent.trim() === '') {
        return []
      }

      try {
        logger.debug(`Response content for memory update: ${responseContent}`)
        const jsonParsed = jaison(responseContent)
        // Handle both direct array and wrapped object format
        const dataToValidate = Array.isArray(jsonParsed) ? jsonParsed : jsonParsed.memory
        parsed = MemoryUpdateSchema.parse(dataToValidate)
      } catch (error) {
        logger.error(`Failed to parse memory update response: responseContent: ${responseContent}`, error as Error)
        return []
      }
    }

    for (const memoryOp of parsed) {
      switch (memoryOp.event) {
        case 'ADD':
          try {
            const result = await this.memoryService.add(memoryOp.text, {
              userId,
              agentId: assistantId
            })
            operations.push({ action: 'ADD', memory: memoryOp.text, result })
          } catch (error) {
            logger.error('Failed to add memory:', error as Error)
          }
          break

        case 'UPDATE':
          try {
            // Find the memory to update
            const existingMemory = existingMemoriesResult.find((m) => m.id === memoryOp.id)
            if (existingMemory) {
              await this.memoryService.update(memoryOp.id, memoryOp.text, {
                userId,
                assistantId,
                oldMemory: memoryOp.old_memory
              })
              operations.push({
                action: 'UPDATE',
                id: memoryOp.id,
                oldMemory: memoryOp.old_memory,
                newMemory: memoryOp.text
              })
            }
          } catch (error) {
            logger.error('Failed to update memory:', error as Error)
          }
          break

        case 'DELETE':
          try {
            await this.memoryService.delete(memoryOp.id)
            operations.push({ action: 'DELETE', id: memoryOp.id, memory: memoryOp.text })
          } catch (error) {
            logger.error('Failed to delete memory:', error as Error)
          }
          break

        case 'NONE':
          // No action needed
          break
      }
    }

    return operations
  }

  /**
   * Process conversation and update memories
   * @param messages - Array of conversation messages
   * @param config - Memory processor configuration
   * @returns Processing results
   */
  async processConversation(messages: AssistantMessage[], config: MemoryProcessorConfig) {
    try {
      // Extract facts from conversation
      const facts = await this.extractFacts(messages, config)

      if (facts.length === 0) {
        return { facts: [], operations: [] }
      }

      // Update memories with extracted facts
      const operations = await this.updateMemories(facts, config)

      return { facts, operations }
    } catch (error) {
      logger.error('Error processing conversation:', error as Error)
      return { facts: [], operations: [] }
    }
  }

  /**
   * Prepare pending memories for user confirmation
   * @param messages - Array of conversation messages
   * @param config - Memory processor configuration
   * @returns Pending memory items and conversation context
   */
  async preparePendingMemories(
    messages: AssistantMessage[],
    config: MemoryProcessorConfig
  ): Promise<{
    pendingMemories: PendingMemoryItem[]
    conversationContext: string
  }> {
    try {
      // Extract facts from conversation
      const facts = await this.extractFacts(messages, config)

      if (facts.length === 0) {
        return { pendingMemories: [], conversationContext: '' }
      }

      const { memoryConfig, lastMessageId } = config
      const existingMemoriesResult = window.keyv.get(`memory-search-${lastMessageId}`) as MemoryItem[] | []
      const existingMemories = existingMemoriesResult.map((memory) => ({
        id: memory.id,
        text: memory.memory
      }))

      let pendingMemories: PendingMemoryItem[] = []

      if (existingMemories.length === 0) {
        // All facts are new additions
        pendingMemories = facts.map((fact) => ({
          id: window.crypto.randomUUID(),
          type: 'ADD' as const,
          content: fact,
          enabled: true
        }))
      } else {
        // Generate update memory prompt to determine operations
        const updateMemoryUserPrompt = getUpdateMemoryMessages(existingMemories, facts)

        const responseContent = await fetchGenerate({
          prompt: updateMemorySystemPrompt,
          content: updateMemoryUserPrompt,
          model: getModel(memoryConfig.llmApiClient!.model, memoryConfig.llmApiClient!.provider)
        })

        if (responseContent && responseContent.trim() !== '') {
          try {
            logger.debug(`Response content for memory update: ${responseContent}`)
            const jsonParsed = jaison(responseContent)
            const dataToValidate = Array.isArray(jsonParsed) ? jsonParsed : jsonParsed.memory
            const parsed = MemoryUpdateSchema.parse(dataToValidate)

            pendingMemories = parsed
              .filter((memoryOp) => memoryOp.event !== 'NONE')
              .map((memoryOp) => ({
                id: memoryOp.id || window.crypto.randomUUID(),
                type: memoryOp.event as 'ADD' | 'UPDATE' | 'DELETE',
                content: memoryOp.text,
                oldContent: memoryOp.old_memory,
                enabled: true
              }))
          } catch (error) {
            logger.error(`Failed to parse memory update response: ${responseContent}`, error as Error)
            // Fallback: treat all facts as new additions
            pendingMemories = facts.map((fact) => ({
              id: window.crypto.randomUUID(),
              type: 'ADD' as const,
              content: fact,
              enabled: true
            }))
          }
        }
      }

      // Create conversation context
      const conversationContext = messages
        .map((msg) => `${msg.role}: ${msg.content}`)
        .join('\n')
        .slice(0, 1000) // Limit context length

      return { pendingMemories, conversationContext }
    } catch (error) {
      logger.error('Error preparing pending memories:', error as Error)
      return { pendingMemories: [], conversationContext: '' }
    }
  }

  /**
   * Execute confirmed memory operations
   * @param confirmedMemories - Array of confirmed memory items
   * @param config - Memory processor configuration
   * @returns Array of memory operations performed
   */
  async executeConfirmedMemories(
    confirmedMemories: PendingMemoryItem[],
    config: MemoryProcessorConfig
  ): Promise<Array<{ action: string; [key: string]: any }>> {
    const { assistantId, userId } = config
    const operations: Array<{ action: string; [key: string]: any }> = []

    for (const memoryItem of confirmedMemories) {
      switch (memoryItem.type) {
        case 'ADD':
          try {
            const result = await this.memoryService.add(memoryItem.content, {
              userId,
              agentId: assistantId
            })
            operations.push({ action: 'ADD', memory: memoryItem.content, result })
          } catch (error) {
            logger.error('Failed to add memory:', error as Error)
          }
          break

        case 'UPDATE':
          try {
            if (memoryItem.id) {
              await this.memoryService.update(memoryItem.id, memoryItem.content, {
                userId,
                assistantId,
                oldMemory: memoryItem.oldContent
              })
              operations.push({
                action: 'UPDATE',
                id: memoryItem.id,
                oldMemory: memoryItem.oldContent,
                newMemory: memoryItem.content
              })
            }
          } catch (error) {
            logger.error('Failed to update memory:', error as Error)
          }
          break

        case 'DELETE':
          try {
            if (memoryItem.id) {
              await this.memoryService.delete(memoryItem.id)
              operations.push({ action: 'DELETE', id: memoryItem.id, memory: memoryItem.content })
            }
          } catch (error) {
            logger.error('Failed to delete memory:', error as Error)
          }
          break
      }
    }

    return operations
  }

  /**
   * Search memories for relevant context
   * @param query - Search query
   * @param config - Memory processor configuration
   * @param limit - Maximum number of results
   * @returns Array of relevant memories
   */
  async searchRelevantMemories(query: string, config: MemoryProcessorConfig, limit: number = 5): Promise<MemoryItem[]> {
    try {
      const { assistantId, userId } = config

      const result = await this.memoryService.search(query, {
        userId,
        agentId: assistantId,
        limit
      })

      logger.debug(
        `Searching memories with query: ${query} for user: ${userId} and assistant: ${assistantId} result: ${result}`
      )
      return result.results
    } catch (error) {
      logger.error('Error searching memories:', error as Error)
      return []
    }
  }

  /**
   * Get memory processing configuration from store
   * @param assistantId - Optional assistant ID
   * @param userId - Optional user ID
   * @returns Memory processor configuration
   */
  static getProcessorConfig(
    memoryConfig: MemoryConfig,
    assistantId?: string,
    userId?: string,
    lastMessageId?: string
  ): MemoryProcessorConfig {
    return {
      memoryConfig,
      assistantId,
      userId,
      lastMessageId
    }
  }
}
