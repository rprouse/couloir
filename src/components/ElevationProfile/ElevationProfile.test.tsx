import { render, screen } from '@testing-library/react'
import { ElevationProfile } from './ElevationProfile'
import type { LineStringZ } from '../../types'

// recharts' ResponsiveContainer uses ResizeObserver which jsdom doesn't provide.
window.ResizeObserver = class ResizeObserver {
  observe() { /* no-op */ }
  unobserve() { /* no-op */ }
  disconnect() { /* no-op */ }
}

describe('ElevationProfile', () => {
  it('renders the wrapper for a 2+ point line', () => {
    const ls: LineStringZ = {
      type: 'LineString',
      coordinates: [
        [-116, 49.5, 1500],
        [-116, 49.501, 1520],
      ],
    }
    render(<ElevationProfile geojson={ls} />)
    expect(screen.getByTestId('elevation-profile')).toBeInTheDocument()
  })

  it('shows the unavailable message for < 2 points', () => {
    const ls: LineStringZ = { type: 'LineString', coordinates: [[-116, 49.5, 1500]] }
    render(<ElevationProfile geojson={ls} />)
    expect(screen.getByText(/profile unavailable/i)).toBeInTheDocument()
  })
})
