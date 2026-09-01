import { createClient } from '@supabase/supabase-js'

// These two values come from .env (see .env.example).
// Vite replaces import.meta.env.VITE_* at build time.
const url = import.meta.env.VITE_SUPABASE_URL
const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const isConfigured = Boolean(url && anonKey)

if (!isConfigured) {
  console.error(
    'Supabase is not configured. Copy .env.example to .env, fill in your ' +
    'project URL and anon key, then restart the dev server.'
  )
}

// createClient gives you an object that speaks to your database over HTTP.
// Every .from('table').select() below becomes a REST call — this is the
// layer you would otherwise write by hand as PHP endpoints.
export const supabase = isConfigured
  ? createClient(url, anonKey)
  : null

// ---- Helpers -------------------------------------------------------

// Postgres stores months as the 1st of the month: 2026-08-01
export function monthKey(date = new Date()) {
  const d = new Date(date)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`
}

export function formatMonth(isoDate) {
  const [y, m] = isoDate.split('-')
  return new Date(Number(y), Number(m) - 1, 1)
    .toLocaleString('en-US', { month: 'long', year: 'numeric' })
}

export function money(n) {
  return new Intl.NumberFormat('en-MY', {
    style: 'currency',
    currency: 'MYR',
    maximumFractionDigits: 0,
  }).format(Number(n) || 0)
}
