import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'
import { ImportButton } from '../../features/import/ImportButton'
import type { DuplicateDecision, DuplicatePromptArgs } from '../../features/import/gpxImport'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'

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
  const startWaypointPlacement = useUiStore((s) => s.startWaypointPlacement)
  const routesCount    = useRoutesStore((s) => s.routes.length)
  const tracksCount    = useTracksStore((s) => s.tracks.length)
  const waypointsCount = useWaypointsStore((s) => s.waypoints.length)
  const photosCount    = usePhotosStore((s) => s.photos.length)

  const counts: Record<LayerKey, number> = {
    routes: routesCount,
    tracks: tracksCount,
    waypoints: waypointsCount,
    photos: photosCount,
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <div className={styles.actions}>
        <ImportButton promptDuplicate={promptDuplicate} />
        <button type="button" onClick={startWaypointPlacement}>
          Add Waypoint
        </button>
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
              <span className={styles.count} data-count={counts[row.key]}>
                {counts[row.key]}
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
