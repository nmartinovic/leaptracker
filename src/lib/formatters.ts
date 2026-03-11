import { format, parseISO, differenceInCalendarDays } from 'date-fns'
import type { TrackedOption } from './database.types'

export function formatContractName(option: Pick<TrackedOption, 'ticker' | 'expiration_date' | 'strike_price' | 'option_type'>): string {
  const expiry = format(parseISO(option.expiration_date), 'MMM yyyy')
  const type = option.option_type === 'C' ? 'Call' : 'Put'
  const strike = option.strike_price % 1 === 0
    ? `$${option.strike_price.toFixed(0)}`
    : `$${option.strike_price.toFixed(2)}`
  return `${option.ticker} ${expiry} ${strike} ${type}`
}

export function formatDate(iso: string): string {
  return format(parseISO(iso), 'MMM d, yyyy')
}

export function formatShortDate(iso: string): string {
  return format(parseISO(iso), 'MM/dd/yy')
}

export function formatPrice(value: number | null | undefined): string {
  if (value == null) return '—'
  return `$${value.toFixed(2)}`
}

export function formatPercent(value: number | null | undefined, decimals = 1): string {
  if (value == null) return '—'
  const sign = value >= 0 ? '+' : ''
  return `${sign}${value.toFixed(decimals)}%`
}

export function daysToExpiration(expirationDate: string): number {
  return differenceInCalendarDays(parseISO(expirationDate), new Date())
}

export function daysHeld(entryDate: string): number {
  return differenceInCalendarDays(new Date(), parseISO(entryDate))
}

export function pctChange(current: number | null, entry: number): number | null {
  if (current == null || entry === 0) return null
  return ((current - entry) / entry) * 100
}
