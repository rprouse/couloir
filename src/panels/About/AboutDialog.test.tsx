import { fireEvent, render, screen } from '@testing-library/react'
import { act } from 'react'
import { AboutDialog } from './AboutDialog'
import { Sidebar } from '../Sidebar'
import { useUiStore } from '../../store/ui'

describe('AboutDialog', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('opens from the sidebar About button', () => {
    render(
      <>
        <Sidebar panels={{}} />
        <AboutDialog />
      </>,
    )
    expect(screen.queryByRole('dialog')).toBeNull()
    fireEvent.click(screen.getByRole('button', { name: /about/i }))
    const dialog = screen.getByRole('dialog', { name: 'Couloir' })
    expect(dialog).toHaveTextContent(/backcountry/i)
    expect(dialog).toHaveTextContent(`© ${new Date().getFullYear()} Rob Prouse`)
    expect(screen.getByRole('link', { name: 'MIT License' })).toBeInTheDocument()
  })

  it('closes on Close, on ESC without closing the detail panel, and on the backdrop', () => {
    useUiStore.setState({ aboutOpen: true })
    render(<AboutDialog />)
    fireEvent.click(screen.getByRole('button', { name: 'Close' }))
    expect(screen.queryByRole('dialog')).toBeNull()

    const onWindowKey = vi.fn()
    window.addEventListener('keydown', onWindowKey)
    act(() => useUiStore.setState({ aboutOpen: true }))
    fireEvent.keyDown(document.body, { key: 'Escape' })
    window.removeEventListener('keydown', onWindowKey)
    expect(screen.queryByRole('dialog')).toBeNull()
    expect(onWindowKey).not.toHaveBeenCalled()

    act(() => useUiStore.setState({ aboutOpen: true }))
    fireEvent.click(screen.getByRole('dialog').parentElement!)
    expect(screen.queryByRole('dialog')).toBeNull()
  })
})
