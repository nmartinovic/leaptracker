import { clsx } from 'clsx'
import { formatPercent } from '@/lib/formatters'

interface PercentChangeProps {
  value: number | null | undefined
  className?: string
}

export function PercentChange({ value, className }: PercentChangeProps) {
  if (value == null) return <span className={clsx('text-gray-400', className)}>—</span>

  return (
    <span
      className={clsx(
        'font-medium tabular-nums',
        value > 0 && 'text-green-600',
        value < 0 && 'text-red-600',
        value === 0 && 'text-gray-500',
        className
      )}
    >
      {formatPercent(value)}
    </span>
  )
}
