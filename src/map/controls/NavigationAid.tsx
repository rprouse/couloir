import { useEffect, useState } from 'react'
import styles from './NavigationAid.module.css'
import { useMap } from '../../hooks/useMap'
import { useUiStore } from '../../store/ui'
import { formatCoordinate, readNavigation, type NavigationReading } from '../navigation'
import { formatBearing, formatElevationM } from '../../utils/format'

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

function Readout() {
  const reading = useNavigationReading()
  if (!reading) return null
  return (
    <dl className={styles.readout} aria-label="Map centre">
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
