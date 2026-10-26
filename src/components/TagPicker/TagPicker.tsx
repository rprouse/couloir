import { useState } from 'react'
import styles from './TagPicker.module.css'
import { useTagsStore } from '../../store/tags'
import { TagPill } from '../TagPill/TagPill'
import { nextTagColor, validateTagInput } from '../../utils/tags'
import { debug } from '../../utils/debug'

interface Props {
  value: string[]
  onChange: (tagIds: string[]) => void
}

// Toggle existing tags, or type a name to create one. A name that matches an
// existing tag (case-insensitively) selects that tag instead of duplicating it.
export function TagPicker({ value, onChange }: Props): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const addTag = useTagsStore((s) => s.add)
  const [name, setName] = useState('')
  const [error, setError] = useState<string | null>(null)

  const selected = new Set(value)
  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  const toggle = (id: string) =>
    onChange(selected.has(id) ? value.filter((v) => v !== id) : [...value, id])

  const create = async () => {
    const trimmed = name.trim()
    if (trimmed === '') return
    const match = tags.find((t) => t.name.trim().toLowerCase() === trimmed.toLowerCase())
    if (match) {
      if (!selected.has(match.id)) onChange([...value, match.id])
      setName('')
      return
    }
    const color = nextTagColor(tags)
    const problem = validateTagInput(trimmed, color, tags)
    if (problem) {
      setError(problem)
      return
    }
    try {
      const tag = await addTag({ name: trimmed, color })
      onChange([...value, tag.id])
      setName('')
      setError(null)
    } catch (err) {
      debug('tag create failed', err)
      setError('Creating the tag failed.')
    }
  }

  return (
    <div className={styles.picker}>
      {sorted.length > 0 && (
        <div className={styles.pills}>
          {sorted.map((tag) => (
            <TagPill key={tag.id} tag={tag} selected={selected.has(tag.id)} onClick={() => toggle(tag.id)} />
          ))}
        </div>
      )}
      <div className={styles.add}>
        <input
          placeholder="New tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault()
              void create()
            }
          }}
        />
        <button type="button" onClick={() => void create()} aria-label="Add tag">Add</button>
      </div>
      {error && <span role="alert" className={styles.error}>{error}</span>}
    </div>
  )
}
