'use client'

import Link from 'next/link'
import { SortableTable, type Column } from '@/components/ui/SortableTable'
import { PercentChange } from '@/components/ui/PercentChange'
import { formatContractName, formatDate, formatPrice } from '@/lib/formatters'
import type { TrackedOption } from '@/lib/database.types'

export interface HoldingRow {
  id: string
  option_id: string
  option: TrackedOption
  quantity: number
  costTotal: number
  currentValue: number | null
  pct: number | null
  weight: number | null
  start_date: string
}

const columns: Column<HoldingRow>[] = [
  {
    key: 'contract',
    header: 'Contract',
    render: (row) => (
      <Link href={`/options/${row.option_id}`} className="text-blue-600 hover:underline font-medium">
        {formatContractName(row.option)}
      </Link>
    ),
  },
  {
    key: 'quantity',
    header: 'Contracts',
    sortable: true,
    getValue: (row) => row.quantity,
    className: 'tabular-nums',
    render: (row) => row.quantity,
  },
  {
    key: 'costTotal',
    header: 'Cost Basis',
    sortable: true,
    getValue: (row) => row.costTotal,
    className: 'tabular-nums',
    render: (row) => formatPrice(row.costTotal),
  },
  {
    key: 'currentValue',
    header: 'Current Value',
    sortable: true,
    getValue: (row) => row.currentValue,
    className: 'tabular-nums',
    render: (row) => formatPrice(row.currentValue),
  },
  {
    key: 'pct',
    header: '% Change',
    sortable: true,
    getValue: (row) => row.pct,
    render: (row) => <PercentChange value={row.pct} />,
  },
  {
    key: 'weight',
    header: 'Weight',
    sortable: true,
    getValue: (row) => row.weight,
    className: 'text-gray-500',
    render: (row) => (row.weight != null ? `${row.weight.toFixed(1)}%` : '—'),
  },
  {
    key: 'start_date',
    header: 'Start Date',
    sortable: true,
    getValue: (row) => row.start_date,
    className: 'text-gray-500 whitespace-nowrap',
    render: (row) => formatDate(row.start_date),
  },
]

export function PortfolioHoldingsTable({ rows }: { rows: HoldingRow[] }) {
  return (
    <SortableTable
      columns={columns}
      data={rows}
      keyFn={(row) => row.id}
      emptyMessage="No holdings yet. Add options to this portfolio."
    />
  )
}
