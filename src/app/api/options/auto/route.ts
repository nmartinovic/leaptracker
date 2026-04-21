import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import { findLeapCallOption } from '@/lib/findLeapOption'
import { fetchSpyPrice } from '@/lib/fetchOptionPrice'

// POST /api/options/auto
// Body: { symbol: "AAPL" }
// Finds a LEAPS call option (>= 540 days to expiry, ATM strike) and adds it with tag "auto"
//
// Auth: requires either
//   - A valid user session (browser), or
//   - Authorization: Bearer <CRON_SECRET> header (external scripts/cron) → assigned to OWNER_USER_ID
export async function POST(request: NextRequest) {
  // Determine user_id: session takes priority, then fall back to CRON_SECRET + OWNER_USER_ID
  let userId: string | null = null

  const authHeader = request.headers.get('authorization')
  const sessionUser = await getCurrentUser()
  if (sessionUser) {
    userId = sessionUser.id
  } else {
    const cronSecret = process.env.CRON_SECRET
    if (cronSecret && authHeader === `Bearer ${cronSecret}`) {
      userId = process.env.OWNER_USER_ID ?? null
    }
  }

  console.log('cronSecret set:', !!process.env.CRON_SECRET, 'length:', process.env.CRON_SECRET?.length)
  console.log('authHeader:', authHeader)
  console.log('owner_user_id set:', !!process.env.OWNER_USER_ID)

  if (!userId) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { symbol } = body
  if (!symbol || typeof symbol !== 'string') {
    return NextResponse.json({ error: 'symbol is required' }, { status: 400 })
  }

  const ticker = symbol.trim().toUpperCase()

  const db = createAdminClient()

  // Item 1: If any active #auto option for this ticker already exists for this user, no-op
  const { data: existingByTicker } = await db
    .from('tracked_options')
    .select('id, yahoo_symbol')
    .eq('user_id', userId)
    .eq('ticker', ticker)
    .eq('is_active', true)
    .contains('tags', ['auto'])
    .maybeSingle()

  if (existingByTicker) {
    return NextResponse.json(
      { ignored: true, message: `Already tracking an active #auto position for ${ticker}`, existing_id: existingByTicker.id },
      { status: 200 }
    )
  }

  let leap
  try {
    leap = await findLeapCallOption(ticker)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to find LEAPS option' },
      { status: 422 }
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
      entry_price_pending: leap.price_is_estimated,
      user_id: userId,
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  if (newOption && !leap.price_is_estimated) {
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
