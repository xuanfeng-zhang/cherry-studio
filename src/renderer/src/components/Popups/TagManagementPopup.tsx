import { PlusOutlined } from '@ant-design/icons'
import { Divider, Input, Modal, Tag } from 'antd'
import React from 'react'
import { useTranslation } from 'react-i18next'
import styled from 'styled-components'

import { Topic } from '../../types'

interface TagManagementPopupProps {
  topic: Topic
  availableTags: string[]
  onConfirm: (tags: string[]) => void
  onCancel: () => void
}

const TagManagementPopup: React.FC<TagManagementPopupProps> = ({ topic, availableTags, onConfirm, onCancel }) => {
  const { t } = useTranslation()
  const [selectedTags, setSelectedTags] = React.useState<string[]>(topic.tags || [])
  const [inputValue, setInputValue] = React.useState('')
  const [inputVisible, setInputVisible] = React.useState(false)
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
        title={t('chat.topics.tags.manage.title')}
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
            <SectionTitle>{t('chat.topics.tags.available_tags', { defaultValue: '可用标签' })}</SectionTitle>
            <TagContainer>
              {availableTags.length > 0 ? (
                availableTags.map((tag) => (
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
                ))
              ) : (
                <EmptyMessage>{t('chat.topics.tags.no_tags', { defaultValue: '暂无可用标签' })}</EmptyMessage>
              )}
            </TagContainer>
          </Section>
        </Container>
      </Modal>
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

const EmptyMessage = styled.div`
  color: var(--color-text-3);
  font-size: 12px;
  font-style: italic;
`

export default TagManagementPopup
