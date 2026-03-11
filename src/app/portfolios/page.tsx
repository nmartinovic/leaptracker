import Link from 'next/link'
import { createAdminClient } from '@/lib/supabase'
import { CreatePortfolioButton } from '@/components/CreatePortfolioButton'
import { formatDate } from '@/lib/formatters'
import type { Portfolio } from '@/lib/database.types'

type PortfolioWithCount = Portfolio & { portfolio_holdings: Array<unknown> }

export const dynamic = 'force-dynamic'

export default async function PortfoliosPage() {
  const db = createAdminClient()

  const { data: portfoliosRaw } = await db
    .from('portfolios')
    .select('*, portfolio_holdings(count)')
    .order('created_at', { ascending: false })

  const list: PortfolioWithCount[] = (portfoliosRaw ?? []) as PortfolioWithCount[]

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-gray-900">Portfolios</h1>
        <CreatePortfolioButton />
      </div>

      {list.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="text-4xl mb-4">📁</div>
          <h3 className="text-lg font-semibold text-gray-900 mb-1">No portfolios yet</h3>
          <p className="text-sm text-gray-500 mb-6 max-w-sm">
            Create a portfolio to group tracked options, specify quantities, and see aggregate performance vs SPY.
          </p>
          <CreatePortfolioButton />
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {list.map((portfolio) => {
            const holdingCount = Array.isArray(portfolio.portfolio_holdings)
              ? portfolio.portfolio_holdings.length
              : 0

            return (
              <Link
                key={portfolio.id}
                href={`/portfolios/${portfolio.id}`}
                className="bg-white rounded-lg border border-gray-200 p-5 hover:shadow-md hover:border-blue-300 transition-all"
              >
                <h3 className="font-semibold text-gray-900 mb-1">{portfolio.name}</h3>
                <p className="text-sm text-gray-500">
                  {holdingCount} holding{holdingCount !== 1 ? 's' : ''}
                </p>
                <p className="text-xs text-gray-400 mt-2">
                  Created {formatDate(portfolio.created_at.slice(0, 10))}
                </p>
              </Link>
            )
          })}
        </div>
      )}
    </div>
  )
}
