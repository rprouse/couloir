import styles from './LayerPanel.module.css'
import { useUiStore, type LayerKey } from '../../store/ui'
import { ImportButton } from '../../features/import/ImportButton'
import { AddPhotoButton } from '../../features/photos/AddPhotoButton'
import type { DuplicateDecision, DuplicatePromptArgs } from '../../features/import/gpxImport'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { filterByTags } from '../../utils/tags'
import { TagFilterMenu } from './TagFilterMenu'

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

const EMPTY_HINTS: Record<LayerKey, string> = {
  routes: 'Import a GPX route to get started.',
  tracks: 'Import a recorded GPX track.',
  waypoints: 'Use Add Waypoint, then click the map.',
  photos: 'Use Add Photo to pin a recon photo.',
}

interface Props {
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export function LayerPanel({ promptDuplicate }: Props) {
  const visibility = useUiStore((s) => s.layerVisibility)
  const toggleLayer = useUiStore((s) => s.toggleLayer)
  const startWaypointPlacement = useUiStore((s) => s.startWaypointPlacement)
  const routes    = useRoutesStore((s) => s.routes)
  const tracks    = useTracksStore((s) => s.tracks)
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const photos    = usePhotosStore((s) => s.photos)
  const routesFilter    = useUiStore((s) => s.tagFilters.routes)
  const tracksFilter    = useUiStore((s) => s.tagFilters.tracks)
  const waypointsFilter = useUiStore((s) => s.tagFilters.waypoints)
  const photosFilter    = useUiStore((s) => s.tagFilters.photos)

  const counts: Record<LayerKey, number> = {
    routes: routes.length,
    tracks: tracks.length,
    waypoints: waypoints.length,
    photos: photos.length,
  }
  const filters: Record<LayerKey, string[]> = {
    routes: routesFilter,
    tracks: tracksFilter,
    waypoints: waypointsFilter,
    photos: photosFilter,
  }
  const shownCounts: Record<LayerKey, number> = {
    routes: filterByTags(routes, routesFilter).length,
    tracks: filterByTags(tracks, tracksFilter).length,
    waypoints: filterByTags(waypoints, waypointsFilter).length,
    photos: filterByTags(photos, photosFilter).length,
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Layers</h2>
      <div className={styles.actions}>
        <ImportButton promptDuplicate={promptDuplicate} />
        <button type="button" onClick={startWaypointPlacement}>
          Add Waypoint
        </button>
        <AddPhotoButton />
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
              {/* data-count is always the total; the text reads "shown of total" while filtered. */}
              <span className={styles.count} data-count={counts[row.key]}>
                {filters[row.key].length > 0
                  ? `${shownCounts[row.key]} of ${counts[row.key]}`
                  : counts[row.key]}
              </span>
              <TagFilterMenu layer={row.key} label={row.label} />
              <input
                id={inputId}
                type="checkbox"
                role="switch"
                checked={visibility[row.key]}
                onChange={() => toggleLayer(row.key)}
              />
              {counts[row.key] === 0 && (
                <span className={styles.hint}>{EMPTY_HINTS[row.key]}</span>
              )}
            </li>
          )
        })}
      </ul>
    </div>
  )
}
