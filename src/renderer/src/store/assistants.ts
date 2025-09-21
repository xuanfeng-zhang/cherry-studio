import { createSelector, createSlice, PayloadAction } from '@reduxjs/toolkit'
import { DEFAULT_CONTEXTCOUNT, DEFAULT_TEMPERATURE } from '@renderer/config/constant'
import { TopicManager } from '@renderer/hooks/useTopic'
import { getDefaultAssistant, getDefaultTopic } from '@renderer/services/AssistantService'
import { Assistant, AssistantSettings, CategorizedTag, Model, TagCategory, Topic } from '@renderer/types'
import { isEmpty, uniqBy } from 'lodash'

import { RootState } from '.'

export interface AssistantsState {
  defaultAssistant: Assistant
  assistants: Assistant[]
  tagsOrder: string[]
  collapsedTags: Record<string, boolean>
  topicTagFilter: {
    selectedTags: string[]
    assistantId?: string // 记录当前筛选的助手ID
  }
  tagCategories: TagCategory[] // 标签分类
  categorizedTags: Record<string, CategorizedTag> // 分类标签映射 key: tagName, value: CategorizedTag
}

const initialState: AssistantsState = {
  defaultAssistant: getDefaultAssistant(),
  assistants: [getDefaultAssistant()],
  tagsOrder: [],
  collapsedTags: {},
  topicTagFilter: {
    selectedTags: [],
    assistantId: undefined
  },
  tagCategories: [],
  categorizedTags: {}
}

const assistantsSlice = createSlice({
  name: 'assistants',
  initialState,
  reducers: {
    updateDefaultAssistant: (state, action: PayloadAction<{ assistant: Assistant }>) => {
      state.defaultAssistant = action.payload.assistant
    },
    updateAssistants: (state, action: PayloadAction<Assistant[]>) => {
      state.assistants = action.payload
    },
    addAssistant: (state, action: PayloadAction<Assistant>) => {
      state.assistants.push(action.payload)
    },
    insertAssistant: (state, action: PayloadAction<{ index: number; assistant: Assistant }>) => {
      const { index, assistant } = action.payload

      if (index < 0 || index > state.assistants.length) {
        throw new Error(`InsertAssistant: index ${index} is out of bounds [0, ${state.assistants.length}]`)
      }

      state.assistants.splice(index, 0, assistant)
    },
    removeAssistant: (state, action: PayloadAction<{ id: string }>) => {
      state.assistants = state.assistants.filter((c) => c.id !== action.payload.id)
    },
    updateAssistant: (state, action: PayloadAction<Assistant>) => {
      state.assistants = state.assistants.map((c) => (c.id === action.payload.id ? action.payload : c))
    },
    updateAssistantSettings: (
      state,
      action: PayloadAction<{ assistantId: string; settings: Partial<AssistantSettings> }>
    ) => {
      for (const assistant of state.assistants) {
        const settings = action.payload.settings
        if (assistant.id === action.payload.assistantId) {
          for (const key in settings) {
            if (!assistant.settings) {
              assistant.settings = {
                temperature: DEFAULT_TEMPERATURE,
                contextCount: DEFAULT_CONTEXTCOUNT,
                enableMaxTokens: false,
                maxTokens: 0,
                streamOutput: true
              }
            }
            assistant.settings[key] = settings[key]
          }
        }
      }
    },
    setTagsOrder: (state, action: PayloadAction<string[]>) => {
      const newOrder = action.payload
      state.tagsOrder = newOrder
      const prevCollapsed = state.collapsedTags || {}
      const updatedCollapsed: Record<string, boolean> = { ...prevCollapsed }
      newOrder.forEach((tag) => {
        if (!(tag in updatedCollapsed)) {
          updatedCollapsed[tag] = false
        }
      })
      state.collapsedTags = updatedCollapsed
    },
    updateTagCollapse: (state, action: PayloadAction<string>) => {
      const tag = action.payload
      const prev = state.collapsedTags || {}
      state.collapsedTags = {
        ...prev,
        [tag]: !prev[tag]
      }
    },
    setTopicTagFilter: (state, action: PayloadAction<{ selectedTags: string[]; assistantId: string }>) => {
      state.topicTagFilter = {
        selectedTags: action.payload.selectedTags,
        assistantId: action.payload.assistantId
      }
    },
    toggleTopicTagFilter: (state, action: PayloadAction<{ tag: string; assistantId: string }>) => {
      const { tag, assistantId } = action.payload
      const currentFilter = state.topicTagFilter

      // 如果currentFilter不存在或切换到不同的助手，重置筛选
      if (!currentFilter || currentFilter.assistantId !== assistantId) {
        state.topicTagFilter = {
          selectedTags: [tag],
          assistantId
        }
        return
      }

      // 切换标签选中状态
      const selectedTags = (currentFilter.selectedTags || []).includes(tag)
        ? (currentFilter.selectedTags || []).filter((t) => t !== tag)
        : [...(currentFilter.selectedTags || []), tag]

      state.topicTagFilter = {
        selectedTags,
        assistantId
      }
    },
    clearTopicTagFilter: (state) => {
      state.topicTagFilter = {
        selectedTags: [],
        assistantId: undefined
      }
    },
    addTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      const topic = action.payload.topic
      topic.createdAt = topic.createdAt || new Date().toISOString()
      topic.updatedAt = topic.updatedAt || new Date().toISOString()
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: uniqBy([topic, ...assistant.topics], 'id')
            }
          : assistant
      )
    },
    removeTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: assistant.topics.filter(({ id }) => id !== action.payload.topic.id)
            }
          : assistant
      )
    },
    updateTopic: (state, action: PayloadAction<{ assistantId: string; topic: Topic }>) => {
      const newTopic = action.payload.topic
      newTopic.updatedAt = new Date().toISOString()
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: assistant.topics.map((topic) => {
                const _topic = topic.id === newTopic.id ? newTopic : topic
                _topic.messages = []
                return _topic
              })
            }
          : assistant
      )
    },
    updateTopics: (state, action: PayloadAction<{ assistantId: string; topics: Topic[] }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              topics: action.payload.topics.map((topic) =>
                isEmpty(topic.messages) ? topic : { ...topic, messages: [] }
              )
            }
          : assistant
      )
    },
    removeAllTopics: (state, action: PayloadAction<{ assistantId: string }>) => {
      state.assistants = state.assistants.map((assistant) => {
        if (assistant.id === action.payload.assistantId) {
          assistant.topics.forEach((topic) => TopicManager.removeTopic(topic.id))
          return {
            ...assistant,
            topics: [getDefaultTopic(assistant.id)]
          }
        }
        return assistant
      })
    },
    updateTopicUpdatedAt: (state, action: PayloadAction<{ topicId: string }>) => {
      outer: for (const assistant of state.assistants) {
        for (const topic of assistant.topics) {
          if (topic.id === action.payload.topicId) {
            topic.updatedAt = new Date().toISOString()
            break outer
          }
        }
      }
    },
    // 标签分类管理
    addTagCategory: (state, action: PayloadAction<TagCategory>) => {
      // 确保 tagCategories 已初始化
      if (!state.tagCategories) {
        state.tagCategories = []
      }

      state.tagCategories.push(action.payload)
      state.tagCategories.sort((a, b) => a.order - b.order)
    },
    updateTagCategory: (state, action: PayloadAction<TagCategory>) => {
      // 确保 tagCategories 已初始化
      if (!state.tagCategories) {
        state.tagCategories = []
      }
      const index = state.tagCategories.findIndex((cat) => cat.id === action.payload.id)
      if (index !== -1) {
        state.tagCategories[index] = action.payload
        state.tagCategories.sort((a, b) => a.order - b.order)
      }
    },
    removeTagCategory: (state, action: PayloadAction<{ id: string }>) => {
      // 确保 tagCategories 已初始化
      if (!state.tagCategories) {
        state.tagCategories = []
      }
      state.tagCategories = state.tagCategories.filter((cat) => cat.id !== action.payload.id)
      // 移除分类时，将该分类下的标签设为未分类
      if (state.categorizedTags) {
        Object.values(state.categorizedTags).forEach((tag) => {
          if (tag.categoryId === action.payload.id) {
            tag.categoryId = undefined
          }
        })
      }
    },
    updateCategorizedTag: (state, action: PayloadAction<CategorizedTag>) => {
      // 确保 categorizedTags 已初始化
      if (!state.categorizedTags) {
        state.categorizedTags = {}
      }
      state.categorizedTags[action.payload.name] = action.payload
    },
    removeCategorizedTag: (state, action: PayloadAction<{ tagName: string }>) => {
      // 确保 categorizedTags 已初始化
      if (!state.categorizedTags) {
        state.categorizedTags = {}
      }
      delete state.categorizedTags[action.payload.tagName]
    },
    bulkUpdateCategorizedTags: (state, action: PayloadAction<{ tags: string[]; categoryId?: string }>) => {
      // 确保 categorizedTags 已初始化
      if (!state.categorizedTags) {
        state.categorizedTags = {}
      }
      action.payload.tags.forEach((tagName) => {
        if (state.categorizedTags[tagName]) {
          state.categorizedTags[tagName].categoryId = action.payload.categoryId
        } else {
          state.categorizedTags[tagName] = {
            name: tagName,
            categoryId: action.payload.categoryId,
            usage: 0
          }
        }
      })
    },
    setModel: (state, action: PayloadAction<{ assistantId: string; model: Model }>) => {
      state.assistants = state.assistants.map((assistant) =>
        assistant.id === action.payload.assistantId
          ? {
              ...assistant,
              model: action.payload.model
            }
          : assistant
      )
    }
  }
})

export const {
  updateDefaultAssistant,
  updateAssistants,
  addAssistant,
  insertAssistant,
  removeAssistant,
  updateAssistant,
  addTopic,
  removeTopic,
  updateTopic,
  updateTopics,
  removeAllTopics,
  updateTopicUpdatedAt,
  setModel,
  setTagsOrder,
  updateAssistantSettings,
  updateTagCollapse,
  setTopicTagFilter,
  toggleTopicTagFilter,
  clearTopicTagFilter,
  // 标签分类管理 actions
  addTagCategory,
  updateTagCategory,
  removeTagCategory,
  updateCategorizedTag,
  removeCategorizedTag,
  bulkUpdateCategorizedTags
} = assistantsSlice.actions

export const selectAllTopics = createSelector([(state: RootState) => state.assistants.assistants], (assistants) =>
  assistants.flatMap((assistant: Assistant) => assistant.topics)
)

export const selectTopicsMap = createSelector([selectAllTopics], (topics) => {
  return topics.reduce((map, topic) => {
    map.set(topic.id, topic)
    return map
  }, new Map())
})

export default assistantsSlice.reducer
