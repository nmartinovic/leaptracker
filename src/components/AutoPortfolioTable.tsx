'use client'

import Link from 'next/link'
import { SortableTable, type Column } from '@/components/ui/SortableTable'
import { PercentChange } from '@/components/ui/PercentChange'
import { formatContractName, formatDate, formatPrice } from '@/lib/formatters'
import type { TrackedOption } from '@/lib/database.types'

export interface AutoRow {
  id: string
  option_id: string
  option: TrackedOption
  entryPrice: number
  currentMidpoint: number | null
  pct: number | null
  entryDate: string
  expirationDate: string
}

const columns: Column<AutoRow>[] = [
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
    key: 'entryPrice',
    header: 'Entry Price',
    sortable: true,
    getValue: (row) => row.entryPrice,
    className: 'tabular-nums',
    render: (row) => formatPrice(row.entryPrice),
  },
  {
    key: 'currentMidpoint',
    header: 'Current Price',
    sortable: true,
    getValue: (row) => row.currentMidpoint,
    className: 'tabular-nums',
    render: (row) => formatPrice(row.currentMidpoint),
  },
  {
    key: 'pct',
    header: '% Change',
    sortable: true,
    getValue: (row) => row.pct,
    render: (row) => <PercentChange value={row.pct} />,
  },
  {
    key: 'entryDate',
    header: 'Entry Date',
    sortable: true,
    getValue: (row) => row.entryDate,
    className: 'text-gray-500 whitespace-nowrap',
    render: (row) => formatDate(row.entryDate),
  },
  {
    key: 'expirationDate',
    header: 'Expires',
    sortable: true,
    getValue: (row) => row.expirationDate,
    className: 'text-gray-500 whitespace-nowrap',
    render: (row) => formatDate(row.expirationDate),
  },
]

export function AutoPortfolioTable({ rows }: { rows: AutoRow[] }) {
  return (
    <SortableTable
      columns={columns}
      data={rows}
      keyFn={(row) => row.id}
      emptyMessage="No #auto options yet. Send a POST to /api/options/auto to add one."
    />
  )
}
