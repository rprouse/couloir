import { styleUrl, terrainSourceUrl, validateStyle } from './mapConfig'

describe('mapConfig — URL builders', () => {
  it('builds the outdoor style URL with the key', () => {
    expect(styleUrl('outdoor', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/outdoor-v2/style.json?key=KEY123',
    )
  })

  it('builds the satellite style URL with the key', () => {
    expect(styleUrl('satellite', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/satellite/style.json?key=KEY123',
    )
  })

  it('builds the winter style URL with the key', () => {
    expect(styleUrl('winter', 'KEY123')).toBe(
      'https://api.maptiler.com/maps/winter-v2/style.json?key=KEY123',
    )
  })

  it('builds the terrain source URL with the key', () => {
    expect(terrainSourceUrl('KEY123')).toBe(
      'https://api.maptiler.com/tiles/terrain-rgb-v2/tiles.json?key=KEY123',
    )
  })
})

describe('mapConfig — validateStyle', () => {
  it('resolves true on a 200 response', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, status: 200 })
    expect(await validateStyle('outdoor', 'GOOD', fetchMock)).toEqual({ ok: true })
  })

  it('resolves with status on a 401', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 401 })
    expect(await validateStyle('outdoor', 'BAD', fetchMock)).toEqual({ ok: false, status: 401 })
  })

  it('resolves with status on a 403 (quota / restriction)', async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: false, status: 403 })
    expect(await validateStyle('outdoor', 'OVERDUE', fetchMock)).toEqual({ ok: false, status: 403 })
  })

  it('resolves with networkError when fetch throws', async () => {
    const fetchMock = vi.fn().mockRejectedValue(new TypeError('network down'))
    expect(await validateStyle('outdoor', 'KEY', fetchMock)).toEqual({
      ok: false,
      networkError: true,
    })
  })
})
