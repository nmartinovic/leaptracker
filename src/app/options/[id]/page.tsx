import { notFound } from 'next/navigation'
import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import type { TrackedOption, PriceHistory } from '@/lib/database.types'
import { PerformanceChart } from '@/components/charts/PerformanceChart'
import { Badge } from '@/components/ui/Badge'
import { PercentChange } from '@/components/ui/PercentChange'
import {
  formatContractName,
  formatDate,
  formatShortDate,
  formatPrice,
  formatPercent,
  daysToExpiration,
  daysHeld,
  pctChange,
} from '@/lib/formatters'

export const dynamic = 'force-dynamic'

export default async function OptionDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const db = createAdminClient()

  const { data: optionRaw, error } = await db
    .from('tracked_options')
    .select('*')
    .eq('id', id)
    .single()

  if (error || !optionRaw) notFound()
  const option = optionRaw as TrackedOption

  const { data: historyRaw } = await db
    .from('price_history')
    .select('*')
    .eq('option_id', id)
    .order('date', { ascending: true })

  const priceHistory: PriceHistory[] = (historyRaw ?? []) as PriceHistory[]
  const latest = priceHistory[priceHistory.length - 1] ?? null

  const currentMidpoint = latest?.midpoint ?? null
  const currentSpy = latest?.spy_close ?? null
  const optionPct = pctChange(currentMidpoint, option.entry_price)
  const spyPct = pctChange(currentSpy, option.spy_price_at_entry ?? 0)
  const alpha = optionPct != null && spyPct != null ? optionPct - spyPct : null
  const dte = daysToExpiration(option.expiration_date)
  const held = daysHeld(option.entry_date)

  const contractName = formatContractName(option)

  return (
    <div className="space-y-6">
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-gray-500">
        <Link href="/" className="hover:text-gray-900">Dashboard</Link>
        <span>/</span>
        <span className="text-gray-900 font-medium">{contractName}</span>
      </div>

      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">{contractName}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {option.ticker} · {option.option_type === 'C' ? 'Call' : 'Put'} ·
            Strike {formatPrice(option.strike_price)} ·
            Expires {formatDate(option.expiration_date)}
          </p>
          {option.tags.length > 0 && (
            <div className="flex gap-1.5 mt-2">
              {option.tags.map((tag) => <Badge key={tag} label={tag} />)}
            </div>
          )}
        </div>
        {!option.is_active && (
          <span className="rounded-full bg-gray-100 text-gray-500 text-xs px-3 py-1 font-medium">
            Archived
          </span>
        )}
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-3">
        {[
          { label: 'Entry Price', value: formatPrice(option.entry_price) },
          { label: 'Current Price', value: formatPrice(currentMidpoint) },
          { label: 'Option %', value: <PercentChange value={optionPct} /> },
          { label: 'SPY %', value: <PercentChange value={spyPct} /> },
          { label: 'Alpha', value: <PercentChange value={alpha} /> },
          { label: 'Days Held', value: held },
          {
            label: 'Days to Exp.',
            value: (
              <span className={dte < 30 ? 'text-red-600 font-semibold' : ''}>{dte}</span>
            ),
          },
        ].map((card) => (
          <div key={card.label} className="bg-white rounded-lg border border-gray-200 p-3">
            <p className="text-xs text-gray-500 font-medium mb-1">{card.label}</p>
            <p className="text-base font-semibold text-gray-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Performance chart */}
      <div className="bg-white rounded-lg border border-gray-200 p-4">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Performance vs SPY</h2>
        {priceHistory.length < 2 ? (
          <p className="text-sm text-gray-400 py-8 text-center">
            Not enough data yet — prices are captured daily after market close.
          </p>
        ) : (
          <PerformanceChart
            history={priceHistory}
            entryPrice={option.entry_price}
            entryDate={option.entry_date}
            spyEntryPrice={option.spy_price_at_entry}
          />
        )}
      </div>

      {/* Price history table */}
      <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
        <h2 className="text-sm font-semibold text-gray-700 px-4 py-3 border-b border-gray-200">
          Daily Price History
        </h2>
        <div className="overflow-x-auto max-h-96 overflow-y-auto">
          <table className="min-w-full divide-y divide-gray-100 text-sm">
            <thead className="bg-gray-50 sticky top-0">
              <tr>
                {['Date', 'Bid', 'Ask', 'Midpoint', 'SPY Close', 'Daily Δ'].map((h) => (
                  <th
                    key={h}
                    className="px-4 py-2.5 text-left text-xs font-medium text-gray-500 uppercase tracking-wider"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-50">
              {[...priceHistory].reverse().map((row, i, arr) => {
                const prev = arr[i + 1]
                const dailyChange =
                  row.midpoint != null && prev?.midpoint != null
                    ? pctChange(row.midpoint, prev.midpoint)
                    : null
                return (
                  <tr key={row.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-gray-600">{formatShortDate(row.date)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatPrice(row.bid)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatPrice(row.ask)}</td>
                    <td className="px-4 py-2 tabular-nums font-medium">{formatPrice(row.midpoint)}</td>
                    <td className="px-4 py-2 tabular-nums">{formatPrice(row.spy_close)}</td>
                    <td className="px-4 py-2">
                      <PercentChange value={dailyChange} />
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
