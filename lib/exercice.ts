import { supabase } from './supabase'

export const DEFAULT_EXERCICES = [2025, 2024, 2023, 2022, 2021]

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export function parseYear(raw: string | undefined): number {
  const n = parseInt(raw ?? '', 10)
  // Accept any plausible year, not just the hardcoded list
  return n > 2000 && n < 2100 ? n : new Date().getFullYear()
}

/** All years between the first and last écriture in the DB, most recent first. */
export async function getExercices(): Promise<number[]> {
  // Only the two boundary dates are read: fetching every row hits the 1 000-row cap
  const [{ data: first }, { data: last }] = await Promise.all([
    supabase.from('ecritures').select('date').order('date', { ascending: true }).limit(1),
    supabase.from('ecritures').select('date').order('date', { ascending: false }).limit(1),
  ])

  if (!first?.length || !last?.length) return DEFAULT_EXERCICES

  const currentYear = new Date().getFullYear()
  const minYear = parseInt(first[0].date.slice(0, 4), 10)
  // Always include current year even if no entries yet
  const maxYear = Math.max(parseInt(last[0].date.slice(0, 4), 10), currentYear)

  const years: number[] = []
  for (let y = maxYear; y >= minYear; y--) years.push(y)
  return years
}
