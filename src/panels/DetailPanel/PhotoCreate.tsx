import { useEffect, useState } from 'react'
import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { draftNumber, useUiStore } from '../../store/ui'
import { usePhotosStore } from '../../store/photos'
import { useMap } from '../../hooks/useMap'
import { useObjectUrl } from '../../hooks/useObjectUrl'
import { queryElevation } from '../../map/terrain'
import type { PendingPhoto } from '../../types'
import { isoToLocalInput } from '../../utils/time'
import { parsePhotoForm, type PhotoFormValues } from './photoForm'
import { PhotoFields } from './PhotoFields'
import { PhotoPositionFields } from './PhotoPositionFields'
import { TagPills } from './TagPills'
import { debug } from '../../utils/debug'

function initialValues(pending: PendingPhoto | null): PhotoFormValues {
  const exif = pending?.exif
  return {
    name: pending ? pending.filename.replace(/\.[^.]+$/, '') : '',
    description: '',
    bearing: exif?.bearing == null ? '' : String(exif.bearing),
    takenAt: isoToLocalInput(exif?.taken_at ?? null),
    elevation: exif?.altitude_m == null ? '' : String(Math.round(exif.altitude_m)),
  }
}

// Photo creation form. The pending photo (blobs + EXIF) rides on the create
// panel; lat/lng live in panel.draft so the draggable map pin and the
// coordinate inputs share one source of truth.
export function PhotoCreate(): JSX.Element {
  const pending = useUiStore((s) =>
    s.panel.mode === 'create' && s.panel.entityType === 'photo' ? s.panel.pending : null,
  )
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const closePanel = useUiStore((s) => s.closePanel)
  const openEntity = useUiStore((s) => s.openEntity)
  const add = usePhotosStore((s) => s.add)
  const map = useMap()

  const [values, setValues] = useState<PhotoFormValues>(() => initialValues(pending))
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const previewUrl = useObjectUrl(pending?.blob ?? null)

  // Without EXIF altitude, fall back to the terrain at the pin — once, and
  // only while the field is still blank, so user input is never overwritten.
  useEffect(() => {
    if (!map || lat === null || lng === null) return
    const elev = queryElevation(map, lat, lng)
    if (elev === null) return
    setValues((v) => (v.elevation === '' ? { ...v, elevation: String(Math.round(elev)) } : v))
  }, [map, lat, lng])

  // Guard after all hooks (rules of hooks).
  if (!pending) return <div className={styles.subtle}>Photo placement not active.</div>

  const parsed = parsePhotoForm(values)
  const canSave = parsed !== null && lat !== null && lng !== null && !saving

  const onSave = async () => {
    if (!parsed || lat === null || lng === null) return
    setSaving(true)
    setError(null)
    try {
      const photo = await add(
        {
          user_id: 'local',
          ...parsed,
          lat,
          lng,
          width: pending.width,
          height: pending.height,
          file_size_bytes: pending.blob.size,
          tags: [],
        },
        pending.blob,
        pending.thumb,
      )
      openEntity('photo', photo.id)
    } catch (err) {
      debug('photo create failed', err)
      setError('Saving the photo failed. Check available storage and try again.')
      setSaving(false)
    }
  }

  return (
    <>
      <div className={styles.header}>
        <h2 className={styles.heading}>New photo</h2>
        <div className={styles.actions}>
          <button type="button" onClick={closePanel}>Cancel</button>
          <button type="button" onClick={onSave} disabled={!canSave}>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      {previewUrl && <img src={previewUrl} alt="Photo preview" className={shared.photoPreview} />}
      {error && <p role="alert" className={styles.subtle}>{error}</p>}

      <PhotoFields values={values} onChange={(patch) => setValues((v) => ({ ...v, ...patch }))} />

      <section className={shared.section}>
        <h3>Location</h3>
        <p className={styles.subtle}>
          {pending.exif.lat !== null ? 'From the photo’s GPS.' : 'Placed on the map.'} Drag the pin to adjust.
        </p>
        <PhotoPositionFields />
      </section>

      <section className={shared.section}>
        <h3>Tags</h3>
        <TagPills tagIds={[]} />
      </section>
    </>
  )
}
