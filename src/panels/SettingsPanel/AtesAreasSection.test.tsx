import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import { act } from 'react'
import { strToU8, zipSync } from 'fflate'
import { __mocks__ } from '../../test/mocks/maplibre-gl'
import { setMap } from '../../hooks/useMap'
import { InMemoryStorageProvider } from '../../storage/memory'
import { clearStorage, setStorage } from '../../storage/provider'
import { buildAtesArea } from '../../storage/contract'
import { useAtesAreasStore } from '../../store/atesAreas'
import { useUiStore } from '../../store/ui'
import { subscribeToast } from '../../features/import/importToast'
import { ATES_FIXTURE_KML } from '../../utils/atesKml.fixture'
import { AtesAreasSection } from './AtesAreasSection'

const kmz = (kml: string) => new File([zipSync({ 'doc.kml': strToU8(kml) })], 'Fixture Basin.kmz')

describe('AtesAreasSection', () => {
  let storage: InMemoryStorageProvider
  let map: InstanceType<typeof __mocks__.MockMap>
  let toasts: (string | null)[]
  let unsubscribe: () => void

  beforeEach(async () => {
    storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    localStorage.clear()
    useUiStore.setState(useUiStore.getInitialState())
    useAtesAreasStore.setState({ areas: [], loading: false, error: null })
    map = new __mocks__.MockMap()
    act(() => setMap(map as never))
    toasts = []
    unsubscribe = subscribeToast((m) => toasts.push(m))
  })

  afterEach(() => {
    unsubscribe()
    clearStorage()
    act(() => setMap(null))
  })

  const pick = (files: File[]) =>
    fireEvent.change(screen.getByLabelText('ATES KMZ files'), { target: { files } })

  it('points to the Avalanche Canada Trip Planner', () => {
    render(<AtesAreasSection />)
    expect(screen.getByRole('link', { name: /trip planner/i }))
      .toHaveAttribute('href', 'https://avalanche.ca/planning/trip-planner')
    expect(screen.queryByRole('list', { name: 'ATES areas' })).toBeNull()
  })

  it('imports a picked KMZ and lists it with its zone counts', async () => {
    render(<AtesAreasSection />)
    pick([kmz(ATES_FIXTURE_KML)])
    const list = await screen.findByRole('list', { name: 'ATES areas' })
    expect(within(list).getByText('Fixture Basin')).toBeInTheDocument()
    const counts = within(list).getByRole('list', { name: 'Fixture Basin zones' })
    expect(counts).toHaveTextContent('2 simple')
    expect(counts).toHaveTextContent('3 challenging')
    expect(counts).toHaveTextContent('1 complex')
    expect(counts).toHaveTextContent('1 extreme')
    expect(toasts[0]).toBe('Imported Fixture Basin (7 zones, 1 skipped).')
  })

  it('reports a file that is not an ATES KMZ', async () => {
    render(<AtesAreasSection />)
    pick([new File(['nope'], 'bad.kmz')])
    await waitFor(() => expect(toasts[0]).toMatch(/^bad\.kmz: This file is not a KMZ/))
    expect(useAtesAreasStore.getState().areas).toEqual([])
  })

  it('frames an area on the map', () => {
    useAtesAreasStore.setState({ areas: [buildAtesArea()] })
    render(<AtesAreasSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Show on map' }))
    expect(map.fitBounds).toHaveBeenCalledWith([[-116, 49.5], [-115.99, 49.51]], { padding: 40 })
  })

  it('deletes an area after confirming', async () => {
    await storage.saveAtesArea(buildAtesArea())
    useAtesAreasStore.setState({ areas: [buildAtesArea()] })
    render(<AtesAreasSection />)
    fireEvent.click(screen.getByRole('button', { name: 'Delete Test Basin' }))
    fireEvent.click(screen.getByRole('button', { name: 'Cancel' }))
    expect(useAtesAreasStore.getState().areas).toHaveLength(1)

    fireEvent.click(screen.getByRole('button', { name: 'Delete Test Basin' }))
    expect(screen.getByText('Delete Test Basin?')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Delete' }))
    await waitFor(() => expect(useAtesAreasStore.getState().areas).toEqual([]))
    expect(await storage.getAtesAreas()).toEqual([])
  })

  it('sets the zone opacity', () => {
    render(<AtesAreasSection />)
    fireEvent.change(screen.getByRole('slider', { name: 'ATES opacity' }), { target: { value: '0.7' } })
    expect(useUiStore.getState().atesOpacity).toBe(0.7)
  })
})
