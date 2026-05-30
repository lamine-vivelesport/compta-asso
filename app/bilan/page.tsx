export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import { supabase } from '@/lib/supabase'
import { PCG_ACCOUNTS, getPcgLabel } from '@/lib/pcg'
import { ASSO } from '@/lib/config'
import { parseYear, yearRange, getExercices } from '@/lib/exercice'
import YearSelector from '@/components/YearSelector'
import ExportButton from './ExportButton'

function fmt(n: number) {
  return new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR' }).format(n)
}

interface BilanLine { compte: string; libelle: string; montant: number }

function Section({ title, lines, total, totalLabel, emptyLabel = 'Néant' }: {
  title: string; lines: BilanLine[]; total: number; totalLabel: string; emptyLabel?: string
}) {
  return (
    <div className="mb-3">
      <div className="text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 px-2 py-1 border-b border-gray-200">
        {title}
      </div>
      {lines.length === 0 ? (
        <div className="flex justify-between px-2 py-1 text-xs text-gray-400 italic">
          <span>{emptyLabel}</span><span>0,00 €</span>
        </div>
      ) : (
        lines.map(l => (
          <div key={l.compte} className="flex items-baseline justify-between px-2 py-0.5 text-xs border-b border-gray-50">
            <span className="text-gray-500 font-mono mr-2 shrink-0">{l.compte}</span>
            <span className="text-gray-700 flex-1 truncate">{l.libelle}</span>
            <span className="text-gray-800 font-medium ml-4 shrink-0 tabular-nums">{fmt(l.montant)}</span>
          </div>
        ))
      )}
      <div className="flex justify-between px-2 py-1 bg-gray-100 text-xs font-semibold border-t border-gray-200">
        <span className="text-gray-600">{totalLabel}</span>
        <span className="text-gray-900 tabular-nums">{fmt(total)}</span>
      </div>
    </div>
  )
}

function TotalBar({ label, value, color }: { label: string; value: number; color: string }) {
  return (
    <div className={`flex justify-between items-center px-3 py-2 rounded text-sm font-bold ${color}`}>
      <span>{label}</span>
      <span className="tabular-nums">{fmt(value)}</span>
    </div>
  )
}

export default async function BilanPage({
  searchParams,
}: {
  searchParams: Promise<{ annee?: string }>
}) {
  const params = await searchParams
  const year = parseYear(params.annee)
  const { from, to } = yearRange(year)
  const exercices = await getExercices()

  const { data, error } = await supabase
    .from('ecritures')
    .select('compte_debit, compte_credit, montant')
    .gte('date', from)
    .lte('date', to)

  const rows = data ?? []
  const dateGeneration = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })

  // Calcul des soldes : débit = +, crédit = -
  const soldes: Record<string, number> = {}
  for (const e of rows) {
    const d = e.compte_debit as string
    const c = e.compte_credit as string
    const m = Number(e.montant)
    soldes[d] = (soldes[d] ?? 0) + m
    soldes[c] = (soldes[c] ?? 0) - m
  }

  // Lignes avec solde débiteur (actif)
  const debitLines = (prefixes: string[]): BilanLine[] =>
    Object.entries(soldes)
      .filter(([c]) => prefixes.some(p => c.startsWith(p)))
      .map(([compte, s]) => ({ compte, libelle: getPcgLabel(compte), montant: s }))
      .filter(l => l.montant > 0.005)
      .sort((a, b) => a.compte.localeCompare(b.compte))

  // Lignes avec solde créditeur (passif) → valeur positive = -solde
  const creditLines = (prefixes: string[]): BilanLine[] =>
    Object.entries(soldes)
      .filter(([c]) => prefixes.some(p => c.startsWith(p)))
      .map(([compte, s]) => ({ compte, libelle: getPcgLabel(compte), montant: -s }))
      .filter(l => l.montant > 0.005)
      .sort((a, b) => a.compte.localeCompare(b.compte))

  const sum = (lines: BilanLine[]) => lines.reduce((s, l) => s + l.montant, 0)

  // ─── ACTIF ───────────────────────────────────────────────────────────────
  const immoInc   = debitLines(['201', '203', '205', '206', '207', '208'])
  const immoCorp  = debitLines(['211', '212', '213', '214', '215', '218', '231', '232'])
  const immoFin   = debitLines(['261', '265', '271', '274', '275'])
  const stocks    = debitLines(['3'])
  const creances  = debitLines(['4'])   // classe 4 solde débiteur
  const dispo     = debitLines(['5'])   // classe 5 disponibilités
  const chargesCA = debitLines(['486'])

  const totalImmo    = sum(immoInc) + sum(immoCorp) + sum(immoFin)
  const totalCirc    = sum(stocks) + sum(creances) + sum(dispo)
  const totalActif   = totalImmo + totalCirc + sum(chargesCA)

  // ─── PASSIF ──────────────────────────────────────────────────────────────
  const fondsAssoSans = creditLines(['101'])
  const fondsAssoCon  = creditLines(['102'])
  const reserves      = creditLines(['106', '107'])

  // Report à nouveau : 110 créditeur = positif PASSIF, 119 débiteur = négatif PASSIF
  const reportAN = -(soldes['110'] ?? 0) - (soldes['119'] ?? 0)
  const reportANLines: BilanLine[] = []
  const s110 = soldes['110'] ?? 0
  const s119 = soldes['119'] ?? 0
  if (Math.abs(s110) > 0.005)
    reportANLines.push({ compte: '110', libelle: PCG_ACCOUNTS['110'] ?? 'Report à nouveau', montant: -s110 })
  if (Math.abs(s119) > 0.005)
    reportANLines.push({ compte: '119', libelle: PCG_ACCOUNTS['119'] ?? 'Report à nouveau déficitaire', montant: -s119 })

  // Résultat
  let totalProduits = 0; let totalCharges = 0
  for (const [c, s] of Object.entries(soldes)) {
    if (c.startsWith('7')) totalProduits += -s
    if (c.startsWith('6')) totalCharges  +=  s
  }
  const resultat = totalProduits - totalCharges

  const subvInvest    = creditLines(['131', '138'])
  const provisions    = creditLines(['15'])
  const emprunts      = creditLines(['16'])
  const dettesClass4  = creditLines(['4'])  // classe 4 solde créditeur
  const produitsCA    = creditLines(['487'])

  const totalFondsPropres =
    sum(fondsAssoSans) + sum(fondsAssoCon) + sum(reserves) + reportAN + resultat

  const totalDettes = sum(emprunts) + sum(dettesClass4)
  const totalPassif = totalFondsPropres + sum(subvInvest) + sum(provisions) + totalDettes + sum(produitsCA)

  const equilibre = Math.abs(totalActif - totalPassif) < 0.05

  return (
    <div>
      {/* Barre d'actions */}
      <div className="flex items-center justify-between mb-6 print:hidden">
        <div>
          <h1 className="text-2xl font-bold text-gray-800">Bilan</h1>
          <p className="text-sm text-gray-500">Exercice {year}</p>
        </div>
        <div className="flex items-center gap-3">
          <Suspense fallback={<div className="w-36 h-9 bg-gray-100 animate-pulse rounded-lg" />}>
            <YearSelector current={year} years={exercices} />
          </Suspense>
          <ExportButton />
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 rounded-lg text-sm print:hidden">
          Erreur lors du chargement des données.
        </div>
      )}

      {/* Document imprimable */}
      <div className="print-document bg-white rounded-xl border border-gray-200 shadow-sm p-6 print:p-0 print:border-0 print:shadow-none">

        {/* En-tête légal */}
        <div className="border-b-2 border-gray-800 pb-4 mb-5">
          <div className="flex justify-between items-start">
            <div>
              <div className="text-base font-bold text-gray-900 uppercase">{ASSO.nom}</div>
              <div className="text-xs text-gray-600">{ASSO.adresse} — {ASSO.codePostal} {ASSO.ville}</div>
              {ASSO.siret && <div className="text-xs text-gray-500">SIRET : {ASSO.siret}</div>}
              {ASSO.rna && <div className="text-xs text-gray-500">RNA : {ASSO.rna}</div>}
            </div>
            <div className="text-right text-xs text-gray-500">
              <div className="font-semibold">Association Loi 1901</div>
              <div>Document généré le {dateGeneration}</div>
              <div className="text-gray-400 mt-1">{rows.length} écriture(s)</div>
            </div>
          </div>
          <div className="text-center mt-4">
            <div className="text-xl font-bold uppercase tracking-widest text-gray-900">BILAN</div>
            <div className="text-xs text-gray-500 mt-0.5">
              Exercice du 01/01/{year} au 31/12/{year} — Règlement CRC 99-01
            </div>
          </div>
        </div>

        {/* Actif / Passif côte à côte */}
        <div className="bilan-grid grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 text-sm">

          {/* ── ACTIF ── */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-blue-800 text-white text-sm font-bold uppercase tracking-wide px-3 py-2">
              ACTIF
            </div>

            <div className="p-2">
              {/* Actif immobilisé */}
              <div className="text-xs font-bold text-gray-700 uppercase px-2 pt-2 pb-1">Actif immobilisé</div>
              <Section title="Immobilisations incorporelles" lines={immoInc}
                total={sum(immoInc)} totalLabel="Sous-total immo. incorporelles" />
              <Section title="Immobilisations corporelles" lines={immoCorp}
                total={sum(immoCorp)} totalLabel="Sous-total immo. corporelles" />
              <Section title="Immobilisations financières" lines={immoFin}
                total={sum(immoFin)} totalLabel="Sous-total immo. financières" />
              <div className="flex justify-between px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-bold mb-3">
                <span className="text-blue-800">Total actif immobilisé</span>
                <span className="text-blue-900 tabular-nums">{fmt(totalImmo)}</span>
              </div>

              {/* Actif circulant */}
              <div className="text-xs font-bold text-gray-700 uppercase px-2 pb-1">Actif circulant</div>
              <Section title="Stocks et en-cours" lines={stocks}
                total={sum(stocks)} totalLabel="Sous-total stocks" />
              <Section title="Créances" lines={creances}
                total={sum(creances)} totalLabel="Sous-total créances" />
              <Section title="Disponibilités" lines={dispo}
                total={sum(dispo)} totalLabel="Sous-total disponibilités" />
              <div className="flex justify-between px-2 py-1.5 bg-blue-50 border border-blue-200 rounded text-xs font-bold mb-3">
                <span className="text-blue-800">Total actif circulant</span>
                <span className="text-blue-900 tabular-nums">{fmt(totalCirc)}</span>
              </div>

              <Section title="Charges constatées d'avance (486)" lines={chargesCA}
                total={sum(chargesCA)} totalLabel="Sous-total charges constatées d'avance" />
            </div>

            <TotalBar label="TOTAL ACTIF" value={totalActif} color="bg-blue-800 text-white mx-2 mb-2" />
          </div>

          {/* ── PASSIF ── */}
          <div className="border border-gray-300 rounded overflow-hidden">
            <div className="bg-purple-800 text-white text-sm font-bold uppercase tracking-wide px-3 py-2">
              PASSIF
            </div>

            <div className="p-2">
              {/* Fonds propres */}
              <div className="text-xs font-bold text-gray-700 uppercase px-2 pt-2 pb-1">Fonds propres</div>
              <Section title="Fonds associatifs sans droit de reprise (101)" lines={fondsAssoSans}
                total={sum(fondsAssoSans)} totalLabel="Sous-total 101" />
              <Section title="Fonds associatifs avec droit de reprise (102)" lines={fondsAssoCon}
                total={sum(fondsAssoCon)} totalLabel="Sous-total 102" />
              <Section title="Réserves (106)" lines={reserves}
                total={sum(reserves)} totalLabel="Sous-total réserves" />

              {/* Report à nouveau */}
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 px-2 py-1 border-b border-gray-200">
                Report à nouveau (110/119)
              </div>
              {reportANLines.length === 0 ? (
                <div className="flex justify-between px-2 py-1 text-xs text-gray-400 italic">
                  <span>Néant</span><span>0,00 €</span>
                </div>
              ) : reportANLines.map(l => (
                <div key={l.compte} className="flex items-baseline justify-between px-2 py-0.5 text-xs border-b border-gray-50">
                  <span className="text-gray-500 font-mono mr-2">{l.compte}</span>
                  <span className="text-gray-700 flex-1">{l.libelle}</span>
                  <span className={`ml-4 font-medium tabular-nums ${l.montant < 0 ? 'text-red-600' : 'text-gray-800'}`}>
                    {fmt(l.montant)}
                  </span>
                </div>
              ))}
              <div className="flex justify-between px-2 py-1 bg-gray-100 text-xs font-semibold border-t border-gray-200 mb-1">
                <span className="text-gray-600">Sous-total report à nouveau</span>
                <span className={`tabular-nums ${reportAN < 0 ? 'text-red-700' : 'text-gray-900'}`}>{fmt(reportAN)}</span>
              </div>

              {/* Résultat */}
              <div className="text-xs font-bold uppercase tracking-wide text-gray-500 bg-gray-50 px-2 py-1 border-b border-gray-200">
                Résultat de l&apos;exercice
              </div>
              <div className="flex justify-between px-2 py-1 bg-gray-100 text-xs font-semibold">
                <span className="text-gray-700">{resultat >= 0 ? 'Excédent de l\'exercice' : 'Déficit de l\'exercice'}</span>
                <span className={`tabular-nums font-bold ${resultat >= 0 ? 'text-green-700' : 'text-red-700'}`}>{fmt(resultat)}</span>
              </div>

              <div className="flex justify-between px-2 py-1.5 bg-purple-50 border border-purple-200 rounded text-xs font-bold mt-1 mb-3">
                <span className="text-purple-800">Total fonds propres</span>
                <span className={`tabular-nums ${totalFondsPropres < 0 ? 'text-red-700' : 'text-purple-900'}`}>{fmt(totalFondsPropres)}</span>
              </div>

              {/* Subventions d'investissement */}
              <Section title="Subventions d'investissement (131, 138)" lines={subvInvest}
                total={sum(subvInvest)} totalLabel="Sous-total subventions investissement" />

              {/* Provisions */}
              <Section title="Provisions pour risques et charges (15)" lines={provisions}
                total={sum(provisions)} totalLabel="Sous-total provisions" />

              {/* Dettes */}
              <div className="text-xs font-bold text-gray-700 uppercase px-2 pb-1 mt-1">Dettes</div>
              <Section title="Emprunts et dettes financières (16)" lines={emprunts}
                total={sum(emprunts)} totalLabel="Sous-total emprunts" />
              <Section title="Autres dettes (classe 4 solde créditeur)" lines={dettesClass4}
                total={sum(dettesClass4)} totalLabel="Sous-total autres dettes" />
              <div className="flex justify-between px-2 py-1.5 bg-purple-50 border border-purple-200 rounded text-xs font-bold mb-3">
                <span className="text-purple-800">Total dettes</span>
                <span className="text-purple-900 tabular-nums">{fmt(totalDettes)}</span>
              </div>

              <Section title="Produits constatés d'avance (487)" lines={produitsCA}
                total={sum(produitsCA)} totalLabel="Sous-total produits constatés d'avance" />
            </div>

            <TotalBar label="TOTAL PASSIF" value={totalPassif} color="bg-purple-800 text-white mx-2 mb-2" />
          </div>
        </div>

        {/* Vérification équilibre */}
        <div className={`text-center text-xs font-semibold py-2 px-4 rounded border mb-6 ${
          equilibre
            ? 'bg-green-50 border-green-300 text-green-700'
            : 'bg-red-50 border-red-300 text-red-700'
        }`}>
          {equilibre
            ? `✓ Bilan équilibré — Total Actif = Total Passif = ${fmt(totalActif)}`
            : `⚠ Déséquilibre : Actif ${fmt(totalActif)} / Passif ${fmt(totalPassif)} — Écart : ${fmt(Math.abs(totalActif - totalPassif))}`
          }
        </div>

        {/* Certification légale */}
        <div className="border-t border-gray-300 pt-4">
          <p className="text-xs text-gray-600 mb-5">
            Je soussigné(e) certifie que le présent bilan est exact et sincère et reflète fidèlement
            la situation financière de l&apos;association au terme de l&apos;exercice 01/01/{year} – 31/12/{year},
            établi conformément au règlement CRC 99-01 relatif aux associations et fondations.
          </p>
          <div className="grid grid-cols-2 gap-8">
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Le/La Président(e)</p>
              <p className="text-xs text-gray-400 mb-6">Nom :</p>
              <div className="border-b border-gray-400 w-40 mt-4"></div>
              <p className="text-xs text-gray-400 mt-0.5">Signature</p>
            </div>
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-1">Le/La Trésorier(e)</p>
              <p className="text-xs text-gray-400 mb-6">{ASSO.tresorier || 'Nom :'}</p>
              <div className="border-b border-gray-400 w-40 mt-4"></div>
              <p className="text-xs text-gray-400 mt-0.5">Signature</p>
            </div>
          </div>
          <p className="text-xs text-gray-400 mt-4 text-right">
            Fait à {ASSO.ville}, le ___________________________
          </p>
        </div>
      </div>
    </div>
  )
}
