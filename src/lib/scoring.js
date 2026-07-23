// Composite "Climate Risk Score" (0-100), computed client-side from FEMA
// National Risk Index fields — mirrors the NYC-Electrification-Map project's
// split (raw fields fetched/joined once, score computed at render time).
//
// FEMA's own per-hazard RISKS field is Expected Annual Loss in dollar terms,
// which scales with total exposure (population/building value at risk), not
// hazard likelihood or severity. A live pull for this project returned a
// RISKS composite of 99.7 for King County, WA — picked as a lower-risk
// contrast case — on par with Miami-Dade, purely because it's a large,
// high-value county. ALR_NPCTL (Annualized Loss Rate, National Percentile)
// is a loss *rate*, already normalized by exposure, so every hazard
// component below reads from *_ALR_NPCTL instead.

const HAZARD_COMPONENTS = [
  {
    id: 'flood',
    label: 'Flood',
    weight: 30,
    // A single county can carry both coastal and inland flood exposure;
    // the higher of the two drives the flood component.
    getValue: (p) => maxOf(p.CFLD_ALR_NPCTL, p.IFLD_ALR_NPCTL),
  },
  { id: 'wildfire', label: 'Wildfire', weight: 25, getValue: (p) => p.WFIR_ALR_NPCTL },
  { id: 'heat', label: 'Heat wave', weight: 25, getValue: (p) => p.HWAV_ALR_NPCTL },
  { id: 'hurricane', label: 'Hurricane', weight: 20, getValue: (p) => p.HRCN_ALR_NPCTL },
]

function maxOf(...values) {
  const nums = values.filter((v) => typeof v === 'number' && !Number.isNaN(v))
  return nums.length ? Math.max(...nums) : null
}

// Weighted average over whichever hazard components actually have data for
// this county (some counties have no meaningful hurricane exposure and FEMA
// returns null rather than 0 — treating that as 0 would understate the
// weight of the hazards that *do* apply, so it's excluded from the
// denominator entirely instead, same "applicable criteria only" principle
// the reference project's calculateReadiness() uses).
export function calculateClimateRisk(properties) {
  const breakdown = []
  let weightedSum = 0
  let applicableWeight = 0

  for (const { id, label, weight, getValue } of HAZARD_COMPONENTS) {
    const value = getValue(properties)
    if (typeof value === 'number' && !Number.isNaN(value)) {
      weightedSum += value * weight
      applicableWeight += weight
      breakdown.push({ id, label, value: Math.round(value) })
    } else {
      breakdown.push({ id, label, value: null })
    }
  }

  const score = applicableWeight > 0 ? weightedSum / applicableWeight : 0
  return { score: Math.round(Math.max(0, Math.min(100, score))), breakdown }
}

// Three-band *label* (still useful as a plain-English read), decoupled from
// color — with all seven launch counties landing in the FEMA "moderate"
// 30-70 range on the ALR_NPCTL scale, a 3-color step scale painted the
// whole map the same orange. Color instead reads as a continuous gradient
// (see scoreToColor below) so differences within that range are still
// visible.
export const RISK_TIERS = [
  { id: 'low', max: 30, label: 'Lower risk' },
  { id: 'mid', max: 70, label: 'Moderate risk' },
  { id: 'high', max: 100, label: 'Higher risk' },
]

export function riskTier(score) {
  return RISK_TIERS.find((t) => score <= t.max) ?? RISK_TIERS[RISK_TIERS.length - 1]
}

export function scoreToRiskLabel(score) {
  return riskTier(score).label
}

// Continuous green -> yellow -> red gradient. Hue alone is swept linearly
// from 120° (green) at score 0 to 0° (red) at score 100, which passes
// through 60° (yellow) exactly at the midpoint — a single linear
// interpolation naturally produces the traffic-light gradient without
// needing separate green->yellow and yellow->red segments.
function hslToHex(h, s, l) {
  s /= 100
  l /= 100
  const k = (n) => (n + h / 30) % 12
  const a = s * Math.min(l, 1 - l)
  const f = (n) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)))
  const toHex = (n) => Math.round(f(n) * 255).toString(16).padStart(2, '0')
  return `#${toHex(0)}${toHex(8)}${toHex(4)}`
}

export function scoreToColor(score) {
  const clamped = Math.max(0, Math.min(100, score))
  const hue = 120 * (1 - clamped / 100)
  return hslToHex(hue, 90, 42)
}

// MapLibre expression: interpolate county fill color by climate risk score,
// sampled at 20 steps (every 5 points) so the map renders the same smooth
// gradient as scoreToColor rather than MapLibre linearly blending between
// only two or three anchor colors.
const GRADIENT_STEP = 5
export const RISK_FILL_EXPRESSION = [
  'interpolate',
  ['linear'],
  ['get', 'climate_risk_score'],
  ...Array.from({ length: 100 / GRADIENT_STEP + 1 }, (_, i) => i * GRADIENT_STEP).flatMap((score) => [
    score,
    scoreToColor(score),
  ]),
]
