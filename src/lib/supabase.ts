import { createClient } from '@supabase/supabase-js'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Browser-safe client (anon key, respects RLS)
export const supabase = createClient<Database>(supabaseUrl, supabaseAnonKey)

// Server-only admin client (service role, bypasses RLS)
// Never import this in client components
// Note: Uses untyped client to avoid TS issues with hand-written type stub.
// Run `npx supabase gen types typescript --project-id <id> > src/lib/database.types.ts`
// after connecting to Supabase to get fully-typed queries.
export function createAdminClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    throw new Error('SUPABASE_SERVICE_ROLE_KEY is not set')
  }
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false },
  }) as any // typed as any until real types are generated from supabase gen types
}
