import { formatLatLng, parseLatLng } from './coords'

describe('parseLatLng', () => {
  it.each([
    ['49.50400, -115.06300', 49.504, -115.063],
    ['49.504,-115.063', 49.504, -115.063],
    ['  49.504   -115.063 ', 49.504, -115.063],
    ['49.504° N, 115.063° W', 49.504, -115.063],
    ['33.9S, 18.4E', -33.9, 18.4],
    ['50, 8', 50, 8],
  ])('parses %j', (text, lat, lng) => {
    expect(parseLatLng(text)).toEqual({ lat, lng })
  })

  it.each([
    '',
    '49.504',
    '49.504, -115.063, 1500',
    'abc, def',
    '91, 0',
    '0, 181',
    '49.5 E, 115 N',
    '-49.5 N, 115 W',
  ])('rejects %j', (text) => {
    expect(parseLatLng(text)).toBeNull()
  })

  it('round-trips formatLatLng', () => {
    expect(parseLatLng(formatLatLng(49.5041234, -115.0631234))).toEqual({
      lat: 49.504123,
      lng: -115.063123,
    })
  })
})
