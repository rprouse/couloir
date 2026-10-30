import styles from './DetailPanel.module.css'
import { SYMBOL_VIEWBOX } from '../../icons/symbolPaths'
import { uiIconPath } from '../../icons/uiIcons'

interface Props {
  // Accessible name and tooltip, e.g. "Download GPX".
  label: string
  onClick: () => void
}

// Icon-only download button for the detail panel header actions.
export function DownloadButton({ label, onClick }: Props): JSX.Element {
  return (
    <button
      type="button"
      className={styles.iconButton}
      onClick={onClick}
      aria-label={label}
      title={label}
    >
      <svg viewBox={SYMBOL_VIEWBOX} width="18" height="18" aria-hidden="true">
        <path d={uiIconPath('download')} fill="currentColor" />
      </svg>
    </button>
  )
}
