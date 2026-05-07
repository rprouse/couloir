import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'

interface RowDef {
  key: LayerKey
  label: string
  color: string
}

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
        {ROWS.map((row) => (
          <li key={row.key} className={styles.row} data-row={row.key}>
            <span className={styles.swatch} style={{ background: row.color }} aria-hidden="true" />
            <span className={styles.label}>{row.label}</span>
            {' '}
            <span className={styles.count}>0</span>
            <input
              type="checkbox"
              role="switch"
              aria-label={`${row.label} visibility`}
              checked={visibility[row.key]}
              onChange={() => toggleLayer(row.key)}
            />
          </li>
        ))}
      </ul>
    </div>
  )
}
