'use client'

import { useState } from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import './globals.css'

const navLinks = [
  { href: '/', label: 'Tableau de bord', icon: '📊' },
  { href: '/saisie', label: 'Saisie', icon: '✏️' },
  { href: '/journal', label: 'Journal', icon: '📒' },
  { href: '/resultat', label: 'Compte de résultat', icon: '📈' },
  { href: '/bilan', label: 'Bilan', icon: '⚖️' },
  { href: '/regularisations', label: 'Régularisations', icon: '🔄' },
  { href: '/import', label: 'Import CSV', icon: '📥' },
]

function Sidebar({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname()
  return (
    <div className="flex flex-col h-full bg-gray-900 text-white">
      <div className="flex items-center justify-between px-6 py-5 border-b border-gray-700">
        <span className="text-xl font-bold text-indigo-400 tracking-tight">ComptaAsso</span>
        {onClose && (
          <button onClick={onClose} className="md:hidden text-gray-400 hover:text-white">
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        )}
      </div>
      <nav className="flex-1 px-3 py-4 space-y-1">
        {navLinks.map(link => {
          const isActive = pathname === link.href
          return (
            <Link
              key={link.href}
              href={link.href}
              onClick={onClose}
              className={`flex items-center gap-3 px-4 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-indigo-600 text-white'
                  : 'text-gray-300 hover:bg-gray-800 hover:text-white'
              }`}
            >
              <span className="text-base">{link.icon}</span>
              {link.label}
            </Link>
          )
        })}
      </nav>
      <div className="px-6 py-4 border-t border-gray-700 text-xs text-gray-500">
        Association Loi 1901 &copy; {new Date().getFullYear()}
      </div>
    </div>
  )
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [sidebarOpen, setSidebarOpen] = useState(false)

  return (
    <html lang="fr">
      <body className="bg-gray-100 text-gray-900 antialiased">
        <div className="flex h-screen overflow-hidden">
          {/* Desktop sidebar */}
          <aside className="hidden md:flex md:flex-shrink-0 md:w-64 print:hidden">
            <div className="w-64 flex flex-col">
              <Sidebar />
            </div>
          </aside>

          {/* Mobile sidebar overlay */}
          {sidebarOpen && (
            <div className="fixed inset-0 z-40 md:hidden print:hidden">
              <div
                className="absolute inset-0 bg-gray-600 bg-opacity-75"
                onClick={() => setSidebarOpen(false)}
              />
              <div className="relative w-64 h-full">
                <Sidebar onClose={() => setSidebarOpen(false)} />
              </div>
            </div>
          )}

          {/* Main content */}
          <div className="flex flex-col flex-1 overflow-hidden">
            {/* Mobile top bar */}
            <div className="md:hidden print:hidden flex items-center justify-between bg-gray-900 px-4 py-3">
              <span className="text-lg font-bold text-indigo-400">ComptaAsso</span>
              <button
                onClick={() => setSidebarOpen(true)}
                className="text-gray-300 hover:text-white"
              >
                <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                </svg>
              </button>
            </div>

            <main className="flex-1 overflow-y-auto p-4 md:p-6">
              {children}
            </main>
          </div>
        </div>
      </body>
    </html>
  )
}
