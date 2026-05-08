import type { Route, Track } from '../../types'
import { DEFAULTS } from '../../types'
import type { ParsedGpx } from '../../utils/gpx'

export type DuplicateChoice = 'replace' | 'skip' | 'new-copy'

export interface DuplicatePromptArgs {
  filename: string
  existing: Route | Track
  parsed: ParsedGpx
  remainingFiles: number  // how many files come after this one in the drop
}

export interface DuplicateDecision {
  choice: DuplicateChoice
  applyToAll: boolean
}

export type NewRouteInput = Omit<Route, 'id' | 'created_at' | 'updated_at'>
export type NewTrackInput = Omit<Track, 'id' | 'created_at' | 'updated_at'>
export type RoutePatch = Partial<Omit<Route, 'id' | 'created_at'>>
export type TrackPatch = Partial<Omit<Track, 'id' | 'created_at'>>

export interface ImportDeps {
  parseGpx: (xml: string, filename: string) => ParsedGpx
  hashBytes: (bytes: Uint8Array) => Promise<string>
  lookupRouteByHash: (hash: string) => Promise<Route | null>
  lookupTrackByHash: (hash: string) => Promise<Track | null>
  // saveRoute/saveTrack take a "new" payload (no id/created_at/updated_at).
  // We let the store fill those in; the orchestrator stays storage-agnostic.
  saveRoute: (input: NewRouteInput) => Promise<Route>
  saveTrack: (input: NewTrackInput) => Promise<Track>
  replaceRoute: (id: string, patch: RoutePatch) => Promise<unknown>
  replaceTrack: (id: string, patch: TrackPatch) => Promise<unknown>
  promptDuplicate: (args: DuplicatePromptArgs) => Promise<DuplicateDecision>
}

export interface ImportSummary {
  routesImported: number
  tracksImported: number
  routesReplaced: number
  tracksReplaced: number
  duplicatesSkipped: number
  errors: Array<{ filename: string; error: string }>
}

// jsdom (used in tests) does not implement Blob.prototype.text /
// Blob.prototype.arrayBuffer. Use FileReader as a fallback so the orchestrator
// works in both browser and jsdom environments without modifying test setup.
function blobToText(blob: Blob): Promise<string> {
  if (typeof blob.text === 'function') return blob.text()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(reader.error)
    reader.readAsText(blob)
  })
}

function blobToArrayBuffer(blob: Blob): Promise<ArrayBuffer> {
  if (typeof blob.arrayBuffer === 'function') return blob.arrayBuffer()
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as ArrayBuffer)
    reader.onerror = () => reject(reader.error)
    reader.readAsArrayBuffer(blob)
  })
}

export async function importGpxFiles(
  files: File[],
  deps: ImportDeps,
): Promise<ImportSummary> {
  const summary: ImportSummary = {
    routesImported: 0,
    tracksImported: 0,
    routesReplaced: 0,
    tracksReplaced: 0,
    duplicatesSkipped: 0,
    errors: [],
  }

  // "Apply to all" memory: once set by the user, all remaining duplicates
  // in this same drop reuse the same choice without re-prompting.
  let stickyChoice: DuplicateChoice | null = null

  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    try {
      const xml = await blobToText(file)
      const bytes = new Uint8Array(await blobToArrayBuffer(file))
      const parsed = deps.parseGpx(xml, file.name)
      const hash = await deps.hashBytes(bytes)

      if (parsed.kind === 'route') {
        const existing = await deps.lookupRouteByHash(hash)
        if (existing) {
          const choice =
            stickyChoice ?? (await consumePrompt(existing, parsed, i))
          await applyRouteChoice(choice, existing, parsed, hash)
        } else {
          await deps.saveRoute(toRouteInput(parsed, hash))
          summary.routesImported++
        }
      } else {
        const existing = await deps.lookupTrackByHash(hash)
        if (existing) {
          const choice =
            stickyChoice ?? (await consumePrompt(existing, parsed, i))
          await applyTrackChoice(choice, existing, parsed, hash)
        } else {
          await deps.saveTrack(toTrackInput(parsed, hash))
          summary.tracksImported++
        }
      }
    } catch (err) {
      summary.errors.push({
        filename: file.name,
        error: err instanceof Error ? err.message : String(err),
      })
    }
  }

  return summary

  async function consumePrompt(
    existing: Route | Track,
    parsed: ParsedGpx,
    index: number,
  ): Promise<DuplicateChoice> {
    const decision = await deps.promptDuplicate({
      filename: parsed.source_filename,
      existing,
      parsed,
      remainingFiles: files.length - 1 - index,
    })
    if (decision.applyToAll) stickyChoice = decision.choice
    return decision.choice
  }

  async function applyRouteChoice(
    choice: DuplicateChoice,
    existing: Route,
    parsed: ParsedGpx,
    hash: string,
  ): Promise<void> {
    if (parsed.kind !== 'route') return
    if (choice === 'skip') {
      summary.duplicatesSkipped++
      return
    }
    if (choice === 'replace') {
      await deps.replaceRoute(existing.id, parsedToRoutePatch(parsed, hash))
      summary.routesReplaced++
      return
    }
    // 'new-copy'
    await deps.saveRoute(toRouteInput(parsed, hash))
    summary.routesImported++
  }

  async function applyTrackChoice(
    choice: DuplicateChoice,
    existing: Track,
    parsed: ParsedGpx,
    hash: string,
  ): Promise<void> {
    if (parsed.kind !== 'track') return
    if (choice === 'skip') {
      summary.duplicatesSkipped++
      return
    }
    if (choice === 'replace') {
      await deps.replaceTrack(existing.id, parsedToTrackPatch(parsed, hash))
      summary.tracksReplaced++
      return
    }
    await deps.saveTrack(toTrackInput(parsed, hash))
    summary.tracksImported++
  }
}

function toRouteInput(parsed: ParsedGpx, hash: string): NewRouteInput {
  if (parsed.kind !== 'route') throw new Error('toRouteInput called with non-route')
  return {
    user_id: 'local',
    name: parsed.name,
    description: parsed.description,
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    color: DEFAULTS.route.color,
    ates: null,
    technical_difficulty: null,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    tags: [],
  }
}

function toTrackInput(parsed: ParsedGpx, hash: string): NewTrackInput {
  if (parsed.kind !== 'track') throw new Error('toTrackInput called with non-track')
  return {
    user_id: 'local',
    name: parsed.name,
    description: parsed.description,
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    color: DEFAULTS.track.color,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    duration_s: parsed.duration_s,
    moving_time_s: parsed.moving_time_s,
    recorded_at: parsed.recorded_at,
    tags: [],
  }
}

function parsedToRoutePatch(parsed: ParsedGpx, hash: string): RoutePatch {
  if (parsed.kind !== 'route') return {}
  // Replace overwrites geometry/derived fields and source metadata.
  // Name, description, color, ATES, technical difficulty, and tags are
  // preserved on the existing row — the user's edits should survive a
  // re-import of the same file.
  return {
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
  }
}

function parsedToTrackPatch(parsed: ParsedGpx, hash: string): TrackPatch {
  if (parsed.kind !== 'track') return {}
  return {
    geojson: parsed.geojson,
    source_hash: hash,
    source_filename: parsed.source_filename,
    distance_m: parsed.distance_m,
    elevation_gain_m: parsed.elevation_gain_m,
    elevation_loss_m: parsed.elevation_loss_m,
    duration_s: parsed.duration_s,
    moving_time_s: parsed.moving_time_s,
    recorded_at: parsed.recorded_at,
  }
}
