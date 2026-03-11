import { createAdminClient } from '@/lib/supabase'
import { DashboardClient } from '@/components/DashboardClient'
import type { TrackedOption } from '@/lib/database.types'

export const dynamic = 'force-dynamic'

type OptionWithHistory = TrackedOption & {
  price_history: Array<{
    bid: number | null
    ask: number | null
    midpoint: number | null
    spy_close: number | null
    date: string
  }>
}

export default async function DashboardPage() {
  const db = createAdminClient()

  const { data: optionsRaw } = await db
    .from('tracked_options')
    .select(`*, price_history(bid, ask, midpoint, spy_close, date)`)
    .order('entry_date', { ascending: false })

  const options = (optionsRaw ?? []) as OptionWithHistory[]

  const rows = options.map((opt) => {
    const history = opt.price_history ?? []
    const latest = history.sort((a, b) => b.date.localeCompare(a.date))[0] ?? null

    const optionPctChange =
      latest?.midpoint != null
        ? ((latest.midpoint - opt.entry_price) / opt.entry_price) * 100
        : null

    const spyPctChange =
      latest?.spy_close != null && opt.spy_price_at_entry
        ? ((latest.spy_close - opt.spy_price_at_entry) / opt.spy_price_at_entry) * 100
        : null

    const alpha =
      optionPctChange != null && spyPctChange != null
        ? optionPctChange - spyPctChange
        : null

    return {
      id: opt.id,
      ticker: opt.ticker,
      expiration_date: opt.expiration_date,
      strike_price: opt.strike_price,
      option_type: opt.option_type,
      entry_price: opt.entry_price,
      entry_date: opt.entry_date,
      tags: opt.tags,
      is_active: opt.is_active,
      current_midpoint: latest?.midpoint ?? null,
      option_pct_change: optionPctChange,
      spy_pct_change: spyPctChange,
      alpha,
    }
  })

  const allTags = Array.from(new Set(rows.flatMap((r) => r.tags))).sort()

  return <DashboardClient options={rows} allTags={allTags} />
}
