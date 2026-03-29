import { createClient } from '@supabase/supabase-js'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import type { Database } from './database.types'

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!
const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!

// Server-only admin client (service role, bypasses RLS)
// Never import this in client components
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

// Server-side client using anon key + cookie session (for reading auth state)
// Use in server components and API route handlers to get the current user
export async function createSupabaseServerClient() {
  const cookieStore = await cookies()
  return createServerClient<Database>(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll()
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options)
          )
        } catch {
          // Server components cannot set cookies — middleware handles session refresh
        }
      },
    },
  })
}

// Helper: get the authenticated user from the current request's session.
// Returns null if not logged in.
export async function getCurrentUser() {
  const client = await createSupabaseServerClient()
  const { data: { user } } = await client.auth.getUser()
  return user
}
