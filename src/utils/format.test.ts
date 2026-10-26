import { formatDistanceKm, formatElevationM, formatDuration, isValidHex, formatBearing, formatDateTime, formatBytes } from './format'

describe('formatDistanceKm', () => {
  it('returns 0.0 km for 0 m', () => {
    expect(formatDistanceKm(0)).toBe('0.0 km')
  })
  it('rounds to one decimal', () => {
    expect(formatDistanceKm(1234)).toBe('1.2 km')
    expect(formatDistanceKm(99)).toBe('0.1 km')
  })
})

describe('formatElevationM', () => {
  it('returns rounded integer metres', () => {
    expect(formatElevationM(0)).toBe('0 m')
    expect(formatElevationM(1499.6)).toBe('1500 m')
  })
})

describe('formatDuration', () => {
  it('renders short durations as Xm', () => {
    expect(formatDuration(60)).toBe('1m')
    expect(formatDuration(59)).toBe('0m')
    expect(formatDuration(125)).toBe('2m')
  })
  it('renders multi-hour durations as Xh Ym', () => {
    expect(formatDuration(3600)).toBe('1h 0m')
    expect(formatDuration(3661)).toBe('1h 1m')
    expect(formatDuration(22_320)).toBe('6h 12m')
  })
  it('renders null as em-dash', () => {
    expect(formatDuration(null)).toBe('—')
  })
})

describe('isValidHex', () => {
  it('accepts 6-digit RGB hex with leading hash', () => {
    expect(isValidHex('#A1b2c3')).toBe(true)
    expect(isValidHex('#000000')).toBe(true)
  })
  it('rejects bad shapes', () => {
    expect(isValidHex('A1b2c3')).toBe(false)   // no hash
    expect(isValidHex('#fff')).toBe(false)      // shorthand not allowed
    expect(isValidHex('#abcdefg')).toBe(false)  // too long
    expect(isValidHex('')).toBe(false)
  })
})

describe('formatBearing', () => {
  it.each([[0, '0° N'], [120, '120° ESE'], [271, '271° W'], [349, '349° N']])('%s → %s', (deg, out) => {
    expect(formatBearing(deg)).toBe(out)
  })
})

describe('formatDateTime', () => {
  it('renders a human date including the year', () => {
    expect(formatDateTime(new Date(2026, 1, 14, 9, 31).toISOString())).toMatch(/2026/)
  })
})

describe('formatBytes', () => {
  it.each([[512, '512 B'], [2048, '2 KB'], [5_400_000, '5.1 MB'], [3_221_225_472, '3.0 GB']])('%s → %s', (n, out) => {
    expect(formatBytes(n)).toBe(out)
  })
})
