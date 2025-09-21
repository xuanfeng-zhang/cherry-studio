import { DraggableVirtualList } from '@renderer/components/DraggableList'
import { CopyIcon, DeleteIcon, EditIcon } from '@renderer/components/Icons'
import ObsidianExportPopup from '@renderer/components/Popups/ObsidianExportPopup'
import PromptPopup from '@renderer/components/Popups/PromptPopup'
import SaveToKnowledgePopup from '@renderer/components/Popups/SaveToKnowledgePopup'
import TagManagementPopup from '@renderer/components/Popups/TagManagementPopup'
import TopicTagFilter from '@renderer/components/TopicTagFilter'
import { isMac } from '@renderer/config/constant'
import { useAssistant, useAssistants } from '@renderer/hooks/useAssistant'
import { useInPlaceEdit } from '@renderer/hooks/useInPlaceEdit'
import { useNotesSettings } from '@renderer/hooks/useNotesSettings'
import { modelGenerating } from '@renderer/hooks/useRuntime'
import { useSettings } from '@renderer/hooks/useSettings'
import { finishTopicRenaming, startTopicRenaming, TopicManager } from '@renderer/hooks/useTopic'
import { useTopicTags } from '@renderer/hooks/useTopicTags'
import { fetchMessagesSummary } from '@renderer/services/ApiService'
import { EVENT_NAMES, EventEmitter } from '@renderer/services/EventService'
import store from '@renderer/store'
import { RootState } from '@renderer/store'
import { newMessagesActions } from '@renderer/store/newMessage'
import { setGenerating } from '@renderer/store/runtime'
import { Assistant, Topic } from '@renderer/types'
import { classNames, removeSpecialCharactersForFileName } from '@renderer/utils'
import { copyTopicAsMarkdown, copyTopicAsPlainText } from '@renderer/utils/copy'
import {
  exportMarkdownToJoplin,
  exportMarkdownToSiyuan,
  exportMarkdownToYuque,
  exportTopicAsMarkdown,
  exportTopicToNotes,
  exportTopicToNotion,
  topicToMarkdown
} from '@renderer/utils/export'
import { Dropdown, MenuProps, Tooltip } from 'antd'
import { ItemType, MenuItemType } from 'antd/es/menu/interface'
import dayjs from 'dayjs'
import { findIndex } from 'lodash'
import {
  BrushCleaning,
  Check,
  FolderOpen,
  HelpCircle,
  MenuIcon,
  NotebookPen,
  PackagePlus,
  PinIcon,
  PinOffIcon,
  Plus,
  PlusIcon,
  Save,
  Sparkles,
  TagIcon,
  UploadIcon,
  XIcon
} from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

// const logger = loggerService.withContext('TopicsTab')

interface Props {
  assistant: Assistant
  activeTopic: Topic
  setActiveTopic: (topic: Topic) => void
  position: 'left' | 'right'
}

const Topics: FC<Props> = ({ assistant: _assistant, activeTopic, setActiveTopic, position }) => {
  const { t } = useTranslation()
  const { notesPath } = useNotesSettings()
  const { assistants } = useAssistants()
  const { assistant, removeTopic, moveTopic, updateTopic, updateTopics } = useAssistant(_assistant.id)
  const { showTopicTime, pinTopicsToTop, setTopicPosition, topicPosition } = useSettings()
  const { allTags } = useTopicTags()

  const renamingTopics = useSelector((state: RootState) => state.runtime.chat.renamingTopics)
  const topicLoadingQuery = useSelector((state: RootState) => state.messages.loadingByTopic)
  const topicFulfilledQuery = useSelector((state: RootState) => state.messages.fulfilledByTopic)
  const newlyRenamedTopics = useSelector((state: RootState) => state.runtime.chat.newlyRenamedTopics)

  const borderRadius = showTopicTime ? 12 : 'var(--list-item-border-radius)'

  const [deletingTopicId, setDeletingTopicId] = useState<string | null>(null)
  const deleteTimerRef = useRef<NodeJS.Timeout>(null)
  const [editingTopicId, setEditingTopicId] = useState<string | null>(null)

  const topicEdit = useInPlaceEdit({
    onSave: (name: string) => {
      const topic = assistant.topics.find((t) => t.id === editingTopicId)
      if (topic && name !== topic.name) {
        const updatedTopic = { ...topic, name, isNameManuallyEdited: true }
        updateTopic(updatedTopic)
        window.message.success(t('common.saved'))
      }
      setEditingTopicId(null)
    },
    onCancel: () => {
      setEditingTopicId(null)
    }
  })

  const isPending = useCallback((topicId: string) => topicLoadingQuery[topicId], [topicLoadingQuery])
  const isFulfilled = useCallback((topicId: string) => topicFulfilledQuery[topicId], [topicFulfilledQuery])
  const dispatch = useDispatch()

  useEffect(() => {
    dispatch(newMessagesActions.setTopicFulfilled({ topicId: activeTopic.id, fulfilled: false }))
  }, [activeTopic.id, dispatch, topicFulfilledQuery])

  const isRenaming = useCallback(
    (topicId: string) => {
      return renamingTopics.includes(topicId)
    },
    [renamingTopics]
  )

  const isNewlyRenamed = useCallback(
    (topicId: string) => {
      return newlyRenamedTopics.includes(topicId)
    },
    [newlyRenamedTopics]
  )

  const handleDeleteClick = useCallback((topicId: string, e: React.MouseEvent) => {
    e.stopPropagation()

    if (deleteTimerRef.current) {
      clearTimeout(deleteTimerRef.current)
    }

    setDeletingTopicId(topicId)

    deleteTimerRef.current = setTimeout(() => setDeletingTopicId(null), 2000)
  }, [])

  const onClearMessages = useCallback((topic: Topic) => {
    // window.keyv.set(EVENT_NAMES.CHAT_COMPLETION_PAUSED, true)
    store.dispatch(setGenerating(false))
    EventEmitter.emit(EVENT_NAMES.CLEAR_MESSAGES, topic)
  }, [])

  const handleConfirmDelete = useCallback(
    async (topic: Topic, e: React.MouseEvent) => {
      e.stopPropagation()
      if (assistant.topics.length === 1) {
        return onClearMessages(topic)
      }
      await modelGenerating()
      const index = findIndex(assistant.topics, (t) => t.id === topic.id)
      if (topic.id === activeTopic.id) {
        setActiveTopic(assistant.topics[index + 1 === assistant.topics.length ? index - 1 : index + 1])
      }
      removeTopic(topic)
      setDeletingTopicId(null)
    },
    [activeTopic.id, assistant.topics, onClearMessages, removeTopic, setActiveTopic]
  )

  const onPinTopic = useCallback(
    (topic: Topic) => {
      const updatedTopic = { ...topic, pinned: !topic.pinned }
      updateTopic(updatedTopic)
    },
    [updateTopic]
  )

  const onDeleteTopic = useCallback(
    async (topic: Topic) => {
      await modelGenerating()
      if (topic.id === activeTopic?.id) {
        const index = findIndex(assistant.topics, (t) => t.id === topic.id)
        setActiveTopic(assistant.topics[index + 1 === assistant.topics.length ? index - 1 : index + 1])
      }
      removeTopic(topic)
    },
    [assistant.topics, removeTopic, setActiveTopic, activeTopic]
  )

  const onMoveTopic = useCallback(
    async (topic: Topic, toAssistant: Assistant) => {
      await modelGenerating()
      const index = findIndex(assistant.topics, (t) => t.id === topic.id)
      setActiveTopic(assistant.topics[index + 1 === assistant.topics.length ? 0 : index + 1])
      moveTopic(topic, toAssistant)
    },
    [assistant.topics, moveTopic, setActiveTopic]
  )

  const onSwitchTopic = useCallback(
    async (topic: Topic) => {
      // await modelGenerating()
      setActiveTopic(topic)
    },
    [setActiveTopic]
  )

  const onTagToggle = useCallback(
    (topic: Topic, tag: string) => {
      const currentTags = topic.tags || []
      const newTags = currentTags.includes(tag) ? currentTags.filter((t) => t !== tag) : [...currentTags, tag]

      const updatedTopic = { ...topic, tags: newTags }
      updateTopic(updatedTopic)
      // 同时更新targetTopic状态以便菜单实时显示最新状态
      setTargetTopic(updatedTopic)
      window.message.success(t('common.saved'))
    },
    [updateTopic, t]
  )

  const onOpenTagManager = useCallback(
    (topic: Topic) => {
      const modal = window.modal.info({
        title: null,
        content: (
          <TagManagementPopup
            topic={topic}
            availableTags={allTags}
            onConfirm={(tags) => {
              const updatedTopic = { ...topic, tags }
              updateTopic(updatedTopic)
              window.message.success(t('common.saved'))
              modal.destroy()
            }}
            onCancel={() => {
              modal.destroy()
            }}
          />
        ),
        footer: null,
        closable: false,
        width: 600,
        centered: true
      })
    },
    [allTags, updateTopic, t]
  )

  const exportMenuOptions = useSelector((state: RootState) => state.settings.exportMenuOptions)

  const [_targetTopic, setTargetTopic] = useState<Topic | null>(null)
  const [dropdownVisible, setDropdownVisible] = useState<Record<string, boolean>>({})
  const getTopicMenuItems = useMemo(() => {
    const topic = _targetTopic // 使用最新的topic数据，不使用延迟值
    if (!topic) return []

    const menus: MenuProps['items'] = [
      {
        label: t('chat.topics.auto_rename'),
        key: 'auto-rename',
        icon: <Sparkles size={14} />,
        disabled: isRenaming(topic.id),
        async onClick() {
          const messages = await TopicManager.getTopicMessages(topic.id)
          if (messages.length >= 2) {
            startTopicRenaming(topic.id)
            try {
              const summaryText = await fetchMessagesSummary({ messages, assistant })
              if (summaryText) {
                const updatedTopic = { ...topic, name: summaryText, isNameManuallyEdited: false }
                updateTopic(updatedTopic)
              } else {
                window.message?.error(t('message.error.fetchTopicName'))
              }
            } finally {
              finishTopicRenaming(topic.id)
            }
          }
        }
      },
      {
        label: t('chat.topics.edit.title'),
        key: 'rename',
        icon: <EditIcon size={14} />,
        disabled: isRenaming(topic.id),
        async onClick() {
          const name = await PromptPopup.show({
            title: t('chat.topics.edit.title'),
            message: '',
            defaultValue: topic?.name || '',
            extraNode: (
              <div style={{ color: 'var(--color-text-3)', marginTop: 8 }}>{t('chat.topics.edit.title_tip')}</div>
            )
          })
          if (name && topic?.name !== name) {
            const updatedTopic = { ...topic, name, isNameManuallyEdited: true }
            updateTopic(updatedTopic)
          }
        }
      },
      {
        label: t('chat.topics.prompt.label'),
        key: 'topic-prompt',
        icon: <PackagePlus size={14} />,
        extra: (
          <Tooltip title={t('chat.topics.prompt.tips')}>
            <HelpCircle size={14} />
          </Tooltip>
        ),
        async onClick() {
          const prompt = await PromptPopup.show({
            title: t('chat.topics.prompt.edit.title'),
            message: '',
            defaultValue: topic?.prompt || '',
            inputProps: {
              rows: 8,
              allowClear: true
            }
          })

          prompt !== null &&
            (() => {
              const updatedTopic = { ...topic, prompt: prompt.trim() }
              updateTopic(updatedTopic)
              topic.id === activeTopic.id && setActiveTopic(updatedTopic)
            })()
        }
      },
      {
        label: topic.pinned ? t('chat.topics.unpin') : t('chat.topics.pin'),
        key: 'pin',
        icon: topic.pinned ? <PinOffIcon size={14} /> : <PinIcon size={14} />,
        onClick() {
          onPinTopic(topic)
        }
      },
      {
        label: t('chat.topics.tags.manage.title'),
        key: 'tags-manage',
        icon: <TagIcon size={14} />,
        children: (() => {
          const items: MenuProps['items'] = []

          // 添加已有标签选项
          if (allTags.length > 0) {
            allTags.forEach((tag) => {
              const isSelected = (topic.tags || []).includes(tag)
              items.push({
                key: `tag-${tag}`,
                label: (
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'space-between',
                      minWidth: '120px'
                    }}
                    onMouseDown={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                    }}
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onTagToggle(topic, tag)
                      // 保持菜单打开
                      setDropdownVisible((prev) => ({ ...prev, [topic.id]: true }))
                    }}>
                    <span
                      style={{
                        color: isSelected ? 'var(--color-primary)' : 'var(--color-text-1)',
                        fontWeight: isSelected ? 500 : 400
                      }}>
                      {tag}
                    </span>
                    {isSelected && <Check size={14} />}
                  </div>
                )
              })
            })

            items.push({ type: 'divider' })
          }

          // 添加标签管理选项
          items.push({
            key: 'manage-tags',
            label: (
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <Plus size={14} />
                {allTags.length > 0 ? t('chat.topics.tags.add') : t('chat.topics.tags.add_first')}
              </div>
            ),
            onClick: () => onOpenTagManager(topic)
          })

          return items
        })()
      },
      {
        label: t('notes.save'),
        key: 'notes',
        icon: <NotebookPen size={14} />,
        onClick: async () => {
          exportTopicToNotes(topic, notesPath)
        }
      },
      {
        label: t('chat.topics.clear.title'),
        key: 'clear-messages',
        icon: <BrushCleaning size={14} />,
        async onClick() {
          window.modal.confirm({
            title: t('chat.input.clear.content'),
            centered: true,
            onOk: () => onClearMessages(topic)
          })
        }
      },
      {
        label: t('settings.topic.position.label'),
        key: 'topic-position',
        icon: <MenuIcon size={14} />,
        children: [
          {
            label: t('settings.topic.position.left'),
            key: 'left',
            onClick: () => setTopicPosition('left')
          },
          {
            label: t('settings.topic.position.right'),
            key: 'right',
            onClick: () => setTopicPosition('right')
          }
        ]
      },
      {
        label: t('chat.topics.copy.title'),
        key: 'copy',
        icon: <CopyIcon size={14} />,
        children: [
          {
            label: t('chat.topics.copy.image'),
            key: 'img',
            onClick: () => EventEmitter.emit(EVENT_NAMES.COPY_TOPIC_IMAGE, topic)
          },
          {
            label: t('chat.topics.copy.md'),
            key: 'md',
            onClick: () => copyTopicAsMarkdown(topic)
          },
          {
            label: t('chat.topics.copy.plain_text'),
            key: 'plain_text',
            onClick: () => copyTopicAsPlainText(topic)
          }
        ]
      },
      {
        label: t('chat.save.label'),
        key: 'save',
        icon: <Save size={14} />,
        children: [
          {
            label: t('chat.save.topic.knowledge.title'),
            key: 'knowledge',
            onClick: async () => {
              try {
                const result = await SaveToKnowledgePopup.showForTopic(topic)
                if (result?.success) {
                  window.message.success(t('chat.save.topic.knowledge.success', { count: result.savedCount }))
                }
              } catch {
                window.message.error(t('chat.save.topic.knowledge.error.save_failed'))
              }
            }
          }
        ]
      },
      {
        label: t('chat.topics.export.title'),
        key: 'export',
        icon: <UploadIcon size={14} />,
        children: [
          exportMenuOptions.image && {
            label: t('chat.topics.export.image'),
            key: 'image',
            onClick: () => EventEmitter.emit(EVENT_NAMES.EXPORT_TOPIC_IMAGE, topic)
          },
          exportMenuOptions.markdown && {
            label: t('chat.topics.export.md.label'),
            key: 'markdown',
            onClick: () => exportTopicAsMarkdown(topic)
          },
          exportMenuOptions.markdown_reason && {
            label: t('chat.topics.export.md.reason'),
            key: 'markdown_reason',
            onClick: () => exportTopicAsMarkdown(topic, true)
          },
          exportMenuOptions.docx && {
            label: t('chat.topics.export.word'),
            key: 'word',
            onClick: async () => {
              const markdown = await topicToMarkdown(topic)
              window.api.export.toWord(markdown, removeSpecialCharactersForFileName(topic.name))
            }
          },
          exportMenuOptions.notion && {
            label: t('chat.topics.export.notion'),
            key: 'notion',
            onClick: async () => {
              exportTopicToNotion(topic)
            }
          },
          exportMenuOptions.yuque && {
            label: t('chat.topics.export.yuque'),
            key: 'yuque',
            onClick: async () => {
              const markdown = await topicToMarkdown(topic)
              exportMarkdownToYuque(topic.name, markdown)
            }
          },
          exportMenuOptions.obsidian && {
            label: t('chat.topics.export.obsidian'),
            key: 'obsidian',
            onClick: async () => {
              await ObsidianExportPopup.show({ title: topic.name, topic, processingMethod: '3' })
            }
          },
          exportMenuOptions.joplin && {
            label: t('chat.topics.export.joplin'),
            key: 'joplin',
            onClick: async () => {
              const topicMessages = await TopicManager.getTopicMessages(topic.id)
              exportMarkdownToJoplin(topic.name, topicMessages)
            }
          },
          exportMenuOptions.siyuan && {
            label: t('chat.topics.export.siyuan'),
            key: 'siyuan',
            onClick: async () => {
              const markdown = await topicToMarkdown(topic)
              exportMarkdownToSiyuan(topic.name, markdown)
            }
          }
        ].filter(Boolean) as ItemType<MenuItemType>[]
      }
    ]

    if (assistants.length > 1 && assistant.topics.length > 1) {
      menus.push({
        label: t('chat.topics.move_to'),
        key: 'move',
        icon: <FolderOpen size={14} />,
        children: assistants
          .filter((a) => a.id !== assistant.id)
          .map((a) => ({
            label: a.name,
            key: a.id,
            onClick: () => onMoveTopic(topic, a)
          }))
      })
    }

    if (assistant.topics.length > 1 && !topic.pinned) {
      menus.push({ type: 'divider' })
      menus.push({
        label: t('common.delete'),
        danger: true,
        key: 'delete',
        icon: <DeleteIcon size={14} className="lucide-custom" />,
        onClick: () => onDeleteTopic(topic)
      })
    }

    return menus
  }, [
    _targetTopic,
    t,
    isRenaming,
    exportMenuOptions.image,
    exportMenuOptions.markdown,
    exportMenuOptions.markdown_reason,
    exportMenuOptions.docx,
    exportMenuOptions.notion,
    exportMenuOptions.yuque,
    exportMenuOptions.obsidian,
    exportMenuOptions.joplin,
    exportMenuOptions.siyuan,
    assistants,
    notesPath,
    assistant,
    updateTopic,
    activeTopic.id,
    setActiveTopic,
    onPinTopic,
    onClearMessages,
    setTopicPosition,
    onMoveTopic,
    onDeleteTopic,
    allTags,
    onTagToggle,
    onOpenTagManager
  ])

  // Get tag filter state
  const topicTagFilter = useSelector((state: RootState) => state.assistants.topicTagFilter)
  const isCurrentAssistant = assistant && topicTagFilter?.assistantId === assistant.id
  const selectedTags = isCurrentAssistant ? topicTagFilter?.selectedTags || [] : []

  // Filter and sort topics based on tags and pinned status
  const sortedTopics = useMemo(() => {
    if (!assistant) return []

    let filteredTopics = assistant.topics

    // Apply tag filter if any tags are selected for current assistant
    if (selectedTags.length > 0) {
      filteredTopics = assistant.topics.filter((topic) => selectedTags.every((tag) => topic.tags?.includes(tag)))
    }

    // Sort by pinned status if enabled
    if (pinTopicsToTop) {
      return [...filteredTopics].sort((a, b) => {
        if (a.pinned && !b.pinned) return -1
        if (!a.pinned && b.pinned) return 1
        return 0
      })
    }

    return filteredTopics
  }, [assistant?.topics, pinTopicsToTop, selectedTags, assistant])

  const singlealone = topicPosition === 'right' && position === 'right'

  return (
    <>
      <DraggableVirtualList
        className="topics-tab"
        list={sortedTopics}
        onUpdate={updateTopics}
        style={{ height: '100%', padding: '13px 0 10px 10px' }}
        itemContainerStyle={{ paddingBottom: '8px' }}
        header={
          <>
            <AddTopicButton onClick={() => EventEmitter.emit(EVENT_NAMES.ADD_NEW_TOPIC)}>
              <PlusIcon size={16} />
              {t('chat.add.topic.title')}
            </AddTopicButton>
            <TopicTagFilter assistantId={assistant?.id} />
          </>
        }>
        {(topic) => {
          const isActive = topic.id === activeTopic?.id
          const topicName = topic.name.replace('`', '')
          const topicPrompt = topic.prompt
          const fullTopicPrompt = t('common.prompt') + ': ' + topicPrompt

          const getTopicNameClassName = () => {
            if (isRenaming(topic.id)) return 'shimmer'
            if (isNewlyRenamed(topic.id)) return 'typing'
            return ''
          }

          return (
            <Dropdown
              menu={{ items: getTopicMenuItems }}
              trigger={['contextMenu']}
              open={dropdownVisible[topic.id] || false}
              onOpenChange={(visible) => {
                setDropdownVisible((prev) => ({ ...prev, [topic.id]: visible }))
                if (visible) {
                  setTargetTopic(topic)
                }
              }}>
              <TopicListItem
                onContextMenu={() => {
                  setTargetTopic(topic)
                  setDropdownVisible((prev) => ({ ...prev, [topic.id]: true }))
                }}
                className={classNames(isActive ? 'active' : '', singlealone ? 'singlealone' : '')}
                onClick={editingTopicId === topic.id && topicEdit.isEditing ? undefined : () => onSwitchTopic(topic)}
                style={{
                  borderRadius,
                  cursor: editingTopicId === topic.id && topicEdit.isEditing ? 'default' : 'pointer'
                }}>
                {isPending(topic.id) && !isActive && <PendingIndicator />}
                {isFulfilled(topic.id) && !isActive && <FulfilledIndicator />}
                <TopicNameContainer>
                  {editingTopicId === topic.id && topicEdit.isEditing ? (
                    <TopicEditInput
                      ref={topicEdit.inputRef}
                      value={topicEdit.editValue}
                      onChange={topicEdit.handleInputChange}
                      onKeyDown={topicEdit.handleKeyDown}
                      onClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <TopicName
                      className={getTopicNameClassName()}
                      title={topicName}
                      onDoubleClick={() => {
                        setEditingTopicId(topic.id)
                        topicEdit.startEdit(topic.name)
                      }}>
                      {topicName}
                    </TopicName>
                  )}

                  {/* 标签指示器 */}
                  {topic.tags && topic.tags.length > 0 && (
                    <TopicTagsIndicator>
                      <TagIcon size={12} />
                      <TopicTagsCount>{topic.tags.length}</TopicTagsCount>
                    </TopicTagsIndicator>
                  )}

                  {!topic.pinned && (
                    <Tooltip
                      placement="bottom"
                      mouseEnterDelay={0.7}
                      mouseLeaveDelay={0}
                      title={
                        <div style={{ fontSize: '12px', opacity: 0.8, fontStyle: 'italic' }}>
                          {t('chat.topics.delete.shortcut', { key: isMac ? '⌘' : 'Ctrl' })}
                        </div>
                      }>
                      <MenuButton
                        className="menu"
                        onClick={(e) => {
                          if (e.ctrlKey || e.metaKey) {
                            handleConfirmDelete(topic, e)
                          } else if (deletingTopicId === topic.id) {
                            handleConfirmDelete(topic, e)
                          } else {
                            handleDeleteClick(topic.id, e)
                          }
                        }}>
                        {deletingTopicId === topic.id ? (
                          <DeleteIcon size={14} color="var(--color-error)" style={{ pointerEvents: 'none' }} />
                        ) : (
                          <XIcon size={14} color="var(--color-text-3)" style={{ pointerEvents: 'none' }} />
                        )}
                      </MenuButton>
                    </Tooltip>
                  )}
                  {topic.pinned && (
                    <MenuButton className="pin">
                      <PinIcon size={14} color="var(--color-text-3)" />
                    </MenuButton>
                  )}
                </TopicNameContainer>
                {topicPrompt && (
                  <TopicPromptText className="prompt" title={fullTopicPrompt}>
                    {fullTopicPrompt}
                  </TopicPromptText>
                )}
                {showTopicTime && (
                  <TopicTimeContainer className="time-tags">
                    <TopicTime className="time">{dayjs(topic.createdAt).format('MM/DD HH:mm')}</TopicTime>
                    {topic.tags && topic.tags.length > 0 && (
                      <>
                        <TopicTimeSeparator>•</TopicTimeSeparator>
                        <TopicTagsContainer className="tags">
                          {topic.tags.map((tag) => (
                            <TopicTag key={tag}>{tag}</TopicTag>
                          ))}
                        </TopicTagsContainer>
                      </>
                    )}
                  </TopicTimeContainer>
                )}
              </TopicListItem>
            </Dropdown>
          )
        }}
      </DraggableVirtualList>

      {/* Empty state when no topics match the filter */}
      {selectedTags.length > 0 && sortedTopics.length === 0 && (
        <EmptyFilterState>
          <EmptyFilterIcon>🏷️</EmptyFilterIcon>
          <EmptyFilterTitle>{t('chat.topics.filter.no_results')}</EmptyFilterTitle>
          <EmptyFilterDescription>
            {t('chat.topics.filter.no_results_desc', { tags: selectedTags.join(', ') })}
          </EmptyFilterDescription>
        </EmptyFilterState>
      )}
    </>
  )
}

const TopicListItem = styled.div`
  padding: 7px 12px;
  border-radius: var(--list-item-border-radius);
  font-size: 13px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  cursor: pointer;
  width: calc(var(--assistants-width) - 20px);

  .menu {
    opacity: 0;
    color: var(--color-text-3);
  }

  &:hover {
    background-color: var(--color-list-item-hover);
    transition: background-color 0.1s;

    .menu {
      opacity: 1;
    }
  }

  &.active {
    background-color: var(--color-list-item);
    box-shadow: 0 1px 2px 0 rgba(0, 0, 0, 0.05);
    .menu {
      opacity: 1;

      &:hover {
        color: var(--color-text-2);
      }
    }
  }
  &.singlealone {
    border-radius: 0 !important;
    &:hover {
      background-color: var(--color-background-soft);
    }
    &.active {
      border-left: 2px solid var(--color-primary);
      box-shadow: none;
    }
  }
`

const TopicNameContainer = styled.div`
  display: flex;
  flex-direction: row;
  align-items: center;
  gap: 4px;
  height: 20px;
  justify-content: space-between;
`

const TopicName = styled.div`
  display: -webkit-box;
  -webkit-line-clamp: 1;
  -webkit-box-orient: vertical;
  overflow: hidden;
  font-size: 13px;
  position: relative;
  will-change: background-position, width;

  --color-shimmer-mid: var(--color-text-1);
  --color-shimmer-end: color-mix(in srgb, var(--color-text-1) 25%, transparent);

  &.shimmer {
    background: linear-gradient(to left, var(--color-shimmer-end), var(--color-shimmer-mid), var(--color-shimmer-end));
    background-size: 200% 100%;
    background-clip: text;
    color: transparent;
    animation: shimmer 3s linear infinite;
  }

  &.typing {
    display: block;
    -webkit-line-clamp: unset;
    -webkit-box-orient: unset;
    white-space: nowrap;
    overflow: hidden;
    animation: typewriter 0.5s steps(40, end);
  }

  @keyframes shimmer {
    0% {
      background-position: 200% 0;
    }
    100% {
      background-position: -200% 0;
    }
  }

  @keyframes typewriter {
    from {
      width: 0;
    }
    to {
      width: 100%;
    }
  }
`

const TopicEditInput = styled.input`
  background: var(--color-background);
  border: none;
  color: var(--color-text-1);
  font-size: 13px;
  font-family: inherit;
  padding: 2px 6px;
  width: 100%;
  outline: none;
  padding: 0;
`

const PendingIndicator = styled.div.attrs({
  className: 'animation-pulse'
})`
  --pulse-size: 5px;
  width: 5px;
  height: 5px;
  position: absolute;
  left: 3px;
  top: 15px;
  border-radius: 50%;
  background-color: var(--color-status-warning);
`

const FulfilledIndicator = styled.div.attrs({
  className: 'animation-pulse'
})`
  --pulse-size: 5px;
  width: 5px;
  height: 5px;
  position: absolute;
  left: 3px;
  top: 15px;
  border-radius: 50%;
  background-color: var(--color-status-success);
`

const AddTopicButton = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  width: calc(100% - 10px);
  padding: 7px 12px;
  margin-bottom: 8px;
  background: transparent;
  color: var(--color-text-2);
  font-size: 13px;
  border-radius: var(--list-item-border-radius);
  cursor: pointer;
  transition: all 0.2s;
  margin-top: -5px;

  &:hover {
    background-color: var(--color-list-item-hover);
    color: var(--color-text-1);
  }

  .anticon {
    font-size: 12px;
  }
`

const TopicPromptText = styled.div`
  color: var(--color-text-2);
  font-size: 12px;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  ~ .prompt-text {
    margin-top: 10px;
  }
`

const TopicTime = styled.div`
  color: var(--color-text-3);
  font-size: 11px;
`

const MenuButton = styled.div`
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  min-width: 20px;
  min-height: 20px;
  .anticon {
    font-size: 12px;
  }
`

const TopicTimeContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-wrap: wrap;
`

const TopicTimeSeparator = styled.span`
  color: var(--color-text-5);
  font-size: 10px;
  opacity: 0.5;
`

const TopicTagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 4px;
  align-items: center;
`

const TopicTagsIndicator = styled.div`
  display: flex;
  align-items: center;
  gap: 2px;
  padding: 2px 4px;
  border-radius: 4px;
  background-color: var(--color-background-soft);
  border: 1px solid var(--color-border);
  opacity: 0.7;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

const TopicTagsCount = styled.span`
  font-size: 10px;
  color: var(--color-text-2);
  font-weight: 500;
  line-height: 1;
`

const TopicTag = styled.div`
  color: var(--color-text-4);
  font-size: 10px;
  max-width: 60px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  opacity: 0.6;
  flex-shrink: 0;
  position: relative;

  &:not(:last-child)::after {
    content: '•';
    margin-left: 4px;
    color: var(--color-text-5);
    opacity: 0.5;
  }
`

const EmptyFilterState = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 40px 20px;
  text-align: center;
  color: var(--color-text-3);
`

const EmptyFilterIcon = styled.div`
  font-size: 32px;
  margin-bottom: 12px;
  opacity: 0.6;
`

const EmptyFilterTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--color-text-2);
`

const EmptyFilterDescription = styled.div`
  font-size: 12px;
  color: var(--color-text-3);
  line-height: 1.4;
  max-width: 200px;
`

export default Topics
