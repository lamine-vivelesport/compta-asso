'use client'

import { useRouter, usePathname, useSearchParams } from 'next/navigation'

interface Props {
  current: number
  years: number[]
}

export default function YearSelector({ current, years }: Props) {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const onChange = (year: string) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('annee', year)
    params.delete('page')
    router.push(`${pathname}?${params.toString()}`)
  }

  return (
    <div className="flex items-center gap-2">
      <span className="text-sm text-gray-500">Exercice</span>
      <select
        value={current}
        onChange={e => onChange(e.target.value)}
        className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm font-semibold bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500 text-gray-800"
      >
        {years.map(y => (
          <option key={y} value={y}>{y}</option>
        ))}
      </select>
    </div>
  )
}
