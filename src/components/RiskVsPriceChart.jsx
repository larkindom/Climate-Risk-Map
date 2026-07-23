import { useState } from 'react'
import { scoreToColor } from '../lib/scoring'

const WIDTH = 320
const HEIGHT = 220
const PAD = { top: 18, right: 16, bottom: 30, left: 34 }

// Dependency-free inline SVG scatter — the actual portfolio "insight" of
// this project: does higher climate hazard risk correlate with cooler price
// growth, or is the market not pricing it in yet? Only ever plots the small,
// fixed set of loaded counties, so a full charting library would be
// overkill (same zero-extra-deps philosophy as the reference project).
//
// With 20 counties, always-on labels overlapped into an illegible pile
// wherever points clustered — a name is only rendered for the hovered or
// selected point now, with a dark halo behind the text so it stays
// readable over both the dark background and other dots.
export default function RiskVsPriceChart({ counties, activeFips, onSelectCounty }) {
  const [hoveredFips, setHoveredFips] = useState(null)

  const points = counties
    .filter((c) => typeof c.housing?.median_sale_price_yoy === 'number')
    .map((c) => ({
      fips: c.STCOFIPS,
      label: c.label,
      x: c.climate_risk_score,
      y: c.housing.median_sale_price_yoy * 100,
      color: scoreToColor(c.climate_risk_score),
    }))

  if (points.length === 0) return null

  const yValues = points.map((p) => p.y)
  const yMin = Math.min(0, Math.floor(Math.min(...yValues) - 1))
  const yMax = Math.max(0, Math.ceil(Math.max(...yValues) + 1))

  const plotW = WIDTH - PAD.left - PAD.right
  const plotH = HEIGHT - PAD.top - PAD.bottom
  const xScale = (x) => PAD.left + (x / 100) * plotW
  const yScale = (y) => PAD.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH

  const labeledFips = hoveredFips ?? activeFips
  // Render the labeled point's <g> last so its label draws on top of
  // neighboring dots instead of getting hidden underneath one.
  const orderedPoints = [...points].sort((a, b) => (a.fips === labeledFips ? 1 : b.fips === labeledFips ? -1 : 0))

  return (
    <div className="rounded bg-neutral-900/90 p-3 text-neutral-100 shadow">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">
        Climate risk vs. price growth
      </p>
      <p className="mt-0.5 text-[11px] text-neutral-500">Hover or click a point for its name</p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} className="mt-1.5">
        {/* Zero line */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke="#525252"
          strokeDasharray="2,2"
        />
        {/* Axes */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="#737373" />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="#737373"
        />
        <text x={PAD.left} y={HEIGHT - 6} fontSize="11" fill="#d4d4d4">
          Lower risk
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 6} fontSize="11" fill="#d4d4d4" textAnchor="end">
          Higher risk
        </text>
        <text x={4} y={PAD.top - 6} fontSize="11" fill="#d4d4d4">
          Price YoY %
        </text>

        {orderedPoints.map((p) => {
          const isLabeled = p.fips === labeledFips
          return (
            <g
              key={p.fips}
              transform={`translate(${xScale(p.x)}, ${yScale(p.y)})`}
              onClick={() => onSelectCounty(p.fips)}
              onMouseEnter={() => setHoveredFips(p.fips)}
              onMouseLeave={() => setHoveredFips(null)}
              className="cursor-pointer"
            >
              <circle
                r={p.fips === activeFips ? 7 : 5}
                fill={p.color}
                stroke={isLabeled ? '#f5f5f5' : '#0a0a0a'}
                strokeWidth={isLabeled ? 2 : 1}
              />
              {isLabeled && (
                <text
                  x={9}
                  y={4}
                  fontSize="12"
                  fontWeight="600"
                  fill="#ffffff"
                  stroke="#0a0a0a"
                  strokeWidth="3"
                  paintOrder="stroke"
                >
                  {p.label}
                </text>
              )}
            </g>
          )
        })}
      </svg>
    </div>
  )
}
