import { useTagsStore } from '../../store/tags'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { useWaypointsStore } from '../../store/waypoints'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'

// Deletes a tag everywhere. Storage drops the entity_tags rows via ON DELETE
// CASCADE; this mirrors that in the loaded slices so pills and filters stop
// referencing the tag without reloading every entity.
export async function deleteTag(tagId: string): Promise<void> {
  await useTagsStore.getState().remove(tagId)
  const strip = <T extends { tags: string[] }>(items: T[]): T[] =>
    items.map((it) => (it.tags.includes(tagId) ? { ...it, tags: it.tags.filter((t) => t !== tagId) } : it))
  useRoutesStore.setState((s) => ({ routes: strip(s.routes) }))
  useTracksStore.setState((s) => ({ tracks: strip(s.tracks) }))
  useWaypointsStore.setState((s) => ({ waypoints: strip(s.waypoints) }))
  usePhotosStore.setState((s) => ({ photos: strip(s.photos) }))
  useUiStore.getState().pruneTagFromFilters(tagId)
}
