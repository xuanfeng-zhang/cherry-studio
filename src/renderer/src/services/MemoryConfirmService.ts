import { loggerService } from '@logger'
import { PendingMemoryItem } from '@renderer/components/MemoryConfirmModal'
import { AssistantMessage } from '@renderer/types'

import { MemoryProcessor, MemoryProcessorConfig } from './MemoryProcessor'

const logger = loggerService.withContext('MemoryConfirmService')

export interface MemoryConfirmState {
  visible: boolean
  pendingMemories: PendingMemoryItem[]
  conversationContext: string
  processorConfig: MemoryProcessorConfig | null
  resolveCallback: ((confirmedMemories: PendingMemoryItem[]) => void) | null
  rejectCallback: (() => void) | null
}

class MemoryConfirmService {
  private static instance: MemoryConfirmService | null = null
  private state: MemoryConfirmState = {
    visible: false,
    pendingMemories: [],
    conversationContext: '',
    processorConfig: null,
    resolveCallback: null,
    rejectCallback: null
  }
  private listeners: Set<(state: MemoryConfirmState) => void> = new Set()

  private constructor() {}

  public static getInstance(): MemoryConfirmService {
    if (!MemoryConfirmService.instance) {
      MemoryConfirmService.instance = new MemoryConfirmService()
    }
    return MemoryConfirmService.instance
  }

  /**
   * Subscribe to state changes
   */
  public subscribe(listener: (state: MemoryConfirmState) => void): () => void {
    this.listeners.add(listener)
    return () => {
      this.listeners.delete(listener)
    }
  }

  /**
   * Get current state
   */
  public getState(): MemoryConfirmState {
    return { ...this.state }
  }

  /**
   * Show memory confirmation dialog
   */
  public async showConfirmDialog(
    messages: AssistantMessage[],
    config: MemoryProcessorConfig
  ): Promise<PendingMemoryItem[]> {
    return new Promise(async (resolve, reject) => {
      try {
        const memoryProcessor = new MemoryProcessor()
        const { pendingMemories, conversationContext } = await memoryProcessor.preparePendingMemories(
          messages,
          config
        )

        if (pendingMemories.length === 0) {
          logger.debug('No pending memories to confirm')
          resolve([])
          return
        }

        logger.debug(`Showing memory confirm dialog with ${pendingMemories.length} items`)

        this.state = {
          visible: true,
          pendingMemories,
          conversationContext,
          processorConfig: config,
          resolveCallback: resolve,
          rejectCallback: reject
        }

        this.notifyListeners()
      } catch (error) {
        logger.error('Failed to prepare memory confirmation:', error as Error)
        reject(error)
      }
    })
  }

  /**
   * Confirm selected memories
   */
  public async confirmMemories(confirmedMemories: PendingMemoryItem[]): Promise<void> {
    try {
      if (this.state.processorConfig && confirmedMemories.length > 0) {
        const memoryProcessor = new MemoryProcessor()
        const operations = await memoryProcessor.executeConfirmedMemories(
          confirmedMemories,
          this.state.processorConfig
        )

        logger.debug(`Executed ${operations.length} memory operations:`, operations)
      }

      if (this.state.resolveCallback) {
        this.state.resolveCallback(confirmedMemories)
      }

      this.hideDialog()
    } catch (error) {
      logger.error('Failed to confirm memories:', error as Error)
      if (this.state.rejectCallback) {
        this.state.rejectCallback()
      }
      this.hideDialog()
    }
  }

  /**
   * Cancel memory confirmation
   */
  public cancelConfirmation(): void {
    logger.debug('Memory confirmation cancelled by user')
    if (this.state.resolveCallback) {
      this.state.resolveCallback([])
    }
    this.hideDialog()
  }

  /**
   * Hide confirmation dialog
   */
  private hideDialog(): void {
    this.state = {
      visible: false,
      pendingMemories: [],
      conversationContext: '',
      processorConfig: null,
      resolveCallback: null,
      rejectCallback: null
    }
    this.notifyListeners()
  }

  /**
   * Notify all listeners of state change
   */
  private notifyListeners(): void {
    this.listeners.forEach(listener => {
      try {
        listener(this.getState())
      } catch (error) {
        logger.error('Error notifying memory confirm service listener:', error as Error)
      }
    })
  }
}

export default MemoryConfirmService