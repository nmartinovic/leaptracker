import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

type Params = { params: Promise<{ id: string }> }

// POST /api/portfolios/:id/holdings — add a holding to a portfolio
export async function POST(request: NextRequest, { params }: Params) {
  const { id: portfolio_id } = await params
  const body = await request.json().catch(() => null)

  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const { option_id, quantity, cost_basis, start_date } = body

  if (!option_id || typeof option_id !== 'string') {
    return NextResponse.json({ error: 'option_id is required' }, { status: 400 })
  }
  if (typeof quantity !== 'number' || quantity <= 0 || !Number.isInteger(quantity)) {
    return NextResponse.json({ error: 'quantity must be a positive integer' }, { status: 400 })
  }
  if (typeof cost_basis !== 'number' || cost_basis <= 0) {
    return NextResponse.json({ error: 'cost_basis must be a positive number' }, { status: 400 })
  }
  if (!start_date || typeof start_date !== 'string') {
    return NextResponse.json({ error: 'start_date is required (ISO date string)' }, { status: 400 })
  }

  const db = createAdminClient()

  // Verify portfolio exists
  const { data: portfolio } = await db.from('portfolios').select('id').eq('id', portfolio_id).single()
  if (!portfolio) {
    return NextResponse.json({ error: 'Portfolio not found' }, { status: 404 })
  }

  // Verify option exists and is active
  const { data: option } = await db
    .from('tracked_options')
    .select('id, is_active')
    .eq('id', option_id)
    .single()

  if (!option) {
    return NextResponse.json({ error: 'Option not found' }, { status: 404 })
  }
  if (!option.is_active) {
    return NextResponse.json({ error: 'Cannot add an inactive/expired option to a portfolio' }, { status: 400 })
  }

  const { data, error } = await db
    .from('portfolio_holdings')
    .insert({ portfolio_id, option_id, quantity, cost_basis, start_date })
    .select()
    .single()

  if (error) {
    // Unique constraint violation
    if (error.code === '23505') {
      return NextResponse.json(
        { error: 'This option is already in the portfolio' },
        { status: 409 }
      )
    }
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
