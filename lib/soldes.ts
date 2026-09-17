import { toCents, type MouvementLigne } from './ecritures'

/** Soldes par compte en centimes : débit positif, crédit négatif. */
export type Soldes = Record<string, number>

export function calculerSoldes(rows: MouvementLigne[]): Soldes {
  const soldes: Soldes = {}
  for (const e of rows) {
    const m = toCents(e.montant)
    soldes[e.compte_debit] = (soldes[e.compte_debit] ?? 0) + m
    soldes[e.compte_credit] = (soldes[e.compte_credit] ?? 0) - m
  }
  return soldes
}

/** Solde d'un compte (ou d'une racine de compte) en centimes. */
export function soldeCompte(soldes: Soldes, racine: string): number {
  let total = 0
  for (const [compte, s] of Object.entries(soldes)) if (compte.startsWith(racine)) total += s
  return total
}

/** Totaux du compte de résultat en centimes (classes 6 et 7). */
export function totauxResultat(soldes: Soldes): { produits: number; charges: number; resultat: number } {
  const produits = -soldeCompte(soldes, '7')
  const charges = soldeCompte(soldes, '6')
  return { produits, charges, resultat: produits - charges }
}
