import styles from './DetailPanel.module.css'
import shared from './DetailPanel.shared.module.css'

export type LineType = 'route' | 'track'

interface Props {
  current: LineType
  value: LineType
  onChange: (value: LineType) => void
}

const DROPPED: Record<LineType, string> = {
  route: 'Its ATES and technical ratings will be dropped.',
  track: 'Its duration, moving time and recorded date will be dropped.',
}

// Route/track switch for the edit forms. Choosing the other type converts the
// line on save; it takes that type's default colour and line style.
export function LineTypeField({ current, value, onChange }: Props): JSX.Element {
  return (
    <label className={shared.field}>
      <span>Type</span>
      <select value={value} onChange={(e) => onChange(e.target.value as LineType)}>
        <option value="route">Route</option>
        <option value="track">Track</option>
      </select>
      {value !== current && (
        <span className={styles.subtle}>
          Saving converts this {current} to a {value} with the default {value} colour
          and style. {DROPPED[current]}
        </span>
      )}
    </label>
  )
}
