import { useEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'
import type maplibregl from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import styles from './TerrainControl.module.css'
import { useUiStore } from '../../store/ui'
import { useAtesAreasStore } from '../../store/atesAreas'
import type { TerrainOverlay } from '../../types'
import { atesClassesPresent, atesLegendItemsPresent } from '../layers/atesLayerData'
import { OverlayLegend } from './OverlayLegend'
import { AtesLegend } from './AtesLegend'
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'

// Exaggeration and overlay opacity are set in the Settings panel; this box
// keeps only the switches you flip while looking at the map.
const OVERLAY_OPTIONS: ReadonlyArray<{ id: TerrainOverlay | null; label: string }> = [
  { id: null, label: 'Off' },
  { id: 'slope', label: 'Slope' },
  { id: 'aspect', label: 'Aspect' },
]

// Rendered into a MapLibre bottom-right control slot rather than positioned
// over the map: MapLibre stacks bottom controls above the attribution, so the
// box clears it however tall the attribution grows.
export function TerrainControl() {
  const map = useMap()
  const [slot, setSlot] = useState<HTMLElement | null>(null)

  useEffect(() => {
    if (!map) return
    const el = document.createElement('div')
    el.className = `maplibregl-ctrl ${styles.slot}`
    const control: maplibregl.IControl = {
      onAdd: () => el,
      onRemove: () => el.remove(),
    }
    map.addControl(control, 'bottom-right')
    setSlot(el)
    return () => {
      map.removeControl(control)
      setSlot(null)
    }
  }, [map])

  return slot ? createPortal(<TerrainControlPanel />, slot) : null
}

// Collapses to a one-line header so it takes less of the map (collapsed by
// default on mobile).
export function TerrainControlPanel() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const overlay = useUiStore((s) => s.terrainOverlay)
  const atesEnabled = useUiStore((s) => s.atesEnabled)
  const atesAreas = useAtesAreasStore((s) => s.areas)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const storedCollapsed = useUiStore((s) => s.terrainControlCollapsed)
  const setCollapsed = useUiStore((s) => s.setTerrainControlCollapsed)
  const collapsed = storedCollapsed ?? isMobile

  // Collapsed, the header still says what's switched on.
  const active = [
    enabled && '3D',
    OVERLAY_OPTIONS.find((o) => o.id === overlay && o.id !== null)?.label,
    atesAreas.length > 0 && atesEnabled && 'ATES',
  ].filter(Boolean)

  return (
    <div className={styles.control}>
      <button
        type="button"
        className={styles.header}
        aria-expanded={!collapsed}
        aria-controls="terrain-control-body"
        onClick={() => setCollapsed(!collapsed)}
      >
        <span>Terrain</span>
        {collapsed && active.length > 0 && (
          <span className={styles.summary}>{active.join(' · ')}</span>
        )}
        <span className={styles.chevron} aria-hidden="true">{collapsed ? '▴' : '▾'}</span>
      </button>
      {!collapsed && (
        <div id="terrain-control-body" className={styles.body}>
          <TerrainControlBody />
        </div>
      )}
    </div>
  )
}

function TerrainControlBody() {
  const enabled = useUiStore((s) => s.terrainEnabled)
  const toggle = useUiStore((s) => s.toggleTerrain)
  const overlay = useUiStore((s) => s.terrainOverlay)
  const setOverlay = useUiStore((s) => s.setTerrainOverlay)
  const atesEnabled = useUiStore((s) => s.atesEnabled)
  const setAtesEnabled = useUiStore((s) => s.setAtesEnabled)
  const atesAreas = useAtesAreasStore((s) => s.areas)
  const atesClasses = useMemo(() => atesClassesPresent(atesAreas), [atesAreas])
  const atesItems = useMemo(() => atesLegendItemsPresent(atesAreas), [atesAreas])

  return (
    <>
      <hr className={styles.divider} />
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
      <hr className={styles.divider} />
      <div className={styles.overlayRow}>
        <span id="terrain-overlay-label">Overlay</span>
        <div className={styles.segmented} role="group" aria-labelledby="terrain-overlay-label">
          {OVERLAY_OPTIONS.map((opt) => (
            <button
              key={opt.label}
              type="button"
              className={styles.segment}
              aria-pressed={overlay === opt.id}
              onClick={() => setOverlay(opt.id)}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>
      {overlay && <OverlayLegend overlay={overlay} />}
      {/* ATES is a separate switch so it can sit on top of slope or aspect.
          Hidden until an area has been imported (Settings > ATES areas). */}
      {atesAreas.length > 0 && (
        <>
          <hr className={styles.divider} />
          <label className={styles.toggle}>
            <input
              type="checkbox"
              role="switch"
              aria-label="ATES ratings"
              checked={atesEnabled}
              onChange={(e) => setAtesEnabled(e.target.checked)}
            />
            <span>ATES</span>
          </label>
          {atesEnabled && <AtesLegend classes={atesClasses} items={atesItems} />}
        </>
      )}
    </>
  )
}
