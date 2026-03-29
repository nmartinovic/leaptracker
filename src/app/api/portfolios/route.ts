import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'

// GET /api/portfolios — list all portfolios
export async function GET() {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: portfolios, error } = await db
    .from('portfolios')
    .select('*, portfolio_holdings(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(portfolios ?? [])
}

// POST /api/portfolios — create a new portfolio
export async function POST(request: NextRequest) {
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body?.name || typeof body.name !== 'string') {
    return NextResponse.json({ error: 'name is required' }, { status: 400 })
  }

  const db = createAdminClient()
  const { data, error } = await db
    .from('portfolios')
    .insert({ name: body.name.trim(), user_id: user.id })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data, { status: 201 })
}
