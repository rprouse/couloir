import { useRef, useState } from 'react'
import styles from './SettingsPanel.module.css'
import { useMap } from '../../hooks/useMap'
import { useAtesAreasStore } from '../../store/atesAreas'
import { OVERLAY_OPACITY_MAX, OVERLAY_OPACITY_MIN, useUiStore } from '../../store/ui'
import { ATES_CLASS_LABELS, ATES_CLASSES, type AtesArea } from '../../types'
import { runAtesImport } from '../../features/ates/runAtesImport'
import { atesAreaBounds, atesZoneCounts } from '../../map/layers/atesLayerData'
import { ATES_CLASS_COLORS } from '../../map/layers/layerStyles'
import { debug } from '../../utils/debug'

export const TRIP_PLANNER_URL = 'https://avalanche.ca/planning/trip-planner'
const FIT_PADDING_PX = 40

// Imported Avalanche Canada ATES areas: import, list, zoom to and delete, plus
// the fill opacity. The on/off switch lives on the map (TerrainControl).
export function AtesAreasSection() {
  const areas = useAtesAreasStore((s) => s.areas)
  const atesOpacity = useUiStore((s) => s.atesOpacity)
  const setAtesOpacity = useUiStore((s) => s.setAtesOpacity)
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [busy, setBusy] = useState(false)

  const importFiles = async (files: File[]) => {
    if (files.length === 0) return
    setBusy(true)
    try {
      await runAtesImport(files)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={styles.column}>
      <div className={styles.row}>
        <button type="button" disabled={busy} onClick={() => inputRef.current?.click()}>
          {busy ? 'Importing…' : 'Import ATES KMZ'}
        </button>
        <input
          ref={inputRef}
          type="file"
          aria-label="ATES KMZ files"
          accept=".kmz,application/vnd.google-earth.kmz"
          multiple
          style={{ display: 'none' }}
          onChange={(e) => {
            const files = Array.from(e.target.files ?? [])
            // Reset so picking the same file twice fires onChange again.
            e.target.value = ''
            void importFiles(files)
          }}
        />
      </div>

      {areas.length > 0 && (
        <ul className={styles.atesList} aria-label="ATES areas">
          {areas.map((area) => <AtesAreaRow key={area.id} area={area} />)}
        </ul>
      )}

      <label className={styles.field}>
        <span>ATES zone opacity</span>
        <input
          type="range"
          aria-label="ATES opacity"
          min={OVERLAY_OPACITY_MIN}
          max={OVERLAY_OPACITY_MAX}
          step={0.05}
          value={atesOpacity}
          onChange={(e) => setAtesOpacity(Number(e.target.value))}
        />
        <span className={styles.subtle}>{Math.round(atesOpacity * 100)}%</span>
      </label>

      <p className={styles.subtle}>
        Download an area&apos;s KMZ from the{' '}
        <a href={TRIP_PLANNER_URL} target="_blank" rel="noopener noreferrer">Avalanche Canada Trip Planner</a>
        {' '}(choose the area, then the download icon), then import it here or drop it on the map.
        Importing an area again replaces it.
      </p>
    </div>
  )
}

function AtesAreaRow({ area }: { area: AtesArea }) {
  const map = useMap()
  const remove = useAtesAreasStore((s) => s.remove)
  const [confirming, setConfirming] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const counts = atesZoneCounts(area)
  const bounds = atesAreaBounds(area)

  const onDelete = async () => {
    try {
      await remove(area.id)
    } catch (err) {
      debug('ATES area delete failed', err)
      setError(`Delete failed: ${String(err)}`)
      setConfirming(false)
    }
  }

  return (
    <li className={styles.atesRow}>
      <div className={styles.atesRowHeader}>
        <span className={styles.atesName}>{area.name}</span>
        <span className={styles.subtle}>{area.updated_at.slice(0, 10)}</span>
      </div>
      <ul className={styles.atesCounts} aria-label={`${area.name} zones`}>
        {ATES_CLASSES.filter((c) => counts[c]).map((c) => (
          <li key={c} title={ATES_CLASS_LABELS[c]}>
            {/* Literal map fill colour (ATES_CLASS_COLORS). */}
            <span className={styles.atesSwatch} style={{ background: ATES_CLASS_COLORS[c] }} />
            {`${counts[c]} ${ATES_CLASS_LABELS[c].replace(/ \(.*\)$/, '').toLowerCase()}`}
          </li>
        ))}
      </ul>
      {confirming ? (
        <div className={styles.row}>
          <span className={styles.subtle}>{`Delete ${area.name}?`}</span>
          <button type="button" onClick={() => void onDelete()}>Delete</button>
          <button type="button" onClick={() => setConfirming(false)}>Cancel</button>
        </div>
      ) : (
        <div className={styles.row}>
          <button
            type="button"
            disabled={!map || !bounds}
            onClick={() => bounds && map?.fitBounds(bounds, { padding: FIT_PADDING_PX })}
          >
            Show on map
          </button>
          <button type="button" aria-label={`Delete ${area.name}`} onClick={() => setConfirming(true)}>
            Delete
          </button>
        </div>
      )}
      {error && <p className={styles.error}>{error}</p>}
    </li>
  )
}
