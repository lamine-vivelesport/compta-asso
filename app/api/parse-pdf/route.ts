import { NextRequest, NextResponse } from 'next/server'
import { parseBankStatementText } from '@/lib/parseBankPdf'

export const runtime = 'nodejs'

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'Fichier manquant' }, { status: 400 })

    const buffer = Buffer.from(await file.arrayBuffer())

    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const pdfParse = require('pdf-parse')
    const data = await pdfParse(buffer)
    const transactions = parseBankStatementText(data.text)

    return NextResponse.json({ transactions })
  } catch (err) {
    console.error('Erreur parsing PDF:', err)
    return NextResponse.json({ error: 'Impossible de lire ce PDF' }, { status: 500 })
  }
}
