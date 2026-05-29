'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import type { PdfTransaction } from '@/lib/parseBankPdf'

// ─── Types CSV ────────────────────────────────────────────────────────────────

interface CsvRow { [key: string]: string }

interface MappedRow {
  date: string; numero_piece: string; journal_code: string
  libelle: string; compte_debit: string; compte_credit: string; montant: string
}

const ECRITURE_FIELDS = ['date', 'numero_piece', 'journal_code', 'libelle', 'compte_debit', 'compte_credit', 'montant'] as const
type EcritureField = typeof ECRITURE_FIELDS[number]

const FIELD_LABELS: Record<EcritureField, string> = {
  date: 'Date', numero_piece: 'N° Pièce', journal_code: 'Journal',
  libelle: 'Libellé', compte_debit: 'Compte Débit', compte_credit: 'Compte Crédit', montant: 'Montant',
}

function normalizeDate(d: string): string {
  // DD/MM/YYYY → YYYY-MM-DD
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return d // already ISO or unknown format, leave as-is
}

function parseCsv(text: string): { headers: string[]; rows: CsvRow[] } {
  const lines = text.trim().split(/\r?\n/)
  if (lines.length < 2) return { headers: [], rows: [] }
  const sep = lines[0].includes(';') ? ';' : ','
  const headers = lines[0].split(sep).map(h => h.trim().replace(/^"|"$/g, ''))
  const rows = lines.slice(1).map(line => {
    const vals = line.split(sep).map(v => v.trim().replace(/^"|"$/g, ''))
    const obj: CsvRow = {}
    headers.forEach((h, i) => { obj[h] = vals[i] ?? '' })
    return obj
  })
  return { headers, rows }
}

function guessMapping(headers: string[]): Record<EcritureField, string> {
  const mapping: Record<EcritureField, string> = {
    date: '', numero_piece: '', journal_code: '', libelle: '',
    compte_debit: '', compte_credit: '', montant: '',
  }
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, '')
  const candidates: Record<EcritureField, string[]> = {
    date: ['date', 'datepiece', 'dateop'],
    numero_piece: ['numeropiece', 'piece', 'numero', 'ref'],
    journal_code: ['journal', 'journalcode', 'code'],
    libelle: ['libelle', 'label', 'description', 'intitule'],
    compte_debit: ['comptedebit', 'debit', 'comptedeb'],
    compte_credit: ['comptecredit', 'credit', 'comptecre'],
    montant: ['montant', 'amount', 'valeur', 'somme'],
  }
  for (const field of ECRITURE_FIELDS) {
    for (const h of headers) {
      if (candidates[field].includes(norm(h))) { mapping[field] = h; break }
    }
  }
  return mapping
}

// ─── Types PDF ────────────────────────────────────────────────────────────────

interface PdfRow extends PdfTransaction { selected: boolean }

// ─── Composant principal ──────────────────────────────────────────────────────

export default function ImportPage() {
  const router = useRouter()
  const [activeTab, setActiveTab] = useState<'pdf' | 'csv'>('pdf')
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // PDF state
  const [pdfRows, setPdfRows] = useState<PdfRow[]>([])
  const [pdfLoading, setPdfLoading] = useState(false)
  const [pdfDragging, setPdfDragging] = useState(false)
  const pdfInputRef = useRef<HTMLInputElement>(null)

  // CSV state
  const [dragging, setDragging] = useState(false)
  const [headers, setHeaders] = useState<string[]>([])
  const [csvRows, setCsvRows] = useState<CsvRow[]>([])
  const [mapping, setMapping] = useState<Record<EcritureField, string>>({
    date: '', numero_piece: '', journal_code: '', libelle: '',
    compte_debit: '', compte_credit: '', montant: '',
  })
  const [importing, setImporting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [result, setResult] = useState<{ success: number; errors: number } | null>(null)
  const csvInputRef = useRef<HTMLInputElement>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // ── Handlers PDF ────────────────────────────────────────────────────────────

  const handlePdfFile = useCallback(async (file: File) => {
    if (!file.name.toLowerCase().endsWith('.pdf')) {
      showToast('error', 'Veuillez sélectionner un fichier PDF.')
      return
    }
    setPdfLoading(true)
    setPdfRows([])
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/parse-pdf', { method: 'POST', body: fd })
      const data = await res.json()
      if (data.error) throw new Error(data.error)
      const rows = (data.transactions as PdfTransaction[]).map(t => ({ ...t, selected: true }))
      if (rows.length === 0) showToast('error', 'Aucune opération détectée dans ce PDF.')
      else setPdfRows(rows)
    } catch (e) {
      showToast('error', e instanceof Error ? e.message : 'Erreur de lecture du PDF')
    } finally {
      setPdfLoading(false)
    }
  }, [])

  const handlePdfDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault(); setPdfDragging(false)
    const file = e.dataTransfer.files[0]
    if (file) handlePdfFile(file)
  }, [handlePdfFile])

  const updatePdfRow = (i: number, field: keyof PdfRow, value: string | boolean) =>
    setPdfRows(rows => rows.map((r, idx) => idx === i ? { ...r, [field]: value } : r))

  const selectedCount = pdfRows.filter(r => r.selected).length

  const handlePdfImport = async () => {
    const toImport = pdfRows.filter(r => r.selected)
    if (toImport.length === 0) { showToast('error', 'Aucune écriture sélectionnée.'); return }
    setPdfLoading(true)
    const ecritures = toImport.map(r => ({
      date: r.date, numero_piece: '', journal_code: 'BQ',
      libelle: r.libelle, compte_debit: r.compte_debit,
      compte_credit: r.compte_credit, montant: r.montant,
    }))
    const { error, data } = await supabase.from('ecritures').insert(ecritures).select()
    setPdfLoading(false)
    if (error) {
      console.error('Supabase insert error:', error)
      showToast('error', `Erreur Supabase: ${error.message} (code: ${error.code})`)
    } else {
      const count = data?.length ?? ecritures.length
      showToast('success', `${count} écriture(s) importée(s). Redirection vers le journal…`)
      setPdfRows([])
      setTimeout(() => router.push('/journal'), 1500)
    }
  }

  // ── Handlers CSV ────────────────────────────────────────────────────────────

  const handleCsvFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      showToast('error', 'Veuillez sélectionner un fichier CSV.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => {
      const text = e.target?.result as string
      const parsed = parseCsv(text)
      setHeaders(parsed.headers); setCsvRows(parsed.rows)
      setMapping(guessMapping(parsed.headers)); setResult(null)
    }
    reader.readAsText(file, 'UTF-8')
  }, [])

  const getMappedRows = (): MappedRow[] =>
    csvRows.map(row => ({
      date: mapping.date ? row[mapping.date] : '',
      numero_piece: mapping.numero_piece ? row[mapping.numero_piece] : '',
      journal_code: mapping.journal_code ? row[mapping.journal_code] : '',
      libelle: mapping.libelle ? row[mapping.libelle] : '',
      compte_debit: mapping.compte_debit ? row[mapping.compte_debit] : '',
      compte_credit: mapping.compte_credit ? row[mapping.compte_credit] : '',
      montant: mapping.montant ? row[mapping.montant] : '',
    }))

  const handleCsvImport = async () => {
    const mapped = getMappedRows()
    const valid = mapped.filter(r => r.date && r.libelle && r.compte_debit && r.compte_credit && r.montant)
    if (valid.length === 0) { showToast('error', 'Aucune ligne valide. Vérifiez le mapping.'); return }
    setImporting(true); setProgress(0)
    let success = 0; let errors = 0
    const BATCH = 50
    for (let i = 0; i < valid.length; i += BATCH) {
      const batch = valid.slice(i, i + BATCH).map(r => ({
        date: normalizeDate(r.date),
        numero_piece: r.numero_piece || '',
        journal_code: ['AC', 'VE', 'BQ', 'CA', 'OD'].includes(r.journal_code) ? r.journal_code : 'OD',
        libelle: r.libelle, compte_debit: r.compte_debit, compte_credit: r.compte_credit,
        montant: parseFloat(r.montant.replace(',', '.')),
      })).filter(r => !isNaN(r.montant) && r.montant > 0)
      const { error } = await supabase.from('ecritures').insert(batch)
      if (error) {
        console.error('Supabase CSV error:', error)
        showToast('error', `Erreur: ${error.message} (code: ${error.code})`)
        errors += batch.length
      } else {
        success += batch.length
      }
      setProgress(Math.round(((i + BATCH) / valid.length) * 100))
    }
    setImporting(false); setResult({ success, errors })
    if (errors === 0) {
      showToast('success', `${success} écriture(s) importée(s). Redirection vers le journal…`)
      setTimeout(() => router.push('/journal'), 1500)
    } else {
      showToast('error', `${success} importée(s), ${errors} erreur(s).`)
    }
  }

  const previewRows = getMappedRows().slice(0, 5)

  // ── Rendu ───────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Import</h1>

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>{toast.msg}</div>
      )}

      {/* Tabs */}
      <div className="flex border-b border-gray-200 mb-6">
        {([['pdf', '📄 Relevé bancaire (PDF)'], ['csv', '📊 CSV générique']] as const).map(([tab, label]) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`px-5 py-3 text-sm font-medium border-b-2 transition-colors ${
              activeTab === tab
                ? 'border-indigo-600 text-indigo-600'
                : 'border-transparent text-gray-500 hover:text-gray-700'
            }`}
          >{label}</button>
        ))}
      </div>

      {/* ── Onglet PDF ── */}
      {activeTab === 'pdf' && (
        <div>
          <p className="text-sm text-gray-500 mb-4">
            Glissez le relevé PDF de votre banque. Les opérations sont détectées automatiquement
            avec les comptes PCG pré-remplis — vous pouvez les corriger avant d&apos;importer.
          </p>

          {/* Drop zone PDF */}
          <div
            onDragOver={e => { e.preventDefault(); setPdfDragging(true) }}
            onDragLeave={() => setPdfDragging(false)}
            onDrop={handlePdfDrop}
            onClick={() => pdfInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6 ${
              pdfDragging
                ? 'border-indigo-400 bg-indigo-50'
                : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            {pdfLoading ? (
              <div className="flex flex-col items-center gap-3">
                <div className="w-8 h-8 border-2 border-indigo-600 border-t-transparent rounded-full animate-spin" />
                <p className="text-gray-500 text-sm">Analyse du PDF en cours…</p>
              </div>
            ) : (
              <>
                <div className="text-4xl mb-3">📄</div>
                <p className="text-gray-700 font-medium">Glissez-déposez votre relevé PDF ici</p>
                <p className="text-gray-400 text-sm mt-1">ou cliquez pour sélectionner</p>
                {pdfRows.length > 0 && (
                  <p className="mt-3 text-indigo-600 text-sm font-medium">{pdfRows.length} opération(s) détectée(s)</p>
                )}
              </>
            )}
            <input
              ref={pdfInputRef}
              type="file"
              accept=".pdf,application/pdf"
              className="hidden"
              onChange={e => e.target.files?.[0] && handlePdfFile(e.target.files[0])}
            />
          </div>

          {/* Datalist PCG pour autocomplete */}
          <datalist id="pcg-list">
            {Object.entries(PCG_ACCOUNTS).map(([code, label]) => (
              <option key={code} value={code}>{code} — {label}</option>
            ))}
          </datalist>

          {/* Tableau de prévisualisation PDF */}
          {pdfRows.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-4 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
                  <h2 className="font-semibold text-gray-700">
                    Opérations détectées
                    <span className="ml-2 text-sm font-normal text-gray-400">
                      ({selectedCount}/{pdfRows.length} sélectionnées)
                    </span>
                  </h2>
                  <button
                    onClick={() => setPdfRows(rows => rows.map(r => ({ ...r, selected: !rows.every(x => x.selected) })))}
                    className="text-xs text-indigo-600 hover:underline"
                  >
                    {pdfRows.every(r => r.selected) ? 'Tout désélectionner' : 'Tout sélectionner'}
                  </button>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        <th className="px-3 py-2 w-8"></th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Date</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Libellé</th>
                        <th className="px-3 py-2 font-semibold text-gray-600 text-right">Montant</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Compte Débit</th>
                        <th className="px-3 py-2 font-semibold text-gray-600">Compte Crédit</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {pdfRows.map((row, i) => (
                        <tr key={i} className={`${row.selected ? 'hover:bg-gray-50' : 'opacity-40 bg-gray-50'}`}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={row.selected}
                              onChange={e => updatePdfRow(i, 'selected', e.target.checked)}
                              className="rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2 text-gray-600 whitespace-nowrap">{row.date}</td>
                          <td className="px-3 py-2 text-gray-800 max-w-[200px] truncate" title={row.libelle}>{row.libelle}</td>
                          <td className={`px-3 py-2 text-right font-semibold whitespace-nowrap ${row.isDebit ? 'text-red-600' : 'text-green-600'}`}>
                            {row.isDebit ? '−' : '+'}{row.montant.toFixed(2).replace('.', ',')} €
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.compte_debit}
                              onChange={e => updatePdfRow(i, 'compte_debit', e.target.value)}
                              list="pcg-list"
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                          <td className="px-3 py-2">
                            <input
                              value={row.compte_credit}
                              onChange={e => updatePdfRow(i, 'compte_credit', e.target.value)}
                              list="pcg-list"
                              className="w-28 border border-gray-300 rounded px-2 py-1 text-xs font-mono focus:outline-none focus:ring-1 focus:ring-indigo-500"
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <button
                  onClick={handlePdfImport}
                  disabled={pdfLoading || selectedCount === 0}
                  className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
                >
                  {pdfLoading ? 'Import en cours…' : `Importer ${selectedCount} écriture(s) — Journal BQ`}
                </button>
                <button
                  onClick={() => setPdfRows([])}
                  className="px-4 py-3 text-sm text-gray-500 hover:text-gray-700 border border-gray-300 rounded-xl"
                >
                  Effacer
                </button>
              </div>
            </>
          )}
        </div>
      )}

      {/* ── Onglet CSV ── */}
      {activeTab === 'csv' && (
        <div>
          <div
            onDragOver={e => { e.preventDefault(); setDragging(true) }}
            onDragLeave={() => setDragging(false)}
            onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleCsvFile(f) }}
            onClick={() => csvInputRef.current?.click()}
            className={`border-2 border-dashed rounded-xl p-12 text-center cursor-pointer transition-colors mb-6 ${
              dragging ? 'border-indigo-400 bg-indigo-50' : 'border-gray-300 bg-gray-50 hover:border-indigo-300 hover:bg-indigo-50'
            }`}
          >
            <div className="text-4xl mb-3">📥</div>
            <p className="text-gray-700 font-medium">Glissez-déposez un fichier CSV ici</p>
            <p className="text-gray-400 text-sm mt-1">ou cliquez pour sélectionner</p>
            {csvRows.length > 0 && (
              <p className="mt-3 text-indigo-600 text-sm font-medium">{csvRows.length} ligne(s) chargée(s)</p>
            )}
            <input
              ref={csvInputRef}
              type="file"
              accept=".csv,text/csv"
              className="hidden"
              onChange={e => e.target.files?.[0] && handleCsvFile(e.target.files[0])}
            />
          </div>

          {headers.length > 0 && (
            <>
              <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 mb-6">
                <h2 className="font-semibold text-gray-700 mb-4">Correspondance des colonnes</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {ECRITURE_FIELDS.map(field => (
                    <div key={field}>
                      <label className="block text-sm font-medium text-gray-700 mb-1">
                        {FIELD_LABELS[field]}
                        {['date', 'libelle', 'compte_debit', 'compte_credit', 'montant'].includes(field) && (
                          <span className="text-red-500 ml-1">*</span>
                        )}
                      </label>
                      <select
                        value={mapping[field]}
                        onChange={e => setMapping(m => ({ ...m, [field]: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      >
                        <option value="">— Non mappé —</option>
                        {headers.map(h => <option key={h} value={h}>{h}</option>)}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-100">
                  <h2 className="font-semibold text-gray-700">Aperçu (5 premières lignes)</h2>
                </div>
                <div className="overflow-x-auto">
                  <table className="min-w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 text-left">
                        {ECRITURE_FIELDS.map(f => (
                          <th key={f} className="px-3 py-2 font-semibold text-gray-600">{FIELD_LABELS[f]}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                      {previewRows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50">
                          <td className="px-3 py-2 text-gray-700">{r.date}</td>
                          <td className="px-3 py-2 text-gray-700">{r.numero_piece}</td>
                          <td className="px-3 py-2 text-gray-700">{r.journal_code}</td>
                          <td className="px-3 py-2 text-gray-700 max-w-[120px] truncate">{r.libelle}</td>
                          <td className="px-3 py-2 font-mono text-indigo-700">{r.compte_debit}</td>
                          <td className="px-3 py-2 font-mono text-indigo-700">{r.compte_credit}</td>
                          <td className="px-3 py-2 text-right text-gray-800">{r.montant}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>

              {importing && (
                <div className="mb-4">
                  <div className="flex justify-between text-sm text-gray-600 mb-1">
                    <span>Import en cours…</span><span>{progress}%</span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div className="bg-indigo-600 h-2 rounded-full transition-all" style={{ width: `${progress}%` }} />
                  </div>
                </div>
              )}

              {result && (
                <div className={`mb-4 p-4 rounded-xl border ${result.errors === 0 ? 'bg-green-50 border-green-200' : 'bg-yellow-50 border-yellow-200'}`}>
                  <p className="font-semibold text-gray-800">Résultat :</p>
                  <p className="text-sm text-green-700">{result.success} écriture(s) importée(s)</p>
                  {result.errors > 0 && <p className="text-sm text-red-700">{result.errors} erreur(s)</p>}
                </div>
              )}

              <button
                onClick={handleCsvImport}
                disabled={importing || csvRows.length === 0}
                className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
              >
                {importing ? 'Import en cours…' : `Importer ${csvRows.length} écriture(s)`}
              </button>
            </>
          )}
        </div>
      )}
    </div>
  )
}
