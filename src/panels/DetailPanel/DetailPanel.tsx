import styles from './DetailPanel.module.css'
import { useUiStore } from '../../store/ui'
import { RouteDetail } from './RouteDetail'
import { TrackDetail } from './TrackDetail'
import { WaypointCreate } from './WaypointCreate'
import { WaypointDetail } from './WaypointDetail'

export function DetailPanel(): JSX.Element | null {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)

  if (panel.mode === 'idle') return null

  let body: JSX.Element
  if (panel.mode === 'view' || panel.mode === 'edit') {
    if (panel.entityType === 'route') {
      body = <RouteDetail routeId={panel.entityId} mode={panel.mode} />
    } else if (panel.entityType === 'track') {
      body = <TrackDetail trackId={panel.entityId} mode={panel.mode} />
    } else if (panel.entityType === 'waypoint') {
      body = <WaypointDetail waypointId={panel.entityId} mode={panel.mode} />
    } else {
      // photo view/edit ships in Phase 5
      body = <UnsupportedPlaceholder type={panel.entityType} />
    }
  } else if (panel.entityType === 'waypoint') {
    body = <WaypointCreate />
  } else {
    // panel.mode === 'create' && entityType === 'photo' — Phase 5.
    body = <UnsupportedPlaceholder type={panel.entityType} />
  }

  return (
    <aside className={styles.panel} role="complementary" aria-label="Detail panel">
      {body}
      <button
        type="button"
        onClick={closePanel}
        style={{ alignSelf: 'flex-start' }}
      >
        Close
      </button>
    </aside>
  )
}

function UnsupportedPlaceholder({ type }: { type: string }): JSX.Element {
  return <div>Detail for {type} arrives in a later phase.</div>
}
