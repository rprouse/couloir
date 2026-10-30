import styles from './DetailPanel.module.css'
import { SYMBOL_VIEWBOX } from '../../icons/symbolPaths'
import { uiIconPath, type UiIcon } from '../../icons/uiIcons'

interface Props {
  icon: UiIcon
  // Accessible name and tooltip, e.g. "Download GPX".
  label: string
  onClick: () => void
}

// Icon-only button for the detail panel header actions.
export function IconButton({ icon, label, onClick }: Props): JSX.Element {
  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg viewBox={SYMBOL_VIEWBOX} width="18" height="18" aria-hidden="true">
        <path d={uiIconPath(icon)} fill="currentColor" />
      </svg>
    </button>
  )
}
