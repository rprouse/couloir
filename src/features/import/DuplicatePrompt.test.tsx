import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { DuplicatePrompt, type DuplicatePromptHandle } from './DuplicatePrompt'
import type { DuplicateDecision, DuplicatePromptArgs } from './gpxImport'
import type { Route } from '../../types'

const fakeRoute: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'Existing Route',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
  source_hash: 'h',
  source_filename: 'a.gpx',
  color: '#E05C2A',
  ates: null,
  technical_difficulty: null,
  distance_m: 0,
  elevation_gain_m: 0,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

const args = (overrides: Partial<DuplicatePromptArgs> = {}): DuplicatePromptArgs => ({
  filename: 'a.gpx',
  existing: fakeRoute,
  parsed: {
    kind: 'route',
    name: 'New Route',
    description: '',
    geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
    distance_m: 0,
    elevation_gain_m: 0,
    elevation_loss_m: 0,
    source_filename: 'a.gpx',
  },
  remainingFiles: 0,
  ...overrides,
})

describe('DuplicatePrompt', () => {
  it('exposes enqueue via onReady, then shows the modal when called', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    // onReady fires after first effect commit; microtask flush is enough.
    await Promise.resolve()
    expect(handle).not.toBeNull()

    let resolved: DuplicateDecision | null = null
    act(() => {
      handle!.enqueue(args()).then((d) => { resolved = d })
    })
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    expect(screen.getByText(/Existing Route/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(resolved).toEqual({ choice: 'skip', applyToAll: false })
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('hides the apply-to-all checkbox when remainingFiles is 0', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()
    act(() => { void handle!.enqueue(args({ remainingFiles: 0 })) })
    expect(screen.queryByLabelText(/apply to all/i)).toBeNull()
  })

  it('reports applyToAll: true when the checkbox is ticked', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()

    let resolved: DuplicateDecision | null = null
    act(() => {
      handle!.enqueue(args({ remainingFiles: 5 })).then((d) => { resolved = d })
    })

    const user = userEvent.setup()
    await user.click(screen.getByRole('checkbox'))
    await user.click(screen.getByRole('button', { name: /Replace/ }))
    await Promise.resolve()
    expect(resolved).toEqual({ choice: 'replace', applyToAll: true })
  })

  it('queues multiple prompts and resolves them in order', async () => {
    let handle: DuplicatePromptHandle | null = null
    render(<DuplicatePrompt onReady={(h) => { handle = h }} />)
    await Promise.resolve()

    const decisions: DuplicateDecision[] = []
    act(() => {
      handle!.enqueue(args({ filename: 'first.gpx' })).then((d) => decisions.push(d))
      handle!.enqueue(args({ filename: 'second.gpx' })).then((d) => decisions.push(d))
    })
    expect(screen.getByText(/first.gpx/)).toBeInTheDocument()

    const user = userEvent.setup()
    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(screen.getByText(/second.gpx/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /^Skip$/ }))
    await Promise.resolve()
    expect(decisions).toHaveLength(2)
  })
})
