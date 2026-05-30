'use client'

import { useState, useEffect, useCallback } from 'react'
import { useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPcgLabel } from '@/lib/pcg'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'
import DocumentsSection from '@/components/DocumentsSection'

interface Ecriture {
  id: string
  date: string
  libelle: string
  compte_debit: string
  compte_credit: string
  montant: number
  journal_code: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

export default function DocumentsClient() {
  const searchParams = useSearchParams()
  const year = parseYear(searchParams.get('annee') ?? undefined)
  const selectedId = searchParams.get('ecriture') ?? null

  const [tab, setTab] = useState<'manquantes' | 'toutes'>('manquantes')
  const [ecritures, setEcritures] = useState<Ecriture[]>([])
  const [withDocs, setWithDocs] = useState<Set<string>>(new Set())
  const [docCounts, setDocCounts] = useState<Record<string, number>>({})
  const [exercices, setExercices] = useState<number[]>([])
  const [loading, setLoading] = useState(true)
  const [openId, setOpenId] = useState<string | null>(selectedId)

  const load = useCallback(async () => {
    setLoading(true)
    const { from, to } = yearRange(year)

    const [{ data: rows }, { data: docs }, yrs] = await Promise.all([
      supabase.from('ecritures').select('*').gte('date', from).lte('date', to).order('date', { ascending: false }),
      supabase.from('documents').select('ecriture_id'),
      getExercices(),
    ])

    const set = new Set((docs ?? []).map((d: { ecriture_id: string }) => d.ecriture_id))
    const counts: Record<string, number> = {}
    for (const d of (docs ?? [])) {
      counts[d.ecriture_id] = (counts[d.ecriture_id] ?? 0) + 1
    }

    setEcritures((rows ?? []) as Ecriture[])
    setWithDocs(set)
    setDocCounts(counts)
    setExercices(yrs)
    setLoading(false)
  }, [year])

  useEffect(() => { load() }, [load])

  // Refresh counts when a document is uploaded/deleted
  const refreshCounts = useCallback(async () => {
    const { data } = await supabase.from('documents').select('ecriture_id')
    const set = new Set((data ?? []).map((d: { ecriture_id: string }) => d.ecriture_id))
    const counts: Record<string, number> = {}
    for (const d of (data ?? [])) {
      counts[d.ecriture_id] = (counts[d.ecriture_id] ?? 0) + 1
    }
    setWithDocs(set)
    setDocCounts(counts)
  }, [])

  const missing = ecritures.filter(e => !withDocs.has(e.id))
  const withDocsArr = ecritures.filter(e => withDocs.has(e.id))
  const displayList = tab === 'manquantes' ? missing : withDocsArr

  if (loading) return <div className="text-gray-400 text-sm p-8">Chargement…</div>

  return (
    <div className="max-w-5xl mx-auto">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Pièces justificatives</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            {missing.length > 0
              ? <span className="text-orange-600 font-medium">{missing.length} pièce(s) manquante(s)</span>
              : <span className="text-green-600 font-medium">✓ Toutes les pièces sont présentes</span>}
            {' '}sur {ecritures.length} écriture(s) — {year}
          </p>
        </div>
        <YearSelector current={year} years={exercices} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Colonne gauche : liste */}
        <div>
          {/* Tabs */}
          <div className="flex border-b border-gray-200 mb-4">
            <button
              onClick={() => setTab('manquantes')}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'manquantes' ? 'border-orange-500 text-orange-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              ⚠️ Manquantes
              {missing.length > 0 && (
                <span className="ml-2 bg-orange-100 text-orange-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                  {missing.length}
                </span>
              )}
            </button>
            <button
              onClick={() => setTab('toutes')}
              className={`flex-1 py-2.5 text-sm font-medium border-b-2 transition-colors ${tab === 'toutes' ? 'border-green-500 text-green-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}
            >
              📎 Avec pièce
              <span className="ml-2 bg-green-100 text-green-700 text-xs px-1.5 py-0.5 rounded-full font-semibold">
                {withDocsArr.length}
              </span>
            </button>
          </div>

          {displayList.length === 0 ? (
            <div className="text-center py-12 text-gray-400 text-sm bg-white rounded-xl border border-gray-200">
              {tab === 'manquantes'
                ? '✓ Toutes les pièces sont présentes !'
                : 'Aucune pièce déposée pour cet exercice.'}
            </div>
          ) : (
            <div className="space-y-2 max-h-[calc(100vh-280px)] overflow-y-auto pr-1">
              {displayList.map(e => (
                <button
                  key={e.id}
                  onClick={() => setOpenId(openId === e.id ? null : e.id)}
                  className={`w-full text-left p-3 rounded-xl border transition-all ${
                    openId === e.id
                      ? 'border-indigo-400 bg-indigo-50 shadow-sm'
                      : 'border-gray-200 bg-white hover:border-gray-300'
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-xs text-gray-500 whitespace-nowrap">{e.date}</span>
                        <span className="text-xs font-mono text-indigo-600 shrink-0">{e.compte_debit}</span>
                      </div>
                      <p className="text-sm text-gray-800 font-medium truncate">{e.libelle}</p>
                      <p className="text-xs text-gray-500 truncate">{getPcgLabel(e.compte_debit)}</p>
                    </div>
                    <div className="shrink-0 flex flex-col items-end gap-1">
                      <span className="text-sm font-semibold text-gray-800">{fmt(e.montant)}</span>
                      {withDocs.has(e.id) ? (
                        <span className="text-xs text-green-600 font-medium">
                          📎 {docCounts[e.id]}
                        </span>
                      ) : (
                        <span className="text-xs text-orange-500">⚠️ manque</span>
                      )}
                    </div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Colonne droite : upload */}
        <div>
          {openId ? (
            <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sticky top-6">
              <h2 className="font-semibold text-gray-700 mb-4 text-sm">Pièces justificatives</h2>
              <DocumentsSection
                key={openId}
                ecritureId={openId}
                libelleEcriture={ecritures.find(e => e.id === openId)?.libelle ?? ''}
                onCountChange={() => refreshCounts()}
              />
            </div>
          ) : (
            <div className="bg-gray-50 rounded-xl border border-dashed border-gray-300 p-8 text-center text-gray-400 text-sm sticky top-6">
              <div className="text-3xl mb-3">📂</div>
              <p className="font-medium text-gray-500">Sélectionnez une écriture</p>
              <p className="text-xs mt-1">pour attacher ou voir ses pièces justificatives</p>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
