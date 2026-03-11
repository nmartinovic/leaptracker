export interface ParsedOptionSymbol {
  yahoo_symbol: string
  ticker: string
  expiration_date: string // ISO date: 'YYYY-MM-DD'
  strike_price: number
  option_type: 'C' | 'P'
}

// OCC symbol format: {TICKER}{YYMMDD}{C|P}{PRICE_IN_THOUSANDTHS}
// Example: MSFT281215C00195000 → MSFT, 2028-12-15, Call, $195.00
const SYMBOL_REGEX = /([A-Z]{1,6})(\d{6})([CP])(\d{8})/

export function parseYahooOptionUrl(input: string): ParsedOptionSymbol {
  // Strip query strings and trailing slashes, then extract the symbol
  const cleaned = input.split('?')[0].replace(/\/$/, '')

  // Try to extract the symbol from a full URL path like /quote/MSFT281215C00195000
  const urlMatch = cleaned.match(/\/quote\/([A-Z0-9]+)/)
  const symbolCandidate = urlMatch ? urlMatch[1] : cleaned.split('/').pop() ?? cleaned

  const match = symbolCandidate.toUpperCase().match(SYMBOL_REGEX)
  if (!match) {
    throw new Error(
      `Could not parse option symbol from: "${input}". ` +
        'Expected a Yahoo Finance option URL or OCC symbol like MSFT281215C00195000.'
    )
  }

  const [, ticker, yymmdd, optionType, priceThousandths] = match

  // Parse expiration: YYMMDD → YYYY-MM-DD (always prepend '20' for LEAPS support)
  const year = `20${yymmdd.slice(0, 2)}`
  const month = yymmdd.slice(2, 4)
  const day = yymmdd.slice(4, 6)
  const expiration_date = `${year}-${month}-${day}`

  const strike_price = parseInt(priceThousandths, 10) / 1000

  return {
    yahoo_symbol: symbolCandidate.toUpperCase(),
    ticker,
    expiration_date,
    strike_price,
    option_type: optionType as 'C' | 'P',
  }
}
