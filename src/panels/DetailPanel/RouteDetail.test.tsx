import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import { act } from 'react'
import userEvent from '@testing-library/user-event'
import { RouteDetail } from './RouteDetail'
import { useRoutesStore } from '../../store/routes'
import { useUiStore } from '../../store/ui'
import { useTagsStore } from '../../store/tags'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'
import type { Route } from '../../types'

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't provide.
window.ResizeObserver = class ResizeObserver {
  observe() { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
}

const baseRoute: Route = {
  id: 'r1',
  user_id: 'local',
  name: 'Polar Peak',
  description: 'Classic spring line',
  geojson: {
    type: 'LineString',
    coordinates: [
      [-115, 49.5, 1800],
      [-115, 49.51, 2100],
    ],
  },
  source_hash: 'h',
  source_filename: 'polar.gpx',
  color: '#E05C2A',
  ates: 'complex',
  technical_difficulty: 'hard',
  distance_m: 4321,
  elevation_gain_m: 800,
  elevation_loss_m: 0,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
}

describe('RouteDetail', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    await storage.saveRoute(baseRoute)
    setStorage(storage)
    useRoutesStore.setState({ routes: [baseRoute], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  afterEach(() => {
    clearStorage()
  })

  it('view mode shows name, distance, ATES, technical, and source', () => {
    render(<RouteDetail routeId="r1" mode="view" />)
    expect(screen.getByText('Polar Peak')).toBeInTheDocument()
    expect(screen.getByText('4.3 km')).toBeInTheDocument()
    expect(screen.getByText('800 m')).toBeInTheDocument()
    expect(screen.getByText(/Complex/i)).toBeInTheDocument()
    expect(screen.getByText(/^Hard$/)).toBeInTheDocument()
    expect(screen.getByText('polar.gpx')).toBeInTheDocument()
  })

  it('view mode shows "Not rated" when ratings are null', () => {
    useRoutesStore.setState({
      routes: [{ ...baseRoute, ates: null, technical_difficulty: null }],
    })
    render(<RouteDetail routeId="r1" mode="view" />)
    expect(screen.getAllByText('Not rated').length).toBe(2)
  })

  it('Edit button transitions panel to edit mode', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Edit$/ }))
    expect(useUiStore.getState().panel.mode).toBe('edit')
  })

  it('edit form Save persists changes and returns to view', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Polar Peak')
    await user.clear(nameInput)
    await user.type(nameInput, 'Polar Peak West')

    await user.click(screen.getByRole('button', { name: /^Save$/ }))

    const after = useRoutesStore.getState().routes[0]
    expect(after.name).toBe('Polar Peak West')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })

  it('edit form rejects empty name', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    const nameInput = screen.getByDisplayValue('Polar Peak')
    await user.clear(nameInput)
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  it('edit form rejects invalid hex color', async () => {
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="edit" />)
    // The color row has two inputs — a `<input type="color">` and the text
    // input — both initially showing the same hex value. Browsers (and
    // jsdom) normalize the color picker's `.value` to lowercase, so the
    // displayed value `#E05C2A` is unique to the text input. Keep the
    // exact-case query and rely on jsdom's normalization to disambiguate.
    const colorTextInput = screen.getByDisplayValue('#E05C2A')
    await user.clear(colorTextInput)
    await user.type(colorTextInput, 'not-a-color')
    expect(screen.getByRole('button', { name: /^Save$/ })).toBeDisabled()
  })

  it('Delete + Confirm removes the route and closes the panel', async () => {
    useUiStore.setState({ panel: { mode: 'view', entityType: 'route', entityId: 'r1' } })
    const user = userEvent.setup()
    render(<RouteDetail routeId="r1" mode="view" />)
    await user.click(screen.getByRole('button', { name: /^Delete$/ }))
    await user.click(screen.getByRole('button', { name: /^Confirm delete$/ }))
    expect(useRoutesStore.getState().routes).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })

  it('edit assigns a tag and persists it', async () => {
    act(() => useTagsStore.setState({ tags: [{ id: 'tag1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    render(<RouteDetail routeId="r1" mode="edit" />)
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    fireEvent.click(screen.getByRole('button', { name: 'Save' }))
    await waitFor(async () => expect((await getStorage().getRoute('r1'))?.tags).toEqual(['tag1']))
  })
})
