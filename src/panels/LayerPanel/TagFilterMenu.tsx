import type { CSSProperties } from 'react'
import styles from './TagFilterMenu.module.css'
import { useTagsStore } from '../../store/tags'
import { useUiStore, type LayerKey } from '../../store/ui'

interface Props {
  layer: LayerKey
  label: string
}

// Per-layer tag filter: a checkbox per tag (OR semantics) and a clear button.
export function TagFilterMenu({ layer, label }: Props): JSX.Element | null {
  const tags = useTagsStore((s) => s.tags)
  const selected = useUiStore((s) => s.tagFilters[layer])
  const setTagFilter = useUiStore((s) => s.setTagFilter)
  const clearTagFilter = useUiStore((s) => s.clearTagFilter)

  if (tags.length === 0) return null
  const active = selected.length > 0
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) =>
    setTagFilter(layer, selected.includes(id) ? selected.filter((t) => t !== id) : [...selected, id])

  return (
    <details className={active ? `${styles.menu} ${styles.active}` : styles.menu}>
      <summary aria-label={`Filter ${label} by tag`}>{active ? `Filter (${selected.length})` : 'Filter'}</summary>
      <div className={styles.popover}>
        {sorted.map((tag) => (
          <label key={tag.id} className={styles.option}>
            <input type="checkbox" checked={selected.includes(tag.id)} onChange={() => toggle(tag.id)} />
            <span className={styles.dot} style={{ '--tag-color': tag.color } as CSSProperties} aria-hidden="true" />
            {tag.name}
          </label>
        ))}
        <button type="button" onClick={() => clearTagFilter(layer)} disabled={!active}>
          Clear filter
        </button>
      </div>
    </details>
  )
}
