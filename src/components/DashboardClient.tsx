'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Badge } from './ui/Badge'
import { PercentChange } from './ui/PercentChange'
import { Modal } from './ui/Modal'
import { AddOptionForm } from './AddOptionForm'
import { EmptyState } from './ui/EmptyState'
import { formatContractName, formatDate, formatPrice } from '@/lib/formatters'

interface OptionRow {
  id: string
  ticker: string
  expiration_date: string
  strike_price: number
  option_type: 'C' | 'P'
  entry_price: number
  entry_date: string
  tags: string[]
  is_active: boolean
  current_midpoint: number | null
  option_pct_change: number | null
  spy_pct_change: number | null
  alpha: number | null
}

interface DashboardClientProps {
  options: OptionRow[]
  allTags: string[]
}

export function DashboardClient({ options, allTags }: DashboardClientProps) {
  const router = useRouter()
  const [addModalOpen, setAddModalOpen] = useState(false)
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [sortKey, setSortKey] = useState<keyof OptionRow>('entry_date')
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')
  const [showInactive, setShowInactive] = useState(false)

  function handleSort(key: keyof OptionRow) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const filtered = options
    .filter((o) => (showInactive ? true : o.is_active))
    .filter((o) => (activeTag ? o.tags.includes(activeTag) : true))
    .sort((a, b) => {
      const av = a[sortKey]
      const bv = b[sortKey]
      if (av == null) return 1
      if (bv == null) return -1
      if (av < bv) return sortDir === 'asc' ? -1 : 1
      if (av > bv) return sortDir === 'asc' ? 1 : -1
      return 0
    })

  const SortHeader = ({ col, label }: { col: keyof OptionRow; label: string }) => (
    <th
      onClick={() => handleSort(col)}
      className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:text-gray-900 select-none whitespace-nowrap"
    >
      {label}
      {sortKey === col && <span className="ml-1">{sortDir === 'asc' ? '↑' : '↓'}</span>}
    </th>
  )

  return (
    <div>
      {/* Header bar */}
      <div className="flex items-center justify-between mb-5">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Options Dashboard</h1>
          <p className="text-sm text-gray-500 mt-0.5">{options.filter(o => o.is_active).length} active positions</p>
        </div>
        <button
          onClick={() => setAddModalOpen(true)}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
        >
          + Add Option
        </button>
      </div>

      {/* Tag filter bar */}
      {allTags.length > 0 && (
        <div className="flex items-center gap-2 mb-4 flex-wrap">
          <span className="text-xs text-gray-500 font-medium">Filter:</span>
          <button
            onClick={() => setActiveTag(null)}
            className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
              activeTag === null
                ? 'bg-gray-900 text-white border-gray-900'
                : 'border-gray-300 text-gray-600 hover:border-gray-500'
            }`}
          >
            All
          </button>
          {allTags.map((tag) => (
            <Badge
              key={tag}
              label={tag}
              active={activeTag === tag}
              onClick={(t) => setActiveTag(activeTag === t ? null : t)}
            />
          ))}
          <label className="ml-auto flex items-center gap-1.5 text-xs text-gray-500 cursor-pointer">
            <input
              type="checkbox"
              checked={showInactive}
              onChange={(e) => setShowInactive(e.target.checked)}
              className="rounded"
            />
            Show archived
          </label>
        </div>
      )}

      {/* Table */}
      {filtered.length === 0 ? (
        <EmptyState
          title="No options tracked yet"
          description="Add your first option by pasting a Yahoo Finance URL. Daily prices will be captured automatically after market close."
          action={
            <button
              onClick={() => setAddModalOpen(true)}
              className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
            >
              Add your first option
            </button>
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-gray-200">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <SortHeader col="ticker" label="Contract" />
                <SortHeader col="entry_price" label="Entry" />
                <SortHeader col="current_midpoint" label="Current" />
                <SortHeader col="option_pct_change" label="Option %" />
                <SortHeader col="spy_pct_change" label="SPY %" />
                <SortHeader col="alpha" label="Alpha" />
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Tags</th>
                <SortHeader col="entry_date" label="Entry Date" />
                <SortHeader col="expiration_date" label="Expires" />
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {filtered.map((opt) => (
                <tr key={opt.id} className={`hover:bg-gray-50 transition-colors ${!opt.is_active ? 'opacity-50' : ''}`}>
                  <td className="px-4 py-3 font-medium">
                    <Link href={`/options/${opt.id}`} className="text-blue-600 hover:text-blue-800 hover:underline">
                      {formatContractName(opt)}
                    </Link>
                  </td>
                  <td className="px-4 py-3 tabular-nums">{formatPrice(opt.entry_price)}</td>
                  <td className="px-4 py-3 tabular-nums">{formatPrice(opt.current_midpoint)}</td>
                  <td className="px-4 py-3"><PercentChange value={opt.option_pct_change} /></td>
                  <td className="px-4 py-3"><PercentChange value={opt.spy_pct_change} /></td>
                  <td className="px-4 py-3"><PercentChange value={opt.alpha} /></td>
                  <td className="px-4 py-3">
                    <div className="flex flex-wrap gap-1">
                      {opt.tags.map((tag) => (
                        <Badge key={tag} label={tag} onClick={(t) => setActiveTag(activeTag === t ? null : t)} />
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(opt.entry_date)}</td>
                  <td className="px-4 py-3 text-gray-500 whitespace-nowrap">{formatDate(opt.expiration_date)}</td>
                  <td className="px-4 py-3 text-right">
                    <Link href={`/options/${opt.id}`} className="text-xs text-blue-600 hover:underline">
                      Details →
                    </Link>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Option modal */}
      <Modal open={addModalOpen} onOpenChange={setAddModalOpen} title="Track New Option">
        <AddOptionForm onSuccess={() => { setAddModalOpen(false); router.refresh() }} />
      </Modal>
    </div>
  )
}
