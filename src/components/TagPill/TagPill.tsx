import type { CSSProperties } from 'react'
import styles from './TagPill.module.css'
import type { Tag } from '../../types'
import { readableTextColor } from '../../utils/tags'

interface Props {
  tag: Tag
  // Picker usage: renders a toggle button; `selected` controls fill vs outline.
  onClick?: () => void
  selected?: boolean
}

export function TagPill({ tag, onClick, selected = true }: Props): JSX.Element {
  // Per-tag colours are data, not theme, so they arrive as CSS variables.
  const style = { '--tag-color': tag.color, '--tag-text': readableTextColor(tag.color) } as CSSProperties
  const className = selected ? styles.pill : `${styles.pill} ${styles.outline}`
  if (!onClick) return <span className={className} style={style}>{tag.name}</span>
  return (
    <button type="button" className={className} style={style} aria-pressed={selected} onClick={onClick}>
      {tag.name}
    </button>
  )
}
