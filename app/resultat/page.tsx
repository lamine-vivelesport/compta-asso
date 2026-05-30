export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function ResultatPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const { from, to } = yearRange(year)
  const exercices = await getExercices()

  const { data, error } = await supabase
    .from('ecritures')
    .select('compte_debit, compte_credit, montant')
    .gte('date', from)
    .lte('date', to)

  const rows = data ?? []

  // Aggregate by account
  const soldes: Record<string, number> = {}

  for (const e of rows) {
    const debit = e.compte_debit as string
    const credit = e.compte_credit as string
    const montant = Number(e.montant)

    soldes[debit] = (soldes[debit] ?? 0) + montant
    soldes[credit] = (soldes[credit] ?? 0) - montant
  }

  // Class 6 = charges: solde debit - credit (positive = charge)
  const chargesAccounts = Object.entries(soldes)
    .filter(([compte]) => compte.startsWith('6'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: solde }))
    .filter(a => Math.abs(a.montant) > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))

  // Class 7 = produits: solde credit - debit (negative solde = produit)
  const produitsAccounts = Object.entries(soldes)
    .filter(([compte]) => compte.startsWith('7'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: -solde }))
    .filter(a => Math.abs(a.montant) > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))

  const totalCharges = chargesAccounts.reduce((s, a) => s + a.montant, 0)
  const totalProduits = produitsAccounts.reduce((s, a) => s + a.montant, 0)
  const resultatNet = totalProduits - totalCharges

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Compte de résultat</h1>
          <p className="text-sm text-gray-500">Association Loi 1901 — Exercice {year}</p>
        </div>
        <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
          <YearSelector current={year} years={exercices} />
        </Suspense>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur lors du chargement des données.
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
        {/* PRODUITS */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-green-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">PRODUITS (Classe 7)</h2>
          </div>
          {produitsAccounts.length === 0 ? (
            <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucun produit enregistré</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-green-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600 w-20">Compte</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {produitsAccounts.map(a => (
                  <tr key={a.compte} className="hover:bg-green-50">
                    <td className="px-4 py-2.5 font-mono text-indigo-700 font-semibold text-xs">{a.compte}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.libelle}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-green-700">{fmt(a.montant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-green-100 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-green-800">TOTAL PRODUITS</td>
                  <td className="px-4 py-3 text-right text-green-800">{fmt(totalProduits)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>

        {/* CHARGES */}
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
          <div className="bg-red-600 px-6 py-4">
            <h2 className="text-white font-bold text-lg">CHARGES (Classe 6)</h2>
          </div>
          {chargesAccounts.length === 0 ? (
            <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune charge enregistrée</p>
          ) : (
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-red-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600 w-20">Compte</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {chargesAccounts.map(a => (
                  <tr key={a.compte} className="hover:bg-red-50">
                    <td className="px-4 py-2.5 font-mono text-indigo-700 font-semibold text-xs">{a.compte}</td>
                    <td className="px-4 py-2.5 text-gray-700">{a.libelle}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-red-700">{fmt(a.montant)}</td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="bg-red-100 font-bold">
                  <td colSpan={2} className="px-4 py-3 text-red-800">TOTAL CHARGES</td>
                  <td className="px-4 py-3 text-right text-red-800">{fmt(totalCharges)}</td>
                </tr>
              </tfoot>
            </table>
          )}
        </div>
      </div>

      {/* Résultat net */}
      <div className={`rounded-xl border-2 p-6 text-center ${
        resultatNet >= 0
          ? 'bg-indigo-50 border-indigo-300'
          : 'bg-red-50 border-red-300'
      }`}>
        <p className="text-sm font-medium text-gray-600 mb-1">RÉSULTAT NET DE L&apos;EXERCICE</p>
        <p className={`text-4xl font-bold ${resultatNet >= 0 ? 'text-indigo-700' : 'text-red-700'}`}>
          {fmt(resultatNet)}
        </p>
        <p className="text-sm text-gray-500 mt-1">
          {resultatNet >= 0 ? 'Excédent' : 'Déficit'} — Total Produits ({fmt(totalProduits)}) — Total Charges ({fmt(totalCharges)})
        </p>
      </div>
    </div>
  )
}
