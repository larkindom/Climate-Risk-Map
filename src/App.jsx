import { useState } from 'react'
import CountyMap from './components/CountyMap'
import RiskScoreLegend from './components/RiskScoreLegend'
import RiskVsPriceChart from './components/RiskVsPriceChart'
import Sidebar from './components/Sidebar'
import { useCountyData } from './hooks/useCountyData'

export default function App() {
  const { geojson, counties, loading, error } = useCountyData()
  const [activeFips, setActiveFips] = useState(null)

  const activeCounty = counties.find((c) => c.STCOFIPS === activeFips) ?? null

  return (
    <div className="flex h-screen bg-neutral-950">
      <main className="relative min-w-0 flex-1">
        <div className="absolute left-4 top-4 z-10 max-w-sm rounded bg-neutral-900/90 px-4 py-3 shadow">
          <h1 className="text-sm font-semibold text-neutral-100">Climate Risk &amp; Housing Map</h1>
          <p className="mt-1 text-xs text-neutral-400">
            FEMA hazard risk overlaid on Redfin housing data across the core counties of the top 20 U.S. metros
            by population. Click a county to see its breakdown, or a point on the chart below.
          </p>
        </div>

        {loading && (
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded bg-neutral-900/90 px-4 py-2 text-sm text-neutral-100 shadow">
            Loading counties...
          </div>
        )}
        {error && (
          <div className="absolute left-1/2 top-4 z-10 -translate-x-1/2 rounded bg-red-900/90 px-4 py-2 text-sm text-neutral-100 shadow">
            {error}
          </div>
        )}

        <CountyMap geojson={geojson} activeFips={activeFips} onSelectCounty={setActiveFips} />

        {geojson && (
          <div className="absolute bottom-4 left-4 z-10 flex flex-col gap-3">
            <RiskScoreLegend />
            <RiskVsPriceChart counties={counties} activeFips={activeFips} onSelectCounty={setActiveFips} />
          </div>
        )}

        {activeCounty && (
          <div className="absolute right-0 top-0 h-full w-[360px] shadow-2xl">
            <Sidebar county={activeCounty} onClose={() => setActiveFips(null)} />
          </div>
        )}
      </main>
    </div>
  )
}
