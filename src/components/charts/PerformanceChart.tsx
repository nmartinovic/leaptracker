'use client'

import { useState } from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import type { PriceHistory } from '@/lib/database.types'
import { formatShortDate } from '@/lib/formatters'

interface PerformanceChartProps {
  history: PriceHistory[]
  entryPrice: number
  entryDate: string
  spyEntryPrice: number | null
}

export function PerformanceChart({
  history,
  entryPrice,
  entryDate,
  spyEntryPrice,
}: PerformanceChartProps) {
  const [mode, setMode] = useState<'indexed' | 'raw'>('indexed')

  // Build chart data
  const chartData = history.map((row) => {
    const optionIndexed =
      entryPrice > 0 ? (((row.midpoint ?? 0) - entryPrice) / entryPrice) * 100 : 0
    const spyIndexed =
      spyEntryPrice && row.spy_close
        ? ((row.spy_close - spyEntryPrice) / spyEntryPrice) * 100
        : null

    return {
      date: row.date,
      label: formatShortDate(row.date),
      optionIndexed: parseFloat(optionIndexed.toFixed(2)),
      spyIndexed: spyIndexed != null ? parseFloat(spyIndexed.toFixed(2)) : null,
      optionRaw: row.midpoint,
      spyRaw: row.spy_close,
    }
  })

  const isIndexed = mode === 'indexed'

  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <div className="flex gap-1 text-xs border border-gray-200 rounded-md overflow-hidden">
          <button
            onClick={() => setMode('indexed')}
            className={`px-3 py-1.5 transition-colors ${
              isIndexed ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            % Change
          </button>
          <button
            onClick={() => setMode('raw')}
            className={`px-3 py-1.5 transition-colors ${
              !isIndexed ? 'bg-gray-900 text-white' : 'text-gray-600 hover:bg-gray-100'
            }`}
          >
            Raw Price
          </button>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="label"
            tick={{ fontSize: 11 }}
            interval="preserveStartEnd"
          />
          <YAxis
            tick={{ fontSize: 11 }}
            tickFormatter={(v) => isIndexed ? `${v > 0 ? '+' : ''}${v}%` : `$${v}`}
          />
          <Tooltip
            formatter={(value, name) => [
              typeof value === 'number'
                ? isIndexed
                  ? `${value > 0 ? '+' : ''}${value.toFixed(2)}%`
                  : `$${value.toFixed(2)}`
                : String(value),
              String(name),
            ]}
          />
          <Legend />
          <Line
            type="monotone"
            dataKey={isIndexed ? 'optionIndexed' : 'optionRaw'}
            name="Option"
            stroke="#2563eb"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 4 }}
          />
          <Line
            type="monotone"
            dataKey={isIndexed ? 'spyIndexed' : 'spyRaw'}
            name="SPY"
            stroke="#d97706"
            strokeWidth={2}
            dot={false}
            strokeDasharray="4 2"
            activeDot={{ r: 4 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}
