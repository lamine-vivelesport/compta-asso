export const dynamic = 'force-dynamic'

import { Suspense } from 'react'
import DocumentsClient from './DocumentsClient'

export default function DocumentsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Chargement…</div>}>
      <DocumentsClient />
    </Suspense>
  )
}
