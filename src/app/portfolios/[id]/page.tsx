import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import { computePortfolioTimeSeries, type HoldingWithOption } from '@/lib/computePortfolioTimeSeries'
import type { Portfolio, PortfolioHolding, TrackedOption } from '@/lib/database.types'
import { PortfolioChart } from '@/components/charts/PortfolioChart'
import { PercentChange } from '@/components/ui/PercentChange'
import { AddHoldingModal } from '@/components/AddHoldingModal'
import {
  formatContractName,
  formatDate,
  formatPrice,
} from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function PortfolioDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const user = await getCurrentUser()
  const db = createAdminClient()

  const { data: portfolioRaw, error } = await db
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user?.id)
    .single()

  if (error || !portfolioRaw) notFound()
  const portfolio = portfolioRaw as Portfolio

  const { data: holdingsRaw } = await db
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', id)

  const rawHoldings: PortfolioHolding[] = (holdingsRaw ?? []) as PortfolioHolding[]

  // Fetch option data + price history for each holding
  const holdingsWithData: HoldingWithOption[] = await Promise.all(
    rawHoldings.map(async (holding: PortfolioHolding) => {
      const [{ data: optionRaw }, { data: historyRaw }] = await Promise.all([
        db.from('tracked_options').select('*').eq('id', holding.option_id).single(),
        db
          .from('price_history')
          .select('*')
          .eq('option_id', holding.option_id)
          .gte('date', holding.start_date)
          .order('date', { ascending: true }),
      ])
      return {
        ...holding,
        option: (optionRaw as TrackedOption)!,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        priceHistory: (historyRaw ?? []) as any[],
      }
    })
  )

  const timeSeries = computePortfolioTimeSeries(holdingsWithData)
  const lastPoint = timeSeries[timeSeries.length - 1]

  // Fetch all active options for the Add Holding modal
  const { data: allOptionsRaw } = await db
    .from('tracked_options')
    .select('*')
    .eq('user_id', user?.id)
    .eq('is_active', true)
    .order('entry_date', { ascending: false })
  const allOptions: TrackedOption[] = (allOptionsRaw ?? []) as TrackedOption[]

  // Compute summary totals
  const totalCostBasis = holdingsWithData.reduce(
    (s, h) => s + h.cost_basis * h.quantity * 100,
    0
  )
  const totalCurrentValue = holdingsWithData.reduce((s, h) => {
    const latest = h.priceHistory[h.priceHistory.length - 1]
    return s + (latest?.midpoint ?? 0) * h.quantity * 100
  }, 0)
  const totalPct =
    totalCostBasis > 0 ? ((totalCurrentValue - totalCostBasis) / totalCostBasis) * 100 : null

  const spyPct =
    timeSeries.length >= 2
      ? ((timeSeries[timeSeries.length - 1].spyValue - timeSeries[0].spyValue) /
          timeSeries[0].spyValue) *
        100
      : null

  const alpha = totalPct != null && spyPct != null ? totalPct - spyPct : null

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/portfolios" className="hover:text-gray-900">Portfolios</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{portfolio.name}</span>
      </div>

      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">{portfolio.name}</h1>
        <AddHoldingModal portfolioId={portfolio.id} availableOptions={allOptions ?? []} />
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-5 gap-3">
        {[
          { label: 'Total Invested', value: formatPrice(totalCostBasis) },
          { label: 'Current Value', value: formatPrice(totalCurrentValue) },
          { label: 'Return', value: <PercentChange value={totalPct} /> },
          { label: 'SPY Return', value: <PercentChange value={spyPct} /> },
          { label: 'Alpha', value: <PercentChange value={alpha} /> },
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
            Not enough data yet. Add holdings and wait for daily price snapshots.
          </p>
        ) : (
          <PortfolioChart timeSeries={timeSeries} />
        )}
      </div>

      {/* Holdings table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">
          Holdings ({holdingsWithData.length})
        </h2>
        {holdingsWithData.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400">
            No holdings yet. Add options to this portfolio.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-100 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  {['Contract', 'Contracts', 'Cost Basis', 'Current Value', '% Change', 'Weight', 'Start Date'].map((h) => (
                    <th key={h} className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-50">
                {holdingsWithData.map((h) => {
                  const latest = h.priceHistory[h.priceHistory.length - 1]
                  const currentValue = latest?.midpoint ? latest.midpoint * h.quantity * 100 : null
                  const costTotal = h.cost_basis * h.quantity * 100
                  const pct =
                    currentValue != null
                      ? ((currentValue - costTotal) / costTotal) * 100
                      : null
                  const weight =
                    totalCurrentValue > 0 && currentValue != null
                      ? (currentValue / totalCurrentValue) * 100
                      : null

                  return (
                    <tr key={h.id} className="hover:bg-gray-50">
                      <td className="px-4 py-3 font-medium">
                        <Link href={`/options/${h.option_id}`} className="text-blue-600 hover:underline">
                          {formatContractName(h.option)}
                        </Link>
                      </td>
                      <td className="px-4 py-3 tabular-nums">{h.quantity}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPrice(costTotal)}</td>
                      <td className="px-4 py-3 tabular-nums">{formatPrice(currentValue)}</td>
                      <td className="px-4 py-3"><PercentChange value={pct} /></td>
                      <td className="px-4 py-3 text-gray-500">
                        {weight != null ? `${weight.toFixed(1)}%` : '—'}
                      </td>
                      <td className="px-4 py-3 text-gray-500 whitespace-nowrap">
                        {formatDate(h.start_date)}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
