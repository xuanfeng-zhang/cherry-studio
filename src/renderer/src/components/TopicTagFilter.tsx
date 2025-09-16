import { useTagCategories } from '@renderer/hooks/useTagCategories'
import { useTopicTags } from '@renderer/hooks/useTopicTags'
import { RootState } from '@renderer/store'
import { clearTopicTagFilter, toggleTopicTagFilter } from '@renderer/store/assistants'
import { setTopicTagFilterCollapsed } from '@renderer/store/settings'
import { Button, Collapse, Tag, Tooltip } from 'antd'
import { ChevronDown, ChevronRight, Folder, Settings, X } from 'lucide-react'
import { FC, useCallback, useEffect, useMemo, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import TagCategoryManagementPopup from './Popups/TagCategoryManagementPopup'

interface TopicTagFilterProps {
  assistantId?: string
  className?: string
}

const TopicTagFilter: FC<TopicTagFilterProps> = ({ assistantId, className }) => {
  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { allTags } = useTopicTags()
  const { categoriesWithTags } = useTagCategories()
  const [showCategoryManagement, setShowCategoryManagement] = useState(false)
  // 智能展开：标签数≤3的分类默认展开
  const [expandedCategories, setExpandedCategories] = useState<string[]>(['uncategorized'])

  const topicTagFilter = useSelector((state: RootState) => state.assistants.topicTagFilter)
  const isCurrentAssistant = topicTagFilter?.assistantId === assistantId
  const selectedTags = isCurrentAssistant ? topicTagFilter?.selectedTags || [] : []
  
  // 获取折叠状态
  const isCollapsed = useSelector((state: RootState) => state.settings.topicTagFilterCollapsed)

  // 获取当前助手的话题
  const assistant = useSelector((state: RootState) => state.assistants.assistants.find((a) => a.id === assistantId))

  // 获取当前助手话题的标签统计
  const assistantTagStats = useMemo(() => {
    if (!assistant) return {}
    const stats: Record<string, number> = {}
    assistant.topics.forEach((topic) => {
      topic.tags?.forEach((tag) => {
        stats[tag] = (stats[tag] || 0) + 1
      })
    })
    return stats
  }, [assistant?.id, assistant?.topics?.length])

  // 过滤当前助手的标签分类
  const assistantCategoriesWithTags = useMemo(() => {
    return categoriesWithTags
      .map((category) => ({
        ...category,
        tags: category.tags
          .filter((tag) => assistantTagStats[tag.name] > 0)
          .map((tag) => ({
            ...tag,
            usage: assistantTagStats[tag.name]
          }))
      }))
      .filter((category) => category.tags.length > 0)
  }, [categoriesWithTags, assistantTagStats])

  // 当分类数据变化时，更新展开状态
  useEffect(() => {
    const shouldExpand = assistantCategoriesWithTags
      .filter((category) => category.tags.length <= 3)
      .map((category) => category.id)

    setExpandedCategories((prev) => {
      const newExpanded = [...new Set([...prev, ...shouldExpand])]
      // 简单比较，避免不必要的更新
      if (newExpanded.length !== prev.length) {
        return newExpanded
      }
      return prev
    })
  }, [assistantCategoriesWithTags.length])

  // 只显示当前助手有的标签（fallback到旧版本显示）
  const availableTags = useMemo(() => {
    return allTags.filter((tag) => assistantTagStats[tag] > 0)
  }, [allTags, assistantTagStats])

  const handleTagClick = useCallback(
    (tag: string) => {
      if (assistantId) {
        dispatch(toggleTopicTagFilter({ tag, assistantId }))
      }
    },
    [dispatch, assistantId]
  )

  const handleClearFilter = useCallback(() => {
    dispatch(clearTopicTagFilter())
  }, [dispatch])

  const handleCategoryChange = useCallback((keys: string | string[]) => {
    setExpandedCategories(Array.isArray(keys) ? keys : [keys])
  }, [])

  const handleToggleCollapse = useCallback(() => {
    dispatch(setTopicTagFilterCollapsed(!isCollapsed))
  }, [dispatch, isCollapsed])

  // Keyboard shortcut for clearing filter (Escape key)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && selectedTags.length > 0) {
        handleClearFilter()
      }
    }

    if (selectedTags.length > 0) {
      document.addEventListener('keydown', handleKeyDown)
      return () => document.removeEventListener('keydown', handleKeyDown)
    }

    return undefined
  }, [selectedTags.length, handleClearFilter])

  // 如果assistantId为undefined，直接返回null
  if (!assistantId) {
    return null
  }

  if (assistantCategoriesWithTags.length === 0 && availableTags.length === 0) {
    return null
  }

  return (
    <>
      <FilterContainer className={className}>
        <FilterHeader>
          <FilterTitleContainer onClick={handleToggleCollapse}>
            <CollapseIcon>
              {isCollapsed ? <ChevronRight size={12} /> : <ChevronDown size={12} />}
            </CollapseIcon>
            <FilterTitle>{t('chat.topics.filter.by_tags')}</FilterTitle>
            {selectedTags.length > 0 && (
              <SelectedCount>({selectedTags.length})</SelectedCount>
            )}
          </FilterTitleContainer>
          {!isCollapsed && (
            <FilterActions>
              {selectedTags.length > 0 && (
                <Tooltip title={`${t('common.clear')} (Esc)`}>
                  <ClearButton onClick={handleClearFilter}>
                    <X size={12} />
                    {t('common.clear')}
                  </ClearButton>
                </Tooltip>
              )}
              <Tooltip title={t('chat.topics.tags.manage_categories')}>
                <Button
                  type="text"
                  size="small"
                  icon={<Settings size={12} />}
                  onClick={() => setShowCategoryManagement(true)}
                />
              </Tooltip>
            </FilterActions>
          )}
        </FilterHeader>

        {/* 只在展开时显示内容 */}
        {!isCollapsed && (
          <>
            {/* 分类显示 */}
            {assistantCategoriesWithTags.length > 0 ? (
              <CategorizedContainer>
                <Collapse size="small" ghost activeKey={expandedCategories} onChange={handleCategoryChange}>
                  {assistantCategoriesWithTags.map((category) => (
                    <Collapse.Panel
                      key={category.id}
                      header={
                        <CategoryHeader>
                          <Folder size={14} style={{ color: category.color || 'var(--color-text-2)' }} />
                          <CategoryName>{category.name}</CategoryName>
                          <TagCount $selected={false}>({category.tags.length})</TagCount>
                        </CategoryHeader>
                      }>
                      <TagsContainer>
                        {category.tags.map((tag) => {
                          const isSelected = selectedTags.includes(tag.name)

                          return (
                            <Tooltip key={tag.name} title={`${tag.usage} ${t('chat.topics.count')}`}>
                              <FilterTag $selected={isSelected} onClick={() => handleTagClick(tag.name)}>
                                {tag.name}
                                <TagCount $selected={isSelected}>({tag.usage})</TagCount>
                              </FilterTag>
                            </Tooltip>
                          )
                        })}
                      </TagsContainer>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              </CategorizedContainer>
            ) : (
              // Fallback 到原来的显示方式
              <TagsContainer>
                {availableTags.map((tag) => {
                  const isSelected = selectedTags.includes(tag)
                  const count = assistantTagStats[tag] || 0

                  return (
                    <Tooltip key={tag} title={`${count} ${t('chat.topics.count')}`}>
                      <FilterTag $selected={isSelected} onClick={() => handleTagClick(tag)}>
                        {tag}
                        <TagCount $selected={isSelected}>({count})</TagCount>
                      </FilterTag>
                    </Tooltip>
                  )
                })}
              </TagsContainer>
            )}
          </>
        )}
      </FilterContainer>

      <TagCategoryManagementPopup open={showCategoryManagement} onClose={() => setShowCategoryManagement(false)} />
    </>
  )
}

const FilterContainer = styled.div`
  padding: 6px 0;
  border-bottom: 1px solid var(--color-border-tertiary);
  margin-bottom: 8px;
  animation: fadeIn 0.2s ease-in-out;
  opacity: 0.85;

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 0.85;
      transform: translateY(0);
    }
  }
`

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 2px;
`

const FilterTitleContainer = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  cursor: pointer;
  flex: 1;
  padding: 2px 0;
  border-radius: 4px;
  transition: background-color 0.2s;

  &:hover {
    background-color: var(--color-fill-quaternary);
  }
`

const CollapseIcon = styled.div`
  display: flex;
  align-items: center;
  color: var(--color-text-4);
  transition: color 0.2s;

  ${FilterTitleContainer}:hover & {
    color: var(--color-text-3);
  }
`

const FilterTitle = styled.span`
  color: var(--color-text-4);
  font-size: 11px;
  font-weight: 400;
  transition: color 0.2s;

  ${FilterTitleContainer}:hover & {
    color: var(--color-text-3);
  }
`

const SelectedCount = styled.span`
  color: var(--color-primary);
  font-size: 10px;
  font-weight: 500;
  margin-left: 2px;
`

const FilterActions = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  flex-shrink: 0;
  min-width: fit-content;
`

const CategorizedContainer = styled.div`
  .ant-collapse {
    border: none;
    background: transparent;
  }

  .ant-collapse-item {
    border: none;
  }

  .ant-collapse-header {
    padding: 4px 2px 4px 0 !important;
    border-radius: 4px;
    align-items: center !important;
    min-height: 28px;

    &:hover {
      background-color: var(--color-fill-quaternary);
    }

    .ant-collapse-arrow {
      font-size: 10px !important;
      color: var(--color-text-4) !important;
      opacity: 0.6;
      transition: all 0.2s;
      width: 12px !important;
      height: 12px !important;
      line-height: 12px !important;
      margin-right: 2px !important;
      margin-left: 0 !important;
    }

    &:hover .ant-collapse-arrow {
      opacity: 0.9;
      color: var(--color-text-3) !important;
    }
  }

  .ant-collapse-content-box {
    padding: 8px 0 0 0;
  }
`

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  line-height: 14px;
  height: 20px;
  opacity: 0.9;
  cursor: pointer;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

const CategoryName = styled.span`
  font-weight: 400;
`

const ClearButton = styled.button`
  display: flex;
  align-items: center;
  gap: 4px;
  background: none;
  border: none;
  color: var(--color-text-3);
  font-size: 11px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  transition: all 0.2s;
  white-space: nowrap;
  flex-shrink: 0;

  &:hover {
    background-color: var(--color-fill-quaternary);
    color: var(--color-text-2);
  }
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 5px;
  padding: 0 2px;
`

const FilterTag = styled(Tag)<{ $selected: boolean }>`
  margin: 0;
  border-radius: 10px;
  font-size: 10px;
  padding: 1px 6px;
  line-height: 1.3;
  height: auto;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 3px;

  ${(props) =>
    props.$selected
      ? `
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    
    &:hover {
      background-color: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
      color: white;
    }
  `
      : `
    background-color: var(--color-fill-quaternary);
    border-color: var(--color-border-tertiary);
    color: var(--color-text-4);
    opacity: 0.8;

    &:hover {
      background-color: var(--color-fill-tertiary);
      border-color: var(--color-border-secondary);
      color: var(--color-text-3);
      opacity: 1;
    }
  `}
`

const TagCount = styled.span<{ $selected: boolean }>`
  font-size: 10px;
  opacity: ${(props) => (props.$selected ? 0.8 : 0.6)};
`

export default TopicTagFilter
