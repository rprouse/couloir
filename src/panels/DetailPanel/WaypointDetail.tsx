import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { Waypoint, WaypointCategory } from '../../types'
import type { WaypointIcon } from '../../icons/waypointIcons'
import { iconLabel, resolveWaypointStyle } from '../../icons/waypointIcons'
import { WaypointBadge } from '../../icons/WaypointBadge'
import { WaypointStyleFields } from './WaypointStyleFields'
import { formatElevationM, isValidHex } from '../../utils/format'
import { TagPills } from './TagPills'
import { TagPicker } from '../../components/TagPicker/TagPicker'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'
import { useMap } from '../../hooks/useMap'
import { queryElevation } from '../../map/terrain'
import { formatLatLng, parseLatLng } from '../../utils/coords'
import { CoordinatesField } from './CoordinatesField'

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
  const marker = resolveWaypointStyle(wp)

  return (
    <>
      <div className={styles.header}>
        <div className={shared.row}>
          <WaypointBadge icon={marker.icon} color={marker.color} size={28} label={iconLabel(marker.icon)} />
          <h2 className={styles.heading}>{wp.name}</h2>
        </div>
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
  const [icon, setIcon] = useState<WaypointIcon | null>(wp.icon)
  const [tags, setTags] = useState<string[]>(wp.tags)
  const [coords, setCoords] = useState(formatLatLng(wp.lat, wp.lng))
  const [elevationTyped, setElevationTyped] = useState(false)
  const map = useMap()

  // Re-sync local state if the underlying waypoint is replaced upstream
  // (e.g. drag commit, or a sync arrival in the future).
  useEffect(() => {
    setCoords(formatLatLng(wp.lat, wp.lng))
    setName(wp.name)
    setDescription(wp.description)
    setCategory(wp.category)
    setElevation(wp.elevation_m === null ? '' : String(wp.elevation_m))
    setColor(wp.color ?? '')
    setIcon(wp.icon)
    setTags(wp.tags)
    setElevationTyped(false)
  }, [wp.id, wp.updated_at])

  const position = parseLatLng(coords)
  const lat = position?.lat ?? null
  const lng = position?.lng ?? null

  // Moving the waypoint refreshes its elevation from the DEM (when loaded),
  // unless the user has typed one.
  useEffect(() => {
    if (!map || lat === null || lng === null || elevationTyped) return
    if (lat === wp.lat && lng === wp.lng) return
    const elev = queryElevation(map, lat, lng)
    if (elev !== null) setElevation(String(Math.round(elev)))
  }, [map, lat, lng, elevationTyped, wp.lat, wp.lng])

  const elevNum = elevation.trim() === '' ? null : Number(elevation)
  const elevValid = elevNum === null || Number.isFinite(elevNum)
  const colorOk = color === '' || isValidHex(color)
  const canSave = name.trim().length > 0 && elevValid && colorOk && position !== null

  const onSave = async () => {
    if (!canSave || position === null) return
    try {
      await update(wp.id, {
        name: name.trim(),
        description,
        lat: position.lat,
        lng: position.lng,
        category,
        elevation_m: elevNum,
        color: color === '' ? null : color,
        icon,
        tags,
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
            onChange={(e) => {
              setElevation(e.target.value)
              setElevationTyped(true)
            }}
            placeholder="optional"
          />
        </label>
        <CoordinatesField value={coords} onChange={setCoords} />
      </section>

      <section className={shared.section}>
        <WaypointStyleFields
          category={category}
          icon={icon}
          color={color}
          onIconChange={setIcon}
          onColorChange={setColor}
        />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPicker value={tags} onChange={setTags} />
      </section>
    </>
  )
}
