import { NextResponse } from 'next/server'
import { createAdminClient, getCurrentUser } from '@/lib/supabase'

// POST /api/admin/claim-data
// One-time endpoint: assigns all existing rows with null user_id to the current user.
// Call this once after signing up to claim pre-existing data.
// Protected by session — must be logged in.
export async function POST() {
  const user = await getCurrentUser()
  if (!user) {
    return NextResponse.json({ error: 'Not authenticated' }, { status: 401 })
  }

  const db = createAdminClient()

  const [optionsResult, portfoliosResult] = await Promise.all([
    db.from('tracked_options').update({ user_id: user.id }).is('user_id', null),
    db.from('portfolios').update({ user_id: user.id }).is('user_id', null),
  ])

  if (optionsResult.error || portfoliosResult.error) {
    return NextResponse.json(
      { error: optionsResult.error?.message ?? portfoliosResult.error?.message },
      { status: 500 }
    )
  }

  return NextResponse.json({ ok: true, claimed_for: user.email })
}
