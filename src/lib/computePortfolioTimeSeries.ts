import type { PortfolioHolding, PriceHistory, TrackedOption } from './database.types'

export interface PortfolioDataPoint {
  date: string
  portfolioValue: number
  spyValue: number
}

export interface HoldingWithOption extends PortfolioHolding {
  option: TrackedOption
  priceHistory: PriceHistory[]
}

export function computePortfolioTimeSeries(holdings: HoldingWithOption[]): PortfolioDataPoint[] {
  if (holdings.length === 0) return []

  // Gather all unique dates across all holdings (from their start_date onward)
  const dateSet = new Set<string>()
  for (const holding of holdings) {
    for (const ph of holding.priceHistory) {
      if (ph.date >= holding.start_date) {
        dateSet.add(ph.date)
      }
    }
  }

  const sortedDates = Array.from(dateSet).sort()
  if (sortedDates.length === 0) return []

  // Compute total initial cost basis (for SPY comparison)
  // Each contract represents 100 shares
  const totalCostBasis = holdings.reduce(
    (sum, h) => sum + h.cost_basis * h.quantity * 100,
    0
  )

  // Build a lookup: holdingId → date → price history row
  const priceLookup = new Map<string, Map<string, PriceHistory>>()
  for (const holding of holdings) {
    const byDate = new Map<string, PriceHistory>()
    for (const ph of holding.priceHistory) {
      byDate.set(ph.date, ph)
    }
    priceLookup.set(holding.id, byDate)
  }

  // Find SPY price on the earliest start date for normalization
  const earliestStart = holdings.reduce(
    (min, h) => (h.start_date < min ? h.start_date : min),
    holdings[0].start_date
  )

  // Find first SPY price on or after earliest start
  let spyBasePrice: number | null = null
  for (const date of sortedDates) {
    if (date < earliestStart) continue
    for (const holding of holdings) {
      const ph = priceLookup.get(holding.id)?.get(date)
      if (ph?.spy_close) {
        spyBasePrice = ph.spy_close
        break
      }
    }
    if (spyBasePrice) break
  }

  const dataPoints: PortfolioDataPoint[] = []

  for (const date of sortedDates) {
    // Sum portfolio value across all holdings that have started by this date
    let portfolioValue = 0
    let hasSomeData = false
    let spyClose: number | null = null

    for (const holding of holdings) {
      if (date < holding.start_date) continue

      const ph = priceLookup.get(holding.id)?.get(date)
      if (!ph?.midpoint) continue

      portfolioValue += ph.midpoint * holding.quantity * 100
      hasSomeData = true

      if (!spyClose && ph.spy_close) {
        spyClose = ph.spy_close
      }
    }

    if (!hasSomeData || !spyClose) continue

    // SPY equivalent: same initial dollar amount grows with SPY
    const spyValue = spyBasePrice ? (spyClose / spyBasePrice) * totalCostBasis : totalCostBasis

    dataPoints.push({ date, portfolioValue, spyValue })
  }

  return dataPoints
}
