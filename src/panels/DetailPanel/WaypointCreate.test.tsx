import { render, screen, fireEvent } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { useWaypointsStore } from '../../store/waypoints'
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
    fireEvent.change(screen.getByLabelText(/category/i), { target: { value: 'summit' } })
    fireEvent.click(screen.getByRole('button', { name: /save/i }))
    await new Promise((r) => setTimeout(r, 0))
    const stored = useWaypointsStore.getState().waypoints
    expect(stored).toHaveLength(1)
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

  it('returns the panel to idle on Cancel without writing to storage', () => {
    render(<WaypointCreate />)
    fireEvent.click(screen.getByRole('button', { name: /cancel/i }))
    expect(useWaypointsStore.getState().waypoints).toHaveLength(0)
    expect(useUiStore.getState().panel.mode).toBe('idle')
  })
})
