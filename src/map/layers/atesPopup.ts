import { ATES_CLASS_LABELS, ATES_CLASSES, ATES_POI_LABELS, ATES_POI_TYPES, type AtesClass, type AtesPoiType } from '../../types'
import { ATES_CLASS_COLORS } from './layerStyles'
import styles from './AtesLayer.module.css'

// Popup body for a clicked ATES zone, decision point, access route or point
// of interest. Built from DOM nodes
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
  } else if (properties.kind === 'access_route') {
    add('p', styles.title, text('name') || 'Access route')
    add('div', styles.subtle, `Access route · ${text('areaName')}`)
  } else if (properties.kind === 'poi') {
    const poi = properties.poi as AtesPoiType
    const label = ATES_POI_LABELS[ATES_POI_TYPES.includes(poi) ? poi : 'other']
    add('p', styles.title, text('name') || label)
    add('div', styles.subtle, `${label} · ${text('areaName')}`)
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

  // Access routes repeat their name as the description.
  if (text('description') && text('description') !== text('name')) {
    add('p', styles.description, text('description'))
  }
  return root
}
