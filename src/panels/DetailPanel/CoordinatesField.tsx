import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'
import { parseLatLng } from '../../utils/coords'

interface Props {
  value: string
  onChange: (value: string) => void
}

// A single "lat, lng" text field, so coordinates copied from another app (or
// from the map centre readout) paste straight in. Parse with parseLatLng.
export function CoordinatesField({ value, onChange }: Props): JSX.Element {
  const valid = parseLatLng(value) !== null
  return (
    <label className={shared.field}>
      <span>Coordinates (lat, lng)</span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        spellCheck={false}
        placeholder="49.50400, -115.06300"
        aria-invalid={!valid}
      />
      {!valid && (
        <span className={styles.subtle}>Use decimal degrees, e.g. 49.50400, -115.06300.</span>
      )}
    </label>
  )
}
