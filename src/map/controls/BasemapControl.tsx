import styles from './BasemapControl.module.css'
import { useUiStore } from '../../store/ui'
import type { Basemap } from '../../types'

const OPTIONS: ReadonlyArray<{ id: Basemap; label: string }> = [
  { id: 'satellite', label: 'Satellite' },
  { id: 'outdoor',   label: 'Outdoor'   },
  { id: 'winter',    label: 'Winter'    },
]

export function BasemapControl() {
  const active = useUiStore((s) => s.activeBasemap)
  const setBasemap = useUiStore((s) => s.setBasemap)

  return (
    <div className={styles.control} role="group" aria-label="Basemap">
      {OPTIONS.map((opt) => (
        <button
          key={opt.id}
          type="button"
          className={styles.button}
          aria-pressed={active === opt.id}
          onClick={() => setBasemap(opt.id)}
        >
          {opt.label}
        </button>
      ))}
    </div>
  )
}
