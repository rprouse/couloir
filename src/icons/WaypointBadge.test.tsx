import { render, screen } from '@testing-library/react'
import { WaypointBadge } from './WaypointBadge'
import { iconPath } from './waypointIcons'

describe('WaypointBadge', () => {
  it('draws the icon glyph on a disc in the colour', () => {
    const { container } = render(<WaypointBadge icon="cabin" color="#22C55E" />)
    const badge = container.firstElementChild as HTMLElement
    expect(badge.style.backgroundColor).toBe('rgb(34, 197, 94)')
    expect(badge).toHaveAttribute('aria-hidden', 'true')
    expect(container.querySelector('path')).toHaveAttribute('d', iconPath('cabin'))
  })

  it('is announced as an image when labelled', () => {
    render(<WaypointBadge icon="cabin" color="#22C55E" label="Cabin" />)
    expect(screen.getByRole('img', { name: 'Cabin' })).toBeInTheDocument()
  })
})
