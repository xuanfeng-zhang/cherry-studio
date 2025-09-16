import { Modal, Input, Button, Tag, Tooltip, Empty, Form, Dropdown } from 'antd'
import {
  PlusOutlined,
  EditOutlined,
  DeleteOutlined,
  SearchOutlined
} from '@ant-design/icons'
import { useTranslation } from 'react-i18next'
import { useState, useCallback, useMemo } from 'react'
import styled from 'styled-components'

import { useTagCategories } from '@renderer/hooks/useTagCategories'
import { TagCategory } from '@renderer/types'

interface TagCategoryManagementPopupProps {
  open: boolean
  onClose: () => void
}

interface CategoryFormData {
  name: string
}


const TagCategoryManagementPopup: React.FC<TagCategoryManagementPopupProps> = ({
  open,
  onClose
}) => {
  const { t } = useTranslation()
  const {
    categoriesWithTags,
    createCategory,
    updateCategory,
    deleteCategory,
    moveTagsToCategory
  } = useTagCategories()

  const [searchQuery, setSearchQuery] = useState('')
  const [showCreateForm, setShowCreateForm] = useState(false)
  const [editingCategory, setEditingCategory] = useState<TagCategory | null>(null)
  const [selectedTags, setSelectedTags] = useState<string[]>([])
  const [form] = Form.useForm<CategoryFormData>()

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
      name: category.name
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
  const handleMoveTag = useCallback((tagName: string, _fromCategoryId: string, toCategoryId?: string) => {
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
      width={700}
      centered
      closable={false}
      maskClosable={true}
      styles={{
        content: {
          borderRadius: '16px',
          overflow: 'hidden',
          padding: '24px'
        },
        header: {
          borderBottom: '1px solid var(--color-border-tertiary)',
          paddingBottom: '16px',
          marginBottom: '0'
        }
      }}
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
            type="primary"
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


        {/* 标签分类列表 - 卡片式设计 */}
        <CategoriesSection>
          {filteredCategoriesWithTags.map(category => (
            <CategoryCard key={category.id}>
              <CategoryCardHeader>
                <CategoryCardTitle>
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
                              移入
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
                  <EmptyTagsContainer>
                    <EmptyMessage>{t('chat.topics.tags.no_tags_in_category')}</EmptyMessage>
                  </EmptyTagsContainer>
                )}
              </TagsGrid>
            </CategoryCard>
          ))}

          {filteredCategoriesWithTags.length === 0 && (
            <EmptyStateContainer>
              <Empty 
                description={searchQuery ? t('chat.topics.tags.no_matching_tags') : t('chat.topics.tags.no_categories')}
                image={Empty.PRESENTED_IMAGE_SIMPLE}
              />
            </EmptyStateContainer>
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


const Container = styled.div`
  display: flex;
  flex-direction: column;
  gap: 16px;
  max-height: 500px;
`

const ActionBar = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 16px;
  background: transparent;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
`

const FormSection = styled.div`
  padding: 20px;
  background: #2a2a2a;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
  margin: 12px 0;
  position: relative;
  z-index: 2;
`

const CategoriesSection = styled.div`
  flex: 1;
  overflow-y: auto;
  padding-right: 8px;

  /* 自定义滚动条样式 */
  &::-webkit-scrollbar {
    width: 6px;
  }

  &::-webkit-scrollbar-track {
    background: transparent;
  }

  &::-webkit-scrollbar-thumb {
    background: #4a4a4a;
    border-radius: 3px;
  }

  &::-webkit-scrollbar-thumb:hover {
    background: #5a5a5a;
  }
`


const CategoryName = styled.span`
  font-weight: 400;
`

const TagCount = styled.span`
  color: #999;
  font-size: 12px;
  background: #1a1a1a;
  padding: 2px 8px;
  border-radius: 12px;
  font-weight: 500;
  margin-left: 8px;
`

const CategoryActions = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
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
  font-size: 11px;
  padding: 4px 8px;
  border-radius: 6px;
  background: #1a1a1a !important;
  border: 1px solid #3a3a3a !important;
  color: #ccc !important;
  transition: all 0.2s;

  &:hover {
    background: #333 !important;
    border-color: #4a4a4a !important;
    color: #fff !important;
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

const EmptyTagsContainer = styled.div`
  padding: 16px;
  text-align: center;
  background: #1a1a1a;
  border-radius: 8px;
  border: 1px dashed #3a3a3a;
  width: 100%;
`

const EmptyStateContainer = styled.div`
  padding: 40px 20px;
  text-align: center;
  background: #2a2a2a;
  border-radius: 12px;
  border: 1px solid #3a3a3a;
`

const QuickAssignSection = styled.div`
  padding: 20px;
  background: #2a2a2a;
  border-radius: 12px;
  border: 1px solid #4a4a4a;
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
  background: #2a2a2a;
  border-radius: 12px;
  padding: 20px;
  margin-bottom: 20px;
  border: 1px solid #3a3a3a;
  transition: all 0.2s;
  position: relative;
  z-index: 1;

  &:hover {
    background: #323232;
    border-color: #4a4a4a;
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
  background: #333;
  border: 1px solid #4a4a4a;
  color: #999;
  font-size: 10px;
  cursor: pointer;
  padding: 2px 6px;
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  min-width: 20px;
  height: 18px;
  opacity: 0.7;
  transition: all 0.2s;
  margin-left: 4px;

  &:hover {
    background: #4a4a4a;
    color: #fff;
    opacity: 1;
    border-color: #5a5a5a;
  }

  &:active {
    transform: scale(0.95);
  }
`

export default TagCategoryManagementPopup