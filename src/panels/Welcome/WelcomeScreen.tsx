import { useState } from 'react'
import styles from './WelcomeScreen.module.css'
import { useSettingsStore } from '../../store/settings'

const MAPTILER_SIGNUP_URL = 'https://cloud.maptiler.com/account/keys/'

// First-run overlay shown in place of the map until a Maptiler key exists.
export function WelcomeScreen(): JSX.Element {
  const setMaptilerKey = useSettingsStore((s) => s.setMaptilerKey)
  const [key, setKey] = useState('')

  const save = () => {
    // Strip all whitespace so a paste from a line-wrapped terminal can't slip
    // embedded spaces or newlines into the stored key.
    const trimmed = key.replace(/\s/g, '')
    if (trimmed) setMaptilerKey(trimmed)
  }

  return (
    <div className={styles.overlay}>
      <div className={styles.card}>
        <h2>Welcome to Couloir</h2>
        <p className={styles.subtle}>
          Your private library of backcountry routes, tracks, waypoints and recon photos.
        </p>
        <ol className={styles.steps}>
          <li className={styles.step}>
            <strong>Add a Maptiler API key</strong>
            <span className={styles.subtle}>
              Couloir uses Maptiler for 3D terrain and basemaps. The free tier is plenty.
            </span>
            <div className={styles.row}>
              <input
                type="text"
                aria-label="Maptiler API key"
                autoComplete="off"
                spellCheck={false}
                value={key}
                onChange={(e) => setKey(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') save()
                }}
              />
              <button type="button" onClick={save}>
                Save key
              </button>
            </div>
            <a
              href={MAPTILER_SIGNUP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className={styles.subtle}
            >
              Create a free Maptiler account →
            </a>
          </li>
          <li className={styles.step}>
            <strong>Import your first GPX</strong>
            <span className={styles.subtle}>
              Once the map loads, use Import GPX in the Layers panel, or drop a .gpx file onto the map.
            </span>
          </li>
        </ol>
      </div>
    </div>
  )
}
