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

  // Build a lookup: holdingId → date → price history row
  const priceLookup = new Map<string, Map<string, PriceHistory>>()
  for (const holding of holdings) {
    const byDate = new Map<string, PriceHistory>()
    for (const ph of holding.priceHistory) {
      byDate.set(ph.date, ph)
    }
    priceLookup.set(holding.id, byDate)
  }

  // Find the SPY base price for each holding: first spy_close on or after that holding's start_date.
  // This anchors each holding's SPY equivalent to the day it entered the portfolio.
  const spyBasePricePerHolding = new Map<string, number>()
  for (const holding of holdings) {
    outer: for (const date of sortedDates) {
      if (date < holding.start_date) continue
      for (const h of holdings) {
        const ph = priceLookup.get(h.id)?.get(date)
        if (ph?.spy_close) {
          spyBasePricePerHolding.set(holding.id, ph.spy_close)
          break outer
        }
      }
    }
  }

  const dataPoints: PortfolioDataPoint[] = []

  for (const date of sortedDates) {
    let portfolioValue = 0
    let hasSomeData = false
    let spyClose: number | null = null
    let spyValue = 0

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

    // SPY equivalent: for each holding with price data today, grow its cost basis
    // by SPY's return since that holding was first added.
    for (const holding of holdings) {
      if (date < holding.start_date) continue

      const ph = priceLookup.get(holding.id)?.get(date)
      if (!ph?.midpoint) continue

      const spyBase = spyBasePricePerHolding.get(holding.id)
      if (spyBase) {
        spyValue += (spyClose / spyBase) * holding.cost_basis * holding.quantity * 100
      }
    }

    dataPoints.push({ date, portfolioValue, spyValue })
  }

  return dataPoints
}
