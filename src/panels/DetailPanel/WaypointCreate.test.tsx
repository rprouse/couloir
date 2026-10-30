import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { useTagsStore } from '../../store/tags'
import { setStorage } from '../../storage/provider'
import { InMemoryStorageProvider } from '../../storage/memory'
import { WaypointCreate } from './WaypointCreate'

function reset() {
  act(() => {
    setStorage(new InMemoryStorageProvider())
    useUiStore.setState({
      panel: { mode: 'create', entityType: 'waypoint', draft: { lat: 49.5, lng: -116 } },
      placement: { mode: 'idle' },
    })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
  })
}

describe('WaypointCreate', () => {
  beforeEach(reset)

  it('disables Save until the name field has non-whitespace content', () => {
    render(<WaypointCreate />)
    const save = screen.getByRole('button', { name: /save/i })
    expect(save).toBeDisabled()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    expect(save).not.toBeDisabled()
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '   ' } })
    expect(save).toBeDisabled()
  })

  it('saves a waypoint with the seeded lat/lng and selected category', async () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    fireEvent.change(screen.getByLabelText('Category'), { target: { value: 'summit' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(useWaypointsStore.getState().waypoints).toHaveLength(1)
    })
    const stored = useWaypointsStore.getState().waypoints
    expect(stored[0].name).toBe('Summit Hut')
    expect(stored[0].category).toBe('summit')
    expect(stored[0].lat).toBe(49.5)
    expect(stored[0].lng).toBe(-116)
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityType: 'waypoint',
      entityId: stored[0].id,
    })
  })

  it('saves pasted coordinates in place of the placed position', async () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Col' } })
    fireEvent.change(screen.getByLabelText(/coordinates/i), { target: { value: '50.25° N, 115.75° W' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(useWaypointsStore.getState().waypoints).toHaveLength(1))
    expect(useWaypointsStore.getState().waypoints[0]).toMatchObject({ lat: 50.25, lng: -115.75 })
  })

  it('saves the picked icon and colour', async () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Elk Lakes Cabin' } })
    fireEvent.click(screen.getByRole('radio', { name: 'Cabin' }))
    fireEvent.click(screen.getByRole('radio', { name: '#14B8A6' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(useWaypointsStore.getState().waypoints).toHaveLength(1))
    expect(useWaypointsStore.getState().waypoints[0]).toMatchObject({ icon: 'cabin', color: '#14B8A6' })
  })

  it('saves no overrides when the defaults are kept', async () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(useWaypointsStore.getState().waypoints).toHaveLength(1))
    expect(useWaypointsStore.getState().waypoints[0]).toMatchObject({ icon: null, color: null })
  })

  it('disables Save while the custom colour is not a valid hex', () => {
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    fireEvent.change(screen.getByLabelText('Hex colour'), { target: { value: '#12' } })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('returns the panel to idle on Cancel without writing to storage', () => {
    render(<WaypointCreate />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useWaypointsStore.getState().waypoints).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })

  it('saves the picked tags with the new waypoint', async () => {
    act(() => useTagsStore.setState({ tags: [{ id: 'tag1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    render(<WaypointCreate />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Summit Hut' } })
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => expect(useWaypointsStore.getState().waypoints).toHaveLength(1))
    expect(useWaypointsStore.getState().waypoints[0].tags).toEqual(['tag1'])
  })
})
