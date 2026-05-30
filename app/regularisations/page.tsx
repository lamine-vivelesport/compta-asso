'use client'

import { useState, useEffect, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import { EXERCICES } from '@/lib/exercice'

// ─── Types ────────────────────────────────────────────────────────────────────

type RegType = 'charge_a_payer' | 'produit_a_recevoir' | 'cca' | 'pca'

interface RegConfig {
  label: string
  desc: string
  icon: string
  compteTransitoireDefault: string
  compteTransitoireOptions: { value: string; label: string }[]
  compteRegLabel: string
  compteRegPrefix: string
  e1Debit: (compteReg: string, transitoire: string) => string
  e1Credit: (compteReg: string, transitoire: string) => string
  e2Debit: (compteReg: string, transitoire: string) => string
  e2Credit: (compteReg: string, transitoire: string) => string
  searchDebit?: string  // pour la recherche de correspondances bancaires
  searchCredit?: string
  autoDate2: (year: number) => string  // date auto de la 2ème écriture
  hasBankLink: boolean
}

const CONFIGS: Record<RegType, RegConfig> = {
  charge_a_payer: {
    label: 'Charge à payer',
    desc: 'Charge engagée en N, réglée en N+1 (salaires, prestataires)',
    icon: '📤',
    compteTransitoireDefault: '428000',
    compteTransitoireOptions: [
      { value: '428000', label: '428000 — Personnel, charges à payer' },
      { value: '408000', label: '408000 — Fournisseurs, factures non parvenues' },
    ],
    compteRegLabel: 'Compte de charge (6xx)',
    compteRegPrefix: '6',
    e1Debit: (r) => r,
    e1Credit: (_, t) => t,
    e2Debit: (_, t) => t,
    e2Credit: () => '512000',
    searchCredit: '512000',
    autoDate2: (y) => `${y + 1}-01-31`,
    hasBankLink: true,
  },
  produit_a_recevoir: {
    label: 'Produit à recevoir',
    desc: 'Produit acquis en N, encaissé en N+1 (subventions, cotisations)',
    icon: '📥',
    compteTransitoireDefault: '411000',
    compteTransitoireOptions: [
      { value: '411000', label: '411000 — Clients, produits à recevoir' },
      { value: '441000', label: '441000 — État, subventions à recevoir' },
    ],
    compteRegLabel: 'Compte de produit (7xx)',
    compteRegPrefix: '7',
    e1Debit: (_, t) => t,
    e1Credit: (r) => r,
    e2Debit: () => '512000',
    e2Credit: (_, t) => t,
    searchDebit: '512000',
    autoDate2: (y) => `${y + 1}-01-31`,
    hasBankLink: true,
  },
  cca: {
    label: "Charge constatée d'avance",
    desc: "Charge payée en N couvrant une période de N+1 (loyer, assurance, abonnement)",
    icon: '⏩',
    compteTransitoireDefault: '486000',
    compteTransitoireOptions: [{ value: '486000', label: "486000 — Charges constatées d'avance" }],
    compteRegLabel: 'Compte de charge (6xx)',
    compteRegPrefix: '6',
    e1Debit: () => '486000',
    e1Credit: (r) => r,
    e2Debit: (r) => r,
    e2Credit: () => '486000',
    autoDate2: (y) => `${y + 1}-01-01`,
    hasBankLink: false,
  },
  pca: {
    label: "Produit constaté d'avance",
    desc: "Produit encaissé en N couvrant une période de N+1",
    icon: '⏪',
    compteTransitoireDefault: '487000',
    compteTransitoireOptions: [{ value: '487000', label: "487000 — Produits constatés d'avance" }],
    compteRegLabel: 'Compte de produit (7xx)',
    compteRegPrefix: '7',
    e1Debit: (r) => r,
    e1Credit: () => '487000',
    e2Debit: () => '487000',
    e2Credit: (r) => r,
    autoDate2: (y) => `${y + 1}-01-01`,
    hasBankLink: false,
  },
}

interface Ecriture {
  id: string
  date: string
  libelle: string
  montant: number
  compte_debit: string
  compte_credit: string
  journal_code: string
}

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

// ─── Composant principal ──────────────────────────────────────────────────────

export default function RegularisationsPage() {
  const router = useRouter()
  const [showForm, setShowForm] = useState(false)
  const [history, setHistory] = useState<Ecriture[]>([])
  const [toast, setToast] = useState<{ type: 'success' | 'error'; msg: string } | null>(null)

  // Formulaire
  const [step, setStep] = useState<1 | 2 | 3>(1)
  const [type, setType] = useState<RegType | null>(null)
  const [year, setYear] = useState(2024)
  const [compteReg, setCompteReg] = useState('')
  const [compteTransitoire, setCompteTransitoire] = useState('')
  const [montant, setMontant] = useState('')
  const [libelle, setLibelle] = useState('')
  const [dateE2, setDateE2] = useState('')
  const [proposals, setProposals] = useState<Ecriture[]>([])
  const [selectedProposal, setSelectedProposal] = useState<string | null>(null)
  const [manualMode, setManualMode] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const urlParams = useSearchParams()

  const showToast = (t: 'success' | 'error', msg: string) => {
    setToast({ type: t, msg })
    setTimeout(() => setToast(null), 5000)
  }

  // Pré-remplissage depuis le journal (param ?from=<id>)
  useEffect(() => {
    const fromId = urlParams.get('from')
    if (!fromId) return

    const montantParam  = urlParams.get('montant') ?? ''
    const libelleParam  = urlParams.get('libelle') ?? ''
    const debitParam    = urlParams.get('debit') ?? ''
    const creditParam   = urlParams.get('credit') ?? ''
    const dateParam     = urlParams.get('date') ?? ''

    // Détection automatique du type
    let detectedType: RegType | null = null
    let detectedCompteReg = ''
    if (creditParam === '512000' && debitParam.startsWith('6')) {
      detectedType = 'charge_a_payer'
      detectedCompteReg = debitParam
    } else if (debitParam === '512000' && creditParam.startsWith('7')) {
      detectedType = 'produit_a_recevoir'
      detectedCompteReg = creditParam
    }

    // Exercice N = année du paiement - 1 (heuristique : payé en N+1 pour N)
    const paymentYear = parseInt(dateParam.slice(0, 4), 10)
    const inferredYear = !isNaN(paymentYear) && paymentYear > 2020
      ? paymentYear - 1
      : 2024

    // Construire la proposition depuis l'écriture source
    const sourceEntry: Ecriture = {
      id: fromId,
      date: dateParam,
      libelle: libelleParam,
      montant: parseFloat(montantParam),
      compte_debit: debitParam,
      compte_credit: creditParam,
      journal_code: 'BQ',
    }

    setType(detectedType)
    setYear(EXERCICES.includes(inferredYear) ? inferredYear : 2024)
    setCompteReg(detectedCompteReg)
    setCompteTransitoire(detectedType ? CONFIGS[detectedType].compteTransitoireDefault : '')
    setMontant(montantParam)
    setLibelle(libelleParam)
    setDateE2(dateParam)
    setProposals([sourceEntry])
    setSelectedProposal(fromId)
    setManualMode(false)
    setShowForm(true)
    // Si type détecté → aller directement à l'étape 2
    setStep(detectedType ? 2 : 1)
  }, [urlParams])

  const loadHistory = useCallback(async () => {
    const transitoires = ['408000', '428000', '411000', '441000', '486000', '487000']
    const { data } = await supabase
      .from('ecritures')
      .select('*')
      .or(transitoires.map(c => `compte_debit.eq.${c},compte_credit.eq.${c}`).join(','))
      .order('date', { ascending: false })
      .limit(50)
    setHistory(data ?? [])
  }, [])

  useEffect(() => { loadHistory() }, [loadHistory])

  const cfg = type ? CONFIGS[type] : null

  const resetForm = () => {
    setStep(1); setType(null); setYear(2024); setCompteReg(''); setCompteTransitoire('')
    setMontant(''); setLibelle(''); setDateE2(''); setProposals([])
    setSelectedProposal(null); setManualMode(false)
  }

  // Recherche de correspondances bancaires
  const searchProposals = useCallback(async () => {
    if (!cfg || !montant || !cfg.hasBankLink) return
    const m = parseFloat(montant)
    if (isNaN(m)) return
    const from = `${year + 1}-01-01`
    const to = `${year + 1}-06-30`
    let query = supabase.from('ecritures').select('*').gte('date', from).lte('date', to)
    if (cfg.searchDebit) query = query.eq('compte_debit', cfg.searchDebit)
    if (cfg.searchCredit) query = query.eq('compte_credit', cfg.searchCredit)
    const { data } = await query
    const results = (data ?? []).filter((e: Ecriture) => {
      const em = Number(e.montant)
      return Math.abs(em - m) / m < 0.15  // ±15%
    }).slice(0, 6)
    setProposals(results)
    if (results.length === 0) setManualMode(true)
  }, [cfg, montant, year])

  const goToStep2 = async () => {
    if (!cfg || !compteReg || !montant || !libelle) return
    setCompteTransitoire(cfg.compteTransitoireDefault)
    setDateE2(cfg.autoDate2(year))
    if (cfg.hasBankLink) await searchProposals()
    setStep(2)
  }

  const goToStep3 = () => {
    if (!manualMode && !selectedProposal && cfg?.hasBankLink) return
    setStep(3)
  }

  const handleSubmit = async () => {
    if (!cfg || !type) return
    setSubmitting(true)
    try {
      const dateE1 = `${year}-12-31`
      const m = parseFloat(montant)

      const ecriture1 = {
        date: dateE1,
        journal_code: 'OD',
        libelle: `[RÉG] ${libelle}`,
        compte_debit: cfg.e1Debit(compteReg, compteTransitoire),
        compte_credit: cfg.e1Credit(compteReg, compteTransitoire),
        montant: m,
        numero_piece: `REG-${year}-${Date.now().toString().slice(-6)}`,
      }

      if (selectedProposal && !manualMode) {
        // Modifier l'écriture existante + créer l'écriture 1
        const newDebit = cfg.e2Debit(compteReg, compteTransitoire)
        const newCredit = cfg.e2Credit(compteReg, compteTransitoire)
        const { error: e1 } = await supabase.from('ecritures').insert(ecriture1)
        if (e1) throw e1
        const { error: e2 } = await supabase.from('ecritures').update({
          compte_debit: newDebit,
          compte_credit: newCredit,
          libelle: `[RÉG] ${proposals.find(p => p.id === selectedProposal)?.libelle ?? ''}`,
        }).eq('id', selectedProposal)
        if (e2) throw e2
      } else {
        // Créer les 2 écritures
        const ecriture2 = {
          date: dateE2,
          journal_code: cfg.hasBankLink ? 'BQ' : 'OD',
          libelle: `[RÉG] ${libelle}`,
          compte_debit: cfg.e2Debit(compteReg, compteTransitoire),
          compte_credit: cfg.e2Credit(compteReg, compteTransitoire),
          montant: m,
          numero_piece: `REG-${year}-${Date.now().toString().slice(-6)}`,
        }
        const { error } = await supabase.from('ecritures').insert([ecriture1, ecriture2])
        if (error) throw error
      }

      showToast('success', 'Régularisation créée avec succès.')
      resetForm(); setShowForm(false)
      await loadHistory()
    } catch (e) {
      showToast('error', `Erreur : ${e instanceof Error ? e.message : JSON.stringify(e)}`)
    } finally {
      setSubmitting(false)
    }
  }

  // ─── Preview des 2 écritures ─────────────────────────────────────────────

  const preview = cfg && compteReg && compteTransitoire && montant ? {
    e1: {
      date: `31/12/${year}`,
      debit: cfg.e1Debit(compteReg, compteTransitoire),
      credit: cfg.e1Credit(compteReg, compteTransitoire),
    },
    e2: {
      date: dateE2,
      debit: cfg.e2Debit(compteReg, compteTransitoire),
      credit: cfg.e2Credit(compteReg, compteTransitoire),
      modify: !!selectedProposal && !manualMode,
    },
  } : null

  // ─── Rendu ───────────────────────────────────────────────────────────────

  return (
    <div className="max-w-4xl mx-auto">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Régularisations</h1>
          <p className="text-sm text-gray-500">Rattachement des charges et produits au bon exercice</p>
        </div>
        <button
          onClick={() => { resetForm(); setShowForm(v => !v) }}
          className="bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
        >
          {showForm ? 'Annuler' : '+ Nouvelle régularisation'}
        </button>
      </div>

      {toast && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${toast.type === 'success' ? 'bg-green-50 border border-green-200 text-green-700' : 'bg-red-50 border border-red-200 text-red-700'}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Formulaire ── */}
      {showForm && (
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm mb-6">
          {/* Indicateur d'étapes */}
          <div className="flex border-b border-gray-100">
            {(['1. Type & détails', '2. Règlement', '3. Confirmation'] as const).map((label, i) => (
              <div key={i} className={`flex-1 py-3 text-center text-xs font-medium ${step === i + 1 ? 'text-indigo-600 border-b-2 border-indigo-600' : 'text-gray-400'}`}>
                {label}
              </div>
            ))}
          </div>

          <div className="p-6">

            {/* ÉTAPE 1 — Type + détails */}
            {step === 1 && (
              <div className="space-y-5">
                {/* Choix du type */}
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-3">Type de régularisation</label>
                  <div className="grid grid-cols-2 gap-3">
                    {(Object.entries(CONFIGS) as [RegType, RegConfig][]).map(([k, c]) => (
                      <button key={k} onClick={() => setType(k)}
                        className={`p-3 rounded-lg border-2 text-left transition-colors ${type === k ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                        <div className="text-lg mb-1">{c.icon}</div>
                        <div className="text-sm font-semibold text-gray-800">{c.label}</div>
                        <div className="text-xs text-gray-500 mt-0.5">{c.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {type && (
                  <>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Exercice concerné (N)</label>
                        <select value={year} onChange={e => setYear(parseInt(e.target.value))}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {EXERCICES.filter(y => y < 2025).map(y => <option key={y} value={y}>{y}</option>)}
                        </select>
                        <p className="text-xs text-gray-400 mt-1">Écriture créée au 31/12/{year}</p>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Compte transitoire</label>
                        <select value={compteTransitoire || cfg!.compteTransitoireDefault}
                          onChange={e => setCompteTransitoire(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500">
                          {cfg!.compteTransitoireOptions.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">{cfg!.compteRegLabel} *</label>
                      <input value={compteReg} onChange={e => setCompteReg(e.target.value)}
                        list="pcg-list" placeholder={cfg!.compteRegPrefix === '6' ? '641000, 604000, 626000…' : '741000, 756000…'}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      {compteReg && PCG_ACCOUNTS[compteReg] && (
                        <p className="text-xs text-indigo-600 mt-0.5">{PCG_ACCOUNTS[compteReg]}</p>
                      )}
                      <datalist id="pcg-list">
                        {Object.entries(PCG_ACCOUNTS)
                          .filter(([c]) => c.startsWith(cfg!.compteRegPrefix))
                          .map(([c, l]) => <option key={c} value={c}>{c} — {l}</option>)}
                      </datalist>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Montant (€) *</label>
                        <input type="number" step="0.01" min="0" value={montant} onChange={e => setMontant(e.target.value)}
                          placeholder="948.01"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Libellé *</label>
                        <input value={libelle} onChange={e => setLibelle(e.target.value)}
                          placeholder="Salaire décembre 2024 — Dupont"
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                      </div>
                    </div>

                    <button onClick={goToStep2}
                      disabled={!compteReg || !montant || !libelle}
                      className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                      Continuer →
                    </button>
                  </>
                )}
              </div>
            )}

            {/* ÉTAPE 2 — Règlement */}
            {step === 2 && cfg && (
              <div className="space-y-5">
                <div>
                  <h3 className="text-sm font-semibold text-gray-700 mb-1">
                    {cfg.hasBankLink ? `2ème écriture — règlement en ${year + 1}` : `2ème écriture — extourne au 01/01/${year + 1}`}
                  </h3>
                  <p className="text-xs text-gray-500">
                    {cfg.hasBankLink
                      ? `L'app a cherché les écritures bancaires de ${year + 1} correspondant à ${montant} €.`
                      : `Pour les charges/produits constatés d'avance, l'extourne se fait automatiquement au 01/01/${year + 1}.`}
                  </p>
                </div>

                {cfg.hasBankLink && (
                  <>
                    {proposals.length > 0 && !manualMode && (
                      <div>
                        <label className="block text-xs font-semibold text-gray-700 mb-2">
                          {urlParams.get('from')
                            ? '📌 Écriture sélectionnée depuis le journal :'
                            : `Propositions trouvées (${proposals.length}) — sélectionnez la correspondance :`}
                        </label>
                        <div className="space-y-2">
                          {proposals.map(p => (
                            <label key={p.id}
                              className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${selectedProposal === p.id ? 'border-indigo-500 bg-indigo-50' : 'border-gray-200 hover:border-gray-300'}`}>
                              <input type="radio" name="proposal" value={p.id}
                                checked={selectedProposal === p.id}
                                onChange={() => setSelectedProposal(p.id)}
                                className="text-indigo-600" />
                              <div className="flex-1 min-w-0">
                                <div className="text-sm text-gray-800 truncate">{p.libelle}</div>
                                <div className="text-xs text-gray-500">{p.date} — {p.compte_debit} → {p.compte_credit}</div>
                              </div>
                              <span className="text-sm font-semibold text-gray-700 shrink-0">{fmt(Number(p.montant))}</span>
                            </label>
                          ))}
                          <button onClick={() => { setManualMode(true); setSelectedProposal(null) }}
                            className="w-full py-2 text-xs text-gray-500 hover:text-gray-700 border border-dashed border-gray-300 rounded-lg">
                            Aucune ne correspond — saisir manuellement
                          </button>
                        </div>
                      </div>
                    )}

                    {(manualMode || proposals.length === 0) && (
                      <div>
                        {proposals.length === 0 && (
                          <p className="text-xs text-orange-600 bg-orange-50 border border-orange-200 rounded p-2 mb-3">
                            Aucune écriture bancaire correspondante trouvée dans {year + 1}. Saisissez la date manuellement.
                          </p>
                        )}
                        <label className="block text-xs font-medium text-gray-600 mb-1">Date du règlement / encaissement</label>
                        <input type="date" value={dateE2} onChange={e => setDateE2(e.target.value)}
                          className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                        {proposals.length > 0 && (
                          <button onClick={() => setManualMode(false)} className="text-xs text-indigo-600 mt-2 hover:underline">
                            ← Voir les propositions
                          </button>
                        )}
                      </div>
                    )}
                  </>
                )}

                {!cfg.hasBankLink && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 text-xs text-blue-700">
                    L&apos;extourne sera créée automatiquement au <strong>01/01/{year + 1}</strong>.
                    Les deux écritures s&apos;annulent sur l&apos;exercice {year + 1}.
                  </div>
                )}

                <div className="flex gap-3">
                  <button onClick={() => setStep(1)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Retour
                  </button>
                  <button onClick={goToStep3}
                    disabled={cfg.hasBankLink && !manualMode && !selectedProposal}
                    className="flex-1 bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                    Continuer →
                  </button>
                </div>
              </div>
            )}

            {/* ÉTAPE 3 — Confirmation */}
            {step === 3 && cfg && preview && (
              <div className="space-y-5">
                <h3 className="text-sm font-semibold text-gray-700">Récapitulatif — vérifiez avant de créer</h3>

                <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <div className="bg-gray-50 px-3 py-2 font-semibold text-gray-600 border-b">Écriture 1 — Exercice {year}</div>
                  <div className="grid grid-cols-4 gap-2 px-3 py-3">
                    <div><span className="text-gray-400 block">Date</span><span className="font-medium">{preview.e1.date}</span></div>
                    <div><span className="text-gray-400 block">Journal</span><span className="font-medium">OD</span></div>
                    <div><span className="text-gray-400 block">Débit</span><span className="font-mono text-indigo-700">{preview.e1.debit}</span><span className="block text-gray-500 truncate">{PCG_ACCOUNTS[preview.e1.debit] ?? ''}</span></div>
                    <div><span className="text-gray-400 block">Crédit</span><span className="font-mono text-indigo-700">{preview.e1.credit}</span><span className="block text-gray-500 truncate">{PCG_ACCOUNTS[preview.e1.credit] ?? ''}</span></div>
                  </div>
                  <div className="bg-gray-50 px-3 py-2 flex justify-between">
                    <span className="text-gray-600">{libelle}</span>
                    <span className="font-bold text-gray-800">{fmt(parseFloat(montant))}</span>
                  </div>
                </div>

                <div className="rounded-lg border border-gray-200 overflow-hidden text-xs">
                  <div className={`px-3 py-2 font-semibold border-b ${preview.e2.modify ? 'bg-orange-50 text-orange-700' : 'bg-gray-50 text-gray-600'}`}>
                    {preview.e2.modify
                      ? `Écriture existante modifiée — ${selectedProposal ? proposals.find(p => p.id === selectedProposal)?.date : dateE2}`
                      : `Écriture 2 — ${year + 1}`}
                    {preview.e2.modify && <span className="ml-2 text-xs font-normal">(les comptes seront mis à jour)</span>}
                  </div>
                  <div className="grid grid-cols-4 gap-2 px-3 py-3">
                    <div><span className="text-gray-400 block">Date</span><span className="font-medium">{preview.e2.modify ? proposals.find(p => p.id === selectedProposal)?.date : dateE2}</span></div>
                    <div><span className="text-gray-400 block">Journal</span><span className="font-medium">{cfg.hasBankLink ? 'BQ' : 'OD'}</span></div>
                    <div><span className="text-gray-400 block">Débit</span><span className="font-mono text-indigo-700">{preview.e2.debit}</span><span className="block text-gray-500 truncate">{PCG_ACCOUNTS[preview.e2.debit] ?? ''}</span></div>
                    <div><span className="text-gray-400 block">Crédit</span><span className="font-mono text-indigo-700">{preview.e2.credit}</span><span className="block text-gray-500 truncate">{PCG_ACCOUNTS[preview.e2.credit] ?? ''}</span></div>
                  </div>
                  <div className="bg-gray-50 px-3 py-2 flex justify-between">
                    <span className="text-gray-600">{libelle}</span>
                    <span className="font-bold text-gray-800">{fmt(parseFloat(montant))}</span>
                  </div>
                </div>

                <div className="flex gap-3">
                  <button onClick={() => setStep(2)} className="flex-1 py-2.5 text-sm text-gray-600 border border-gray-300 rounded-lg hover:bg-gray-50">
                    ← Retour
                  </button>
                  <button onClick={handleSubmit} disabled={submitting}
                    className="flex-1 bg-green-600 hover:bg-green-700 disabled:bg-green-300 text-white font-semibold py-2.5 rounded-lg transition-colors text-sm">
                    {submitting ? 'Création…' : '✓ Créer les écritures'}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Historique ── */}
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-700">Écritures de régularisation existantes</h2>
          <p className="text-xs text-gray-400 mt-0.5">Comptes 408, 411, 428, 441, 486, 487</p>
        </div>
        {history.length === 0 ? (
          <p className="px-6 py-8 text-gray-400 text-sm text-center">Aucune régularisation enregistrée</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="bg-gray-50 text-left">
                  <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Débit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600">Crédit</th>
                  <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {history.map(e => (
                  <tr key={e.id} className="hover:bg-gray-50">
                    <td className="px-4 py-2.5 text-gray-600 whitespace-nowrap">{e.date}</td>
                    <td className="px-4 py-2.5 text-gray-800 max-w-xs truncate">{e.libelle}</td>
                    <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">
                      {e.compte_debit}
                      {PCG_ACCOUNTS[e.compte_debit] && <span className="text-gray-400"> — {PCG_ACCOUNTS[e.compte_debit].slice(0, 22)}</span>}
                    </td>
                    <td className="px-4 py-2.5 font-mono text-xs text-indigo-700">
                      {e.compte_credit}
                      {PCG_ACCOUNTS[e.compte_credit] && <span className="text-gray-400"> — {PCG_ACCOUNTS[e.compte_credit].slice(0, 22)}</span>}
                    </td>
                    <td className="px-4 py-2.5 text-right font-semibold text-gray-800">{fmt(Number(e.montant))}</td>
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
