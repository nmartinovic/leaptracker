'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function DeleteOptionButton({ id, name }: { id: string; name: string }) {
  const router = useRouter()
  const [deleting, setDeleting] = useState(false)

  async function handleDelete() {
    if (!confirm(`Delete "${name}"? This will remove all price history and cannot be undone.`)) return
    setDeleting(true)
    await fetch(`/api/options/${id}`, { method: 'DELETE' })
    router.push('/')
  }

  return (
    <button
      onClick={handleDelete}
      disabled={deleting}
      className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 disabled:opacity-40 transition-colors"
    >
      {deleting ? 'Deleting…' : 'Delete'}
    </button>
  )
}
