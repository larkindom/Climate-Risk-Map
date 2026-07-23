import { scoreToColor } from '../lib/scoring'

const GRADIENT_CSS = `linear-gradient(to right, ${Array.from({ length: 21 }, (_, i) =>
  scoreToColor(i * 5),
).join(', ')})`

export default function RiskScoreLegend() {
  return (
    <div className="rounded bg-neutral-900/90 p-3 text-sm text-neutral-100 shadow">
      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-neutral-400">Climate risk score</p>
      <div className="h-3 w-48 rounded-full" style={{ background: GRADIENT_CSS }} />
      <div className="mt-1.5 flex w-48 justify-between text-xs font-medium text-neutral-300">
        <span>0 · Lower risk</span>
        <span>100 · Higher risk</span>
      </div>
    </div>
  )
}
