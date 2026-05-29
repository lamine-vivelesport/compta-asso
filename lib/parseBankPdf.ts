export interface PdfTransaction {
  date: string
  libelle: string
  montant: number
  isDebit: boolean
  compte_debit: string
  compte_credit: string
}

const BANK_ACCOUNT = '512000'

interface Rule {
  keywords: string[]
  account: string
}

const EXPENSE_RULES: Rule[] = [
  { keywords: ['urssaf', 'securite sociale', 'cotis soc'], account: '645000' },
  { keywords: ['swisslife', 'malakoff', 'ag2r', 'humanis', 'prevoyance', 'mutuelle'], account: '646000' },
  { keywords: ['orange', 'sfr', 'bouygues', 'free', 'telecom', 'internet'], account: '626000' },
  { keywords: ['edf', 'engie', 'electricite', 'gaz'], account: '606100' },
  { keywords: ['loyer', 'bail'], account: '613000' },
  { keywords: ['assurance', 'maif', 'groupama', 'axa', 'gmf', 'allianz'], account: '616000' },
  { keywords: ['cotis associatis', 'frais bancaire', 'commission bancaire', 'interets debiteurs'], account: '627000' },
  { keywords: ['salaire', 'remuneration'], account: '641000' },
  { keywords: ['impot', 'taxe fonciere', 'tva'], account: '635000' },
  { keywords: ['sncf', 'ratp', 'transport', 'carburant', 'navigo'], account: '624000' },
  { keywords: ['formation', 'stage', 'cpf'], account: '633000' },
  { keywords: ['fourniture', 'papeterie', 'bureau'], account: '606400' },
  { keywords: ['publicite', 'communication', 'impression', 'flyer'], account: '623000' },
  { keywords: ['eau', 'veolia', 'saur'], account: '606300' },
]

const INCOME_RULES: Rule[] = [
  { keywords: ['drfip', 'subvention', 'ministere', 'prefecture', 'drac', 'agence nationale', 'caf', 'departement', 'region', 'mairie', 'commune', 'asp', 'tresor public', 'collectivite', 'cui'], account: '741000' },
  { keywords: ['cotisation', 'adhesion', 'adherent'], account: '756000' },
  { keywords: ['don ', 'donation', 'mecenat'], account: '754000' },
  { keywords: ['vente', 'prestation', 'facture'], account: '706000' },
  { keywords: ['remboursement cpam', 'securite sociale remb'], account: '791000' },
]

function normalize(s: string): string {
  return s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
}

export function detectPcg(libelle: string, isDebit: boolean): string {
  const n = normalize(libelle)
  const rules = isDebit ? EXPENSE_RULES : INCOME_RULES
  for (const rule of rules) {
    if (rule.keywords.some(kw => n.includes(kw))) return rule.account
  }
  return isDebit ? '658000' : '758000'
}

function toIsoDate(ddmmyyyy: string): string {
  const [d, m, y] = ddmmyyyy.split('/')
  return `${y}-${m.padStart(2, '0')}-${d.padStart(2, '0')}`
}

export function parseBankStatementText(text: string): PdfTransaction[] {
  const transactions: PdfTransaction[] = []
  const lines = text.replace(/\r\n/g, '\n').split('\n')

  // DD/MM/YYYY DD/MM/YYYY DESCRIPTION +/- X XXX,XX
  const txRegex = /^(\d{2}\/\d{2}\/\d{4})\s+\d{2}\/\d{2}\/\d{4}\s+(.+?)\s+([+-])\s*((?:\d[\d\s]*,\d{2}))\s*$/

  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed) continue
    if (/SOLDE (CREDITEUR|DEBITEUR)/i.test(trimmed)) continue
    if (/TOTAL DES OPERATIONS/i.test(trimmed)) continue

    const match = trimmed.match(txRegex)
    if (!match) continue

    const [, dateStr, libelle, sign, amountRaw] = match
    const isDebit = sign === '-'
    const montant = parseFloat(amountRaw.replace(/\s/g, '').replace(',', '.'))

    if (isNaN(montant) || montant <= 0) continue

    const pcg = detectPcg(libelle, isDebit)

    transactions.push({
      date: toIsoDate(dateStr),
      libelle: libelle.trim(),
      montant,
      isDebit,
      compte_debit: isDebit ? pcg : BANK_ACCOUNT,
      compte_credit: isDebit ? BANK_ACCOUNT : pcg,
    })
  }

  return transactions
}
