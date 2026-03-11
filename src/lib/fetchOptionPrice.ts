import yahooFinance from 'yahoo-finance2'

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
  // unreachable but satisfies TypeScript
  throw new Error('Retry failed')
}

export async function fetchOptionPrice(yahooSymbol: string): Promise<OptionPriceResult | null> {
  try {
    const quote = await withRetry(() =>
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      yahooFinance.quote(yahooSymbol, { fields: ['bid', 'ask', 'regularMarketPrice'] }) as Promise<any>
    )

    const bid: number = quote.bid ?? 0
    const ask: number = quote.ask ?? 0

    // Do not store $0 prices — option may be illiquid
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
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const quote = await withRetry(() => yahooFinance.quote('SPY', { fields: ['regularMarketPrice'] }) as Promise<any>)
    return (quote.regularMarketPrice as number | undefined) ?? null
  } catch (err) {
    console.error('[fetchSpyPrice] Failed to fetch SPY price:', err)
    return null
  }
}
