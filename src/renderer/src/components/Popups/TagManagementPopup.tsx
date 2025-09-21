import { FolderOutlined, PlusOutlined, SettingOutlined } from '@ant-design/icons'
import { useTagCategories } from '@renderer/hooks/useTagCategories'
import { Button, Collapse, Divider, Input, Modal, Tag, Tooltip } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Topic } from '../../types'
import TagCategoryManagementPopup from './TagCategoryManagementPopup'

interface TagManagementPopupProps {
  topic: Topic
  availableTags: string[]
  onConfirm: (tags: string[]) => void
  onCancel: () => void
}

const TagManagementPopup: React.FC<TagManagementPopupProps> = ({ topic, availableTags, onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const { categoriesWithTags } = useTagCategories()
  const [selectedTags, setSelectedTags] = React.useState<string[]>(topic.tags || [])
  const [inputValue, setInputValue] = React.useState('')
  const [inputVisible, setInputVisible] = React.useState(false)
  const [showCategoryManagement, setShowCategoryManagement] = React.useState(false)
  const inputRef = React.useRef<any>(null)

  React.useEffect(() => {
    if (inputVisible) {
      inputRef.current?.focus()
    }
  }, [inputVisible])

  const handleClose = (removedTag: string) => {
    const newTags = selectedTags.filter((tag) => tag !== removedTag)
    setSelectedTags(newTags)
  }

  const showInput = () => {
    setInputVisible(true)
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setInputValue(e.target.value)
  }

  const handleInputConfirm = () => {
    if (inputValue && !selectedTags.includes(inputValue)) {
      setSelectedTags([...selectedTags, inputValue])
    }
    setInputVisible(false)
    setInputValue('')
  }

  const handleTagClick = (tag: string) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag))
    } else {
      setSelectedTags([...selectedTags, tag])
    }
  }

  const onOk = () => {
    onConfirm(selectedTags)
  }

  return (
    <>
      <Modal
        title={
          <ModalTitle>
            {t('chat.topics.tags.manage.title')}
            <Tooltip title={t('chat.topics.tags.manage_categories')}>
              <Button
                type="text"
                size="small"
                icon={<SettingOutlined />}
                onClick={() => setShowCategoryManagement(true)}
              />
            </Tooltip>
          </ModalTitle>
        }
        open={true}
        onOk={onOk}
        onCancel={onCancel}
        width={700}
        centered>
        <Container>
          <Section>
            <SectionTitle>{t('chat.topics.tags.selected')}</SectionTitle>
            <TagContainer>
              {selectedTags.map((tag) => (
                <Tag key={tag} closable onClose={() => handleClose(tag)} color="blue">
                  {tag}
                </Tag>
              ))}
              {inputVisible ? (
                <Input
                  ref={inputRef}
                  type="text"
                  size="small"
                  style={{ width: 78 }}
                  value={inputValue}
                  onChange={handleInputChange}
                  onBlur={handleInputConfirm}
                  onPressEnter={handleInputConfirm}
                />
              ) : (
                <Tag onClick={showInput} style={{ borderStyle: 'dashed' }}>
                  <PlusOutlined /> {t('chat.topics.tags.add')}
                </Tag>
              )}
            </TagContainer>
          </Section>

          <Divider />

          <Section>
            <SectionTitle>{t('chat.topics.tags.available_by_category')}</SectionTitle>
            <CategorizedTagsContainer>
              {categoriesWithTags.length > 0 ? (
                <Collapse size="small" ghost>
                  {categoriesWithTags.map((category) => (
                    <Collapse.Panel
                      key={category.id}
                      header={
                        <CategoryHeader>
                          <FolderOutlined style={{ color: category.color || 'var(--color-text-2)' }} />
                          <span>{category.name}</span>
                          <span style={{ color: 'var(--color-text-3)', fontSize: '12px' }}>
                            ({category.tags.length})
                          </span>
                        </CategoryHeader>
                      }>
                      <TagContainer>
                        {category.tags.map((tag) => (
                          <Tag
                            key={tag.name}
                            onClick={() => handleTagClick(tag.name)}
                            style={{
                              cursor: 'pointer',
                              backgroundColor: selectedTags.includes(tag.name) ? 'var(--color-primary)' : undefined,
                              color: selectedTags.includes(tag.name) ? 'white' : undefined
                            }}>
                            {tag.name}
                            <span style={{ opacity: 0.7, marginLeft: 4, fontSize: '10px' }}>({tag.usage})</span>
                          </Tag>
                        ))}
                        {category.tags.length === 0 && (
                          <EmptyMessage>{t('chat.topics.tags.no_tags_in_category')}</EmptyMessage>
                        )}
                      </TagContainer>
                    </Collapse.Panel>
                  ))}
                </Collapse>
              ) : (
                <TagContainer>
                  {availableTags.map((tag) => (
                    <Tag
                      key={tag}
                      onClick={() => handleTagClick(tag)}
                      style={{
                        cursor: 'pointer',
                        backgroundColor: selectedTags.includes(tag) ? 'var(--color-primary)' : undefined,
                        color: selectedTags.includes(tag) ? 'white' : undefined
                      }}>
                      {tag}
                    </Tag>
                  ))}
                </TagContainer>
              )}
            </CategorizedTagsContainer>
          </Section>
        </Container>
      </Modal>

      <TagCategoryManagementPopup open={showCategoryManagement} onClose={() => setShowCategoryManagement(false)} />
    </>
  )
}

const Container = styled.div`
  padding: 8px 0;
`

const Section = styled.div`
  margin-bottom: 16px;
`

const SectionTitle = styled.div`
  font-size: 14px;
  font-weight: 500;
  margin-bottom: 8px;
  color: var(--color-text-1);
`

const TagContainer = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 32px;
  align-items: flex-start;
`

const ModalTitle = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const CategorizedTagsContainer = styled.div`
  max-height: 300px;
  overflow-y: auto;
`

const CategoryHeader = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
`

const EmptyMessage = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  font-style: italic;
`

export default TagManagementPopup
