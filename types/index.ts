export interface Ecriture {
  id: string
  date: string
  numero_piece: string
  libelle: string
  compte_debit: string
  compte_credit: string
  montant: number
  journal_code: 'AC' | 'VE' | 'BQ' | 'CA' | 'OD'
  created_at: string
}

export type JournalCode = 'AC' | 'VE' | 'BQ' | 'CA' | 'OD'

export const JOURNAL_LABELS: Record<string, string> = {
  AC: 'Achats',
  VE: 'Ventes',
  BQ: 'Banque',
  CA: 'Caisse',
  OD: 'Opérations Diverses',
}
