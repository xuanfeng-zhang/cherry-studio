import { Modal, Input, Button, Tag, Collapse, Tooltip, Empty, ColorPicker, Form, Dropdown } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  DragOutlined,
  FolderOutlined,
  SearchOutlined,
  ArrowRightOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useState, useCallback, useMemo } from 'react'
import styled from 'styled-components'
import { DndContext, closestCenter, KeyboardSensor, PointerSensor, useSensor, useSensors } from '@dnd-kit/core'
import { SortableContext, sortableKeyboardCoordinates, verticalListSortingStrategy } from '@dnd-kit/sortable'
import { useSortable } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'

import { useTagCategories } from '@renderer/hooks/useTagCategories'
import { TagCategory } from '@renderer/types'

interface TagCategoryManagementPopupProps {
  open: boolean
  onClose: () => void
}

interface CategoryFormData {
  name: string
  color?: string
  icon?: string
  description?: string
}

const SortableCategory: React.FC<{
  category: any
  onEdit: (category: any) => void
  onDelete: (categoryId: string) => void
  onMoveTag: (tagName: string, fromCategoryId: string, toCategoryId?: string) => void
  allCategories: any[]
}> = ({ category, onEdit, onDelete, onMoveTag, allCategories }) => {
  const { t } = useTranslation()
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
  } = useSortable({ id: category.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  const isUncategorized = category.id === 'uncategorized'

  return (
    <div ref={!isUncategorized ? setNodeRef : undefined} style={!isUncategorized ? style : undefined}>
      <StyledCollapsePanel
        key={category.id}
        header={
          <CategoryHeader>
            <CategoryInfo>
              {!isUncategorized && (
                <DragHandle {...attributes} {...listeners}>
                  <DragOutlined />
                </DragHandle>
              )}
              <FolderOutlined style={{ color: category.color || 'var(--color-text-2)' }} />
              <CategoryName>{category.name}</CategoryName>
              <TagCount>({category.tags.length})</TagCount>
            </CategoryInfo>
            {!isUncategorized && (
              <CategoryActions>
                <Tooltip title={t('common.edit')}>
                  <Button
                    type="text"
                    size="small"
                    icon={<EditOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      onEdit(category)
                    }}
                  />
                </Tooltip>
                <Tooltip title={t('common.delete')}>
                  <Button
                    type="text"
                    size="small"
                    danger
                    icon={<DeleteOutlined />}
                    onClick={(e) => {
                      e.stopPropagation()
                      onDelete(category.id)
                    }}
                  />
                </Tooltip>
              </CategoryActions>
            )}
          </CategoryHeader>
        }
      >
        <TagsList>
          {category.tags.map((tag: any) => {
            // 为未分类标签生成可移动到的分类菜单
            const moveToMenuItems = isUncategorized
              ? allCategories
                  .filter(cat => cat.id !== 'uncategorized')
                  .map(cat => ({
                    key: cat.id,
                    label: cat.name,
                    icon: <FolderOutlined style={{ color: cat.color || 'var(--color-text-2)' }} />,
                    onClick: () => onMoveTag(tag.name, category.id, cat.id)
                  }))
              : []

            return (
              <TagItem key={tag.name}>
                <StyledTag color={tag.color}>
                  {tag.name}
                  <TagUsage>({tag.usage})</TagUsage>
                </StyledTag>
                {!isUncategorized ? (
                  <Tooltip title={t('chat.topics.tags.move_to_uncategorized')}>
                    <Button
                      type="text"
                      size="small"
                      onClick={() => onMoveTag(tag.name, category.id, undefined)}
                    >
                      移出
                    </Button>
                  </Tooltip>
                ) : isUncategorized ? (
                  moveToMenuItems.length > 0 ? (
                    <Dropdown
                      menu={{ items: moveToMenuItems }}
                      placement="bottomRight"
                      trigger={['click']}
                    >
                      <Tooltip title={t('chat.topics.tags.move_to_category')}>
                        <Button
                          type="text"
                          size="small"
                          icon={<ArrowRightOutlined />}
                        >
                          移入
                        </Button>
                      </Tooltip>
                    </Dropdown>
                  ) : (
                    <span style={{ fontSize: '12px', color: 'var(--color-text-3)' }}>
                      无可用分类
                    </span>
                  )
                ) : null}
              </TagItem>
            )
          })}
          {category.tags.length === 0 && (
            <EmptyMessage>{t('chat.topics.tags.no_tags_in_category')}</EmptyMessage>
          )}
        </TagsList>
      </StyledCollapsePanel>
    </div>
  )
}

const TagCategoryManagementPopup: React.FC<TagCategoryManagementPopupProps> = ({
  open,
  onClose
}) => {
  const { t } = useTranslation()
  const {
    categoriesWithTags,
    allUniqueTags,
    tagUsageStats,
    createCategory,
    updateCategory,
    deleteCategory,
    moveTagsToCategory
  } = useTagCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [activeKeys, setActiveKeys] = useState<string | string[]>(['uncategorized'])
  const [form] = Form.useForm<CategoryFormData>()

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  )

  // 过滤后的分类和标签
  const filteredCategoriesWithTags = useMemo(() => {
    if (!searchQuery) return categoriesWithTags

    return categoriesWithTags.map(category => ({
      ...category,
      tags: category.tags.filter(tag =>
        tag.name.toLowerCase().includes(searchQuery.toLowerCase())
      )
    })).filter(category => category.tags.length > 0)
  }, [categoriesWithTags, searchQuery])

  // 处理拖拽结束
  const handleDragEnd = useCallback((event: any) => {
    const { active, over } = event

    if (active.id !== over.id) {
      // TODO: 实现分类排序
    }
  }, [])

  // 创建分类
  const handleCreateCategory = useCallback(async () => {
    try {
      const values = await form.validateFields()
      
      // 检查必填字段
      if (!values.name || !values.name.trim()) {
        window.message?.error?.('分类名称不能为空') || alert('分类名称不能为空')
        return
      }
      
      // 安全地计算最大order值
      const orders = categoriesWithTags.map(cat => cat.order).filter(order => typeof order === 'number')
      const maxOrder = orders.length > 0 ? Math.max(...orders) : 0

      createCategory({
        ...values,
        order: maxOrder + 1
      })

      form.resetFields()
      setShowCreateForm(false)
    } catch (error) {
      console.error('Form validation failed:', error)
      // 显示错误信息给用户
      if (error instanceof Error) {
        window.message?.error?.(error.message) || alert(error.message)
      }
    }
  }, [form, categoriesWithTags, createCategory])

  // 编辑分类
  const handleEditCategory = useCallback((category: TagCategory) => {
    setEditingCategory(category)
    form.setFieldsValue({
      name: category.name,
      color: category.color,
      icon: category.icon,
      description: category.description
    })
    setShowCreateForm(true)
  }, [form])

  // 更新分类
  const handleUpdateCategory = useCallback(async () => {
    if (!editingCategory) return

    try {
      const values = await form.validateFields()
      
      updateCategory({
        ...editingCategory,
        ...values
      })

      form.resetFields()
      setEditingCategory(null)
      setShowCreateForm(false)
    } catch (error) {
      console.error('Form validation failed:', error)
      // 显示错误信息给用户
      if (error instanceof Error) {
        window.message?.error?.(error.message) || alert(error.message)
      }
    }
  }, [form, editingCategory, updateCategory])

  // 删除分类
  const handleDeleteCategory = useCallback((categoryId: string) => {
    Modal.confirm({
      title: t('chat.topics.tags.confirm_delete_category'),
      content: t('chat.topics.tags.delete_category_warning'),
      onOk: () => deleteCategory(categoryId)
    })
  }, [deleteCategory, t])

  // 移动标签
  const handleMoveTag = useCallback((tagName: string, fromCategoryId: string, toCategoryId?: string) => {
    moveTagsToCategory([tagName], toCategoryId)
  }, [moveTagsToCategory])

  // 批量分配标签到分类
  const handleAssignToCategory = useCallback((categoryId: string) => {
    if (selectedTags.length === 0) return

    moveTagsToCategory(selectedTags, categoryId)
    setSelectedTags([])
  }, [selectedTags, moveTagsToCategory])

  const handleCancel = useCallback(() => {
    form.resetFields()
    setEditingCategory(null)
    setShowCreateForm(false)
    setSelectedTags([])
    setSearchQuery('')
  }, [form])

  const handleClose = useCallback(() => {
    handleCancel()
    onClose()
  }, [handleCancel, onClose])

  return (
    <Modal
      title={t('chat.topics.tags.category_management')}
      open={open}
      onCancel={handleClose}
      footer={null}
      width={800}
      centered
      closable={false}
      maskClosable={true}
    >
      <Container>
        {/* 搜索和操作栏 */}
        <ActionBar>
          <Input
            placeholder={t('chat.topics.tags.search_tags')}
            prefix={<SearchOutlined />}
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{ flex: 1, marginRight: 12 }}
          />
          <Button
            type="default"
            size="small"
            icon={<PlusOutlined />}
            onClick={() => setShowCreateForm(true)}
          >
            {t('chat.topics.tags.create_category')}
          </Button>
        </ActionBar>

        {/* 创建/编辑分类表单 */}
        {showCreateForm && (
          <FormSection>
            <Form form={form} layout="vertical" onFinish={editingCategory ? handleUpdateCategory : handleCreateCategory}>
              <Form.Item
                name="name"
                label={t('chat.topics.tags.category_name')}
                rules={[{ required: true, message: t('chat.topics.tags.category_name_required') }]}
              >
                <Input placeholder={t('chat.topics.tags.enter_category_name')} />
              </Form.Item>
              <Form.Item name="color" label={t('chat.topics.tags.category_color')}>
                <ColorPicker />
              </Form.Item>
              <Form.Item name="description" label={t('chat.topics.tags.category_description')}>
                <Input.TextArea placeholder={t('chat.topics.tags.enter_category_description')} />
              </Form.Item>
              <Form.Item>
                <Button
                  type="primary"
                  htmlType="submit"
                  style={{ marginRight: 8 }}
                >
                  {editingCategory ? t('common.update') : t('common.create')}
                </Button>
                <Button onClick={handleCancel}>
                  {t('common.cancel')}
                </Button>
              </Form.Item>
            </Form>
          </FormSection>
        )}


        {/* 标签分类列表 - 扁平化设计 */}
        <CategoriesSection>
          {filteredCategoriesWithTags.map(category => (
            <CategoryCard key={category.id}>
              <CategoryCardHeader>
                <CategoryCardTitle>
                  <FolderOutlined style={{ color: category.color || 'var(--color-text-2)' }} />
                  <CategoryName>{category.name}</CategoryName>
                  <TagCount>({category.tags.length})</TagCount>
                </CategoryCardTitle>
                {category.id !== 'uncategorized' && (
                  <CategoryActions>
                    <Tooltip title={t('common.edit')}>
                      <Button
                        type="text"
                        size="small"
                        icon={<EditOutlined />}
                        onClick={() => handleEditCategory(category)}
                      />
                    </Tooltip>
                    <Tooltip title={t('common.delete')}>
                      <Button
                        type="text"
                        size="small"
                        danger
                        icon={<DeleteOutlined />}
                        onClick={() => handleDeleteCategory(category.id)}
                      />
                    </Tooltip>
                  </CategoryActions>
                )}
              </CategoryCardHeader>

              <TagsGrid>
                {category.tags.map((tag: any) => {
                  const moveToMenuItems = category.id === 'uncategorized'
                    ? filteredCategoriesWithTags
                        .filter(cat => cat.id !== 'uncategorized')
                        .map(cat => ({
                          key: cat.id,
                          label: cat.name,
                          icon: <FolderOutlined style={{ color: cat.color || 'var(--color-text-2)' }} />,
                          onClick: () => handleMoveTag(tag.name, category.id, cat.id)
                        }))
                    : []

                  return (
                    <TagItem key={tag.name}>
                      <StyledTag color={tag.color}>
                        {tag.name}
                        <TagUsage>({tag.usage})</TagUsage>
                      </StyledTag>
                      {category.id === 'uncategorized' && moveToMenuItems.length > 0 && (
                        <Dropdown
                          menu={{ items: moveToMenuItems }}
                          placement="bottomRight"
                          trigger={['click']}
                        >
                          <Tooltip title={t('chat.topics.tags.move_to_category')}>
                            <MoveButton>
                              <ArrowRightOutlined style={{ fontSize: '10px' }} />
                            </MoveButton>
                          </Tooltip>
                        </Dropdown>
                      )}
                      {category.id !== 'uncategorized' && (
                        <Tooltip title={t('chat.topics.tags.move_to_uncategorized')}>
                          <MoveButton onClick={() => handleMoveTag(tag.name, category.id, undefined)}>
                            ×
                          </MoveButton>
                        </Tooltip>
                      )}
                    </TagItem>
                  )
                })}
                {category.tags.length === 0 && (
                  <EmptyMessage>{t('chat.topics.tags.no_tags_in_category')}</EmptyMessage>
                )}
              </TagsGrid>
            </CategoryCard>
          ))}

          {filteredCategoriesWithTags.length === 0 && (
            <Empty description={searchQuery ? t('chat.topics.tags.no_matching_tags') : t('chat.topics.tags.no_categories')} />
          )}
        </CategoriesSection>

        {/* 快速分配区域 */}
        {selectedTags.length > 0 && (
          <QuickAssignSection>
            <QuickAssignTitle>
              {t('chat.topics.tags.assign_selected_tags')} ({selectedTags.length})
            </QuickAssignTitle>
            <QuickAssignActions>
              {categoriesWithTags
                .filter(cat => cat.id !== 'uncategorized')
                .map(category => (
                  <Button
                    key={category.id}
                    size="small"
                    onClick={() => handleAssignToCategory(category.id)}
                  >
                    {category.name}
                  </Button>
                ))}
            </QuickAssignActions>
          </QuickAssignSection>
        )}
      </Container>
    </Modal>
  )
}

const StyledModal = styled(Modal)`
  .ant-modal-close,
  .ant-modal-close-x,
  .ant-modal-header .ant-modal-close,
  button.ant-modal-close {
    display: none !important;
    visibility: hidden !important;
    opacity: 0 !important;
    pointer-events: none !important;
  }
`

const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 12px;
  max-height: 600px;
`

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const FormSection = styled.div`
  padding: 16px;
  background: var(--color-fill-quaternary);
  border-radius: 8px;
`

const CategoriesSection = styled.div`
  flex: 1;
  overflow-y: auto;
`

const StyledCollapsePanel = styled(Collapse.Panel)`
  .ant-collapse-header {
    padding: 8px 16px !important;
  }
`

const StyledCollapse = styled(Collapse)`
  border: none;
  background: transparent;

  .ant-collapse-item {
    border: none;
  }

  .ant-collapse-header {
    padding: 6px 4px 6px 0 !important;
    border-radius: 4px;
    align-items: center !important;
    opacity: 0.9;

    &:hover {
      background-color: var(--color-fill-quaternary);
      opacity: 1;
    }

    .ant-collapse-arrow {
      font-size: 10px !important;
      color: var(--color-text-4) !important;
      opacity: 0.6;
      transition: all 0.2s;
      width: 12px !important;
      height: 12px !important;
      line-height: 12px !important;
      margin-right: 3px !important;
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
  justify-content: space-between;
  width: 100%;
`

const CategoryInfo = styled.div`
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  opacity: 0.9;
`

const DragHandle = styled.div`
  cursor: grab;
  color: var(--color-text-3);

  &:active {
    cursor: grabbing;
  }
`

const CategoryName = styled.span`
  font-weight: 400;
`

const TagCount = styled.span`
  color: var(--color-text-4);
  font-size: 11px;
`

const CategoryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
`

const TagsList = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  padding: 8px 4px 8px 2px;
`

const TagItem = styled.div`
  display: flex;
  align-items: center;
  gap: 3px;
  position: relative;

  &:hover .move-button {
    opacity: 1;
  }
`

const StyledTag = styled(Tag)`
  margin: 0;
  display: flex;
  align-items: center;
  gap: 3px;
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 10px;
  opacity: 0.85;
  transition: opacity 0.2s;

  &:hover {
    opacity: 1;
  }
`

const TagUsage = styled.span`
  font-size: 9px;
  opacity: 0.6;
`

const EmptyMessage = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  font-style: italic;
`

const QuickAssignSection = styled.div`
  padding: 16px;
  background: var(--color-fill-quaternary);
  border-radius: 8px;
`

const QuickAssignTitle = styled.div`
  font-weight: 500;
  margin-bottom: 8px;
`

const QuickAssignActions = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
`

const CategoryCard = styled.div`
  background: var(--color-fill-quaternary);
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 12px;
  border: 1px solid var(--color-border-tertiary);
  transition: all 0.2s;

  &:hover {
    background: var(--color-fill-tertiary);
    border-color: var(--color-border-secondary);
  }
`

const CategoryCardHeader = styled.div`
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 12px;
`

const CategoryCardTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  font-weight: 500;
  color: var(--color-text-1);
`

const TagsGrid = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 20px;
  align-items: flex-start;
`

const MoveButton = styled.button`
  background: none;
  border: none;
  color: var(--color-text-4);
  font-size: 12px;
  cursor: pointer;
  padding: 1px 3px;
  border-radius: 2px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 14px;
  height: 14px;
  opacity: 0.4;
  transition: all 0.15s;
  margin-left: 1px;

  &:hover {
    background-color: var(--color-fill-quaternary);
    color: var(--color-text-2);
    opacity: 1;
    transform: scale(1.2);
  }

  &:active {
    transform: scale(0.9);
  }
`

export default TagCategoryManagementPopup