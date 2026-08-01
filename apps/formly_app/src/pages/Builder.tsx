import { useEffect, useRef, useState } from 'react'
import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import {
  ArrowClockwise,
  ArrowLeft,
  ChatCircleDots,
  Check,
  CheckCircle,
  Copy,
  Eye,
  FloppyDisk,
  Lightning,
  ListBullets,
  Microphone,
  PaintBrush,
  PaperPlaneTilt,
  PencilSimple,
  Plus,
  RocketLaunch,
  Sparkle,
  TextAlignLeft,
  Warning,
  X,
} from '@phosphor-icons/react'
import Shell from '../components/Shell'
import QuestionCard from '../components/QuestionCard'
import AudioRecorder from '../components/AudioRecorder'
import PublishModal from '../components/PublishModal'
import { ai, surveys } from '../lib/api'
import type { Question } from '../lib/api'
import { useBuilderStore } from '../store/builderStore'
import type { ChatMessage } from '../store/builderStore'

type ChatStage = 'input' | 'refinement' | 'adjust'

function normalizeQuestions(questions: Question[] | undefined | null): Question[] {
  return (questions ?? []).map((q) => ({
    id: q.id,
    type: q.type && q.type.trim() ? q.type : 'text_short',
    title: q.title ?? '',
    required: Boolean(q.required),
    config: q.config ?? {},
  }))
}

function serializeToText(title: string, questions: Question[]): string {
  const lines: string[] = []
  if (title.trim()) {
    lines.push(`# ${title.trim()}`)
    lines.push('')
  }
  questions.forEach((q, i) => {
    const config = q.config ?? {}
    lines.push(`${i + 1}. ${q.title || 'Sem título'}`)
    lines.push(`   tipo: ${q.type}`)
    if (Array.isArray(config.options) && config.options.length) {
      lines.push(`   opções: ${(config.options as string[]).join(', ')}`)
    }
    if (config.min != null) lines.push(`   min: ${config.min}`)
    if (config.max != null) lines.push(`   max: ${config.max}`)
    if (config.label_min != null) lines.push(`   label_min: ${config.label_min}`)
    if (config.label_max != null) lines.push(`   label_max: ${config.label_max}`)
    if (config.max_chars != null) lines.push(`   max_chars: ${config.max_chars}`)
    if (config.max_duration_secs != null) lines.push(`   max_duration_secs: ${config.max_duration_secs}`)
    if (typeof config.multiple === 'boolean') lines.push(`   múltipla: ${config.multiple ? 'sim' : 'não'}`)
    lines.push(`   obrigatória: ${q.required ? 'sim' : 'não'}`)
    lines.push('')
  })
  return lines.join('\n').trimEnd()
}

interface ParsedSurvey {
  title?: string
  questions: Question[]
}

function parseText(text: string): ParsedSurvey {
  const questions: Question[] = []
  let current: Question | null = null
  let title: string | undefined

  const questionRe = /^\s*(\d+)[.)-]\s*(.*)$/

  for (const rawLine of text.split('\n')) {
    const line = rawLine.trim()
    if (!line) continue

    if (line.startsWith('#')) {
      title = line.replace(/^#+\s*/, '').trim()
      continue
    }

    const qm = line.match(questionRe)
    if (qm) {
      if (current) questions.push(current)
      current = { type: 'text_short', title: qm[2], required: false, config: {} }
      continue
    }

    if (!current) continue

    const colon = line.indexOf(':')
    if (colon === -1) continue
    const key = line.slice(0, colon).trim().toLowerCase()
    const value = line.slice(colon + 1).trim()

    const yes = /^(sim|s|true|yes|1)$/i.test(value)

    switch (key) {
      case 'tipo':
      case 'type':
        current.type = value
        break
      case 'obrigatória':
      case 'obrigatoria':
      case 'required':
        current.required = yes
        break
      case 'opções':
      case 'opcoes':
      case 'options':
        current.config.options = value
          .split(',')
          .map((o) => o.trim())
          .filter(Boolean)
        break
      case 'múltipla':
      case 'multipla':
        current.config.multiple = yes
        break
      case 'min':
        current.config.min = Number(value)
        break
      case 'max':
        current.config.max = Number(value)
        break
      case 'max_chars':
        current.config.max_chars = Number(value)
        break
      case 'max_duration_secs':
        current.config.max_duration_secs = Number(value)
        break
      case 'label_min':
        current.config.label_min = value
        break
      case 'label_max':
        current.config.label_max = value
        break
    }
  }
  if (current) questions.push(current)

  return { title, questions }
}

function extractJson(text: string): string | null {
  const start = text.indexOf('{')
  if (start === -1) return null
  let depth = 0
  let inString = false
  let escaped = false
  for (let i = start; i < text.length; i++) {
    const ch = text[i]
    if (inString) {
      if (escaped) escaped = false
      else if (ch === '\\') escaped = true
      else if (ch === '"') inString = false
      continue
    }
    if (ch === '"') inString = true
    else if (ch === '{') depth++
    else if (ch === '}') {
      depth--
      if (depth === 0) return text.slice(start, i + 1)
    }
  }
  return null
}

function extractSuggestion(reply: string): { title?: string; questions: Question[] } | null {
  const fenced = reply.match(/```(?:json)?\s*([\s\S]*?)```/i)
  const candidates = fenced ? [fenced[1], reply] : [reply]

  for (const candidate of candidates) {
    const json = extractJson(candidate)
    if (!json) continue
    try {
      const parsed = JSON.parse(json)
      if (parsed && Array.isArray(parsed.questions)) {
        return {
          title: typeof parsed.title === 'string' ? parsed.title : undefined,
          questions: normalizeQuestions(parsed.questions),
        }
      }
    } catch {
      continue
    }
  }
  return null
}

function isAuthError(err: unknown): boolean {
  return err instanceof Error && (err as Error & { status?: number }).status === 401
}

function mergeStyle(...styles: (CSSProperties | false | null | undefined)[]): CSSProperties {
  const out: Record<string, unknown> = {}
  for (const s of styles) {
    if (s) Object.assign(out, s)
  }
  return out as CSSProperties
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

function ChatBubble({ message }: { message: ChatMessage }) {
  const isUser = message.role === 'user'
  return (
    <div style={{ display: 'flex', justifyContent: isUser ? 'flex-end' : 'flex-start' }}>
      <div
        style={{
          maxWidth: '85%',
          padding: '10px 14px',
          borderRadius: 'var(--rl)',
          border: `1px solid ${isUser ? 'var(--gb)' : 'var(--gb2)'}`,
          background: isUser ? 'var(--adim)' : 'var(--glass)',
          color: 'var(--fg)',
          fontSize: 13,
          lineHeight: 1.55,
          whiteSpace: 'pre-line',
        }}
      >
        {message.content}
      </div>
    </div>
  )
}

function ModalShell({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
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
          maxWidth: 460,
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
          <h2 style={{ fontSize: 18, fontWeight: 700 }}>{title}</h2>
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
        {children}
      </div>
    </div>
  )
}

function PreviewQuestion({ question, index }: { question: Question; index: number }) {
  const config = question.config ?? {}
  const required = question.required ? '*' : ''

  const scaleValues: number[] = []
  if (question.type === 'scale') {
    const min = Number(config.min) || 1
    const max = Number(config.max) || 5
    for (let v = min; v <= max; v++) scaleValues.push(v)
  }

  const previewInput: CSSProperties = {
    width: '100%',
    padding: '9px 12px',
    borderRadius: 'var(--r)',
    border: '1px solid var(--gb2)',
    background: 'var(--glass)',
    color: 'var(--mu2)',
    fontSize: 13,
    outline: 'none',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <span style={{ fontSize: 13, fontWeight: 600 }}>
        {index + 1}. {question.title || 'Sem título'}
        {required && <span style={{ color: 'var(--urg)' }}> *</span>}
      </span>

      {(question.type === 'text_short' || question.type === 'text_long') && (
        question.type === 'text_long' ? (
          <textarea disabled rows={2} placeholder="Resposta em texto" style={previewInput} />
        ) : (
          <input disabled placeholder="Resposta em texto" style={previewInput} />
        )
      )}

      {question.type === 'multiple_choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {(Array.isArray(config.options) ? (config.options as string[]) : []).map((opt, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--mu2)' }}>
              <input disabled type={config.multiple ? 'checkbox' : 'radio'} />
              {opt}
            </label>
          ))}
        </div>
      )}

      {question.type === 'scale' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {config.label_min ? <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{config.label_min}</span> : null}
          {scaleValues.map((v) => (
            <label key={v} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4, fontSize: 12, color: 'var(--mu2)' }}>
              <input disabled type="radio" />
              {v}
            </label>
          ))}
          {config.label_max ? <span style={{ fontSize: 12, color: 'var(--mu2)' }}>{config.label_max}</span> : null}
        </div>
      )}

      {question.type === 'audio' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mu2)', fontSize: 13 }}>
          <Microphone size={16} />
          Gravar resposta (áudio)
        </div>
      )}

      {question.type === 'file_upload' && (
        <div
          style={{
            padding: '10px 14px',
            borderRadius: 'var(--r)',
            border: '1px dashed var(--gb2)',
            color: 'var(--mu2)',
            fontSize: 13,
          }}
        >
          Anexar arquivo
        </div>
      )}
    </div>
  )
}

const inputStyle: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--gb)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 14,
  outline: 'none',
}

const textareaStyle: CSSProperties = {
  ...inputStyle,
  lineHeight: 1.5,
  resize: 'vertical',
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

const toolbarToggle = (active: boolean): CSSProperties => ({
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '7px 12px',
  borderRadius: 'var(--r)',
  border: '1px solid transparent',
  background: active ? 'var(--adim)' : 'transparent',
  color: active ? 'var(--ac-hi)' : 'var(--mu2)',
  fontSize: 13,
  fontWeight: 500,
  cursor: 'pointer',
})

export default function Builder() {
  const { id } = useParams()
  const navigate = useNavigate()
  const store = useBuilderStore()

  const [chatStage, setChatStage] = useState<ChatStage>('input')
  const [draft, setDraft] = useState('')
  const [description, setDescription] = useState('')
  const [refinementQuestions, setRefinementQuestions] = useState<string[]>([])
  const [busy, setBusy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [loadFailed, setLoadFailed] = useState(false)
  const [saving, setSaving] = useState(false)
  const [publishing, setPublishing] = useState(false)
  const [textDraft, setTextDraft] = useState('')
  const [showRecorder, setShowRecorder] = useState(false)
  const [suggestion, setSuggestion] = useState<{ title?: string; questions: Question[] } | null>(null)
  const [toast, setToast] = useState<string | null>(null)
  const [toastIsError, setToastIsError] = useState(false)
  const [dragIndex, setDragIndex] = useState<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)
  const [customizeOpen, setCustomizeOpen] = useState(false)
  const [customizeBusy, setCustomizeBusy] = useState(false)
  const [previewOpen, setPreviewOpen] = useState(false)
  const [publishOpen, setPublishOpen] = useState(false)
  const [publishUrl, setPublishUrl] = useState('')
  const [publishSlug, setPublishSlug] = useState('')
  const [accentColor, setAccentColor] = useState('#8c5fdb')
  const [openingText, setOpeningText] = useState('')
  const [closingText, setClosingText] = useState('')

  const toastTimerRef = useRef<number | null>(null)
  const showToast = (message: string, isError = false) => {
    setToast(message)
    setToastIsError(isError)
    if (toastTimerRef.current !== null) window.clearTimeout(toastTimerRef.current)
    toastTimerRef.current = window.setTimeout(() => setToast(null), 3500)
  }

  const handleApiError = (err: unknown) => {
    if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
    else showToast('Algo deu errado. Tente novamente.', true)
  }

  const loadSurvey = async (surveyId: string) => {
    setLoading(true)
    setLoadFailed(false)
    try {
      const data = await surveys.get(surveyId)
      store.reset()
      store.setId(data.id ?? surveyId)
      store.setTitle(data.title ?? '')
      store.setQuestions(normalizeQuestions(data.questions))
      store.setMode('canvas')
      setChatStage('input')
      setDescription('')
      setRefinementQuestions([])
      setSuggestion(null)
      const colors = (data.brand_colors ?? {}) as Record<string, string | undefined>
      setAccentColor(colors.accent ?? '#8c5fdb')
      setOpeningText(colors.opening_text ?? '')
      setClosingText(colors.closing_text ?? '')
    } catch (err) {
      setLoadFailed(true)
      if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
      else showToast('Erro ao carregar questionário.', true)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (id) {
      if (id !== store.id) void loadSurvey(id)
    } else {
      store.reset()
      setChatStage('input')
      setDescription('')
      setRefinementQuestions([])
      setSuggestion(null)
      setDraft('')
    }
  }, [id])

  const generateSkeleton = async (descriptionToUse: string) => {
    setBusy(true)
    try {
      const data = await ai.skeleton(descriptionToUse)
      store.setTitle(data.title ?? '')
      store.setQuestions(normalizeQuestions(data.questions))
      store.setMode('canvas')
      showToast('Esqueleto gerado!')
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleInitialSubmit = async () => {
    const text = draft.trim()
    if (!text || busy) return
    setDescription(text)
    store.addChatMessage({ role: 'user', content: text })
    setDraft('')
    setBusy(true)
    try {
      const res = await ai.refinementQuestions(text)
      const questions = Array.isArray(res.questions) ? res.questions.filter((q) => Boolean(q)) : []
      setRefinementQuestions(questions)
      if (questions.length) {
        store.addChatMessage({ role: 'assistant', content: questions.join('\n') })
        setChatStage('refinement')
      } else {
        await generateSkeleton(text)
      }
    } catch (err) {
      handleApiError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleRefinementAnswer = async () => {
    const answer = draft.trim()
    if (!answer || busy) return
    store.addChatMessage({ role: 'user', content: answer })
    setDraft('')
    const combined = refinementQuestions.length
      ? `${description}\n\nRespostas de refinamento:\n${refinementQuestions
          .map((q, i) => `Q${i + 1}: ${q}\nA: ${answer}`)
          .join('\n')}`
      : `${description}\n\n${answer}`
    setDescription(combined)
    await generateSkeleton(combined)
  }

  const handleSkipRefinement = () => void generateSkeleton(description)

  const handleStartRefine = () => {
    setSuggestion(null)
    setChatStage('adjust')
    store.setMode('chat')
    store.addChatMessage({
      role: 'assistant',
      content: 'O que você gostaria de ajustar no questionário? Descreva a mudança e eu sugiro a alteração.',
    })
  }

  const handleAdjustSubmit = async () => {
    const message = draft.trim()
    if (!message || busy) return
    store.addChatMessage({ role: 'user', content: message })
    setDraft('')
    setBusy(true)
    setSuggestion(null)
    try {
      const res = await ai.refine({ title: store.title, questions: store.questions }, message)
      const reply = typeof res.reply === 'string' ? res.reply : JSON.stringify(res)
      store.addChatMessage({ role: 'assistant', content: reply })
      const parsed = extractSuggestion(reply)
      if (parsed && parsed.questions.length) setSuggestion(parsed)
    } catch (err) {
      store.addChatMessage({ role: 'assistant', content: 'Não consegui processar sua solicitação. Tente novamente.' })
      handleApiError(err)
    } finally {
      setBusy(false)
    }
  }

  const handleApplySuggestion = () => {
    if (!suggestion) return
    if (suggestion.title) store.setTitle(suggestion.title)
    store.setQuestions(suggestion.questions)
    store.setMode('canvas')
    setSuggestion(null)
    showToast('Sugestão aplicada no esqueleto!')
  }

  const copySuggestion = async () => {
    if (!suggestion) return
    try {
      await navigator.clipboard.writeText(JSON.stringify(suggestion, null, 2))
      showToast('Sugestão copiada!')
    } catch {
      return
    }
  }

  const submitChat = () => {
    if (chatStage === 'input') void handleInitialSubmit()
    else if (chatStage === 'refinement') void handleRefinementAnswer()
    else void handleAdjustSubmit()
  }

  const addNewQuestion = () => {
    store.addQuestion({ type: 'text_short', title: '', required: false, config: {} })
  }

  const enterTextMode = () => {
    setTextDraft(serializeToText(store.title, store.questions))
    store.setMode('text')
  }

  const applyTextChanges = () => {
    const parsed = parseText(textDraft)
    if (!parsed.questions.length) {
      showToast('Não consegui ler o texto — verifique o formato.', true)
      return
    }
    if (parsed.title) store.setTitle(parsed.title)
    store.setQuestions(parsed.questions)
    store.setMode('canvas')
    showToast('Alterações aplicadas!')
  }

  const handleSave = async () => {
    if (saving) return
    if (!store.title.trim() && !store.questions.length) {
      showToast('Nada para salvar ainda — descreva o questionário no chat primeiro.', true)
      return
    }
    setSaving(true)
    try {
      const payload = { title: store.title.trim() || 'Sem título', questions: store.questions }
      if (store.id) {
        await surveys.update(store.id, payload)
      } else {
        const created = await surveys.create(payload)
        store.setId(created.id ?? null)
        navigate(`/builder/${created.id}`, { replace: true })
      }
      showToast('Questionário salvo!')
    } catch (err) {
      if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
      else showToast('Erro ao salvar. Tente novamente.', true)
    } finally {
      setSaving(false)
    }
  }

  const handlePublish = async () => {
    if (publishing) return
    if (!store.id) {
      showToast('Salve o questionário antes de publicar.', true)
      return
    }
    setPublishing(true)
    try {
      const res = await surveys.publish(store.id)
      setPublishUrl(`${window.location.origin}/s/${res.slug}`)
      setPublishSlug(res.slug)
      setPublishOpen(true)
    } catch (err) {
      if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
      else showToast('Erro ao publicar. Tente novamente.', true)
    } finally {
      setPublishing(false)
    }
  }

  const handleCustomizeSave = async () => {
    if (customizeBusy) return
    if (!store.id) {
      showToast('Salve o questionário antes de personalizar.', true)
      return
    }
    setCustomizeBusy(true)
    try {
      await surveys.update(store.id, {
        brand_colors: { accent: accentColor, opening_text: openingText, closing_text: closingText },
      })
      showToast('Personalização salva!')
      setCustomizeOpen(false)
    } catch (err) {
      if (isAuthError(err)) showToast('Token não configurado — cole na barra superior.', true)
      else showToast('Erro ao salvar personalização. Tente novamente.', true)
    } finally {
      setCustomizeBusy(false)
    }
  }

  const dragProps = (index: number): HTMLAttributes<HTMLDivElement> => ({
    draggable: true,
    onDragStart: () => setDragIndex(index),
    onDragEnd: () => setDragIndex(null),
  })

  const handleDrop = (targetIndex: number) => {
    setOverIndex(null)
    if (dragIndex === null || dragIndex === targetIndex) {
      setDragIndex(null)
      return
    }
    const next = [...store.questions]
    const [moved] = next.splice(dragIndex, 1)
    next.splice(targetIndex, 0, moved)
    store.setQuestions(next)
    setDragIndex(null)
  }

  const renderChat = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {chatStage === 'adjust' && (
        <button type="button" onClick={() => store.setMode('canvas')} style={{ ...ghostBtn, alignSelf: 'flex-start' }}>
          <ArrowLeft size={14} />
          Voltar ao esqueleto
        </button>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {store.chatMessages.length === 0 ? (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 10,
              padding: '40px 24px',
              borderRadius: 'var(--rl)',
              border: '1px solid var(--gb)',
              background: 'var(--glass)',
              textAlign: 'center',
            }}
          >
            <ChatCircleDots size={28} color="var(--ac-hi)" />
            <h2 style={{ fontSize: 18, fontWeight: 700 }}>O que você precisa?</h2>
            <p style={{ maxWidth: 460, color: 'var(--mu2)', fontSize: 13 }}>
              Descreva o questionário que quer criar. Por exemplo: “pesquisa de satisfação de uma clínica com 6
              perguntas”.
            </p>
          </div>
        ) : (
          store.chatMessages.map((m, i) => <ChatBubble key={i} message={m} />)
        )}
      </div>

      {showRecorder && (
        <AudioRecorder
          onRecorded={() => undefined}
          onTranscription={(t) => {
            if (t) setDraft((prev) => (prev ? `${prev} ${t}` : t))
            setShowRecorder(false)
          }}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder={
            chatStage === 'input'
              ? 'Descreva seu questionário…'
              : chatStage === 'refinement'
                ? 'Responda as perguntas do assistente…'
                : 'Ex: troque a pergunta 3 por uma escala de 1 a 10'
          }
          rows={chatStage === 'input' ? 4 : 3}
          style={textareaStyle}
          onKeyDown={(e) => {
            if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') submitChat()
          }}
        />
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <button type="button" onClick={() => setShowRecorder((v) => !v)} style={ghostBtn}>
            <Microphone size={14} />
            {showRecorder ? 'Fechar ditar' : 'Ditar'}
          </button>
          {chatStage === 'refinement' && (
            <button type="button" onClick={handleSkipRefinement} disabled={busy} style={mergeStyle(ghostBtn, busy && { opacity: 0.5, cursor: 'default' })}>
              <Lightning size={14} />
              Gerar esqueleto agora
            </button>
          )}
          <div style={{ flex: 1 }} />
          <button
            type="button"
            onClick={submitChat}
            disabled={busy || !draft.trim()}
            style={mergeStyle(primaryBtn, (busy || !draft.trim()) && { opacity: 0.5, cursor: 'default' })}
          >
            {busy ? <Spinner size={13} /> : <PaperPlaneTilt size={14} weight="fill" />}
            Enviar
          </button>
        </div>
      </div>

      {suggestion && chatStage === 'adjust' && (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 10,
            padding: 14,
            borderRadius: 'var(--rl)',
            border: '1px solid var(--teal)',
            background: 'var(--odim)',
          }}
        >
          <strong style={{ fontSize: 13 }}>A IA sugeriu uma alteração no esqueleto</strong>
          <pre
            style={{
              maxHeight: 220,
              overflowY: 'auto',
              padding: 10,
              borderRadius: 'var(--r)',
              background: 'var(--surface)',
              border: '1px solid var(--gb)',
              fontFamily: 'var(--font-mono)',
              fontSize: 12,
              whiteSpace: 'pre-wrap',
              wordBreak: 'break-word',
            }}
          >
            {JSON.stringify(suggestion, null, 2)}
          </pre>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            <button type="button" onClick={handleApplySuggestion} style={primaryBtn}>
              <Check size={14} weight="bold" />
              Aplicar sugestão no esqueleto
            </button>
            <button type="button" onClick={() => void copySuggestion()} style={ghostBtn}>
              <Copy size={14} />
              Copiar
            </button>
          </div>
        </div>
      )}
    </div>
  )

  const renderCanvas = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={() => store.setMode('canvas')} style={toolbarToggle(true)}>
          <ListBullets size={15} />
          Esqueleto
        </button>
        <button type="button" onClick={enterTextMode} style={toolbarToggle(false)}>
          <PencilSimple size={15} />
          Editar como texto
        </button>
      </div>

      {store.questions.length === 0 ? (
        <div
          style={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 6,
            padding: '48px 24px',
            borderRadius: 'var(--rl)',
            border: '1px dashed var(--gb2)',
            background: 'var(--glass)',
            textAlign: 'center',
            color: 'var(--mu2)',
            fontSize: 13,
          }}
        >
          <TextAlignLeft size={28} color="var(--mu)" />
          <p style={{ fontWeight: 600, color: 'var(--mu2)' }}>Nenhuma pergunta ainda.</p>
          <p>Use o chat para gerar um esqueleto ou adicione uma pergunta manualmente.</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {store.questions.map((q, i) => (
            <div
              key={i}
              onDragOver={(e) => {
                e.preventDefault()
                if (overIndex !== i) setOverIndex(i)
              }}
              onDragLeave={() => setOverIndex((v) => (v === i ? null : v))}
              onDrop={() => handleDrop(i)}
              style={{
                borderRadius: 'var(--rl)',
                outline: overIndex === i ? '2px solid var(--ac)' : 'none',
                outlineOffset: 2,
              }}
            >
              <QuestionCard
                question={q}
                index={i}
                onChange={(updated) => store.updateQuestion(i, updated)}
                onRemove={() => store.removeQuestion(i)}
                onDuplicate={() =>
                  store.addQuestion({ ...q, id: undefined, title: q.title ? `${q.title} (cópia)` : '' })
                }
                onMoveUp={i > 0 ? () => store.moveQuestion(i, -1) : undefined}
                onMoveDown={i < store.questions.length - 1 ? () => store.moveQuestion(i, 1) : undefined}
                dragHandleProps={dragProps(i)}
              />
            </div>
          ))}
        </div>
      )}

      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        <button type="button" onClick={addNewQuestion} style={{ ...ghostBtn, borderStyle: 'dashed', color: 'var(--ac-hi)' }}>
          <Plus size={14} />
          Nova pergunta
        </button>
        <button type="button" onClick={handleStartRefine} style={primaryBtn}>
          <Sparkle size={14} />
          Refinar com IA
        </button>
      </div>
    </div>
  )

  const renderText = () => (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 14px',
          borderRadius: 'var(--r)',
          background: 'var(--adim)',
          border: '1px solid var(--gb)',
          color: 'var(--mu2)',
          fontSize: 12,
        }}
      >
        <TextAlignLeft size={15} />
        Edite o esqueleto como texto. Cada pergunta começa com um número (1., 2. …). Campos: tipo, opções, min, max,
        max_chars, max_duration_secs, obrigatória.
      </div>
      <textarea
        value={textDraft}
        onChange={(e) => setTextDraft(e.target.value)}
        rows={Math.max(16, store.questions.length * 4)}
        style={{
          ...textareaStyle,
          fontFamily: 'var(--font-mono)',
          fontSize: 13,
          minHeight: 320,
        }}
      />
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={applyTextChanges} style={primaryBtn}>
          <Check size={14} weight="bold" />
          Aplicar alterações
        </button>
        <button type="button" onClick={() => store.setMode('canvas')} style={ghostBtn}>
          Cancelar
        </button>
      </div>
    </div>
  )

  if (loading) {
    return (
      <Shell>
        <div style={{ display: 'flex', justifyContent: 'center', padding: 80 }}>
          <Spinner size={28} />
        </div>
      </Shell>
    )
  }

  return (
    <Shell>
      <div style={{ display: 'flex', flexDirection: 'column', minHeight: '60vh' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20, flexWrap: 'wrap' }}>
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
            <ArrowLeft size={16} />
            Meus questionários
          </Link>
          <input
            value={store.title}
            onChange={(e) => store.setTitle(e.target.value)}
            placeholder="Título do questionário"
            style={{
              flex: 1,
              minWidth: 220,
              padding: '8px 12px',
              borderRadius: 'var(--r)',
              border: '1px solid var(--gb)',
              background: 'var(--surface)',
              color: 'var(--fg)',
              fontSize: 16,
              fontWeight: 600,
              outline: 'none',
            }}
          />
          {store.id && (
            <span style={{ fontSize: 12, color: 'var(--mu2)', whiteSpace: 'nowrap' }}>
              {store.questions.length} pergunta(s)
            </span>
          )}
        </div>

        {loadFailed && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              marginBottom: 16,
              padding: '10px 14px',
              borderRadius: 'var(--r)',
              background: 'var(--adm2)',
              border: '1px solid var(--att)',
              color: 'var(--att)',
              fontSize: 13,
            }}
          >
            <Warning size={16} weight="fill" />
            <span style={{ flex: 1 }}>Não foi possível carregar o questionário.</span>
            <button type="button" onClick={() => id && void loadSurvey(id)} style={{ ...ghostBtn, padding: '5px 10px' }}>
              <ArrowClockwise size={13} />
              Tentar novamente
            </button>
          </div>
        )}

        {store.mode === 'chat' && renderChat()}
        {store.mode === 'canvas' && renderCanvas()}
        {store.mode === 'text' && renderText()}

        <div
          style={{
            position: 'sticky',
            bottom: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            marginTop: 'auto',
            paddingTop: 24,
            paddingBottom: 8,
            flexWrap: 'wrap',
          }}
        >
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              width: '100%',
              padding: '10px 12px',
              borderRadius: 'var(--rl)',
              background: 'var(--glass)',
              backdropFilter: 'blur(12px)',
              border: '1px solid var(--gb)',
              boxShadow: 'var(--shadow-3)',
              flexWrap: 'wrap',
            }}
          >
            <button type="button" onClick={() => setCustomizeOpen(true)} style={ghostBtn}>
              <PaintBrush size={15} />
              Personalizar
            </button>
            <button type="button" onClick={() => setPreviewOpen(true)} style={ghostBtn}>
              <Eye size={15} />
              Preview
            </button>
            <div style={{ flex: 1 }} />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={saving}
              style={mergeStyle(ghostBtn, saving && { opacity: 0.5, cursor: 'default' })}
            >
              {saving ? <Spinner size={13} /> : <FloppyDisk size={15} />}
              Salvar
            </button>
            <button
              type="button"
              onClick={() => void handlePublish()}
              disabled={publishing}
              style={mergeStyle(primaryBtn, publishing && { opacity: 0.5, cursor: 'default' })}
            >
              {publishing ? <Spinner size={13} /> : <RocketLaunch size={15} weight="fill" />}
              Publicar
            </button>
          </div>
        </div>
      </div>

      {customizeOpen && (
        <ModalShell title="Personalizar questionário" onClose={() => setCustomizeOpen(false)}>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Cor de destaque (accent)
            <input
              type="color"
              value={accentColor}
              onChange={(e) => setAccentColor(e.target.value)}
              style={{ width: '100%', height: 40, padding: 0, border: '1px solid var(--gb)', borderRadius: 'var(--r)', background: 'var(--surface)' }}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Texto de abertura (opcional)
            <textarea
              rows={2}
              value={openingText}
              onChange={(e) => setOpeningText(e.target.value)}
              placeholder="Ex: Obrigado por participar!"
              style={textareaStyle}
            />
          </label>
          <label style={{ display: 'flex', flexDirection: 'column', gap: 6, fontSize: 13, fontWeight: 500 }}>
            Texto de encerramento (opcional)
            <textarea
              rows={2}
              value={closingText}
              onChange={(e) => setClosingText(e.target.value)}
              placeholder="Ex: Suas respostas foram enviadas."
              style={textareaStyle}
            />
          </label>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
            <button type="button" onClick={() => setCustomizeOpen(false)} style={ghostBtn}>
              Cancelar
            </button>
            <button
              type="button"
              onClick={() => void handleCustomizeSave()}
              disabled={customizeBusy}
              style={mergeStyle(primaryBtn, customizeBusy && { opacity: 0.5, cursor: 'default' })}
            >
              {customizeBusy ? <Spinner size={13} /> : <Check size={14} weight="bold" />}
              Salvar
            </button>
          </div>
        </ModalShell>
      )}

      {previewOpen && (
        <ModalShell title="Pré-visualização" onClose={() => setPreviewOpen(false)}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 16,
              '--ac': accentColor,
              '--ac-hi': accentColor,
            } as CSSProperties}
          >
            <div>
              <h3 style={{ fontSize: 20, fontWeight: 700 }}>{store.title || 'Sem título'}</h3>
              {openingText ? (
                <p style={{ color: 'var(--mu2)', fontSize: 13, marginTop: 6, whiteSpace: 'pre-line' }}>{openingText}</p>
              ) : null}
            </div>

            {store.questions.length === 0 ? (
              <p style={{ color: 'var(--mu2)', fontSize: 13 }}>Nenhuma pergunta para exibir.</p>
            ) : (
              store.questions.map((q, i) => (
                <div
                  key={i}
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: 14,
                    borderRadius: 'var(--rl)',
                    border: '1px solid var(--gb)',
                    background: 'var(--glass)',
                  }}
                >
                  <PreviewQuestion question={q} index={i} />
                </div>
              ))
            )}

            {closingText ? (
              <p style={{ color: 'var(--mu2)', fontSize: 13, whiteSpace: 'pre-line' }}>{closingText}</p>
            ) : null}

            <button type="button" disabled style={mergeStyle(primaryBtn, { opacity: 0.5, cursor: 'default', width: '100%', justifyContent: 'center' })}>
              Enviar
            </button>
            <span style={{ textAlign: 'center', fontSize: 11, color: 'var(--mu)' }}>Criado com Formly</span>
          </div>
        </ModalShell>
      )}

      <PublishModal
        open={publishOpen}
        onClose={() => setPublishOpen(false)}
        surveyUrl={publishUrl}
        slug={publishSlug}
      />

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
            border: `1px solid ${toastIsError ? 'var(--urg)' : 'var(--ok)'}`,
            background: 'var(--surface)',
            color: 'var(--fg)',
            fontSize: 13,
            boxShadow: 'var(--shadow-3)',
            maxWidth: '90vw',
          }}
        >
          {toastIsError ? (
            <Warning size={16} weight="fill" color="var(--urg)" />
          ) : (
            <CheckCircle size={16} weight="fill" color="var(--ok)" />
          )}
          <span>{toast}</span>
        </div>
      )}
    </Shell>
  )
}
