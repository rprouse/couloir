import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { usePhotosStore } from '../../store/photos'
import { draftNumber, useUiStore } from '../../store/ui'
import { usePhotoBlobUrl } from '../../hooks/usePhotoBlobUrl'
import type { Photo } from '../../types'
import { formatBearing, formatDateTime, formatElevationM } from '../../utils/format'
import { CompassRose } from '../../components/CompassRose/CompassRose'
import { parsePhotoForm, valuesFromPhoto, type PhotoFormValues } from './photoForm'
import { PhotoFields } from './PhotoFields'
import { PhotoPositionFields } from './PhotoPositionFields'
import { TagPills } from './TagPills'
import { ConfirmDelete } from './ConfirmDelete'
import { Metric } from './Metric'
import { debug } from '../../utils/debug'

interface Props {
  photoId: string
  mode: 'view' | 'edit'
}

export function PhotoDetail({ photoId, mode }: Props): JSX.Element {
  const photo = usePhotosStore((s) => s.photos.find((p) => p.id === photoId)) ?? null
  if (!photo) return <div className={styles.subtle}>Photo not found.</div>
  return mode === 'view' ? <PhotoView photo={photo} /> : <PhotoEdit photo={photo} />
}

// Full image, fit to the panel width; click to toggle actual size, in which
// case the frame scrolls.
function PhotoImage({ photo }: { photo: Photo }): JSX.Element {
  const { url, status } = usePhotoBlobUrl(photo.id)
  const [actualSize, setActualSize] = useState(false)

  if (status === 'loading') {
    return (
      <div className={shared.photoFrame}>
        <span className={`${styles.subtle} ${shared.photoStatus}`}>Loading photo…</span>
      </div>
    )
  }
  if (!url) {
    return (
      <div className={shared.photoFrame}>
        <span className={`${styles.subtle} ${shared.photoStatus}`}>The photo file is missing.</span>
      </div>
    )
  }
  return (
    <div className={shared.photoFrame}>
      <img
        src={url}
        alt={photo.name}
        className={actualSize ? shared.photoActual : shared.photoFit}
        title={actualSize ? 'Click to fit' : 'Click for full size'}
        onClick={() => setActualSize((v) => !v)}
      />
    </div>
  )
}

function PhotoView({ photo }: { photo: Photo }): JSX.Element {
  const editCurrent = useUiStore((s) => s.editCurrent)
  const closePanel = useUiStore((s) => s.closePanel)
  const remove = usePhotosStore((s) => s.remove)

  const handleDelete = async () => {
    try {
      await remove(photo.id)
      closePanel()
    } catch (err) {
      // Phase 6 will replace this with a user-visible error surface.
      debug('photo delete failed', err)
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>{photo.name}</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => editCurrent({ lat: photo.lat, lng: photo.lng })}>Edit</button>
          <ConfirmDelete onConfirm={handleDelete} />
        </div>
      </div>

      <PhotoImage photo={photo} />

      {photo.description && <p className={styles.subtle}>{photo.description}</p>}

      <section className={shared.section}>
        <div className={shared.row}>
          <div className={`${shared.metricsGrid} ${shared.grow}`}>
            <Metric label="Taken" value={photo.taken_at ? formatDateTime(photo.taken_at) : '—'} />
            <Metric label="Elevation" value={photo.elevation_m === null ? '—' : formatElevationM(photo.elevation_m)} />
            <Metric label="Bearing" value={photo.bearing === null ? '—' : formatBearing(photo.bearing)} />
            <Metric label="Size" value={`${photo.width} × ${photo.height}`} />
          </div>
          {photo.bearing !== null && <CompassRose bearing={photo.bearing} size={64} />}
        </div>
      </section>

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>
          {photo.lat.toFixed(5)}, {photo.lng.toFixed(5)}
        </p>
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={photo.tags} />
      </section>
    </>
  )
}

function PhotoEdit({ photo }: { photo: Photo }): JSX.Element {
  const update = usePhotosStore((s) => s.update)
  const openEntity = useUiStore((s) => s.openEntity)
  const updateDraft = useUiStore((s) => s.updateDraft)
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))

  const [values, setValues] = useState<PhotoFormValues>(() => valuesFromPhoto(photo))
  const [error, setError] = useState<string | null>(null)

  // Re-sync if the photo is replaced upstream (e.g. a future sync arrival).
  useEffect(() => setValues(valuesFromPhoto(photo)), [photo.id, photo.updated_at])

  // Edit entered without a seeded position (e.g. a direct editCurrent()):
  // seed it so the pin and inputs have something to show.
  useEffect(() => {
    if (lat === null || lng === null) updateDraft({ lat: photo.lat, lng: photo.lng })
  }, [lat, lng, photo.lat, photo.lng, updateDraft])

  const parsed = parsePhotoForm(values)
  const canSave = parsed !== null && lat !== null && lng !== null

  const onSave = async () => {
    if (!parsed || lat === null || lng === null) return
    setError(null)
    try {
      await update(photo.id, { ...parsed, lat, lng })
      openEntity('photo', photo.id)
    } catch (err) {
      debug('photo save failed', err)
      setError('Saving changes failed. Try again.')
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>Edit photo</h2>
        <div className={styles.actions}>
          <button type="button" onClick={() => openEntity('photo', photo.id)}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>Save</button>
        </div>
      </div>

      {error && <p role="alert" className={styles.subtle}>{error}</p>}

      <PhotoFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>Drag the pin on the map or type coordinates.</p>
        <PhotoPositionFields />
      </section>
    </>
  )
}
