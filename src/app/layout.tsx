import type { Metadata } from 'next'
import Link from 'next/link'
import { getCurrentUser } from '@/lib/supabase'
import { LogoutButton } from '@/components/LogoutButton'
import './globals.css'

export const metadata: Metadata = {
  title: 'LeapTracker',
  description: 'Track options performance over time, benchmarked against SPY',
}

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser()

  return (
    <html lang="en">
      <body className="antialiased">
        <nav className="bg-white border-b border-gray-200 px-4 py-3">
          <div className="max-w-7xl mx-auto flex items-center justify-between">
            <Link href="/" className="text-lg font-bold text-gray-900 tracking-tight">
              LeapTracker
            </Link>
            <div className="flex items-center gap-6">
              {user && (
                <>
                  <Link href="/" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Dashboard
                  </Link>
                  <Link href="/portfolios" className="text-sm text-gray-600 hover:text-gray-900 transition-colors">
                    Portfolios
                  </Link>
                  <span className="text-sm text-gray-400">{user.email}</span>
                  <LogoutButton />
                </>
              )}
            </div>
          </div>
        </nav>
        <main className="max-w-7xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  )
}
