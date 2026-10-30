import styles from './TerrainControl.module.css'
import { ATES_CLASS_LABELS, ATES_POI_LABELS, type AtesClass } from '../../types'
import { WaypointBadge } from '../../icons/WaypointBadge'
import type { AtesLegendItem } from '../layers/atesLayerData'
import {
  ATES_ACCESS_COLOR,
  ATES_CLASS_COLORS,
  ATES_DECISION_COLOR,
  ATES_PATH_COLOR,
  ATES_POI_COLORS,
  ATES_POI_ICONS,
} from '../layers/layerStyles'

export const ATES_CAVEAT =
  'ATES rates terrain exposure, not today’s avalanche danger. Check the current forecast.'

const ITEM_LABELS = {
  decision_point: 'Decision point',
  avalanche_path: 'Avalanche path',
  access_route: 'Access route',
} as const

// One swatch per class present in the imported areas, then a row for each
// other kind of feature present. Swatch colours are the map's literal paint
// colours (layerStyles).
export function AtesLegend({ classes, items = [] }: { classes: AtesClass[]; items?: AtesLegendItem[] }) {
  return (
    <div className={styles.legend}>
      <ul className={styles.atesClasses} aria-label="ATES legend">
        {classes.map((c) => (
          <li key={c} className={styles.atesClass}>
            <span className={styles.atesSwatch} style={{ background: ATES_CLASS_COLORS[c] }} />
            <span>{ATES_CLASS_LABELS[c]}</span>
          </li>
        ))}
        {items.map((item) =>
          item.kind === 'poi' ? (
            <li key={`poi:${item.poi}`} className={styles.atesClass}>
              <span className={styles.atesMarker}>
                <WaypointBadge icon={ATES_POI_ICONS[item.poi]} color={ATES_POI_COLORS[item.poi]} size={14} />
              </span>
              <span>{ATES_POI_LABELS[item.poi]}</span>
            </li>
          ) : (
            <li key={item.kind} className={styles.atesClass}>
              {item.kind === 'decision_point' ? (
                <span className={styles.atesMarker}>
                  <span className={styles.atesDot} style={{ background: ATES_DECISION_COLOR }} />
                </span>
              ) : (
                <span
                  className={styles.atesLine}
                  style={{ background: item.kind === 'access_route' ? ATES_ACCESS_COLOR : ATES_PATH_COLOR }}
                />
              )}
              <span>{ITEM_LABELS[item.kind]}</span>
            </li>
          ),
        )}
      </ul>
      <p className={styles.caveat}>{ATES_CAVEAT}</p>
      <p className={styles.caveat}>Ratings: Avalanche Canada</p>
    </div>
  )
}
