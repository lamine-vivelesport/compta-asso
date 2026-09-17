'use client'

import { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getPcgLabel } from '@/lib/pcg'
import { validerEcriture, JOURNAUX } from '@/lib/ecritures'
import { JOURNAL_LABELS, type Ecriture } from '@/types/index'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

type Form = Pick<Ecriture, 'date' | 'numero_piece' | 'journal_code' | 'libelle' | 'compte_debit' | 'compte_credit'> & { montant: string }

const toForm = (e: Ecriture): Form => ({
  date: e.date,
  numero_piece: e.numero_piece ?? '',
  journal_code: e.journal_code,
  libelle: e.libelle,
  compte_debit: e.compte_debit,
  compte_credit: e.compte_credit,
  montant: String(e.montant),
})

/** Vérifie qu'aucune autre écriture de la même année ne porte ce numéro de pièce. */
async function pieceDejaUtilisee(piece: string, date: string, saufId: string): Promise<boolean> {
  if (!piece.trim()) return false
  const annee = date.slice(0, 4)
  const { data } = await supabase
    .from('ecritures')
    .select('id')
    .eq('numero_piece', piece.trim())
    .neq('id', saufId)
    .gte('date', `${annee}-01-01`)
    .lte('date', `${annee}-12-31`)
    .limit(1)
  return Boolean(data?.length)
}

export default function JournalTable({
  rows,
  docCounts,
  year,
  compteFiltre,
}: {
  rows: Ecriture[]
  docCounts: Record<string, number>
  year: number
  compteFiltre: string
}) {
  const router = useRouter()
  const [edition, setEdition] = useState<{ id: string; form: Form } | null>(null)
  const [suppression, setSuppression] = useState<Ecriture | null>(null)
  const [selection, setSelection] = useState<Set<string>>(new Set())
  const [lot, setLot] = useState({ ancien: compteFiltre, nouveau: '' })
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; texte: string } | null>(null)

  const notifier = (type: 'success' | 'error', texte: string) => {
    setMessage({ type, texte })
    setTimeout(() => setMessage(null), 5000)
  }

  const basculer = (id: string) => {
    setSelection(s => {
      const next = new Set(s)
      if (next.has(id)) next.delete(id); else next.add(id)
      return next
    })
  }

  const enregistrer = async () => {
    if (!edition) return
    const { id, form } = edition
    const invalide = validerEcriture(form)
    if (invalide) return notifier('error', `Écriture refusée : ${invalide}.`)

    setBusy(true)
    if (await pieceDejaUtilisee(form.numero_piece, form.date, id)) {
      setBusy(false)
      return notifier('error', `La pièce « ${form.numero_piece.trim()} » existe déjà en ${form.date.slice(0, 4)}.`)
    }
    const { error } = await supabase.from('ecritures').update({
      ...form,
      numero_piece: form.numero_piece.trim(),
      montant: Number(form.montant.replace(',', '.')),
    }).eq('id', id)
    setBusy(false)
    if (error) return notifier('error', `Erreur : ${error.message}`)
    setEdition(null)
    notifier('success', 'Écriture modifiée.')
    router.refresh()
  }

  const supprimer = async () => {
    if (!suppression) return
    setBusy(true)
    const { error } = await supabase.from('ecritures').delete().eq('id', suppression.id)
    setBusy(false)
    if (error) return notifier('error', `Erreur : ${error.message}`)
    setSuppression(null)
    notifier('success', 'Écriture supprimée.')
    router.refresh()
  }

  const reclasserLot = async () => {
    const { ancien, nouveau } = lot
    if (!/^[1-8]\d{5}$/.test(ancien) || !/^[1-8]\d{5}$/.test(nouveau))
      return notifier('error', 'Les deux comptes doivent avoir 6 chiffres (ex. 604000).')
    if (ancien === nouveau) return notifier('error', 'Les deux comptes sont identiques.')

    const concernees = rows.filter(e => selection.has(e.id) && (e.compte_debit === ancien || e.compte_credit === ancien))
    const ignorees = selection.size - concernees.length
    if (concernees.length === 0) return notifier('error', `Aucune écriture sélectionnée n'utilise le compte ${ancien}.`)

    setBusy(true)
    let erreurs = 0
    for (const e of concernees) {
      const champ = e.compte_debit === ancien ? 'compte_debit' : 'compte_credit'
      const autre = champ === 'compte_debit' ? e.compte_credit : e.compte_debit
      if (autre === nouveau) { erreurs++; continue } // débit = crédit interdit
      const { error } = await supabase.from('ecritures').update({ [champ]: nouveau }).eq('id', e.id)
      if (error) erreurs++
    }
    setBusy(false)
    setSelection(new Set())
    notifier(erreurs ? 'error' : 'success',
      `${concernees.length - erreurs} écriture(s) reclassée(s) en ${nouveau}.` +
      (ignorees ? ` ${ignorees} ignorée(s) (compte ${ancien} absent).` : '') +
      (erreurs ? ` ${erreurs} en erreur.` : ''))
    router.refresh()
  }

  const champ = 'w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500'

  return (
    <>
      {message && (
        <div className={`mb-4 p-3 rounded-lg text-sm font-medium ${
          message.type === 'success'
            ? 'bg-green-50 border border-green-200 text-green-700'
            : 'bg-red-50 border border-red-200 text-red-700'
        }`}>{message.texte}</div>
      )}

      {/* Barre de reclassement par lot */}
      {selection.size > 0 && (
        <div className="mb-4 p-4 rounded-xl border-2 border-indigo-300 bg-indigo-50 flex flex-wrap items-end gap-3">
          <p className="font-semibold text-indigo-900 w-full sm:w-auto">
            {selection.size} écriture(s) sélectionnée(s)
          </p>
          <div>
            <label className="block text-xs font-medium text-indigo-900 mb-1">Remplacer le compte</label>
            <input value={lot.ancien} onChange={e => setLot(l => ({ ...l, ancien: e.target.value }))}
              placeholder="604000" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 font-mono" />
          </div>
          <div>
            <label className="block text-xs font-medium text-indigo-900 mb-1">par</label>
            <input value={lot.nouveau} onChange={e => setLot(l => ({ ...l, nouveau: e.target.value }))}
              placeholder="641000" className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-32 font-mono" />
          </div>
          <button onClick={reclasserLot} disabled={busy}
            className="bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white text-sm font-medium px-4 py-2 rounded-lg">
            {busy ? 'Reclassement…' : 'Reclasser'}
          </button>
          <button onClick={() => setSelection(new Set())}
            className="text-sm text-gray-600 border border-gray-300 px-4 py-2 rounded-lg hover:bg-white">
            Tout désélectionner
          </button>
          {/^[1-8]\d{5}$/.test(lot.nouveau) && (
            <span className="text-xs text-indigo-800">{getPcgLabel(lot.nouveau)}</span>
          )}
        </div>
      )}

      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr className="bg-gray-50 text-left">
              <th className="px-3 py-3 w-8">
                <input
                  type="checkbox"
                  aria-label="Tout sélectionner"
                  checked={rows.length > 0 && selection.size === rows.length}
                  onChange={e => setSelection(e.target.checked ? new Set(rows.map(r => r.id)) : new Set())}
                />
              </th>
              <th className="px-4 py-3 font-semibold text-gray-600">Date</th>
              <th className="px-4 py-3 font-semibold text-gray-600">N° Pièce</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Journal</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Libellé</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Compte Débit</th>
              <th className="px-4 py-3 font-semibold text-gray-600">Compte Crédit</th>
              <th className="px-4 py-3 font-semibold text-gray-600 text-right">Montant</th>
              <th className="px-3 py-3 w-10"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {rows.map(e => {
              const regParams = new URLSearchParams({
                from: e.id, montant: String(e.montant), libelle: e.libelle,
                debit: e.compte_debit, credit: e.compte_credit, date: e.date,
              })
              return (
                <tr key={e.id} className={`group ${selection.has(e.id) ? 'bg-indigo-50' : 'hover:bg-gray-50'}`}>
                  <td className="px-3 py-3">
                    <input type="checkbox" aria-label={`Sélectionner ${e.libelle}`}
                      checked={selection.has(e.id)} onChange={() => basculer(e.id)} />
                  </td>
                  <td className="px-4 py-3 text-gray-600 whitespace-nowrap">{e.date}</td>
                  <td className="px-4 py-3 font-mono text-xs text-gray-600">{e.numero_piece}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-indigo-100 text-indigo-700 rounded text-xs font-medium whitespace-nowrap">
                      {e.journal_code} — {JOURNAL_LABELS[e.journal_code]}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-800 max-w-[200px] truncate" title={e.libelle}>{e.libelle}</td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-mono font-semibold text-gray-700">{e.compte_debit}</span>
                    <span className="text-gray-400 ml-1">{getPcgLabel(e.compte_debit).slice(0, 25)}</span>
                  </td>
                  <td className="px-4 py-3 text-xs">
                    <span className="font-mono font-semibold text-gray-700">{e.compte_credit}</span>
                    <span className="text-gray-400 ml-1">{getPcgLabel(e.compte_credit).slice(0, 25)}</span>
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-gray-800 whitespace-nowrap">{fmt(Number(e.montant))}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-1.5 opacity-40 group-hover:opacity-100 transition-opacity">
                      <Link
                        href={`/documents?annee=${year}&ecriture=${e.id}`}
                        title={docCounts[e.id] ? `${docCounts[e.id]} pièce(s)` : 'Ajouter une pièce'}
                        className={`text-sm font-medium whitespace-nowrap ${docCounts[e.id] ? 'text-green-600 hover:text-green-800' : 'text-orange-400 hover:text-orange-600'}`}
                      >
                        {docCounts[e.id] ? `📎 ${docCounts[e.id]}` : '📎'}
                      </Link>
                      <Link href={`/regularisations?${regParams.toString()}`} title="Régulariser cette écriture"
                        className="text-indigo-400 hover:text-indigo-700 text-sm">🔄</Link>
                      <button onClick={() => setEdition({ id: e.id, form: toForm(e) })} title="Modifier"
                        className="text-gray-400 hover:text-indigo-700 text-sm">✏️</button>
                      <button onClick={() => setSuppression(e)} title="Supprimer"
                        className="text-gray-400 hover:text-red-600 text-sm">🗑️</button>
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {/* Modification */}
      {edition && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => !busy && setEdition(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl p-6" onClick={ev => ev.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-4">Modifier l&apos;écriture</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date</label>
                <input type="date" className={champ} value={edition.form.date}
                  onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, date: ev.target.value } }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">N° de pièce</label>
                <input className={champ} value={edition.form.numero_piece}
                  onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, numero_piece: ev.target.value } }))} />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Journal</label>
                <select className={champ} value={edition.form.journal_code}
                  onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, journal_code: ev.target.value as Ecriture['journal_code'] } }))}>
                  {JOURNAUX.map(code => <option key={code} value={code}>{code} — {JOURNAL_LABELS[code]}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Montant (€)</label>
                <input type="number" step="0.01" min="0.01" className={champ} value={edition.form.montant}
                  onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, montant: ev.target.value } }))} />
              </div>
              <div className="sm:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Libellé</label>
                <input className={champ} value={edition.form.libelle}
                  onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, libelle: ev.target.value } }))} />
              </div>
              {(['compte_debit', 'compte_credit'] as const).map(nom => (
                <div key={nom}>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    {nom === 'compte_debit' ? 'Compte débit' : 'Compte crédit'}
                  </label>
                  <input className={`${champ} font-mono`} value={edition.form[nom]} placeholder="512000"
                    onChange={ev => setEdition(x => x && ({ ...x, form: { ...x.form, [nom]: ev.target.value } }))} />
                  {/^\d{6}$/.test(edition.form[nom]) && (
                    <p className="text-xs text-indigo-600 mt-1">{getPcgLabel(edition.form[nom])}</p>
                  )}
                </div>
              ))}
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setEdition(null)} disabled={busy}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={enregistrer} disabled={busy}
                className="px-4 py-2 text-sm bg-indigo-600 hover:bg-indigo-700 disabled:bg-indigo-300 text-white font-medium rounded-lg">
                {busy ? 'Enregistrement…' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Suppression */}
      {suppression && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-gray-900/50 p-4" onClick={() => !busy && setSuppression(null)}>
          <div className="bg-white rounded-xl shadow-xl w-full max-w-lg p-6" onClick={ev => ev.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-800 mb-2">Supprimer cette écriture ?</h2>
            <p className="text-sm text-gray-600 mb-4">Cette suppression est définitive.</p>
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 text-sm space-y-1">
              <p><span className="text-gray-500">Date :</span> {suppression.date}</p>
              <p><span className="text-gray-500">Pièce :</span> <span className="font-mono">{suppression.numero_piece || '—'}</span></p>
              <p><span className="text-gray-500">Libellé :</span> {suppression.libelle}</p>
              <p>
                <span className="text-gray-500">Comptes :</span>{' '}
                <span className="font-mono">{suppression.compte_debit}</span> / <span className="font-mono">{suppression.compte_credit}</span>
              </p>
              <p><span className="text-gray-500">Montant :</span> {fmt(Number(suppression.montant))}</p>
            </div>
            <div className="flex justify-end gap-2 mt-6">
              <button onClick={() => setSuppression(null)} disabled={busy}
                className="px-4 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">Annuler</button>
              <button onClick={supprimer} disabled={busy}
                className="px-4 py-2 text-sm bg-red-600 hover:bg-red-700 disabled:bg-red-300 text-white font-medium rounded-lg">
                {busy ? 'Suppression…' : 'Supprimer'}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
