import { InfoCircleOutlined } from '@ant-design/icons'
import { loggerService } from '@logger'
import { Box } from '@renderer/components/Layout'
import MemoriesSettingsModal from '@renderer/pages/memory/settings-modal'
import UserSelector from '@renderer/pages/settings/MemorySettings/UserSelector'
import MemoryService from '@renderer/services/MemoryService'
import { selectCurrentUserId, selectGlobalMemoryEnabled, selectMemoryConfig } from '@renderer/store/memory'
import { Assistant, AssistantSettings } from '@renderer/types'
import { Alert, Button, Card, Space, Switch, Tooltip, Typography } from 'antd'
import { useForm } from 'antd/es/form/Form'
import { Settings2 } from 'lucide-react'
import { useCallback, useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useSelector } from 'react-redux'
import styled from 'styled-components'

const logger = loggerService.withContext('AssistantMemorySettings')

const { Text } = Typography

interface Props {
  assistant: Assistant
  updateAssistant: (assistant: Assistant) => void
  updateAssistantSettings: (settings: AssistantSettings) => void
  onClose?: () => void // Add optional close callback
}

const AssistantMemorySettings: React.FC<Props> = ({ assistant, updateAssistant, onClose }) => {
  const { t } = useTranslation()
  const memoryConfig = useSelector(selectMemoryConfig)
  const globalMemoryEnabled = useSelector(selectGlobalMemoryEnabled)
  const currentUserId = useSelector(selectCurrentUserId)
  const [memoryStats, setMemoryStats] = useState<{ count: number; loading: boolean }>({
    count: 0,
    loading: true
  })
  const [settingsModalVisible, setSettingsModalVisible] = useState(false)
  const [uniqueUsers, setUniqueUsers] = useState<string[]>([])
  const memoryService = MemoryService.getInstance()
  const form = useForm()

  // Get the assistant's memory user ID, fallback to global current user
  const assistantMemoryUserId = assistant.memoryUserId || currentUserId

  // Load unique users from database
  const loadUniqueUsers = useCallback(async () => {
    try {
      const usersList = await memoryService.getUsersList()
      const users = usersList.map((user) => user.userId)
      setUniqueUsers(users)
    } catch (error) {
      logger.error('Failed to load users list:', error as Error)
    }
  }, [memoryService])

  // Load memory statistics for assistant's memory user
  const loadMemoryStats = useCallback(async () => {
    setMemoryStats((prev) => ({ ...prev, loading: true }))
    try {
      // Temporarily set the memory service to use the assistant's memory user
      const originalUserId = memoryService.getCurrentUser()
      memoryService.setCurrentUser(assistantMemoryUserId)

      const result = await memoryService.list({
        limit: 1000
      })
      setMemoryStats({ count: result.results.length, loading: false })

      // Restore the original user
      memoryService.setCurrentUser(originalUserId)
    } catch (error) {
      logger.error('Failed to load memory stats:', error as Error)
      setMemoryStats({ count: 0, loading: false })
    }
  }, [memoryService, assistantMemoryUserId])

  useEffect(() => {
    loadUniqueUsers()
    loadMemoryStats()
  }, [loadUniqueUsers, loadMemoryStats, assistantMemoryUserId])

  const handleMemoryToggle = (enabled: boolean) => {
    updateAssistant({ ...assistant, enableMemory: enabled })
  }

  const handleMemoryUserChange = (userId: string) => {
    updateAssistant({ ...assistant, memoryUserId: userId })
  }

  const handleMemoryWritePermissionToggle = (enabled: boolean) => {
    updateAssistant({ ...assistant, memoryWritePermission: enabled })
  }

  const handleAddUser = () => {
    // Navigate to memory settings to add new user
    if (onClose) {
      onClose()
    }
    window.location.hash = '#/settings/memory'
  }

  const handleNavigateToMemory = () => {
    // Close current modal/page first
    if (onClose) {
      onClose()
    }
    // Then navigate to memory settings page
    window.location.hash = '#/settings/memory'
  }

  const isMemoryConfigured = memoryConfig.embedderApiClient && memoryConfig.llmApiClient
  const isMemoryEnabled = globalMemoryEnabled && isMemoryConfigured

  return (
    <Container>
      <HeaderContainer>
        <Box style={{ fontWeight: 'bold', fontSize: '14px' }}>
          {t('memory.title')}
          <Tooltip title={t('memory.description')}>
            <InfoIcon />
          </Tooltip>
        </Box>
        <Space>
          <Button type="text" icon={<Settings2 size={15} />} onClick={handleNavigateToMemory} />
          <Tooltip
            title={
              !globalMemoryEnabled
                ? t('memory.enable_global_memory_first')
                : !isMemoryConfigured
                  ? t('memory.configure_memory_first')
                  : ''
            }>
            <Switch
              checked={assistant.enableMemory || false}
              onChange={handleMemoryToggle}
              disabled={!isMemoryEnabled}
            />
          </Tooltip>
        </Space>
      </HeaderContainer>

      {!globalMemoryEnabled && (
        <Alert
          type="warning"
          message={t('memory.global_memory_disabled_title')}
          description={t('memory.global_memory_disabled_desc')}
          showIcon
          style={{ marginBottom: 16 }}
          action={
            <Button size="small" onClick={handleNavigateToMemory}>
              {t('memory.go_to_memory_page')}
            </Button>
          }
        />
      )}

      {globalMemoryEnabled && !isMemoryConfigured && (
        <Alert
          type="warning"
          message={t('memory.not_configured_title')}
          description={t('memory.not_configured_desc')}
          showIcon
          style={{ marginBottom: 16 }}
        />
      )}

      <Card size="small" style={{ marginBottom: 16 }}>
        <Space direction="vertical" style={{ width: '100%' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Text strong>{t('memory.memory_role_selector')}: </Text>
            <UserSelector
              currentUser={assistantMemoryUserId}
              uniqueUsers={uniqueUsers}
              onUserSwitch={handleMemoryUserChange}
              onAddUser={handleAddUser}
            />
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <Space>
              <Text strong>{t('memory.write_permission')}: </Text>
              <Tooltip title={t('memory.write_permission_desc')}>
                <InfoIcon />
              </Tooltip>
            </Space>
            <Switch
              checked={assistant.memoryWritePermission !== false}
              onChange={handleMemoryWritePermissionToggle}
              disabled={!assistant.enableMemory || !isMemoryEnabled}
            />
          </div>
          <div>
            <Text strong>{t('memory.stored_memories')}: </Text>
            <Text>{memoryStats.loading ? t('common.loading') : memoryStats.count}</Text>
          </div>
          {memoryConfig.embedderApiClient && (
            <div>
              <Text strong>{t('memory.embedding_model')}: </Text>
              <Text code>{memoryConfig.embedderApiClient.model}</Text>
            </div>
          )}
          {memoryConfig.llmApiClient && (
            <div>
              <Text strong>{t('memory.llm_model')}: </Text>
              <Text code>{memoryConfig.llmApiClient.model}</Text>
            </div>
          )}
        </Space>
      </Card>

      <MemoriesSettingsModal
        visible={settingsModalVisible}
        onSubmit={() => setSettingsModalVisible(false)}
        onCancel={() => setSettingsModalVisible(false)}
        form={form}
      />
    </Container>
  )
}

const Container = styled.div`
  display: flex;
  flex: 1;
  flex-direction: column;
  overflow: hidden;
`

const HeaderContainer = styled.div`
  display: flex;
  justify-content: space-between;
  align-items: center;
  margin-bottom: 16px;
`

const InfoIcon = styled(InfoCircleOutlined)`
  margin-left: 6px;
  font-size: 14px;
  color: var(--color-text-2);
  cursor: help;
`

export default AssistantMemorySettings
