export const EXERCICES = [2025, 2024, 2023, 2022, 2021]
export const DEFAULT_YEAR = 2025

export function yearRange(year: number) {
  return { from: `${year}-01-01`, to: `${year}-12-31` }
}

export function parseYear(raw: string | undefined): number {
  const n = parseInt(raw ?? '', 10)
  return EXERCICES.includes(n) ? n : DEFAULT_YEAR
}
