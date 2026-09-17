export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { JOURNAL_LABELS, type Ecriture } from '@/types/index'
import JournalTable from './JournalTable'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'
import Link from 'next/link'

const PAGE_SIZE = 20

interface SearchParams {
  annee?: string
  journal?: string
  from?: string
  to?: string
  page?: string
  q?: string
  compte?: string
}

export default async function JournalPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const { from: yearFrom, to: yearTo } = yearRange(year)
  const exercices = await getExercices()
  const journalFilter = params.journal ?? ''
  const q = (params.q ?? '').trim()
  // Filtre compte : 6 chiffres attendus, sinon ignoré (la valeur part dans la requête)
  const compteFilter = /^[1-8]\d{5}$/.test(params.compte ?? '') ? (params.compte as string) : ''
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
  if (q) query = query.ilike('libelle', `%${q}%`)
  if (compteFilter) query = query.or(`compte_debit.eq.${compteFilter},compte_credit.eq.${compteFilter}`)
  query = query.gte('date', fromDate).lte('date', toDate)

  const { data, count, error } = await query
  const rows = (data ?? []) as unknown as Ecriture[]
  const totalPages = Math.ceil((count ?? 0) / PAGE_SIZE)

  // Document counts for visible rows
  const rowIds = rows.map(e => e.id)
  const { data: docData } = rowIds.length > 0
    ? await supabase.from('documents').select('ecriture_id').in('ecriture_id', rowIds)
    : { data: [] }
  const docCounts: Record<string, number> = {}
  for (const d of (docData ?? [])) {
    docCounts[d.ecriture_id] = (docCounts[d.ecriture_id] ?? 0) + 1
  }

  const buildUrl = (overrides: Record<string, string>) => {
    const p = new URLSearchParams()
    p.set('annee', String(year))
    if (journalFilter) p.set('journal', journalFilter)
    if (fromDate) p.set('from', fromDate)
    if (toDate) p.set('to', toDate)
    if (q) p.set('q', q)
    if (compteFilter) p.set('compte', compteFilter)
    p.set('page', String(page))
    Object.entries(overrides).forEach(([k, v]) => v ? p.set(k, v) : p.delete(k))
    return `/journal?${p.toString()}`
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
        <h1 className="text-2xl font-bold text-gray-800">Journal comptable</h1>
        <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
          <YearSelector current={year} years={exercices} />
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
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Libellé contient</label>
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="ex: Cheque n"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Compte</label>
            <input
              type="text"
              name="compte"
              defaultValue={compteFilter}
              placeholder="ex: 606000"
              inputMode="numeric"
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono w-32 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
          </div>
          <input type="hidden" name="annee" value={year} />
          <button
            type="submit"
            className="px-4 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Filtrer
          </button>
          {(journalFilter || fromDate || toDate || q || compteFilter) && (
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
          <div className="p-4">
            <JournalTable rows={rows} docCounts={docCounts} year={year} compteFiltre={compteFilter} />
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
