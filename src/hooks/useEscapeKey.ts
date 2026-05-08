import { useEffect } from 'react'
import { useUiStore } from '../store/ui'

// Global ESC handler implementing the precedence in ARCHITECTURE.md
// "Global ESC key handler":
//   1. If placement is active, cancel placement.
//   2. Else if panel is in edit mode, exit to view.
//   3. Else if panel is open, close it.
//   4. Else no-op.
export function useEscapeKey(): void {
  useEffect(() => {
    const handler = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return

      const { panel, placement, cancelPlacement, closePanel, openEntity } =
        useUiStore.getState()

      if (placement.mode !== 'idle') {
        cancelPlacement()
        event.preventDefault()
        return
      }
      if (panel.mode === 'edit') {
        // Exit edit → view by re-issuing openEntity with the same identity.
        openEntity(panel.entityType, panel.entityId)
        event.preventDefault()
        return
      }
      if (panel.mode !== 'idle') {
        closePanel()
        event.preventDefault()
        return
      }
    }

    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])
}
