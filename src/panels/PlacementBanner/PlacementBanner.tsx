import styles from './PlacementBanner.module.css'
import { useUiStore } from '../../store/ui'

// Subscribes to the placement state machine. Renders nothing in idle mode;
// otherwise shows the click-the-map prompt for the active placement and a
// Cancel button.
export function PlacementBanner(): JSX.Element | null {
  const mode = useUiStore((s) => s.placement.mode)
  const cancelPlacement = useUiStore((s) => s.cancelPlacement)

  if (mode === 'idle') return null

  const message =
    mode === 'waypoint'
      ? 'Click the map to place a waypoint. Press Escape to cancel.'
      : 'Click the map where this photo was taken. Press Escape to cancel.'

  return (
    <div role="status" aria-live="polite" className={styles.banner}>
      <span>{message}</span>
      <button type="button" onClick={cancelPlacement}>Cancel</button>
    </div>
  )
}
