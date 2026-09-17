import { supabase } from './supabase'

export const JOURNAUX = ['AC', 'VE', 'BQ', 'CA', 'OD'] as const

const PAGE = 1000

export interface MouvementLigne {
  date: string
  compte_debit: string
  compte_credit: string
  montant: number | string
}

/**
 * Lit toutes les écritures d'une période, page par page
 * (Supabase plafonne chaque requête à 1 000 lignes).
 */
export async function fetchEcritures<T = MouvementLigne>(
  select: string,
  { from, to }: { from?: string; to?: string } = {},
): Promise<{ data: T[]; error: string | null }> {
  const data: T[] = []
  for (let offset = 0; ; offset += PAGE) {
    let query = supabase
      .from('ecritures')
      .select(select)
      .order('date', { ascending: true })
      .order('created_at', { ascending: true })
      .range(offset, offset + PAGE - 1)
    if (from) query = query.gte('date', from)
    if (to) query = query.lte('date', to)
    const { data: page, error } = await query
    if (error) return { data, error: error.message }
    data.push(...(page as T[]))
    if (!page || page.length < PAGE) return { data, error: null }
  }
}

/** Convertit un montant (nombre ou chaîne décimale) en centimes entiers. */
export function toCents(montant: number | string): number {
  return Math.round(Number(String(montant).replace(',', '.')) * 100)
}

/** Normalise le zéro négatif issu des calculs (-0 → 0) avant affichage. */
export function fromCents(cents: number): number {
  return cents === 0 ? 0 : cents / 100
}

/**
 * Contrôles structurels d'une écriture avant insertion.
 * Retourne un message d'erreur, ou null si l'écriture est valide.
 */
export function validerEcriture(e: {
  date: string
  journal_code: string
  libelle: string
  compte_debit: string
  compte_credit: string
  montant: number | string
}): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(e.date) || Number.isNaN(Date.parse(e.date))) return `date invalide « ${e.date} »`
  if (!(JOURNAUX as readonly string[]).includes(e.journal_code)) return `journal inconnu « ${e.journal_code} »`
  if (!e.libelle?.trim()) return 'libellé vide'
  if (!/^[1-8]\d{5}$/.test(e.compte_debit)) return `compte débit « ${e.compte_debit} » : 6 chiffres attendus (ex. 512000)`
  if (!/^[1-8]\d{5}$/.test(e.compte_credit)) return `compte crédit « ${e.compte_credit} » : 6 chiffres attendus (ex. 512000)`
  if (e.compte_debit === e.compte_credit) return `débit et crédit sur le même compte (${e.compte_debit})`
  const cents = toCents(e.montant)
  if (!Number.isFinite(cents) || cents <= 0) return `montant invalide « ${e.montant} »`
  if (Math.abs(Number(String(e.montant).replace(',', '.')) * 100 - cents) > 1e-6) return `montant « ${e.montant} » : 2 décimales maximum`
  return null
}
