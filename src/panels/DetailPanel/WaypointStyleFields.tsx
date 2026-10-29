import type { KeyboardEvent, ReactNode } from 'react'
import styles from './WaypointStyleFields.module.css'
import { WaypointBadge } from '../../icons/WaypointBadge'
import {
  WAYPOINT_ICONS,
  WAYPOINT_SWATCHES,
  iconLabel,
  resolveWaypointStyle,
  type WaypointIcon,
  type WaypointIconGroup,
} from '../../icons/waypointIcons'
import { WAYPOINT_CATEGORIES, type WaypointCategory } from '../../types'
import { isValidHex } from '../../utils/format'

interface Props {
  category: WaypointCategory
  icon: WaypointIcon | null
  // Colour as typed: '' means the category default; anything else should be
  // #RRGGBB (the parent blocks Save while it isn't).
  color: string
  onIconChange: (icon: WaypointIcon | null) => void
  onColorChange: (color: string) => void
}

const GROUPS: WaypointIconGroup[] = ['Travel', 'Shelter', 'Terrain', 'Safety', 'General']

// Arrow keys move the selection between the radios of the enclosing
// radiogroup, wrapping at the ends (WAI-ARIA radio group pattern).
function onRadioKeyDown(e: KeyboardEvent<HTMLButtonElement>): void {
  const step = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[e.key]
  if (step === undefined) return
  const group = e.currentTarget.closest('[role="radiogroup"]')
  if (!group) return
  const radios = Array.from(group.querySelectorAll<HTMLButtonElement>('[role="radio"]'))
  const next = radios[(radios.indexOf(e.currentTarget) + step + radios.length) % radios.length]
  e.preventDefault()
  next.focus()
  next.click()
}

// tabbable: the group's one Tab stop — the checked radio, or the first when
// none is checked.
function Radio({ checked, tabbable = checked, label, className, onSelect, children }: {
  checked: boolean
  tabbable?: boolean
  label: string
  className: string
  onSelect: () => void
  children: ReactNode
}): JSX.Element {
  return (
    <button
      type="button"
      role="radio"
      aria-checked={checked}
      aria-label={label}
      title={label}
      tabIndex={tabbable ? 0 : -1}
      className={className}
      onClick={onSelect}
      onKeyDown={onRadioKeyDown}
    >
      {children}
    </button>
  )
}

// Icon and colour pickers for a waypoint, with a live preview of its marker.
// Shared by the create and edit forms.
export function WaypointStyleFields({
  category, icon, color, onIconChange, onColorChange,
}: Props): JSX.Element {
  const defaults = WAYPOINT_CATEGORIES[category]
  const colorOk = color === '' || isValidHex(color)
  const preview = resolveWaypointStyle({
    category,
    icon,
    color: colorOk && color !== '' ? color : null,
  })
  const upper = color.toUpperCase()
  const isSwatch = (WAYPOINT_SWATCHES as readonly string[]).includes(upper)

  return (
    <>
      <div className={styles.preview}>
        <WaypointBadge icon={preview.icon} color={preview.color} size={40} />
        <span>{iconLabel(preview.icon)}</span>
      </div>

      <div role="radiogroup" aria-label="Icon" className={styles.group}>
        <h3>Icon</h3>
        <div className={styles.iconGrid}>
          <Radio
            checked={icon === null}
            label={`Category default (${iconLabel(defaults.icon)})`}
            className={`${styles.option} ${styles.defaultOption}`}
            onSelect={() => onIconChange(null)}
          >
            <WaypointBadge icon={defaults.icon} color={defaults.color} size={28} />
          </Radio>
        </div>
        {GROUPS.map((group) => (
          <div key={group} className={styles.iconGroup}>
            <span className={styles.groupLabel}>{group}</span>
            <div className={styles.iconGrid}>
              {WAYPOINT_ICONS.filter((i) => i.group === group).map((i) => (
                <Radio
                  key={i.key}
                  checked={icon === i.key}
                  label={i.label}
                  className={styles.option}
                  onSelect={() => onIconChange(i.key)}
                >
                  <WaypointBadge icon={i.key} color={preview.color} size={28} />
                </Radio>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div role="radiogroup" aria-label="Colour" className={styles.group}>
        <h3>Colour</h3>
        <div className={styles.swatchRow}>
          <Radio
            checked={color === ''}
            tabbable={color === '' || !isSwatch}
            label="Category default"
            className={`${styles.swatch} ${styles.defaultSwatch}`}
            onSelect={() => onColorChange('')}
          >
            {/* Inline: the swatch shows waypoint data, not a theme colour. */}
            <span className={styles.swatchFill} style={{ backgroundColor: defaults.color }} />
          </Radio>
          {WAYPOINT_SWATCHES.map((hex) => (
            <Radio
              key={hex}
              checked={upper === hex}
              label={hex}
              className={styles.swatch}
              onSelect={() => onColorChange(hex)}
            >
              <span className={styles.swatchFill} style={{ backgroundColor: hex }} />
            </Radio>
          ))}
        </div>
        <div className={styles.customRow}>
          <input
            type="color"
            aria-label="Custom colour"
            value={colorOk && color !== '' ? color : defaults.color}
            onChange={(e) => onColorChange(e.target.value.toUpperCase())}
            className={`${styles.colorInput} ${color !== '' && !isSwatch ? styles.customActive : ''}`}
          />
          <input
            aria-label="Hex colour"
            value={color}
            onChange={(e) => onColorChange(e.target.value)}
            aria-invalid={!colorOk}
            placeholder="#RRGGBB, blank for default"
            className={styles.hexInput}
          />
        </div>
        {!colorOk && <span className={styles.error}>Use #RRGGBB hex.</span>}
      </div>
    </>
  )
}
