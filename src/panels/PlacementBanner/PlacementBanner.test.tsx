import { render, screen } from '@testing-library/react'
import { act } from 'react'
import { useUiStore } from '../../store/ui'
import { PlacementBanner } from './PlacementBanner'

function reset() {
  act(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })
}

describe('PlacementBanner', () => {
  beforeEach(reset)

  it('renders nothing when placement is idle', () => {
    const { container } = render(<PlacementBanner />)
    expect(container.firstChild).toBeNull()
  })

  it('shows the waypoint prompt when placement.mode === "waypoint"', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.getState().startWaypointPlacement()
    })
    expect(screen.getByRole('status')).toHaveTextContent(/click the map/i)
    expect(screen.getByRole('status')).toHaveTextContent(/escape/i)
  })

  it('cancels placement when the Cancel button is clicked', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.getState().startWaypointPlacement()
    })
    act(() => {
      screen.getByRole('button', { name: /cancel/i }).click()
    })
    expect(useUiStore.getState().placement.mode).toBe('idle')
  })
})
