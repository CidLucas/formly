import { useEffect, useRef, useState } from 'react'
import type { ChangeEvent } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { Download } from '@phosphor-icons/react'
import { surveys } from '../lib/api'
import type { DistributeResult } from '../lib/api'

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
  const [csv, setCsv] = useState<CsvFile | null>(null)
  const [manualInput, setManualInput] = useState('')
  const [manualEmails, setManualEmails] = useState<string[]>([])
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
        const survey = await surveys.get(id ?? '')
        setTitle(survey.title ?? 'Sem título')
      } catch {
        setFailed(true)
      } finally {
        setLoading(false)
      }
    })()
  }, [id, navigate])

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

  const addManualEmail = () => {
    const value = manualInput.trim()
    const ok = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value)
    if (!ok) {
      setError('Digite um e-mail válido (ex: nome@dominio.com)')
      return
    }
    setError('')
    if (!manualEmails.includes(value.toLowerCase())) {
      setManualEmails((prev) => [...prev, value.toLowerCase()])
    }
    setManualInput('')
  }

  const removeManualEmail = (email: string) => {
    setManualEmails((prev) => prev.filter((e) => e !== email))
  }

  const send = async () => {
    if (sending) return
    const csvEmails = csv?.emails ?? []
    if (manualEmails.length === 0 && csvEmails.length === 0) {
      setError('Adicione ao menos um e-mail (digite acima ou importe um CSV)')
      return
    }
    setError('')
    setResult(null)
    setSending(true)
    try {
      const res = await surveys.distribute(id ?? '', {
        contact_ids: [],
        emails: [...manualEmails, ...csvEmails],
        message,
        from_email: window.localStorage.getItem('formly_email') ?? undefined,
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
            <div className="section-label">Enviar por e-mail</div>
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                type="email"
                className="search"
                placeholder="nome@dominio.com"
                value={manualInput}
                onChange={(e) => setManualInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addManualEmail()
                  }
                }}
              />
              <button
                type="button"
                className="btn-sm"
                style={{ flexShrink: 0, alignSelf: 'center' }}
                onClick={addManualEmail}
              >
                + Adicionar
              </button>
            </div>
            {manualEmails.length > 0 && (
              <div
                style={{
                  display: 'flex',
                  flexWrap: 'wrap',
                  gap: 6,
                  marginTop: 10,
                }}
              >
                {manualEmails.map((email) => (
                  <span
                    key={email}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: 6,
                      padding: '4px 10px',
                      borderRadius: 'var(--r)',
                      background: 'var(--pine-soft)',
                      border: '1px solid var(--pine)',
                      color: 'var(--pine)',
                      fontFamily: 'var(--mono)',
                      fontSize: '.72rem',
                    }}
                  >
                    {email}
                    <button
                      type="button"
                      onClick={() => removeManualEmail(email)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: 'inherit',
                        cursor: 'pointer',
                        fontSize: '.8rem',
                        lineHeight: 1,
                        padding: 0,
                      }}
                      aria-label={`Remover ${email}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}

            <div className="divider">ou</div>

            <div style={{ marginBottom: 'var(--m)' }}>
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
            </div>

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
