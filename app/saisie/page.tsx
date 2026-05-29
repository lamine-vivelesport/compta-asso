'use client'

import { useState, useCallback } from 'react'
import { supabase } from '@/lib/supabase'
import { detectAccount, PCG_ACCOUNTS } from '@/lib/pcg'
import { JOURNAL_LABELS } from '@/types/index'

interface AccountSuggestion {
  numero: string
  libelle: string
}

function AccountInput({
  label,
  value,
  onChange,
}: {
  label: string
  value: string
  onChange: (val: string) => void
}) {
  const [suggestions, setSuggestions] = useState<AccountSuggestion[]>([])
  const [open, setOpen] = useState(false)

  const handleChange = (val: string) => {
    onChange(val)
    const results = detectAccount(val)
    setSuggestions(results)
    setOpen(results.length > 0)
  }

  const select = (s: AccountSuggestion) => {
    onChange(s.numero)
    setOpen(false)
  }

  return (
    <div className="relative">
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type="text"
        value={value}
        onChange={e => handleChange(e.target.value)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        onFocus={() => value && suggestions.length > 0 && setOpen(true)}
        placeholder="ex: 512 ou Banque"
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
      />
      {value && PCG_ACCOUNTS[value] && (
        <p className="text-xs text-indigo-600 mt-1">{PCG_ACCOUNTS[value]}</p>
      )}
      {open && suggestions.length > 0 && (
        <ul className="absolute z-20 w-full mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map(s => (
            <li
              key={s.numero}
              onMouseDown={() => select(s)}
              className="px-3 py-2 hover:bg-indigo-50 cursor-pointer text-sm flex gap-3 items-center"
            >
              <span className="font-mono text-indigo-700 font-semibold w-12 flex-shrink-0">{s.numero}</span>
              <span className="text-gray-700">{s.libelle}</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

export default function SaisiePage() {
  const today = new Date().toISOString().slice(0, 10)
  const [form, setForm] = useState({
    date: today,
    numero_piece: '',
    journal_code: 'BQ',
    libelle: '',
    compte_debit: '',
    compte_credit: '',
    montant: '',
  })
  const [libelleSuggestions, setLibelleSuggestions] = useState<AccountSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  const showToast = (type: 'success' | 'error', msg: string) => {
    setToast({ type, msg })
    setTimeout(() => setToast(null), 4000)
  }

  const handleLibelleChange = useCallback((val: string) => {
    setForm(f => ({ ...f, libelle: val }))
    setLibelleSuggestions(detectAccount(val))
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!form.date || !form.libelle || !form.compte_debit || !form.compte_credit || !form.montant) {
      showToast('error', 'Veuillez remplir tous les champs obligatoires.')
      return
    }
    const montant = parseFloat(form.montant)
    if (isNaN(montant) || montant <= 0) {
      showToast('error', 'Le montant doit être un nombre positif.')
      return
    }

    setLoading(true)
    const { error } = await supabase.from('ecritures').insert({
      date: form.date,
      numero_piece: form.numero_piece,
      journal_code: form.journal_code,
      libelle: form.libelle,
      compte_debit: form.compte_debit,
      compte_credit: form.compte_credit,
      montant,
    })
    setLoading(false)

    if (error) {
      showToast('error', `Erreur: ${error.message}`)
    } else {
      showToast('success', 'Écriture enregistrée avec succès.')
      setForm({
        date: today,
        numero_piece: '',
        journal_code: 'BQ',
        libelle: '',
        compte_debit: '',
        compte_credit: '',
        montant: '',
      })
    }
  }

  return (
    <div className="max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold text-gray-800 mb-6">Saisie d&apos;écriture</h1>

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'
        }`}>
          {toast.msg}
        </div>
      )}

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-gray-200 shadow-sm p-6 space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          {/* Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
            <input
              type="date"
              value={form.date}
              onChange={e => setForm(f => ({ ...f, date: e.target.value }))}
              required
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>

          {/* Numéro de pièce */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">N° de pièce</label>
            <input
              type="text"
              value={form.numero_piece}
              onChange={e => setForm(f => ({ ...f, numero_piece: e.target.value }))}
              placeholder="ex: FAC-2024-001"
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* Journal */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Journal *</label>
          <select
            value={form.journal_code}
            onChange={e => setForm(f => ({ ...f, journal_code: e.target.value }))}
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent bg-white"
          >
            {Object.entries(JOURNAL_LABELS).map(([code, label]) => (
              <option key={code} value={code}>{code} — {label}</option>
            ))}
          </select>
        </div>

        {/* Libellé */}
        <div className="relative">
          <label className="block text-sm font-medium text-gray-700 mb-1">Libellé *</label>
          <input
            type="text"
            value={form.libelle}
            onChange={e => handleLibelleChange(e.target.value)}
            placeholder="Description de l'opération"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
          {libelleSuggestions.length > 0 && form.libelle.length >= 2 && (
            <div className="mt-1 p-2 bg-blue-50 border border-blue-100 rounded-lg">
              <p className="text-xs text-blue-600 font-medium mb-1">Comptes suggérés :</p>
              <div className="flex flex-wrap gap-1">
                {libelleSuggestions.map(s => (
                  <span key={s.numero} className="px-2 py-0.5 bg-white border border-blue-200 text-xs rounded text-blue-700 font-mono">
                    {s.numero} {s.libelle}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Comptes */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <AccountInput
            label="Compte débit *"
            value={form.compte_debit}
            onChange={val => setForm(f => ({ ...f, compte_debit: val }))}
          />
          <AccountInput
            label="Compte crédit *"
            value={form.compte_credit}
            onChange={val => setForm(f => ({ ...f, compte_credit: val }))}
          />
        </div>

        {/* Montant */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€) *</label>
          <input
            type="number"
            value={form.montant}
            onChange={e => setForm(f => ({ ...f, montant: e.target.value }))}
            placeholder="0.00"
            min="0.01"
            step="0.01"
            required
            className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent"
          />
        </div>

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 px-4 rounded-lg transition-colors text-sm"
        >
          {loading ? 'Enregistrement...' : 'Enregistrer l\'écriture'}
        </button>
      </form>
    </div>
  )
}
