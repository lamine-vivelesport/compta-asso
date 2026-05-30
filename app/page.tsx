export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { JOURNAL_LABELS } from '@/types/index'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function DashboardPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const { from, to } = yearRange(year)
  const exercices = await getExercices()

  // Écritures de l'exercice sélectionné
  const { data: ecritures, error } = await supabase
    .from('ecritures')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: false })

  const rows = ecritures ?? []

  let totalProduits = 0
  let totalCharges = 0
  let tresorerieDebit = 0
  let tresorerieCredit = 0

  for (const e of rows) {
    const debit = e.compte_debit as string
    const credit = e.compte_credit as string
    const montant = Number(e.montant)
    if (credit.startsWith('7')) totalProduits += montant
    if (debit.startsWith('7')) totalProduits -= montant
    if (debit.startsWith('6')) totalCharges += montant
    if (credit.startsWith('6')) totalCharges -= montant
    if (debit.startsWith('5')) tresorerieDebit += montant
    if (credit.startsWith('5')) tresorerieCredit += montant
  }

  const resultat = totalProduits - totalCharges
  const soldeTresorerie = tresorerieDebit - tresorerieCredit

  const stats = [
    { label: 'Total Produits', value: fmt(totalProduits), color: 'text-green-700', bg: 'bg-green-50 border-green-200' },
    { label: 'Total Charges', value: fmt(totalCharges), color: 'text-red-700', bg: 'bg-red-50 border-red-200' },
    { label: 'Résultat Net', value: fmt(resultat), color: resultat >= 0 ? 'text-indigo-700' : 'text-red-700', bg: resultat >= 0 ? 'bg-indigo-50 border-indigo-200' : 'bg-red-50 border-red-200' },
    { label: 'Solde Trésorerie', value: fmt(soldeTresorerie), color: 'text-blue-700', bg: 'bg-blue-50 border-blue-200' },
  ]

  const monthly: Record<string, { produits: number; charges: number }> = {}
  for (const e of rows) {
    const month = (e.date as string).slice(0, 7)
    if (!monthly[month]) monthly[month] = { produits: 0, charges: 0 }
    if ((e.compte_credit as string).startsWith('7')) monthly[month].produits += Number(e.montant)
    if ((e.compte_debit as string).startsWith('6')) monthly[month].charges += Number(e.montant)
  }
  const months = Object.keys(monthly).sort().slice(-6)
  const recent = rows.slice(0, 10)

  // Comparatif multi-exercices (toutes les années)
  const { data: allData } = await supabase
    .from('ecritures')
    .select('date, compte_debit, compte_credit, montant')

  const allRows = allData ?? []
  const byYear: Record<number, { produits: number; charges: number; tresorerie: number }> = {}
  for (const yr of exercices) byYear[yr] = { produits: 0, charges: 0, tresorerie: 0 }

  for (const e of allRows) {
    const yr = parseInt((e.date as string).slice(0, 4), 10)
    if (!byYear[yr]) continue
    const d = e.compte_debit as string
    const c = e.compte_credit as string
    const m = Number(e.montant)
    if (c.startsWith('7')) byYear[yr].produits += m
    if (d.startsWith('7')) byYear[yr].produits -= m
    if (d.startsWith('6')) byYear[yr].charges += m
    if (c.startsWith('6')) byYear[yr].charges -= m
    if (d.startsWith('5')) byYear[yr].tresorerie += m
    if (c.startsWith('5')) byYear[yr].tresorerie -= m
  }

  return (
    <div>
      {/* En-tête avec sélecteur */}
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Tableau de bord</h1>
        <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
          <YearSelector current={year} years={exercices} />
        </Suspense>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur de connexion à la base de données.
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 mb-8">
        {stats.map(s => (
          <div key={s.label} className={`border rounded-xl p-5 ${s.bg}`}>
            <p className="text-sm text-gray-500 font-medium">{s.label}</p>
            <p className={`text-2xl font-bold mt-1 ${s.color}`}>{s.value}</p>
          </div>
        ))}
      </div>

      {/* Évolution mensuelle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Évolution mensuelle — {year}</h2>
        </div>
        {months.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune donnée pour {year}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-6 py-3 font-semibold text-gray-600">Mois</th>
                  <th className="px-6 py-3 font-semibold text-green-700">Produits</th>
                  <th className="px-6 py-3 font-semibold text-red-700">Charges</th>
                  <th className="px-6 py-3 font-semibold text-indigo-700">Résultat</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {months.map(m => {
                  const d = monthly[m]
                  const res = d.produits - d.charges
                  return (
                    <tr key={m} className="hover:bg-gray-50">
                      <td className="px-6 py-3 font-medium text-gray-700">{m}</td>
                      <td className="px-6 py-3 text-green-700">{fmt(d.produits)}</td>
                      <td className="px-6 py-3 text-red-700">{fmt(d.charges)}</td>
                      <td className={`px-6 py-3 font-semibold ${res >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{fmt(res)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Comparatif multi-exercices */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Comparatif multi-exercices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-6 py-3 font-semibold text-gray-600">Exercice</th>
                <th className="px-6 py-3 font-semibold text-green-700">Produits</th>
                <th className="px-6 py-3 font-semibold text-red-700">Charges</th>
                <th className="px-6 py-3 font-semibold text-indigo-700">Résultat</th>
                <th className="px-6 py-3 font-semibold text-blue-700">Tréso. nette</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exercices.map(yr => {
                const d = byYear[yr]
                const res = d.produits - d.charges
                const hasData = d.produits > 0 || d.charges > 0
                return (
                  <tr key={yr} className={`hover:bg-gray-50 ${yr === year ? 'bg-indigo-50 font-semibold' : ''}`}>
                    <td className="px-6 py-3 text-gray-700">{yr}{yr === year && <span className="ml-2 text-xs text-indigo-500">← sélectionné</span>}</td>
                    <td className="px-6 py-3 text-green-700">{hasData ? fmt(d.produits) : <span className="text-gray-300">—</span>}</td>
                    <td className="px-6 py-3 text-red-700">{hasData ? fmt(d.charges) : <span className="text-gray-300">—</span>}</td>
                    <td className={`px-6 py-3 ${res >= 0 ? 'text-indigo-700' : 'text-red-600'}`}>{hasData ? fmt(res) : <span className="text-gray-300">—</span>}</td>
                    <td className={`px-6 py-3 ${d.tresorerie >= 0 ? 'text-blue-700' : 'text-red-600'}`}>{hasData ? fmt(d.tresorerie) : <span className="text-gray-300">—</span>}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Dernières écritures */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Dernières écritures — {year}</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune écriture pour {year}</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Journal</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Débit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Crédit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {recent.map((e: Record<string, unknown>) => (
                  <tr key={e.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600">{e.date as string}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {JOURNAL_LABELS[e.journal_code as string] ?? e.journal_code as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{e.libelle as string}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {e.compte_debit as string}
                      {PCG_ACCOUNTS[e.compte_debit as string] && (
                        <span className="text-gray-400"> - {PCG_ACCOUNTS[e.compte_debit as string].slice(0, 18)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {e.compte_credit as string}
                      {PCG_ACCOUNTS[e.compte_credit as string] && (
                        <span className="text-gray-400"> - {PCG_ACCOUNTS[e.compte_credit as string].slice(0, 18)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800">{fmt(Number(e.montant))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
