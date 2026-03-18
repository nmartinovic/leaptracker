// eslint-disable-next-line @typescript-eslint/no-explicit-any
import YahooFinanceClass from 'yahoo-finance2'
import { parseYahooOptionUrl } from './parseOptionSymbol'
import type { ParsedOptionSymbol } from './parseOptionSymbol'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] })

const MIN_DAYS_TO_EXPIRY = 540

export interface FoundLeapOption extends ParsedOptionSymbol {
  bid: number
  ask: number
  midpoint: number
  days_to_expiry: number
  current_stock_price: number
  /** true when bid/ask were both 0 and we fell back to last-traded price (market closed) */
  price_is_estimated: boolean
}

export async function findLeapCallOption(ticker: string): Promise<FoundLeapOption> {
  const upperTicker = ticker.toUpperCase()

  // 1. Get current stock price
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const stockQuote = await (yf.quote(upperTicker) as Promise<any>)
  if (!stockQuote || !stockQuote.regularMarketPrice) {
    throw new Error(`Could not fetch current price for ${upperTicker}`)
  }
  const currentPrice: number = stockQuote.regularMarketPrice

  // 2. Get available expiration dates
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const baseOptions = await (yf.options(upperTicker) as Promise<any>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const expirationDates: Date[] = baseOptions.expirationDates ?? []
  if (expirationDates.length === 0) {
    throw new Error(`No option expirations found for ${upperTicker}`)
  }

  // 3. Find nearest expiration >= MIN_DAYS_TO_EXPIRY from today
  const today = new Date()
  const minExpiry = new Date(today.getTime() + MIN_DAYS_TO_EXPIRY * 24 * 60 * 60 * 1000)

  const qualifying = expirationDates.filter((d) => new Date(d) >= minExpiry)
  if (qualifying.length === 0) {
    throw new Error(
      `No call options with at least ${MIN_DAYS_TO_EXPIRY} days to expiration found for ${upperTicker}`
    )
  }
  const targetExpiry = new Date(qualifying[0])

  // 4. Fetch the option chain for that expiration date
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const chain = await (yf.options(upperTicker, { date: targetExpiry }) as Promise<any>)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const calls: any[] = chain?.options?.[0]?.calls ?? []
  if (calls.length === 0) {
    throw new Error(`No call options found for ${upperTicker} expiring around ${targetExpiry.toISOString().slice(0, 10)}`)
  }

  // 5. Find the call with strike closest to current stock price
  const atm = calls.reduce((best: typeof calls[0], c: typeof calls[0]) => {
    const dist = Math.abs((c.strike ?? Infinity) - currentPrice)
    const bestDist = Math.abs((best.strike ?? Infinity) - currentPrice)
    return dist < bestDist ? c : best
  })

  if (!atm.contractSymbol) {
    throw new Error(`Selected option contract has no symbol`)
  }

  // 6. Parse the OCC contract symbol
  const parsed = parseYahooOptionUrl(atm.contractSymbol)

  // 7. Compute bid/ask (fall back to lastPrice if both are 0 — market closed)
  const bid: number = atm.bid ?? 0
  const ask: number = atm.ask ?? 0
  const lastPrice: number = atm.lastPrice ?? 0
  const marketClosed = bid === 0 && ask === 0
  const effectiveBid = marketClosed ? lastPrice : bid
  const effectiveAsk = marketClosed ? lastPrice : ask
  const midpoint = (effectiveBid + effectiveAsk) / 2

  if (midpoint <= 0) {
    throw new Error(`Could not determine a valid price for ${atm.contractSymbol}`)
  }

  const msPerDay = 24 * 60 * 60 * 1000
  const days_to_expiry = Math.round((targetExpiry.getTime() - today.getTime()) / msPerDay)

  return {
    ...parsed,
    bid: effectiveBid,
    ask: effectiveAsk,
    midpoint,
    days_to_expiry,
    current_stock_price: currentPrice,
    price_is_estimated: marketClosed,
  }
}
