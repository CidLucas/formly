import { useEffect, useMemo, useState } from 'react'
import type { ReactNode } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowClockwise,
  Check,
  CheckCircle,
  Copy,
  Download,
  LinkSimple,
  Microphone,
  Warning,
} from '@phosphor-icons/react'
import { contacts, surveys } from '../lib/api'
import type { Question } from '../lib/api'

interface Answer {
  question_id: string
  value_text: string | null
  value_choices: string[] | null
  scale_value: number | null
  audio_url: string | null
  transcription: string | null
  file_url: string | null
  file_name: string | null
}

interface ResponseItem {
  id: string
  status: string
  started_at: string | null
  completed_at: string | null
  time_spent_secs: number | null
  answers: Answer[]
}

interface StatsData {
  total_responses: number
  complete: number
  partial: number
  completion_rate: number
  audio_responses: number
  avg_scale: number | null
}

interface AnswerEntry {
  answer: Answer
}

function isAuthError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 401
}

function formatDuration(secs: number): string {
  if (secs < 60) return `${Math.round(secs)}s`
  return `${Math.round(secs / 60)}min`
}

function answerText(a: Answer): string {
  if (a.value_text && a.value_text.trim()) return a.value_text.trim()
  if (Array.isArray(a.value_choices) && a.value_choices.length) return a.value_choices.join(', ')
  if (a.scale_value != null) return String(a.scale_value)
  if (a.transcription && a.transcription.trim()) return a.transcription.trim()
  return ''
}

function asStrings(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === 'string') : []
}

/* ── Barra (analytics.html) ───────────────────────────────── */

function BarRow({ label, pct, animate, right }: { label: string; pct: number; animate: boolean; right?: ReactNode }) {
  const width = animate ? `${Math.min(100, Math.max(0, pct))}%` : '0%'
  return (
    <div className="bar-row">
      <span
        className="bar-label"
        style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
        title={label}
      >
        {label}
      </span>
      <div className="bar-track">
        <div className="bar-fill" style={{ width }} />
      </div>
      <span className="bar-val">{Math.round(pct)}%</span>
      {right}
    </div>
  )
}

function Bars({
  rows,
  answered,
  animate,
}: {
  rows: { label: string; count: number }[]
  answered: number
  animate: boolean
}) {
  if (rows.length === 0) {
    return (
      <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sem respostas para esta pergunta.</div>
    )
  }
  return (
    <div className="bar-list">
      {rows.map((r) => (
        <BarRow
          key={r.label}
          label={r.label}
          pct={answered > 0 ? (r.count / answered) * 100 : 0}
          animate={animate}
          right={
            <span className="mono" style={{ width: 64, color: 'var(--muted)', fontSize: '0.66rem' }}>
              {r.count}
            </span>
          }
        />
      ))}
    </div>
  )
}

/* ── Listas de texto / áudio ──────────────────────────────── */

function TextList({ items }: { items: string[] }) {
  const [expanded, setExpanded] = useState(false)
  if (items.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sem respostas de texto.</div>
  }
  const visible = expanded ? items : items.slice(0, 5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.map((text, i) => (
        <div
          key={i}
          style={{
            padding: '8px 12px',
            borderRadius: 'var(--r)',
            border: '1px solid var(--line)',
            background: 'var(--card)',
            fontSize: 13,
            whiteSpace: 'pre-line',
            wordBreak: 'break-word',
          }}
        >
          {text}
        </div>
      ))}
      {items.length > 5 && (
        <button
          type="button"
          className="btn-sm"
          style={{ alignSelf: 'flex-start' }}
          onClick={() => setExpanded((v) => !v)}
        >
          {expanded ? 'Ver menos' : `Ver mais (${items.length})`}
        </button>
      )}
    </div>
  )
}

function AudioList({ entries }: { entries: AnswerEntry[] }) {
  const items = entries.filter(
    (e) => Boolean(e.answer.transcription?.trim()) || Boolean(e.answer.audio_url),
  )
  if (items.length === 0) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sem respostas de áudio.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {items.map((e, i) => (
        <div
          key={i}
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 8,
            padding: '10px 12px',
            borderRadius: 'var(--r)',
            border: '1px solid var(--line)',
            background: 'var(--card)',
          }}
        >
          {e.answer.transcription?.trim() ? (
            <p style={{ fontSize: 13, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>
              {e.answer.transcription}
            </p>
          ) : (
            <span style={{ fontSize: 13, color: 'var(--muted)' }}>Áudio sem transcrição.</span>
          )}
          {e.answer.audio_url ? (
            <audio controls src={e.answer.audio_url} style={{ width: '100%' }} />
          ) : (
            <span
              style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 6,
                alignSelf: 'flex-start',
                padding: '4px 10px',
                borderRadius: 'var(--r)',
                background: 'var(--wine-soft)',
                border: '1px solid var(--line)',
                color: 'var(--wine)',
                fontSize: 12,
                fontWeight: 500,
              }}
            >
              <Microphone size={14} />
              Áudio (transcrição)
            </span>
          )}
        </div>
      ))}
    </div>
  )
}

/* ── Pergunta → gráfico ───────────────────────────────────── */

function QuestionSection({
  question,
  entries,
  animate,
}: {
  question: Question
  entries: AnswerEntry[]
  animate: boolean
}) {
  const config = question.config ?? {}

  if (question.type === 'multiple_choice') {
    const options = asStrings(config.options)
    const counts = new Map<string, number>()
    const extra = new Map<string, number>()
    for (const o of options) counts.set(o, 0)
    let answered = 0
    for (const { answer } of entries) {
      const choices = asStrings(answer.value_choices)
      if (choices.length > 0) {
        answered++
        let matched = false
        for (const c of choices) {
          if (counts.has(c)) {
            counts.set(c, (counts.get(c) ?? 0) + 1)
            matched = true
          }
        }
        if (!matched) extra.set('Outro', (extra.get('Outro') ?? 0) + 1)
      } else if (answer.value_text?.trim()) {
        answered++
        const t = answer.value_text.trim()
        if (counts.has(t)) counts.set(t, (counts.get(t) ?? 0) + 1)
        else extra.set('Outro', (extra.get('Outro') ?? 0) + 1)
      }
    }
    const rows: { label: string; count: number }[] = []
    counts.forEach((count, label) => rows.push({ label, count }))
    extra.forEach((count, label) => rows.push({ label, count }))
    rows.sort((a, b) => b.count - a.count)
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  if (question.type === 'scale' || question.type === 'nps') {
    const min = question.type === 'nps' ? Number(config.min) || 0 : Number(config.min) || 1
    const max = question.type === 'nps' ? Number(config.max) || 10 : Number(config.max) || 5
    const counts = new Map<number, number>()
    for (let v = min; v <= max; v++) counts.set(v, 0)
    let answered = 0
    for (const { answer } of entries) {
      if (answer.scale_value != null) {
        answered++
        counts.set(answer.scale_value, (counts.get(answer.scale_value) ?? 0) + 1)
      }
    }
    const rows: { label: string; count: number }[] = []
    counts.forEach((count, value) => rows.push({ label: String(value), count }))
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  if (question.type === 'ranking') {
    const options = asStrings(config.options)
    const counts = new Map<string, number>()
    let answered = 0
    for (const { answer } of entries) {
      const choices = asStrings(answer.value_choices)
      if (choices.length > 0) {
        answered++
        for (const c of choices) counts.set(c, (counts.get(c) ?? 0) + 1)
      }
    }
    const rows = options.map((o) => ({ label: o, count: counts.get(o) ?? 0 }))
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  if (question.type === 'matrix') {
    const rows = asStrings(config.rows)
    const rowCount = new Map<string, number>()
    let answered = 0
    for (const { answer } of entries) {
      const choices = asStrings(answer.value_choices)
      if (choices.length > 0) {
        answered++
        for (const sel of choices) {
          const idx = sel.indexOf(':')
          const row = idx === -1 ? sel : sel.slice(0, idx)
          if (rows.includes(row)) rowCount.set(row, (rowCount.get(row) ?? 0) + 1)
        }
      }
    }
    const barRows = rows.map((r) => ({ label: r, count: rowCount.get(r) ?? 0 }))
    return <Bars rows={barRows} answered={answered} animate={animate} />
  }

  if (question.type === 'audio') {
    return <AudioList entries={entries} />
  }

  const items = entries.map((e) => answerText(e.answer)).filter(Boolean)
  return <TextList items={items} />
}

/* ── Toast ────────────────────────────────────────────────── */

function Toast({ message, isError }: { message: string; isError: boolean }) {
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 300,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 16px',
        borderRadius: 'var(--rl)',
        border: `1px solid ${isError ? 'var(--wine)' : 'var(--pine)'}`,
        background: 'var(--card)',
        color: 'var(--ink)',
        fontSize: 13,
        boxShadow: 'var(--shadow-3)',
        maxWidth: '90vw',
      }}
    >
      {isError ? (
        <Warning size={16} weight="fill" color="var(--wine)" />
      ) : (
        <CheckCircle size={16} weight="fill" color="var(--pine)" />
      )}
      <span>{message}</span>
    </div>
  )
}

/* ── Página ───────────────────────────────────────────────── */

export default function Dashboard() {
  const { id } = useParams()
  const navigate = useNavigate()

  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [animate, setAnimate] = useState(false)
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null)

  const { data: survey, isLoading: surveyLoading, isError: surveyError, refetch: refetchSurvey } = useQuery<{
    title: string
    questions: Question[]
    slug?: string
  }>({
    queryKey: ['survey', id],
    queryFn: () => surveys.get(id ?? ''),
    enabled: Boolean(id),
  })
  const { data: stats, isLoading: statsLoading, isError: statsError, refetch: refetchStats } = useQuery<StatsData>({
    queryKey: ['survey-stats', id],
    queryFn: () => surveys.stats(id ?? ''),
    enabled: Boolean(id),
  })
  const {
    data: responsesData,
    isLoading: responsesLoading,
    isError: responsesError,
    refetch: refetchResponses,
  } = useQuery<{ data: ResponseItem[]; total: number }>({
    queryKey: ['survey-responses', id],
    queryFn: () => surveys.responses(id ?? '', 'per_page=200'),
    enabled: Boolean(id),
  })
  const { data: contactsData } = useQuery({
    queryKey: ['contacts'],
    queryFn: () => contacts.list(),
    retry: false,
  })

  const loading = surveyLoading || statsLoading || responsesLoading
  const failed = surveyError || statsError || responsesError

  useEffect(() => {
    if (loading || failed) return
    const t = window.setTimeout(() => setAnimate(true), 120)
    return () => window.clearTimeout(t)
  }, [loading, failed])

  const showToast = (message: string, isError = false) => setToast({ message, isError })

  useEffect(() => {
    if (!toast) return
    const t = window.setTimeout(() => setToast(null), 3000)
    return () => window.clearTimeout(t)
  }, [toast])

  const handleExport = async () => {
    if (!id || exporting) return
    setExporting(true)
    try {
      const blob = await surveys.exportCsv(id)
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `resultados-${id}.csv`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
      showToast('CSV exportado!')
    } catch (err) {
      if (isAuthError(err)) showToast('Token não configurado — faça login.', true)
      else showToast('Erro ao exportar CSV. Tente novamente.', true)
    } finally {
      setExporting(false)
    }
  }

  const responses = responsesData?.data ?? []
  const total = stats?.total_responses ?? responsesData?.total ?? 0
  const sentCount = contactsData?.length ?? 0

  const completionRate =
    stats?.completion_rate ??
    (responses.length > 0
      ? (responses.filter((r) => r.status === 'complete').length / responses.length) * 100
      : 0)

  const avgTime = useMemo(() => {
    const times = responses.map((r) => r.time_spent_secs).filter((v): v is number => v != null)
    if (times.length === 0) return null
    return times.reduce((s, v) => s + v, 0) / times.length
  }, [responses])

  const answersByQuestion = useMemo(() => {
    const map = new Map<string, AnswerEntry[]>()
    for (const r of responses) {
      for (const a of r.answers) {
        const list = map.get(a.question_id) ?? []
        list.push({ answer: a })
        map.set(a.question_id, list)
      }
    }
    return map
  }, [responses])

  const questions = survey?.questions ?? []
  const showEmpty = !loading && !failed && total === 0
  const publicUrl = survey?.slug ? `${window.location.origin}/s/${survey.slug}` : null

  const handleCopyLink = async () => {
    if (!publicUrl) return
    try {
      await navigator.clipboard.writeText(publicUrl)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1500)
      showToast('Link copiado!')
    } catch {
      showToast('Não foi possível copiar o link.', true)
    }
  }

  const retry = () => {
    void refetchSurvey()
    void refetchStats()
    void refetchResponses()
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div className="app">
        <button className="back" onClick={() => navigate(`/builder/${id ?? ''}`)}>
          ← Voltar
        </button>

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
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: 40,
              borderRadius: 'var(--rl)',
              border: '1px solid var(--wine)',
              background: 'var(--wine-soft)',
              textAlign: 'center',
              color: 'var(--wine)',
              fontSize: 13,
            }}
          >
            <Warning size={24} weight="fill" />
            <span>Não foi possível carregar os resultados.</span>
            <div style={{ display: 'flex', gap: 8 }}>
              <button type="button" className="btn-sm" onClick={retry}>
                <ArrowClockwise size={12} />
                Tentar novamente
              </button>
              <button type="button" className="btn-sm" onClick={() => navigate('/auth')}>
                Fazer login
              </button>
            </div>
          </div>
        ) : showEmpty ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 12,
              padding: '48px 24px',
              borderRadius: 'var(--rl)',
              border: '1.5px dashed var(--line)',
              background: 'var(--card)',
              textAlign: 'center',
            }}
          >
            <LinkSimple size={28} color="var(--muted)" />
            <div style={{ fontFamily: 'var(--display)', fontSize: 16, fontWeight: 600 }}>
              Nenhuma resposta ainda.
            </div>
            <p style={{ maxWidth: 420, color: 'var(--muted)', fontSize: 13 }}>
              Compartilhe o link para começar!
            </p>
            {publicUrl ? (
              <button type="button" className="btn-sm primary" onClick={() => void handleCopyLink()}>
                {copied ? <Check size={12} weight="bold" /> : <Copy size={12} />}
                {copied ? 'Link copiado!' : 'Copiar link público'}
              </button>
            ) : null}
          </div>
        ) : (
          <>
            <div className="header">
              <div className="header-title">{survey?.title ?? '…'}</div>
              <button className="export-btn" disabled={exporting} onClick={() => void handleExport()}>
                <Download size={14} />
                {exporting ? 'Gerando…' : 'Exportar CSV'}
              </button>
            </div>

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-value">{total}</div>
                <div className="kpi-label">Respostas</div>
                {sentCount > 0 ? <div className="kpi-sub">de {sentCount} enviados</div> : null}
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{Math.round(completionRate)}%</div>
                <div className="kpi-label">Taxa de resposta</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{avgTime != null ? formatDuration(avgTime) : '—'}</div>
                <div className="kpi-label">Tempo médio</div>
                <div className="kpi-sub">por resposta</div>
              </div>
            </div>

            <div>
              <div className="section-title">Respostas por pergunta</div>
              {questions.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma pergunta para exibir.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--l)' }}>
                  {questions.map((q) => (
                    <div key={q.id ?? q.title}>
                      <div className="section-title">{q.title || 'Sem título'}</div>
                      <QuestionSection
                        question={q}
                        entries={answersByQuestion.get(q.id ?? '') ?? []}
                        animate={animate}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      {toast ? <Toast message={toast.message} isError={toast.isError} /> : null}
    </div>
  )
}
