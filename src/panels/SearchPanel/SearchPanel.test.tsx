import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { SearchPanel } from './SearchPanel'
import { useRoutesStore } from '../../store/routes'
import { useWaypointsStore } from '../../store/waypoints'
import { useUiStore } from '../../store/ui'
import { setMap } from '../../hooks/useMap'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import type { Route, Waypoint } from '../../types'

describe('SearchPanel', () => {
  let map: InstanceType<typeof __mocks__.MockMap>
  beforeEach(() => {
    map = new __mocks__.MockMap()
    act(() => {
      setMap(map as never)
      useRoutesStore.setState({ routes: [{
        id: 'r1', name: 'Lone Tree Couloir', description: '', tags: [],
        geojson: { type: 'LineString', coordinates: [[-116, 49.5, 0], [-115.9, 49.6, 0]] },
      } as unknown as Route] })
      useWaypointsStore.setState({ waypoints: [{ id: 'w1', name: 'Lone Tree gate', description: '', lat: 49.5, lng: -116, tags: [] } as unknown as Waypoint] })
      useUiStore.setState({ panel: { mode: 'idle' }, layerVisibility: { routes: false, tracks: true, waypoints: true, photos: true } })
    })
  })
  afterEach(() => act(() => setMap(null)))

  it('shows a hint before typing', () => {
    render(<SearchPanel />)
    expect(screen.getByText(/search names and descriptions/i)).toBeInTheDocument()
  })

  it('groups results by type', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'lone' } })
    expect(screen.getByRole('heading', { name: 'Routes (1)' })).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: 'Waypoints (1)' })).toBeInTheDocument()
    expect(screen.queryByRole('heading', { name: /Tracks/ })).toBeNull()
  })

  it('shows an empty state when nothing matches', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'zzz' } })
    expect(screen.getByText('No matches for “zzz”.')).toBeInTheDocument()
  })

  it('clicking a result shows its layer, frames it, and opens it', () => {
    render(<SearchPanel />)
    fireEvent.change(screen.getByRole('searchbox'), { target: { value: 'couloir' } })
    fireEvent.click(screen.getByRole('button', { name: /Lone Tree Couloir/ }))
    expect(useUiStore.getState().layerVisibility.routes).toBe(true)
    expect(map.fitBounds).toHaveBeenCalled()
    expect(useUiStore.getState().panel).toEqual({ mode: 'view', entityType: 'route', entityId: 'r1' })
  })
})
