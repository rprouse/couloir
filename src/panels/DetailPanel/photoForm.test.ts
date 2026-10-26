import { parsePhotoForm, valuesFromPhoto, type PhotoFormValues } from './photoForm'

const base: PhotoFormValues = { name: 'Lone Tree', description: '', bearing: '', takenAt: '', elevation: '' }

describe('parsePhotoForm', () => {
  it('requires a non-blank name', () => {
    expect(parsePhotoForm({ ...base, name: '  ' })).toBeNull()
  })
  it('maps blank optional fields to null', () => {
    expect(parsePhotoForm(base)).toEqual({
      name: 'Lone Tree', description: '', bearing: null, taken_at: null, elevation_m: null,
    })
  })
  it('parses bearing, elevation and taken-at', () => {
    expect(parsePhotoForm({ ...base, bearing: '271', elevation: '1834', takenAt: '2026-02-14T09:31:05' }))
      .toMatchObject({ bearing: 271, elevation_m: 1834, taken_at: new Date(2026, 1, 14, 9, 31, 5).toISOString() })
  })
  it.each(['360', '-1', 'abc'])('rejects bearing %s', (bearing) => {
    expect(parsePhotoForm({ ...base, bearing })).toBeNull()
  })
  it('rejects a non-numeric elevation', () => {
    expect(parsePhotoForm({ ...base, elevation: 'high' })).toBeNull()
  })
  it('wraps 359.6 to 0', () => {
    expect(parsePhotoForm({ ...base, bearing: '359.6' })?.bearing).toBe(0)
  })
})

describe('valuesFromPhoto', () => {
  it('formats stored values for the inputs', () => {
    expect(valuesFromPhoto({
      name: 'A', description: 'd', bearing: 90, elevation_m: 1500.4,
      taken_at: new Date(2026, 1, 14, 9, 31, 5).toISOString(),
    })).toEqual({ name: 'A', description: 'd', bearing: '90', elevation: '1500', takenAt: '2026-02-14T09:31:05' })
  })
})
