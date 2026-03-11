import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient } from '@/lib/supabase'

// GET /api/portfolios — list all portfolios
export async function GET() {
  const db = createAdminClient()

  const { data: portfolios, error } = await db
    .from('portfolios')
    .select('*, portfolio_holdings(count)')
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(portfolios ?? [])
}

// POST /api/portfolios — create a new portfolio
export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolios')
    .insert({ name: body.name.trim() })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
