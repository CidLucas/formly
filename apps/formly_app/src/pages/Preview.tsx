import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowClockwise, ArrowLeft, ArrowRight, Check, Eye } from '@phosphor-icons/react'
import { surveys } from '../lib/api'
import type { Question } from '../lib/api'
import {
  AudioCompanion,
  buildAccept,
  DynListQuestion,
  FileQuestion,
  kindBadge,
  maskDate,
  maskTime,
  MatrixQuestion,
  RankingQuestion,
} from './Survey'

function isAuthError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 401
}

function Spinner({ size = 14 }: { size?: number }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: size,
        height: size,
        border: '2px solid var(--line)',
        borderTopColor: 'var(--wine)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

export default function Preview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [loading, setLoading] = useState(true)
  const [loadFailed, setLoadFailed] = useState(false)
  const [title, setTitle] = useState('')
  const [questions, setQuestions] = useState<Question[]>([])
  const [answers, setAnswers] = useState<Record<string, any>>({})

  const setAnswer = (qid: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
  }

  const loadSurvey = async (surveyId: string) => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await surveys.get(surveyId)
      setTitle(data.title ?? '')
      setQuestions(
        (Array.isArray(data.questions) ? data.questions : []).map((q) => ({
          id: q.id,
          type: q.type && q.type.trim() ? q.type : 'text_short',
          title: q.title ?? '',
          required: Boolean(q.required),
          config: q.config ?? {},
        }))
      )
    } catch (err) {
      setLoadFailed(true)
      if (isAuthError(err)) {
        window.location.href = '/auth'
        return
      }
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) void loadSurvey(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id])

  const renderField = (q: Question) => {
    const qid = q.id ?? ''
    const config = q.config ?? {}
    const a = answers[qid]

    switch (q.type) {
      case 'text_short': {
        const maxChars = Number(config.max_chars) || 500
        const value = (a?.value_text ?? '') as string
        return (
          <div>
            <input
              className="input-short"
              type="text"
              value={value}
              maxLength={maxChars}
              placeholder={(config.placeholder as string) || ''}
              onChange={(e) => setAnswer(qid, { ...a, value_text: e.target.value })}
            />
            <div className="q-counter">
              {value.length}/{maxChars}
            </div>
          </div>
        )
      }
      case 'text_long': {
        const maxChars = Number(config.max_chars) || 5000
        const value = (a?.value_text ?? '') as string
        const audioEnabled = Boolean(config.audio_enabled)
        return (
          <div>
            <textarea
              className="textarea-long"
              rows={5}
              value={value}
              maxLength={maxChars}
              placeholder={(config.placeholder as string) || 'Pode escrever, gravar um áudio, ou os dois.'}
              onChange={(e) => setAnswer(qid, { ...a, value_text: e.target.value })}
            />
            <div className="q-counter">
              {value.length}/{maxChars}
            </div>
            {audioEnabled && (
              <>
                <div className="audio-divider">ou</div>
                <AudioCompanion
                  maxDurationSecs={Number(config.max_duration_secs) || 60}
                  onRecorded={() => setAnswer(qid, { ...a, has_audio: true })}
                  onCleared={() => setAnswer(qid, { ...a, has_audio: false })}
                  onTranscription={(t) => setAnswer(qid, { ...a, transcription: t })}
                />
              </>
            )}
          </div>
        )
      }
      case 'multiple_choice': {
        const multiple = Boolean(config.multiple)
        const options: string[] = Array.isArray(config.options)
          ? config.options.filter((o): o is string => typeof o === 'string')
          : []
        const selectedSingle = (a?.value_text ?? '') as string
        const selectedMulti: string[] = Array.isArray(a?.value_choices) ? a.value_choices : []
        const toggle = (opt: string) => {
          if (multiple) {
            const next = selectedMulti.includes(opt) ? selectedMulti.filter((o) => o !== opt) : [...selectedMulti, opt]
            setAnswer(qid, { ...a, value_choices: next })
          } else {
            setAnswer(qid, { ...a, value_text: selectedSingle === opt ? '' : opt })
          }
        }
        return (
          <div className="choices">
            {options.map((opt) => {
              const selected = multiple ? selectedMulti.includes(opt) : selectedSingle === opt
              return (
                <label
                  key={opt}
                  className={`choice ${selected ? 'selected' : ''}`}
                  onClick={(e) => {
                    e.preventDefault()
                    toggle(opt)
                  }}
                >
                  <input type={multiple ? 'checkbox' : 'radio'} checked={selected} readOnly />
                  <span className={multiple ? 'check-ind' : 'radio-ind'} />
                  {opt}
                </label>
              )
            })}
          </div>
        )
      }
      case 'scale': {
        const min = Number(config.min) || 1
        const max = Number(config.max) || 5
        const values: number[] = []
        for (let v = min; v <= max; v++) values.push(v)
        const selected = a?.scale_value ?? null
        const naChecked = Boolean(a?.na)
        return (
          <div className="likert">
            <div className="likert-row" style={{ position: 'relative' }}>
              <div className="likert-line" />
              {values.map((v) => (
                <span
                  key={v}
                  className={`likert-pt ${selected === v ? 'selected' : ''}`}
                  onClick={() => setAnswer(qid, { ...a, scale_value: v, na: false })}
                />
              ))}
            </div>
            <div className="likert-labels">
              <span>{(config.label_min as string) || 'Discordo totalmente'}</span>
              <span>{(config.label_max as string) || 'Concordo totalmente'}</span>
            </div>
            <div className="likert-neutral">neutro</div>
            <label
              className="likert-na"
              onClick={(e) => {
                e.preventDefault()
                setAnswer(qid, { ...a, na: !naChecked, scale_value: null })
              }}
            >
              <input type="radio" checked={naChecked} onChange={() => undefined} style={{ display: 'none' }} />
              <span
                className="radio-ind"
                style={{
                  width: '.9rem',
                  height: '.9rem',
                  borderRadius: '50%',
                  border: '1.5px solid var(--muted)',
                  display: 'inline-block',
                }}
              />
              Não sei / Não se aplica
            </label>
          </div>
        )
      }
      case 'nps': {
        const selected = a?.scale_value ?? null
        const zoneClass = (v: number) => (v <= 6 ? 'nps-zone-detractor' : v <= 8 ? 'nps-zone-neutral' : 'nps-zone-promoter')
        return (
          <div>
            <div className="nps-row">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((v) => (
                <span
                  key={v}
                  className={`nps-pt ${zoneClass(v)} ${selected === v ? 'selected' : ''}`}
                  onClick={() => setAnswer(qid, { ...a, scale_value: v })}
                >
                  {v}
                </span>
              ))}
            </div>
            <div className="nps-labels">
              <span>Não recomendaria</span>
              <span>Com certeza recomendaria</span>
            </div>
          </div>
        )
      }
      case 'ranking': {
        const options: string[] = Array.isArray(config.options)
          ? config.options.filter((o): o is string => typeof o === 'string')
          : []
        return (
          <RankingQuestion
            options={options}
            value={Array.isArray(a?.value_choices) ? a.value_choices : undefined}
            onChange={(v) => setAnswer(qid, { ...a, value_choices: v })}
          />
        )
      }
      case 'matrix': {
        const rows: string[] = Array.isArray(config.rows) ? config.rows.filter((o): o is string => typeof o === 'string') : []
        const cols: string[] = Array.isArray(config.columns)
          ? config.columns.filter((o): o is string => typeof o === 'string')
          : []
        return (
          <MatrixQuestion
            rows={rows}
            cols={cols}
            value={Array.isArray(a?.value_choices) ? a.value_choices : []}
            onChange={(v) => setAnswer(qid, { ...a, value_choices: v })}
          />
        )
      }
      case 'file_upload':
        return (
          <FileQuestion
            accept={buildAccept(config.allowed_types)}
            value={a ?? {}}
            onChange={(v) => setAnswer(qid, v)}
          />
        )
      case 'datetime': {
        const includeTime = config.include_time !== false
        const date = (a?.date ?? '') as string
        const time = (a?.time ?? '') as string
        return (
          <div className="datetime-row">
            <input
              type="text"
              inputMode="numeric"
              placeholder="dd/mm/aaaa"
              value={date}
              onChange={(e) => setAnswer(qid, { ...a, date: maskDate(e.target.value) })}
            />
            {includeTime && (
              <input
                type="text"
                inputMode="numeric"
                placeholder="hh:mm"
                value={time}
                style={{ maxWidth: '8rem' }}
                onChange={(e) => setAnswer(qid, { ...a, time: maskTime(e.target.value) })}
              />
            )}
          </div>
        )
      }
      case 'number': {
        const min = Number(config.min)
        const max = Number(config.max)
        const hasBounds = !Number.isNaN(min) && !Number.isNaN(max)
        const value = (a?.value_text ?? '') as string
        const num = value.trim() === '' ? null : Number(value)
        const outOfRange = hasBounds && num !== null && !Number.isNaN(num) && (num < min || num > max)
        return (
          <div>
            <input
              className={`input-num ${outOfRange ? 'out-of-range' : ''}`}
              type="number"
              min={hasBounds ? min : undefined}
              max={hasBounds ? max : undefined}
              value={value}
              onChange={(e) => setAnswer(qid, { ...a, value_text: e.target.value })}
            />
            {hasBounds && (
              <div className="num-meta">
                mín. {min} · máx. {max}
              </div>
            )}
          </div>
        )
      }
      case 'dyn_list': {
        const suggestions: string[] = Array.isArray(config.suggestions)
          ? config.suggestions.filter((o): o is string => typeof o === 'string')
          : []
        return (
          <DynListQuestion
            value={Array.isArray(a?.value_choices) ? a.value_choices : []}
            suggestions={suggestions}
            placeholder={(config.placeholder as string) || 'Nome da etapa'}
            onChange={(v) => setAnswer(qid, { ...a, value_choices: v })}
          />
        )
      }
      case 'audio':
        return (
          <AudioCompanion
            maxDurationSecs={Number(config.max_duration_secs) || 60}
            onRecorded={() => setAnswer(qid, { ...a, has_audio: true })}
            onCleared={() => setAnswer(qid, { ...a, has_audio: false })}
            onTranscription={(t) => setAnswer(qid, { ...a, transcription: t })}
          />
        )
      default:
        return (
          <div>
            <input
              className="input-short"
              type="text"
              value={(a?.value_text ?? '') as string}
              onChange={(e) => setAnswer(qid, { ...a, value_text: e.target.value })}
            />
          </div>
        )
    }
  }

  if (loading) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          background: 'var(--paper)',
        }}
      >
        <Spinner size={28} />
      </div>
    )
  }

  if (loadFailed) {
    return (
      <div
        style={{
          minHeight: '100vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          padding: 40,
          textAlign: 'center',
          background: 'var(--paper)',
        }}
      >
        <div style={{ maxWidth: 380 }}>
          <span className="eyebrow">Formly</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 8 }}>Não foi possível carregar o questionário</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: 6 }}>
            Verifique sua conexão e tente novamente.
          </p>
          <button
            type="button"
            className="btn"
            style={{ display: 'inline-flex', alignItems: 'center', gap: '.5rem', marginTop: 16 }}
            onClick={() => id && void loadSurvey(id)}
          >
            <ArrowClockwise size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  const confirmBtn = {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 6,
    flexShrink: 0,
  } as const

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div className="app" style={{ maxWidth: 560, margin: '0 auto', padding: '40px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginBottom: 24 }}>
          <button
            type="button"
            className="btn-sm"
            onClick={() => navigate(`/builder/${id ?? ''}`)}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
          >
            <ArrowLeft size={14} />
            Voltar
          </button>
          <span
            style={{
              fontFamily: 'var(--mono)',
              fontSize: '.66rem',
              letterSpacing: '.18em',
              textTransform: 'uppercase',
              color: 'var(--muted)',
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
            }}
          >
            <Eye size={14} />
            Preview
          </span>
          <button
            type="button"
            className="btn-sm primary"
            onClick={() => id && navigate(`/send/${id}`)}
            style={confirmBtn}
          >
            Confirmar e enviar
            <ArrowRight size={14} />
          </button>
        </div>

        <div className="header" style={{ marginBottom: 24 }}>
          <div
            className="header-title"
            style={{
              fontFamily: 'var(--display)',
              fontSize: '1.3rem',
              fontWeight: 600,
              letterSpacing: '-.01em',
            }}
          >
            {title || 'Sem título'}
          </div>
          <div
            style={{
              marginTop: 6,
              color: 'var(--muted)',
              fontSize: '.85rem',
            }}
          >
            {questions.length} {questions.length === 1 ? 'pergunta' : 'perguntas'}
          </div>
        </div>

        <div className="body" style={{ display: 'flex', flexDirection: 'column', gap: 16, paddingBottom: 80 }}>
          {questions.length === 0 ? (
            <div
              style={{
                padding: '48px 24px',
                textAlign: 'center',
                borderRadius: 'var(--rl)',
                border: '1.5px dashed var(--line)',
                background: 'var(--card)',
                color: 'var(--muted)',
                fontSize: 14,
              }}
            >
              Este questionário ainda não tem perguntas.
            </div>
          ) : (
            questions.map((q, i) => (
              <div key={q.id ?? i} className="q q-card">
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 8,
                    marginBottom: 8,
                  }}
                >
                  <span className="eyebrow">{i + 1}</span>
                  <span className="q-kind">{kindBadge(q.type, q.config)}</span>
                </div>
                <div className="q-label" style={{ fontSize: '1rem', fontWeight: 600, marginBottom: 12 }}>
                  {q.title}
                  {q.required ? (
                    <span style={{ color: 'var(--wine)', fontWeight: 700 }}> *</span>
                  ) : null}
                </div>
                {renderField(q)}
              </div>
            ))
          )}
        </div>

        {questions.length > 0 && (
          <div
            style={{
              position: 'sticky',
              bottom: 0,
              background: 'var(--card)',
              borderTop: '1px solid var(--line)',
              padding: '14px 0',
              marginTop: 8,
              textAlign: 'right',
            }}
          >
            <button
              type="button"
              className="btn-sm primary"
              onClick={() => id && navigate(`/send/${id}`)}
              style={confirmBtn}
            >
              <Check size={14} weight="bold" />
              Confirmar e enviar →
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
