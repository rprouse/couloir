import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { SettingsPanel } from './SettingsPanel'
import { useSettingsStore } from '../../store/settings'
import { useUiStore } from '../../store/ui'

describe('SettingsPanel', () => {
  beforeEach(() => {
    localStorage.clear()
    useSettingsStore.setState({ maptilerKey: null })
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('shows an empty key state and saves what the user types', async () => {
    const user = userEvent.setup()
    render(<SettingsPanel />)
    const input = screen.getByLabelText(/maptiler api key/i)
    expect(input).toHaveValue('')
    await user.type(input, 'NEWKEY')
    await user.click(screen.getByRole('button', { name: /save key/i }))
    expect(useSettingsStore.getState().maptilerKey).toBe('NEWKEY')
  })

  it('renders a masked value when a key is already set', () => {
    useSettingsStore.setState({ maptilerKey: 'AB12345678' })
    render(<SettingsPanel />)
    expect(screen.getByText(/key set/i)).toBeInTheDocument()
    expect(screen.queryByDisplayValue('AB12345678')).not.toBeInTheDocument()
  })

  it('replaces the key when the user clicks Replace', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ maptilerKey: 'OLD' })
    render(<SettingsPanel />)
    await user.click(screen.getByRole('button', { name: /replace/i }))
    const input = screen.getByLabelText(/maptiler api key/i)
    await user.type(input, 'NEW')
    await user.click(screen.getByRole('button', { name: /save key/i }))
    expect(useSettingsStore.getState().maptilerKey).toBe('NEW')
  })

  it('updates terrain exaggeration default through the slider', () => {
    render(<SettingsPanel />)
    fireEvent.change(screen.getByRole('slider', { name: /terrain exaggeration/i }), {
      target: { value: '2' },
    })
    expect(useUiStore.getState().terrainExaggeration).toBe(2)
  })
})
