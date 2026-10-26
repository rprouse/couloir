import type { MouseEvent } from 'react'
import styles from './CompassRose.module.css'
import { bearingFromVector } from '../../utils/geo'

interface Props {
  bearing: number | null
  size?: number
  // When set, clicking the rose sets the bearing to the clicked direction.
  onChange?: (bearing: number) => void
}

export function CompassRose({ bearing, size = 96, onChange }: Props): JSX.Element {
  const handleClick = (e: MouseEvent<SVGSVGElement>) => {
    if (!onChange) return
    const rect = e.currentTarget.getBoundingClientRect()
    const dx = e.clientX - (rect.left + rect.width / 2)
    const dy = e.clientY - (rect.top + rect.height / 2)
    if (dx === 0 && dy === 0) return
    onChange(bearingFromVector(dx, dy))
  }

  return (
    <svg
      viewBox="-50 -50 100 100"
      width={size}
      height={size}
      role="img"
      aria-label={bearing === null ? 'Bearing: not set' : `Bearing: ${bearing}°`}
      className={onChange ? `${styles.rose} ${styles.interactive}` : styles.rose}
      onClick={onChange ? handleClick : undefined}
    >
      <circle r="46" className={styles.ring} />
      {[0, 90, 180, 270].map((deg) => (
        <line key={deg} x1="0" y1="-46" x2="0" y2="-38" className={styles.tick} transform={`rotate(${deg})`} />
      ))}
      <text y="-28" className={styles.north}>N</text>
      {bearing !== null && (
        <g transform={`rotate(${bearing})`} data-testid="compass-needle">
          <polygon points="0,-40 6,0 -6,0" className={styles.needle} />
          <polygon points="0,40 6,0 -6,0" className={styles.tail} />
        </g>
      )}
    </svg>
  )
}
