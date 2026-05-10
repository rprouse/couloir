import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts'
import type { LineStringZ } from '../../types'
import { cumulativeDistanceMeters } from '../../utils/geo'
import styles from './ElevationProfile.module.css'

interface Props {
  geojson: LineStringZ
  height?: number
}

export function ElevationProfile({ geojson, height = 160 }: Props): JSX.Element {
  if (geojson.coordinates.length < 2) {
    return <div className={styles.empty}>Profile unavailable (need ≥ 2 points).</div>
  }
  const distances = cumulativeDistanceMeters(geojson)
  const data = distances.map((d, i) => ({
    distanceKm: d / 1000,
    elevationM: geojson.coordinates[i][2],
  }))

  return (
    <div className={styles.wrap} data-testid="elevation-profile">
      <ResponsiveContainer width="100%" height={height}>
        <LineChart data={data} margin={{ top: 8, right: 8, bottom: 16, left: 8 }}>
          <XAxis
            dataKey="distanceKm"
            type="number"
            domain={['dataMin', 'dataMax']}
            tickFormatter={(v: number) => `${v.toFixed(1)} km`}
            stroke="var(--color-text-dim)"
            tick={{ fontSize: 11 }}
          />
          <YAxis
            dataKey="elevationM"
            type="number"
            domain={['auto', 'auto']}
            tickFormatter={(v: number) => `${Math.round(v)} m`}
            stroke="var(--color-text-dim)"
            tick={{ fontSize: 11 }}
          />
          <Tooltip
            contentStyle={{
              background: 'var(--color-bg-2)',
              border: '1px solid var(--color-border)',
            }}
            formatter={(v: number, key: string) =>
              key === 'elevationM' ? `${Math.round(v)} m` : `${v.toFixed(2)} km`
            }
          />
          <Line
            type="monotone"
            dataKey="elevationM"
            stroke="var(--color-accent)"
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
