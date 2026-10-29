import type { AtesArea } from '../../types'
import type { StorageProvider } from '../../storage/interface'
import { parseAtesKml, readKmz } from '../../utils/atesKml'
import { newId } from '../../utils/id'
import { now } from '../../utils/time'

export interface AtesImportResult {
  area: AtesArea
  replaced: boolean   // an area with the same name already existed
  skipped: number     // zones/lines with no recognisable ATES class
}

/**
 * Import one Avalanche Canada ATES KMZ. Re-importing an area (same name,
 * ignoring case) replaces its geometry in place, keeping its id and first
 * import date: Avalanche Canada revises ratings, and a fresh download should
 * update the area rather than duplicate it. Throws AtesImportError for files
 * that aren't ATES KMZs.
 */
export async function importAtesKmz(storage: StorageProvider, file: File): Promise<AtesImportResult> {
  const bytes = new Uint8Array(await file.arrayBuffer())
  const parsed = parseAtesKml(readKmz(bytes), file.name)

  const existing = (await storage.getAtesAreas()).find(
    (a) => a.name.toLowerCase() === parsed.name.toLowerCase(),
  )
  const ts = now()
  const area: AtesArea = {
    id: existing?.id ?? newId(),
    name: parsed.name,
    source_filename: file.name,
    geojson: { type: 'FeatureCollection', features: parsed.features },
    imported_at: existing?.imported_at ?? ts,
    updated_at: ts,
  }
  await storage.saveAtesArea(area)
  return { area, replaced: existing !== undefined, skipped: parsed.skipped }
}
