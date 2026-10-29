import type { ExportBundle } from '../../types'
import type { ParsedBackup } from './readBackup'

export interface PreparedImport {
  bundle: ExportBundle
  photos: Map<string, Blob>
  thumbs: Map<string, Blob>
  regeneratedThumbs: number
  droppedPhotos: number
}

// Makes a parsed backup safe to hand to importAll: photos without a full-size
// image are dropped (with their tag rows); missing thumbnails are rebuilt.
export async function prepareImport(
  parsed: ParsedBackup,
  makeThumbnail: (full: Blob) => Promise<Blob>,
): Promise<PreparedImport> {
  const { bundle, photos } = parsed
  const thumbs = new Map(parsed.thumbs)
  const kept = bundle.photos.filter((p) => photos.has(p.id))
  const keptIds = new Set(kept.map((p) => p.id))
  let regeneratedThumbs = 0
  for (const p of kept) {
    if (thumbs.has(p.id)) continue
    thumbs.set(p.id, await makeThumbnail(photos.get(p.id)!))
    regeneratedThumbs++
  }
  return {
    bundle: {
      ...bundle,
      photos: kept,
      entity_tags: bundle.entity_tags.filter((r) => r.entity_type !== 'photo' || keptIds.has(r.entity_id)),
    },
    photos,
    thumbs,
    regeneratedThumbs,
    droppedPhotos: bundle.photos.length - kept.length,
  }
}

export function summarizeBundle(b: ExportBundle): string {
  const part = (n: number, one: string) => `${n} ${one}${n === 1 ? '' : 's'}`
  return [
    part(b.routes.length, 'route'), part(b.tracks.length, 'track'),
    part(b.waypoints.length, 'waypoint'), part(b.photos.length, 'photo'), part(b.tags.length, 'tag'),
    ...(b.ates_areas?.length ? [part(b.ates_areas.length, 'ATES area')] : []),
  ].join(', ')
}
