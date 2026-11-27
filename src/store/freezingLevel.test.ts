import {
  FREEZING_EVERYWHERE_M,
  needsRefetch,
  selectFreezingHour,
  selectTileLevel,
  useFreezingLevelStore,
} from './freezingLevel'
import type { FreezingForecast } from '../features/freezing/freezingLevel'

const T0 = 1_800_000_000_000
const HOUR = 3_600_000

const forecast = (overrides: Partial<FreezingForecast> = {}): FreezingForecast => ({
  lat: 49.5,
  lng: -115.06,
  groundElevation: 1018,
  fetchedAt: T0,
  hours: [
    { time: T0, levelM: 1750, belowGround: false },
    { time: T0 + HOUR, levelM: 1018, belowGround: true },
    { time: T0 + 2 * HOUR, levelM: null, belowGround: false },
  ],
  ...overrides,
})

const body = {
  elevation: 1018,
  hourly: {
    time: [T0 / 1000],
    temperature_2m: [4],
    temperature_850hPa: [2],
    temperature_700hPa: [-10],
    geopotential_height_850hPa: [1500],
    geopotential_height_700hPa: [3000],
  },
}

describe('useFreezingLevelStore', () => {
  beforeEach(() => {
    useFreezingLevelStore.setState(useFreezingLevelStore.getInitialState())
    vi.unstubAllGlobals()
  })
  afterEach(() => vi.unstubAllGlobals())

  it('loads the forecast for the rounded point', async () => {
    const fetchMock = vi.fn(async () => ({ ok: true, status: 200, json: async () => body }) as Response)
    vi.stubGlobal('fetch', fetchMock)
    await useFreezingLevelStore.getState().load(49.50412, -115.0631)
    const s = useFreezingLevelStore.getState()
    expect(s.loading).toBe(false)
    expect(s.error).toBeNull()
    expect(s.forecast).toMatchObject({ lat: 49.5, lng: -115.06 })
    expect(s.forecast?.hours[0].levelM).toBe(1750)
  })

  it('records an error and keeps the previous forecast', async () => {
    useFreezingLevelStore.setState({ forecast: forecast() })
    vi.stubGlobal('fetch', vi.fn(async () => ({ ok: false, status: 500 }) as Response))
    await useFreezingLevelStore.getState().load(50, -116)
    const s = useFreezingLevelStore.getState()
    expect(s.error).toBe('Open-Meteo returned 500')
    expect(s.loading).toBe(false)
    expect(s.forecast?.lat).toBe(49.5)
  })

  it('drops a load superseded by a newer one', async () => {
    const pending: Array<(r: Response) => void> = []
    vi.stubGlobal(
      'fetch',
      vi.fn(() => new Promise<Response>((resolve) => pending.push(resolve))),
    )
    const first = useFreezingLevelStore.getState().load(49, -115)
    const second = useFreezingLevelStore.getState().load(51, -117)
    const ok = { ok: true, status: 200, json: async () => body } as Response
    pending[1](ok)
    await second
    pending[0](ok)
    await first
    expect(useFreezingLevelStore.getState().forecast).toMatchObject({ lat: 51, lng: -117 })
  })

  it('clamps the hour offset to the forecast range', () => {
    const { setHourOffset } = useFreezingLevelStore.getState()
    setHourOffset(-3)
    expect(useFreezingLevelStore.getState().hourOffset).toBe(0)
    setHourOffset(500)
    expect(useFreezingLevelStore.getState().hourOffset).toBe(72)
  })
})

describe('freezing level selectors', () => {
  const base = { forecast: forecast(), now: T0 }
  it('picks the hour at now plus the offset', () => {
    expect(selectFreezingHour({ ...base, hourOffset: 0 })?.levelM).toBe(1750)
    expect(selectTileLevel({ ...base, hourOffset: 0 })).toBe(1750)
  })
  it('splits below all terrain when it is freezing at the ground', () => {
    expect(selectTileLevel({ ...base, hourOffset: 1 })).toBe(FREEZING_EVERYWHERE_M)
  })
  it('has no tile level without data', () => {
    expect(selectTileLevel({ ...base, hourOffset: 2 })).toBeNull()
    expect(selectTileLevel({ forecast: null, now: T0, hourOffset: 0 })).toBeNull()
  })
})

describe('needsRefetch', () => {
  const idle = { loading: false, target: null }
  it('fetches with no forecast', () => {
    expect(needsRefetch({ ...idle, forecast: null }, 49.5, -115, T0)).toBe(true)
  })
  it('keeps a recent forecast for a nearby point', () => {
    expect(needsRefetch({ ...idle, forecast: forecast() }, 49.55, -115.1, T0 + 30 * 60_000)).toBe(false)
  })
  it('refetches once the map moves more than 10 km away', () => {
    expect(needsRefetch({ ...idle, forecast: forecast() }, 49.7, -115.06, T0)).toBe(true)
  })
  it('refetches after an hour', () => {
    expect(needsRefetch({ ...idle, forecast: forecast() }, 49.5, -115.06, T0 + HOUR + 1)).toBe(true)
  })
  it('waits for an in-flight load for about here', () => {
    const loading = { loading: true, target: { lat: 49.5, lng: -115.06 }, forecast: null }
    expect(needsRefetch(loading, 49.52, -115.06, T0)).toBe(false)
    expect(needsRefetch(loading, 50.5, -115.06, T0)).toBe(true)
  })
})
