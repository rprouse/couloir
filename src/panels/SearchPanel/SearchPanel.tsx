import { useMemo, useState } from 'react'
import styles from './SearchPanel.module.css'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useUiStore, type LayerKey } from '../../store/ui'
import { getMap } from '../../hooks/useMap'
import { searchEntities, type SearchHit } from '../../features/search/search'
import { flyToEntity, type FlyTarget } from '../../map/flyToEntity'
import type { EntityType } from '../../types'

const GROUPS: ReadonlyArray<{ type: EntityType; label: string; layer: LayerKey }> = [
  { type: 'route', label: 'Routes', layer: 'routes' },
  { type: 'track', label: 'Tracks', layer: 'tracks' },
  { type: 'waypoint', label: 'Waypoints', layer: 'waypoints' },
  { type: 'photo', label: 'Photos', layer: 'photos' },
]

export function SearchPanel(): JSX.Element {
  const [query, setQuery] = useState('')
  const routes = useRoutesStore((s) => s.routes)
  const tracks = useTracksStore((s) => s.tracks)
  const waypoints = useWaypointsStore((s) => s.waypoints)
  const photos = usePhotosStore((s) => s.photos)

  const results = useMemo(
    () => searchEntities(query, { routes, tracks, waypoints, photos }),
    [query, routes, tracks, waypoints, photos],
  )
  const total = results ? GROUPS.reduce((n, g) => n + results[g.type].length, 0) : 0

  const open = (hit: SearchHit, layer: LayerKey) => {
    const ui = useUiStore.getState()
    if (!ui.layerVisibility[layer]) ui.toggleLayer(layer)
    const target = flyTargetFor(hit)
    const map = getMap()
    if (map && target) flyToEntity(map, target)
    ui.openEntity(hit.type, hit.id)
  }

  return (
    <div className={styles.panel}>
      <h2 className={styles.heading}>Search</h2>
      <input
        type="search"
        className={styles.input}
        placeholder="Search…"
        aria-label="Search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        autoFocus
      />
      {results === null && (
        <p className={styles.subtle}>Search names and descriptions of routes, tracks, waypoints and photos.</p>
      )}
      {results !== null && total === 0 && <p className={styles.subtle}>{`No matches for “${query.trim()}”.`}</p>}
      {results !== null &&
        GROUPS.filter((g) => results[g.type].length > 0).map((g) => (
          <section key={g.type} className={styles.group}>
            <h3>{`${g.label} (${results[g.type].length})`}</h3>
            <ul className={styles.hits}>
              {results[g.type].map((hit) => (
                <li key={hit.id}>
                  <button type="button" className={styles.hit} onClick={() => open(hit, g.layer)}>
                    <span>{hit.name}</span>
                    {hit.snippet && <span className={styles.snippet}>{hit.snippet}</span>}
                  </button>
                </li>
              ))}
            </ul>
          </section>
        ))}
    </div>
  )
}

// Looked up at click time so the target reflects the latest store state.
function flyTargetFor(hit: SearchHit): FlyTarget | null {
  switch (hit.type) {
    case 'route': {
      const r = useRoutesStore.getState().routes.find((x) => x.id === hit.id)
      return r ? { kind: 'line', geojson: r.geojson } : null
    }
    case 'track': {
      const t = useTracksStore.getState().tracks.find((x) => x.id === hit.id)
      return t ? { kind: 'line', geojson: t.geojson } : null
    }
    case 'waypoint': {
      const w = useWaypointsStore.getState().waypoints.find((x) => x.id === hit.id)
      return w ? { kind: 'point', lat: w.lat, lng: w.lng } : null
    }
    case 'photo': {
      const p = usePhotosStore.getState().photos.find((x) => x.id === hit.id)
      return p ? { kind: 'point', lat: p.lat, lng: p.lng } : null
    }
  }
}
