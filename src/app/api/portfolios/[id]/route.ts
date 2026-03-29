import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import { computePortfolioTimeSeries, type HoldingWithOption } from '@/lib/computePortfolioTimeSeries'
import type { PortfolioHolding } from '@/lib/database.types'

type Params = { params: Promise<{ id: string }> }

// GET /api/portfolios/:id — get portfolio with holdings and performance time series
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: portfolio, error: portfolioError } = await db
    .from('portfolios')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (portfolioError || !portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  const { data: holdings, error: holdingsError } = await db
    .from('portfolio_holdings')
    .select('*')
    .eq('portfolio_id', id)

  if (holdingsError) {
    return NextResponse.json({ error: holdingsError.message }, { status: 500 })
  }

  if (!holdings || holdings.length === 0) {
    return NextResponse.json({ ...portfolio, holdings: [], timeSeries: [] })
  }

  // Fetch full details for each holding in parallel
  const holdingsWithData: HoldingWithOption[] = await Promise.all(
    (holdings as PortfolioHolding[]).map(async (holding: PortfolioHolding) => {
      const [{ data: option }, { data: history }] = await Promise.all([
        db.from('tracked_options').select('*').eq('id', holding.option_id).single(),
        db
          .from('price_history')
          .select('*')
          .eq('option_id', holding.option_id)
          .gte('date', holding.start_date)
          .order('date', { ascending: true }),
      ])

      return {
        ...holding,
        option: option!,
        priceHistory: history ?? [],
      }
    })
  )

  const timeSeries = computePortfolioTimeSeries(holdingsWithData)

  // Compute current value per holding
  const holdingsSummary = holdingsWithData.map((h) => {
    const latest = h.priceHistory[h.priceHistory.length - 1]
    const currentValue = latest?.midpoint ? latest.midpoint * h.quantity * 100 : null
    const costBasisTotal = h.cost_basis * h.quantity * 100
    const pctChange =
      currentValue != null ? ((currentValue - costBasisTotal) / costBasisTotal) * 100 : null

    return {
      id: h.id,
      option_id: h.option_id,
      option: h.option,
      quantity: h.quantity,
      cost_basis: h.cost_basis,
      start_date: h.start_date,
      current_value: currentValue,
      cost_basis_total: costBasisTotal,
      pct_change: pctChange,
    }
  })

  // Portfolio totals
  const totalCostBasis = holdingsSummary.reduce((s, h) => s + h.cost_basis_total, 0)
  const totalCurrentValue = holdingsSummary.reduce((s, h) => s + (h.current_value ?? 0), 0)
  const totalPctChange =
    totalCostBasis > 0 ? ((totalCurrentValue - totalCostBasis) / totalCostBasis) * 100 : null

  // SPY return over the same period (from first data point to last)
  const firstPoint = timeSeries[0]
  const lastPoint = timeSeries[timeSeries.length - 1]
  const spyPctChange =
    firstPoint && lastPoint
      ? ((lastPoint.spyValue - firstPoint.spyValue) / firstPoint.spyValue) * 100
      : null

  return NextResponse.json({
    ...portfolio,
    holdings: holdingsSummary,
    timeSeries,
    summary: {
      total_cost_basis: totalCostBasis,
      total_current_value: totalCurrentValue,
      total_pct_change: totalPctChange,
      spy_pct_change: spyPctChange,
      alpha: totalPctChange != null && spyPctChange != null ? totalPctChange - spyPctChange : null,
    },
  })
}
