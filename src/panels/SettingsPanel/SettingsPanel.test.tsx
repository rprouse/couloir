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

  it('discards the draft when the user clicks Cancel and reopens with an empty input', async () => {
    const user = userEvent.setup()
    useSettingsStore.setState({ maptilerKey: 'OLD' })
    render(<SettingsPanel />)
    await user.click(screen.getByRole('button', { name: /replace/i }))
    await user.type(screen.getByLabelText(/maptiler api key/i), 'ABANDONED')
    await user.click(screen.getByRole('button', { name: /cancel/i }))

    expect(useSettingsStore.getState().maptilerKey).toBe('OLD')
    expect(screen.getByText(/key set/i)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /replace/i }))
    expect(screen.getByLabelText(/maptiler api key/i)).toHaveValue('')
  })

  it('strips whitespace from a pasted key', async () => {
    const user = userEvent.setup()
    render(<SettingsPanel />)
    await user.click(screen.getByLabelText(/maptiler api key/i))
    await user.paste('  KEY\nWITH\tSPACES  ')
    await user.click(screen.getByRole('button', { name: /save key/i }))
    expect(useSettingsStore.getState().maptilerKey).toBe('KEYWITHSPACES')
  })

  it('updates terrain exaggeration default through the slider', () => {
    render(<SettingsPanel />)
    fireEvent.change(screen.getByRole('slider', { name: /terrain exaggeration/i }), {
      target: { value: '2' },
    })
    expect(useUiStore.getState().terrainExaggeration).toBe(2)
  })
})
