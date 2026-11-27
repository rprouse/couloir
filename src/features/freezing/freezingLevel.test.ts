import {
  FORECAST_HOURS,
  computeFreezingLevel,
  distanceKm,
  fetchFreezingForecast,
  freezingForecastUrl,
  hourAt,
  parseFreezingForecast,
} from './freezingLevel'

describe('computeFreezingLevel', () => {
  it('interpolates between the levels where it drops through 0 °C', () => {
    // Ground 1000 m at 5 °C, 1500 m at 2 °C, 3000 m at -10 °C.
    expect(computeFreezingLevel(1000, 5, [1500, 3000, 4200, 5600], [2, -10, -20, -30])).toEqual({
      levelM: 1750,
      belowGround: false,
    })
  })

  it('interpolates between the ground and the first level', () => {
    expect(computeFreezingLevel(1000, 4, [2000, 3000], [-6, -10])).toEqual({ levelM: 1400, belowGround: false })
  })

  it('skips pressure levels at or below the ground', () => {
    // 850 hPa at 900 m is extrapolated under the 1000 m ground; ignore its 10 °C.
    expect(computeFreezingLevel(1000, -2, [900, 3000], [10, -10])).toEqual({ levelM: 1000, belowGround: true })
  })

  it('takes the highest crossing when there is an inversion', () => {
    // Freezing at the ground, warm layer aloft, freezing again above it.
    expect(computeFreezingLevel(1000, -3, [1500, 2500], [3, -7])).toEqual({ levelM: 1800, belowGround: false })
  })

  it('reports the top level when it is above freezing all the way up', () => {
    expect(computeFreezingLevel(1000, 20, [1500, 3000], [15, 5])).toEqual({ levelM: 3000, belowGround: false })
  })

  it('ignores missing values, and returns null with none', () => {
    expect(computeFreezingLevel(1000, null, [1500, null], [null, -5])).toEqual({ levelM: null, belowGround: false })
    expect(computeFreezingLevel(1000, null, [2000, 3000], [4, -6])).toEqual({ levelM: 2400, belowGround: false })
  })
})

describe('freezingForecastUrl', () => {
  it('asks Open-Meteo for GEM pressure levels at the point', () => {
    const url = new URL(freezingForecastUrl(49.50412, -115.0631))
    expect(url.origin + url.pathname).toBe('https://api.open-meteo.com/v1/forecast')
    expect(url.searchParams.get('latitude')).toBe('49.50')
    expect(url.searchParams.get('longitude')).toBe('-115.06')
    expect(url.searchParams.get('models')).toBe('gem_seamless')
    expect(url.searchParams.get('forecast_hours')).toBe(String(FORECAST_HOURS + 1))
    expect(url.searchParams.get('timeformat')).toBe('unixtime')
    const hourly = url.searchParams.get('hourly')!.split(',')
    expect(hourly).toContain('temperature_2m')
    expect(hourly).toContain('temperature_700hPa')
    expect(hourly).toContain('geopotential_height_500hPa')
  })
})

const body = {
  elevation: 1018,
  hourly: {
    time: [1_800_000_000, 1_800_003_600],
    temperature_2m: [4, -1],
    temperature_850hPa: [2, -3],
    temperature_700hPa: [-10, -12],
    temperature_600hPa: [-18, -20],
    temperature_500hPa: [-28, -30],
    geopotential_height_850hPa: [1500, 1500],
    geopotential_height_700hPa: [3000, 3000],
    geopotential_height_600hPa: [4200, 4200],
    geopotential_height_500hPa: [5600, 5600],
  },
}

describe('parseFreezingForecast', () => {
  it('computes a level for every hour', () => {
    const f = parseFreezingForecast(body, 49.5, -115.06, 123)
    expect(f).toMatchObject({ lat: 49.5, lng: -115.06, groundElevation: 1018, fetchedAt: 123 })
    expect(f.hours).toEqual([
      { time: 1_800_000_000_000, levelM: 1750, belowGround: false },
      { time: 1_800_003_600_000, levelM: 1018, belowGround: true },
    ])
  })

  it('rejects an Open-Meteo error or an empty forecast', () => {
    expect(() => parseFreezingForecast({ error: true, reason: 'bad model' }, 0, 0, 0)).toThrow(
      'Open-Meteo: bad model',
    )
    expect(() => parseFreezingForecast({ hourly: { time: [] } }, 0, 0, 0)).toThrow(/no hours/)
    expect(() => parseFreezingForecast(null, 0, 0, 0)).toThrow()
  })
})

describe('fetchFreezingForecast', () => {
  it('fetches with the abort signal and parses', async () => {
    const fetchFn = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response)
    const signal = new AbortController().signal
    const f = await fetchFreezingForecast(49.5, -115.06, fetchFn, signal)
    expect(f.hours).toHaveLength(2)
    expect(fetchFn).toHaveBeenCalledWith(expect.stringContaining('latitude=49.50'), { signal })
  })

  it('rejects on HTTP errors', async () => {
    const fetchFn = vi.fn(async () => ({ ok: false, status: 429, json: async () => ({}) }) as Response)
    await expect(fetchFreezingForecast(49.5, -115.06, fetchFn)).rejects.toThrow('Open-Meteo returned 429')
  })
})

describe('hourAt', () => {
  const f = parseFreezingForecast(body, 49.5, -115.06, 0)
  it('picks the nearest hour', () => {
    expect(hourAt(f, 1_800_000_000_000 + 20 * 60_000)?.levelM).toBe(1750)
    expect(hourAt(f, 1_800_000_000_000 + 40 * 60_000)?.levelM).toBe(1018)
  })
  it('returns null outside the forecast or without one', () => {
    expect(hourAt(f, 1_800_000_000_000 + 10 * 3600_000)).toBeNull()
    expect(hourAt(null, 0)).toBeNull()
  })
})

describe('distanceKm', () => {
  it('measures great-circle distance', () => {
    // One degree of latitude is ~111 km.
    expect(distanceKm(49, -115, 50, -115)).toBeCloseTo(111.2, 0)
    expect(distanceKm(49.5, -115, 49.5, -115)).toBe(0)
  })
})
