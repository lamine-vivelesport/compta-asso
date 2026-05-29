export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { JOURNAL_LABELS } from '@/types/index'
import { PCG_ACCOUNTS } from '@/lib/pcg'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default async function DashboardPage() {
  const { data: ecritures, error } = await supabase
    .from('ecritures')
    .select('*')
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

  return (
    <div>
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Tableau de bord</h1>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur de connexion à la base de données. Vérifiez vos variables d&apos;environnement.
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-8">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Évolution mensuelle (6 derniers mois)</h2>
        </div>
        {months.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune donnée disponible</p>
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

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Dernières écritures</h2>
        </div>
        {recent.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune écriture saisie</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Pièce</th>
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
                    <td className="px-4 py-3 font-mono text-gray-600">{e.numero_piece as string}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium">
                        {JOURNAL_LABELS[e.journal_code as string] ?? e.journal_code as string}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-xs truncate">{e.libelle as string}</td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {e.compte_debit as string}
                      {PCG_ACCOUNTS[e.compte_debit as string] && (
                        <span className="text-gray-400"> - {PCG_ACCOUNTS[e.compte_debit as string].slice(0, 20)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600 font-mono text-xs">
                      {e.compte_credit as string}
                      {PCG_ACCOUNTS[e.compte_credit as string] && (
                        <span className="text-gray-400"> - {PCG_ACCOUNTS[e.compte_credit as string].slice(0, 20)}</span>
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
