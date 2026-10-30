import { DEFAULTS, type Route, type Track } from '../../types'
import { useRoutesStore } from '../../store/routes'
import { useTracksStore } from '../../store/tracks'
import { now } from '../../utils/time'

// A route and a track are the same line with different extras. Converting
// keeps the id, geometry, source, stats, tags and created_at; the colour
// becomes the new type's default, and fields the new type lacks are dropped
// (a route's ATES and technical ratings, a track's times).

export function routeToTrack(route: Route): Track {
  return {
    id: route.id,
    user_id: route.user_id,
    name: route.name,
    description: route.description,
    geojson: route.geojson,
    source_hash: route.source_hash,
    source_filename: route.source_filename,
    color: DEFAULTS.track.color,
    distance_m: route.distance_m,
    elevation_gain_m: route.elevation_gain_m,
    elevation_loss_m: route.elevation_loss_m,
    duration_s: null,
    moving_time_s: null,
    recorded_at: null,
    tags: route.tags,
    created_at: route.created_at,
    updated_at: now(),
  }
}

export function trackToRoute(track: Track): Route {
  return {
    id: track.id,
    user_id: track.user_id,
    name: track.name,
    description: track.description,
    geojson: track.geojson,
    source_hash: track.source_hash,
    source_filename: track.source_filename,
    color: DEFAULTS.route.color,
    ates: null,
    technical_difficulty: null,
    distance_m: track.distance_m,
    elevation_gain_m: track.elevation_gain_m,
    elevation_loss_m: track.elevation_loss_m,
    tags: track.tags,
    created_at: track.created_at,
    updated_at: now(),
  }
}

// Saves the converted line before deleting the original, so a failure part
// way leaves a duplicate rather than losing the line.
export async function convertRouteToTrack(route: Route): Promise<Track> {
  const track = routeToTrack(route)
  await useTracksStore.getState().insert(track)
  await useRoutesStore.getState().remove(route.id)
  return track
}

export async function convertTrackToRoute(track: Track): Promise<Route> {
  const route = trackToRoute(track)
  await useRoutesStore.getState().insert(route)
  await useTracksStore.getState().remove(track.id)
  return route
}
