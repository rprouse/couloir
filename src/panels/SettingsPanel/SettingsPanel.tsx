import { useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useSettingsStore } from '../../store/settings'
import { useUiStore } from '../../store/ui'

export function SettingsPanel() {
  const maptilerKey = useSettingsStore((s) => s.maptilerKey)
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const terrainExaggeration = useUiStore((s) => s.terrainExaggeration)
  const setTerrainExaggeration = useUiStore((s) => s.setTerrainExaggeration)

  const [draft, setDraft] = useState('')
  const [editing, setEditing] = useState(maptilerKey === null)

  const save = () => {
    if (draft.trim().length === 0) return
    setMaptilerKey(draft.trim())
    setDraft('')
    setEditing(false)
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Settings</h2>

      <section className={styles.section}>
        <h3>Maptiler</h3>
        {!editing && maptilerKey !== null ? (
          <div className={styles.row}>
            <span className={styles.subtle}>Key set ({maptilerKey.slice(0, 4)}…)</span>
            <button type="button" onClick={() => setEditing(true)}>Replace</button>
          </div>
        ) : (
          <div className={styles.column}>
            <label className={styles.field}>
              <span>Maptiler API key</span>
              <input
                type="text"
                autoComplete="off"
                spellCheck={false}
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
              />
            </label>
            <div className={styles.row}>
              <button type="button" onClick={save}>Save key</button>
              {maptilerKey !== null && (
                <button
                  type="button"
                  onClick={() => {
                    setDraft('')
                    setEditing(false)
                  }}
                >
                  Cancel
                </button>
              )}
            </div>
            <a
              className={styles.subtle}
              href="https://cloud.maptiler.com/account/keys/"
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
        <h3>About</h3>
        <p className={styles.subtle}>Couloir 0.0.1</p>
      </section>
    </div>
  )
}
