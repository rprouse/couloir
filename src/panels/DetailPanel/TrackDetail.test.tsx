import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TrackDetail } from './TrackDetail'

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't provide.
window.ResizeObserver = class ResizeObserver {
  observe() { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
}
import { useTracksStore } from '../../store/tracks'
import { useTagsStore } from '../../store/tags'
import { useUiStore } from '../../store/ui'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Track } from '../../types'

const baseTrack: Track = {
  id: 't1',
  user_id: 'local',
  name: 'Tour A',
  description: '',
  geojson: {
    type: 'LineString',
    coordinates: [
      [-116, 49.5, 1500],
      [-116, 49.51, 1510],
    ],
  },
  source_hash: 'h',
  source_filename: 'tour.gpx',
  color: '#2A7BE0',
  distance_m: 12_345,
  elevation_gain_m: 800,
  elevation_loss_m: 800,
  duration_s: 22_320, // 6h 12m
  moving_time_s: 17_220, // 4h 47m
  recorded_at: '2026-03-15T15:00:00.000Z',
  tags: [],
  created_at: '2026-03-15T20:00:00.000Z',
  updated_at: '2026-03-15T20:00:00.000Z',
}

describe('TrackDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    await storage.saveTrack(baseTrack)
    setStorage(storage)
    useTracksStore.setState({ tracks: [baseTrack], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('renders total and moving times as separate values', () => {
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.getByText('6h 12m')).toBeInTheDocument()
    expect(screen.getByText('4h 47m')).toBeInTheDocument()
  })

  it('renders em-dash for both time fields when timestamps are absent', () => {
    useTracksStore.setState({
      tracks: [{ ...baseTrack, duration_s: null, moving_time_s: null, recorded_at: null }],
    })
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2)
  })

  it('does not show ATES or technical difficulty fields', () => {
    render(<TrackDetail trackId="t1" mode="view" />)
    expect(screen.queryByText(/ATES/i)).toBeNull()
    expect(screen.queryByText(/Technical/i)).toBeNull()
  })

  it('Edit form Save updates name and color', async () => {
    const user = userEvent.setup()
    render(<TrackDetail trackId="t1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Tour A')
    await user.clear(nameInput)
    await user.type(nameInput, 'Tour A v2')
    await user.click(screen.getByRole('button', { name: /^Save$/ }))
    expect(useTracksStore.getState().tracks[0].name).toBe('Tour A v2')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })

  it('Delete + Confirm removes the track and closes the panel', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'track', entityId: 't1' } })
    const user = userEvent.setup()
    render(<TrackDetail trackId="t1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Delete$/ }))
    await user.click(screen.getByRole('button', { name: /^Confirm delete$/ }))
    expect(useTracksStore.getState().tracks).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
