import { RootState } from '@renderer/store'
import {
  addTagCategory,
  bulkUpdateCategorizedTags,
  removeTagCategory,
  updateTagCategory
} from '@renderer/store/assistants'
import { TagCategory, TagCategoryWithTags } from '@renderer/types'
import { uuid } from '@renderer/utils'
import { useCallback, useMemo } from 'react'
import { useDispatch, useSelector } from 'react-redux'

/**
 * 标签分类管理 Hook
 */
export function useTagCategories() {
  const dispatch = useDispatch()
  const tagCategories = useSelector((state: RootState) => state.assistants.tagCategories)
  const categorizedTags = useSelector((state: RootState) => state.assistants.categorizedTags)

  // 获取所有话题的标签
  const allTopicTags = useSelector((state: RootState) =>
    state.assistants.assistants.flatMap((assistant) => assistant.topics.flatMap((topic) => topic.tags || []))
  )

  // 计算标签使用统计
  const tagUsageStats = useMemo(() => {
    const stats: Record<string, number> = {}
    allTopicTags.forEach((tag) => {
      stats[tag] = (stats[tag] || 0) + 1
    })
    return stats
  }, [allTopicTags])

  // 获取所有独特的标签
  const allUniqueTags = useMemo(() => {
    return Array.from(new Set(allTopicTags)).sort()
  }, [allTopicTags])

  // 获取带有标签的分类列表
  const categoriesWithTags = useMemo((): TagCategoryWithTags[] => {
    const result: TagCategoryWithTags[] = []

    // 添加已有分类
    if (tagCategories && categorizedTags) {
      tagCategories.forEach((category) => {
        const categoryTags = Object.values(categorizedTags)
          .filter((tag) => tag.categoryId === category.id)
          .map((tag) => ({
            ...tag,
            usage: tagUsageStats[tag.name] || 0
          }))
          .sort((a, b) => b.usage - a.usage)

        result.push({
          ...category,
          tags: categoryTags
        })
      })
    }

    // 添加未分类的标签
    const uncategorizedTags = allUniqueTags
      .filter((tagName) => !categorizedTags?.[tagName] || !categorizedTags[tagName].categoryId)
      .map((tagName) => ({
        name: tagName,
        usage: tagUsageStats[tagName] || 0
      }))
      .sort((a, b) => b.usage - a.usage)

    if (uncategorizedTags.length > 0) {
      result.push({
        id: 'uncategorized',
        name: '未分类',
        order: 999,
        createdAt: '',
        updatedAt: '',
        tags: uncategorizedTags
      })
    }

    return result.sort((a, b) => a.order - b.order)
  }, [tagCategories, categorizedTags, allUniqueTags, tagUsageStats])

  // 创建新分类
  const createCategory = useCallback(
    (categoryData: Omit<TagCategory, 'id' | 'createdAt' | 'updatedAt'>) => {
      const category: TagCategory = {
        ...categoryData,
        id: uuid(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      }
      
      dispatch(addTagCategory(category))
      
      return category
    },
    [dispatch]
  )

  // 更新分类
  const updateCategory = useCallback(
    (category: TagCategory) => {
      const updatedCategory = {
        ...category,
        updatedAt: new Date().toISOString()
      }
      dispatch(updateTagCategory(updatedCategory))
    },
    [dispatch]
  )

  // 删除分类
  const deleteCategory = useCallback(
    (categoryId: string) => {
      dispatch(removeTagCategory({ id: categoryId }))
    },
    [dispatch]
  )

  // 将标签分配到分类
  const assignTagsToCategory = useCallback(
    (tags: string[], categoryId?: string) => {
      dispatch(bulkUpdateCategorizedTags({ tags, categoryId }))
    },
    [dispatch]
  )

  // 移动标签到其他分类
  const moveTagsToCategory = useCallback(
    (tags: string[], targetCategoryId?: string) => {
      assignTagsToCategory(tags, targetCategoryId)
    },
    [assignTagsToCategory]
  )

  // 获取分类下的标签
  const getTagsByCategory = useCallback(
    (categoryId: string) => {
      if (!categorizedTags) return []
      return Object.values(categorizedTags)
        .filter((tag) => tag.categoryId === categoryId)
        .map((tag) => ({
          ...tag,
          usage: tagUsageStats[tag.name] || 0
        }))
        .sort((a, b) => b.usage - a.usage)
    },
    [categorizedTags, tagUsageStats]
  )

  // 搜索标签
  const searchTags = useCallback(
    (query: string) => {
      return allUniqueTags.filter((tag) => tag.toLowerCase().includes(query.toLowerCase()))
    },
    [allUniqueTags]
  )

  return {
    tagCategories,
    categorizedTags,
    categoriesWithTags,
    allUniqueTags,
    tagUsageStats,
    createCategory,
    updateCategory,
    deleteCategory,
    assignTagsToCategory,
    moveTagsToCategory,
    getTagsByCategory,
    searchTags
  }
}
