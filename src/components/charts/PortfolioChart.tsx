'use client'

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
import type { PortfolioDataPoint } from '@/lib/computePortfolioTimeSeries'
import { formatShortDate } from '@/lib/formatters'

interface PortfolioChartProps {
  timeSeries: PortfolioDataPoint[]
}

export function PortfolioChart({ timeSeries }: PortfolioChartProps) {
  const chartData = timeSeries.map((point) => ({
    label: formatShortDate(point.date),
    portfolio: parseFloat(point.portfolioValue.toFixed(2)),
    spy: parseFloat(point.spyValue.toFixed(2)),
  }))

  return (
    <ResponsiveContainer width="100%" height={300}>
      <LineChart data={chartData} margin={{ top: 5, right: 20, bottom: 5, left: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
        <XAxis dataKey="label" tick={{ fontSize: 11 }} interval="preserveStartEnd" />
        <YAxis
          tick={{ fontSize: 11 }}
          tickFormatter={(v) => `$${(v / 1000).toFixed(0)}k`}
        />
        <Tooltip
          formatter={(value, name) => [
            typeof value === 'number'
              ? `$${value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
              : String(value),
            String(name),
          ]}
        />
        <Legend />
        <Line
          type="monotone"
          dataKey="portfolio"
          name="Portfolio"
          stroke="#2563eb"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
        <Line
          type="monotone"
          dataKey="spy"
          name="SPY Equivalent"
          stroke="#d97706"
          strokeWidth={2}
          dot={false}
          strokeDasharray="4 2"
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  )
}
