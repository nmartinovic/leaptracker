import { describe, it, expect } from 'vitest'
import {
  formatContractName,
  formatPrice,
  formatPercent,
  pctChange,
} from '@/lib/formatters'

describe('formatContractName', () => {
  it('formats a call option', () => {
    expect(
      formatContractName({
        ticker: 'MSFT',
        expiration_date: '2028-12-15',
        strike_price: 195,
        option_type: 'C',
      })
    ).toBe('MSFT Dec 2028 $195 Call')
  })

  it('formats a put option', () => {
    expect(
      formatContractName({
        ticker: 'AAPL',
        expiration_date: '2027-06-18',
        strike_price: 150,
        option_type: 'P',
      })
    ).toBe('AAPL Jun 2027 $150 Put')
  })

  it('includes decimal strike prices', () => {
    const result = formatContractName({
      ticker: 'SPY',
      expiration_date: '2026-03-20',
      strike_price: 412.5,
      option_type: 'C',
    })
    expect(result).toBe('SPY Mar 2026 $412.50 Call')
  })
})

describe('formatPrice', () => {
  it('formats a price with 2 decimal places', () => {
    expect(formatPrice(12.5)).toBe('$12.50')
    expect(formatPrice(195)).toBe('$195.00')
  })

  it('returns em dash for null/undefined', () => {
    expect(formatPrice(null)).toBe('—')
    expect(formatPrice(undefined)).toBe('—')
  })
})

describe('formatPercent', () => {
  it('adds + sign for positive values', () => {
    expect(formatPercent(12.34)).toBe('+12.3%')
  })

  it('shows negative values without extra sign', () => {
    expect(formatPercent(-5.67)).toBe('-5.7%')
  })

  it('returns em dash for null', () => {
    expect(formatPercent(null)).toBe('—')
  })
})

describe('pctChange', () => {
  it('computes percentage change correctly', () => {
    expect(pctChange(110, 100)).toBeCloseTo(10)
    expect(pctChange(90, 100)).toBeCloseTo(-10)
  })

  it('returns null when current is null', () => {
    expect(pctChange(null, 100)).toBeNull()
  })

  it('returns null when entry is zero', () => {
    expect(pctChange(50, 0)).toBeNull()
  })
})
