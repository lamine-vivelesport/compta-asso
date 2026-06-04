'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

const CLASS_LABELS: Record<number, string> = {
  1: 'Fonds propres',
  2: 'Immobilisations',
  3: 'Stocks',
  4: 'Tiers',
  5: 'Trésorerie',
  6: 'Charges',
  7: 'Produits',
}

interface Props {
  current: number | null
  available: number[]
}

export default function ClassFilter({ current, available }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const setClasse = (c: number | null) => {
    const params = new URLSearchParams(searchParams.toString())
    if (c === null) params.delete('classe')
    else params.set('classe', String(c))
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button
        onClick={() => setClasse(null)}
        className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
          current === null
            ? 'bg-indigo-600 text-white border-indigo-600'
            : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
        }`}
      >
        Toutes les classes
      </button>
      {available.map(c => (
        <button
          key={c}
          onClick={() => setClasse(c)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            current === c
              ? 'bg-indigo-600 text-white border-indigo-600'
              : 'bg-white text-gray-600 border-gray-300 hover:border-gray-400'
          }`}
        >
          <span className="font-semibold">{c}</span>
          <span className="hidden sm:inline text-xs ml-1 opacity-75">— {CLASS_LABELS[c]}</span>
        </button>
      ))}
    </div>
  )
}
