import { useEffect, useState } from 'react'
import styles from './NavigationAid.module.css'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { formatCoordinate, readNavigation, type NavigationReading } from '../navigation'
import { formatBearing, formatElevationM } from '../../utils/format'
import { copyText } from '../../utils/clipboard'

// Live reading for the map centre. Updates at most once per animation frame
// while the map moves, and again on idle so the elevation fills in once the
// DEM tile under the centre has loaded.
function useNavigationReading(): NavigationReading | null {
  const map = useMap()
  const [reading, setReading] = useState<NavigationReading | null>(null)
  useEffect(() => {
    if (!map) {
      setReading(null)
      return
    }
    let frame: number | null = null
    const update = () => {
      frame = null
      setReading(readNavigation(map))
    }
    const schedule = () => {
      if (frame === null) frame = requestAnimationFrame(update)
    }
    update()
    map.on('move', schedule)
    map.on('idle', schedule)
    return () => {
      map.off('move', schedule)
      map.off('idle', schedule)
      if (frame !== null) cancelAnimationFrame(frame)
    }
  }, [map])
  return reading
}

const COPIED_MS = 1500

// Clicking the readout copies the centre as "lat, lng", the order mapping
// apps accept when pasted.
function Readout() {
  const reading = useNavigationReading()
  const [status, setStatus] = useState<string | null>(null)

  useEffect(() => {
    if (status === null) return
    const timer = setTimeout(() => setStatus(null), COPIED_MS)
    return () => clearTimeout(timer)
  }, [status])

  if (!reading) return null

  const copy = () => {
    const text = `${formatCoordinate(reading.lat)}, ${formatCoordinate(reading.lng)}`
    copyText(text)
      .then((ok) => setStatus(ok ? 'Copied lat, lng' : 'Copy failed'))
      .catch(() => setStatus('Copy failed'))
  }

  return (
    <div
      className={styles.readout}
      role="button"
      tabIndex={0}
      title="Copy lat, lng"
      aria-label="Copy lat, lng"
      onClick={copy}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          copy()
        }
      }}
    >
      <ReadoutValues reading={reading} />
      <div className={styles.status} aria-live="polite">
        {status}
      </div>
    </div>
  )
}

function ReadoutValues({ reading }: { reading: NavigationReading }) {
  return (
    <dl className={styles.values} aria-label="Map centre">
      <dt>Lat</dt>
      <dd>{formatCoordinate(reading.lat)}</dd>
      <dt>Lng</dt>
      <dd>{formatCoordinate(reading.lng)}</dd>
      <dt>Elev</dt>
      <dd title={reading.elevationM === null ? 'Turn on 3D terrain to read elevation' : undefined}>
        {reading.elevationM === null ? '—' : formatElevationM(reading.elevationM)}
      </dd>
      <dt>Bearing</dt>
      <dd>{formatBearing(reading.bearingDeg)}</dd>
    </dl>
  )
}

export function NavigationAid() {
  const enabled = useUiStore((s) => s.navigationAidEnabled)
  if (!enabled) return null
  return (
    <>
      <div className={styles.crosshair} data-testid="map-crosshair" aria-hidden="true" />
      <Readout />
    </>
  )
}
