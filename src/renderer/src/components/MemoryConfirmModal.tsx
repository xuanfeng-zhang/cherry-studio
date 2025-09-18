import { loggerService } from '@logger'
import { EditIcon } from '@renderer/components/Icons'
import { Badge, Button, Card, Checkbox, Flex, Form, Input, Modal, Space, Typography } from 'antd'
import { CheckboxChangeEvent } from 'antd/es/checkbox'
import { Brain, Calendar, MessageSquare } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

const logger = loggerService.withContext('MemoryConfirmModal')

const { TextArea } = Input
const { Text, Title } = Typography

export interface PendingMemoryItem {
  id: string
  type: 'ADD' | 'UPDATE' | 'DELETE'
  content: string
  oldContent?: string
  enabled: boolean
}

export interface MemoryConfirmModalProps {
  visible: boolean
  onCancel: () => void
  onConfirm: (confirmedItems: PendingMemoryItem[]) => Promise<void>
  pendingMemories: PendingMemoryItem[]
  conversationContext?: string
}

const MemoryConfirmModal: React.FC<MemoryConfirmModalProps> = ({
  visible,
  onCancel,
  onConfirm,
  pendingMemories,
  conversationContext
}) => {
  const { t } = useTranslation()
  const [form] = Form.useForm()
  const [loading, setLoading] = useState(false)
  const [editingMemories, setEditingMemories] = useState<PendingMemoryItem[]>([])
  const [expandedContext, setExpandedContext] = useState(false)

  // Initialize editing memories when modal opens
  useEffect(() => {
    if (visible && pendingMemories.length > 0) {
      setEditingMemories([...pendingMemories])
    }
  }, [visible, pendingMemories])

  const handleMemoryToggle = (id: string, checked: boolean) => {
    setEditingMemories(prev =>
      prev.map(item => (item.id === id ? { ...item, enabled: checked } : item))
    )
  }

  const handleMemoryEdit = (id: string, newContent: string) => {
    setEditingMemories(prev =>
      prev.map(item => (item.id === id ? { ...item, content: newContent } : item))
    )
  }

  const handleSelectAll = (e: CheckboxChangeEvent) => {
    const checked = e.target.checked
    setEditingMemories(prev => prev.map(item => ({ ...item, enabled: checked })))
  }

  const handleConfirm = async () => {
    setLoading(true)
    try {
      const confirmedItems = editingMemories.filter(item => item.enabled)
      await onConfirm(confirmedItems)
      logger.debug(`Confirmed ${confirmedItems.length} memory items`)
    } catch (error) {
      logger.error('Failed to confirm memories:', error as Error)
    } finally {
      setLoading(false)
    }
  }

  const getActionColor = (type: string) => {
    switch (type) {
      case 'ADD':
        return 'green'
      case 'UPDATE':
        return 'blue'
      case 'DELETE':
        return 'red'
      default:
        return 'default'
    }
  }

  const getActionText = (type: string) => {
    switch (type) {
      case 'ADD':
        return t('memory.action_add')
      case 'UPDATE':
        return t('memory.action_update')
      case 'DELETE':
        return t('memory.action_delete')
      default:
        return type
    }
  }

  const enabledCount = editingMemories.filter(item => item.enabled).length
  const totalCount = editingMemories.length
  const allEnabled = enabledCount === totalCount && totalCount > 0
  const someEnabled = enabledCount > 0 && enabledCount < totalCount

  return (
    <Modal
      open={visible}
      onCancel={onCancel}
      width={800}
      centered
      title={
        <Flex align="center" gap={8}>
          <Brain size={18} color="var(--color-primary)" />
          <span>{t('memory.confirm_title')}</span>
          <Badge count={totalCount} style={{ backgroundColor: 'var(--color-primary)' }} />
        </Flex>
      }
      footer={[
        <Button key="cancel" size="large" onClick={onCancel}>
          {t('common.cancel')}
        </Button>,
        <Button
          key="confirm"
          type="primary"
          size="large"
          loading={loading}
          disabled={enabledCount === 0}
          onClick={handleConfirm}>
          {t('memory.confirm_save', { count: enabledCount })}
        </Button>
      ]}
      styles={{
        header: {
          borderBottom: '1px solid var(--color-border)',
          paddingBottom: 16
        },
        body: {
          paddingTop: 20,
          maxHeight: '70vh',
          overflowY: 'auto'
        }
      }}>
      <div>
        {/* Context Section */}
        {conversationContext && (
          <Card size="small" style={{ marginBottom: 20, backgroundColor: 'var(--color-background-soft)' }}>
            <Flex align="center" gap={8} style={{ marginBottom: 8 }}>
              <MessageSquare size={16} color="var(--color-text-secondary)" />
              <Text strong>{t('memory.conversation_context')}</Text>
              <Button
                type="link"
                size="small"
                onClick={() => setExpandedContext(!expandedContext)}
                style={{ padding: 0 }}>
                {expandedContext ? t('common.collapse') : t('common.expand')}
              </Button>
            </Flex>
            <Text
              style={{
                fontSize: '13px',
                color: 'var(--color-text-secondary)',
                lineHeight: '1.5',
                display: expandedContext ? 'block' : '-webkit-box',
                WebkitLineClamp: expandedContext ? 'none' : 3,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden'
              }}>
              {conversationContext}
            </Text>
          </Card>
        )}

        {/* Controls */}
        <Flex justify="space-between" align="center" style={{ marginBottom: 16 }}>
          <Checkbox
            indeterminate={someEnabled}
            checked={allEnabled}
            onChange={handleSelectAll}>
            {t('memory.select_all')} ({enabledCount}/{totalCount})
          </Checkbox>
          <Text type="secondary" style={{ fontSize: '13px' }}>
            {t('memory.confirm_description')}
          </Text>
        </Flex>

        {/* Memory Items */}
        <MemoryListContainer>
          {editingMemories.map((memory, index) => (
            <MemoryItemCard key={memory.id}>
              <div className="memory-header">
                <Flex align="center" gap={8}>
                  <Checkbox
                    checked={memory.enabled}
                    onChange={(e) => handleMemoryToggle(memory.id, e.target.checked)}
                  />
                  <Badge
                    color={getActionColor(memory.type)}
                    text={getActionText(memory.type)}
                    style={{ fontSize: '12px' }}
                  />
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    #{index + 1}
                  </Text>
                </Flex>
              </div>

              {/* Show old content for UPDATE operations */}
              {memory.type === 'UPDATE' && memory.oldContent && (
                <div className="old-content">
                  <Text type="secondary" style={{ fontSize: '12px' }}>
                    {t('memory.old_content')}:
                  </Text>
                  <div
                    style={{
                      padding: '8px',
                      background: 'var(--color-background-soft)',
                      borderRadius: '6px',
                      fontSize: '13px',
                      color: 'var(--color-text-secondary)',
                      textDecoration: 'line-through',
                      opacity: 0.7,
                      marginBottom: '8px'
                    }}>
                    {memory.oldContent}
                  </div>
                </div>
              )}

              {/* Editable content */}
              <div className="memory-content">
                {memory.type === 'DELETE' ? (
                  <div
                    style={{
                      padding: '12px',
                      background: 'var(--color-error-bg)',
                      border: '1px solid var(--color-error-border)',
                      borderRadius: '6px',
                      textDecoration: 'line-through',
                      color: 'var(--color-error)'
                    }}>
                    {memory.content}
                  </div>
                ) : (
                  <TextArea
                    value={memory.content}
                    onChange={(e) => handleMemoryEdit(memory.id, e.target.value)}
                    disabled={!memory.enabled}
                    autoSize={{ minRows: 2, maxRows: 4 }}
                    style={{
                      fontSize: '14px',
                      lineHeight: '1.5',
                      resize: 'none'
                    }}
                    placeholder={t('memory.edit_content_placeholder')}
                  />
                )}
              </div>
            </MemoryItemCard>
          ))}
        </MemoryListContainer>

        {editingMemories.length === 0 && (
          <div style={{ textAlign: 'center', padding: '40px', color: 'var(--color-text-secondary)' }}>
            <Brain size={48} style={{ opacity: 0.3, marginBottom: 16 }} />
            <Text>{t('memory.no_pending_memories')}</Text>
          </div>
        )}
      </div>
    </Modal>
  )
}

const MemoryListContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
`

const MemoryItemCard = styled.div`
  padding: 16px;
  background: var(--color-background);
  border: 1px solid var(--color-border);
  border-radius: 8px;
  transition: all 0.2s ease;

  &:hover {
    border-color: var(--color-primary);
    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
  }

  .memory-header {
    margin-bottom: 12px;
  }

  .old-content {
    margin-bottom: 8px;
  }

  .memory-content {
    .ant-input {
      border: 1px solid var(--color-border);
      background: var(--color-background);

      &:focus,
      &:focus-within {
        border-color: var(--color-primary);
        box-shadow: 0 0 0 2px rgba(var(--primary-color-rgb), 0.2);
      }

      &:disabled {
        background: var(--color-background-soft);
        opacity: 0.6;
      }
    }
  }
`

export default MemoryConfirmModal