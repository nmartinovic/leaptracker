'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { TrackedOption } from '@/lib/database.types'
import { formatContractName } from '@/lib/formatters'
import { LoadingSpinner } from './ui/LoadingSpinner'

interface AddHoldingFormProps {
  portfolioId: string
  availableOptions: TrackedOption[]
  onSuccess?: () => void
}

export function AddHoldingForm({ portfolioId, availableOptions, onSuccess }: AddHoldingFormProps) {
  const router = useRouter()
  const [optionId, setOptionId] = useState('')
  const [quantity, setQuantity] = useState('')
  const [costBasis, setCostBasis] = useState('')
  const [startDate, setStartDate] = useState(new Date().toISOString().slice(0, 10))
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    const qty = parseInt(quantity, 10)
    const cost = parseFloat(costBasis)

    if (!optionId) return setError('Please select an option')
    if (isNaN(qty) || qty <= 0) return setError('Quantity must be a positive integer')
    if (isNaN(cost) || cost <= 0) return setError('Cost basis must be a positive number')
    if (!startDate) return setError('Start date is required')

    setLoading(true)
    try {
      const res = await fetch(`/api/portfolios/${portfolioId}/holdings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          option_id: optionId,
          quantity: qty,
          cost_basis: cost,
          start_date: startDate,
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        return
      }

      router.refresh()
      onSuccess?.()
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Option</label>
        <select
          value={optionId}
          onChange={(e) => setOptionId(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        >
          <option value="">Select an option…</option>
          {availableOptions.map((opt) => (
            <option key={opt.id} value={opt.id}>
              {formatContractName(opt)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Contracts</label>
          <input
            type="number"
            value={quantity}
            onChange={(e) => setQuantity(e.target.value)}
            placeholder="1"
            min="1"
            step="1"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Cost Basis ($/contract)</label>
          <input
            type="number"
            value={costBasis}
            onChange={(e) => setCostBasis(e.target.value)}
            placeholder="12.50"
            min="0.01"
            step="0.01"
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
            required
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">Start Date</label>
        <input
          type="date"
          value={startDate}
          onChange={(e) => setStartDate(e.target.value)}
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none"
          required
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading && <LoadingSpinner className="h-4 w-4 text-white" />}
          {loading ? 'Adding…' : 'Add Holding'}
        </button>
      </div>
    </form>
  )
}
