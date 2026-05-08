import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'
import { ImportButton } from '../../features/import/ImportButton'
import type { DuplicateDecision, DuplicatePromptArgs } from '../../features/import/gpxImport'

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

interface Props {
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export function LayerPanel({ promptDuplicate }: Props) {
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <div className={styles.actions}>
        <ImportButton promptDuplicate={promptDuplicate} />
      </div>
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
