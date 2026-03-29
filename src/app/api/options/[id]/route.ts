import { NextRequest, NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'
import type { Database } from '@/lib/database.types'

type TrackedOptionUpdate = Database['public']['Tables']['tracked_options']['Update']

type Params = { params: Promise<{ id: string }> }

// GET /api/options/:id — get option detail with full price history
export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { data: option, error } = await db
    .from('tracked_options')
    .select('*')
    .eq('id', id)
    .eq('user_id', user.id)
    .single()

  if (error || !option) {
    return NextResponse.json({ error: 'Option not found' }, { status: 404 })
  }

  const { data: history } = await db
    .from('price_history')
    .select('*')
    .eq('option_id', id)
    .order('date', { ascending: true })

  return NextResponse.json(Object.assign({}, option, { price_history: history ?? [] }))
}

// PATCH /api/options/:id — update tags or archive
export async function PATCH(request: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => null)
  if (!body) {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const updates: TrackedOptionUpdate = {}
  if ('tags' in body && Array.isArray(body.tags)) updates.tags = body.tags
  if ('is_active' in body && typeof body.is_active === 'boolean') updates.is_active = body.is_active

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  const db = createAdminClient()
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data, error } = await (db.from('tracked_options') as any)
    .update(updates)
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 500 })
  }

  return NextResponse.json(data)
}

// DELETE /api/options/:id — remove option and its price history (cascade)
export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params
  const user = await getCurrentUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const db = createAdminClient()

  const { error } = await db
    .from('tracked_options')
    .delete()
    .eq('id', id)
    .eq('user_id', user.id)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return new NextResponse(null, { status: 204 })
}
