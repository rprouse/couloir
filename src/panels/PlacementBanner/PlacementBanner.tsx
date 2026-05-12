import styles from './PlacementBanner.module.css'
import { useUiStore } from '../../store/ui'

// Subscribes to the placement state machine. Renders nothing in idle mode.
// In waypoint mode it shows the click-the-map prompt with a Cancel button.
// The photo branch (placement.mode === 'photo') lands in Phase 5 and is
// intentionally left unhandled here.
export function PlacementBanner(): JSX.Element | null {
  const placement = useUiStore((s) => s.placement)
  const cancelPlacement = useUiStore((s) => s.cancelPlacement)

  if (placement.mode !== 'waypoint') return null

  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      <span>Click the map to place a waypoint. Press Escape to cancel.</span>
      <button type="button" onClick={cancelPlacement}>Cancel</button>
    </div>
  )
}
