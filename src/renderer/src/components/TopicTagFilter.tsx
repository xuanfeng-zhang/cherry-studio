import { Tag, Tooltip } from 'antd'
import { X } from 'lucide-react'
import { FC, useCallback, useEffect, useMemo } from 'react'
import { useTranslation } from 'react-i18next'
import { useDispatch, useSelector } from 'react-redux'
import styled from 'styled-components'

import { RootState } from '@renderer/store'
import { clearTopicTagFilter, toggleTopicTagFilter } from '@renderer/store/assistants'
import { useTopicTags } from '@renderer/hooks/useTopicTags'

interface TopicTagFilterProps {
  assistantId?: string
  className?: string
}

const TopicTagFilter: FC<TopicTagFilterProps> = ({ assistantId, className }) => {
  // 如果assistantId为undefined，直接返回null
  if (!assistantId) {
    return null
  }

  const { t } = useTranslation()
  const dispatch = useDispatch()
  const { allTags } = useTopicTags()
  
  const topicTagFilter = useSelector((state: RootState) => state.assistants.topicTagFilter)
  const isCurrentAssistant = topicTagFilter?.assistantId === assistantId
  const selectedTags = isCurrentAssistant ? (topicTagFilter?.selectedTags || []) : []
  
  // 获取当前助手的话题
  const assistant = useSelector((state: RootState) => 
    state.assistants.assistants.find(a => a.id === assistantId)
  )
  
  // 获取当前助手话题的标签统计
  const assistantTagStats = useMemo(() => {
    if (!assistant) return {}
    const stats: Record<string, number> = {}
    assistant.topics.forEach(topic => {
      topic.tags?.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1
      })
    })
    return stats
  }, [assistant])
  
  // 只显示当前助手有的标签
  const availableTags = useMemo(() => {
    return allTags.filter(tag => assistantTagStats[tag] > 0)
  }, [allTags, assistantTagStats])
  
  const handleTagClick = useCallback((tag: string) => {
    if (assistantId) {
      dispatch(toggleTopicTagFilter({ tag, assistantId }))
    }
  }, [dispatch, assistantId])
  
  const handleClearFilter = useCallback(() => {
    dispatch(clearTopicTagFilter())
  }, [dispatch])
  
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
  
  if (availableTags.length === 0) {
    return null
  }
  
  return (
    <FilterContainer className={className}>
      <FilterHeader>
        <FilterTitle>{t('chat.topics.filter.by_tags')}</FilterTitle>
        {selectedTags.length > 0 && (
          <Tooltip title={`${t('common.clear')} (Esc)`}>
            <ClearButton onClick={handleClearFilter}>
              <X size={12} />
              {t('common.clear')}
            </ClearButton>
          </Tooltip>
        )}
      </FilterHeader>
      
      <TagsContainer>
        {availableTags.map((tag) => {
          const isSelected = selectedTags.includes(tag)
          const count = assistantTagStats[tag] || 0
          
          return (
            <Tooltip key={tag} title={`${count} ${t('chat.topics.count')}`}>
              <FilterTag
                $selected={isSelected}
                onClick={() => handleTagClick(tag)}
              >
                {tag}
                <TagCount $selected={isSelected}>({count})</TagCount>
              </FilterTag>
            </Tooltip>
          )
        })}
      </TagsContainer>
    </FilterContainer>
  )
}

const FilterContainer = styled.div`
  padding: 8px 0;
  border-bottom: 1px solid var(--color-border-secondary);
  margin-bottom: 8px;
  animation: fadeIn 0.2s ease-in-out;
  
  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(-4px);
    }
    to {
      opacity: 1;
      transform: translateY(0);
    }
  }
`

const FilterHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
  padding: 0 4px;
`

const FilterTitle = styled.span`
  color: var(--color-text-3);
  font-size: 12px;
  font-weight: 500;
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
  
  &:hover {
    background-color: var(--color-fill-quaternary);
    color: var(--color-text-2);
  }
`

const TagsContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 0 4px;
`

const FilterTag = styled(Tag)<{ $selected: boolean }>`
  margin: 0;
  border-radius: 12px;
  font-size: 11px;
  padding: 2px 8px;
  line-height: 1.4;
  height: auto;
  cursor: pointer;
  user-select: none;
  transition: all 0.2s;
  display: flex;
  align-items: center;
  gap: 4px;
  
  ${props => props.$selected ? `
    background-color: var(--color-primary);
    border-color: var(--color-primary);
    color: white;
    
    &:hover {
      background-color: var(--color-primary-hover);
      border-color: var(--color-primary-hover);
      color: white;
    }
  ` : `
    background-color: var(--color-fill-quaternary);
    border-color: var(--color-border-secondary);
    color: var(--color-text-tertiary);
    
    &:hover {
      background-color: var(--color-fill-tertiary);
      border-color: var(--color-border);
      color: var(--color-text-secondary);
    }
  `}
`

const TagCount = styled.span<{ $selected: boolean }>`
  font-size: 10px;
  opacity: ${props => props.$selected ? 0.8 : 0.6};
`

export default TopicTagFilter
