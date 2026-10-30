import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BasemapControl } from './BasemapControl'
import { useUiStore } from '../../store/ui'

describe('BasemapControl', () => {
  beforeEach(() => {
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders every basemap with the active one pressed', () => {
    render(<BasemapControl />)
    expect(screen.getByRole('button', { name: /^satellite$/i })).toHaveAttribute('aria-pressed', 'false')
    expect(screen.getByRole('button', { name: /hybrid/i })).toHaveAttribute('aria-pressed', 'false')
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

  describe('collapsing', () => {
    afterEach(() => vi.unstubAllGlobals())

    it('collapses to the active basemap and expands again, remembering the choice', async () => {
      const user = userEvent.setup()
      render(<BasemapControl />)
      await user.click(screen.getByRole('button', { name: 'Hide other basemaps' }))
      expect(screen.queryByRole('button', { name: /winter/i })).toBeNull()
      expect(screen.getByRole('button', { name: /outdoor/i })).toHaveAttribute('aria-pressed', 'true')
      expect(localStorage.getItem('couloir_basemap_control_collapsed')).toBe('true')
      // Clicking the lone active basemap expands rather than re-selecting it.
      await user.click(screen.getByRole('button', { name: /outdoor/i }))
      expect(screen.getByRole('button', { name: /winter/i })).toBeInTheDocument()
      expect(screen.getByRole('button', { name: 'Hide other basemaps' })).toHaveAttribute('aria-expanded', 'true')
    })

    it('starts collapsed on mobile', () => {
      vi.stubGlobal('matchMedia', () => ({ matches: true, addEventListener: vi.fn(), removeEventListener: vi.fn() }))
      render(<BasemapControl />)
      expect(screen.getByRole('button', { name: 'Show all basemaps' })).toHaveAttribute('aria-expanded', 'false')
      expect(screen.queryByRole('button', { name: /satellite/i })).toBeNull()
    })
  })
})
