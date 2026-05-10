import { render, screen } from '@testing-library/react'
import { DetailPanel } from './DetailPanel'
import { useUiStore } from '../../store/ui'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage } from '../../storage/provider'
import type { Route } from '../../types'

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't provide.
window.ResizeObserver = class ResizeObserver {
  observe() { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
}

const route: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'X',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
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

describe('DetailPanel', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useRoutesStore.setState({ routes: [route], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('renders nothing when idle', () => {
    const { container } = render(<DetailPanel />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the RouteDetail view when panel.entityType is route', () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    render(<DetailPanel />)
    // There's only one <aside role="complementary"> in this isolated test
    // (no Sidebar mounted), so getByRole is unambiguous.
    expect(screen.getByRole('complementary')).toBeInTheDocument()
    expect(screen.getByText('X')).toBeInTheDocument()
  })

  it('renders TrackDetail when entityType is track', () => {
    useTracksStore.setState({
      tracks: [{
        id: 't1',
        user_id: 'local',
        name: 'A track',
        description: '',
        geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
        source_hash: 'h',
        source_filename: null,
        color: '#2A7BE0',
        distance_m: 0,
        elevation_gain_m: 0,
        elevation_loss_m: 0,
        duration_s: null,
        moving_time_s: null,
        recorded_at: null,
        tags: [],
        created_at: '2026-01-01T00:00:00.000Z',
        updated_at: '2026-01-01T00:00:00.000Z',
      }],
      loading: false,
      error: null,
    })
    useUiStore.setState({ panel: { mode: 'view', entityType: 'track', entityId: 't1' } })
    render(<DetailPanel />)
    expect(screen.getByText('A track')).toBeInTheDocument()
  })
})
