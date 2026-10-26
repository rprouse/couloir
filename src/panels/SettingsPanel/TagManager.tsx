import { useEffect, useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { deleteTag } from '../../features/tags/deleteTag'
import { countTagUsage, nextTagColor, validateTagInput } from '../../utils/tags'
import { TAG_PALETTE, type Tag } from '../../types'
import { debug } from '../../utils/debug'

export function TagManager(): JSX.Element {
  const tags = useTagsStore((s) => s.tags)
  const add = useTagsStore((s) => s.add)
  const routes = useRoutesStore((s) => s.routes)
  const tracks = useTracksStore((s) => s.tracks)
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const photos = usePhotosStore((s) => s.photos)
  const usage = countTagUsage([routes, tracks, waypoints, photos])

  const [name, setName] = useState('')
  const [color, setColor] = useState(() => nextTagColor(tags))
  const [error, setError] = useState<string | null>(null)

  const create = async () => {
    const problem = validateTagInput(name, color, tags)
    if (problem) {
      setError(problem)
      return
    }
    try {
      await add({ name: name.trim(), color })
      setName('')
      // The store's tag list grows by one; offer the next palette colour.
      setColor(TAG_PALETTE[(tags.length + 1) % TAG_PALETTE.length])
      setError(null)
    } catch (err) {
      debug('tag create failed', err)
      setError('Creating the tag failed.')
    }
  }

  const sorted = [...tags].sort((a, b) => a.name.localeCompare(b.name))

  return (
    <div className={styles.column}>
      {sorted.length === 0 ? (
        <p className={styles.subtle}>No tags yet.</p>
      ) : (
        <ul className={styles.tagList}>
          {sorted.map((tag) => (
            <TagRow key={tag.id} tag={tag} uses={usage.get(tag.id) ?? 0} allTags={tags} />
          ))}
        </ul>
      )}
      <div className={styles.row}>
        <input
          type="color"
          aria-label="New tag colour"
          value={color}
          onChange={(e) => setColor(e.target.value.toUpperCase())}
        />
        <input
          type="text"
          aria-label="New tag name"
          placeholder="New tag"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onKeyDown={(e) => { if (e.key === 'Enter') void create() }}
        />
        <button type="button" onClick={() => void create()}>Create tag</button>
      </div>
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </div>
  )
}

function TagRow({ tag, uses, allTags }: { tag: Tag; uses: number; allTags: Tag[] }): JSX.Element {
  const update = useTagsStore((s) => s.update)
  const [name, setName] = useState(tag.name)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => setName(tag.name), [tag.name])

  const save = async (patch: { name?: string; color?: string }) => {
    const next = { name: patch.name ?? tag.name, color: patch.color ?? tag.color }
    const problem = validateTagInput(next.name, next.color, allTags, tag.id)
    if (problem) {
      setError(problem)
      setName(tag.name)
      return
    }
    try {
      await update(tag.id, { name: next.name.trim(), color: next.color })
      setError(null)
    } catch (err) {
      debug('tag update failed', err)
      setError('Saving the tag failed.')
    }
  }

  const remove = async () => {
    try {
      await deleteTag(tag.id)
    } catch (err) {
      debug('tag delete failed', err)
      setError('Deleting the tag failed.')
      setConfirming(false)
    }
  }

  return (
    <li className={styles.tagRow}>
      <div className={styles.row}>
        <input
          type="color"
          aria-label={`Colour for ${tag.name}`}
          value={tag.color}
          onChange={(e) => void save({ color: e.target.value.toUpperCase() })}
        />
        <input
          type="text"
          aria-label={`Name for ${tag.name}`}
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => { if (name !== tag.name) void save({ name }) }}
          onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
        />
        <span className={styles.subtle}>{uses === 1 ? '1 use' : `${uses} uses`}</span>
        {!confirming && (
          <button
            type="button"
            aria-label={`Delete ${tag.name}`}
            onClick={() => (uses > 0 ? setConfirming(true) : void remove())}
          >
            Delete
          </button>
        )}
      </div>
      {confirming && (
        <div className={styles.row}>
          <span className={styles.subtle}>{`Tag '${tag.name}' is used by ${uses} entities. Delete?`}</span>
          <button type="button" onClick={() => void remove()}>Confirm delete</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      )}
      {error && <p role="alert" className={styles.error}>{error}</p>}
    </li>
  )
}
