import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'

interface RowDef {
  key: LayerKey
  label: string
  color: string
}

// Colors mirror DEFAULTS.route.color / DEFAULTS.track.color from DATA-MODEL.md
// and the DEFAULT clauses in the SQLite schema. Phase 2 will create a real
// constants module; replace these literals with imports from there once that
// lands so the values live in one place.
const ROWS: ReadonlyArray<RowDef> = [
  { key: 'routes',    label: 'Routes',    color: '#E05C2A' },
  { key: 'tracks',    label: 'Tracks',    color: '#2A7BE0' },
  { key: 'waypoints', label: 'Waypoints', color: '#FBBF24' },
  { key: 'photos',    label: 'Photos',    color: '#94A3B8' },
]

export function LayerPanel() {
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <ul className={styles.rows}>
        {ROWS.map((row) => {
          const inputId = `layer-toggle-${row.key}`
          return (
            <li key={row.key} className={styles.row} data-row={row.key}>
              <span
                className={styles.swatch}
                style={{ background: row.color }}
                aria-hidden="true"
              />
              <label htmlFor={inputId} className={styles.label}>
                {row.label}
              </label>
              <span className={styles.count} data-count={0}>
                0
              </span>
              <input
                id={inputId}
                type="checkbox"
                role="switch"
                checked={visibility[row.key]}
                onChange={() => toggleLayer(row.key)}
              />
            </li>
          )
        })}
      </ul>
    </div>
  )
}
