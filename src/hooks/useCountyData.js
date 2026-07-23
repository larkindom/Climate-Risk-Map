import { useEffect, useState } from 'react'
import { calculateClimateRisk } from '../lib/scoring'

const DATA_URL = `${import.meta.env.BASE_URL}data/counties.geojson`

export function useCountyData() {
  const [geojson, setGeojson] = useState(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(null)

  useEffect(() => {
    let cancelled = false

    fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`Failed to load county data (${res.status})`)
        return res.json()
      })
      .then((data) => {
        if (cancelled) return
        const features = data.features.map((feature) => {
          const { score, breakdown } = calculateClimateRisk(feature.properties)
          return {
            ...feature,
            properties: {
              ...feature.properties,
              climate_risk_score: score,
              climate_risk_breakdown: breakdown,
            },
          }
        })
        setGeojson({ type: 'FeatureCollection', features })
      })
      .catch((err) => {
        if (!cancelled) setError(err.message)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [])

  const counties = geojson?.features.map((f) => f.properties) ?? []

  return { geojson, counties, loading, error }
}
