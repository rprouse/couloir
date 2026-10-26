import type { ImportSummary } from './gpxImport'

type ToastListener = (message: string | null) => void

let listener: ToastListener | null = null
let timer: ReturnType<typeof setTimeout> | null = null

export function subscribeToast(fn: ToastListener): () => void {
  listener = fn
  return () => {
    if (listener === fn) listener = null
  }
}

export function showToast(message: string, durationMs = 4000): void {
  if (!listener) return
  listener(message)
  if (timer !== null) clearTimeout(timer)
  timer = setTimeout(() => {
    if (listener) listener(null)
    timer = null
  }, durationMs)
}

export function showImportSummaryToast(
  summary: ImportSummary,
  durationMs = 4000,
): void {
  if (!listener) return
  const parts: string[] = []
  if (summary.routesImported > 0)
    parts.push(`Imported ${summary.routesImported} route${summary.routesImported === 1 ? '' : 's'}`)
  if (summary.tracksImported > 0)
    parts.push(`${summary.tracksImported} track${summary.tracksImported === 1 ? '' : 's'}`)
  if (summary.routesReplaced + summary.tracksReplaced > 0)
    parts.push(`${summary.routesReplaced + summary.tracksReplaced} replaced`)
  if (summary.duplicatesSkipped > 0)
    parts.push(
      `${summary.duplicatesSkipped} duplicate${summary.duplicatesSkipped === 1 ? '' : 's'} skipped`,
    )
  if (summary.errors.length > 0)
    parts.push(`${summary.errors.length} error${summary.errors.length === 1 ? '' : 's'}`)

  const message = parts.length > 0 ? parts.join(', ') + '.' : 'Nothing to import.'
  showToast(message, durationMs)
}
