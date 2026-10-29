import { useEffect, useState } from 'react'
import styles from './TerrainControl.module.css'
import { useMap } from '../../hooks/useMap'
import type { TerrainOverlay } from '../../types'
import { SLOPE_BANDS } from '../slope/slopeBands'
import { ASPECT_SECTORS } from '../slope/aspectBands'
import { OVERLAY_MIN_ZOOM } from '../layers/layerStyles'

// Current map zoom, tracked on zoomend; null until the map exists.
function useMapZoom(): number | null {
  const map = useMap()
  const [zoom, setZoom] = useState<number | null>(() => map?.getZoom() ?? null)
  useEffect(() => {
    if (!map) {
      setZoom(null)
      return
    }
    const update = () => setZoom(map.getZoom())
    update()
    map.on('zoomend', update)
    return () => {
      map.off('zoomend', update)
    }
  }, [map])
  return zoom
}

const CAVEATS: Record<TerrainOverlay, string> = {
  slope:
    'Approximate. Computed from ~30 m elevation data; short steep features read low. Not a ' +
    'substitute for field assessment.',
  aspect:
    'Approximate. Computed from ~30 m elevation data; only slopes of ' +
    `${SLOPE_BANDS[0].minDeg}° and steeper are shaded, and small features such as gully walls ` +
    'may not show. Not a substitute for field assessment.',
}

function SlopeBands() {
  return (
    // Swatch colours are the raster's literal pixel colours (SLOPE_BANDS).
    <ul className={styles.bands} aria-label="Slope angle legend">
      {SLOPE_BANDS.map((band) => (
        <li key={band.label} className={styles.band}>
          <span className={styles.swatch} style={{ background: band.color }} />
          <span>{band.label}</span>
        </li>
      ))}
    </ul>
  )
}

const ROSE_SIZE = 76
const ROSE_C = ROSE_SIZE / 2
const ROSE_R = 26
const LABEL_R = 34

// Point at `r` from the centre on compass bearing `deg` (0 = up, clockwise).
function polar(deg: number, r: number): [number, number] {
  const rad = (deg * Math.PI) / 180
  return [ROSE_C + r * Math.sin(rad), ROSE_C - r * Math.cos(rad)]
}

function wedgePath(centerDeg: number): string {
  const [x1, y1] = polar(centerDeg - 22.5, ROSE_R)
  const [x2, y2] = polar(centerDeg + 22.5, ROSE_R)
  return `M${ROSE_C},${ROSE_C} L${x1},${y1} A${ROSE_R},${ROSE_R} 0 0 1 ${x2},${y2} Z`
}

function AspectRose() {
  return (
    // Wedge colours are the raster's literal pixel colours (ASPECT_SECTORS).
    <svg
      className={styles.rose}
      width={ROSE_SIZE}
      height={ROSE_SIZE}
      viewBox={`0 0 ${ROSE_SIZE} ${ROSE_SIZE}`}
      role="img"
      aria-label="Aspect legend"
    >
      {ASPECT_SECTORS.map((sector) => (
        <path key={sector.label} className={styles.wedge} d={wedgePath(sector.centerDeg)} fill={sector.color}>
          <title>{sector.label}</title>
        </path>
      ))}
      {ASPECT_SECTORS.filter((s) => s.label.length === 1).map((sector) => {
        const [x, y] = polar(sector.centerDeg, LABEL_R)
        return (
          <text key={sector.label} className={styles.roseLabel} x={x} y={y}>
            {sector.label}
          </text>
        )
      })}
    </svg>
  )
}

export function OverlayLegend({ overlay }: { overlay: TerrainOverlay }) {
  const zoom = useMapZoom()
  return (
    <div className={styles.legend}>
      {overlay === 'slope' ? <SlopeBands /> : <AspectRose />}
      {zoom !== null && zoom < OVERLAY_MIN_ZOOM && (
        <p className={styles.hint}>Zoom in to see {overlay}</p>
      )}
      <p className={styles.caveat}>{CAVEATS[overlay]}</p>
    </div>
  )
}
