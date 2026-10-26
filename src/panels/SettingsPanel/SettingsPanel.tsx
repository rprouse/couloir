import { useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useSettingsStore } from '../../store/settings'
import { useUiStore } from '../../store/ui'
import { APP_VERSION } from '../../types'
import { TagManager } from './TagManager'

const MAPTILER_KEYS_URL = 'https://cloud.maptiler.com/account/keys/'

export function SettingsPanel() {
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const setTerrainExaggeration = useUiStore((s) => s.setTerrainExaggeration)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(false)

  // Edit mode is true whenever the user has explicitly entered it OR no key
  // is set yet. Deriving (rather than mirroring) keeps the panel in sync if
  // the key is cleared by another part of the app.
  const isEditing = editing || maptilerKey === null

  const save = () => {
    const trimmed = draft.trim()
    if (trimmed.length === 0) return
    setMaptilerKey(trimmed)
    setDraft('')
    setEditing(false)
  }

  const startEdit = () => {
    setDraft('')
    setEditing(true)
  }

  const cancelEdit = () => {
    setDraft('')
    setEditing(false)
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Settings</h2>

      <section className={styles.section}>
        <h3>Maptiler</h3>
        {!isEditing && maptilerKey !== null ? (
          <>
            <div className={styles.row}>
              <span className={styles.subtle}>Key set ({maptilerKey.slice(0, 4)}…)</span>
              <button type="button" onClick={startEdit}>Replace</button>
            </div>
            <a
              className={styles.subtle}
              href={MAPTILER_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Manage keys at maptiler.com →
            </a>
          </>
        ) : (
          <div className={styles.column}>
            <label className={styles.field}>
              <span>Maptiler API key</span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                // Strip whitespace at input time so a paste from a
                // line-wrapped terminal can't slip embedded newlines into
                // the stored key.
                onChange={(e) => setDraft(e.target.value.replace(/\s/g, ''))}
              />
            </label>
            <div className={styles.row}>
              <button type="button" onClick={save}>Save key</button>
              {maptilerKey !== null && (
                <button type="button" onClick={cancelEdit}>Cancel</button>
              )}
            </div>
            <a
              className={styles.subtle}
              href={MAPTILER_KEYS_URL}
              target="_blank"
              rel="noopener noreferrer"
            >
              Get a free Maptiler key →
            </a>
          </div>
        )}
      </section>

      <section className={styles.section}>
        <h3>Map defaults</h3>
        <label className={styles.field}>
          <span>Terrain exaggeration</span>
          <input
            type="range"
            aria-label="Terrain exaggeration"
            min={1}
            max={3}
            step={0.1}
            value={terrainExaggeration}
            onChange={(e) => setTerrainExaggeration(Number(e.target.value))}
          />
          <span className={styles.subtle}>{terrainExaggeration.toFixed(1)}×</span>
        </label>
      </section>

      <section className={styles.section}>
        <h3>Tags</h3>
        <TagManager />
      </section>

      <section className={styles.section}>
        <h3>About</h3>
        <p className={styles.subtle}>Couloir {APP_VERSION}</p>
      </section>
    </div>
  )
}
