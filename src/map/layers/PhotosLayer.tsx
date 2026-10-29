import { useEffect, useMemo } from 'react'
import type maplibregl from 'maplibre-gl'
import type { GeoJSONSource } from 'maplibre-gl'
import { useMap } from '../../hooks/useMap'
import { usePhotosStore } from '../../store/photos'
import { useUiStore } from '../../store/ui'
import type { Photo } from '../../types'
import { buildPhotosGeoJson } from './photosLayerData'
import { buildPhotoArrowIcon } from './photoIcons'
import {
  PHOTO_ARROW_ICON,
  PHOTO_ARROW_MIN_ZOOM,
  PHOTO_ARROW_PIXEL_RATIO,
  PHOTO_DOT_COLOR,
  PHOTO_DOT_RADIUS,
  PHOTO_DOT_STROKE,
  PHOTOS_ARROWS_LAYER_ID,
  PHOTOS_DOTS_LAYER_ID,
  PHOTOS_LAYER_IDS,
  PHOTOS_SOURCE_ID,
} from './layerStyles'
import { filterByTags } from '../../utils/tags'

function setPhotosData(map: maplibregl.Map, photos: Photo[]): void {
  const src = map.getSource(PHOTOS_SOURCE_ID)
  if (!src || src.type !== 'geojson') return
  ;(src as GeoJSONSource).setData(buildPhotosGeoJson(photos) as never)
}

// Linear zoom ramp from PHOTO_DOT_RADIUS.minZoom to PHOTO_ARROW_MIN_ZOOM.
function zoomRamp(min: number, max: number): maplibregl.ExpressionSpecification {
  return ['interpolate', ['linear'], ['zoom'], PHOTO_DOT_RADIUS.minZoom, min, PHOTO_ARROW_MIN_ZOOM, max]
}

export function PhotosLayer(): null {
  const map = useMap()
  const photos = usePhotosStore((s) => s.photos)
  const tagFilter = useUiStore((s) => s.tagFilters.photos)
  const shown = useMemo(() => filterByTags(photos, tagFilter), [photos, tagFilter])
  const visible = useUiStore((s) => s.layerVisibility.photos)

  useEffect(() => {
    if (!map) return

    // Style swaps wipe every map image, source and layer, so this runs again
    // on each 'style.load'.
    const install = () => {
      if (map.getSource(PHOTOS_SOURCE_ID)) return
      if (!map.hasImage(PHOTO_ARROW_ICON)) {
        map.addImage(PHOTO_ARROW_ICON, buildPhotoArrowIcon(), { pixelRatio: PHOTO_ARROW_PIXEL_RATIO })
      }

      const visibility = useUiStore.getState().layerVisibility.photos ? 'visible' : 'none'

      map.addSource(PHOTOS_SOURCE_ID, {
        type: 'geojson',
        data: buildPhotosGeoJson(
          filterByTags(usePhotosStore.getState().photos, useUiStore.getState().tagFilters.photos),
        ) as never,
      })
      map.addLayer({
        id: PHOTOS_ARROWS_LAYER_ID,
        type: 'symbol',
        source: PHOTOS_SOURCE_ID,
        minzoom: PHOTO_ARROW_MIN_ZOOM,
        filter: ['has', 'bearing'],
        layout: {
          'icon-image': PHOTO_ARROW_ICON,
          'icon-rotate': ['get', 'bearing'],
          // Bearing is a compass direction, so the arrow turns with the map.
          'icon-rotation-alignment': 'map',
          'icon-pitch-alignment': 'viewport',
          'icon-allow-overlap': true,
          'icon-ignore-placement': true,
          visibility,
        },
      })
      map.addLayer({
        id: PHOTOS_DOTS_LAYER_ID,
        type: 'circle',
        source: PHOTOS_SOURCE_ID,
        layout: { visibility },
        paint: {
          'circle-color': PHOTO_DOT_COLOR,
          'circle-radius': zoomRamp(PHOTO_DOT_RADIUS.min, PHOTO_DOT_RADIUS.max),
          'circle-stroke-width': zoomRamp(PHOTO_DOT_STROKE.min, PHOTO_DOT_STROKE.max),
          'circle-stroke-color': '#FFFFFF',
        },
      })
    }

    if (map.isStyleLoaded()) install()
    map.on('style.load', install)

    const onDotClick = (
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

    map.on('click', PHOTOS_DOTS_LAYER_ID, onDotClick)
    map.on('mouseenter', PHOTOS_DOTS_LAYER_ID, onEnter)
    map.on('mouseleave', PHOTOS_DOTS_LAYER_ID, onLeave)

    return () => {
      map.off('style.load', install)
      map.off('click', PHOTOS_DOTS_LAYER_ID, onDotClick)
      map.off('mouseenter', PHOTOS_DOTS_LAYER_ID, onEnter)
      map.off('mouseleave', PHOTOS_DOTS_LAYER_ID, onLeave)
    }
  }, [map])

  // Sync data whenever the photos or the photos tag filter change.
  useEffect(() => {
    if (!map) return
    setPhotosData(map, shown)
  }, [map, shown])

  useEffect(() => {
    if (!map) return
    for (const id of PHOTOS_LAYER_IDS) {
      if (map.getLayer(id)) map.setLayoutProperty(id, 'visibility', visible ? 'visible' : 'none')
    }
  }, [map, visible])

  return null
}
