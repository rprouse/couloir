import { buildTracksGeoJson } from './tracksLayerData'
import type { Track } from '../../types'

const baseTrack = (over: Partial<Track> = {}): Track => ({
  id: 't1',
  user_id: 'local',
  name: 't',
  description: '',
  geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116, 49.51, 1510]] },
  source_hash: 'h',
  source_filename: null,
  color: '#2A7BE0',
  distance_m: 100,
  elevation_gain_m: 10,
  elevation_loss_m: 0,
  duration_s: null,
  moving_time_s: null,
  recorded_at: null,
  tags: [],
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  ...over,
})

describe('buildTracksGeoJson', () => {
  it('returns one feature per track with id + color properties', () => {
    const fc = buildTracksGeoJson([
      baseTrack({ id: 'a', color: '#111111' }),
      baseTrack({ id: 'b', color: '#222222' }),
    ])
    expect(fc.features).toHaveLength(2)
    expect(fc.features[0].properties).toEqual({ id: 'a', color: '#111111' })
    expect(fc.features[1].properties).toEqual({ id: 'b', color: '#222222' })
  })

  it('returns an empty collection for no tracks', () => {
    const fc = buildTracksGeoJson([])
    expect(fc).toEqual({ type: 'FeatureCollection', features: [] })
  })
})
