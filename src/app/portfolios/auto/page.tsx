import Link from 'next/link'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import { computePortfolioTimeSeries, type HoldingWithOption } from '@/lib/computePortfolioTimeSeries'
import type { TrackedOption, PriceHistory } from '@/lib/database.types'
import { PortfolioChart } from '@/components/charts/PortfolioChart'
import { PercentChange } from '@/components/ui/PercentChange'
import { AutoPortfolioTable, type AutoRow } from '@/components/AutoPortfolioTable'
import { formatPrice } from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function AutoPortfolioPage() {
  const user = await getCurrentUser()
  const db = createAdminClient()

  // Fetch all active #auto-tagged options with their full price history
  const { data: optionsRaw } = await db
    .from('tracked_options')
    .select('*, price_history(*)')
    .eq('user_id', user?.id)
    .contains('tags', ['auto'])
    .eq('is_active', true)
    .order('entry_date', { ascending: true })

  type OptionWithHistory = TrackedOption & { price_history: PriceHistory[] }
  const options = (optionsRaw ?? []) as OptionWithHistory[]

  // Build HoldingWithOption shape — quantity=1, cost_basis=entry_price per option
  const holdings: HoldingWithOption[] = options.map((opt) => ({
    id: opt.id,
    portfolio_id: 'auto',
    option_id: opt.id,
    quantity: 1,
    cost_basis: opt.entry_price,
    start_date: opt.entry_date,
    option: opt,
    priceHistory: (opt.price_history ?? []).sort((a, b) => a.date.localeCompare(b.date)),
  }))

  const timeSeries = computePortfolioTimeSeries(holdings)

  const totalCostBasis = holdings.reduce((s, h) => s + h.cost_basis * 100, 0)
  const totalCurrentValue = holdings.reduce((s, h) => {
    const latest = h.priceHistory[h.priceHistory.length - 1]
    return s + (latest?.midpoint ?? 0) * 100
  }, 0)
  const totalPct =
    totalCostBasis > 0 ? ((totalCurrentValue - totalCostBasis) / totalCostBasis) * 100 : null

  const spyPct =
    timeSeries.length >= 2 && totalCostBasis > 0
      ? ((timeSeries[timeSeries.length - 1].spyValue - totalCostBasis) / totalCostBasis) * 100
      : null

  const alpha = totalPct != null && spyPct != null ? totalPct - spyPct : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/portfolios" className="hover:text-gray-900">Portfolios</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">Auto</span>
      </div>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Auto Portfolio</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            All active options tagged <span className="font-mono">#auto</span> · updates automatically
          </p>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {[
          { label: 'Positions', value: holdings.length },
          { label: 'Total Invested', value: formatPrice(totalCostBasis) },
          { label: 'Current Value', value: formatPrice(totalCurrentValue) },
          { label: 'Return', value: <PercentChange value={totalPct} /> },
          { label: 'Alpha vs SPY', value: <PercentChange value={alpha} /> },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
            <p className="text-base font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Portfolio Value vs SPY Equivalent</h2>
        {timeSeries.length < 2 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Not enough data yet — prices are captured daily during market hours.
          </p>
        ) : (
          <PortfolioChart timeSeries={timeSeries} />
        )}
      </div>

      {/* Holdings table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">
          Positions ({holdings.length})
        </h2>
        <AutoPortfolioTable
          rows={holdings.map((h): AutoRow => {
            const latest = h.priceHistory[h.priceHistory.length - 1]
            const currentMidpoint = latest?.midpoint ?? null
            return {
              id: h.id,
              option_id: h.option_id,
              option: h.option,
              entryPrice: h.cost_basis,
              currentMidpoint,
              pct: currentMidpoint != null ? ((currentMidpoint - h.cost_basis) / h.cost_basis) * 100 : null,
              entryDate: h.start_date,
              expirationDate: h.option.expiration_date,
            }
          })}
        />
      </div>
    </div>
  )
}
