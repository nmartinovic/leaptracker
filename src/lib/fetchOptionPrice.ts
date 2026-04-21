// eslint-disable-next-line @typescript-eslint/no-explicit-any
import YahooFinanceClass from 'yahoo-finance2'

// yahoo-finance2 v3 requires instantiation
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const yf = new (YahooFinanceClass as any)({ suppressNotices: ['yahooSurvey'] })

export interface OptionPriceResult {
  yahoo_symbol: string
  bid: number
  ask: number
  midpoint: number
  /** true when bid/ask were both 0 and we fell back to last-traded price (market closed) */
  price_is_estimated: boolean
}

async function withRetry<T>(fn: () => Promise<T>, retries = 3): Promise<T> {
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      return await fn()
    } catch (err) {
      if (attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, Math.pow(2, attempt) * 1000))
    }
  }
  throw new Error('Retry failed')
}

export async function fetchOptionPrice(yahooSymbol: string): Promise<OptionPriceResult | null> {
  try {
    const quote = await withRetry(() => yf.quote(yahooSymbol) as Promise<unknown>)

    if (!quote || typeof quote !== 'object') {
      console.warn(`[fetchOptionPrice] No data returned for ${yahooSymbol}`)
      return null
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const q = quote as any
    const bid: number = q.bid ?? 0
    const ask: number = q.ask ?? 0
    const lastPrice: number = q.regularMarketPrice ?? 0

    // If both bid and ask are 0 (common for illiquid LEAPS early in the trading day),
    // fall back to the last traded price as both bid and ask.
    if (bid === 0 && ask === 0) {
      if (lastPrice > 0) {
        console.warn(`[fetchOptionPrice] Zero bid/ask for ${yahooSymbol} — using last price ${lastPrice} as fallback`)
        return {
          yahoo_symbol: yahooSymbol,
          bid: lastPrice,
          ask: lastPrice,
          midpoint: lastPrice,
          price_is_estimated: true,
        }
      }
      console.warn(`[fetchOptionPrice] No price data for ${yahooSymbol} — skipping`)
      return null
    }

    return {
      yahoo_symbol: yahooSymbol,
      bid,
      ask,
      midpoint: (bid + ask) / 2,
      price_is_estimated: false,
    }
  } catch (err) {
    console.error(`[fetchOptionPrice] Failed to fetch ${yahooSymbol}:`, err)
    return null
  }
}

export async function fetchSpyPrice(): Promise<number | null> {
  return fetchStockPrice('SPY')
}

export async function fetchStockPrice(ticker: string): Promise<number | null> {
  try {
    const quote = await withRetry(() => yf.quote(ticker) as Promise<unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((quote as any)?.regularMarketPrice as number | undefined) ?? null
  } catch (err) {
    console.error(`[fetchStockPrice] Failed to fetch ${ticker}:`, err)
    return null
  }
}
