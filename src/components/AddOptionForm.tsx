'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { LoadingSpinner } from './ui/LoadingSpinner'

const YAHOO_OPTION_URL_PATTERN = /\/quote\/[A-Z]{1,6}\d{6}[CP]\d{8}/i

interface AddOptionFormProps {
  onSuccess?: () => void
}

export function AddOptionForm({ onSuccess }: AddOptionFormProps) {
  const router = useRouter()
  const [url, setUrl] = useState('')
  const [entryPrice, setEntryPrice] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const urlValid = url.trim() === '' || YAHOO_OPTION_URL_PATTERN.test(url)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError(null)

    if (!YAHOO_OPTION_URL_PATTERN.test(url)) {
      setError('Please enter a valid Yahoo Finance option URL or OCC symbol')
      return
    }

    const price = parseFloat(entryPrice)
    if (isNaN(price) || price <= 0) {
      setError('Entry price must be a positive number')
      return
    }

    const tags = tagsInput
      .split(',')
      .map((t) => t.trim().toLowerCase().replace(/^#/, ''))
      .filter(Boolean)

    setLoading(true)
    try {
      const res = await fetch('/api/options', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: url.trim(), entry_price: price, tags }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error ?? `Error ${res.status}`)
        return
      }

      setUrl('')
      setEntryPrice('')
      setTagsInput('')
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
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Yahoo Finance Option URL or Symbol
        </label>
        <input
          type="text"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          placeholder="https://finance.yahoo.com/quote/MSFT281215C00195000/ or MSFT281215C00195000"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
        {!urlValid && (
          <p className="mt-1 text-xs text-red-600">
            URL should look like: finance.yahoo.com/quote/MSFT281215C00195000/
          </p>
        )}
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Entry Price (per contract, in dollars)
        </label>
        <input
          type="number"
          value={entryPrice}
          onChange={(e) => setEntryPrice(e.target.value)}
          placeholder="e.g. 12.50"
          step="0.01"
          min="0.01"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
          required
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1">
          Tags <span className="text-gray-400 font-normal">(optional, comma-separated)</span>
        </label>
        <input
          type="text"
          value={tagsInput}
          onChange={(e) => setTagsInput(e.target.value)}
          placeholder="e.g. longshot, stock-replacement"
          className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
        />
      </div>

      {error && (
        <div className="rounded-md bg-red-50 border border-red-200 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      )}

      <div className="flex justify-end gap-3 pt-2">
        <button
          type="submit"
          disabled={loading}
          className="inline-flex items-center gap-2 rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {loading && <LoadingSpinner className="h-4 w-4 text-white" />}
          {loading ? 'Adding…' : 'Add Option'}
        </button>
      </div>
    </form>
  )
}
