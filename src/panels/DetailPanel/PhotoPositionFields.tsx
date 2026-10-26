import { useEffect, useState } from 'react'
import shared from './DetailPanel.shared.module.css'
import { draftNumber, useUiStore } from '../../store/ui'

const fmt = (n: number | null) => (n === null ? '' : n.toFixed(6))

// Lat/lng inputs bound to panel.draft — the same values the draggable map pin
// reads and writes. Typed values commit on blur so partial input ("49.") is
// never pushed to the pin; invalid input reverts to the draft.
export function PhotoPositionFields(): JSX.Element {
  const lat = useUiStore((s) => draftNumber(s.panel, 'lat'))
  const lng = useUiStore((s) => draftNumber(s.panel, 'lng'))
  const updateDraft = useUiStore((s) => s.updateDraft)
  const [latText, setLatText] = useState(fmt(lat))
  const [lngText, setLngText] = useState(fmt(lng))

  // A pin drag rewrites the draft; mirror it into the inputs.
  useEffect(() => setLatText(fmt(lat)), [lat])
  useEffect(() => setLngText(fmt(lng)), [lng])

  const commit = (key: 'lat' | 'lng', text: string, limit: number) => {
    const n = Number(text)
    if (text.trim() !== '' && Number.isFinite(n) && Math.abs(n) <= limit) {
      updateDraft({ [key]: n })
    } else if (key === 'lat') {
      setLatText(fmt(lat))
    } else {
      setLngText(fmt(lng))
    }
  }

  return (
    <div className={shared.row}>
      <label className={shared.field}>
        <span>Latitude</span>
        <input
          inputMode="decimal"
          value={latText}
          onChange={(e) => setLatText(e.target.value)}
          onBlur={(e) => commit('lat', e.target.value, 90)}
        />
      </label>
      <label className={shared.field}>
        <span>Longitude</span>
        <input
          inputMode="decimal"
          value={lngText}
          onChange={(e) => setLngText(e.target.value)}
          onBlur={(e) => commit('lng', e.target.value, 180)}
        />
      </label>
    </div>
  )
}
