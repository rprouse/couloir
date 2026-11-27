import styles from './TerrainControl.module.css'
import {
  selectFreezingHour,
  selectedTime,
  useFreezingLevelStore,
} from '../../store/freezingLevel'
import { FORECAST_HOURS } from '../../features/freezing/freezingLevel'
import { FREEZING_BANDS } from '../slope/freezingBands'
import { useMap } from '../../hooks/useMap'

function formatTime(time: number, hourOffset: number): string {
  if (hourOffset === 0) return 'Now'
  const label = new Date(time).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  })
  return `${label} (+${hourOffset} h)`
}

function LevelReadout() {
  const map = useMap()
  const forecast = useFreezingLevelStore((s) => s.forecast)
  const loading = useFreezingLevelStore((s) => s.loading)
  const error = useFreezingLevelStore((s) => s.error)
  const load = useFreezingLevelStore((s) => s.load)
  const hour = useFreezingLevelStore(selectFreezingHour)

  if (!forecast) {
    if (error) {
      return (
        <p className={styles.freezingLevel} role="alert">
          Freezing level unavailable: {error}{' '}
          {map && (
            <button
              type="button"
              className={styles.linkButton}
              onClick={() => {
                const { lat, lng } = map.getCenter()
                void load(lat, lng)
              }}
            >
              Retry
            </button>
          )}
        </p>
      )
    }
    return <p className={styles.freezingLevel}>Loading freezing level…</p>
  }

  let text: string
  if (!hour || hour.levelM === null) text = 'No freezing level for this hour'
  else if (hour.belowGround) text = `Freezing level below ${hour.levelM} m (freezing in the valley)`
  else text = `Freezing level ${hour.levelM.toLocaleString()} m`
  return (
    <p className={styles.freezingLevel} aria-live="polite">
      {text}
      {loading && <span className={styles.dim}> · updating…</span>}
    </p>
  )
}

export function FreezingLegend() {
  const hourOffset = useFreezingLevelStore((s) => s.hourOffset)
  const setHourOffset = useFreezingLevelStore((s) => s.setHourOffset)
  const time = useFreezingLevelStore(selectedTime)
  const forecast = useFreezingLevelStore((s) => s.forecast)
  const error = useFreezingLevelStore((s) => s.error)

  return (
    <>
      <LevelReadout />
      <label className={styles.hourRow}>
        <input
          type="range"
          min={0}
          max={FORECAST_HOURS}
          step={1}
          value={hourOffset}
          aria-label="Forecast hour"
          aria-valuetext={formatTime(time, hourOffset)}
          onChange={(e) => setHourOffset(Number(e.target.value))}
        />
        <span className={styles.hourLabel}>{formatTime(time, hourOffset)}</span>
      </label>
      {/* Swatch colours are the raster's literal pixel colours (FREEZING_BANDS). */}
      <ul className={styles.atesClasses} aria-label="Freezing level legend">
        {[FREEZING_BANDS.above, FREEZING_BANDS.below].map((band) => (
          <li key={band.label} className={styles.atesClass}>
            <span className={styles.atesSwatch} style={{ background: band.color }} />
            <span>{band.label}</span>
          </li>
        ))}
      </ul>
      {forecast && error && (
        <p className={styles.hint}>Couldn't update the forecast for here: {error}</p>
      )}
      <p className={styles.caveat}>
        Modelled (Environment Canada GEM) for the map centre
        {forecast && ` (${forecast.lat.toFixed(2)}, ${forecast.lng.toFixed(2)})`}, updated as you
        move the map. Inversions, sun and wind make real temperatures differ. Weather data by{' '}
        <a href="https://open-meteo.com/" target="_blank" rel="noreferrer">
          Open-Meteo.com
        </a>
        .
      </p>
    </>
  )
}
