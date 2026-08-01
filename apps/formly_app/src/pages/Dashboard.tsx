import { useMemo, useRef, useState } from 'react'
import type { CSSProperties, ReactNode } from 'react'
import { Link, useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import {
  ArrowClockwise,
  CaretLeft,
  ChartBar,
  CheckCircle,
  Copy,
  Download,
  LinkSimple,
  Microphone,
  Warning,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import { surveys } from '../lib/api'
import type { Question, SurveyData } from '../lib/api'

type Period = '7d' | '30d' | '90d' | 'all'

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

interface Kpis {
  total_responses: number
  completion_rate: number
  audio_responses: number
  avg_scale: number | null
}

interface AnswerEntry {
  answer: Answer
  completedAt: string | null
}

const CHART_COLORS = ['var(--ac)', 'var(--teal)', 'var(--att)', 'var(--urg)', '#3b82f6']

const PERIOD_OPTIONS: { value: Period; label: string; days: number | null }[] = [
  { value: '7d', label: 'Últimos 7 dias', days: 7 },
  { value: '30d', label: 'Últimos 30 dias', days: 30 },
  { value: '90d', label: 'Últimos 90 dias', days: 90 },
  { value: 'all', label: 'Todo o período', days: null },
]

function isAuthError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 401
}

function computeKpis(responses: ResponseItem[]): Kpis {
  let complete = 0
  let audio = 0
  let scaleSum = 0
  let scaleCount = 0
  for (const r of responses) {
    if (r.status === 'complete') complete++
    for (const a of r.answers) {
      if (a.audio_url) audio++
      if (a.scale_value != null) {
        scaleSum += a.scale_value
        scaleCount++
      }
    }
  }
  const total = responses.length
  return {
    total_responses: total,
    completion_rate: total > 0 ? Math.round((complete / total) * 1000) / 10 : 0,
    audio_responses: audio,
    avg_scale: scaleCount > 0 ? Math.round((scaleSum / scaleCount) * 100) / 100 : null,
  }
}

function inPeriod(dateStr: string | null, days: number | null): boolean {
  if (days === null || !dateStr) return true
  const t = new Date(dateStr).getTime()
  if (Number.isNaN(t)) return true
  return t >= Date.now() - days * 24 * 60 * 60 * 1000
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return ''
  const d = new Date(dateStr)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString('pt-BR', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid var(--gb2)',
        borderTopColor: 'var(--ac)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

function KpiCard({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div
      style={{
        flex: '1 1 160px',
        padding: 18,
        borderRadius: 'var(--rl)',
        border: '1px solid var(--gb)',
        background: 'var(--surface)',
      }}
    >
      <div style={{ fontSize: 12, color: 'var(--mu2)', fontWeight: 500 }}>{label}</div>
      <div
        style={{
          marginTop: 6,
          fontFamily: 'var(--font-mono)',
          fontSize: 28,
          fontWeight: 600,
          fontVariantNumeric: 'tabular-nums',
          letterSpacing: '-0.02em',
        }}
      >
        {value}
      </div>
      {sub ? <div style={{ marginTop: 2, fontSize: 11, color: 'var(--mu)' }}>{sub}</div> : null}
    </div>
  )
}

function BarRow({ label, count, pct, color, right }: { label: string; count: number; pct: number; color: string; right?: ReactNode }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
        <span style={{ color: 'var(--fg)', flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{label}</span>
        {right ?? (
          <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--mu2)', fontSize: 12, whiteSpace: 'nowrap' }}>
            {count} · {pct.toFixed(0)}%
          </span>
        )}
      </div>
      <div style={{ height: 8, borderRadius: 4, background: 'var(--gb)', overflow: 'hidden' }}>
        <div
          style={{
            height: '100%',
            width: `${pct}%`,
            background: color,
            borderRadius: 4,
            transition: 'width 0.3s ease',
          }}
        />
      </div>
    </div>
  )
}

function TextList({ items }: { items: { text: string; date: string | null }[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? items : items.slice(0, 5)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {visible.length === 0 ? (
        <span style={{ fontSize: 13, color: 'var(--mu)' }}>Sem respostas de texto.</span>
      ) : (
        visible.map((it, i) => (
          <div
            key={i}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              padding: '8px 12px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--gb)',
              background: 'var(--surface)',
            }}
          >
            <span style={{ fontSize: 13, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{it.text}</span>
            {it.date ? (
              <span style={{ fontSize: 11, color: 'var(--mu)' }}>{formatDate(it.date)}</span>
            ) : null}
          </div>
        ))
      )}
      {items.length > 5 && (
        <button
          type="button"
          onClick={() => setExpanded((v) => !v)}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 12px',
            borderRadius: 'var(--r)',
            border: '1px solid var(--gb2)',
            background: 'transparent',
            color: 'var(--ac-hi)',
            fontSize: 13,
            cursor: 'pointer',
          }}
        >
          {expanded ? 'Ver menos' : `Ver mais (${items.length})`}
        </button>
      )}
    </div>
  )
}

function QuestionChart({ question, entries }: { question: Question; entries: AnswerEntry[] }) {
  const config = question.config ?? {}

  if (question.type === 'multiple_choice') {
    const options: string[] = Array.isArray(config.options) ? config.options.filter((o): o is string => typeof o === 'string') : []
    const counts = new Map<string, number>()
    for (const opt of options) counts.set(opt, 0)
    let total = 0
    let otherCount = 0
    for (const { answer } of entries) {
      const choices: string[] = Array.isArray(answer.value_choices) ? answer.value_choices : []
      if (!choices.length) continue
      total++
      let matchedAny = false
      for (const c of choices) {
        if (counts.has(c)) {
          counts.set(c, (counts.get(c) ?? 0) + 1)
          matchedAny = true
        }
      }
      if (!matchedAny) otherCount++
    }
    const rows: { label: string; count: number; pct: number }[] = []
    counts.forEach((count, label) => rows.push({ label, count, pct: total > 0 ? (count / total) * 100 : 0 }))
    if (otherCount > 0) rows.push({ label: 'Outro', count: otherCount, pct: total > 0 ? (otherCount / total) * 100 : 0 })
    rows.sort((a, b) => b.count - a.count)

    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 ? (
          <span style={{ fontSize: 13, color: 'var(--mu)' }}>Sem respostas para esta pergunta.</span>
        ) : (
          rows.map((row, i) => (
            <BarRow
              key={row.label}
              label={row.label}
              count={row.count}
              pct={row.pct}
              color={CHART_COLORS[i % CHART_COLORS.length]}
            />
          ))
        )}
        <span style={{ fontSize: 11, color: 'var(--mu)' }}>{total === 1 ? '1 resposta' : `${total} respostas`}</span>
      </div>
    )
  }

  if (question.type === 'scale') {
    const min = Number(config.min) || 1
    const max = Number(config.max) || 5
    const values: number[] = []
    for (let v = min; v <= max; v++) values.push(v)
    const counts = values.map((v) => ({ value: v, count: entries.filter((e) => e.answer.scale_value === v).length }))
    const total = counts.reduce((s, c) => s + c.count, 0)
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {counts.map((c) => (
          <BarRow
            key={c.value}
            label={`${c.value}`}
            count={c.count}
            pct={total > 0 ? (c.count / total) * 100 : 0}
            color="var(--ac)"
            right={
              <span style={{ fontFamily: 'var(--font-mono)', fontVariantNumeric: 'tabular-nums', color: 'var(--mu2)', fontSize: 12, whiteSpace: 'nowrap' }}>
                {c.count} respostas
              </span>
            }
          />
        ))}
      </div>
    )
  }

  if (question.type === 'text_short' || question.type === 'text_long') {
    const items = entries
      .map((e) => ({ text: (e.answer.value_text ?? '').trim(), date: e.completedAt }))
      .filter((i) => Boolean(i.text))
    return <TextList items={items} />
  }

  if (question.type === 'audio') {
    const items = entries.filter(
      (e) => Boolean(e.answer.transcription?.trim()) || Boolean(e.answer.audio_url),
    )
    if (items.length === 0) {
      return <span style={{ fontSize: 13, color: 'var(--mu)' }}>Sem respostas de áudio.</span>
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
              border: '1px solid var(--gb)',
              background: 'var(--surface)',
            }}
          >
            {e.answer.transcription?.trim() ? (
              <p style={{ fontSize: 13, whiteSpace: 'pre-line', wordBreak: 'break-word' }}>{e.answer.transcription}</p>
            ) : (
              <span style={{ fontSize: 13, color: 'var(--mu)' }}>Áudio sem transcrição.</span>
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
                  background: 'var(--adim)',
                  border: '1px solid var(--gb)',
                  color: 'var(--ac-hi)',
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

  return null
}

function LoadingSkeleton() {
  const skeleton: CSSProperties = {
    height: 12,
    borderRadius: 6,
    background: 'var(--gb)',
    animation: 'skeleton-pulse 1.4s ease-in-out infinite',
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            style={{
              flex: '1 1 160px',
              padding: 18,
              borderRadius: 'var(--rl)',
              border: '1px solid var(--gb)',
              background: 'var(--surface)',
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            <div style={{ ...skeleton, width: '60%' }} />
            <div style={{ ...skeleton, width: '40%', height: 22 }} />
          </div>
        ))}
      </div>
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          style={{
            padding: 18,
            borderRadius: 'var(--rl)',
            border: '1px solid var(--gb)',
            background: 'var(--glass)',
            display: 'flex',
            flexDirection: 'column',
            gap: 12,
          }}
        >
          <div style={{ ...skeleton, width: '50%' }} />
          <div style={{ ...skeleton }} />
          <div style={{ ...skeleton, width: '80%' }} />
        </div>
      ))}
    </div>
  )
}

const ghostBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--gb2)',
  background: 'transparent',
  color: 'var(--mu2)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
}

const primaryBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  borderRadius: 'var(--r)',
  border: 'none',
  background: 'var(--ac-grad)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
}

export default function Dashboard() {
  const { id } = useParams()
  const [period, setPeriod] = useState<Period>('all')
  const [exporting, setExporting] = useState(false)
  const [copied, setCopied] = useState(false)
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null)
  const toastTimerRef = useRef<number | null>(null)

  const { data: survey, isLoading: surveyLoading, isError: surveyError, refetch: refetchSurvey } = useQuery<SurveyData>({
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
  } = useQuery<{ data: ResponseItem[]; total: number; page: number; per_page: number }>({
    queryKey: ['survey-responses', id],
    queryFn: () => surveys.responses(id ?? '', 'per_page=200'),
    enabled: Boolean(id),
  })

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError })
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

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
      if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
      else showToast('Erro ao exportar CSV. Tente novamente.', true)
    } finally {
      setExporting(false)
    }
  }

  const days = PERIOD_OPTIONS.find((o) => o.value === period)?.days ?? null

  const filteredResponses = useMemo(() => {
    if (!responsesData) return []
    if (days === null) return responsesData.data
    return responsesData.data.filter((r) => inPeriod(r.completed_at ?? r.started_at, days))
  }, [responsesData, days])

  const computed = useMemo(() => computeKpis(filteredResponses), [filteredResponses])

  const kpis: Kpis =
    period === 'all' && stats
      ? {
          total_responses: stats.total_responses,
          completion_rate: stats.completion_rate,
          audio_responses: stats.audio_responses,
          avg_scale: stats.avg_scale,
        }
      : computed

  const answersByQuestion = useMemo(() => {
    const map = new Map<string, AnswerEntry[]>()
    for (const r of filteredResponses) {
      for (const a of r.answers) {
        const list = map.get(a.question_id) ?? []
        list.push({ answer: a, completedAt: r.completed_at })
        map.set(a.question_id, list)
      }
    }
    return map
  }, [filteredResponses])

  const maxScale = useMemo(() => {
    let m = 5
    for (const q of survey?.questions ?? []) {
      if (q.type === 'scale') {
        const mx = Number(q.config?.max)
        if (Number.isFinite(mx) && mx > m) m = mx
      }
    }
    return m
  }, [survey])

  const chartQuestions = useMemo(
    () =>
      (survey?.questions ?? []).filter((q) =>
        ['multiple_choice', 'scale', 'text_short', 'text_long', 'audio'].includes(q.type),
      ),
    [survey],
  )

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

  if (!id) {
    return (
      <Shell>
        <div style={{ padding: 60, textAlign: 'center', color: 'var(--mu2)', fontSize: 13 }}>
          Selecione um questionário para ver os resultados.
        </div>
      </Shell>
    )
  }

  const loading = surveyLoading || statsLoading || responsesLoading
  const failed = surveyError || statsError || responsesError
  const total = responsesData?.total ?? 0
  const showEmpty = !loading && !failed && total === 0

  return (
    <Shell>
      <style>{`@keyframes skeleton-pulse { 0%, 100% { opacity: 1 } 50% { opacity: 0.4 } }`}</style>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <Link
            to="/"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              fontSize: 13,
              fontWeight: 500,
              color: 'var(--mu2)',
            }}
          >
            <CaretLeft size={16} />
            Voltar
          </Link>
          <h1
            style={{
              flex: 1,
              minWidth: 180,
              fontSize: 18,
              fontWeight: 700,
              letterSpacing: '-0.02em',
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
            }}
          >
            Resultados: {survey?.title ?? '…'}
          </h1>
          <select
            value={period}
            onChange={(e) => setPeriod(e.target.value as Period)}
            style={{
              padding: '8px 10px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--gb2)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontSize: 13,
              outline: 'none',
            }}
          >
            {PERIOD_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => void handleExport()}
            disabled={exporting}
            style={{
              ...primaryBtn,
              ...(exporting ? { opacity: 0.6, cursor: 'default' } : {}),
            }}
          >
            {exporting ? <Spinner size={13} /> : <Download size={14} />}
            {exporting ? 'Gerando…' : 'Exportar CSV'}
          </button>
        </div>

        {loading ? (
          <LoadingSkeleton />
        ) : failed ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '40px 24px',
              borderRadius: 'var(--rl)',
              border: '1px solid var(--att)',
              background: 'var(--adm2)',
              textAlign: 'center',
              color: 'var(--att)',
              fontSize: 13,
            }}
          >
            <Warning size={24} weight="fill" />
            <span>Não foi possível carregar os resultados.</span>
            <button type="button" onClick={retry} style={ghostBtn}>
              <ArrowClockwise size={14} />
              Tentar novamente
            </button>
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
              border: '1px dashed var(--gb2)',
              background: 'var(--glass)',
              textAlign: 'center',
            }}
          >
            <LinkSimple size={28} color="var(--mu)" />
            <h2 style={{ fontSize: 16, fontWeight: 700 }}>Nenhuma resposta ainda.</h2>
            <p style={{ maxWidth: 420, color: 'var(--mu2)', fontSize: 13 }}>
              Compartilhe o link para começar a coletar respostas.
            </p>
            {publicUrl && (
              <button type="button" onClick={() => void handleCopyLink()} style={primaryBtn}>
                {copied ? <CheckCircle size={14} weight="fill" /> : <Copy size={14} />}
                {copied ? 'Link copiado!' : 'Copiar link público'}
              </button>
            )}
          </div>
        ) : (
          <>
            <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
              <KpiCard label="Respostas" value={String(kpis.total_responses)} />
              <KpiCard label="Conclusão" value={`${Math.round(kpis.completion_rate)}%`} sub="respostas completas" />
              <KpiCard label="Áudios" value={String(kpis.audio_responses)} />
              <KpiCard
                label="Nota média"
                value={kpis.avg_scale != null ? `${kpis.avg_scale.toFixed(1)}/${maxScale}` : '—'}
              />
            </div>

            {filteredResponses.length === 0 ? (
              <div
                style={{
                  padding: 24,
                  borderRadius: 'var(--rl)',
                  border: '1px solid var(--gb)',
                  background: 'var(--glass)',
                  textAlign: 'center',
                  color: 'var(--mu2)',
                  fontSize: 13,
                }}
              >
                Sem respostas no período selecionado.
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <ChartBar size={16} color="var(--ac-hi)" />
                  <h2 style={{ fontSize: 14, fontWeight: 600 }}>Gráficos por pergunta</h2>
                </div>
                {chartQuestions.length === 0 ? (
                  <div
                    style={{
                      padding: 20,
                      borderRadius: 'var(--rl)',
                      border: '1px solid var(--gb)',
                      background: 'var(--glass)',
                      textAlign: 'center',
                      color: 'var(--mu2)',
                      fontSize: 13,
                    }}
                  >
                    Nenhuma pergunta com gráfico para exibir.
                  </div>
                ) : (
                  chartQuestions.map((q, idx) => {
                    const entries = answersByQuestion.get(q.id ?? '') ?? []
                    return (
                      <div
                        key={q.id ?? idx}
                        style={{
                          display: 'flex',
                          flexDirection: 'column',
                          gap: 12,
                          padding: 18,
                          borderRadius: 'var(--rl)',
                          border: '1px solid var(--gb)',
                          background: 'var(--glass)',
                        }}
                      >
                        <h3 style={{ fontSize: 14, fontWeight: 600 }}>{q.title || 'Sem título'}</h3>
                        <QuestionChart question={q} entries={entries} />
                      </div>
                    )
                  })
                )}
              </div>
            )}
          </>
        )}
      </div>

      {toast && (
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
            border: `1px solid ${toast.isError ? 'var(--urg)' : 'var(--ok)'}`,
            background: 'var(--surface)',
            color: 'var(--fg)',
            fontSize: 13,
            boxShadow: 'var(--shadow-3)',
            maxWidth: '90vw',
          }}
        >
          {toast.isError ? (
            <Warning size={16} weight="fill" color="var(--urg)" />
          ) : (
            <CheckCircle size={16} weight="fill" color="var(--ok)" />
          )}
          <span>{toast.message}</span>
        </div>
      )}
    </Shell>
  )
}
