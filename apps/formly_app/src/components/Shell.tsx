import { useState } from 'react'
import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { House, Plus, ChartBar, Check } from '@phosphor-icons/react'

const TOKEN_KEY = 'formly_token'

const navItems = [
  { to: '/', label: 'Meus questionários', icon: House },
  { to: '/builder', label: 'Criar novo', icon: Plus },
  { to: '/dashboard', label: 'Dashboard', icon: ChartBar },
]

export default function Shell({ children }: { children: ReactNode }) {
  const [hasToken, setHasToken] = useState<boolean>(() => Boolean(window.localStorage.getItem(TOKEN_KEY)))
  const [tokenInput, setTokenInput] = useState<string>('')
  const [saved, setSaved] = useState(false)

  const saveToken = () => {
    const value = tokenInput.trim()
    if (!value) return
    window.localStorage.setItem(TOKEN_KEY, value)
    setHasToken(true)
    setSaved(true)
    window.setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <header
        style={{
          position: 'sticky',
          top: 0,
          zIndex: 100,
          display: 'flex',
          alignItems: 'center',
          gap: 28,
          padding: '0 24px',
          height: 56,
          background: 'var(--glass)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid var(--gb)',
        }}
      >
        <span
          style={{
            fontWeight: 700,
            fontSize: 18,
            letterSpacing: '-0.02em',
            background: 'var(--ac-grad)',
            WebkitBackgroundClip: 'text',
            WebkitTextFillColor: 'transparent',
          }}
        >
          Formly
        </span>
        <nav style={{ display: 'flex', gap: 4 }}>
          {navItems.map(({ to, label, icon: Icon }) => (
            <NavLink key={to} to={to} end={to === '/'}>
              {({ isActive }) => (
                <span
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    padding: '6px 12px',
                    borderRadius: 'var(--r)',
                    fontSize: 13,
                    fontWeight: 500,
                    color: isActive ? 'var(--ac-hi)' : 'var(--mu2)',
                    background: isActive ? 'var(--adim)' : 'transparent',
                    border: '1px solid transparent',
                  }}
                >
                  <Icon size={16} weight={isActive ? 'fill' : 'regular'} />
                  {label}
                </span>
              )}
            </NavLink>
          ))}
        </nav>
      </header>

      {!hasToken && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            padding: '10px 24px',
            background: 'var(--adm2)',
            borderBottom: '1px solid var(--gb)',
            fontSize: 13,
            color: 'var(--fg)',
          }}
        >
          <span>Modo dev — token não configurado</span>
          <input
            value={tokenInput}
            onChange={(e) => setTokenInput(e.target.value)}
            placeholder="Cole seu JWT aqui"
            style={{
              flex: 1,
              maxWidth: 420,
              padding: '6px 10px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--gb2)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontSize: 13,
              fontFamily: 'var(--font-mono)',
              outline: 'none',
            }}
          />
          <button
            onClick={saveToken}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 14px',
              borderRadius: 'var(--r)',
              border: 'none',
              background: 'var(--ac-grad)',
              color: '#fff',
              fontSize: 13,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            {saved ? <Check size={14} weight="bold" /> : null}
            {saved ? 'Salvo' : 'Salvar'}
          </button>
        </div>
      )}

      <main style={{ flex: 1, width: '100%', maxWidth: 960, margin: '0 auto', padding: 24 }}>{children}</main>
    </div>
  )
}
