import { describe, it, expect } from 'vitest'
import { parseYahooOptionUrl } from '@/lib/parseOptionSymbol'

describe('parseYahooOptionUrl', () => {
  it('parses a standard Yahoo Finance URL', () => {
    const result = parseYahooOptionUrl('https://finance.yahoo.com/quote/MSFT281215C00195000/')
    expect(result).toEqual({
      yahoo_symbol: 'MSFT281215C00195000',
      ticker: 'MSFT',
      expiration_date: '2028-12-15',
      strike_price: 195,
      option_type: 'C',
    })
  })

  it('parses a URL without trailing slash', () => {
    const result = parseYahooOptionUrl('https://finance.yahoo.com/quote/MSFT281215C00195000')
    expect(result.yahoo_symbol).toBe('MSFT281215C00195000')
  })

  it('parses a URL with query string', () => {
    const result = parseYahooOptionUrl(
      'https://finance.yahoo.com/quote/MSFT281215C00195000/?p=MSFT281215C00195000'
    )
    expect(result.ticker).toBe('MSFT')
    expect(result.strike_price).toBe(195)
  })

  it('parses a bare OCC symbol directly', () => {
    const result = parseYahooOptionUrl('MSFT281215C00195000')
    expect(result.ticker).toBe('MSFT')
    expect(result.option_type).toBe('C')
  })

  it('parses a Put option', () => {
    const result = parseYahooOptionUrl('AAPL271219P00150000')
    expect(result.option_type).toBe('P')
    expect(result.strike_price).toBe(150)
    expect(result.expiration_date).toBe('2027-12-19')
  })

  it('parses a single-character ticker', () => {
    const result = parseYahooOptionUrl('F261218P00012000')
    expect(result.ticker).toBe('F')
    expect(result.strike_price).toBe(12)
    expect(result.expiration_date).toBe('2026-12-18')
  })

  it('handles fractional strike prices correctly', () => {
    // $12.50 → 00012500
    const result = parseYahooOptionUrl('SPY271215C00412500')
    expect(result.strike_price).toBe(412.5)
  })

  it('throws on invalid input', () => {
    expect(() => parseYahooOptionUrl('https://finance.yahoo.com/quote/MSFT/')).toThrow()
    expect(() => parseYahooOptionUrl('not-a-symbol')).toThrow()
    expect(() => parseYahooOptionUrl('')).toThrow()
  })

  it('always prepends 20 to year (LEAPS support)', () => {
    // Year 28 → 2028, not 1928
    const result = parseYahooOptionUrl('MSFT281215C00195000')
    expect(result.expiration_date.startsWith('2028')).toBe(true)
  })
})
