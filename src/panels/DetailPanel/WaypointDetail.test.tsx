import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { useTagsStore } from '../../store/tags'
import { setStorage, getStorage } from '../../storage/provider'
import { InMemoryStorageProvider } from '../../storage/memory'
import { WaypointDetail } from './WaypointDetail'
import type { Waypoint } from '../../types'

const sample = (over: Partial<Waypoint> = {}): Waypoint => ({
  id: 'w1',
  user_id: 'local',
  name: 'Summit Hut',
  description: 'Aid station.',
  lat: 49.5,
  lng: -116,
  elevation_m: 2400,
  category: 'summit',
  color: null,
  icon: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

function setup(wp: Waypoint = sample()) {
  act(() => {
    setStorage(new InMemoryStorageProvider())
    useUiStore.setState({ panel: { mode: 'view', entityType: 'waypoint', entityId: wp.id } })
    useWaypointsStore.setState({ waypoints: [wp], loading: false, error: null })
    useTagsStore.setState({ tags: [], loading: false, error: null })
  })
}

describe('WaypointDetail (view)', () => {
  beforeEach(() => setup())

  it('renders name, category label, and elevation', () => {
    render(<WaypointDetail waypointId="w1" mode="view" />)
    expect(screen.getByRole('heading', { name: 'Summit Hut' })).toBeInTheDocument()
    expect(screen.getAllByText(/Summit/).length).toBeGreaterThanOrEqual(1) // category label
    expect(screen.getByText(/2400 m/)).toBeInTheDocument()       // elevation
    expect(screen.getByText(/49\.50000, -116\.00000/)).toBeInTheDocument()
  })

  it('shows the waypoint marker next to the name', () => {
    setup(sample({ icon: 'cabin' }))
    render(<WaypointDetail waypointId="w1" mode="view" />)
    expect(screen.getByRole('img', { name: 'Cabin' })).toBeInTheDocument()
  })

  it('renders "—" for null elevation', () => {
    setup(sample({ elevation_m: null }))
    render(<WaypointDetail waypointId="w1" mode="view" />)
    expect(screen.getByText('Elevation').nextSibling?.textContent).toBe('—')
  })

  it('renders "Waypoint not found." if the id is missing from the store', () => {
    render(<WaypointDetail waypointId="missing" mode="view" />)
    expect(screen.getByText(/not found/i)).toBeInTheDocument()
  })
})

describe('WaypointDetail (edit)', () => {
  beforeEach(() => setup())

  it('saves changes via the store and returns to view', async () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Renamed' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(useWaypointsStore.getState().waypoints[0].name).toBe('Renamed')
    })
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityType: 'waypoint',
      entityId: 'w1',
    })
  })

  it('moves the waypoint to pasted coordinates', async () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    const coords = screen.getByLabelText(/coordinates/i)
    expect(coords).toHaveValue('49.500000, -116.000000')
    fireEvent.change(coords, { target: { value: '50.1234, -115.5678' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(() => {
      expect(useWaypointsStore.getState().waypoints[0]).toMatchObject({ lat: 50.1234, lng: -115.5678 })
    })
  })

  it('disables Save when the coordinates do not parse', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/coordinates/i), { target: { value: '50.1234' } })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('Cancel returns to view without writing', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: 'Discarded' } })
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useWaypointsStore.getState().waypoints[0].name).toBe('Summit Hut')
    expect(useUiStore.getState().panel).toMatchObject({
      mode: 'view',
      entityId: 'w1',
    })
  })

  it('disables Save when name is whitespace-only', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/name/i), { target: { value: '   ' } })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('keeps Save enabled when elevation is a valid number', () => {
    // jsdom sanitises type="number" inputs — non-numeric strings become ''.
    // Test the Number.isFinite(elevNum) branch by providing a real number.
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/elevation/i), { target: { value: '1500' } })
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
  })

  it('keeps Save enabled when elevation is blank (null path)', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText(/elevation/i), { target: { value: '' } })
    // Name still has its initial 'Summit Hut' value, so canSave depends on elevation.
    expect(screen.getByRole('button', { name: /save/i })).not.toBeDisabled()
  })

  it('disables Save when color override is an invalid hex', () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.change(screen.getByLabelText('Hex colour'), { target: { value: '#gg0000' } })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
  })

  it('saves an icon and swatch, then resets them to the category default', async () => {
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.click(screen.getByRole('radio', { name: 'Parking' }))
    fireEvent.click(screen.getByRole('radio', { name: '#EF4444' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(async () => {
      const saved = await getStorage().getWaypoint('w1')
      expect(saved).toMatchObject({ icon: 'local_parking', color: '#EF4444' })
    })

    act(() => useUiStore.getState().editCurrent())
    fireEvent.click(screen.getByRole('radio', { name: /category default \(/i }))
    fireEvent.click(screen.getByRole('radio', { name: 'Category default' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(async () => {
      const saved = await getStorage().getWaypoint('w1')
      expect(saved).toMatchObject({ icon: null, color: null })
    })
  })

  it('edit assigns a tag and persists it', async () => {
    act(() => useTagsStore.setState({ tags: [{ id: 'tag1', name: 'Steep', color: '#EF4444', created_at: '' }] }))
    render(<WaypointDetail waypointId="w1" mode="edit" />)
    fireEvent.click(screen.getByRole('button', { name: 'Steep' }))
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await waitFor(async () => expect((await getStorage().getWaypoint('w1'))?.tags).toEqual(['tag1']))
  })
})

describe('WaypointDetail (delete)', () => {
  beforeEach(() => setup())

  it('Confirm delete removes from the store and closes the panel', async () => {
    render(<WaypointDetail waypointId="w1" mode="view" />)
    fireEvent.click(screen.getByRole('button', { name: /^delete$/i }))
    fireEvent.click(screen.getByRole('button', { name: /confirm delete/i }))
    await waitFor(() => {
      expect(useWaypointsStore.getState().waypoints).toHaveLength(0)
    })
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
