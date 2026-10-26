import { fireEvent, render, screen } from '@testing-library/react'
import { CompassRose } from './CompassRose'

describe('CompassRose', () => {
  it('labels and rotates the needle to the bearing', () => {
    render(<CompassRose bearing={120} />)
    expect(screen.getByRole('img', { name: 'Bearing: 120°' })).toBeInTheDocument()
    expect(screen.getByTestId('compass-needle')).toHaveAttribute('transform', 'rotate(120)')
  })

  it('shows no needle when the bearing is unknown', () => {
    render(<CompassRose bearing={null} />)
    expect(screen.getByRole('img', { name: 'Bearing: not set' })).toBeInTheDocument()
    expect(screen.queryByTestId('compass-needle')).toBeNull()
  })

  it('sets the bearing from a click when interactive', () => {
    const onChange = vi.fn()
    render(<CompassRose bearing={null} onChange={onChange} />)
    const svg = screen.getByRole('img')
    svg.getBoundingClientRect = () => ({ left: 0, top: 0, width: 100, height: 100 }) as DOMRect
    fireEvent.click(svg, { clientX: 100, clientY: 50 }) // due east of centre
    expect(onChange).toHaveBeenCalledWith(90)
  })
})
