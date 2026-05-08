import { render } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useEscapeKey } from './useEscapeKey'
import { useUiStore } from '../store/ui'

function Harness() {
  useEscapeKey()
  return null
}

describe('useEscapeKey precedence', () => {
  beforeEach(() => {
    useUiStore.setState({
      panel: { mode: 'idle' },
      placement: { mode: 'idle' },
    })
  })

  it('cancels placement first when both placement and panel are active', async () => {
    useUiStore.getState().openEntity('waypoint', 'w1')
    useUiStore.getState().editCurrent({ name: 'x' })
    useUiStore.getState().startWaypointPlacement()
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    const state = useUiStore.getState()
    expect(state.placement).toEqual({ mode: 'idle' })
    // Panel should still be in edit mode — only placement was cancelled.
    expect(state.panel.mode).toBe('edit')
  })

  it('exits edit to view when only the panel is in edit mode', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    useUiStore.getState().editCurrent({})
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    const panel = useUiStore.getState().panel
    expect(panel.mode).toBe('view')
    if (panel.mode === 'view') {
      expect(panel.entityId).toBe('r1')
    }
  })

  it('closes the panel from view mode', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    render(<Harness />)

    await userEvent.keyboard('{Escape}')
    expect(useUiStore.getState().panel).toEqual({ mode: 'idle' })
  })

  it('does nothing when both placement and panel are idle', async () => {
    render(<Harness />)
    await userEvent.keyboard('{Escape}')
    const state = useUiStore.getState()
    expect(state.panel).toEqual({ mode: 'idle' })
    expect(state.placement).toEqual({ mode: 'idle' })
  })

  it('ignores non-Escape keys', async () => {
    useUiStore.getState().openEntity('route', 'r1')
    render(<Harness />)
    await userEvent.keyboard('a')
    expect(useUiStore.getState().panel.mode).toBe('view')
  })
})
