export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { getPcgLabel } from '@/lib/pcg'
import { ASSO } from '@/lib/config'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'
import ClassFilter from './ClassFilter'
import ExportButton from './ExportButton'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Movement {
  date: string
  journal_code: string
  libelle: string
  debit: number
  credit: number
  solde: number
}

interface AccountLedger {
  compte: string
  libelle: string
  classe: number
  movements: Movement[]
  totalDebit: number
  totalCredit: number
  soldeFinal: number
}

const CLASS_TITLES: Record<number, string> = {
  1: 'Classe 1 — Fonds propres et assimilés',
  2: 'Classe 2 — Immobilisations',
  3: 'Classe 3 — Stocks et en-cours',
  4: 'Classe 4 — Comptes de tiers',
  5: 'Classe 5 — Comptes financiers',
  6: 'Classe 6 — Comptes de charges',
  7: 'Classe 7 — Comptes de produits',
}

function fmt(n: number) {
  if (n === 0) return ''
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(n)
}

function fmtSolde(n: number) {
  return new Intl.NumberFormat('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(Math.abs(n))
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GrandLivrePage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string; classe?: string }>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const classeFilter = params.classe ? parseInt(params.classe, 10) : null
  const { from, to } = yearRange(year)
  const exercices = await getExercices()

  const { data, error } = await supabase
    .from('ecritures')
    .select('*')
    .gte('date', from)
    .lte('date', to)
    .order('date', { ascending: true })
    .order('created_at', { ascending: true })

  const rows = (data ?? []) as Record<string, unknown>[]

  // ── Construction du Grand Livre ──────────────────────────────────────────
  const raw: Record<string, { date: string; journal_code: string; libelle: string; debit: number; credit: number }[]> = {}

  for (const e of rows) {
    const debit = e.compte_debit as string
    const credit = e.compte_credit as string
    const montant = Number(e.montant)
    const base = { date: e.date as string, journal_code: e.journal_code as string, libelle: e.libelle as string }

    if (!raw[debit]) raw[debit] = []
    raw[debit].push({ ...base, debit: montant, credit: 0 })

    if (!raw[credit]) raw[credit] = []
    raw[credit].push({ ...base, debit: 0, credit: montant })
  }

  // Compter les lignes : une écriture génère 2 entrées (débit + crédit)
  // On trie par date puis created_at pour garder l'ordre chronologique
  const ledgers: AccountLedger[] = Object.entries(raw)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([compte, movements]) => {
      const sorted = movements.sort((a, b) => a.date.localeCompare(b.date))
      let solde = 0
      const withSolde: Movement[] = sorted.map(m => {
        solde += m.debit - m.credit
        return { ...m, solde }
      })
      const totalDebit = sorted.reduce((s, m) => s + m.debit, 0)
      const totalCredit = sorted.reduce((s, m) => s + m.credit, 0)
      return {
        compte,
        libelle: getPcgLabel(compte),
        classe: parseInt(compte[0], 10),
        movements: withSolde,
        totalDebit,
        totalCredit,
        soldeFinal: solde,
      }
    })

  const availableClasses = [...new Set(ledgers.map(l => l.classe))].sort()
  const filtered = classeFilter ? ledgers.filter(l => l.classe === classeFilter) : ledgers

  // Regrouper par classe pour l'affichage
  const byClasse: Record<number, AccountLedger[]> = {}
  for (const l of filtered) {
    if (!byClasse[l.classe]) byClasse[l.classe] = []
    byClasse[l.classe].push(l)
  }

  const dateGeneration = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  return (
    <div>
      {/* Barre d'actions */}
      <div className="flex flex-wrap items-start justify-between gap-4 mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Grand Livre</h1>
          <p className="text-sm text-gray-500">
            {rows.length} écriture(s) — {filtered.length} compte(s) affiché(s) — {year}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
            <YearSelector current={year} years={exercices} />
          </Suspense>
          <ExportButton />
        </div>
      </div>

      {/* Filtre par classe */}
      <div className="mb-6">
        <Suspense fallback={null}>
          <ClassFilter current={classeFilter} available={availableClasses} />
        </Suspense>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm print:hidden">
          Erreur lors du chargement des données.
        </div>
      )}

      {/* ── Document imprimable ── */}
      <div className="print-document">

        {/* En-tête impression */}
        <div className="hidden print:block border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-base font-bold uppercase">{ASSO.nom}</div>
              <div className="text-xs text-gray-600">{ASSO.adresse} — {ASSO.codePostal} {ASSO.ville}</div>
            </div>
            <div className="text-right text-xs text-gray-500">
              <div className="font-semibold">Association Loi 1901</div>
              <div>Document généré le {dateGeneration}</div>
            </div>
          </div>
          <div className="text-center mt-3">
            <div className="text-xl font-bold uppercase tracking-widest">GRAND LIVRE</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Exercice du 01/01/{year} au 31/12/{year}
              {classeFilter && ` — Classe ${classeFilter}`}
            </div>
          </div>
        </div>

        {/* Contenu par classe */}
        {Object.entries(byClasse).map(([classeStr, accounts]) => {
          const classe = parseInt(classeStr, 10)
          return (
            <div key={classe} className="mb-10 print:break-before-page">

              {/* Titre de classe */}
              <div className="flex items-center gap-3 mb-4 print:mb-3">
                <div className="bg-gray-800 text-white text-xs font-bold px-3 py-1.5 rounded print:bg-black">
                  {CLASS_TITLES[classe] ?? `Classe ${classe}`}
                </div>
                <div className="flex-1 h-px bg-gray-300" />
              </div>

              {/* Comptes de cette classe */}
              <div className="space-y-6 print:space-y-4">
                {accounts.map(ledger => (
                  <div key={ledger.compte} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden print:rounded-none print:border print:shadow-none print:break-inside-avoid">

                    {/* En-tête du compte */}
                    <div className="flex items-center justify-between px-4 py-2.5 bg-gray-50 border-b border-gray-200">
                      <div className="flex items-center gap-3">
                        <span className="font-mono font-bold text-indigo-700 text-sm">{ledger.compte}</span>
                        <span className="text-gray-700 font-medium text-sm">{ledger.libelle}</span>
                      </div>
                      <div className="text-xs text-gray-500">
                        {ledger.movements.length} mouvement(s)
                      </div>
                    </div>

                    {/* Tableau des mouvements */}
                    <div className="overflow-x-auto">
                      <table className="min-w-full text-xs">
                        <thead>
                          <tr className="bg-gray-50 text-left border-b border-gray-100">
                            <th className="px-3 py-2 font-semibold text-gray-500 w-24">Date</th>
                            <th className="px-3 py-2 font-semibold text-gray-500 w-10">Jnl</th>
                            <th className="px-3 py-2 font-semibold text-gray-500">Libellé</th>
                            <th className="px-3 py-2 font-semibold text-gray-500 text-right w-28">Débit</th>
                            <th className="px-3 py-2 font-semibold text-gray-500 text-right w-28">Crédit</th>
                            <th className="px-3 py-2 font-semibold text-gray-500 text-right w-32">Solde</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-50">
                          {ledger.movements.map((m, i) => (
                            <tr key={i} className="hover:bg-gray-50 print:hover:bg-transparent">
                              <td className="px-3 py-1.5 text-gray-500 whitespace-nowrap">{m.date}</td>
                              <td className="px-3 py-1.5">
                                <span className="bg-indigo-50 text-indigo-600 text-xs px-1 py-0.5 rounded font-medium print:bg-transparent print:text-gray-700">
                                  {m.journal_code}
                                </span>
                              </td>
                              <td className="px-3 py-1.5 text-gray-800 max-w-xs truncate">{m.libelle}</td>
                              <td className="px-3 py-1.5 text-right font-mono text-green-700 tabular-nums">
                                {fmt(m.debit)}
                              </td>
                              <td className="px-3 py-1.5 text-right font-mono text-red-600 tabular-nums">
                                {fmt(m.credit)}
                              </td>
                              <td className={`px-3 py-1.5 text-right font-mono tabular-nums font-medium ${
                                m.solde >= 0 ? 'text-gray-800' : 'text-red-700'
                              }`}>
                                {fmtSolde(m.solde)}
                                <span className="text-gray-400 ml-1 text-xs">{m.solde >= 0 ? 'D' : 'C'}</span>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                        {/* Ligne des totaux */}
                        <tfoot>
                          <tr className="bg-gray-100 border-t-2 border-gray-300 font-semibold">
                            <td colSpan={3} className="px-3 py-2 text-xs text-gray-600 uppercase tracking-wide">
                              Totaux du compte
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-green-700 tabular-nums">
                              {fmt(ledger.totalDebit)}
                            </td>
                            <td className="px-3 py-2 text-right font-mono text-red-600 tabular-nums">
                              {fmt(ledger.totalCredit)}
                            </td>
                            <td className={`px-3 py-2 text-right font-mono tabular-nums ${
                              ledger.soldeFinal >= 0 ? 'text-gray-900' : 'text-red-700'
                            }`}>
                              <span className="text-xs font-medium mr-1">
                                {ledger.soldeFinal >= 0 ? 'Solde D' : 'Solde C'}
                              </span>
                              {fmtSolde(ledger.soldeFinal)}
                            </td>
                          </tr>
                        </tfoot>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )
        })}

        {filtered.length === 0 && (
          <div className="text-center py-16 text-gray-400 bg-white rounded-xl border border-gray-200">
            <p className="text-sm">Aucune écriture pour {year}{classeFilter ? ` — Classe ${classeFilter}` : ''}.</p>
          </div>
        )}
      </div>
    </div>
  )
}
