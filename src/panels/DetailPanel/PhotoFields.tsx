import { useId } from 'react'
import shared from './DetailPanel.shared.module.css'
import { CompassRose } from '../../components/CompassRose/CompassRose'
import { normalizeBearing } from '../../utils/geo'
import type { PhotoFormValues } from './photoForm'

interface Props {
  values: PhotoFormValues
  onChange: (patch: Partial<PhotoFormValues>) => void
}

// Metadata fields shared by the photo create and edit forms.
export function PhotoFields({ values, onChange }: Props): JSX.Element {
  const bearingId = useId()
  const typed = values.bearing.trim() === '' ? null : Number(values.bearing)
  const roseBearing = typed !== null && Number.isFinite(typed) ? normalizeBearing(typed) : null

  return (
    <section className={shared.section}>
      <label className={shared.field}>
        <span>Name</span>
        <input value={values.name} onChange={(e) => onChange({ name: e.target.value })} />
      </label>
      <label className={shared.field}>
        <span>Description</span>
        <textarea rows={3} value={values.description} onChange={(e) => onChange({ description: e.target.value })} />
      </label>
      <div className={shared.field}>
        <label htmlFor={bearingId}>Bearing (°)</label>
        <div className={shared.row}>
          <input
            id={bearingId}
            type="number"
            min={0}
            max={359}
            step={1}
            inputMode="numeric"
            placeholder="unknown"
            value={values.bearing}
            onChange={(e) => onChange({ bearing: e.target.value })}
          />
          <CompassRose bearing={roseBearing} size={72} onChange={(b) => onChange({ bearing: String(b) })} />
        </div>
      </div>
      <label className={shared.field}>
        <span>Taken</span>
        <input
          type="datetime-local"
          step={1}
          value={values.takenAt}
          onChange={(e) => onChange({ takenAt: e.target.value })}
        />
      </label>
      <label className={shared.field}>
        <span>Elevation (m)</span>
        <input
          type="number"
          inputMode="numeric"
          placeholder="optional"
          value={values.elevation}
          onChange={(e) => onChange({ elevation: e.target.value })}
        />
      </label>
    </section>
  )
}
