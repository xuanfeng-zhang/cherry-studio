import { Tag } from 'antd'
import { FC } from 'react'
import styled from 'styled-components'

interface TopicTagsProps {
  tags?: string[]
  style?: React.CSSProperties
  className?: string
}

const TopicTags: FC<TopicTagsProps> = ({ tags, style, className }) => {
  if (!tags || tags.length === 0) {
    return null
  }

  return (
    <TagsContainer style={style} className={className}>
      {tags.map((tag, index) => (
        <StyledTag key={index}>
          {tag}
        </StyledTag>
      ))}
    </TagsContainer>
  )
}

const TagsContainer = styled.div`
  display: inline-flex;
  gap: 6px;
  align-items: center;
`

const StyledTag = styled(Tag)`
  margin: 0;
  border-radius: 8px;
  font-size: 11px;
  padding: 1px 6px;
  line-height: 1.3;
  height: auto;
  background-color: var(--color-fill-quaternary);
  border-color: var(--color-border-secondary);
  color: var(--color-text-tertiary);
  border-width: 1px;
  
  &:hover {
    background-color: var(--color-fill-tertiary);
    border-color: var(--color-border);
    color: var(--color-text-secondary);
  }
`

export default TopicTags
