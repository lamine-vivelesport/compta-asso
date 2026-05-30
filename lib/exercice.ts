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

/** Fetch all years that have at least one écriture in the DB. */
export async function getExercices(): Promise<number[]> {
  const { data } = await supabase
    .from('ecritures')
    .select('date')
    .order('date', { ascending: false })

  if (!data || data.length === 0) return DEFAULT_EXERCICES

  const years = [...new Set(
    data
      .map((e: { date: string }) => parseInt(e.date.slice(0, 4), 10))
      .filter((y: number) => !isNaN(y) && y > 2000 && y < 2100)
  )].sort((a, b) => b - a) as number[]

  // Always include current year even if no entries yet
  const currentYear = new Date().getFullYear()
  if (!years.includes(currentYear)) years.unshift(currentYear)

  return years
}
