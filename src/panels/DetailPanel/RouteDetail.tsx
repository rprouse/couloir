import { useState, useEffect } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { ATES_LABELS, TECHNICAL_DIFFICULTY_LABELS } from '../../types'
import type { ATES, Route, TechnicalDifficulty } from '../../types'
import { formatDistanceKm, formatElevationM, isValidHex } from '../../utils/format'
import { ElevationProfile } from '../../components/ElevationProfile/ElevationProfile'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'

interface Props {
  routeId: string
  mode: 'view' | 'edit'
}

export function RouteDetail({ routeId, mode }: Props): JSX.Element {
  const route = useRoutesStore((s) => s.routes.find((r) => r.id === routeId)) ?? null
  if (!route) {
    return <div className={styles.subtle}>Route not found.</div>
  }
  return mode === 'view' ? <RouteView route={route} /> : <RouteEdit route={route} />
}

function RouteView({ route }: { route: Route }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useRoutesStore((s) => s.remove)

  const handleDelete = async () => {
    await remove(route.id)
    closePanel()
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{route.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {route.description && (
        <p className={styles.subtle}>{route.description}</p>
      )}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Distance" value={formatDistanceKm(route.distance_m)} />
          <Metric label="Gain" value={formatElevationM(route.elevation_gain_m)} />
          <Metric label="Loss" value={formatElevationM(route.elevation_loss_m)} />
          <Metric
            label="ATES"
            value={route.ates ? ATES_LABELS[route.ates] : 'Not rated'}
          />
          <Metric
            label="Technical"
            value={
              route.technical_difficulty
                ? TECHNICAL_DIFFICULTY_LABELS[route.technical_difficulty]
                : 'Not rated'
            }
          />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Elevation profile</h3>
        <ElevationProfile geojson={route.geojson} />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={route.tags} />
      </section>

      <section className={shared.section}>
        <h3>Source</h3>
        <p className={styles.subtle}>{route.source_filename ?? 'Unknown'}</p>
      </section>
    </>
  )
}

function Metric({ label, value }: { label: string; value: string }): JSX.Element {
  return (
    <div className={shared.metric}>
      <span className={shared.metricLabel}>{label}</span>
      <span className={shared.metricValue}>{value}</span>
    </div>
  )
}

function RouteEdit({ route }: { route: Route }): JSX.Element {
  const update = useRoutesStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(route.name)
  const [description, setDescription] = useState(route.description)
  const [color, setColor] = useState(route.color.toLowerCase())
  const [ates, setAtes] = useState<ATES | ''>(route.ates ?? '')
  const [tech, setTech] = useState<TechnicalDifficulty | ''>(route.technical_difficulty ?? '')

  // Reload local state if the underlying route is replaced (e.g. duplicate
  // import re-applied). Keying on id+updated_at makes this exact.
  useEffect(() => {
    setName(route.name)
    setDescription(route.description)
    setColor(route.color.toLowerCase())
    setAtes(route.ates ?? '')
    setTech(route.technical_difficulty ?? '')
  }, [route.id, route.updated_at])

  const colorOk = isValidHex(color)
  const canSave = name.trim().length > 0 && colorOk

  const onSave = async () => {
    if (!canSave) return
    await update(route.id, {
      name: name.trim(),
      description,
      color,
      ates: ates === '' ? null : ates,
      technical_difficulty: tech === '' ? null : tech,
    })
    openEntity('route', route.id)
  }

  const onCancel = () => openEntity('route', route.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit route</h2>
        <div className={styles.actions}>
          <button type="button" onClick={onCancel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            Save
          </button>
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
          <span>Color</span>
          <div className={shared.row}>
            <input
              type="color"
              value={color}
              onChange={(e) => setColor(e.target.value)}
            />
            <input
              value={color}
              onChange={(e) => setColor(e.target.value)}
              aria-invalid={!colorOk}
            />
          </div>
          {!colorOk && (
            <span className={styles.subtle}>Use #RRGGBB hex.</span>
          )}
        </label>
        <label className={shared.field}>
          <span>ATES</span>
          <select value={ates} onChange={(e) => setAtes(e.target.value as ATES | '')}>
            <option value="">— not rated</option>
            {(Object.keys(ATES_LABELS) as ATES[]).map((k) => (
              <option key={k} value={k}>{ATES_LABELS[k]}</option>
            ))}
          </select>
        </label>
        <label className={shared.field}>
          <span>Technical difficulty</span>
          <select value={tech} onChange={(e) => setTech(e.target.value as TechnicalDifficulty | '')}>
            <option value="">— not rated</option>
            {(Object.keys(TECHNICAL_DIFFICULTY_LABELS) as TechnicalDifficulty[]).map((k) => (
              <option key={k} value={k}>{TECHNICAL_DIFFICULTY_LABELS[k]}</option>
            ))}
          </select>
        </label>
      </section>
    </>
  )
}
