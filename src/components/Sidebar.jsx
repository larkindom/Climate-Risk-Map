import { scoreToColor, scoreToRiskLabel } from '../lib/scoring'

const RATING_FIELDS = {
  flood: ['CFLD_RISKR', 'IFLD_RISKR'],
  wildfire: ['WFIR_RISKR'],
  heat: ['HWAV_RISKR'],
  hurricane: ['HRCN_RISKR'],
}

const RATING_LABELS = {
  CFLD_RISKR: 'Coastal',
  IFLD_RISKR: 'Inland',
  WFIR_RISKR: null,
  HWAV_RISKR: null,
  HRCN_RISKR: null,
}

function ordinal(n) {
  const rem100 = n % 100
  if (rem100 >= 11 && rem100 <= 13) return `${n}th`
  switch (n % 10) {
    case 1:
      return `${n}st`
    case 2:
      return `${n}nd`
    case 3:
      return `${n}rd`
    default:
      return `${n}th`
  }
}

function fmtUSD(value) {
  return typeof value === 'number' ? `$${Math.round(value).toLocaleString()}` : '—'
}

function fmtPct(value) {
  return typeof value === 'number' ? `${value >= 0 ? '+' : ''}${(value * 100).toFixed(1)}%` : '—'
}

export default function Sidebar({ county, onClose }) {
  if (!county) return null

  const housing = county.housing
  const breakdown = county.climate_risk_breakdown ?? []

  return (
    <div className="flex h-full w-full flex-col overflow-y-auto bg-neutral-900 p-4 text-neutral-100">
      <div className="flex items-start justify-between">
        <div>
          <h2 className="text-base font-semibold">{county.label}</h2>
          <p className="text-xs text-neutral-400">
            {county.COUNTY} County · pop. {county.POPULATION?.toLocaleString() ?? '—'}
          </p>
        </div>
        <button onClick={onClose} className="text-neutral-400 hover:text-neutral-100">
          ✕
        </button>
      </div>

      <div className="mt-3 flex items-center gap-2">
        <span
          className="rounded px-2 py-1 text-sm font-semibold text-neutral-900"
          style={{ backgroundColor: scoreToColor(county.climate_risk_score) }}
        >
          {county.climate_risk_score}
        </span>
        <span className="text-sm font-medium text-neutral-100">{scoreToRiskLabel(county.climate_risk_score)}</span>
        <span className="text-sm text-neutral-400">· Climate risk score</span>
      </div>

      <div className="mt-4">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Hazard breakdown</h3>
        <p className="mt-1 text-xs text-neutral-500">
          Each hazard's annualized loss rate, as a national percentile — how this county's expected losses
          compare to every other county, independent of population size.
        </p>
        <ul className="mt-1.5 space-y-1.5 text-sm">
          {breakdown.map((b) => (
            <li key={b.id} className="flex justify-between gap-2">
              <div>
                <span className="text-neutral-300">{b.label}</span>
                {b.value !== null && (
                  <span className="ml-1.5 text-xs text-neutral-500">
                    {RATING_FIELDS[b.id]
                      .map((field) => {
                        const rating = county[field]
                        if (!rating) return null
                        const prefix = RATING_LABELS[field]
                        return prefix ? `${prefix}: ${rating}` : rating
                      })
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                )}
              </div>
              {b.value === null ? (
                <span className="text-neutral-500">n/a</span>
              ) : (
                <span className="text-neutral-100">{ordinal(b.value)} pctl</span>
              )}
            </li>
          ))}
        </ul>
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Housing market</h3>
        {housing ? (
          <>
            <p className="mt-1 text-xs text-neutral-500">As of {housing.period_end}</p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Field label="Median sale price" value={fmtUSD(housing.median_sale_price)} />
              <Field
                label="YoY change"
                value={fmtPct(housing.median_sale_price_yoy)}
                valueClassName={
                  housing.median_sale_price_yoy >= 0 ? 'text-green-400' : 'text-red-400'
                }
              />
              <Field label="Price per sqft" value={housing.median_ppsf ? `$${Math.round(housing.median_ppsf)}` : '—'} />
              <Field label="Inventory" value={housing.inventory ? Math.round(housing.inventory).toLocaleString() : '—'} />
              <Field label="Median days on market" value={housing.median_dom ? Math.round(housing.median_dom) : '—'} />
            </dl>
          </>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">No housing data matched for this county.</p>
        )}
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">
          Historical flood losses (NFIP)
        </h3>
        {typeof county.nfip_claims_count === 'number' ? (
          <>
            <p className="mt-1 text-xs text-neutral-500">
              Realized losses, {county.nfip_earliest_year}–{county.nfip_latest_year} — compare against the
              Flood row above, which is FEMA's *projected* risk.
            </p>
            <dl className="mt-2 grid grid-cols-2 gap-x-3 gap-y-2 text-sm">
              <Field label="Claims filed" value={county.nfip_claims_count.toLocaleString()} />
              <Field label="Total paid out" value={fmtUSD(county.nfip_total_paid)} />
              <Field label="Avg. claim paid" value={fmtUSD(county.nfip_avg_claim_paid)} />
              <Field label="Paid per capita" value={fmtUSD(county.nfip_paid_per_capita)} />
            </dl>
            <p className="mt-2 text-xs text-neutral-500">
              Covers only NFIP flood-insurance policyholders, not all flood damage — a lower number can mean
              lower flood losses, or just lower insurance uptake in that county.
            </p>
          </>
        ) : (
          <p className="mt-1 text-sm text-neutral-500">No NFIP claims matched for this county.</p>
        )}
      </div>

      <div className="mt-4 border-t border-neutral-800 pt-3">
        <h3 className="text-xs font-semibold uppercase tracking-wide text-neutral-500">Data sources</h3>
        <ul className="mt-2 space-y-1.5 text-xs text-neutral-400">
          <li>
            <span className="text-neutral-300">Hazard risk, county boundary, population</span> — FEMA National
            Risk Index (county-level), live ArcGIS Feature Service.
          </li>
          <li>
            <span className="text-neutral-300">Housing market stats</span> — Redfin Data Center's county market
            tracker (all residential property types), most recent reported month.
          </li>
          <li>
            <span className="text-neutral-300">Climate risk score</span> — computed locally as a weighted
            average of each applicable hazard's annualized loss rate percentile (flood 30%, wildfire 25%, heat
            wave 25%, hurricane 20%); hazards with no meaningful exposure for a county are excluded from the
            average rather than counted as zero.
          </li>
          <li>
            <span className="text-neutral-300">Historical flood losses</span> — OpenFEMA's NFIP claims
            dataset, aggregated per county from individual claim records.
          </li>
        </ul>
      </div>
    </div>
  )
}

function Field({ label, value, valueClassName = 'text-neutral-100' }) {
  return (
    <div>
      <dt className="text-xs text-neutral-500">{label}</dt>
      <dd className={valueClassName}>{value}</dd>
    </div>
  )
}
