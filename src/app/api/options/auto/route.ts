import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'
import { findLeapCallOption } from '@/lib/findLeapOption'
import { fetchSpyPrice } from '@/lib/fetchOptionPrice'

// POST /api/options/auto
// Body: { symbol: "AAPL" }
// Finds a LEAPS call option (>= 540 days to expiry, ATM strike) and adds it with tag "auto"
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { symbol } = body
  if (!symbol || typeof symbol !== 'string') {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  }

  const ticker = symbol.trim().toUpperCase()

  let leap
  try {
    leap = await findLeapCallOption(ticker)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to find LEAPS option' },
      { status: 422 }
    )
  }

  const db = createAdminClient()

  // Check for duplicate
  const { data: existing } = await db
    .from('tracked_options')
    .select('id')
    .eq('yahoo_symbol', leap.yahoo_symbol)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `Option ${leap.yahoo_symbol} is already being tracked` },
      { status: 409 }
    )
  }

  const spyPrice = await fetchSpyPrice()
  const today = new Date().toISOString().slice(0, 10)

  const { data: newOption, error: insertError } = await db
    .from('tracked_options')
    .insert({
      yahoo_symbol: leap.yahoo_symbol,
      ticker: leap.ticker,
      expiration_date: leap.expiration_date,
      strike_price: leap.strike_price,
      option_type: leap.option_type,
      entry_price: leap.midpoint,
      entry_date: today,
      spy_price_at_entry: spyPrice ?? undefined,
      tags: ['auto'],
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (newOption) {
    await db.from('price_history').insert({
      option_id: newOption.id,
      date: today,
      bid: leap.bid,
      ask: leap.ask,
      midpoint: leap.midpoint,
      spy_close: spyPrice ?? undefined,
    })
  }

  return NextResponse.json(
    {
      ...newOption,
      _auto_selected: {
        current_stock_price: leap.current_stock_price,
        days_to_expiry: leap.days_to_expiry,
        bid: leap.bid,
        ask: leap.ask,
        midpoint: leap.midpoint,
      },
    },
    { status: 201 }
  )
}
