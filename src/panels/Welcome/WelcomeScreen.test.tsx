import { fireEvent, render, screen } from '@testing-library/react'
import { WelcomeScreen } from './WelcomeScreen'
import { useSettingsStore } from '../../store/settings'

describe('WelcomeScreen', () => {
  afterEach(() => {
    vi.restoreAllMocks()
    useSettingsStore.getState().setMaptilerKey(null)
  })

  it('walks through the two steps and links to Maptiler signup', () => {
    render(<WelcomeScreen />)
    expect(screen.getByRole('heading', { name: 'Welcome to Couloir' })).toBeInTheDocument()
    expect(screen.getByText(/import your first gpx/i)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /free maptiler account/i })).toHaveAttribute('href', expect.stringContaining('maptiler.com'))
  })

  it('saves the key, trimmed of whitespace', () => {
    const set = vi.spyOn(useSettingsStore.getState(), 'setMaptilerKey')
    render(<WelcomeScreen />)
    fireEvent.change(screen.getByLabelText('Maptiler API key'), { target: { value: ' abc 123 ' } })
    fireEvent.click(screen.getByRole('button', { name: 'Save key' }))
    expect(set).toHaveBeenCalledWith('abc123')
  })
})
