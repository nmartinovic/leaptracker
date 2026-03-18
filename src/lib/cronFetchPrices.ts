import pLimit from 'p-limit'
import { createAdminClient } from './supabase'
import { fetchOptionPrice, fetchSpyPrice } from './fetchOptionPrice'
import { isTradingDay } from './marketHolidays'

type ActiveOption = { id: string; yahoo_symbol: string; expiration_date: string; entry_price_pending: boolean }

export interface CronResult {
  date: string
  fetched: number
  skipped: number
  archived: number
  errors: string[]
  skippedReason?: string
}

export async function cronFetchPrices(): Promise<CronResult> {
  const today = new Date()
  const todayIso = today.toISOString().slice(0, 10)

  const result: CronResult = {
    date: todayIso,
    fetched: 0,
    skipped: 0,
    archived: 0,
    errors: [],
  }

  if (!isTradingDay(today)) {
    result.skippedReason = 'Not a trading day'
    return result
  }

  const db = createAdminClient()

  // Fetch all active options
  const { data: options, error: fetchError } = await db
    .from('tracked_options')
    .select('id, yahoo_symbol, expiration_date, entry_price_pending')
    .eq('is_active', true)

  if (fetchError) {
    result.errors.push(`Failed to fetch options: ${fetchError.message}`)
    return result
  }

  if (!options || options.length === 0) {
    return result
  }

  const typedOptions: ActiveOption[] = options as ActiveOption[]

  // Fetch SPY price once for all options
  const spyClose = await fetchSpyPrice()
  if (!spyClose) {
    result.errors.push('Failed to fetch SPY price')
  }

  // Identify expired options to archive
  const toArchive = typedOptions.filter((o) => o.expiration_date < todayIso)
  const activeOptions = typedOptions.filter((o) => o.expiration_date >= todayIso)

  // Archive expired options
  if (toArchive.length > 0) {
    const archiveIds = toArchive.map((o) => o.id)
    const { error: archiveError } = await db
      .from('tracked_options')
      .update({ is_active: false })
      .in('id', archiveIds)

    if (archiveError) {
      result.errors.push(`Failed to archive expired options: ${archiveError.message}`)
    } else {
      result.archived = toArchive.length
    }
  }

  // Fetch prices concurrently, max 5 at a time to avoid rate limiting
  const limit = pLimit(5)

  const tasks = activeOptions.map((option) =>
    limit(async () => {
      const price = await fetchOptionPrice(option.yahoo_symbol)

      if (!price) {
        result.skipped++
        return
      }

      // Upsert into price_history — safe to re-run (unique constraint on option_id + date)
      const { error: insertError } = await db.from('price_history').upsert(
        {
          option_id: option.id,
          date: todayIso,
          bid: price.bid,
          ask: price.ask,
          midpoint: price.midpoint,
          spy_close: spyClose,
        },
        { onConflict: 'option_id,date' }
      )

      if (insertError) {
        result.errors.push(`Failed to insert price for ${option.yahoo_symbol}: ${insertError.message}`)
        result.skipped++
        return
      }

      result.fetched++

      // If entry_price was a placeholder (added outside market hours), backfill with live midpoint
      if (option.entry_price_pending) {
        await db
          .from('tracked_options')
          .update({ entry_price: price.midpoint, entry_price_pending: false })
          .eq('id', option.id)
        console.log(`[cron] Backfilled entry_price for ${option.yahoo_symbol}: ${price.midpoint}`)
      }
    })
  )

  await Promise.allSettled(tasks)

  return result
}
