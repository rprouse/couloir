import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Sidebar } from './Sidebar'
import { useUiStore } from '../store/ui'

describe('Sidebar', () => {
  beforeEach(() => {
    useUiStore.setState(useUiStore.getInitialState())
  })

  it('renders three tab buttons', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /search/i })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /settings/i })).toBeInTheDocument()
  })

  it('marks the active tab as selected', () => {
    render(<Sidebar />)
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
  })

  it('switches which tab is selected on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    await user.click(screen.getByRole('button', { name: /settings/i }))
    expect(screen.getByRole('button', { name: /settings/i })).toHaveAttribute(
      'aria-pressed',
      'true',
    )
    expect(screen.getByRole('button', { name: /layers/i })).toHaveAttribute(
      'aria-pressed',
      'false',
    )
  })

  it('toggles the collapse button label and aside state on click', async () => {
    const user = userEvent.setup()
    render(<Sidebar />)
    const aside = screen.getByRole('complementary')
    expect(aside).toHaveAttribute('data-collapsed', 'false')

    await user.click(screen.getByRole('button', { name: /collapse sidebar/i }))

    expect(aside).toHaveAttribute('data-collapsed', 'true')
    expect(
      screen.getByRole('button', { name: /expand sidebar/i }),
    ).toBeInTheDocument()
  })
})
