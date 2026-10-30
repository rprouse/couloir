import { ATES_CLASS_LABELS, ATES_CLASSES, type AtesClass } from '../../types'
import { ATES_CLASS_COLORS } from './layerStyles'
import styles from './AtesLayer.module.css'

// Popup body for a clicked ATES zone or decision point. Built from DOM nodes
// with textContent, never HTML: the strings come from an imported file.
// `properties` is what queryRenderedFeatures hands back (see atesLayerData).
export function atesPopupContent(properties: Record<string, unknown>): HTMLElement {
  const text = (key: string) => (typeof properties[key] === 'string' ? (properties[key] as string) : '')
  const root = document.createElement('div')

  const add = (tag: string, className: string, content: string) => {
    const el = document.createElement(tag)
    el.className = className
    el.textContent = content
    root.appendChild(el)
    return el
  }

  if (properties.kind === 'decision_point') {
    add('p', styles.title, text('name') || 'Decision point')
    add('div', styles.subtle, `Decision point · ${text('areaName')}`)
  } else {
    add('p', styles.title, text('areaName'))
    const ates = properties.ates as AtesClass
    if (ATES_CLASSES.includes(ates)) {
      const row = add('div', styles.classRow, '')
      const swatch = document.createElement('span')
      swatch.className = styles.swatch
      swatch.style.backgroundColor = ATES_CLASS_COLORS[ates]
      const label = document.createElement('span')
      label.textContent = ATES_CLASS_LABELS[ates]
      row.append(swatch, label)
    }
  }

  if (text('description')) add('p', styles.description, text('description'))
  return root
}
