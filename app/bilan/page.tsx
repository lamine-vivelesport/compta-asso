export const dynamic = 'force-dynamic'

import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS } from '@/lib/pcg'
import { ASSO } from '@/lib/config'
import ExportButton from './ExportButton'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

function fmtDate(iso: string) {
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

interface BilanLine {
  compte: string
  libelle: string
  montant: number
}

function BilanSection({ title, lines, subtotal, subtotalLabel }: {
  title: string
  lines: BilanLine[]
  subtotal: number
  subtotalLabel: string
}) {
  return (
    <div className="mb-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 border-b border-gray-200 pb-1 mb-2">{title}</h3>
      {lines.length === 0 ? (
        <p className="text-xs text-gray-400 italic px-2 py-1">Aucune écriture</p>
      ) : (
        <table className="w-full text-sm mb-1">
          <tbody>
            {lines.map(a => (
              <tr key={a.compte} className="border-b border-gray-50">
                <td className="py-1 pr-2 font-mono text-xs text-gray-500 w-20">{a.compte}</td>
                <td className="py-1 text-gray-700 flex-1">{a.libelle}</td>
                <td className="py-1 text-right font-medium text-gray-800 pl-4 whitespace-nowrap">{fmt(a.montant)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
      <div className="flex justify-between items-center bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold mt-1">
        <span className="text-gray-600">{subtotalLabel}</span>
        <span className="text-gray-900">{fmt(subtotal)}</span>
      </div>
    </div>
  )
}

export default async function BilanPage() {
  const { data, error } = await supabase
    .from('ecritures')
    .select('compte_debit, compte_credit, montant')

  const rows = data ?? []
  const dateGeneration = new Date().toLocaleDateString('fr-FR', {
    day: '2-digit', month: 'long', year: 'numeric'
  })

  const soldes: Record<string, number> = {}
  for (const e of rows) {
    const d = e.compte_debit as string
    const c = e.compte_credit as string
    const m = Number(e.montant)
    soldes[d] = (soldes[d] ?? 0) + m
    soldes[c] = (soldes[c] ?? 0) - m
  }

  const getLines = (prefix: string, sign: 'debit' | 'credit'): BilanLine[] =>
    Object.entries(soldes)
      .filter(([c]) => c.startsWith(prefix))
      .map(([compte, solde]) => ({
        compte,
        libelle: PCG_ACCOUNTS[compte] ?? compte,
        montant: sign === 'debit' ? solde : -solde,
      }))
      .filter(a => a.montant > 0.001)
      .sort((a, b) => a.compte.localeCompare(b.compte))

  const immobilisations = getLines('2', 'debit')
  const stocks = getLines('3', 'debit')
  const creances = Object.entries(soldes)
    .filter(([c]) => c.startsWith('4'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: solde }))
    .filter(a => a.montant > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))
  const tresorerie = getLines('5', 'debit')

  const totalActif =
    immobilisations.reduce((s, a) => s + a.montant, 0) +
    stocks.reduce((s, a) => s + a.montant, 0) +
    creances.reduce((s, a) => s + a.montant, 0) +
    tresorerie.reduce((s, a) => s + a.montant, 0)

  const fondsPropres = getLines('1', 'credit')
  const dettes = Object.entries(soldes)
    .filter(([c]) => c.startsWith('4'))
    .map(([compte, solde]) => ({ compte, libelle: PCG_ACCOUNTS[compte] ?? compte, montant: -solde }))
    .filter(a => a.montant > 0.001)
    .sort((a, b) => a.compte.localeCompare(b.compte))

  let totalProduits = 0
  let totalCharges = 0
  for (const [compte, solde] of Object.entries(soldes)) {
    if (compte.startsWith('7')) totalProduits += -solde
    if (compte.startsWith('6')) totalCharges += solde
  }
  const resultat = totalProduits - totalCharges

  const totalPassif =
    fondsPropres.reduce((s, a) => s + a.montant, 0) +
    dettes.reduce((s, a) => s + a.montant, 0) +
    resultat

  const equilibre = Math.abs(totalActif - totalPassif) < 0.01

  return (
    <div>
      {/* Barre d'actions — masquée à l'impression */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bilan</h1>
          <p className="text-sm text-gray-500">Exercice {ASSO.exerciceDebut} — {ASSO.exerciceFin}</p>
        </div>
        <ExportButton />
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm print:hidden">
          Erreur lors du chargement des données.
        </div>
      )}

      {/* Document imprimable */}
      <div className="print-document bg-white rounded-xl border border-gray-200 shadow-sm p-8">

        {/* En-tête légal */}
        <div className="border-b-2 border-gray-800 pb-4 mb-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-xl font-bold text-gray-900 uppercase tracking-wide">{ASSO.nom}</h2>
              <p className="text-sm text-gray-600 mt-1">{ASSO.adresse}</p>
              <p className="text-sm text-gray-600">{ASSO.codePostal} {ASSO.ville}</p>
              {ASSO.siret && <p className="text-xs text-gray-500 mt-1">SIRET : {ASSO.siret}</p>}
              {ASSO.rna && <p className="text-xs text-gray-500">RNA : {ASSO.rna}</p>}
            </div>
            <div className="text-right">
              <p className="text-xs text-gray-500 uppercase tracking-wide">Association Loi 1901</p>
              <p className="text-xs text-gray-500 mt-1">Document généré le {dateGeneration}</p>
            </div>
          </div>

          <div className="mt-4 text-center">
            <h1 className="text-2xl font-bold text-gray-900 uppercase tracking-widest">BILAN</h1>
            <p className="text-sm text-gray-600 mt-1">
              Exercice du {ASSO.exerciceDebut} au {ASSO.exerciceFin}
            </p>
            {rows.length > 0 && (
              <p className="text-xs text-gray-400 mt-0.5">
                Établi sur la base de {rows.length} écriture(s) comptable(s)
              </p>
            )}
          </div>
        </div>

        {/* Actif / Passif */}
        <div className="bilan-grid grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">

          {/* ACTIF */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-blue-700 px-4 py-3">
              <h2 className="text-white font-bold text-base uppercase tracking-wide">ACTIF</h2>
            </div>
            <div className="p-4">
              <BilanSection
                title="Immobilisations (Classe 2)"
                lines={immobilisations}
                subtotal={immobilisations.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Immobilisations"
              />
              <BilanSection
                title="Stocks (Classe 3)"
                lines={stocks}
                subtotal={stocks.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Stocks"
              />
              <BilanSection
                title="Créances (Classe 4 — solde débiteur)"
                lines={creances}
                subtotal={creances.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Créances"
              />
              <BilanSection
                title="Trésorerie (Classe 5)"
                lines={tresorerie}
                subtotal={tresorerie.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Trésorerie"
              />
              <div className="flex justify-between items-center bg-blue-700 text-white px-4 py-2.5 rounded font-bold text-sm mt-3">
                <span>TOTAL ACTIF</span>
                <span>{fmt(totalActif)}</span>
              </div>
            </div>
          </div>

          {/* PASSIF */}
          <div className="border border-gray-300 rounded-lg overflow-hidden">
            <div className="bg-purple-700 px-4 py-3">
              <h2 className="text-white font-bold text-base uppercase tracking-wide">PASSIF</h2>
            </div>
            <div className="p-4">
              <BilanSection
                title="Fonds propres (Classe 1)"
                lines={fondsPropres}
                subtotal={fondsPropres.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Fonds propres"
              />
              <BilanSection
                title="Dettes (Classe 4 — solde créditeur)"
                lines={dettes}
                subtotal={dettes.reduce((s, a) => s + a.montant, 0)}
                subtotalLabel="Sous-total Dettes"
              />
              <div className="mb-4">
                <h3 className="text-xs font-bold uppercase tracking-wide text-gray-600 border-b border-gray-200 pb-1 mb-2">Résultat de l&apos;exercice</h3>
                <div className="flex justify-between items-center bg-gray-100 px-3 py-1.5 rounded text-sm font-semibold">
                  <span className="text-gray-600">{resultat >= 0 ? 'Excédent de l\'exercice' : 'Déficit de l\'exercice'}</span>
                  <span className={resultat >= 0 ? 'text-green-700' : 'text-red-700'}>{fmt(resultat)}</span>
                </div>
              </div>
              <div className="flex justify-between items-center bg-purple-700 text-white px-4 py-2.5 rounded font-bold text-sm mt-3">
                <span>TOTAL PASSIF</span>
                <span>{fmt(totalPassif)}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Vérification équilibre */}
        <div className={`text-center py-2 px-4 rounded border text-sm font-semibold mb-8 ${
          equilibre
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-yellow-50 border-yellow-300 text-yellow-700'
        }`}>
          {equilibre
            ? `Bilan équilibré — Actif = Passif = ${fmt(totalActif)}`
            : `Déséquilibre détecté : Actif ${fmt(totalActif)} / Passif ${fmt(totalPassif)} (écart : ${fmt(Math.abs(totalActif - totalPassif))})`
          }
        </div>

        {/* Certification légale */}
        <div className="border-t-2 border-gray-300 pt-6">
          <p className="text-sm text-gray-700 font-medium mb-6">
            Je soussigné(e), certifie que le présent bilan est exact et sincère, et reflète fidèlement
            la situation financière de l&apos;association au terme de l&apos;exercice {ASSO.exerciceDebut} – {ASSO.exerciceFin}.
          </p>
          <div className="grid grid-cols-2 gap-12 mt-4">
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Le/La Président(e)</p>
              <p className="text-xs text-gray-500 mb-8">Nom, prénom :</p>
              <div className="border-b border-gray-400 w-48"></div>
              <p className="text-xs text-gray-400 mt-1">Signature</p>
            </div>
            <div>
              <p className="text-sm font-semibold text-gray-700 mb-1">Le/La Trésorier(e)</p>
              <p className="text-xs text-gray-500 mb-8">
                {ASSO.tresorier ? ASSO.tresorier : 'Nom, prénom :'}
              </p>
              <div className="border-b border-gray-400 w-48"></div>
              <p className="text-xs text-gray-400 mt-1">Signature</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-6 text-right">
            Fait à {ASSO.ville}, le ___________________________
          </p>
        </div>
      </div>
    </div>
  )
}
