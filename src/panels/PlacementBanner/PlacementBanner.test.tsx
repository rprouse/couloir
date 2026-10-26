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

  it('shows the photo prompt when placement.mode === "photo"', () => {
    render(<PlacementBanner />)
    act(() => {
      useUiStore.setState({
        placement: {
          mode: 'photo',
          pending: {
            blob: new Blob(), thumb: new Blob(), preview: 'blob:test/x', width: 1, height: 1,
            filename: 'a.jpg', exif: { lat: null, lng: null, altitude_m: null, bearing: null, taken_at: null },
          },
        },
      })
    })
    expect(screen.getByRole('status')).toHaveTextContent(/where this photo was taken/i)
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
