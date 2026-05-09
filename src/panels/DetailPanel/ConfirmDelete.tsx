import { useState } from 'react'

interface Props {
  label?: string
  onConfirm: () => void
}

export function ConfirmDelete({ label = 'Delete', onConfirm }: Props): JSX.Element {
  const [armed, setArmed] = useState(false)
  if (!armed) {
    return (
      <button type="button" onClick={() => setArmed(true)}>
        {label}
      </button>
    )
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
