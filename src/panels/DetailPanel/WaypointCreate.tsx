import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { useMap } from '../../hooks/useMap'
import { queryElevation } from '../../map/terrain'
import { WAYPOINT_CATEGORIES } from '../../types'
import type { WaypointCategory } from '../../types'
import { TagPills } from './TagPills'
import { debug } from '../../utils/debug'

// Waypoint creation form. Reads the seeded lat/lng from panel.draft (set by
// completePlacement); owns name/description/category/elevation as local state.
// Elevation is autofilled from queryTerrainElevation when the DEM is loaded;
// otherwise the field is left blank for the user to enter (or leave null).
// Tag *editing* lands in Phase 6.1 — for now we render an empty TagPills
// placeholder so the section structure matches the view panel.
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

  // Autofill elevation from the DEM when the map is available. queryTerrain-
  // Elevation returns null when terrain isn't enabled or tiles haven't loaded;
  // we leave the field blank in those cases rather than guess a value.
  useEffect(() => {
    if (!map || seedLat === null || seedLng === null) return
    const elev = queryElevation(map, seedLat, seedLng)
    if (elev !== null) setElevation(String(Math.round(elev)))
  }, [map, seedLat, seedLng])

  // Guard: if invariants drift, render an explanatory message rather than throw.
  // Must come after all hook calls to satisfy React's rules of hooks.
  if (panel.mode !== 'create' || panel.entityType !== 'waypoint') {
    return <div className={styles.subtle}>Waypoint placement not active.</div>
  }

  const canSave = name.trim().length > 0 && seedLat !== null && seedLng !== null

  const onSave = async () => {
    if (!canSave || seedLat === null || seedLng === null) return
    const elevNum = elevation.trim() === '' ? null : Number(elevation)
    const elevValid = elevNum === null || Number.isFinite(elevNum)
    if (!elevValid) return
    try {
      const wp = await add({
        user_id: 'local',
        name: name.trim(),
        description,
        lat: seedLat,
        lng: seedLng,
        elevation_m: elevNum,
        category,
        color: null,
        tags: [],
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
            onChange={(e) => setElevation(e.target.value)}
            placeholder="optional"
          />
        </label>
      </section>

      <section className={shared.section}>
        <h3>Coordinates</h3>
        <p className={styles.subtle}>
          {seedLat !== null && seedLng !== null
            ? `${seedLat.toFixed(5)}, ${seedLng.toFixed(5)}`
            : '—'}
        </p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={[]} />
      </section>
    </>
  )
}
