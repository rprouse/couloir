import styles from './DetailPanel.module.css'
import { useUiStore } from '../../store/ui'
import { RouteDetail } from './RouteDetail'
import { TrackDetail } from './TrackDetail'

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
    } else {
      body = <UnsupportedPlaceholder type={panel.entityType} />
    }
  } else {
    // panel.mode === 'create' (waypoints/photos in Phase 4–5).
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
