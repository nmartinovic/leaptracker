import { NextRequest, NextResponse } from 'next/server'
import { cronFetchPrices } from '@/lib/cronFetchPrices'

// POST /api/cron/fetch-prices
// Protected by CRON_SECRET — called by Vercel Cron and/or GitHub Actions
export async function POST(request: NextRequest) {
  const authHeader = request.headers.get('Authorization')
  const secret = authHeader?.replace('Bearer ', '')

  if (!secret || secret !== process.env.CRON_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const result = await cronFetchPrices()
    console.log('[cron/fetch-prices] Result:', result)
    return NextResponse.json(result)
  } catch (err) {
    console.error('[cron/fetch-prices] Unhandled error:', err)
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Unknown error' },
      { status: 500 }
    )
  }
}

// Allow Vercel Cron to call this with GET as well
export async function GET(request: NextRequest) {
  return POST(request)
}
