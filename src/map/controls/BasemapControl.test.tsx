import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BasemapControl } from './BasemapControl'
import { useUiStore } from '../../store/ui'

describe('BasemapControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders three buttons with the active one pressed', () => {
    render(<BasemapControl />)
    expect(screen.getByRole('button', { name: /satellite/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /outdoor/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /winter/i })).toHaveAttribute('aria-pressed', 'false')
  })

  it('switches the basemap on click', async () => {
    const user = userEvent.setup()
    render(<BasemapControl />)
    await user.click(screen.getByRole('button', { name: /winter/i }))
    expect(screen.getByRole('button', { name: /winter/i })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByRole('button', { name: /outdoor/i })).toHaveAttribute('aria-pressed', 'false')
    expect(useUiStore.getState().activeBasemap).toBe('winter')
  })
})
