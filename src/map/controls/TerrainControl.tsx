import styles from './TerrainControl.module.css'
import { useUiStore } from '../../store/ui'
import type { TerrainOverlay } from '../../types'
import { OverlayLegend } from './OverlayLegend'

// Exaggeration and overlay opacity are set in the Settings panel; this box
// keeps only the switches you flip while looking at the map.
const OVERLAY_OPTIONS: ReadonlyArray<{ id: TerrainOverlay | null; label: string }> = [
  { id: null, label: 'Off' },
  { id: 'slope', label: 'Slope' },
  { id: 'aspect', label: 'Aspect' },
]

export function TerrainControl() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const toggle = useUiStore((s) => s.toggleTerrain)
  const overlay = useUiStore((s) => s.terrainOverlay)
  const setOverlay = useUiStore((s) => s.setTerrainOverlay)

  return (
    <div className={styles.control}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          aria-label="3D terrain"
          checked={enabled}
          onChange={toggle}
        />
        <span>3D Terrain</span>
      </label>
      <hr className={styles.divider} />
      <div className={styles.overlayRow}>
        <span id="terrain-overlay-label">Overlay</span>
        <div className={styles.segmented} role="group" aria-labelledby="terrain-overlay-label">
          {OVERLAY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={styles.segment}
              aria-pressed={overlay === opt.id}
              onClick={() => setOverlay(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {overlay && <OverlayLegend overlay={overlay} />}
    </div>
  )
}
