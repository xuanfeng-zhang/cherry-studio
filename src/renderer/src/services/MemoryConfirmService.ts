import { loggerService } from '@logger'
import { PendingMemoryItem, UserSelectOption } from '@renderer/components/MemoryConfirmModal'
import { AssistantMessage } from '@renderer/types'
import MemoryService from './MemoryService'

import { MemoryProcessor, MemoryProcessorConfig } from './MemoryProcessor'

const logger = loggerService.withContext('MemoryConfirmService')

export interface MemoryConfirmState {
  visible: boolean
  pendingMemories: PendingMemoryItem[]
  conversationContext: string
  processorConfig: MemoryProcessorConfig | null
  userOptions: UserSelectOption[]
  resolveCallback: ((confirmedMemories: PendingMemoryItem[], selectedUsers: string[]) => void) | null
  rejectCallback: (() => void) | null
}

class MemoryConfirmService {
  private static instance: MemoryConfirmService | null = null
  private state: MemoryConfirmState = {
    visible: false,
    pendingMemories: [],
    conversationContext: '',
    processorConfig: null,
    userOptions: [],
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
  ): Promise<{ confirmedMemories: PendingMemoryItem[], selectedUsers: string[] }> {
    return new Promise(async (resolve, reject) => {
      try {
        const memoryProcessor = new MemoryProcessor()
        const { pendingMemories, conversationContext } = await memoryProcessor.preparePendingMemories(
          messages,
          config
        )

        if (pendingMemories.length === 0) {
          logger.debug('No pending memories to confirm')
          resolve({ confirmedMemories: [], selectedUsers: [] })
          return
        }

        // Prepare user options
        const userOptions = await this.prepareUserOptions(config)

        logger.debug(`Showing memory confirm dialog with ${pendingMemories.length} items for ${userOptions.length} users`)

        this.state = {
          visible: true,
          pendingMemories,
          conversationContext,
          processorConfig: config,
          userOptions,
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
  public async confirmMemories(confirmedMemories: PendingMemoryItem[], selectedUsers: string[]): Promise<void> {
    try {
      if (this.state.processorConfig && confirmedMemories.length > 0 && selectedUsers.length > 0) {
        // Execute memories for each selected user
        let totalOperations = 0
        for (const userId of selectedUsers) {
          const userConfig = { ...this.state.processorConfig, userId }
          const operations = await this.executeMemoriesForUser(confirmedMemories, userConfig)
          totalOperations += operations.length
        }

        logger.debug(`Executed ${totalOperations} memory operations across ${selectedUsers.length} users`)
      }

      if (this.state.resolveCallback) {
        this.state.resolveCallback({ confirmedMemories, selectedUsers })
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
      this.state.resolveCallback({ confirmedMemories: [], selectedUsers: [] })
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
      userOptions: [],
      resolveCallback: null,
      rejectCallback: null
    }
    this.notifyListeners()
  }

  /**
   * Prepare user options for selection
   */
  private async prepareUserOptions(config: MemoryProcessorConfig): Promise<UserSelectOption[]> {
    try {
      const memoryService = MemoryService.getInstance()
      const usersList = await memoryService.getUsersList()

      // Get the default user from config
      const defaultUserId = config.userId || 'default-user'

      // Build user options with default user first
      const userOptions: UserSelectOption[] = []

      // Add default user
      const isDefaultUser = defaultUserId === 'default-user'
      userOptions.push({
        userId: defaultUserId,
        displayName: isDefaultUser ? 'Default User' : defaultUserId,
        selected: true, // Default user is selected by default
        isDefault: true
      })

      // Add other users
      for (const user of usersList) {
        if (user.userId !== defaultUserId) {
          userOptions.push({
            userId: user.userId,
            displayName: user.userId === 'default-user' ? 'Default User' : user.userId,
            selected: false,
            isDefault: false
          })
        }
      }

      return userOptions
    } catch (error) {
      logger.error('Failed to prepare user options:', error as Error)
      // Fallback to default user only
      return [{
        userId: config.userId || 'default-user',
        displayName: 'Default User',
        selected: true,
        isDefault: true
      }]
    }
  }

  /**
   * Execute memories for a specific user
   */
  private async executeMemoriesForUser(
    confirmedMemories: PendingMemoryItem[],
    userConfig: MemoryProcessorConfig
  ): Promise<Array<{ action: string; [key: string]: any }>> {
    const memoryProcessor = new MemoryProcessor()
    return await memoryProcessor.executeConfirmedMemories(confirmedMemories, userConfig)
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