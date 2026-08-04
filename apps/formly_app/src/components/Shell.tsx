import type { ReactNode } from 'react'
import { NavLink } from 'react-router-dom'
import { House, Plus, ChartBar } from '@phosphor-icons/react'

const navItems = [
  { to: '/', label: 'Meus questionários', icon: House },
  { to: '/builder', label: 'Criar novo', icon: Plus },
  { to: '/dashboard', label: 'Dashboard', icon: ChartBar },
]

export default function Shell({ children }: { children: ReactNode }) {
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

      <main style={{ flex: 1, width: '100%', maxWidth: 960, margin: '0 auto', padding: 24 }}>{children}</main>
    </div>
  )
}
