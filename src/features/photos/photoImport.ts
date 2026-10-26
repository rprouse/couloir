import type { PendingPhoto, PhotoExif } from '../../types'
import type { EncodedPhoto } from '../../utils/image'
import { debug } from '../../utils/debug'

export type PhotoFileKind = 'jpeg' | 'png' | 'heic' | 'unsupported'

export const HEIC_MESSAGE =
  'HEIC is not supported. On iPhone: Settings → Camera → Formats → Most Compatible.'
export const UNSUPPORTED_MESSAGE = 'Only JPEG and PNG photos can be imported.'

// MIME type is often empty for HEIC on Windows, so the extension is checked too.
export function classifyPhotoFile(file: Pick<File, 'name' | 'type'>): PhotoFileKind {
  const type = file.type.toLowerCase()
  const ext = file.name.toLowerCase().split('.').pop() ?? ''
  if (type === 'image/heic' || type === 'image/heif' || ext === 'heic' || ext === 'heif') return 'heic'
  if (type === 'image/jpeg' || ext === 'jpg' || ext === 'jpeg') return 'jpeg'
  if (type === 'image/png' || ext === 'png') return 'png'
  return 'unsupported'
}

export interface PhotoImportDeps {
  readExif: (file: Blob) => Promise<PhotoExif>
  encode: (file: Blob) => Promise<EncodedPhoto>
  createPreviewUrl: (blob: Blob) => string
  startPhotoPlacement: (pending: PendingPhoto) => void
  completePlacement: (lat: number, lng: number) => void
  flyTo: (lat: number, lng: number) => void
  notify: (message: string) => void
}

export type PhotoImportOutcome = 'rejected' | 'failed' | 'placed' | 'awaiting-click'

export async function importPhotoFile(
  file: File,
  deps: PhotoImportDeps,
): Promise<PhotoImportOutcome> {
  const kind = classifyPhotoFile(file)
  if (kind === 'heic') {
    deps.notify(HEIC_MESSAGE)
    return 'rejected'
  }
  if (kind === 'unsupported') {
    deps.notify(UNSUPPORTED_MESSAGE)
    return 'rejected'
  }

  let exif: PhotoExif
  let encoded: EncodedPhoto
  try {
    // EXIF must be read from the original — the re-encoded JPEG has none.
    ;[exif, encoded] = await Promise.all([deps.readExif(file), deps.encode(file)])
  } catch (err) {
    debug('photo import failed', err)
    deps.notify(`Couldn't read ${file.name}.`)
    return 'failed'
  }

  deps.startPhotoPlacement({
    ...encoded,
    preview: deps.createPreviewUrl(encoded.thumb),
    filename: file.name,
    exif,
  })

  if (exif.lat !== null && exif.lng !== null) {
    deps.flyTo(exif.lat, exif.lng)
    deps.completePlacement(exif.lat, exif.lng)
    return 'placed'
  }
  return 'awaiting-click'
}
