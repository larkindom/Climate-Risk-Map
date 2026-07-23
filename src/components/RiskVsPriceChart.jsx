import { scoreToColor } from '../lib/scoring'

const WIDTH = 300
const HEIGHT = 190
const PAD = { top: 14, right: 14, bottom: 28, left: 40 }

// Dependency-free inline SVG scatter — the actual portfolio "insight" of
// this project: does higher climate hazard risk correlate with cooler price
// growth, or is the market not pricing it in yet? Only ever plots the small,
// fixed set of loaded counties, so a full charting library would be
// overkill (same zero-extra-deps philosophy as the reference project).
export default function RiskVsPriceChart({ counties, activeFips, onSelectCounty }) {
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

  return (
    <div className="rounded bg-neutral-900/90 p-3 text-neutral-100 shadow">
      <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
        Climate risk vs. price growth
      </p>
      <svg viewBox={`0 0 ${WIDTH} ${HEIGHT}`} width={WIDTH} height={HEIGHT} className="mt-1.5">
        {/* Zero line */}
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={yScale(0)}
          y2={yScale(0)}
          stroke="#404040"
          strokeDasharray="2,2"
        />
        {/* Axes */}
        <line x1={PAD.left} x2={PAD.left} y1={PAD.top} y2={PAD.top + plotH} stroke="#525252" />
        <line
          x1={PAD.left}
          x2={WIDTH - PAD.right}
          y1={PAD.top + plotH}
          y2={PAD.top + plotH}
          stroke="#525252"
        />
        <text x={PAD.left} y={HEIGHT - 4} fontSize="9" fill="#a3a3a3">
          Lower risk
        </text>
        <text x={WIDTH - PAD.right} y={HEIGHT - 4} fontSize="9" fill="#a3a3a3" textAnchor="end">
          Higher risk
        </text>
        <text
          x={10}
          y={PAD.top - 4}
          fontSize="9"
          fill="#a3a3a3"
        >
          Price YoY %
        </text>

        {points.map((p) => (
          <g
            key={p.fips}
            transform={`translate(${xScale(p.x)}, ${yScale(p.y)})`}
            onClick={() => onSelectCounty(p.fips)}
            className="cursor-pointer"
          >
            <circle r={p.fips === activeFips ? 6 : 4.5} fill={p.color} stroke="#0a0a0a" strokeWidth="1" />
            <text x={7} y={3} fontSize="8" fill="#e5e5e5">
              {p.label.split(',')[0]}
            </text>
          </g>
        ))}
      </svg>
    </div>
  )
}
