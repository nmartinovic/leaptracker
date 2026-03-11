'use client'

import { useState } from 'react'
import { Modal } from './ui/Modal'
import { AddHoldingForm } from './AddHoldingForm'
import type { TrackedOption } from '@/lib/database.types'

interface AddHoldingModalProps {
  portfolioId: string
  availableOptions: TrackedOption[]
}

export function AddHoldingModal({ portfolioId, availableOptions }: AddHoldingModalProps) {
  const [open, setOpen] = useState(false)

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 transition-colors"
      >
        + Add Holding
      </button>
      <Modal open={open} onOpenChange={setOpen} title="Add Holding to Portfolio">
        <AddHoldingForm
          portfolioId={portfolioId}
          availableOptions={availableOptions}
          onSuccess={() => setOpen(false)}
        />
      </Modal>
    </>
  )
}
