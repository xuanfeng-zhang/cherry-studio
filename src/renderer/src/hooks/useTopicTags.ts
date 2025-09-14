import { useCallback, useMemo } from 'react'
import { useSelector } from 'react-redux'

import { RootState } from '@renderer/store'
import { Topic } from '@renderer/types'

/**
 * 话题标签管理 Hook
 */
export function useTopicTags() {
  const topics = useSelector((state: RootState) => 
    state.assistants.assistants.flatMap(assistant => assistant.topics)
  )

  // 获取所有已使用的标签
  const allTags = useMemo(() => {
    const tagSet = new Set<string>()
    topics.forEach(topic => {
      topic.tags?.forEach(tag => tagSet.add(tag))
    })
    return Array.from(tagSet).sort()
  }, [topics])

  // 获取指定话题的标签
  const getTopicTags = useCallback((topicId: string): string[] => {
    const topic = topics.find(t => t.id === topicId)
    return topic?.tags || []
  }, [topics])

  // 根据标签筛选话题
  const getTopicsByTag = useCallback((tag: string): Topic[] => {
    return topics.filter(topic => topic.tags?.includes(tag))
  }, [topics])

  // 根据多个标签筛选话题（AND 逻辑）
  const getTopicsByTags = useCallback((tags: string[]): Topic[] => {
    if (tags.length === 0) return topics
    return topics.filter(topic => 
      tags.every(tag => topic.tags?.includes(tag))
    )
  }, [topics])

  // 获取标签使用统计
  const getTagStats = useCallback(() => {
    const stats: Record<string, number> = {}
    topics.forEach(topic => {
      topic.tags?.forEach(tag => {
        stats[tag] = (stats[tag] || 0) + 1
      })
    })
    return stats
  }, [topics])

  return {
    allTags,
    getTopicTags,
    getTopicsByTag,
    getTopicsByTags,
    getTagStats
  }
}
