import { useEffect, useRef } from 'react'
import Map, { Layer, Source } from 'react-map-gl/maplibre'
import 'maplibre-gl/dist/maplibre-gl.css'
import { RISK_FILL_EXPRESSION } from '../lib/scoring'

// Free, no-key vector basemap (CARTO's Dark Matter style) on MapLibre GL JS
// — same choice as the reference NYC-Electrification-Map project, for the
// same reason: no token, no account, no usage-based billing.
const MAP_STYLE = 'https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json'

const US_INITIAL_VIEW = { longitude: -98, latitude: 39, zoom: 3.2 }

const fillLayer = {
  id: 'county-fill',
  type: 'fill',
  paint: {
    'fill-color': RISK_FILL_EXPRESSION,
    'fill-opacity': 0.65,
  },
}

const lineLayer = {
  id: 'county-outline',
  type: 'line',
  paint: {
    'line-color': '#0a0a0a',
    'line-width': 1,
  },
}

const highlightLayer = {
  id: 'county-highlight',
  type: 'line',
  paint: {
    'line-color': '#f5f5f5',
    'line-width': 2.5,
  },
}

// Counties are scattered across the whole country (unlike the reference
// project's single-city scope), so the initial view fits to the actual data
// bounds instead of a fixed center/zoom.
function boundsOf(geojson) {
  let minLng = Infinity
  let minLat = Infinity
  let maxLng = -Infinity
  let maxLat = -Infinity

  const visit = (coords) => {
    if (typeof coords[0] === 'number') {
      const [lng, lat] = coords
      if (lng < minLng) minLng = lng
      if (lng > maxLng) maxLng = lng
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    } else {
      coords.forEach(visit)
    }
  }

  geojson.features.forEach((f) => visit(f.geometry.coordinates))
  if (minLng === Infinity) return null
  return [
    [minLng, minLat],
    [maxLng, maxLat],
  ]
}

export default function CountyMap({ geojson, activeFips, onSelectCounty }) {
  const mapRef = useRef(null)
  const loadedRef = useRef(false)

  const fitToData = () => {
    if (!geojson || !mapRef.current) return
    const bounds = boundsOf(geojson)
    if (bounds) mapRef.current.fitBounds(bounds, { padding: 60, duration: 0 })
  }

  // The map mounts inside a flex layout before that layout's final size is
  // settled, so a fitBounds computed against the still-400x300 default
  // canvas picks the wrong zoom — resize first, then fit, and only once the
  // map has actually loaded (geojson can arrive before or after that).
  useEffect(() => {
    if (!loadedRef.current) return
    mapRef.current?.resize()
    fitToData()
  }, [geojson])

  if (!geojson) return null

  const highlightGeojson = {
    type: 'FeatureCollection',
    features: geojson.features.filter((f) => f.properties.STCOFIPS === activeFips),
  }

  return (
    <Map
      ref={mapRef}
      initialViewState={US_INITIAL_VIEW}
      mapStyle={MAP_STYLE}
      interactiveLayerIds={['county-fill']}
      onClick={(e) => {
        const feature = e.features?.[0]
        if (feature) onSelectCounty(feature.properties.STCOFIPS)
      }}
      onMouseEnter={(e) => {
        e.target.getCanvas().style.cursor = e.features?.length ? 'pointer' : ''
      }}
      onMouseLeave={(e) => {
        e.target.getCanvas().style.cursor = ''
      }}
      onLoad={() => {
        loadedRef.current = true
        mapRef.current?.resize()
        fitToData()
      }}
      style={{ width: '100%', height: '100%' }}
    >
      <Source id="counties" type="geojson" data={geojson}>
        <Layer {...fillLayer} />
        <Layer {...lineLayer} />
      </Source>
      <Source id="county-highlight" type="geojson" data={highlightGeojson}>
        <Layer {...highlightLayer} />
      </Source>
    </Map>
  )
}
