import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { Waypoint, WaypointCategory } from '../../types'
import { formatElevationM, isValidHex } from '../../utils/format'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'

interface Props {
  waypointId: string
  mode: 'view' | 'edit'
}

export function WaypointDetail({ waypointId, mode }: Props): JSX.Element {
  const wp = useWaypointsStore((s) => s.waypoints.find((w) => w.id === waypointId)) ?? null
  if (!wp) return <div className={styles.subtle}>Waypoint not found.</div>
  return mode === 'view' ? <WaypointView wp={wp} /> : <WaypointEdit wp={wp} />
}

function WaypointView({ wp }: { wp: Waypoint }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useWaypointsStore((s) => s.remove)

  const handleDelete = async () => {
    try {
      await remove(wp.id)
      closePanel()
    } catch (err) {
      // Phase 6 will replace this with a user-visible error surface.
      debug('waypoint delete failed', err)
    }
  }

  const elevation = wp.elevation_m === null ? '—' : formatElevationM(wp.elevation_m)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{wp.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {wp.description && <p className={styles.subtle}>{wp.description}</p>}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Category" value={WAYPOINT_CATEGORIES[wp.category].label} />
          <Metric label="Elevation" value={elevation} />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Coordinates</h3>
        <p className={styles.subtle}>
          {wp.lat.toFixed(5)}, {wp.lng.toFixed(5)}
        </p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={wp.tags} />
      </section>
    </>
  )
}

function WaypointEdit({ wp }: { wp: Waypoint }): JSX.Element {
  const update = useWaypointsStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(wp.name)
  const [description, setDescription] = useState(wp.description)
  const [category, setCategory] = useState<WaypointCategory>(wp.category)
  const [elevation, setElevation] = useState<string>(
    wp.elevation_m === null ? '' : String(wp.elevation_m),
  )
  const [color, setColor] = useState<string>(wp.color ?? '')

  // Re-sync local state if the underlying waypoint is replaced upstream
  // (e.g. drag commit, or a sync arrival in the future).
  useEffect(() => {
    setName(wp.name)
    setDescription(wp.description)
    setCategory(wp.category)
    setElevation(wp.elevation_m === null ? '' : String(wp.elevation_m))
    setColor(wp.color ?? '')
  }, [wp.id, wp.updated_at])

  const elevNum = elevation.trim() === '' ? null : Number(elevation)
  const elevValid = elevNum === null || Number.isFinite(elevNum)
  const colorOk = color === '' || isValidHex(color)
  const canSave = name.trim().length > 0 && elevValid && colorOk

  const onSave = async () => {
    if (!canSave) return
    try {
      await update(wp.id, {
        name: name.trim(),
        description,
        category,
        elevation_m: elevNum,
        color: color === '' ? null : color,
      })
      openEntity('waypoint', wp.id)
    } catch (err) {
      debug('waypoint save failed', err)
    }
  }

  const onCancel = () => openEntity('waypoint', wp.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit waypoint</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      <section className={shared.section}>
        <label className={shared.field}>
          <span>Name</span>
          <input value={name} onChange={(e) => setName(e.target.value)} />
        </label>
        <label className={shared.field}>
          <span>Description</span>
          <textarea
            rows={3}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </label>
        <label className={shared.field}>
          <span>Category</span>
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as WaypointCategory)}
          >
            {(Object.keys(WAYPOINT_CATEGORIES) as WaypointCategory[]).map((k) => (
              <option key={k} value={k}>{WAYPOINT_CATEGORIES[k].label}</option>
            ))}
          </select>
        </label>
        <label className={shared.field}>
          <span>Elevation (m)</span>
          <input
            type="number"
            inputMode="numeric"
            value={elevation}
            onChange={(e) => setElevation(e.target.value)}
            placeholder="optional"
          />
        </label>
        <label className={shared.field}>
          <span>Color override</span>
          <div className={shared.row}>
            <input
              type="color"
              value={color === '' ? WAYPOINT_CATEGORIES[category].color : color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
              placeholder="leave blank to use category default"
            />
          </div>
          {!colorOk && <span className={styles.subtle}>Use #RRGGBB hex.</span>}
        </label>
      </section>
    </>
  )
}
