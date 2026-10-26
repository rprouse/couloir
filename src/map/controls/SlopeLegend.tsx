import { useEffect, useState } from 'react'
import styles from './TerrainControl.module.css'
import { useMap } from '../../hooks/useMap'
import { SLOPE_BANDS } from '../slope/slopeBands'
import { SLOPE_MIN_ZOOM } from '../layers/layerStyles'

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

export function SlopeLegend() {
  const zoom = useMapZoom()
  return (
    <div className={styles.legend}>
      {/* Swatch colours are the raster's literal pixel colours (SLOPE_BANDS). */}
      <ul className={styles.bands} aria-label="Slope angle legend">
        {SLOPE_BANDS.map((band) => (
          <li key={band.label} className={styles.band}>
            <span className={styles.swatch} style={{ background: band.color }} />
            <span>{band.label}</span>
          </li>
        ))}
      </ul>
      {zoom !== null && zoom < SLOPE_MIN_ZOOM && (
        <p className={styles.hint}>Zoom in to see slope</p>
      )}
      <p className={styles.caveat}>
        Approximate. Computed from ~30 m elevation data; short steep features read low. Not a
        substitute for field assessment.
      </p>
    </div>
  )
}
