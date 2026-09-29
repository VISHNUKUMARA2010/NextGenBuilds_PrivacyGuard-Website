import { createClient, type SupabaseClient, type User } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase: SupabaseClient | null = url && anonKey ? createClient(url, anonKey) : null
export const isSupabaseConfigured = Boolean(supabase)
export type AuthUser = User

export type License = {
  id: string
  user_id: string
  license_key: string
  status: 'active' | 'expired'
  expiry_date: string | null
  created_at: string
}

export type Notification = {
  id: string
  user_id: string
  title: string
  message: string
  kind: string
  read_at: string | null
  created_at: string
}
