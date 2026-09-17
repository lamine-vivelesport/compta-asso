#!/usr/bin/env node
/**
 * Reprise de l'historique comptable à partir des relevés bancaires.
 *
 *   node scripts/reprise-historique.mjs            → simulation (aucune écriture en base)
 *   node scripts/reprise-historique.mjs --execute  → sauvegarde, purge, import, rapprochement
 *
 * Fichiers lus : data/releves/*.csv (0000_ouverture.csv en premier, puis ordre alphabétique)
 * Sauvegarde   : data/backup/ecritures-AAAAMMJJ-HHMMSS.csv
 */
import fs from 'node:fs'
import path from 'node:path'

const ROOT = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..')
const EXECUTE = process.argv.includes('--execute')
const JOURNAUX = ['AC', 'VE', 'BQ', 'CA', 'OD']

// ─── Environnement ──────────────────────────────────────────────────────────
for (const line of fs.readFileSync(path.join(ROOT, '.env.local'), 'utf8').split('\n')) {
  const m = line.match(/^\s*([A-Z_]+)\s*=\s*(.*)\s*$/)
  if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, '')
}
const URL_API = `${process.env.NEXT_PUBLIC_SUPABASE_URL}/rest/v1/ecritures`
const KEY = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
const headers = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' }

async function api(url, init = {}) {
  const res = await fetch(url, { ...init, headers: { ...headers, ...init.headers } })
  if (!res.ok) throw new Error(`${init.method ?? 'GET'} ${url} → ${res.status} ${await res.text()}`)
  return res
}

async function fetchAll(select) {
  const all = []
  for (let offset = 0; ; offset += 1000) {
    const res = await api(`${URL_API}?select=${select}&order=date,created_at&offset=${offset}&limit=1000`)
    const page = await res.json()
    all.push(...page)
    if (page.length < 1000) return all
  }
}

// ─── Lecture et validation des CSV ──────────────────────────────────────────
const toCents = s => {
  if (!/^\d+(\.\d{1,2})?$/.test(s)) throw new Error(`montant invalide « ${s} »`)
  const [e, d = ''] = s.split('.')
  return Number(e) * 100 + Number((d + '00').slice(0, 2))
}

function lireReleves() {
  const dir = path.join(ROOT, 'data/releves')
  const fichiers = fs.readdirSync(dir).filter(f => f.endsWith('.csv')).sort()
  const lignes = []
  const erreurs = []
  const vues = new Set()

  for (const f of fichiers) {
    const contenu = fs.readFileSync(path.join(dir, f), 'utf8').replace(/^﻿/, '').trim().split(/\r?\n/)
    const entete = contenu[0].split(';').join(';')
    if (entete !== 'date;piece;journal;libelle;compte_debit;compte_credit;montant') {
      erreurs.push(`${f} : en-tête inattendu « ${entete} »`)
      continue
    }
    contenu.slice(1).forEach((brut, i) => {
      const ou = `${f}:${i + 2}`
      const c = brut.split(';')
      if (c.length !== 7) return erreurs.push(`${ou} : ${c.length} colonnes au lieu de 7`)
      const [date, piece, journal, libelle, debit, credit, montant] = c
      const d = date.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
      if (!d) return erreurs.push(`${ou} : date invalide « ${date} »`)
      const iso = `${d[3]}-${d[2]}-${d[1]}`
      if (Number.isNaN(Date.parse(iso))) return erreurs.push(`${ou} : date invalide « ${date} »`)
      if (!JOURNAUX.includes(journal)) return erreurs.push(`${ou} : journal inconnu « ${journal} »`)
      if (!/^[1-8]\d{5}$/.test(debit)) return erreurs.push(`${ou} : compte débit invalide « ${debit} »`)
      if (!/^[1-8]\d{5}$/.test(credit)) return erreurs.push(`${ou} : compte crédit invalide « ${credit} »`)
      if (debit === credit) return erreurs.push(`${ou} : débit et crédit identiques (${debit})`)
      if (!piece) return erreurs.push(`${ou} : numéro de pièce vide`)
      let cents
      try { cents = toCents(montant) } catch (e) { return erreurs.push(`${ou} : ${e.message}`) }
      if (cents <= 0) return erreurs.push(`${ou} : montant nul`)
      const cle = `${d[3]}|${piece}`
      if (vues.has(cle)) return erreurs.push(`${ou} : pièce « ${piece} » déjà présente en ${d[3]}`)
      vues.add(cle)
      lignes.push({
        date: iso, numero_piece: piece, journal_code: journal, libelle,
        compte_debit: debit, compte_credit: credit, montant: (cents / 100).toFixed(2), _cents: cents,
      })
    })
    console.log(`  ${f.padEnd(20)} ${String(contenu.length - 1).padStart(4)} lignes`)
  }
  return { lignes, erreurs }
}

// ─── Rapprochement ──────────────────────────────────────────────────────────
function rapprocher(ecritures) {
  const ref = JSON.parse(fs.readFileSync(path.join(ROOT, 'lib/soldes-bancaires.json'), 'utf8'))
  const cents = e => e._cents ?? Math.round(Number(e.montant) * 100)
  let ecarts = 0
  for (const compte of ['512000', '512100']) {
    for (const [date, attendu] of Object.entries(ref[compte])) {
      const calcule = ecritures
        .filter(e => e.date <= date)
        .reduce((s, e) => s + (e.compte_debit === compte ? cents(e) : 0) - (e.compte_credit === compte ? cents(e) : 0), 0)
      const ok = calcule === Math.round(attendu * 100)
      if (!ok) ecarts++
      console.log(`  ${compte} ${date} ${(calcule / 100).toFixed(2).padStart(10)} ${ok ? '✓' : `✗ attendu ${attendu.toFixed(2)}`}`)
    }
  }
  return ecarts
}

// ─── Programme ──────────────────────────────────────────────────────────────
console.log('1. Lecture des relevés')
const { lignes, erreurs } = lireReleves()
if (erreurs.length) {
  console.error(`\n${erreurs.length} erreur(s) — import annulé :`)
  erreurs.forEach(e => console.error('  ' + e))
  process.exit(1)
}
console.log(`  Total : ${lignes.length} écritures valides`)

console.log('\n2. Rapprochement des fichiers (avant import)')
if (rapprocher(lignes) > 0) {
  console.error('\nÉcart de rapprochement dans les fichiers — import annulé.')
  process.exit(1)
}

if (!EXECUTE) {
  console.log('\nSimulation terminée. Relancer avec --execute pour sauvegarder, purger et importer.')
  process.exit(0)
}

console.log('\n3. Sauvegarde de la table actuelle')
const existantes = await fetchAll('*')
const cols = ['id', 'date', 'numero_piece', 'journal_code', 'libelle', 'compte_debit', 'compte_credit', 'montant', 'created_at']
const esc = v => `"${String(v ?? '').replace(/"/g, '""')}"`
const horodatage = new Date().toISOString().replace(/[-:]/g, '').replace('T', '-').slice(0, 15)
const fichierBackup = path.join(ROOT, `data/backup/ecritures-${horodatage}.csv`)
fs.mkdirSync(path.dirname(fichierBackup), { recursive: true })
fs.writeFileSync(fichierBackup, [cols.join(';'), ...existantes.map(e => cols.map(c => esc(e[c])).join(';'))].join('\n') + '\n')
console.log(`  ${existantes.length} écritures sauvegardées → ${path.relative(ROOT, fichierBackup)}`)

console.log('\n4. Purge')
await api(`${URL_API}?id=not.is.null`, { method: 'DELETE', headers: { Prefer: 'return=minimal' } })
const restantes = await fetchAll('id')
if (restantes.length) throw new Error(`purge incomplète : ${restantes.length} écritures restantes`)
console.log('  Table vide')

console.log('\n5. Import')
for (let i = 0; i < lignes.length; i += 500) {
  const lot = lignes.slice(i, i + 500).map(({ _cents, ...e }) => e)
  await api(URL_API, { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(lot) })
  console.log(`  ${Math.min(i + 500, lignes.length)} / ${lignes.length}`)
}

console.log('\n6. Rapprochement de la base (après import)')
const enBase = await fetchAll('date,compte_debit,compte_credit,montant')
console.log(`  ${enBase.length} écritures en base`)
const ecartsBase = rapprocher(enBase)
if (enBase.length !== lignes.length || ecartsBase > 0) {
  console.error(`\nÉCHEC : ${enBase.length} en base pour ${lignes.length} attendues, ${ecartsBase} écart(s). Sauvegarde : ${fichierBackup}`)
  process.exit(1)
}
console.log('\nReprise terminée — base rapprochée au centime.')
