'use client'

import { clsx } from 'clsx'

const TAG_COLORS = [
  'bg-blue-100 text-blue-800',
  'bg-purple-100 text-purple-800',
  'bg-green-100 text-green-800',
  'bg-orange-100 text-orange-800',
  'bg-pink-100 text-pink-800',
  'bg-teal-100 text-teal-800',
]

function tagColor(tag: string): string {
  let hash = 0
  for (let i = 0; i < tag.length; i++) hash = tag.charCodeAt(i) + ((hash << 5) - hash)
  return TAG_COLORS[Math.abs(hash) % TAG_COLORS.length]
}

interface BadgeProps {
  label: string
  onClick?: (label: string) => void
  active?: boolean
  className?: string
}

export function Badge({ label, onClick, active, className }: BadgeProps) {
  const color = tagColor(label)
  return (
    <span
      onClick={() => onClick?.(label)}
      className={clsx(
        'inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium',
        color,
        onClick && 'cursor-pointer hover:opacity-80 transition-opacity',
        active && 'ring-2 ring-offset-1 ring-current',
        className
      )}
    >
      {label}
    </span>
  )
}
