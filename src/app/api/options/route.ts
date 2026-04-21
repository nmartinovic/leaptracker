import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import { parseYahooOptionUrl } from '@/lib/parseOptionSymbol'
import { fetchOptionPrice, fetchSpyPrice } from '@/lib/fetchOptionPrice'
import type { TrackedOption } from '@/lib/database.types'

// GET /api/options — list all tracked options with latest price data
export async function GET(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()
  const { searchParams } = new URL(request.url)
  const tagFilter = searchParams.get('tag')

  let query = db
    .from('tracked_options')
    .select('*')
    .eq('user_id', user.id)
    .order('entry_date', { ascending: false })
  if (tagFilter) {
    query = query.contains('tags', [tagFilter])
  }

  const { data: options, error } = await query
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch latest price_history for each option
  const result = await Promise.all(
    (options ?? [] as TrackedOption[]).map(async (opt: TrackedOption) => {
      const { data: latestHistory } = await db
        .from('price_history')
        .select('midpoint, spy_close, date')
        .eq('option_id', opt.id)
        .order('date', { ascending: false })
        .limit(1)
        .maybeSingle()

      const currentMidpoint = latestHistory?.midpoint ?? null
      const currentSpyClose = latestHistory?.spy_close ?? null

      const optionPctChange =
        currentMidpoint != null
          ? ((currentMidpoint - opt.entry_price) / opt.entry_price) * 100
          : null

      const spyPctChange =
        currentSpyClose != null && opt.spy_price_at_entry
          ? ((currentSpyClose - opt.spy_price_at_entry) / opt.spy_price_at_entry) * 100
          : null

      const alpha =
        optionPctChange != null && spyPctChange != null
          ? optionPctChange - spyPctChange
          : null

      return {
        ...opt,
        current_midpoint: currentMidpoint,
        current_spy_close: currentSpyClose,
        latest_price_date: latestHistory?.date ?? null,
        option_pct_change: optionPctChange,
        spy_pct_change: spyPctChange,
        alpha,
      }
    })
  )

  return NextResponse.json(result)
}

// POST /api/options — add a new option to track
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { url, entry_price, tags } = body

  if (!url || typeof url !== 'string') {
    return NextResponse.json({ error: 'url is required' }, { status: 400 })
  }
  if (typeof entry_price !== 'number' || entry_price <= 0) {
    return NextResponse.json({ error: 'entry_price must be a positive number' }, { status: 400 })
  }

  let parsed
  try {
    parsed = parseYahooOptionUrl(url)
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Failed to parse option URL' },
      { status: 400 }
    )
  }

  const db = createAdminClient()

  // Check for duplicate (same symbol, same user)
  const { data: existing } = await db
    .from('tracked_options')
    .select('id')
    .eq('yahoo_symbol', parsed.yahoo_symbol)
    .eq('user_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json(
      { error: `Option ${parsed.yahoo_symbol} is already being tracked` },
      { status: 409 }
    )
  }

  // Fetch current prices
  const [priceResult, spyPrice] = await Promise.all([
    fetchOptionPrice(parsed.yahoo_symbol),
    fetchSpyPrice(),
  ])

  const today = new Date().toISOString().slice(0, 10)

  // Insert tracked option
  const { data: newOption, error: insertError } = await db
    .from('tracked_options')
    .insert({
      ...parsed,
      user_id: user.id,
      entry_price,
      entry_date: today,
      spy_price_at_entry: spyPrice ?? undefined,
      tags: Array.isArray(tags) ? tags : [],
    })
    .select()
    .single()

  if (insertError) {
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  // Insert initial price history row only if we have real (non-estimated) prices
  if (priceResult && newOption && !priceResult.price_is_estimated) {
    await db.from('price_history').insert({
      option_id: newOption.id,
      date: today,
      bid: priceResult.bid,
      ask: priceResult.ask,
      midpoint: priceResult.midpoint,
      spy_close: spyPrice ?? undefined,
    })
  }

  return NextResponse.json(newOption, { status: 201 })
}
