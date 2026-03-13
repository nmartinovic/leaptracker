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

    // Do not store $0 prices — option may be illiquid or not tracked by Yahoo
    if (bid === 0 || ask === 0) {
      console.warn(`[fetchOptionPrice] Zero bid or ask for ${yahooSymbol} — skipping`)
      return null
    }

    return {
      yahoo_symbol: yahooSymbol,
      bid,
      ask,
      midpoint: (bid + ask) / 2,
    }
  } catch (err) {
    console.error(`[fetchOptionPrice] Failed to fetch ${yahooSymbol}:`, err)
    return null
  }
}

export async function fetchSpyPrice(): Promise<number | null> {
  try {
    const quote = await withRetry(() => yf.quote('SPY') as Promise<unknown>)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return ((quote as any)?.regularMarketPrice as number | undefined) ?? null
  } catch (err) {
    console.error('[fetchSpyPrice] Failed to fetch SPY price:', err)
    return null
  }
}
