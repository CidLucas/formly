import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowClockwise, ArrowLeft, ArrowRight, Check, Microphone, Warning } from '@phosphor-icons/react'
import AudioRecorder from '../components/AudioRecorder'
import { publicApi } from '../lib/api'

interface PublicQuestion {
  id: string
  type: string
  title: string
  required: boolean
  config: Record<string, any>
}

interface PublicSurvey {
  id: string
  title: string
  logo_url?: string | null
  brand_colors?: Record<string, any> | null
  questions: PublicQuestion[]
}

type PageStatus = 'loading' | 'ready' | 'notfound' | 'error' | 'done' | 'already'

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--gb2)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 14,
  outline: 'none',
}

const navBtn: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '9px 16px',
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
  padding: '9px 18px',
  borderRadius: 'var(--r)',
  border: 'none',
  background: 'var(--ac-grad)',
  color: '#fff',
  fontSize: 13,
  fontWeight: 600,
  cursor: 'pointer',
  boxShadow: 'var(--shadow-1)',
}

function Spinner({ size = 18 }: { size?: number }) {
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

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

function getRespondentRef(slug: string): string {
  const key = `formly_respondent_${slug}`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  const id = crypto.randomUUID()
  window.localStorage.setItem(key, id)
  return id
}

export default function Survey() {
  const { slug } = useParams()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [survey, setSurvey] = useState<PublicSurvey | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [errorText, setErrorText] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const blobsRef = useRef<Record<string, Blob>>({})

  const accent = (survey?.brand_colors?.accent as string | undefined) ?? ''
  const closingText = (survey?.brand_colors?.closing_text as string | undefined) ?? ''
  const logoUrl = (survey?.logo_url as string | undefined) ?? ''

  const setAnswer = (questionId: string, value: any) => {
    setErrorText(null)
    setAnswers((prev) => ({ ...prev, [questionId]: value }))
  }

  const patchAnswer = (questionId: string, patch: Record<string, any>) => {
    setErrorText(null)
    setAnswers((prev) => ({ ...prev, [questionId]: { ...(prev[questionId] ?? {}), ...patch } }))
  }

  const isAnswerEmpty = (question: PublicQuestion): boolean => {
    const a = answers[question.id]
    switch (question.type) {
      case 'text_short':
      case 'text_long':
        return !((a?.value_text ?? '') as string).trim()
      case 'multiple_choice': {
        const selections: string[] = Array.isArray(a?.selections) ? a.selections : []
        const otherFilled = Boolean(a?.otherChecked && ((a?.otherText ?? '') as string).trim())
        return selections.length === 0 && !otherFilled
      }
      case 'scale':
        return (a?.scale_value ?? null) == null
      case 'audio': {
        const hasTranscript = Boolean(((a?.transcription ?? '') as string).trim())
        return !hasTranscript && !blobsRef.current[question.id]
      }
      case 'file_upload':
        return !((a?.file_name ?? '') as string).trim()
      default:
        return false
    }
  }

  const saveDraft = (index: number) => {
    if (!slug) return
    try {
      window.localStorage.setItem(`formly_draft_${slug}`, JSON.stringify({ index, answers }))
    } catch {
      // storage indisponível — segue sem rascunho
    }
  }

  const loadSurvey = useCallback(async (slugValue: string) => {
    try {
      const data = await publicApi.getSurvey(slugValue)
      setSurvey(data)
      const questions: PublicQuestion[] = Array.isArray(data.questions) ? data.questions : []
      setStatus('ready')
      try {
        const raw = window.localStorage.getItem(`formly_draft_${slugValue}`)
        if (raw) {
          const parsed = JSON.parse(raw) as { index?: number; answers?: Record<string, any> }
          if (parsed.answers && typeof parsed.answers === 'object') setAnswers(parsed.answers)
          const total = Math.max(questions.length, 1)
          const idx = typeof parsed.index === 'number' ? parsed.index : 0
          setCurrentIndex(Math.min(Math.max(0, idx), total - 1))
        }
      } catch {
        // rascunho corrompido — ignora
      }
    } catch (err) {
      const s = (err as Error & { status?: number }).status
      setStatus(s === 404 ? 'notfound' : 'error')
    }
  }, [])

  useEffect(() => {
    if (!slug) return
    if (window.localStorage.getItem(`formly_done_${slug}`)) {
      setStatus('already')
      return
    }
    setStatus('loading')
    setSurvey(null)
    setAnswers({})
    setCurrentIndex(0)
    void loadSurvey(slug)
  }, [slug, loadSurvey])

  const buildAnswer = (question: PublicQuestion): Record<string, any> => {
    const a = answers[question.id]
    switch (question.type) {
      case 'text_short':
      case 'text_long':
        return { question_id: question.id, value_text: (a?.value_text ?? '') as string }
      case 'multiple_choice': {
        const choices: string[] = Array.isArray(a?.selections) ? [...a.selections] : []
        if (a?.otherChecked && ((a?.otherText ?? '') as string).trim()) {
          choices.push((a.otherText as string).trim())
        }
        return { question_id: question.id, value_choices: choices }
      }
      case 'scale':
        return { question_id: question.id, scale_value: a?.scale_value ?? null }
      case 'audio':
        return {
          question_id: question.id,
          audio_url: null,
          transcription: (a?.transcription ?? '') as string,
          has_audio: Boolean(a?.has_audio),
        }
      case 'file_upload':
        return { question_id: question.id, file_name: (a?.file_name ?? '') as string }
      default:
        return { question_id: question.id }
    }
  }

  async function handleSubmit() {
    if (!survey || submitting) return
    const question = survey.questions[currentIndex]
    if (isAnswerEmpty(question)) {
      setErrorText('Esta pergunta é obrigatória')
      return
    }
    setErrorText(null)
    setSubmitting(true)
    setSubmitFailed(false)
    try {
      const answersPayload: Record<string, any>[] = []
      for (const q of survey.questions) {
        const answer = buildAnswer(q)
        if (q.type === 'audio') {
          const blob = blobsRef.current[q.id]
          if (blob && blob.size < 1024 * 1024) {
            answer.value_text = await blobToBase64(blob)
          }
        }
        answersPayload.push(answer)
      }
      await publicApi.submitResponse(slug ?? '', {
        respondent_ref: getRespondentRef(slug ?? ''),
        answers: answersPayload,
      })
      try {
        if (slug) {
          window.localStorage.removeItem(`formly_draft_${slug}`)
          window.localStorage.setItem(`formly_done_${slug}`, '1')
        }
      } catch {
        // ignora
      }
      setStatus('done')
    } catch {
      setSubmitFailed(true)
    } finally {
      setSubmitting(false)
    }
  }

  function goNext() {
    if (!survey || submitting) return
    const question = survey.questions[currentIndex]
    if (isAnswerEmpty(question)) {
      setErrorText('Esta pergunta é obrigatória')
      return
    }
    setErrorText(null)
    const nextIndex = currentIndex + 1
    if (nextIndex >= survey.questions.length) {
      void handleSubmit()
    } else {
      saveDraft(nextIndex)
      setCurrentIndex(nextIndex)
    }
  }

  function goPrev() {
    if (currentIndex <= 0 || submitting) return
    setErrorText(null)
    const prevIndex = currentIndex - 1
    saveDraft(prevIndex)
    setCurrentIndex(prevIndex)
  }

  const renderAnswer = (question: PublicQuestion) => {
    const qid = question.id
    const config = question.config ?? {}
    const a = answers[qid]

    switch (question.type) {
      case 'text_short': {
        const maxChars = Number(config.max_chars) || 500
        return (
          <input
            type="text"
            value={(a?.value_text ?? '') as string}
            maxLength={maxChars}
            placeholder={(config.placeholder as string) || ''}
            onChange={(e) => setAnswer(qid, { value_text: e.target.value })}
            style={inputStyle}
          />
        )
      }
      case 'text_long': {
        const maxChars = Number(config.max_chars) || 5000
        return (
          <textarea
            rows={5}
            value={(a?.value_text ?? '') as string}
            maxLength={maxChars}
            placeholder={(config.placeholder as string) || ''}
            onChange={(e) => setAnswer(qid, { value_text: e.target.value })}
            style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.5 }}
          />
        )
      }
      case 'multiple_choice': {
        const multiple = Boolean(config.multiple)
        const options: string[] = Array.isArray(config.options)
          ? config.options.filter((o): o is string => typeof o === 'string')
          : []
        const other = Boolean(config.other)
        const selections: string[] = Array.isArray(a?.selections) ? a.selections : []
        const otherChecked = Boolean(a?.otherChecked)
        const otherText = (a?.otherText ?? '') as string

        const toggleOption = (opt: string) => {
          if (!multiple) {
            setAnswer(qid, { ...a, selections: [opt], otherChecked: false })
          } else {
            const next = selections.includes(opt) ? selections.filter((s) => s !== opt) : [...selections, opt]
            setAnswer(qid, { ...a, selections: next })
          }
        }

        const toggleOther = () => {
          const next = { ...a, otherChecked: !otherChecked }
          if (!multiple && !otherChecked) next.selections = []
          setAnswer(qid, next)
        }

        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            {options.map((opt) => {
              const checked = selections.includes(opt)
              return (
                <label
                  key={opt}
                  style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', color: 'var(--fg)' }}
                >
                  <input
                    type={multiple ? 'checkbox' : 'radio'}
                    checked={checked}
                    onChange={() => toggleOption(opt)}
                    style={{ width: 16, height: 16, accentColor: 'var(--ac)', cursor: 'pointer' }}
                  />
                  {opt}
                </label>
              )
            })}
            {other && (
              <label
                style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14, cursor: 'pointer', color: 'var(--fg)' }}
              >
                <input
                  type={multiple ? 'checkbox' : 'radio'}
                  checked={otherChecked}
                  onChange={toggleOther}
                  style={{ width: 16, height: 16, accentColor: 'var(--ac)', cursor: 'pointer' }}
                />
                <span>Outro</span>
                {otherChecked && (
                  <input
                    autoFocus
                    type="text"
                    value={otherText}
                    placeholder="Digite sua resposta"
                    onChange={(e) => setAnswer(qid, { ...a, otherChecked: true, otherText: e.target.value })}
                    style={{ ...inputStyle, maxWidth: 240, padding: '6px 10px', marginLeft: 4 }}
                  />
                )}
              </label>
            )}
          </div>
        )
      }
      case 'scale': {
        const min = Number(config.min) || 1
        const max = Number(config.max) || 5
        const values: number[] = []
        for (let v = min; v <= max; v++) values.push(v)
        const selected = a?.scale_value ?? null
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, flexWrap: 'wrap' }}>
              {values.map((v) => (
                <label key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: 'pointer' }}>
                  <input
                    type="radio"
                    checked={selected === v}
                    onChange={() => setAnswer(qid, { scale_value: v })}
                    style={{ width: 18, height: 18, accentColor: 'var(--ac)', cursor: 'pointer' }}
                  />
                  <span style={{ fontSize: 13, color: 'var(--fg)' }}>{v}</span>
                </label>
              ))}
            </div>
            {(config.label_min || config.label_max) && (
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--mu2)' }}>
                <span>{(config.label_min as string) ?? ''}</span>
                <span>{(config.label_max as string) ?? ''}</span>
              </div>
            )}
          </div>
        )
      }
      case 'audio': {
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--mu2)' }}>
              <Microphone size={14} />
              Resposta em áudio
            </span>
            <AudioRecorder
              maxDurationSecs={Number(config.max_duration_secs) || 60}
              onRecorded={(blob) => {
                blobsRef.current[qid] = blob
                patchAnswer(qid, { has_audio: true })
              }}
              onTranscription={(text) => patchAnswer(qid, { transcription: text })}
            />
          </div>
        )
      }
      case 'file_upload': {
        const file_name = (a?.file_name ?? '') as string
        const accept = (config.allowed_types as string | undefined) ?? undefined
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <input
              type="file"
              accept={accept}
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) patchAnswer(qid, { file_name: file.name })
              }}
              style={{ color: 'var(--mu2)', fontSize: 13 }}
            />
            {file_name && (
              <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--ok)' }}>
                <Check size={12} weight="bold" />
                {file_name}
              </span>
            )}
          </div>
        )
      }
      default:
        return null
    }
  }

  const rootStyle: CSSProperties = accent
    ? ({
        '--ac': accent,
        '--ac-hi': accent,
        '--ac-grad': `linear-gradient(135deg, ${accent}, ${accent})`,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      } as CSSProperties)
    : {
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        background: 'var(--bg)',
      }

  const centerScreen: CSSProperties = {
    ...rootStyle,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 40,
    textAlign: 'center',
  }

  if (status === 'loading') {
    return (
      <div style={centerScreen}>
        <Spinner size={28} />
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div style={centerScreen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Questionário não encontrado</h2>
          <p style={{ color: 'var(--mu2)', fontSize: 14 }}>Este link pode estar incorreto ou o questionário foi removido.</p>
          <a href="https://formly.app" style={{ fontWeight: 600 }}>
            Ir para Formly
          </a>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={centerScreen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Não foi possível carregar o questionário</h2>
          <p style={{ color: 'var(--mu2)', fontSize: 14 }}>Verifique sua conexão e tente novamente.</p>
          <button type="button" onClick={() => slug && void loadSurvey(slug)} style={primaryBtn}>
            <ArrowClockwise size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={centerScreen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16, alignItems: 'center', maxWidth: 420 }}>
          <span
            style={{
              width: 72,
              height: 72,
              borderRadius: '50%',
              background: 'var(--ok)',
              color: '#fff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              animation: 'formly-pop 0.45s ease-out both',
            }}
          >
            <Check size={34} weight="bold" />
          </span>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Obrigado por responder!</h2>
          {closingText ? (
            <p style={{ color: 'var(--mu2)', fontSize: 14, whiteSpace: 'pre-line' }}>{closingText}</p>
          ) : null}
          <a href="https://formly.app" style={{ fontWeight: 600, fontSize: 13 }}>
            Criar seu próprio questionário no Formly
          </a>
        </div>
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div style={centerScreen}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center', maxWidth: 420 }}>
          <h2 style={{ fontSize: 20, fontWeight: 700 }}>Você já respondeu este questionário</h2>
          <p style={{ color: 'var(--mu2)', fontSize: 14 }}>Obrigado! Suas respostas já foram registradas.</p>
          <a href="https://formly.app" style={{ fontWeight: 600, fontSize: 13 }}>
            Criar seu próprio questionário no Formly
          </a>
        </div>
      </div>
    )
  }

  if (!survey) return null

  const total = survey.questions.length
  if (total === 0) {
    return (
      <div style={centerScreen}>
        <p style={{ color: 'var(--mu2)', fontSize: 14 }}>Este questionário ainda não tem perguntas.</p>
      </div>
    )
  }

  const question = survey.questions[currentIndex]
  const isLast = currentIndex === total - 1
  const progressPct = Math.round((currentIndex / total) * 100)

  return (
    <div style={{ ...rootStyle, justifyContent: 'space-between' }}>
      <div
        style={{
          width: '100%',
          maxWidth: 640,
          margin: '0 auto',
          flex: 1,
          display: 'flex',
          flexDirection: 'column',
          gap: 24,
          padding: '32px 20px',
        }}
      >
        <header style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {logoUrl ? <img src={logoUrl} alt="" style={{ height: 32, maxWidth: 120, objectFit: 'contain' }} /> : null}
            <h1 style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.02em' }}>{survey.title}</h1>
          </div>
          <span style={{ fontSize: 12, color: 'var(--mu2)' }}>
            Pergunta {currentIndex + 1} de {total}
          </span>
          <div style={{ height: 4, borderRadius: 2, background: 'var(--gb)', overflow: 'hidden' }}>
            <div
              style={{
                height: '100%',
                width: `${progressPct}%`,
                background: 'var(--ac)',
                borderRadius: 2,
                transition: 'width 0.25s ease',
              }}
            />
          </div>
        </header>

        <main
          style={{
            flex: 1,
            display: 'flex',
            flexDirection: 'column',
            gap: 20,
            padding: '28px 24px',
            borderRadius: 'var(--rl)',
            background: 'var(--surface)',
            border: errorText ? '1px solid var(--urg)' : '1px solid var(--gb)',
            boxShadow: 'var(--shadow-1)',
          }}
        >
          <h2 style={{ fontSize: 18, fontWeight: 600, lineHeight: 1.4 }}>
            {question.title}
            {question.required && <span style={{ color: 'var(--urg)' }}> *</span>}
          </h2>
          {renderAnswer(question)}
          {errorText && (
            <div
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '8px 12px',
                borderRadius: 'var(--r)',
                background: 'var(--udim)',
                border: '1px solid var(--urg)',
                color: 'var(--urg)',
                fontSize: 13,
              }}
            >
              <Warning size={14} weight="fill" />
              {errorText}
            </div>
          )}
        </main>

        <footer style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            type="button"
            onClick={goPrev}
            disabled={currentIndex === 0 || submitting}
            style={{ ...navBtn, opacity: currentIndex === 0 ? 0.5 : 1, cursor: currentIndex === 0 ? 'default' : 'pointer' }}
          >
            <ArrowLeft size={16} />
            Anterior
          </button>
          <div style={{ flex: 1 }} />
          <button type="button" onClick={goNext} disabled={submitting} style={primaryBtn}>
            {submitting ? <Spinner size={14} /> : isLast ? <Check size={16} weight="bold" /> : <ArrowRight size={16} />}
            {submitting ? 'Enviando…' : isLast ? 'Enviar' : 'Próxima'}
          </button>
        </footer>
      </div>

      <span style={{ textAlign: 'center', fontSize: 11, color: 'var(--mu)', padding: '12px 0' }}>Criado com Formly</span>

      {submitFailed && (
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
            border: '1px solid var(--urg)',
            background: 'var(--surface)',
            color: 'var(--fg)',
            fontSize: 13,
            boxShadow: 'var(--shadow-3)',
            maxWidth: '90vw',
          }}
        >
          <Warning size={16} weight="fill" color="var(--urg)" />
          <span>Erro ao enviar. Suas respostas foram salvas neste dispositivo.</span>
          <button
            type="button"
            onClick={() => void handleSubmit()}
            style={{ ...navBtn, borderColor: 'var(--urg)', color: 'var(--urg)', whiteSpace: 'nowrap' }}
          >
            Tentar novamente
          </button>
        </div>
      )}
    </div>
  )
}
