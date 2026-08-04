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
  avg_time_secs?: number | null
  response_rate?: number | null
  nps?: { score: number | null; promoters: number; passives: number; detractors: number; n: number } | null
  csat?: { pct_top: number | null; scale: number; n: number } | null
  ces?: { pct_top: number | null; scale: number; n: number } | null
  by_question?: QuestionStats[] | null
  low_n_warning?: boolean
}

interface QuestionStats {
  question_id: string
  type: string
  title: string
  n: number
  distribution: Record<string, number> | null
  avg: number | null
  nps_score?: number | null
  top2_pct?: number | null
  open_text_samples?: string[]
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

function BarRow({
  label,
  pct,
  animate,
  right,
  fillColor,
}: {
  label: string
  pct: number
  animate: boolean
  right?: ReactNode
  fillColor?: string
}) {
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
        <div className="bar-fill" style={{ width, ...(fillColor ? { background: fillColor } : {}) }} />
      </div>
      <span className="bar-val">{Math.round(pct)}%</span>
      {right}
    </div>
  )
}

function npsScoreColor(score: number): string {
  if (score >= 50) return 'var(--ok)'
  if (score >= 0) return 'var(--wine)'
  return 'var(--urg)'
}

function LowNBadge() {
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        padding: '2px 8px',
        borderRadius: 'var(--r)',
        background: 'color-mix(in srgb, var(--urg) 10%, transparent)',
        border: '1px solid var(--urg)',
        color: 'var(--urg)',
        fontSize: 10.5,
        fontWeight: 600,
        letterSpacing: 0.3,
        textTransform: 'uppercase',
        verticalAlign: 'middle',
      }}
    >
      <Warning size={11} weight="fill" />
      dados insuficientes
    </span>
  )
}

function MatrixHeatmap({
  distribution,
  rows,
  cols,
}: {
  distribution: Record<string, number>
  rows: string[]
  cols: string[]
}) {
  const maxCount = Math.max(1, ...Object.values(distribution))
  return (
    <div className="matrix-wrap">
      <table className="matrix">
        <thead>
          <tr>
            <th />
            {cols.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r}>
              <td style={{ fontWeight: 600 }}>{r}</td>
              {cols.map((c) => {
                const count = distribution[`${r}:${c}`] ?? 0
                const intensity = count / maxCount
                return (
                  <td
                    key={c}
                    style={{
                      background:
                        count > 0
                          ? `color-mix(in srgb, var(--wine) ${Math.round(intensity * 60)}%, var(--card))`
                          : 'transparent',
                      color: count > 0 ? (intensity > 0.45 ? '#fff' : 'var(--ink)') : 'var(--muted)',
                      fontSize: 13,
                    }}
                  >
                    {count > 0 ? count : '·'}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

function RankingOrder({ options, entries }: { options: string[]; entries: AnswerEntry[] }) {
  const sum = new Map<string, number>()
  const count = new Map<string, number>()
  for (const { answer } of entries) {
    const choices = asStrings(answer.value_choices)
    if (choices.length === 0) continue
    choices.forEach((c, i) => {
      sum.set(c, (sum.get(c) ?? 0) + i)
      count.set(c, (count.get(c) ?? 0) + 1)
    })
  }
  const rows = options
    .map((o) => {
      const c = count.get(o) ?? 0
      return { label: o, avg: c > 0 ? (sum.get(o) ?? 0) / c + 1 : null, count: c }
    })
    .sort((a, b) => {
      if (a.avg == null && b.avg == null) return 0
      if (a.avg == null) return 1
      if (b.avg == null) return -1
      return a.avg - b.avg
    })
  if (rows.every((r) => r.count === 0)) {
    return <div style={{ color: 'var(--muted)', fontSize: 13 }}>Sem respostas para esta pergunta.</div>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {rows.map((r, i) => (
        <div
          key={r.label}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '8px 12px',
            borderRadius: 'var(--r)',
            border: '1px solid var(--line)',
            background: 'var(--card)',
          }}
        >
          <span className="rank-num">{i + 1}</span>
          <span
            style={{ flex: 1, fontSize: 13, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
            title={r.label}
          >
            {r.label}
          </span>
          <span className="mono" style={{ color: 'var(--muted)', fontSize: '0.66rem' }}>
            {r.avg != null ? `pos. média ${r.avg.toFixed(1)}` : 'sem ranking'} · n={r.count}
          </span>
        </div>
      ))}
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
  stats,
}: {
  question: Question
  entries: AnswerEntry[]
  animate: boolean
  stats?: QuestionStats
}) {
  const config = question.config ?? {}

  // NPS — barras 0-10 com corte promotores/neutros/detratores
  if (question.type === 'nps') {
    if (stats?.distribution) {
      const rows = Object.entries(stats.distribution)
        .map(([k, v]) => ({ value: Number(k), count: v }))
        .sort((a, b) => a.value - b.value)
      return (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              marginBottom: 8,
              fontSize: 12.5,
              color: 'var(--muted)',
            }}
          >
            {stats.nps_score != null ? (
              <span>
                NPS{' '}
                <strong style={{ color: npsScoreColor(stats.nps_score), fontSize: 16 }}>{stats.nps_score}</strong>
              </span>
            ) : null}
            <span>média {stats.avg ?? '—'}</span>
            <span>n={stats.n}</span>
          </div>
          <div className="bar-list">
            {rows.map(({ value, count }) => (
              <BarRow
                key={value}
                label={String(value)}
                pct={stats.n > 0 ? (count / stats.n) * 100 : 0}
                animate={animate}
                fillColor={value <= 6 ? 'var(--urg)' : value <= 8 ? 'var(--muted)' : 'var(--ok)'}
                right={
                  <span className="mono" style={{ width: 64, color: 'var(--muted)', fontSize: '0.66rem' }}>
                    {count}
                  </span>
                }
              />
            ))}
          </div>
          <div style={{ display: 'flex', gap: 12, marginTop: 8, fontSize: 11.5, color: 'var(--muted)' }}>
            <span>
              <span style={{ color: 'var(--urg)' }}>■</span> Detratores 0-6
            </span>
            <span>
              <span style={{ color: 'var(--muted)' }}>■</span> Neutros 7-8
            </span>
            <span>
              <span style={{ color: 'var(--ok)' }}>■</span> Promotores 9-10
            </span>
          </div>
        </>
      )
    }
    const min = Number(config.min) || 0
    const max = Number(config.max) || 10
    const counts = new Map<number, number>()
    for (let v = min; v <= max; v++) counts.set(v, 0)
    let answered = 0
    for (const { answer } of entries) {
      if (answer.scale_value != null) {
        answered++
        counts.set(answer.scale_value, (counts.get(answer.scale_value) ?? 0) + 1)
      }
    }
    const rows = [...counts.entries()].map(([value, count]) => ({ label: String(value), count }))
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  // Scale — distribuição completa
  if (question.type === 'scale') {
    if (stats?.distribution) {
      const rows = Object.entries(stats.distribution)
        .map(([k, v]) => ({ label: k, count: v }))
        .sort((a, b) => Number(a.label) - Number(b.label))
      return (
        <>
          <div
            style={{
              display: 'flex',
              gap: 12,
              alignItems: 'baseline',
              marginBottom: 8,
              fontSize: 12.5,
              color: 'var(--muted)',
            }}
          >
            <span>
              média <strong style={{ color: 'var(--ink)' }}>{stats.avg ?? '—'}</strong>
            </span>
            {stats.top2_pct != null ? (
              <span>
                top 2 <strong style={{ color: 'var(--ink)' }}>{Math.round(stats.top2_pct * 100)}%</strong>
              </span>
            ) : null}
            <span>n={stats.n}</span>
          </div>
          <Bars rows={rows} answered={stats.n} animate={animate} />
        </>
      )
    }
    const min = Number(config.min) || 1
    const max = Number(config.max) || 5
    const counts = new Map<number, number>()
    for (let v = min; v <= max; v++) counts.set(v, 0)
    let answered = 0
    for (const { answer } of entries) {
      if (answer.scale_value != null) {
        answered++
        counts.set(answer.scale_value, (counts.get(answer.scale_value) ?? 0) + 1)
      }
    }
    const rows = [...counts.entries()].map(([value, count]) => ({ label: String(value), count }))
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  // Matrix — heatmap linhas × colunas
  if (question.type === 'matrix') {
    const rows = asStrings(config.rows)
    const cols = asStrings(config.columns)
    if (stats?.distribution && rows.length > 0 && cols.length > 0) {
      return <MatrixHeatmap distribution={stats.distribution} rows={rows} cols={cols} />
    }
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

  // Ranking — ordem média dos itens
  if (question.type === 'ranking') {
    return <RankingOrder options={asStrings(config.options)} entries={entries} />
  }

  // dyn_list — frequência por item
  if (question.type === 'dyn_list') {
    const counts = new Map<string, number>()
    let answered = 0
    for (const { answer } of entries) {
      const choices = asStrings(answer.value_choices)
      if (choices.length > 0) {
        answered++
        for (const c of choices) counts.set(c, (counts.get(c) ?? 0) + 1)
      }
    }
    const rows = [...counts.entries()]
      .map(([label, count]) => ({ label, count }))
      .sort((a, b) => b.count - a.count)
    return <Bars rows={rows} answered={answered} animate={animate} />
  }

  // Múltipla escolha
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

  // Áudio
  if (question.type === 'audio') {
    return <AudioList entries={entries} />
  }

  // Texto curto / longo — contagem + amostra de citações
  if (question.type === 'text_short' || question.type === 'text_long') {
    const samples =
      stats?.open_text_samples ?? entries.map((e) => answerText(e.answer)).filter((t) => t.trim().length > 0)
    return (
      <>
        <div style={{ fontSize: 12.5, color: 'var(--muted)', marginBottom: 8 }}>
          {stats?.n ?? entries.length} resposta{stats && stats.n !== 1 ? 's' : ''} de texto
        </div>
        <TextList items={samples} />
      </>
    )
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

  const avgTimeDisplay = stats?.avg_time_secs ?? avgTime

  const statsByQuestion = useMemo(() => {
    const map = new Map<string, QuestionStats>()
    for (const q of stats?.by_question ?? []) {
      if (q.question_id) map.set(q.question_id, q)
    }
    return map
  }, [stats])

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

            {stats?.low_n_warning ? (
              <div
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  padding: '10px 14px',
                  borderRadius: 'var(--r)',
                  border: '1px solid var(--urg)',
                  background: 'color-mix(in srgb, var(--urg) 8%, var(--card))',
                  color: 'var(--urg)',
                  fontSize: 12.5,
                  marginBottom: 'var(--l)',
                }}
              >
                <Warning size={16} weight="fill" />
                <span>
                  Algumas métricas têm N abaixo de 30 — os números indicam direção, não significância estatística.
                </span>
              </div>
            ) : null}

            <div className="kpi-grid">
              <div className="kpi-card">
                <div className="kpi-value">{total}</div>
                <div className="kpi-label">Respostas</div>
                {sentCount > 0 ? <div className="kpi-sub">de {sentCount} enviados</div> : null}
                {stats?.response_rate != null ? (
                  <div className="kpi-sub">taxa de resposta {Math.round(stats.response_rate * 100)}%</div>
                ) : null}
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{Math.round(completionRate)}%</div>
                <div className="kpi-label">Taxa de resposta</div>
              </div>
              <div className="kpi-card">
                <div className="kpi-value">{avgTimeDisplay != null ? formatDuration(avgTimeDisplay) : '—'}</div>
                <div className="kpi-label">Tempo médio</div>
                <div className="kpi-sub">por resposta</div>
              </div>
              {stats?.nps && stats.nps.score != null ? (
                <div className="kpi-card">
                  <div className="kpi-value" style={{ color: npsScoreColor(stats.nps.score) }}>
                    {stats.nps.score}
                  </div>
                  <div className="kpi-label">NPS</div>
                  <div className="kpi-sub">
                    P {stats.nps.promoters} · N {stats.nps.passives} · D {stats.nps.detractors} · n={stats.nps.n}
                  </div>
                </div>
              ) : null}
              {stats?.csat ? (
                <div className="kpi-card">
                  <div className="kpi-value">
                    {stats.csat.pct_top != null ? `${Math.round(stats.csat.pct_top * 100)}%` : '—'}
                  </div>
                  <div className="kpi-label">CSAT</div>
                  <div className="kpi-sub">
                    escala {stats.csat.scale} · n={stats.csat.n}
                  </div>
                </div>
              ) : null}
              {stats?.ces ? (
                <div className="kpi-card">
                  <div className="kpi-value">
                    {stats.ces.pct_top != null ? `${Math.round(stats.ces.pct_top * 100)}%` : '—'}
                  </div>
                  <div className="kpi-label">CES</div>
                  <div className="kpi-sub">
                    escala {stats.ces.scale} · n={stats.ces.n}
                  </div>
                </div>
              ) : null}
            </div>

            <div>
              <div className="section-title">Respostas por pergunta</div>
              {questions.length === 0 ? (
                <div style={{ color: 'var(--muted)', fontSize: 13 }}>Nenhuma pergunta para exibir.</div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--l)' }}>
                  {questions.map((q) => {
                    const qstats = statsByQuestion.get(q.id ?? '')
                    return (
                      <div key={q.id ?? q.title}>
                        <div className="section-title">
                          {q.title || 'Sem título'}{' '}
                          {qstats && qstats.n < 30 ? <LowNBadge /> : null}
                        </div>
                        <QuestionSection
                          question={q}
                          entries={answersByQuestion.get(q.id ?? '') ?? []}
                          animate={animate}
                          stats={qstats}
                        />
                      </div>
                    )
                  })}
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
