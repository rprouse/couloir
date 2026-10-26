import { useRef } from 'react'
import { importPhotoFile, type PhotoImportOutcome } from './photoImport'
import { readPhotoExif } from '../../utils/exif'
import { encodePhoto } from '../../utils/image'
import { useUiStore } from '../../store/ui'
import { getMap } from '../../hooks/useMap'
import { showToast } from '../import/importToast'

// Zoom the map flies to for a photo with GPS — close enough to judge the
// position against terrain, without losing context if already zoomed in.
const PHOTO_FLY_ZOOM = 14

export function AddPhotoButton(): JSX.Element {
  const inputRef = useRef<HTMLInputElement | null>(null)
  return (
    <>
      <button type="button" onClick={() => inputRef.current?.click()}>
        Add Photo
      </button>
      <input
        ref={inputRef}
        type="file"
        // HEIC is listed so it isn't greyed out — picking one shows guidance.
        accept="image/jpeg,image/png,.jpg,.jpeg,.png,.heic,.heif"
        style={{ display: 'none' }}
        data-testid="add-photo-input"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Reset so picking the same file twice fires onChange again.
          e.target.value = ''
          if (file) void runPhotoImport(file)
        }}
      />
    </>
  )
}

export function runPhotoImport(file: File): Promise<PhotoImportOutcome> {
  const ui = useUiStore.getState()
  return importPhotoFile(file, {
    readExif: readPhotoExif,
    encode: encodePhoto,
    createPreviewUrl: (blob) => URL.createObjectURL(blob),
    startPhotoPlacement: ui.startPhotoPlacement,
    completePlacement: ui.completePlacement,
    flyTo: (lat, lng) => {
      const map = getMap()
      map?.flyTo({ center: [lng, lat], zoom: Math.max(map.getZoom(), PHOTO_FLY_ZOOM) })
    },
    notify: (message) => showToast(message, 8000),
  })
}
