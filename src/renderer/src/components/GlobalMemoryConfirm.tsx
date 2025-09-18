import { useEffect, useState } from 'react'

import MemoryConfirmModal, { PendingMemoryItem } from './MemoryConfirmModal'
import MemoryConfirmService, { MemoryConfirmState } from '../services/MemoryConfirmService'

const GlobalMemoryConfirm: React.FC = () => {
  const [state, setState] = useState<MemoryConfirmState>({
    visible: false,
    pendingMemories: [],
    conversationContext: '',
    processorConfig: null,
    resolveCallback: null,
    rejectCallback: null
  })

  useEffect(() => {
    const service = MemoryConfirmService.getInstance()
    const unsubscribe = service.subscribe((newState) => {
      setState(newState)
    })

    return unsubscribe
  }, [])

  const handleConfirm = async (confirmedMemories: PendingMemoryItem[]) => {
    const service = MemoryConfirmService.getInstance()
    await service.confirmMemories(confirmedMemories)
  }

  const handleCancel = () => {
    const service = MemoryConfirmService.getInstance()
    service.cancelConfirmation()
  }

  return (
    <MemoryConfirmModal
      visible={state.visible}
      onCancel={handleCancel}
      onConfirm={handleConfirm}
      pendingMemories={state.pendingMemories}
      conversationContext={state.conversationContext}
    />
  )
}

export default GlobalMemoryConfirm