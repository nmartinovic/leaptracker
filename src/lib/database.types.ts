// Auto-generate this file by running:
//   npx supabase gen types typescript --project-id <your-project-id> > src/lib/database.types.ts
// This is a hand-written stub until you connect to Supabase.

export type Database = {
  public: {
    Tables: {
      tracked_options: {
        Row: {
          id: string
          yahoo_symbol: string
          ticker: string
          expiration_date: string
          strike_price: number
          option_type: 'C' | 'P'
          entry_price: number
          entry_date: string
          spy_price_at_entry: number | null
          tags: string[]
          is_active: boolean
          entry_price_pending: boolean
          created_at: string
        }
        Insert: {
          id?: string
          yahoo_symbol: string
          ticker: string
          expiration_date: string
          strike_price: number
          option_type: 'C' | 'P'
          entry_price: number
          entry_date?: string
          spy_price_at_entry?: number | null
          tags?: string[]
          is_active?: boolean
          entry_price_pending?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          yahoo_symbol?: string
          ticker?: string
          expiration_date?: string
          strike_price?: number
          option_type?: 'C' | 'P'
          entry_price?: number
          entry_date?: string
          spy_price_at_entry?: number | null
          tags?: string[]
          is_active?: boolean
          entry_price_pending?: boolean
          created_at?: string
        }
      }
      price_history: {
        Row: {
          id: string
          option_id: string
          date: string
          bid: number | null
          ask: number | null
          midpoint: number | null
          spy_close: number | null
        }
        Insert: {
          id?: string
          option_id: string
          date: string
          bid?: number | null
          ask?: number | null
          midpoint?: number | null
          spy_close?: number | null
        }
        Update: {
          id?: string
          option_id?: string
          date?: string
          bid?: number | null
          ask?: number | null
          midpoint?: number | null
          spy_close?: number | null
        }
      }
      portfolios: {
        Row: {
          id: string
          name: string
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_at?: string
        }
      }
      portfolio_holdings: {
        Row: {
          id: string
          portfolio_id: string
          option_id: string
          quantity: number
          cost_basis: number
          start_date: string
        }
        Insert: {
          id?: string
          portfolio_id: string
          option_id: string
          quantity: number
          cost_basis: number
          start_date: string
        }
        Update: {
          id?: string
          portfolio_id?: string
          option_id?: string
          quantity?: number
          cost_basis?: number
          start_date?: string
        }
      }
    }
  }
}

export type TrackedOption = Database['public']['Tables']['tracked_options']['Row']
export type PriceHistory = Database['public']['Tables']['price_history']['Row']
export type Portfolio = Database['public']['Tables']['portfolios']['Row']
export type PortfolioHolding = Database['public']['Tables']['portfolio_holdings']['Row']
