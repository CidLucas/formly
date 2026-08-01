import { useMemo, useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { QRCodeSVG } from 'qrcode.react'
import { X, Link, PaperPlaneRight, CheckCircle, Copy, MagnifyingGlass, Check, WhatsappLogo } from '@phosphor-icons/react'
import { contacts as contactsApi } from '../lib/api'
import type { Contact } from '../lib/api'

export interface PublishModalProps {
  open: boolean
  onClose: () => void
  surveyUrl: string
  slug: string
}

function waLink(contact: Contact, surveyUrl: string): string | null {
  if (!contact.phone) return null
  const message = `Olá! Responda meu questionário: ${surveyUrl}`
  return `https://wa.me/${contact.phone.replace(/\D/g, '')}?text=${encodeURIComponent(message)}`
}

export default function PublishModal({ open, onClose, surveyUrl, slug }: PublishModalProps) {
  const [tab, setTab] = useState<'link' | 'share'>('link')
  const [copied, setCopied] = useState(false)
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())

  const { data: allContacts = [] } = useQuery<Contact[]>({ queryKey: ['contacts'], queryFn: contactsApi.list })

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return allContacts
    return allContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    )
  }, [allContacts, search])

  if (!open) return null

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(surveyUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
    } catch {
      // clipboard indisponível — ignora
    }
  }

  const toggleContact = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 200,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        style={{
          width: '100%',
          maxWidth: 520,
          maxHeight: '85vh',
          overflowY: 'auto',
          background: 'var(--surface)',
          border: '1px solid var(--gb)',
          borderRadius: 'var(--rl)',
          boxShadow: 'var(--shadow-3)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>Publicar questionário</h2>
          <button
            type="button"
            onClick={onClose}
            style={{
              marginLeft: 'auto',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 28,
              height: 28,
              borderRadius: 'var(--r)',
              border: 'none',
              background: 'transparent',
              color: 'var(--mu2)',
              cursor: 'pointer',
            }}
          >
            <X size={18} />
          </button>
        </div>

        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            padding: '10px 14px',
            borderRadius: 'var(--r)',
            background: 'var(--odim)',
            border: '1px solid var(--ok)',
            color: 'var(--ok)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          <CheckCircle size={18} weight="fill" />
          Questionário publicado com sucesso!
        </div>

        <div style={{ display: 'flex', gap: 8 }}>
          {(['link', 'share'] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTab(t)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '6px 14px',
                borderRadius: 'var(--r)',
                border: '1px solid transparent',
                background: tab === t ? 'var(--adim)' : 'transparent',
                color: tab === t ? 'var(--ac-hi)' : 'var(--mu2)',
                fontSize: 13,
                fontWeight: 500,
                cursor: 'pointer',
              }}
            >
              {t === 'link' ? <Link size={14} /> : <PaperPlaneRight size={14} />}
              {t === 'link' ? 'Link' : 'Distribuir'}
            </button>
          ))}
        </div>

        {tab === 'link' ? (
          <>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 6px 6px 12px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--gb)',
                background: 'var(--glass)',
              }}
            >
              <span
                style={{
                  flex: 1,
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  color: 'var(--mu2)',
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {surveyUrl}
              </span>
              <button
                type="button"
                onClick={() => void copy()}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '7px 12px',
                  borderRadius: 'var(--r)',
                  border: 'none',
                  background: copied ? 'var(--ok)' : 'var(--ac-grad)',
                  color: '#fff',
                  fontSize: 12,
                  fontWeight: 600,
                  cursor: 'pointer',
                }}
              >
                {copied ? <Check size={14} weight="bold" /> : <Copy size={14} />}
                {copied ? 'Copiado!' : 'Copiar'}
              </button>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
              <QRCodeSVG value={surveyUrl} size={160} bgColor="var(--surface)" fgColor="#e4e4ec" />
              <span style={{ fontSize: 12, color: 'var(--mu2)' }}>slug: /s/{slug}</span>
              <button
                type="button"
                onClick={() => window.open(surveyUrl, '_blank', 'noopener,noreferrer')}
                style={{
                  padding: '8px 16px',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--gb2)',
                  background: 'transparent',
                  color: 'var(--fg)',
                  fontSize: 13,
                  cursor: 'pointer',
                }}
              >
                Abrir em nova aba
              </button>
            </div>
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                padding: '6px 10px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--gb)',
                background: 'var(--glass)',
              }}
            >
              <MagnifyingGlass size={14} color="var(--mu2)" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Buscar por nome ou email"
                style={{
                  flex: 1,
                  border: 'none',
                  background: 'transparent',
                  color: 'var(--fg)',
                  fontSize: 13,
                  outline: 'none',
                }}
              />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', maxHeight: 240, overflowY: 'auto', gap: 4 }}>
              {filtered.length === 0 && (
                <span style={{ fontSize: 13, color: 'var(--mu2)', padding: 12, textAlign: 'center' }}>
                  Nenhum contato encontrado.
                </span>
              )}
              {filtered.map((c) => {
                const link = waLink(c, surveyUrl)
                return (
                  <label
                    key={c.id}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 10,
                      padding: '8px 10px',
                      borderRadius: 'var(--r)',
                      border: '1px solid var(--gb)',
                      background: 'var(--glass)',
                      fontSize: 13,
                      cursor: 'pointer',
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={selected.has(c.id)}
                      onChange={() => toggleContact(c.id)}
                      style={{ accentColor: 'var(--ac)' }}
                    />
                    <span style={{ flex: 1 }}>
                      <span style={{ display: 'block', fontWeight: 600 }}>{c.name}</span>
                      <span style={{ display: 'block', color: 'var(--mu2)', fontSize: 12 }}>
                        {c.email ?? (c.phone ? `+${c.phone}` : '')}
                      </span>
                    </span>
                    <button
                      type="button"
                      onClick={() => void copy()}
                      title="Copiar link"
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        width: 28,
                        height: 28,
                        borderRadius: 'var(--r)',
                        border: '1px solid var(--gb)',
                        background: 'transparent',
                        color: 'var(--mu2)',
                        cursor: 'pointer',
                      }}
                    >
                      <Copy size={14} />
                    </button>
                    {link && (
                      <a
                        href={link}
                        target="_blank"
                        rel="noopener noreferrer"
                        title="Enviar por WhatsApp"
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          width: 28,
                          height: 28,
                          borderRadius: 'var(--r)',
                          border: '1px solid var(--gb)',
                          color: 'var(--ok)',
                        }}
                      >
                        <WhatsappLogo size={14} weight="fill" />
                      </a>
                    )}
                  </label>
                )
              })}
            </div>
            <span style={{ fontSize: 12, color: 'var(--mu2)' }}>
              {selected.size} contato(s) selecionado(s)
            </span>
          </div>
        )}
      </div>
    </div>
  )
}
