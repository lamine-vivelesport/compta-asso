'use client'

import { useState, useRef, useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'

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
  const m = d.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (m) return `${m[3]}-${m[2]}-${m[1]}`
  return d
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

export default function ImportPage() {
  const router = useRouter()
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)
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
  const [pasteText, setPasteText] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 5000)
  }

  const loadText = useCallback((text: string) => {
    const parsed = parseCsv(text)
    if (parsed.headers.length === 0) { showToast('error', 'Aucune donnée valide détectée.'); return }
    setHeaders(parsed.headers); setCsvRows(parsed.rows)
    setMapping(guessMapping(parsed.headers)); setResult(null)
  }, [])

  const handleFile = useCallback((file: File) => {
    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      showToast('error', 'Veuillez sélectionner un fichier CSV.')
      return
    }
    const reader = new FileReader()
    reader.onload = e => loadText(e.target?.result as string)
    reader.readAsText(file, 'UTF-8')
  }, [loadText])

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

  const handleImport = async () => {
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
        libelle: r.libelle,
        compte_debit: r.compte_debit,
        compte_credit: r.compte_credit,
        montant: parseFloat(r.montant.replace(',', '.')),
      })).filter(r => !isNaN(r.montant) && r.montant > 0)
      const { error } = await supabase.from('ecritures').insert(batch)
      if (error) {
        const detail = error.message || error.details || JSON.stringify(error)
        showToast('error', `Erreur Supabase [${error.code ?? '?'}]: ${detail}`)
        errors += batch.length
      } else {
        success += batch.length
      }
      setProgress(Math.round(((i + BATCH) / valid.length) * 100))
    }
    setImporting(false); setResult({ success, errors })
    if (errors === 0) {
      showToast('success', `${success} écriture(s) importée(s). Redirection…`)
      setTimeout(() => router.push('/journal'), 1500)
    }
  }

  const previewRows = getMappedRows().slice(0, 5)

  return (
    <div className="max-w-4xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-2">Import CSV</h1>
      <p className="text-sm text-gray-500 mb-6">
        Format attendu : <code className="bg-gray-100 px-1 rounded text-xs">date;piece;journal;libelle;compte_debit;compte_credit;montant</code>
        &nbsp;— séparateur <code className="bg-gray-100 px-1 rounded text-xs">;</code> ou <code className="bg-gray-100 px-1 rounded text-xs">,</code>,
        dates en DD/MM/YYYY ou YYYY-MM-DD, montant avec <code className="bg-gray-100 px-1 rounded text-xs">.</code>
      </p>

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          toast.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>{toast.msg}</div>
      )}

      <div
        onDragOver={e => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={e => { e.preventDefault(); setDragging(false); const f = e.dataTransfer.files[0]; if (f) handleFile(f) }}
        onClick={() => inputRef.current?.click()}
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
          ref={inputRef} type="file" accept=".csv,text/csv" className="hidden"
          onChange={e => e.target.files?.[0] && handleFile(e.target.files[0])}
        />
      </div>

      {/* Zone de collage direct */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 mb-6">
        <h2 className="font-semibold text-gray-700 mb-3">Ou collez vos lignes directement</h2>
        <textarea
          value={pasteText}
          onChange={e => setPasteText(e.target.value)}
          placeholder={'date;piece;journal;libelle;compte_debit;compte_credit;montant\n03/02/2025;REF001;BQ;Libellé opération;641000;512000;948.01\n...'}
          rows={6}
          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-xs font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-y"
          spellCheck={false}
        />
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => { if (pasteText.trim()) loadText(pasteText) }}
            disabled={!pasteText.trim()}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
          >
            Charger
          </button>
          <button
            onClick={() => { setPasteText(''); setHeaders([]); setCsvRows([]); setResult(null) }}
            className="text-sm text-gray-500 hover:text-gray-700 border border-gray-300 px-4 py-2 rounded-lg"
          >
            Effacer
          </button>
        </div>
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
                      <td className="px-3 py-2 text-gray-700 max-w-[150px] truncate">{r.libelle}</td>
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
            onClick={handleImport}
            disabled={importing || csvRows.length === 0}
            className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-3 px-4 rounded-xl transition-colors"
          >
            {importing ? 'Import en cours…' : `Importer ${csvRows.length} écriture(s)`}
          </button>
        </>
      )}
    </div>
  )
}
