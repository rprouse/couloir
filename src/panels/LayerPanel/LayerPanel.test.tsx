import { render, screen } from '@testing-library/react'
import { act } from 'react'
import userEvent from '@testing-library/user-event'
import { LayerPanel } from './LayerPanel'
import { useUiStore } from '../../store/ui'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import type { Photo, Route, Track } from '../../types'

const stubPrompt = async () =>
  ({ choice: 'skip' as const, applyToAll: false })

const fakeRoute = (id: string): Route => ({
  id,
  user_id: 'local',
  name: id,
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
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
})

const fakeTrack = (id: string): Track => ({
  id,
  user_id: 'local',
  name: id,
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500]] },
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
})

describe('LayerPanel', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
    useRoutesStore.setState({ routes: [], loading: false, error: null })
    useTracksStore.setState({ tracks: [], loading: false, error: null })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
    usePhotosStore.setState({ photos: [], loading: false, error: null })
  })

  it('renders an Add Photo button', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    expect(screen.getByRole('button', { name: /add photo/i })).toBeInTheDocument()
  })

  it('shows zero counts for an empty store', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    for (const label of ['Routes', 'Tracks', 'Waypoints', 'Photos']) {
      const row = screen.getByText(label).closest('[data-row]')
      expect(row?.querySelector('[data-count]')).toHaveAttribute('data-count', '0')
    }
  })

  it('reflects route and track counts from the stores', () => {
    useRoutesStore.setState({
      routes: [fakeRoute('a'), fakeRoute('b')],
      loading: false,
      error: null,
    })
    useTracksStore.setState({
      tracks: [fakeTrack('x')],
      loading: false,
      error: null,
    })
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const routesRow = screen.getByText('Routes').closest('[data-row]')
    const tracksRow = screen.getByText('Tracks').closest('[data-row]')
    expect(routesRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '2')
    expect(tracksRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '1')
  })

  it('toggles layer visibility when the switch is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    await user.click(screen.getByRole('switch', { name: 'Routes' }))
    expect(screen.getByRole('switch', { name: 'Routes' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.routes).toBe(false)
  })

  it('toggles layer visibility when the visible label is clicked', async () => {
    const user = userEvent.setup()
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    await user.click(screen.getByText('Tracks'))
    expect(screen.getByRole('switch', { name: 'Tracks' })).not.toBeChecked()
    expect(useUiStore.getState().layerVisibility.tracks).toBe(false)
  })

  it('updates the routes count when a route is added to the store after render', () => {
    const { rerender } = render(<LayerPanel promptDuplicate={stubPrompt} />)
    useRoutesStore.setState({
      routes: [fakeRoute('a')],
      loading: false,
      error: null,
    })
    rerender(<LayerPanel promptDuplicate={stubPrompt} />)
    const routesRow = screen.getByText('Routes').closest('[data-row]')
    expect(routesRow?.querySelector('[data-count]')).toHaveAttribute('data-count', '1')
  })

  it('dispatches startWaypointPlacement when the Add Waypoint button is clicked', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    act(() => {
      screen.getByRole('button', { name: /add waypoint/i }).click()
    })
    expect(useUiStore.getState().placement.mode).toBe('waypoint')
  })

  it('reflects the live waypoint count via data-count attribute', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('0')
    act(() => {
      useWaypointsStore.setState({
        waypoints: [
          {
            id: 'w1',
            user_id: 'local',
            name: 'A',
            description: '',
            lat: 49.5,
            lng: -116,
            elevation_m: 1500,
            category: 'summit',
            color: null,
            tags: [],
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    })
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
  })

  it('drops back to 0 when the last waypoint is removed', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    act(() => {
      useWaypointsStore.setState({
        waypoints: [
          {
            id: 'w1',
            user_id: 'local',
            name: 'A',
            description: '',
            lat: 0,
            lng: 0,
            elevation_m: null,
            category: 'poi',
            color: null,
            tags: [],
            created_at: '2026-01-01T00:00:00.000Z',
            updated_at: '2026-01-01T00:00:00.000Z',
          },
        ],
      })
    })
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('1')
    act(() => {
      useWaypointsStore.setState({ waypoints: [] })
    })
    expect(screen.getByText('Waypoints').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')).toBe('0')
  })

  it('tracks the live photo count on add and delete', () => {
    render(<LayerPanel promptDuplicate={stubPrompt} />)
    const count = () =>
      screen.getByText('Photos').parentElement?.querySelector('[data-count]')?.getAttribute('data-count')
    expect(count()).toBe('0')
    act(() => usePhotosStore.setState({ photos: [{ id: 'p1' } as Photo] }))
    expect(count()).toBe('1')
    act(() => usePhotosStore.setState({ photos: [] }))
    expect(count()).toBe('0')
  })
})
