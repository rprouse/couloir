import { useEffect, useMemo, useRef } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'
import { getStorage } from '../../storage/provider'
import { PHOTO_CLUSTER, type Photo } from '../../types'
import { buildPhotosGeoJson, photoIconName } from './photosLayerData'
import { buildPhotoIcon, loadPhotoIcon } from './photoIcons'
import {
  PHOTO_CLUSTER_FONT,
  PHOTO_CLUSTER_STEPS,
  PHOTO_ICON_PIXEL_RATIO,
  PHOTO_PLACEHOLDER_ICON,
  PHOTOS_CLUSTER_COUNT_LAYER_ID,
  PHOTOS_CLUSTERS_LAYER_ID,
  PHOTOS_LAYER_IDS,
  PHOTOS_SOURCE_ID,
  PHOTOS_THUMBNAILS_LAYER_ID,
} from './layerStyles'
import { debug } from '../../utils/debug'
import { filterByTags } from '../../utils/tags'

const ICON_OPTS = { pixelRatio: PHOTO_ICON_PIXEL_RATIO }

function addImageOnce(map: maplibregl.Map, name: string, data: ImageData): void {
  if (!map.hasImage(name)) map.addImage(name, data, ICON_OPTS)
}

function setPhotosData(map: maplibregl.Map, photos: Photo[]): void {
  const src = map.getSource(PHOTOS_SOURCE_ID)
  if (!src || src.type !== 'geojson') return
  ;(src as GeoJSONSource).setData(buildPhotosGeoJson(photos) as never)
}

export function PhotosLayer(): null {
  const map = useMap()
  const photos = usePhotosStore((s) => s.photos)
  const tagFilter = useUiStore((s) => s.tagFilters.photos)
  const shown = useMemo(() => filterByTags(photos, tagFilter), [photos, tagFilter])
  const visible = useUiStore((s) => s.layerVisibility.photos)

  // Framed thumbnail pixels by photo id. Survives style swaps (which wipe
  // every map image), so re-registering after a basemap change is
  // synchronous and doesn't re-fetch thumbnails from the server.
  const icons = useRef(new Map<string, ImageData>())

  useEffect(() => {
    if (!map) return

    const install = () => {
      if (map.getSource(PHOTOS_SOURCE_ID)) return
      addImageOnce(map, PHOTO_PLACEHOLDER_ICON, buildPhotoIcon(null))
      for (const [id, data] of icons.current) addImageOnce(map, photoIconName(id), data)

      const visibility = useUiStore.getState().layerVisibility.photos ? 'visible' : 'none'
      const { colors, radii, thresholds } = PHOTO_CLUSTER_STEPS

      map.addSource(PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: buildPhotosGeoJson(
          filterByTags(usePhotosStore.getState().photos, useUiStore.getState().tagFilters.photos),
        ) as never,
        cluster: true,
        clusterMaxZoom: PHOTO_CLUSTER.clusterMaxZoom,
        clusterRadius: PHOTO_CLUSTER.clusterRadius,
      })
      map.addLayer({
        id: PHOTOS_CLUSTERS_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: { visibility },
        paint: {
          'circle-color': ['step', ['get', 'point_count'], colors[0], thresholds[0], colors[1], thresholds[1], colors[2]],
          'circle-radius': ['step', ['get', 'point_count'], radii[0], thresholds[0], radii[1], thresholds[1], radii[2]],
          'circle-stroke-width': 2,
          'circle-stroke-color': '#FFFFFF',
        },
      })
      map.addLayer({
        id: PHOTOS_CLUSTER_COUNT_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        filter: ['has', 'point_count'],
        layout: {
          'text-field': ['get', 'point_count_abbreviated'],
          'text-font': PHOTO_CLUSTER_FONT,
          'text-size': 12,
          'text-allow-overlap': true,
          visibility,
        },
        paint: { 'text-color': '#FFFFFF' },
      })
      map.addLayer({
        id: PHOTOS_THUMBNAILS_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        filter: ['!', ['has', 'point_count']],
        layout: {
          // Placeholder until the thumbnail is decoded and registered.
          'icon-image': ['coalesce', ['image', ['get', 'icon']], ['image', PHOTO_PLACEHOLDER_ICON]],
          'icon-allow-overlap': true,
          visibility,
        },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    const onClusterClick = async (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const feature = e.features?.[0]
      const clusterId = feature?.properties?.cluster_id
      if (typeof clusterId !== 'number' || feature?.geometry.type !== 'Point') return
      const src = map.getSource(PHOTOS_SOURCE_ID) as GeoJSONSource | undefined
      if (!src) return
      try {
        // The zoom at which this cluster splits — easing there satisfies
        // "click zooms in and the cluster splits naturally".
        const zoom = await src.getClusterExpansionZoom(clusterId)
        map.easeTo({ center: feature.geometry.coordinates as [number, number], zoom })
      } catch (err) {
        debug('cluster expansion failed', err)
      }
    }

    const onThumbClick = (
      e: maplibregl.MapMouseEvent & { features?: maplibregl.MapGeoJSONFeature[] },
    ) => {
      if (useUiStore.getState().placement.mode !== 'idle') return
      const id = e.features?.[0]?.properties?.id
      if (typeof id === 'string') useUiStore.getState().openEntity('photo', id)
    }

    const onEnter = () => {
      if (useUiStore.getState().placement.mode === 'idle') map.getCanvas().style.cursor = 'pointer'
    }
    const onLeave = () => {
      // Don't clobber the placement-mode crosshair.
      if (useUiStore.getState().placement.mode === 'idle') map.getCanvas().style.cursor = ''
    }

    map.on('click', PHOTOS_CLUSTERS_LAYER_ID, onClusterClick)
    map.on('click', PHOTOS_THUMBNAILS_LAYER_ID, onThumbClick)
    for (const id of [PHOTOS_CLUSTERS_LAYER_ID, PHOTOS_THUMBNAILS_LAYER_ID]) {
      map.on('mouseenter', id, onEnter)
      map.on('mouseleave', id, onLeave)
    }

    return () => {
      map.off('style.load', install)
      map.off('click', PHOTOS_CLUSTERS_LAYER_ID, onClusterClick)
      map.off('click', PHOTOS_THUMBNAILS_LAYER_ID, onThumbClick)
      for (const id of [PHOTOS_CLUSTERS_LAYER_ID, PHOTOS_THUMBNAILS_LAYER_ID]) {
        map.off('mouseenter', id, onEnter)
        map.off('mouseleave', id, onLeave)
      }
    }
  }, [map])

  // Sync data whenever the photos or the photos tag filter change.
  useEffect(() => {
    if (!map) return
    setPhotosData(map, shown)
  }, [map, shown])

  // Decode any thumbnails not yet cached. Keyed off the unfiltered photos so
  // clearing a tag filter shows thumbnails immediately. Each icon is
  // registered as it lands; a final setData forces symbol re-placement so the
  // coalesce expression picks up the new images.
  useEffect(() => {
    if (!map) return

    const live = new Set(photos.map((p) => p.id))
    for (const id of [...icons.current.keys()]) {
      if (live.has(id)) continue
      icons.current.delete(id)
      if (map.hasImage(photoIconName(id))) map.removeImage(photoIconName(id))
    }

    const missing = photos.filter((p) => !icons.current.has(p.id))
    if (missing.length === 0) return
    let cancelled = false
    void Promise.allSettled(
      missing.map(async (p) => {
        const thumb = await getStorage().getPhotoThumb(p.id)
        if (!thumb || cancelled) return
        const data = await loadPhotoIcon(thumb)
        if (cancelled) return
        icons.current.set(p.id, data)
        addImageOnce(map, photoIconName(p.id), data)
      }),
    ).then((results) => {
      for (const r of results) if (r.status === 'rejected') debug('photo thumb load failed', r.reason)
      if (!cancelled) {
        setPhotosData(
          map,
          filterByTags(usePhotosStore.getState().photos, useUiStore.getState().tagFilters.photos),
        )
      }
    })
    return () => {
      cancelled = true
    }
  }, [map, photos])

  useEffect(() => {
    if (!map) return
    for (const id of PHOTOS_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  return null
}
