import { useEffect, useMemo, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Check, Download } from '@phosphor-icons/react'
import { contacts, surveys } from '../lib/api'
import type { Contact, DistributeResult } from '../lib/api'

const TOKEN_KEY = 'formly_token'

interface CsvFile {
  name: string
  emails: string[]
}

export default function Send() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [failed, setFailed] = useState(false)
  const [title, setTitle] = useState('…')
  const [list, setList] = useState<Contact[]>([])
  const [search, setSearch] = useState('')
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [csv, setCsv] = useState<CsvFile | null>(null)
  const [message, setMessage] = useState('')
  const [sending, setSending] = useState(false)
  const [error, setError] = useState('')
  const [result, setResult] = useState<DistributeResult | null>(null)

  const fileRef = useRef<HTMLInputElement | null>(null)

  useEffect(() => {
    if (!window.localStorage.getItem(TOKEN_KEY)) {
      navigate('/auth')
      return
    }
    void (async () => {
      try {
        const [survey, contactList] = await Promise.all([surveys.get(id ?? ''), contacts.list()])
        setTitle(survey.title ?? 'Sem título')
        setList(contactList)
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, navigate])

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase()
    if (!q) return list
    return list.filter(
      (c) =>
        (c.name ?? '').toLowerCase().includes(q) ||
        (c.email ?? '').toLowerCase().includes(q),
    )
  }, [list, search])

  const allSelected = list.length > 0 && list.every((c) => selected.has(c.id))

  const toggleContact = (c: Contact) => {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(c.id)) next.delete(c.id)
      else next.add(c.id)
      return next
    })
  }

  const toggleAll = () => {
    setSelected(allSelected ? new Set() : new Set(list.map((c) => c.id)))
  }

  const handleCsv = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const text = String(reader.result ?? '')
      const emails = text
        .split(/\r?\n/)
        .map((s) => s.trim())
        .filter((s) => s.length > 0 && s.includes('@'))
      setCsv({ name: file.name, emails })
    }
    reader.readAsText(file)
  }

  const send = async () => {
    if (sending) return
    const csvEmails = csv?.emails ?? []
    if (selected.size === 0 && csvEmails.length === 0) {
      setError('Selecione ao menos um contato ou importe um CSV')
      return
    }
    setError('')
    setResult(null)
    setSending(true)
    try {
      const res = await surveys.distribute(id ?? '', {
        contact_ids: [...selected],
        emails: csvEmails,
        message,
      })
      setResult(res)
      window.setTimeout(() => {
        navigate(`/dashboard/${id ?? ''}`)
      }, 1500)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Não foi possível enviar o questionário')
      setSending(false)
    }
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div className="app">
        <button className="back" onClick={() => navigate(`/builder/${id ?? ''}`)}>
          ← Voltar
        </button>

        <div className="title">Enviar: {title}</div>

        {loading ? (
          <div
            style={{
              padding: 48,
              textAlign: 'center',
              color: 'var(--muted)',
              fontSize: 13,
              fontStyle: 'italic',
            }}
          >
            Carregando…
          </div>
        ) : failed ? (
          <div
            style={{
              padding: 24,
              borderRadius: 'var(--rl)',
              border: '1px solid var(--line)',
              background: 'var(--card)',
              color: 'var(--muted)',
              fontSize: 14,
            }}
          >
            Não foi possível carregar o questionário.
            <div style={{ marginTop: 12 }}>
              <button type="button" className="btn-sm" onClick={() => navigate('/auth')}>
                Fazer login
              </button>
            </div>
          </div>
        ) : (
          <>
            <div className="section-label">Para quem?</div>
            <input
              type="text"
              className="search"
              placeholder="Buscar contatos..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            {list.length === 0 ? (
              <div
                style={{
                  marginTop: 16,
                  padding: 16,
                  borderRadius: 'var(--r)',
                  border: '1.5px dashed var(--line)',
                  background: 'var(--card)',
                  color: 'var(--muted)',
                  fontSize: 13,
                  textAlign: 'center',
                }}
              >
                Nenhum contato ainda — adicione via CSV ou API
              </div>
            ) : (
              <>
                <div className="select-all" onClick={toggleAll}>
                  <span className="check">
                    <Check size={10} weight="bold" />
                  </span>
                  <span>
                    {allSelected ? `Todos (${list.length})` : `Selecionados (${selected.size})`}
                  </span>
                </div>

                <div className="contact-list">
                  {filtered.map((c) => {
                    const isSel = selected.has(c.id)
                    return (
                      <div
                        key={c.id}
                        className={`contact ${isSel ? 'selected' : ''}`}
                        onClick={() => toggleContact(c)}
                      >
                        <span className="check">
                          {isSel ? <Check size={10} weight="bold" /> : null}
                        </span>
                        <span
                          style={{ minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                        >
                          {c.email ?? c.name}
                        </span>
                      </div>
                    )
                  })}
                  {filtered.length === 0 && search.trim() && (
                    <div style={{ padding: '8px 16px', color: 'var(--muted)', fontSize: 13, fontStyle: 'italic' }}>
                      Nenhum contato encontrado.
                    </div>
                  )}
                </div>
              </>
            )}

            <div className="divider">ou</div>

            <div
              className="csv-zone"
              onClick={() => fileRef.current?.click()}
              style={
                csv
                  ? { borderColor: 'var(--pine)', background: 'var(--pine-soft)', color: 'var(--pine)' }
                  : undefined
              }
            >
              <Download size={16} />
              <span>
                {csv
                  ? `${csv.name} · ${csv.emails.length} contatos detectados`
                  : 'Subir arquivo com e-mails (um por linha)'}
              </span>
            </div>
            <input
              ref={fileRef}
              type="file"
              accept=".csv,text/csv"
              style={{ display: 'none' }}
              onChange={handleCsv}
            />

            <div style={{ marginTop: 'var(--l)' }}>
              <div className="section-label">Mensagem opcional</div>
              <textarea
                className="msg-textarea"
                placeholder="Olá! Sua opinião é importante..."
                value={message}
                onChange={(e) => setMessage(e.target.value)}
              />
            </div>

            <button className="btn-send" disabled={sending} onClick={() => void send()}>
              {sending ? 'Enviando...' : 'Enviar questionário →'}
            </button>

            {error && (
              <div
                style={{
                  marginTop: 'var(--l)',
                  padding: '12px 16px',
                  borderRadius: 'var(--r)',
                  border: '1px solid #e5b3b3',
                  background: '#fdf0f0',
                  color: '#b33434',
                  fontSize: 13,
                }}
              >
                {error}
              </div>
            )}

            {result && result.mode === 'simulated' && result.public_link && (
              <div
                style={{
                  marginTop: 'var(--l)',
                  padding: '16px',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--pine)',
                  background: 'var(--pine-soft)',
                  color: 'var(--pine)',
                  fontSize: 13,
                }}
              >
                <div style={{ fontWeight: 700, marginBottom: 6 }}>
                  E-mail simulado (sem provedor configurado).
                </div>
                <div style={{ marginBottom: 8 }}>
                  Compartilhe o link público como alternativa:
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <code
                    style={{
                      flex: 1,
                      padding: '8px 12px',
                      background: 'var(--card)',
                      border: '1px solid var(--line)',
                      borderRadius: 'var(--r)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}
                  >
                    {`${window.location.origin}${result.public_link}`}
                  </code>
                  <button
                    type="button"
                    className="btn-sm"
                    onClick={() =>
                      void navigator.clipboard
                        .writeText(`${window.location.origin}${result.public_link ?? ''}`)
                        .catch(() => {})
                    }
                  >
                    Copiar
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  )
}
