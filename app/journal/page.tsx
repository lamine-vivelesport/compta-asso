export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { JOURNAL_LABELS } from '@/types/index'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import { parseYear, yearRange } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'
import Link from 'next/link'

const PAGE_SIZE = 20

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

interface SearchParams {
  annee?: string
  journal?: string
  from?: string
  to?: string
  page?: string
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const { from: yearFrom, to: yearTo } = yearRange(year)
  const journalFilter = params.journal ?? ''
  const fromDate = params.from ?? yearFrom
  const toDate = params.to ?? yearTo
  const page = Math.max(1, parseInt(params.page ?? '1', 10))
  const offset = (page - 1) * PAGE_SIZE

  let query = supabase
    .from('ecritures')
    .select('*', { count: 'exact' })
    .order('date', { ascending: false })
    .order('created_at', { ascending: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (journalFilter) query = query.eq('journal_code', journalFilter)
  query = query.gte('date', fromDate).lte('date', toDate)

  const { data, count, error } = await query
  const rows = data ?? []
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams()
    p.set('annee', String(year))
    if (journalFilter) p.set('journal', journalFilter)
    if (fromDate) p.set('from', fromDate)
    if (toDate) p.set('to', toDate)
    p.set('page', String(page))
    Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `/journal?${p.toString()}`
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Journal comptable</h1>
        <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
          <YearSelector current={year} />
        </Suspense>
      </div>

      {/* Filters */}
      <form method="GET" action="/journal" className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 mb-6">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Journal</label>
            <select
              name="journal"
              defaultValue={journalFilter}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              <option value="">Tous</option>
              {Object.entries(JOURNAL_LABELS).map(([code, label]) => (
                <option key={code} value={code}>{code} — {label}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Du</label>
            <input
              type="date"
              name="from"
              defaultValue={fromDate}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Au</label>
            <input
              type="date"
              name="to"
              defaultValue={toDate}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Filtrer
          </button>
          {(journalFilter || fromDate || toDate) && (
            <Link
              href="/journal"
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-600 text-sm font-medium rounded-lg transition-colors"
            >
              Réinitialiser
            </Link>
          )}
        </div>
      </form>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm">
          Erreur lors du chargement des données.
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <p className="text-sm text-gray-500">
            {count ?? 0} écriture{(count ?? 0) > 1 ? 's' : ''} — page {page}/{Math.max(1, totalPages)}
          </p>
        </div>
        {rows.length === 0 ? (
          <p className="px-6 py-12 text-gray-400 text-sm text-center">Aucune écriture trouvée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">N° Pièce</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Journal</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Compte Débit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Compte Crédit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((e: Record<string, unknown>) => (
                  <tr key={e.id as string} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.date as string}</td>
                    <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.numero_piece as string}</td>
                    <td className="px-4 py-3">
                      <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium whitespace-nowrap">
                        {e.journal_code as string} — {JOURNAL_LABELS[e.journal_code as string]}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate">{e.libelle as string}</td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-mono font-semibold text-gray-700">{e.compte_debit as string}</span>
                      {PCG_ACCOUNTS[e.compte_debit as string] && (
                        <span className="text-gray-400 ml-1">{PCG_ACCOUNTS[e.compte_debit as string].slice(0, 25)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs">
                      <span className="font-mono font-semibold text-gray-700">{e.compte_credit as string}</span>
                      {PCG_ACCOUNTS[e.compte_credit as string] && (
                        <span className="text-gray-400 ml-1">{PCG_ACCOUNTS[e.compte_credit as string].slice(0, 25)}</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{fmt(Number(e.montant))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="px-6 py-4 border-t border-gray-100 flex items-center justify-between">
            <Link
              href={buildUrl({ page: String(page - 1) })}
              className={`px-3 py-1.5 text-sm rounded-lg border ${page <= 1 ? 'opacity-40 pointer-events-none border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Précédent
            </Link>
            <span className="text-sm text-gray-500">Page {page} / {totalPages}</span>
            <Link
              href={buildUrl({ page: String(page + 1) })}
              className={`px-3 py-1.5 text-sm rounded-lg border ${page >= totalPages ? 'opacity-40 pointer-events-none border-gray-200 text-gray-400' : 'border-gray-300 text-gray-700 hover:bg-gray-50'}`}
            >
              Suivant
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
