import { showImportSummaryToast, subscribeToast } from './importToast'
import type { ImportSummary } from './gpxImport'

const empty = (): ImportSummary => ({
  routesImported: 0,
  tracksImported: 0,
  routesReplaced: 0,
  tracksReplaced: 0,
  duplicatesSkipped: 0,
  errors: [],
})

describe('importToast', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('summarizes a multi-outcome import', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast({
      ...empty(),
      routesImported: 2,
      tracksImported: 1,
      duplicatesSkipped: 1,
    })
    expect(messages).toEqual(['Imported 2 routes, 1 track, 1 duplicate skipped.'])
    unsub()
  })

  it('clears the toast after the duration', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast(
      { ...empty(), routesImported: 1 },
      1000,
    )
    expect(messages).toEqual(['Imported 1 route.'])
    vi.advanceTimersByTime(1500)
    expect(messages).toEqual(['Imported 1 route.', null])
    unsub()
  })

  it('reports "Nothing to import" when summary is empty', () => {
    const messages: (string | null)[] = []
    const unsub = subscribeToast((m) => messages.push(m))
    showImportSummaryToast(empty())
    expect(messages[0]).toBe('Nothing to import.')
    unsub()
  })
})
