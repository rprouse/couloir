import { deleteTag } from './deleteTag'
import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'
import { InMemoryStorageProvider } from '../../storage/memory'
import { setStorage, clearStorage, getStorage } from '../../storage/provider'

describe('deleteTag', () => {
  beforeEach(async () => {
    const storage = new InMemoryStorageProvider()
    await storage.init()
    setStorage(storage)
    useTagsStore.setState({ tags: [], loading: false, error: null })
    useRoutesStore.setState({ routes: [], loading: false, error: null })
    useTracksStore.setState({ tracks: [], loading: false, error: null })
    useWaypointsStore.setState({ waypoints: [], loading: false, error: null })
    usePhotosStore.setState({ photos: [], loading: false, error: null })
    useUiStore.setState(useUiStore.getInitialState())
  })
  afterEach(() => clearStorage())

  it('deletes the tag, cascades in storage, and strips it from loaded entities', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#EF4444' })
    const route = await useRoutesStore.getState().add({
      user_id: 'local', name: 'R', description: '',
      geojson: { type: 'LineString', coordinates: [[-116, 49.5, 1500], [-116.01, 49.51, 1600]] },
      source_hash: 'h', source_filename: null, color: '#E05C2A', ates: null, technical_difficulty: null,
      distance_m: 0, elevation_gain_m: 0, elevation_loss_m: 0, tags: [tag.id],
    })

    await deleteTag(tag.id)

    expect(useTagsStore.getState().tags).toHaveLength(0)
    expect(useRoutesStore.getState().routes.find((r) => r.id === route.id)?.tags).toEqual([])
    expect((await getStorage().getRoute(route.id))?.tags).toEqual([])
  })

  it('drops the tag from every layer filter', async () => {
    const tag = await useTagsStore.getState().add({ name: 'Steep', color: '#EF4444' })
    useUiStore.getState().setTagFilter('routes', [tag.id])
    await deleteTag(tag.id)
    expect(useUiStore.getState().tagFilters.routes).toEqual([])
  })
})
