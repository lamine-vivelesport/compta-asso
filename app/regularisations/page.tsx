import { Suspense } from 'react'
import RegularisationsClient from './RegularisationsClient'

export default function RegularisationsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-gray-400 text-sm">Chargement…</div>}>
      <RegularisationsClient />
    </Suspense>
  )
}
