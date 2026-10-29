import { render, screen, fireEvent, within } from '@testing-library/react'
import { useState } from 'react'
import { WaypointStyleFields } from './WaypointStyleFields'
import type { WaypointIcon } from '../../icons/waypointIcons'
import type { WaypointCategory } from '../../types'

function setup(initial: { category?: WaypointCategory; icon?: WaypointIcon | null; color?: string } = {}) {
  const onIconChange = vi.fn()
  const onColorChange = vi.fn()
  function Harness() {
    const [icon, setIcon] = useState<WaypointIcon | null>(initial.icon ?? null)
    const [color, setColor] = useState(initial.color ?? '')
    return (
      <WaypointStyleFields
        category={initial.category ?? 'summit'}
        icon={icon}
        color={color}
        onIconChange={(i) => { onIconChange(i); setIcon(i) }}
        onColorChange={(c) => { onColorChange(c); setColor(c) }}
      />
    )
  }
  render(<Harness />)
  return {
    onIconChange,
    onColorChange,
    icons: () => within(screen.getByRole('radiogroup', { name: 'Icon' })),
    colours: () => within(screen.getByRole('radiogroup', { name: 'Colour' })),
  }
}

describe('WaypointStyleFields', () => {
  it('starts on the category defaults', () => {
    const { icons, colours } = setup()
    expect(icons().getByRole('radio', { name: 'Category default (Summit)' }))
      .toHaveAttribute('aria-checked', 'true')
    expect(colours().getByRole('radio', { name: 'Category default' }))
      .toHaveAttribute('aria-checked', 'true')
  })

  it('picks an icon and returns to the category default', () => {
    const { icons, onIconChange } = setup()
    fireEvent.click(icons().getByRole('radio', { name: 'Cabin' }))
    expect(onIconChange).toHaveBeenLastCalledWith('cabin')
    expect(icons().getByRole('radio', { name: 'Cabin' })).toHaveAttribute('aria-checked', 'true')
    fireEvent.click(icons().getByRole('radio', { name: /category default/i }))
    expect(onIconChange).toHaveBeenLastCalledWith(null)
  })

  it('picks a swatch and returns to the category default', () => {
    const { colours, onColorChange } = setup()
    fireEvent.click(colours().getByRole('radio', { name: '#14B8A6' }))
    expect(onColorChange).toHaveBeenLastCalledWith('#14B8A6')
    fireEvent.click(colours().getByRole('radio', { name: 'Category default' }))
    expect(onColorChange).toHaveBeenLastCalledWith('')
  })

  it('flags an invalid hex and clears it when a swatch is picked', () => {
    const { colours } = setup()
    fireEvent.change(screen.getByLabelText('Hex colour'), { target: { value: '#gg0000' } })
    expect(screen.getByText('Use #RRGGBB hex.')).toBeInTheDocument()
    fireEvent.click(colours().getByRole('radio', { name: '#EF4444' }))
    expect(screen.queryByText('Use #RRGGBB hex.')).not.toBeInTheDocument()
    expect(screen.getByLabelText('Hex colour')).toHaveValue('#EF4444')
  })

  it('previews the category icon until an icon is picked', () => {
    setup({ category: 'hazard' })
    expect(screen.getByText('Warning')).toBeInTheDocument()
  })

  it('moves the selection with arrow keys and keeps one tab stop', () => {
    const { icons, onIconChange } = setup({ icon: 'cabin' })
    const cabin = icons().getByRole('radio', { name: 'Cabin' })
    expect(cabin).toHaveAttribute('tabindex', '0')
    expect(icons().getByRole('radio', { name: 'Camp' })).toHaveAttribute('tabindex', '-1')
    fireEvent.keyDown(cabin, { key: 'ArrowRight' })
    expect(onIconChange).toHaveBeenLastCalledWith('cottage')
    expect(icons().getByRole('radio', { name: 'Hut' })).toHaveFocus()
  })

  it('keeps the colour group reachable when a custom colour is set', () => {
    const { colours } = setup({ color: '#123456' })
    expect(colours().getByRole('radio', { name: 'Category default' })).toHaveAttribute('tabindex', '0')
  })
})
