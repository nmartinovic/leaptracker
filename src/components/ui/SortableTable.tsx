'use client'

import { useState, useMemo } from 'react'
import { clsx } from 'clsx'

export interface Column<T> {
  key: string
  header: string
  sortable?: boolean
  getValue?: (row: T) => string | number | null
  className?: string
  render: (row: T) => React.ReactNode
}

interface SortableTableProps<T> {
  columns: Column<T>[]
  data: T[]
  keyFn: (row: T) => string
  emptyMessage?: string
}

export function SortableTable<T>({ columns, data, keyFn, emptyMessage }: SortableTableProps<T>) {
  const [sortKey, setSortKey] = useState<string | null>(null)
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('desc')

  function handleSort(key: string) {
    if (sortKey === key) {
      setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'))
    } else {
      setSortKey(key)
      setSortDir('desc')
    }
  }

  const sortedData = useMemo(() => {
    if (!sortKey) return data
    const col = columns.find((c) => c.key === sortKey)
    if (!col?.getValue) return data
    return [...data].sort((a, b) => {
      const av = col.getValue!(a)
      const bv = col.getValue!(b)
      if (av === null && bv === null) return 0
      if (av === null) return 1
      if (bv === null) return -1
      if (typeof av === 'number' && typeof bv === 'number') {
        return sortDir === 'asc' ? av - bv : bv - av
      }
      return sortDir === 'asc'
        ? String(av).localeCompare(String(bv))
        : String(bv).localeCompare(String(av))
    })
  }, [data, sortKey, sortDir, columns])

  return (
    <div className="overflow-x-auto rounded-lg border border-gray-200">
      <table className="min-w-full divide-y divide-gray-200 text-sm">
        <thead className="bg-gray-50">
          <tr>
            {columns.map((col) => (
              <th
                key={col.key}
                onClick={col.sortable ? () => handleSort(col.key) : undefined}
                className={clsx(
                  'px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider whitespace-nowrap',
                  col.sortable && 'cursor-pointer hover:text-gray-900 select-none',
                  col.className
                )}
              >
                {col.header}
                {col.sortable && (
                  <span className="ml-1 inline-block w-3 text-center">
                    {sortKey === col.key ? (sortDir === 'asc' ? '↑' : '↓') : ''}
                  </span>
                )}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="bg-white divide-y divide-gray-100">
          {sortedData.length === 0 ? (
            <tr>
              <td colSpan={columns.length} className="px-4 py-8 text-center text-gray-400">
                {emptyMessage ?? 'No data'}
              </td>
            </tr>
          ) : (
            sortedData.map((row) => (
              <tr key={keyFn(row)} className="hover:bg-gray-50 transition-colors">
                {columns.map((col) => (
                  <td key={col.key} className={clsx('px-4 py-3', col.className)}>
                    {col.render(row)}
                  </td>
                ))}
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}
