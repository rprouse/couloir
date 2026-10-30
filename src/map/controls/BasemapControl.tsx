import styles from './BasemapControl.module.css'
import { useUiStore } from '../../store/ui'
import { MOBILE_QUERY, useMediaQuery } from '../../hooks/useMediaQuery'
import type { Basemap } from '../../types'

const OPTIONS: ReadonlyArray<{ id: Basemap; label: string }> = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'hybrid',    label: 'Hybrid'    },
  { id: 'outdoor',   label: 'Outdoor'   },
  { id: 'winter',    label: 'Winter'    },
]

// Collapses horizontally to the active basemap alone (by default on mobile,
// where the four buttons crowd the top of the map). The chevron, or the
// active basemap while collapsed, toggles it.
export function BasemapControl() {
  const active = useUiStore((s) => s.activeBasemap)
  const setBasemap = useUiStore((s) => s.setBasemap)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const storedCollapsed = useUiStore((s) => s.basemapControlCollapsed)
  const setCollapsed = useUiStore((s) => s.setBasemapControlCollapsed)
  const collapsed = storedCollapsed ?? isMobile
  const shown = collapsed ? OPTIONS.filter((opt) => opt.id === active) : OPTIONS

  return (
    <div className={styles.control} role="group" aria-label="Basemap">
      <button
        type="button"
        className={`${styles.button} ${styles.toggle}`}
        aria-expanded={!collapsed}
        aria-label={collapsed ? 'Show all basemaps' : 'Hide other basemaps'}
        onClick={() => setCollapsed(!collapsed)}
      >
        <span aria-hidden="true">{collapsed ? '‹' : '›'}</span>
      </button>
      {shown.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={styles.button}
          aria-pressed={active === opt.id}
          onClick={() => (collapsed ? setCollapsed(false) : setBasemap(opt.id))}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
