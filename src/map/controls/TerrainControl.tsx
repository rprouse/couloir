import styles from './TerrainControl.module.css'
import { useUiStore } from '../../store/ui'

export function TerrainControl() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const exaggeration = useUiStore((s) => s.terrainExaggeration)
  const toggle = useUiStore((s) => s.toggleTerrain)
  const setExag = useUiStore((s) => s.setTerrainExaggeration)

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
    </div>
  )
}
