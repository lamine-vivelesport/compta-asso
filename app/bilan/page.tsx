export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS } from '@/lib/pcg'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

interface BilanLine {
  compte: string
  libelle: string
  montant: number
}

export default async function BilanPage() {
  const { data, error } = await supabase
    .from('ecritures')
    .select('compte_debit, compte_credit, montant')

  const rows = data ?? []

  // Compute net solde for each account (debit - credit)
  const soldes: Record<string, number> = {}
  for (const e of rows) {
    const d = e.compte_debit as string
    const c = e.compte_credit as string
    const m = Number(e.montant)
    soldes[d] = (soldes[d] ?? 0) + m
    soldes[c] = (soldes[c] ?? 0) - m
  }

  // Helper: get lines for a class prefix, filter by debit or credit solde
  const getLines = (prefix: string, sign: 'debit' | 'credit'): BilanLine[] =>
    Object.entries(soldes)
      .filter(([c]) => c.startsWith(prefix))
      .map(([compte, solde]) => ({
        compte,
        libelle: PCG_ACCOUNTS[compte] ?? compte,
        montant: sign === 'debit' ? solde : -solde,
      }))
      .filter(a => a.montant > 0.001)
      .sort((a, b) => a.compte.localeCompare(b.compte))

  // ACTIF
  const immobilisations = getLines('2', 'debit')
  const stocks = getLines('3', 'debit')
  // Class 4: tiers with debit solde (créances)
  const creances = Object.entries(soldes)
    .filter(([c]) => c.startsWith('4'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: solde }))
    .filter(a => a.montant > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))
  const tresorerie = getLines('5', 'debit')

  const totalActif =
    immobilisations.reduce((s, a) => s + a.montant, 0) +
    stocks.reduce((s, a) => s + a.montant, 0) +
    creances.reduce((s, a) => s + a.montant, 0) +
    tresorerie.reduce((s, a) => s + a.montant, 0)

  // PASSIF
  // Class 1: fonds propres with credit solde
  const fondsPropres = getLines('1', 'credit')
  // Class 4: tiers with credit solde (dettes)
  const dettes = Object.entries(soldes)
    .filter(([c]) => c.startsWith('4'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: -solde }))
    .filter(a => a.montant > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))

  // Résultat (from class 6 and 7)
  let totalProduits = 0
  let totalCharges = 0
  for (const [compte, solde] of Object.entries(soldes)) {
    if (compte.startsWith('7')) totalProduits += -solde
    if (compte.startsWith('6')) totalCharges += solde
  }
  const resultat = totalProduits - totalCharges

  const totalPassif =
    fondsPropres.reduce((s, a) => s + a.montant, 0) +
    dettes.reduce((s, a) => s + a.montant, 0) +
    resultat

  function BilanTable({ title, color, lines, subtotal, subtotalLabel }: {
    title: string
    color: string
    lines: BilanLine[]
    subtotal: number
    subtotalLabel: string
  }) {
    return (
      <div className="mb-4">
        <h3 className={`text-sm font-bold uppercase tracking-wide mb-2 ${color}`}>{title}</h3>
        {lines.length === 0 ? (
          <p className="text-xs text-gray-400 italic px-2">Aucune écriture</p>
        ) : (
          <table className="min-w-full text-sm mb-1">
            <tbody className="divide-y divide-gray-100">
              {lines.map(a => (
                <tr key={a.compte} className="hover:bg-gray-50">
                  <td className="px-3 py-2 font-mono text-xs text-indigo-700 font-semibold w-16">{a.compte}</td>
                  <td className="px-3 py-2 text-gray-700">{a.libelle}</td>
                  <td className="px-3 py-2 text-right font-medium text-gray-800">{fmt(a.montant)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        <div className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded text-sm font-semibold">
          <span className="text-gray-700">{subtotalLabel}</span>
          <span className="text-gray-900">{fmt(subtotal)}</span>
        </div>
      </div>
    )
  }

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Bilan</h1>
      <p className="text-sm text-gray-500 mb-6">Association Loi 1901 — Exercice en cours</p>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur lors du chargement des données.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* ACTIF */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-blue-700 px-6 py-4">
            <h2 className="text-white font-bold text-lg">ACTIF</h2>
          </div>
          <div className="p-4 space-y-4">
            <BilanTable
              title="Immobilisations (Classe 2)"
              color="text-blue-700"
              lines={immobilisations}
              subtotal={immobilisations.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Immobilisations"
            />
            <BilanTable
              title="Stocks (Classe 3)"
              color="text-blue-700"
              lines={stocks}
              subtotal={stocks.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Stocks"
            />
            <BilanTable
              title="Créances (Classe 4 — solde débiteur)"
              color="text-blue-700"
              lines={creances}
              subtotal={creances.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Créances"
            />
            <BilanTable
              title="Trésorerie (Classe 5)"
              color="text-blue-700"
              lines={tresorerie}
              subtotal={tresorerie.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Trésorerie"
            />
            <div className="flex justify-between items-center bg-blue-700 text-white px-4 py-3 rounded-lg font-bold text-base mt-2">
              <span>TOTAL ACTIF</span>
              <span>{fmt(totalActif)}</span>
            </div>
          </div>
        </div>

        {/* PASSIF */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-purple-700 px-6 py-4">
            <h2 className="text-white font-bold text-lg">PASSIF</h2>
          </div>
          <div className="p-4 space-y-4">
            <BilanTable
              title="Fonds propres (Classe 1)"
              color="text-purple-700"
              lines={fondsPropres}
              subtotal={fondsPropres.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Fonds propres"
            />
            <BilanTable
              title="Dettes (Classe 4 — solde créditeur)"
              color="text-purple-700"
              lines={dettes}
              subtotal={dettes.reduce((s, a) => s + a.montant, 0)}
              subtotalLabel="Total Dettes"
            />

            {/* Résultat */}
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-purple-700 mb-2">Résultat de l&apos;exercice</h3>
              <div className="flex justify-between items-center bg-gray-100 px-3 py-2 rounded text-sm font-semibold">
                <span className="text-gray-700">{resultat >= 0 ? 'Excédent' : 'Déficit'}</span>
                <span className={resultat >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(resultat)}</span>
              </div>
            </div>

            <div className="flex justify-between items-center bg-purple-700 text-white px-4 py-3 rounded-lg font-bold text-base mt-2">
              <span>TOTAL PASSIF</span>
              <span>{fmt(totalPassif)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Balance check */}
      <div className={`mt-6 p-4 rounded-xl border-2 text-center ${
        Math.abs(totalActif - totalPassif) < 0.01
          ? 'bg-green-50 border-green-300'
          : 'bg-yellow-50 border-yellow-300'
      }`}>
        {Math.abs(totalActif - totalPassif) < 0.01 ? (
          <p className="text-green-700 font-semibold">Bilan équilibré — Actif = Passif = {fmt(totalActif)}</p>
        ) : (
          <p className="text-yellow-700 font-semibold">
            Déséquilibre détecté : Actif {fmt(totalActif)} / Passif {fmt(totalPassif)} (écart: {fmt(Math.abs(totalActif - totalPassif))})
          </p>
        )}
      </div>
    </div>
  )
}
