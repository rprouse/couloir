import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
import { setStorage } from '../../storage/provider'
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
    // The hex text input has placeholder "leave blank to use category default"
    // and no explicit aria-label. Find it via placeholder text.
    const hexInput = screen.getByPlaceholderText(/leave blank/i)
    fireEvent.change(hexInput, { target: { value: '#gg0000' } })
    expect(screen.getByRole('button', { name: /save/i })).toBeDisabled()
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
