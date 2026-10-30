import { useState } from 'react'
import { IconButton } from './IconButton'

interface Props {
  label?: string
  onConfirm: () => void
}

export function ConfirmDelete({ label = 'Delete', onConfirm }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  // A trash icon; the confirm step stays as text so it can't be misread.
  if (!armed) {
    return <IconButton icon="delete" label={label} onClick={() => setArmed(true)} />
  }
  return (
    <div style={{ display: 'inline-flex', gap: 'var(--space-sm)' }}>
      <button type="button" onClick={onConfirm}>
        Confirm delete
      </button>
      <button type="button" onClick={() => setArmed(false)}>
        Cancel
      </button>
    </div>
  )
}
