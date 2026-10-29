import { useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useSettingsStore } from '../../store/settings'
import { OVERLAY_OPACITY_MAX, OVERLAY_OPACITY_MIN, useUiStore } from '../../store/ui'
import { APP_VERSION } from '../../types'
import { TagManager } from './TagManager'
import { BackupSection } from './BackupSection'

const MAPTILER_KEYS_URL = 'https://cloud.maptiler.com/account/keys/'

export function SettingsPanel() {
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const maptilerKeySource = useSettingsStore((s) => s.maptilerKeySource)
  const hasServerKey = useSettingsStore((s) => s.serverMaptilerKey !== null)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const setTerrainExaggeration = useUiStore((s) => s.setTerrainExaggeration)
  const overlayOpacity = useUiStore((s) => s.overlayOpacity)
  const setOverlayOpacity = useUiStore((s) => s.setOverlayOpacity)

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
              <span className={styles.subtle}>
                {maptilerKeySource === 'server' ? 'Key from server' : 'Key set'} ({maptilerKey.slice(0, 4)}…)
              </span>
              <button type="button" onClick={startEdit}>Replace</button>
              {maptilerKeySource === 'local' && hasServerKey && (
                // Clearing this browser's key falls back to the server's.
                <button type="button" onClick={() => setMaptilerKey(null)}>Use server key</button>
              )}
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
        <label className={styles.field}>
          <span>Slope and aspect overlay opacity</span>
          <input
            type="range"
            aria-label="Overlay opacity"
            min={OVERLAY_OPACITY_MIN}
            max={OVERLAY_OPACITY_MAX}
            step={0.05}
            value={overlayOpacity}
            onChange={(e) => setOverlayOpacity(Number(e.target.value))}
          />
          <span className={styles.subtle}>{Math.round(overlayOpacity * 100)}%</span>
        </label>
      </section>

      <section className={styles.section}>
        <h3>Tags</h3>
        <TagManager />
      </section>

      <section className={styles.section}>
        <h3>Backup</h3>
        <BackupSection />
        <p className={styles.subtle}>
          Your library is stored on your Couloir server, which also keeps daily database snapshots.
          Export a backup to keep a copy somewhere else.
        </p>
        <a className={styles.subtle} href="/api/backup/db" download>
          Download the database only (no photos) →
        </a>
      </section>

      <section className={styles.section}>
        <h3>About</h3>
        <p className={styles.subtle}>Couloir {APP_VERSION}</p>
      </section>
    </div>
  )
}
