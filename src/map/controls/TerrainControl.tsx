import styles from './TerrainControl.module.css'
import { SLOPE_OPACITY_MAX, SLOPE_OPACITY_MIN, useUiStore } from '../../store/ui'
import { SlopeLegend } from './SlopeLegend'

export function TerrainControl() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const exaggeration = useUiStore((s) => s.terrainExaggeration)
  const toggle = useUiStore((s) => s.toggleTerrain)
  const setExag = useUiStore((s) => s.setTerrainExaggeration)
  const slopeEnabled = useUiStore((s) => s.slopeEnabled)
  const slopeOpacity = useUiStore((s) => s.slopeOpacity)
  const toggleSlope = useUiStore((s) => s.toggleSlope)
  const setSlopeOpacity = useUiStore((s) => s.setSlopeOpacity)

  return (
    <div className={styles.control}>
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          aria-label="3D terrain"
          checked={enabled}
          onChange={toggle}
        />
        <span>3D Terrain</span>
      </label>
      <label className={styles.slider}>
        <span>Exaggeration</span>
        <input
          type="range"
          aria-label="Exaggeration"
          min={1}
          max={3}
          step={0.1}
          value={exaggeration}
          disabled={!enabled}
          onChange={(e) => setExag(Number(e.target.value))}
        />
        <span className={styles.value}>{exaggeration.toFixed(1)}×</span>
      </label>
      <hr className={styles.divider} />
      <label className={styles.toggle}>
        <input
          type="checkbox"
          role="switch"
          aria-label="Slope angle"
          checked={slopeEnabled}
          onChange={toggleSlope}
        />
        <span>Slope angle</span>
      </label>
      <label className={styles.slider}>
        <span>Opacity</span>
        <input
          type="range"
          aria-label="Slope opacity"
          min={SLOPE_OPACITY_MIN}
          max={SLOPE_OPACITY_MAX}
          step={0.05}
          value={slopeOpacity}
          disabled={!slopeEnabled}
          onChange={(e) => setSlopeOpacity(Number(e.target.value))}
        />
        <span className={styles.value}>{Math.round(slopeOpacity * 100)}%</span>
      </label>
      {slopeEnabled && <SlopeLegend />}
    </div>
  )
}
