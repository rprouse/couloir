import styles from './DetailPanel.module.css'
import { useUiStore } from '../../store/ui'
import { RouteDetail } from './RouteDetail'
import { TrackDetail } from './TrackDetail'
import { WaypointCreate } from './WaypointCreate'
import { PhotoCreate } from './PhotoCreate'
import { WaypointDetail } from './WaypointDetail'
import { PhotoDetail } from './PhotoDetail'

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
      body = <PhotoDetail photoId={panel.entityId} mode={panel.mode} />
    }
  } else if (panel.entityType === 'waypoint') {
    body = <WaypointCreate />
  } else {
    body = <PhotoCreate />
  }

  return (
    <aside className={styles.panel} role="complementary" aria-label="Detail panel">
      {body}
      <button type="button" className={styles.close} onClick={closePanel}>
        Close
      </button>
    </aside>
  )
}
