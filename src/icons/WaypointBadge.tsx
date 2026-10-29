import styles from './WaypointBadge.module.css'
import { SYMBOL_VIEWBOX } from './symbolPaths'
import { iconPath, type WaypointIcon } from './waypointIcons'

interface Props {
  icon: WaypointIcon
  color: string
  size?: number
  // When set, the badge is announced as an image with this name; otherwise
  // it is decorative.
  label?: string
}

// The waypoint's map marker as a DOM element: a disc in `color` with the
// white Material Symbol glyph, matching what wpIcons draws on the map.
export function WaypointBadge({ icon, color, size = 24, label }: Props): JSX.Element {
  return (
    <span
      className={styles.badge}
      // Inline: the colour is waypoint data, not a theme colour.
      style={{ backgroundColor: color, width: size, height: size }}
      {...(label ? { role: 'img', 'aria-label': label } : { 'aria-hidden': true })}
    >
      <svg viewBox={SYMBOL_VIEWBOX} className={styles.glyph}>
        <path d={iconPath(icon)} fill="currentColor" />
      </svg>
    </span>
  )
}
