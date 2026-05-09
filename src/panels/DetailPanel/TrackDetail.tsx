import { useState, useEffect } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { useTracksStore } from '../../store/tracks'
import { useUiStore } from '../../store/ui'
import type { Track } from '../../types'
import {
  formatDistanceKm,
  formatDuration,
  formatElevationM,
  isValidHex,
} from '../../utils/format'
import { ElevationProfile } from '../../components/ElevationProfile/ElevationProfile'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'

interface Props {
  trackId: string
  mode: 'view' | 'edit'
}

export function TrackDetail({ trackId, mode }: Props): JSX.Element {
  const track = useTracksStore((s) => s.tracks.find((t) => t.id === trackId)) ?? null
  if (!track) return <div className={styles.subtle}>Track not found.</div>
  return mode === 'view' ? <TrackView track={track} /> : <TrackEdit track={track} />
}

function TrackView({ track }: { track: Track }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = useTracksStore((s) => s.remove)

  const handleDelete = async () => {
    try {
      await remove(track.id)
      closePanel()
    } catch (err) {
      // Error UI lands later (Phase 6 toast/error infrastructure). Log
      // for now so a stale UI race or storage hiccup doesn't surface as
      // an unhandled rejection.
      debug('track delete failed', err)
    }
  }

  // recorded_at is a UTC ISO-8601 string. We render the locale-default date
  // because Couloir is single-user and the user's machine timezone is the
  // right reference point — no need to normalise to UTC for display.
  const recordedAt = track.recorded_at
    ? new Date(track.recorded_at).toLocaleDateString()
    : '—'

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{track.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent()}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      {track.description && (
        <p className={styles.subtle}>{track.description}</p>
      )}

      <section className={shared.section}>
        <div className={shared.metricsGrid}>
          <Metric label="Date" value={recordedAt} />
          <Metric label="Distance" value={formatDistanceKm(track.distance_m)} />
          <Metric label="Gain" value={formatElevationM(track.elevation_gain_m)} />
          <Metric label="Loss" value={formatElevationM(track.elevation_loss_m)} />
        </div>
        <div className={shared.row}>
          <Metric label="Total" value={formatDuration(track.duration_s)} />
          <Metric label="Moving" value={formatDuration(track.moving_time_s)} />
        </div>
      </section>

      <section className={shared.section}>
        <h3>Elevation profile</h3>
        <ElevationProfile geojson={track.geojson} />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={track.tags} />
      </section>

      <section className={shared.section}>
        <h3>Source</h3>
        <p className={styles.subtle}>{track.source_filename ?? 'Unknown'}</p>
      </section>
    </>
  )
}

function TrackEdit({ track }: { track: Track }): JSX.Element {
  const update = useTracksStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)

  const [name, setName] = useState(track.name)
  const [description, setDescription] = useState(track.description)
  const [color, setColor] = useState(track.color)

  // Reload local state if the underlying track is replaced (duplicate import
  // re-applied). Keying on id+updated_at re-syncs only on identity change,
  // not on every Zustand re-render.
  useEffect(() => {
    setName(track.name)
    setDescription(track.description)
    setColor(track.color)
  }, [track.id, track.updated_at])

  const colorOk = isValidHex(color)
  const canSave = name.trim().length > 0 && colorOk

  const onSave = async () => {
    if (!canSave) return
    try {
      await update(track.id, { name: name.trim(), description, color })
      openEntity('track', track.id)
    } catch (err) {
      debug('track save failed', err)
    }
  }
  const onCancel = () => openEntity('track', track.id)

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit track</h2>
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
          {!colorOk && <span className={styles.subtle}>Use #RRGGBB hex.</span>}
        </label>
      </section>
    </>
  )
}
