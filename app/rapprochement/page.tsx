export const dynamic = 'force-dynamic'

import { fetchEcritures, fromCents, toCents, type MouvementLigne } from '@/lib/ecritures'
import { calculerSoldes, soldeCompte, totauxResultat } from '@/lib/soldes'
import { getPcgLabel } from '@/lib/pcg'
import soldesReference from '@/lib/soldes-bancaires.json'

/** Seuil de subventions publiques imposant CAC et publication des comptes (art. L. 612-4 C. com.). */
const SEUIL_SUBVENTIONS = 153_000_00

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n === 0 ? 0 : n)
}

function fmtDate(iso: string) {
  return new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR')
}

interface PointControle {
  compte: string
  date: string
  attendu: number
  calcule: number
}

export default async function RapprochementPage() {
  const { data: rows, error } = await fetchEcritures<MouvementLigne>('date, compte_debit, compte_credit, montant')

  // ─── Soldes bancaires aux dates de référence ─────────────────────────────
  const reference = soldesReference as unknown as Record<string, Record<string, number>>
  const points: PointControle[] = []
  for (const compte of ['512000', '512100']) {
    for (const [date, attendu] of Object.entries(reference[compte])) {
      let calcule = 0
      for (const e of rows) {
        if (e.date > date) continue
        if (e.compte_debit === compte) calcule += toCents(e.montant)
        if (e.compte_credit === compte) calcule -= toCents(e.montant)
      }
      points.push({ compte, date, attendu: Math.round(attendu * 100), calcule })
    }
  }
  const ecarts = points.filter(p => p.calcule !== p.attendu)

  // ─── Synthèse par exercice ───────────────────────────────────────────────
  const annees = [...new Set(rows.map(e => Number(e.date.slice(0, 4))))].sort((a, b) => a - b)
  const anneeCourante = new Date().getFullYear()
  const exercices = annees.map(annee => {
    const ecrituresAnnee = rows.filter(e => e.date.startsWith(String(annee)))
    const soldes = calculerSoldes(ecrituresAnnee)
    const dernierReleve = points
      .filter(p => p.compte === '512000' && p.date.startsWith(String(annee)))
      .map(p => p.date)
      .sort()
      .pop()
    return {
      annee,
      nb: ecrituresAnnee.length,
      ...totauxResultat(soldes),
      subventions: -soldeCompte(soldes, '741'),
      dernierReleve,
      enCours: annee >= anneeCourante,
    }
  })
  const alertesSubventions = exercices.filter(x => x.subventions > SEUIL_SUBVENTIONS)

  return (
    <div className="max-w-5xl mx-auto">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Rapprochement bancaire</h1>
        <p className="text-sm text-gray-500">
          Soldes calculés à partir des écritures, comparés aux relevés de la Caisse d&apos;Épargne
        </p>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur lors du chargement des données : {error}
        </div>
      )}

      {/* Verdict */}
      <div className={`mb-6 p-4 rounded-xl border-2 ${
        ecarts.length === 0 ? 'bg-green-50 border-green-300' : 'bg-red-50 border-red-300'
      }`}>
        <p className={`font-bold ${ecarts.length === 0 ? 'text-green-800' : 'text-red-800'}`}>
          {ecarts.length === 0
            ? `✓ Comptabilité rapprochée au centime sur ${points.length} points de contrôle`
            : `⚠ ${ecarts.length} écart(s) sur ${points.length} points de contrôle — import incomplet ou doublon probable`}
        </p>
        <p className="text-sm text-gray-600 mt-1">{rows.length} écritures en base</p>
      </div>

      {/* Alerte seuil subventions */}
      {alertesSubventions.length > 0 && (
        <div className="mb-6 p-4 rounded-xl border-2 border-orange-300 bg-orange-50">
          <p className="font-bold text-orange-800 mb-1">
            ⚠ Subventions publiques supérieures à 153 000 € sur {alertesSubventions.length} exercice(s)
          </p>
          <p className="text-sm text-orange-900 mb-2">
            Au-delà de ce seuil, l&apos;article L. 612-4 du code de commerce impose d&apos;établir des comptes annuels,
            de nommer un commissaire aux comptes et de publier les comptes. Point à soumettre à un expert-comptable.
          </p>
          <ul className="text-sm text-orange-900 flex flex-wrap gap-x-6 gap-y-1">
            {alertesSubventions.map(x => (
              <li key={x.annee}><span className="font-semibold">{x.annee}</span> : {fmt(fromCents(x.subventions))}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Points de contrôle */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden mb-6">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Soldes bancaires</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 font-semibold text-gray-600">Compte</th>
                <th className="px-4 py-2 font-semibold text-gray-600">Date</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Solde relevé</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Solde comptable</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Écart</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {points.map(p => {
                const ok = p.calcule === p.attendu
                return (
                  <tr key={`${p.compte}-${p.date}`} className={ok ? '' : 'bg-red-50'}>
                    <td className="px-4 py-2">
                      <span className="font-mono text-indigo-700 text-xs font-semibold mr-2">{p.compte}</span>
                      <span className="text-gray-500 text-xs">{getPcgLabel(p.compte)}</span>
                    </td>
                    <td className="px-4 py-2 text-gray-700 tabular-nums">{fmtDate(p.date)}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(fromCents(p.attendu))}</td>
                    <td className="px-4 py-2 text-right tabular-nums">{fmt(fromCents(p.calcule))}</td>
                    <td className={`px-4 py-2 text-right tabular-nums font-semibold ${ok ? 'text-green-700' : 'text-red-700'}`}>
                      {ok ? '✓' : fmt(fromCents(p.calcule - p.attendu))}
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Exercices */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Exercices</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead>
              <tr className="bg-gray-50 text-left">
                <th className="px-4 py-2 font-semibold text-gray-600">Exercice</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Écritures</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Produits</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Charges</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Résultat</th>
                <th className="px-4 py-2 font-semibold text-gray-600 text-right">Subventions (741)</th>
                <th className="px-4 py-2 font-semibold text-gray-600">Statut</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {exercices.map(x => (
                <tr key={x.annee}>
                  <td className="px-4 py-2 font-semibold text-gray-800">{x.annee}</td>
                  <td className="px-4 py-2 text-right tabular-nums text-gray-600">{x.nb}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(fromCents(x.produits))}</td>
                  <td className="px-4 py-2 text-right tabular-nums">{fmt(fromCents(x.charges))}</td>
                  <td className={`px-4 py-2 text-right tabular-nums font-semibold ${x.resultat >= 0 ? 'text-green-700' : 'text-red-700'}`}>
                    {fmt(fromCents(x.resultat))}
                  </td>
                  <td className={`px-4 py-2 text-right tabular-nums ${x.subventions > SEUIL_SUBVENTIONS ? 'text-orange-700 font-semibold' : ''}`}>
                    {fmt(fromCents(x.subventions))}
                  </td>
                  <td className="px-4 py-2 text-xs">
                    {x.enCours ? (
                      <span className="px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-800">
                        En cours{x.dernierReleve ? ` — relevés au ${fmtDate(x.dernierReleve)}` : ''}
                      </span>
                    ) : (
                      <span className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">Ouvert — à clôturer</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
