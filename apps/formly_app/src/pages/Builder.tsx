import { useEffect, useRef, useState } from 'react'
import type { CSSProperties } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowClockwise, CheckCircle, Eye, Sparkle, Warning, X } from '@phosphor-icons/react'
import QuestionCard from '../components/QuestionCard'
import { ai, surveys } from '../lib/api'
import type { Question } from '../lib/api'
import { useBuilderStore } from '../store/builderStore'

const TOKEN_KEY = 'formly_token'
const INTENT_KEY = 'formly_intent'

const NEW_TYPES: { type: string; config: Record<string, any> }[] = [
  { type: 'text_short', config: { max_chars: 500, placeholder: '' } },
  { type: 'text_long', config: { max_chars: 400, placeholder: '', audio_enabled: false } },
  { type: 'multiple_choice', config: { options: ['', ''], multiple: false } },
  { type: 'multiple_choice', config: { options: ['', ''], multiple: true } },
  { type: 'scale', config: { min: 1, max: 5, label_min: 'Discordo', label_max: 'Concordo', na_option: true } },
  { type: 'nps', config: { min: 0, max: 10 } },
  { type: 'ranking', config: { options: ['', '', ''] } },
  { type: 'matrix', config: { rows: ['', ''], columns: ['Ruim', 'Bom', 'Ótimo'] } },
  { type: 'file_upload', config: { allowed_types: ['pdf', 'docx', 'png'], max_size_mb: 10 } },
  { type: 'datetime', config: { include_time: true } },
  { type: 'number', config: { min: 1, max: 500 } },
  { type: 'dyn_list', config: { suggestions: ['Briefing', 'Produção', 'Entrega'], placeholder: 'Nome do item' } },
]

function normalizeQuestions(questions: Question[] | undefined | null): Question[] {
  return (questions ?? []).map((q) => ({
    id: q.id,
    type: q.type && q.type.trim() ? q.type : 'text_short',
    title: q.title ?? '',
    required: Boolean(q.required),
    config: q.config ?? {},
  }))
}

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
        border: '2px solid var(--gb2)',
        borderTopColor: 'var(--wine)',
        borderRadius: '50%',
        animation: 'spin 0.8s linear infinite',
      }}
    />
  )
}

const btnFlex: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: 6 }

const submitStickyStyle: CSSProperties = {
  position: 'sticky',
  bottom: 0,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  gap: 12,
  background: 'var(--card)',
  borderTop: '1px solid var(--line)',
  padding: '14px 16px',
  marginTop: 20,
  boxShadow: '0 -4px 16px rgba(0,0,0,.06)',
}

const nCountStyle: CSSProperties = {
  fontFamily: 'var(--mono)',
  fontSize: '.7rem',
  letterSpacing: '.05em',
  textTransform: 'uppercase',
  color: 'var(--muted)',
  whiteSpace: 'nowrap',
}

const nActionsStyle: CSSProperties = { display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }

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
        border: `1px solid ${isError ? 'var(--urg)' : 'var(--ok)'}`,
        background: 'var(--card)',
        color: 'var(--ink)',
        fontSize: 13,
        boxShadow: 'var(--shadow-3)',
        maxWidth: '90vw',
      }}
    >
      {isError ? (
        <Warning size={16} weight="fill" color="var(--urg)" />
      ) : (
        <CheckCircle size={16} weight="fill" color="var(--ok)" />
      )}
      <span>{message}</span>
    </div>
  )
}

export default function Builder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useBuilderStore()

  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [aiBusy, setAiBusy] = useState(false)
  const [intent, setIntent] = useState<string | null>(() => {
    try {
      return window.sessionStorage.getItem(INTENT_KEY)
    } catch {
      return null
    }
  })
  const [toast, setToast] = useState<{ message: string; isError: boolean } | null>(null)
  const [refineBusy, setRefineBusy] = useState(false)
  const [refineQuestions, setRefineQuestions] = useState<string[] | null>(null)
  const [refineAnswers, setRefineAnswers] = useState<string[]>([])

  const bodyRef = useRef<HTMLDivElement | null>(null)
  const intentRef = useRef<string | null>(intent)
  const toastTimerRef = useRef<number | null>(null)
  const autosaveTimerRef = useRef<number | null>(null)
  const lastSavedRef = useRef<{ title: string; questions: string } | null>(null)

  const showToast = (message: string, isError = false) => {
    setToast({ message, isError })
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

  const handleApiError = (err: unknown) => {
    if (isAuthError(err)) showToast('Faça login para salvar', true)
    else showToast('Algo deu errado. Tente novamente.', true)
  }

  const loadSurvey = async (surveyId: string) => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await surveys.get(surveyId)
      const questions = normalizeQuestions(data.questions)
      store.reset()
      store.setId(data.id ?? surveyId)
      store.setTitle(data.title ?? '')
      store.setQuestions(questions)
      lastSavedRef.current = { title: data.title ?? '', questions: JSON.stringify(questions) }
    } catch (err) {
      setLoadFailed(true)
      handleApiError(err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (window.localStorage.getItem(TOKEN_KEY)) return
    let cancelled = false
    void (async () => {
      try {
        const res = await fetch('/api/dev/login', { method: 'POST' })
        const data = await res.json()
        if (!res.ok) throw new Error(data.detail || 'Falha')
        window.localStorage.setItem(TOKEN_KEY, data.token)
      } catch {
        if (!cancelled) navigate('/auth')
      }
    })()
    return () => {
      cancelled = true
    }
  }, [navigate])

  useEffect(() => {
    if (id) {
      if (id !== store.id) void loadSurvey(id)
    } else {
      store.reset()
      setLoadFailed(false)
    }
  }, [id])

  useEffect(() => {
    intentRef.current = intent
  }, [intent])

  useEffect(() => {
    if (loading || !store.id) return
    const snapshot = JSON.stringify(store.questions)
    if (lastSavedRef.current && lastSavedRef.current.title === store.title && lastSavedRef.current.questions === snapshot) {
      return
    }
    if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    autosaveTimerRef.current = window.setTimeout(() => {
      void (async () => {
        try {
          await surveys.update(store.id!, { title: store.title.trim() || 'Sem título', questions: store.questions })
          lastSavedRef.current = { title: store.title, questions: JSON.stringify(store.questions) }
        } catch (err) {
          if (isAuthError(err)) showToast('Faça login para salvar', true)
          else showToast('Erro ao salvar automaticamente.', true)
        }
      })()
    }, 2000)
    return () => {
      if (autosaveTimerRef.current !== null) window.clearTimeout(autosaveTimerRef.current)
    }
  }, [store.id, store.title, store.questions, loading])

  const addQuestion = () => {
    const pick = NEW_TYPES[Math.floor(Math.random() * NEW_TYPES.length)]
    store.addQuestion({ type: pick.type, title: 'Nova pergunta', required: false, config: pick.config })
    window.requestAnimationFrame(() => {
      bodyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'end' })
    })
  }

  const saveAndSend = async () => {
    if (saving) return
    if (!store.title.trim() && store.questions.length === 0) {
      showToast('Adicione uma pergunta antes de enviar.', true)
      return
    }
    setSaving(true)
    try {
      let surveyId = store.id
      const payload = { title: store.title.trim() || 'Sem título', questions: store.questions }
      if (surveyId) {
        await surveys.update(surveyId, payload)
      } else {
        const created = await surveys.create(payload)
        surveyId = created.id ?? null
        store.setId(surveyId)
      }
      if (!surveyId) throw new Error('Sem id de questionário')
      await surveys.publish(surveyId)
      lastSavedRef.current = { title: store.title, questions: JSON.stringify(store.questions) }
      navigate(`/send/${surveyId}`)
    } catch (err) {
      if (isAuthError(err)) {
        showToast('Faça login para salvar', true)
        navigate('/auth')
      } else {
        showToast('Erro ao salvar. Tente novamente.', true)
      }
    } finally {
      setSaving(false)
    }
  }

  const goPreview = async () => {
    if (saving) return
    setSaving(true)
    try {
      let surveyId = store.id
      const payload = { title: store.title.trim() || 'Sem título', questions: store.questions }
      if (surveyId) {
        await surveys.update(surveyId, payload)
      } else {
        const created = await surveys.create(payload)
        surveyId = created.id ?? null
        store.setId(surveyId)
      }
      if (!surveyId) throw new Error('Sem id de questionário')
      lastSavedRef.current = { title: store.title, questions: JSON.stringify(store.questions) }
      navigate(`/preview/${surveyId}`)
    } catch (err) {
      if (isAuthError(err)) {
        showToast('Faça login para salvar', true)
        navigate('/auth')
      } else {
        showToast('Erro ao salvar. Tente novamente.', true)
      }
    } finally {
      setSaving(false)
    }
  }

  const generateSkeleton = async (briefing: string) => {
    const data = await ai.skeleton(briefing)
    store.setTitle(data.title ?? intent ?? '')
    store.setQuestions(normalizeQuestions(data.questions))
    try {
      window.sessionStorage.removeItem(INTENT_KEY)
    } catch {
      // segue mesmo sem storage
    }
    setIntent(null)
    setRefineQuestions(null)
    setRefineAnswers([])
  }

  const generateFromIntent = async () => {
    if (!intent || aiBusy || refineBusy) return
    setRefineBusy(true)
    let questions: string[] = []
    try {
      const data = await ai.refinementQuestions(intent)
      questions = data.questions ?? []
    } catch {
      questions = []
    } finally {
      setRefineBusy(false)
    }
    if (intentRef.current === null) return
    if (questions.length > 0) {
      setRefineQuestions(questions)
      setRefineAnswers(questions.map(() => ''))
      return
    }
    // sem perguntas de refino (ou falha ao buscá-las) → geração direta como antes
    setAiBusy(true)
    try {
      await generateSkeleton(intent)
      showToast('Esqueleto gerado pela IA!')
    } catch (err) {
      handleApiError(err)
    } finally {
      setAiBusy(false)
    }
  }

  const submitRefined = async () => {
    if (!intent || aiBusy || !refineQuestions) return
    const answered = refineQuestions
      .map((q, i) => ({ q, a: (refineAnswers[i] ?? '').trim() }))
      .filter((x) => x.a.length > 0)
    const briefing =
      answered.length > 0
        ? `Briefing original: ${intent}\nRespostas adicionais:\n${answered.map((x) => `- ${x.q}: ${x.a}`).join('\n')}`
        : intent
    setAiBusy(true)
    try {
      await generateSkeleton(briefing)
      showToast('Esqueleto gerado pela IA!')
    } catch (err) {
      handleApiError(err)
    } finally {
      setAiBusy(false)
    }
  }

  const skipRefine = async () => {
    if (!intent || aiBusy) return
    setAiBusy(true)
    try {
      await generateSkeleton(intent)
      showToast('Esqueleto gerado pela IA!')
    } catch (err) {
      handleApiError(err)
    } finally {
      setAiBusy(false)
    }
  }

  const dismissIntent = () => {
    try {
      window.sessionStorage.removeItem(INTENT_KEY)
    } catch {
      // ignora
    }
    setIntent(null)
    setRefineQuestions(null)
    setRefineAnswers([])
  }

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--paper)' }}>
        <Spinner size={28} />
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: 'var(--paper)' }}>
      <div className="app">
        {loadFailed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 'var(--r)',
              background: 'var(--wine-soft)',
              border: '1px solid var(--wine)',
              color: 'var(--wine)',
              fontSize: 13,
            }}
          >
            <Warning size={16} weight="fill" />
            <span style={{ flex: 1 }}>Não foi possível carregar o questionário.</span>
            <button type="button" className="btn-sm" onClick={() => id && void loadSurvey(id)}>
              <ArrowClockwise size={12} />
              Tentar novamente
            </button>
          </div>
        )}

        {intent && !id && (
          <div className="intent-banner">
            <Sparkle size={14} weight="fill" style={{ flexShrink: 0 }} />
            <span className="ib-text">{intent}</span>
            {!refineQuestions && (
              <button
                type="button"
                className="btn-sm"
                disabled={aiBusy || refineBusy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}
                onClick={() => void generateFromIntent()}
              >
                {aiBusy || refineBusy ? <Spinner size={11} /> : <Sparkle size={11} />}
                {refineBusy ? 'Buscando perguntas…' : 'Gerar com IA'}
              </button>
            )}
            <button
              type="button"
              onClick={dismissIntent}
              style={{
                background: 'none',
                border: 'none',
                color: 'var(--pine)',
                cursor: 'pointer',
                display: 'flex',
                padding: 2,
                flexShrink: 0,
              }}
              title="Dispensar"
            >
              <X size={14} />
            </button>
          </div>
        )}

        {refineQuestions && intent && (
          <div
            style={{
              background: 'var(--card)',
              border: '1.5px solid var(--line)',
              borderRadius: 'var(--rl)',
              padding: '18px 18px 16px',
              marginBottom: 'var(--m)',
              boxShadow: 'var(--shadow-1)',
            }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <Sparkle size={14} weight="fill" color="var(--wine)" />
              <span style={{ fontFamily: 'var(--display)', fontWeight: 600, fontSize: 14, color: 'var(--ink)' }}>
                Refinar com IA
              </span>
            </div>
            <p style={{ color: 'var(--muted)', fontSize: 13, margin: '0 0 14px' }}>
              Responda às perguntas abaixo para deixar o formulário mais preciso, ou pule esta etapa.
            </p>
            {refineQuestions.map((q, i) => (
              <div key={i} style={{ marginBottom: 12 }}>
                <label style={{ display: 'block', fontSize: 13, color: 'var(--ink)', marginBottom: 5, fontWeight: 500 }}>
                  {i + 1}. {q}
                </label>
                <input
                  type="text"
                  value={refineAnswers[i] ?? ''}
                  onChange={(e) => {
                    const next = [...refineAnswers]
                    next[i] = e.target.value
                    setRefineAnswers(next)
                  }}
                  placeholder="Sua resposta…"
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    fontSize: 13,
                    fontFamily: 'var(--body)',
                    color: 'var(--ink)',
                    background: 'var(--paper-2)',
                    border: '1.5px solid var(--line)',
                    borderRadius: 'var(--r)',
                    outline: 'none',
                  }}
                />
              </div>
            ))}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6, flexWrap: 'wrap' }}>
              <button
                type="button"
                className="btn-sm primary"
                disabled={aiBusy}
                style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}
                onClick={() => void submitRefined()}
              >
                {aiBusy ? <Spinner size={11} /> : <Sparkle size={11} />}
                {aiBusy ? 'Gerando…' : 'Gerar formulário'}
              </button>
              <button type="button" className="btn-sm" disabled={aiBusy} onClick={() => void skipRefine()}>
                Gerar direto
              </button>
            </div>
          </div>
        )}

        <div className="header">
          <input
            className="header-title-input"
            value={store.title}
            onChange={(e) => store.setTitle(e.target.value)}
            placeholder="Título do questionário"
          />
          <div className="header-actions">
            <button type="button" className="btn-sm" onClick={addQuestion}>
              + Pergunta
            </button>
            <button
              type="button"
              className="btn-sm primary"
              disabled={saving}
              onClick={() => void saveAndSend()}
            >
              {saving ? <Spinner size={11} /> : null}
              {saving ? 'Enviando…' : 'Enviar →'}
            </button>
          </div>
        </div>

        <div className="body" ref={bodyRef} style={{ paddingBottom: 80 }}>
          {store.questions.length === 0 ? (
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 8,
                padding: '48px 24px',
                borderRadius: 'var(--rl)',
                border: '1.5px dashed var(--line)',
                background: 'var(--card)',
                textAlign: 'center',
                color: 'var(--muted)',
                fontSize: 14,
              }}
            >
              <p style={{ fontFamily: 'var(--display)', fontWeight: 600, color: 'var(--ink)' }}>
                Nenhuma pergunta ainda.
              </p>
              <p style={{ fontStyle: 'italic' }}>
                Comece com “+ Pergunta” no topo, ou descreva o que precisa para gerar com IA.
              </p>
            </div>
          ) : (
            store.questions.map((q, i) => (
              <QuestionCard
                key={q.id ?? i}
                question={q}
                onChange={(updated) => store.updateQuestion(i, updated)}
                onRemove={() => store.removeQuestion(i)}
                onDuplicate={() => store.addQuestion({ ...q, id: undefined, title: q.title ? `${q.title} (cópia)` : '' })}
                onMoveUp={i > 0 ? () => store.moveQuestion(i, -1) : undefined}
                onMoveDown={i < store.questions.length - 1 ? () => store.moveQuestion(i, 1) : undefined}
              />
            ))
          )}
          <button type="button" className="btn-sm" style={{ alignSelf: 'flex-start' }} onClick={addQuestion}>
            + Pergunta
          </button>
        </div>

        <div className="submit-sticky" style={submitStickyStyle}>
          <span style={nCountStyle}>
            {store.questions.length} {store.questions.length === 1 ? 'pergunta' : 'perguntas'}
          </span>
          <div style={nActionsStyle}>
            <button type="button" className="btn-sm" disabled={saving} onClick={() => void goPreview()} style={btnFlex}>
              <Eye size={14} />
              Preview
            </button>
            <button
              type="button"
              className="btn-sm primary"
              disabled={saving}
              onClick={() => void saveAndSend()}
              style={btnFlex}
            >
              {saving ? <Spinner size={11} /> : null}
              {saving ? 'Enviando…' : 'Enviar →'}
            </button>
          </div>
        </div>
      </div>

      {toast && <Toast message={toast.message} isError={toast.isError} />}
    </div>
  )
}
