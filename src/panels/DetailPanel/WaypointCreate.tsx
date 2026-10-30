import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { useMap } from '../../hooks/useMap'
import { queryElevation } from '../../map/terrain'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { WaypointCategory } from '../../types'
import { TagPicker } from '../../components/TagPicker/TagPicker'
import type { WaypointIcon } from '../../icons/waypointIcons'
import { isValidHex } from '../../utils/format'
import { WaypointStyleFields } from './WaypointStyleFields'
import { debug } from '../../utils/debug'
import { formatLatLng, parseLatLng } from '../../utils/coords'
import { CoordinatesField } from './CoordinatesField'

// Waypoint creation form. Seeds the coordinates from panel.draft (set by
// completePlacement); they stay editable so a position copied from another
// app can be pasted in. Owns name/description/category/elevation as local
// state. Elevation is autofilled from the DEM for the current coordinates
// when it's loaded, until the user types an elevation; otherwise the field is
// left blank for the user to enter (or leave null).
export function WaypointCreate(): JSX.Element {
  const panel = useUiStore((s) => s.panel)
  const closePanel = useUiStore((s) => s.closePanel)
  const openEntity = useUiStore((s) => s.openEntity)
  const add = useWaypointsStore((s) => s.add)
  const map = useMap()

  // Derive seed coords before hooks so they can be used as useEffect deps.
  // panel.mode is 'create' and entityType is 'waypoint' when this component is
  // rendered (the DetailPanel router enforces it). If invariants drift we still
  // need to call all hooks before returning early — React's rules of hooks
  // require unconditional hook calls.
  const draft =
    panel.mode === 'create' && panel.entityType === 'waypoint'
      ? (panel.draft as { lat?: number; lng?: number })
      : {}
  const seedLat = typeof draft.lat === 'number' ? draft.lat : null
  const seedLng = typeof draft.lng === 'number' ? draft.lng : null

  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState<WaypointCategory>('poi')
  const [elevation, setElevation] = useState<string>('')
  const [icon, setIcon] = useState<WaypointIcon | null>(null)
  const [color, setColor] = useState<string>('')
  const [tags, setTags] = useState<string[]>([])
  const [coords, setCoords] = useState(
    seedLat !== null && seedLng !== null ? formatLatLng(seedLat, seedLng) : '',
  )
  const [elevationTyped, setElevationTyped] = useState(false)
  const position = parseLatLng(coords)
  const lat = position?.lat ?? null
  const lng = position?.lng ?? null

  // Autofill elevation from the DEM when the map is available. queryElevation
  // returns null when terrain isn't enabled or tiles haven't loaded; we leave
  // the field as it is in those cases rather than guess a value.
  useEffect(() => {
    if (!map || lat === null || lng === null || elevationTyped) return
    const elev = queryElevation(map, lat, lng)
    if (elev !== null) setElevation(String(Math.round(elev)))
  }, [map, lat, lng, elevationTyped])

  // Guard: if invariants drift, render an explanatory message rather than throw.
  // Must come after all hook calls to satisfy React's rules of hooks.
  if (panel.mode !== 'create' || panel.entityType !== 'waypoint') {
    return <div className={styles.subtle}>Waypoint placement not active.</div>
  }

  const colorOk = color === '' || isValidHex(color)
  const canSave = name.trim().length > 0 && position !== null && colorOk

  const onSave = async () => {
    if (!canSave || position === null) return
    const elevNum = elevation.trim() === '' ? null : Number(elevation)
    const elevValid = elevNum === null || Number.isFinite(elevNum)
    if (!elevValid) return
    try {
      const wp = await add({
        user_id: 'local',
        name: name.trim(),
        description,
        lat: position.lat,
        lng: position.lng,
        elevation_m: elevNum,
        category,
        color: color === '' ? null : color,
        icon,
        tags,
      })
      openEntity('waypoint', wp.id)
    } catch (err) {
      debug('waypoint create failed', err)
    }
  }

  const onCancel = () => closePanel()

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>New waypoint</h2>
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
