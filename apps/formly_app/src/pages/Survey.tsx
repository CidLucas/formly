import { useCallback, useEffect, useRef, useState } from 'react'
import type { CSSProperties, DragEvent, FocusEvent } from 'react'
import { useParams } from 'react-router-dom'
import { ArrowClockwise, ArrowLeft, ArrowRight, Check, Play, Warning } from '@phosphor-icons/react'
import { publicApi, transcribe } from '../lib/api'

/* ── Tipos ────────────────────────────────────────────────── */

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
  theme?: string | null
  logo_url?: string | null
  brand_colors?: Record<string, any> | null
  questions: PublicQuestion[]
}

type PageStatus = 'loading' | 'intro' | 'ready' | 'notfound' | 'error' | 'done' | 'already'

/* ── Helpers ──────────────────────────────────────────────── */

function formatTime(total: number): string {
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export function kindBadge(type: string, config: Record<string, any>): string {
  switch (type) {
    case 'text_short':
    case 'text_long':
      return 'TEXTO'
    case 'multiple_choice':
      return config?.multiple ? 'MÚLTIPLA [✓✓]' : 'MÚLTIPLA [○]'
    case 'scale':
      return 'ESCALA'
    case 'nps':
      return 'NPS'
    case 'ranking':
      return 'RANKING'
    case 'matrix':
      return 'MATRIZ'
    case 'file_upload':
      return 'ARQUIVO'
    case 'datetime':
      return 'DATA'
    case 'number':
      return 'NÚMERO'
    case 'dyn_list':
      return 'LISTA'
    case 'audio':
      return 'ÁUDIO'
    default:
      return type.toUpperCase()
  }
}

export function maskDate(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 8)
  if (digits.length >= 5) return `${digits.slice(0, 2)}/${digits.slice(2, 4)}/${digits.slice(4)}`
  if (digits.length >= 3) return `${digits.slice(0, 2)}/${digits.slice(2)}`
  return digits
}

export function maskTime(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 4)
  if (digits.length >= 3) return `${digits.slice(0, 2)}:${digits.slice(2)}`
  return digits
}

export function buildAccept(allowed: unknown): string | undefined {
  if (Array.isArray(allowed)) {
    const list = allowed.map((t) => `.${String(t)}`).join(',')
    return list || undefined
  }
  if (typeof allowed === 'string' && allowed) return allowed
  return undefined
}

export function formatSize(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
  if (bytes >= 1024) return `${Math.round(bytes / 1024)} KB`
  return `${bytes} B`
}

export function fileExt(name: string): string {
  const i = name.lastIndexOf('.')
  return i === -1 ? 'FILE' : name.slice(i + 1).toUpperCase().slice(0, 8)
}

function getRespondentRef(slug: string): string {
  const key = `formly_respondent_${slug}`
  const existing = window.localStorage.getItem(key)
  if (existing) return existing
  // crypto.randomUUID só existe em contexto seguro (HTTPS/localhost).
  // Fallback: gera UUID manual para HTTP (ex: acesso via Tailscale IP).
  const id =
    typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
      ? crypto.randomUUID()
      : 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
          const r = (Math.random() * 16) | 0
          const v = c === 'x' ? r : (r & 0x3) | 0x8
          return v.toString(16)
        })
  window.localStorage.setItem(key, id)
  return id
}

function getMode(survey: PublicSurvey): 'stages' | 'scroll' {
  const raw = survey as unknown as { config?: Record<string, any> }
  const brand = (survey.brand_colors ?? {}) as Record<string, any>
  if (raw.config?.mode === 'scroll' || brand.mode === 'scroll') return 'scroll'
  return 'stages'
}

function isAnswered(question: PublicQuestion, a: any): boolean {
  switch (question.type) {
    case 'text_short':
      return Boolean(((a?.value_text ?? '') as string).trim())
    case 'text_long':
      return (
        Boolean(((a?.value_text ?? '') as string).trim()) ||
        Boolean((a?.transcription ?? '') as string) ||
        Boolean(a?.has_audio)
      )
    case 'multiple_choice':
      return question.config?.multiple
        ? Array.isArray(a?.value_choices) && a.value_choices.length > 0
        : Boolean(((a?.value_text ?? '') as string).trim())
    case 'scale':
      return a?.scale_value != null || Boolean(a?.na)
    case 'nps':
      return a?.scale_value != null
    case 'ranking':
    case 'matrix':
    case 'dyn_list':
      return Array.isArray(a?.value_choices) && a.value_choices.length > 0
    case 'file_upload':
      return Boolean(((a?.file_name ?? '') as string).trim())
    case 'datetime':
      return Boolean(((a?.date ?? '') as string).trim())
    case 'number': {
      const raw = ((a?.value_text ?? '') as string).trim()
      if (!raw) return false
      const num = Number(raw)
      const min = Number(question.config?.min)
      const max = Number(question.config?.max)
      if (!Number.isNaN(num) && !Number.isNaN(min) && !Number.isNaN(max) && (num < min || num > max)) return false
      return true
    }
    case 'audio':
      return Boolean((a?.transcription ?? '') as string) || Boolean(a?.has_audio)
    default:
      return Boolean(((a?.value_text ?? '') as string).trim())
  }
}

function validate(question: PublicQuestion, a: any): string | null {
  if (question.type === 'number') {
    const raw = ((a?.value_text ?? '') as string).trim()
    const min = Number(question.config?.min)
    const max = Number(question.config?.max)
    if (question.required && !raw) return 'Este campo é obrigatório.'
    if (raw) {
      const num = Number(raw)
      if (!Number.isNaN(num) && !Number.isNaN(min) && !Number.isNaN(max) && (num < min || num > max)) {
        return `O valor precisa ser entre ${min} e ${max}.`
      }
    }
    return null
  }
  if (question.required && !isAnswered(question, a)) return 'Este campo é obrigatório.'
  return null
}

function buildAnswer(question: PublicQuestion, a: any): Record<string, any> {
  const base: Record<string, any> = { question_id: question.id }
  switch (question.type) {
    case 'text_short':
      return { ...base, value_text: (a?.value_text ?? '') as string }
    case 'text_long': {
      const payload: Record<string, any> = { ...base, value_text: (a?.value_text ?? '') as string }
      if (a?.transcription) payload.transcription = a.transcription as string
      return payload
    }
    case 'multiple_choice':
      if (question.config?.multiple) {
        return { ...base, value_choices: Array.isArray(a?.value_choices) ? a.value_choices : [] }
      }
      return { ...base, value_text: (a?.value_text ?? '') as string }
    case 'scale':
      if (a?.na) return { ...base, scale_value: null }
      return { ...base, scale_value: a?.scale_value ?? null }
    case 'nps':
      return { ...base, scale_value: a?.scale_value ?? null }
    case 'ranking':
    case 'matrix':
    case 'dyn_list':
      return { ...base, value_choices: Array.isArray(a?.value_choices) ? a.value_choices : [] }
    case 'file_upload':
      return { ...base, file_name: (a?.file_name ?? '') as string }
    case 'datetime':
      return { ...base, value_text: [a?.date, a?.time].filter(Boolean).join(' ') }
    case 'number': {
      const raw = ((a?.value_text ?? '') as string).trim()
      const num = parseInt(raw, 10)
      if (raw !== '' && !Number.isNaN(num) && String(num) === raw) return { ...base, scale_value: num }
      return { ...base, value_text: raw }
    }
    case 'audio':
      return { ...base, transcription: (a?.transcription ?? '') as string }
    default:
      return base
  }
}

const BAR_HEIGHTS = [40, 65, 85, 55, 90, 70, 45, 80, 60, 95, 50, 75, 35, 85, 65, 40, 70, 55, 90, 45, 60]

const btnFlex: CSSProperties = { display: 'inline-flex', alignItems: 'center', gap: '.5rem' }

const centered: CSSProperties = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 40,
  textAlign: 'center',
}

function Spinner({ size = 13 }: { size?: number }) {
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

/* ── Áudio (texto longo + áudio) ──────────────────────────── */

interface AudioCompanionProps {
  maxDurationSecs?: number
  onRecorded: () => void
  onCleared: () => void
  onTranscription: (text: string) => void
}

export function AudioCompanion({ maxDurationSecs = 60, onRecorded, onCleared, onTranscription }: AudioCompanionProps) {
  const [status, setStatus] = useState<'empty' | 'recording' | 'transcribing' | 'recorded' | 'error'>('empty')
  const [elapsed, setElapsed] = useState(0)
  const [duration, setDuration] = useState(0)
  const [currentTime, setCurrentTime] = useState(0)
  const [playing, setPlaying] = useState(false)
  const [failed, setFailed] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const urlRef = useRef<string | null>(null)
  const timerRef = useRef<number | null>(null)
  const audioRef = useRef<HTMLAudioElement | null>(null)
  const elapsedRef = useRef(0)

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const finishRecording = () => {
    stopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else stopTracks()
  }

  const transcribeBlob = async (blob: Blob) => {
    setStatus('transcribing')
    try {
      const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' })
      const result = await transcribe(file)
      onTranscription(result.text ?? '')
      setStatus('recorded')
    } catch {
      onTranscription('')
      setFailed(true)
      setStatus('recorded')
    }
  }

  const start = async () => {
    setFailed(false)
    setElapsed(0)
    elapsedRef.current = 0
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (e) => {
        if (e.data.size > 0) chunksRef.current.push(e.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        blobRef.current = blob
        if (urlRef.current) URL.revokeObjectURL(urlRef.current)
        urlRef.current = URL.createObjectURL(blob)
        setCurrentTime(0)
        setPlaying(false)
        onRecorded()
        stopTracks()
        void transcribeBlob(blob)
      }
      recorder.start()
      setStatus('recording')
      timerRef.current = window.setInterval(() => {
        elapsedRef.current += 1
        setElapsed(elapsedRef.current)
        if (elapsedRef.current >= maxDurationSecs) finishRecording()
      }, 1000)
    } catch {
      stopTracks()
      setFailed(true)
      setStatus('error')
    }
  }

  const rerecord = () => {
    if (urlRef.current) {
      URL.revokeObjectURL(urlRef.current)
      urlRef.current = null
    }
    blobRef.current = null
    setPlaying(false)
    setCurrentTime(0)
    setDuration(0)
    setFailed(false)
    onCleared()
    onTranscription('')
    setStatus('empty')
  }

  const togglePlay = () => {
    const audio = audioRef.current
    if (!audio || !urlRef.current) return
    if (playing) {
      audio.pause()
      setPlaying(false)
    } else {
      void audio.play()
      setPlaying(true)
    }
  }

  useEffect(() => {
    return () => {
      stopTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      stopTracks()
      if (urlRef.current) URL.revokeObjectURL(urlRef.current)
    }
  }, [])

  return (
    <div>
      {(status === 'empty' || status === 'error') && (
        <>
          {status === 'error' && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '.66rem', color: 'var(--wine)', marginBottom: 8 }}>
              não foi possível acessar o microfone
            </div>
          )}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <button type="button" className="rec-btn" onClick={() => void start()}>
              <span className="rec-dot" />
              Gravar áudio
            </button>
            <span className="audio-hint">0:00</span>
          </div>
        </>
      )}

      {status === 'recording' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
          <button type="button" className="rec-btn recording" onClick={finishRecording}>
            <span className="rec-dot" />
            Parar
          </button>
          <span className="rec-timer">{formatTime(elapsed)}</span>
        </div>
      )}

      {status === 'transcribing' && (
        <div className="audio-waveform">
          <span className="play-btn">···</span>
          <div className="bars">{BAR_HEIGHTS.map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
          <span className="wave-time">transcrevendo…</span>
        </div>
      )}

      {status === 'recorded' && urlRef.current && (
        <>
          <div className="audio-waveform">
            <button type="button" className="play-btn" onClick={togglePlay}>
              {playing ? '❚❚' : <Play size={14} />}
            </button>
            <div className="bars">{BAR_HEIGHTS.map((h, i) => <span key={i} style={{ height: `${h}%` }} />)}</div>
            <span className="wave-time">
              {formatTime(Math.floor(currentTime))}/{formatTime(duration)}
            </span>
          </div>
          <span className="audio-rerecord" onClick={rerecord}>⟳ regravar</span>
          {failed && (
            <div style={{ fontFamily: 'var(--mono)', fontSize: '.64rem', color: 'var(--wine)', marginTop: 6 }}>
              não foi possível transcrever — o áudio permanece salvo
            </div>
          )}
        </>
      )}

      <audio
        ref={audioRef}
        src={urlRef.current ?? undefined}
        style={{ display: 'none' }}
        onLoadedMetadata={(e) => setDuration(Math.floor(e.currentTarget.duration))}
        onTimeUpdate={(e) => {
          setCurrentTime(e.currentTarget.currentTime)
          if (e.currentTarget.ended) setPlaying(false)
        }}
      />
    </div>
  )
}

/* ── Ranking ──────────────────────────────────────────────── */

export function RankingQuestion({
  options,
  value,
  onChange,
}: {
  options: string[]
  value: string[] | undefined
  onChange: (v: string[]) => void
}) {
  const order = Array.isArray(value) && value.length === options.length ? value : options
  const dragIndexRef = useRef<number | null>(null)
  const [overIndex, setOverIndex] = useState<number | null>(null)

  const move = (from: number, delta: number) => {
    const to = from + delta
    if (to < 0 || to >= order.length) return
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(to, 0, item)
    onChange(next)
  }

  // Soltar SOBRE um item: insere o arrastado na posição do alvo.
  const dropAt = (target: number) => (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault()
    e.stopPropagation()
    const from = dragIndexRef.current
    dragIndexRef.current = null
    setOverIndex(null)
    if (from === null || from === target) return
    const next = [...order]
    const [item] = next.splice(from, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div className="rank-list">
      {order.map((label, i) => (
        <div
          key={`${i}-${label}`}
          className={`rank-item ${overIndex === i ? 'drop-target' : ''}`}
          draggable
          onDragStart={(e) => {
            dragIndexRef.current = i
            e.dataTransfer.effectAllowed = 'move'
            e.dataTransfer.setData('text/plain', String(i))
          }}
          onDragEnd={() => {
            dragIndexRef.current = null
            setOverIndex(null)
          }}
          onDragOver={(e) => {
            e.preventDefault()
            e.stopPropagation()
            if (dragIndexRef.current !== null && dragIndexRef.current !== i) setOverIndex(i)
          }}
          onDragLeave={() => setOverIndex((v) => (v === i ? null : v))}
          onDrop={dropAt(i)}
        >
          <span className="rank-grip">⠿</span>
          <span className="rank-num">{i + 1}</span>
          <span className="rank-label">{label}</span>
          <span className="rank-move">
            <button
              type="button"
              className="rank-move-btn"
              aria-label={`Mover "${label}" para cima`}
              disabled={i === 0}
              onClick={() => move(i, -1)}
            >
              ↑
            </button>
            <button
              type="button"
              className="rank-move-btn"
              aria-label={`Mover "${label}" para baixo`}
              disabled={i === order.length - 1}
              onClick={() => move(i, 1)}
            >
              ↓
            </button>
          </span>
        </div>
      ))}
      <div
        className={`rank-drop-zone ${overIndex === order.length ? 'active' : ''}`}
        onDragOver={(e) => {
          e.preventDefault()
          setOverIndex(order.length)
        }}
        onDragLeave={() => setOverIndex((v) => (v === order.length ? null : v))}
        onDrop={dropAt(order.length)}
      />
    </div>
  )
}

/* ── Matriz ───────────────────────────────────────────────── */

export function MatrixQuestion({
  rows,
  cols,
  value,
  onChange,
}: {
  rows: string[]
  cols: string[]
  value: string[]
  onChange: (v: string[]) => void
}) {
  const getSelected = (row: string): string | null => {
    for (const s of value) {
      if (s.startsWith(`${row}:`)) return s.slice(row.length + 1)
    }
    return null
  }
  const select = (row: string, col: string) => {
    onChange([...value.filter((s) => !s.startsWith(`${row}:`)), `${row}:${col}`])
  }

  return (
    <>
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
                <td>{r}</td>
                {cols.map((c) => (
                  <td key={c}>
                    <span
                      className={`mat-radio ${getSelected(r) === c ? 'selected' : ''}`}
                      onClick={() => select(r, c)}
                    />
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="matrix-cards">
        {rows.map((r) => (
          <div className="mat-card" key={r}>
            <div className="mat-card-label">{r}</div>
            <div className="mat-card-opts">
              <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{cols[0]}</span>
              {cols.map((c) => (
                <span
                  key={c}
                  className={`mat-radio ${getSelected(r) === c ? 'selected' : ''}`}
                  style={{ margin: '0 .15rem' }}
                  onClick={() => select(r, c)}
                />
              ))}
              <span style={{ fontSize: '.7rem', color: 'var(--muted)' }}>{cols[cols.length - 1]}</span>
            </div>
          </div>
        ))}
      </div>
    </>
  )
}

/* ── Lista dinâmica ───────────────────────────────────────── */

export function DynListQuestion({
  value,
  suggestions,
  placeholder,
  onChange,
}: {
  value: string[]
  suggestions: string[]
  placeholder: string
  onChange: (v: string[]) => void
}) {
  const items = Array.isArray(value) ? value : []
  const dragIndexRef = useRef<number | null>(null)

  const update = (i: number, text: string) => onChange(items.map((it, j) => (j === i ? text : it)))
  const remove = (i: number) => onChange(items.filter((_, j) => j !== i))
  const add = (text = '') => onChange([...items, text])

  const dropOn = (target: number) => (e: DragEvent<HTMLLIElement>) => {
    e.preventDefault()
    const from = dragIndexRef.current
    dragIndexRef.current = null
    if (from === null || from === target) return
    const next = [...items]
    const [item] = next.splice(from, 1)
    next.splice(target, 0, item)
    onChange(next)
  }

  return (
    <div>
      <ul className="dyn-list">
        {items.map((item, i) => (
          <li
            key={`${i}-${item}`}
            className={`dyn-item ${dragIndexRef.current === i ? 'dragging' : ''}`}
            draggable
            onDragStart={(e) => {
              dragIndexRef.current = i
              e.dataTransfer.effectAllowed = 'move'
            }}
            onDragEnd={() => {
              dragIndexRef.current = null
            }}
            onDragOver={(e) => e.preventDefault()}
            onDrop={dropOn(i)}
          >
            <span className="dyn-grip">⠿</span>
            <span className="dyn-num">{i + 1}</span>
            <input type="text" value={item} placeholder={placeholder} onChange={(e) => update(i, e.target.value)} />
            <button type="button" className="dyn-del" onClick={() => remove(i)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <button type="button" className="dyn-add" onClick={() => add('')}>
        + adicionar etapa
      </button>
      {suggestions.length > 0 && (
        <div className="dyn-suggestions">
          <span className="dyn-sug-label">Sugestões — toque para adicionar</span>
          <div className="dyn-sug-chips">
            {suggestions.filter((s) => !items.includes(s)).map((s) => (
              <button type="button" key={s} className="dyn-chip" onClick={() => add(s)}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

/* ── Upload de arquivo ────────────────────────────────────── */

export function FileQuestion({
  accept,
  value,
  onChange,
}: {
  accept?: string
  value: Record<string, any>
  onChange: (v: Record<string, any>) => void
}) {
  const inputRef = useRef<HTMLInputElement | null>(null)
  const [dragging, setDragging] = useState(false)
  const fileName = (value?.file_name ?? '') as string
  const fileSize = (value?.file_size ?? '') as string

  const handleFiles = (files: FileList | null) => {
    const f = files?.[0]
    if (!f) return
    onChange({ file_name: f.name, file_size: formatSize(f.size) })
  }

  return (
    <div>
      <div
        className={`dropzone ${dragging ? 'drag' : ''}`}
        onClick={() => inputRef.current?.click()}
        onDragOver={(e) => {
          e.preventDefault()
          setDragging(true)
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          handleFiles(e.dataTransfer.files)
        }}
      >
        <span className="dz-icon">☁</span>
        <span className="dz-text">arraste aqui ou toque para selecionar</span>
      </div>
      <input ref={inputRef} type="file" accept={accept} style={{ display: 'none' }} onChange={(e) => handleFiles(e.target.files)} />
      {fileName && (
        <div className="file-item">
          <span className="file-ext">{fileExt(fileName)}</span>
          <span className="file-name">{fileName}</span>
          <span className="file-size">{fileSize}</span>
          <button type="button" className="file-del" onClick={() => onChange({})}>
            ×
          </button>
        </div>
      )}
    </div>
  )
}

/* ── Página ───────────────────────────────────────────────── */

export default function Survey() {
  const { slug } = useParams()
  const [status, setStatus] = useState<PageStatus>('loading')
  const [survey, setSurvey] = useState<PublicSurvey | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, any>>({})
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [focusedId, setFocusedId] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [submitFailed, setSubmitFailed] = useState(false)
  const startTimeRef = useRef<number | null>(null)

  const setAnswer = (qid: string, value: any) => {
    setAnswers((prev) => ({ ...prev, [qid]: value }))
    setErrors((prev) => {
      if (!prev[qid]) return prev
      const next = { ...prev }
      delete next[qid]
      return next
    })
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
      startTimeRef.current = Date.now()
      const questions: PublicQuestion[] = Array.isArray(data.questions) ? data.questions : []
      try {
        const raw = window.localStorage.getItem(`formly_draft_${slugValue}`)
        if (raw) {
          const parsed = JSON.parse(raw) as { index?: number; answers?: Record<string, any> }
          if (parsed.answers && typeof parsed.answers === 'object') setAnswers(parsed.answers)
          const total = Math.max(questions.length, 1)
          const idx = typeof parsed.index === 'number' ? parsed.index : 0
          setCurrentIndex(Math.min(Math.max(0, idx), total - 1))
          setStatus('ready')
          return
        }
      } catch {
        // rascunho corrompido — ignora
      }
      setStatus('intro')
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
    setErrors({})
    setCurrentIndex(0)
    void loadSurvey(slug)
  }, [slug, loadSurvey])

  const handleStart = () => {
    saveDraft(0)
    setErrors({})
    setCurrentIndex(0)
    setStatus('ready')
  }

  const goPrev = () => {
    if (!survey || currentIndex <= 0 || submitting) return
    setErrors({})
    const prev = currentIndex - 1
    saveDraft(prev)
    setCurrentIndex(prev)
  }

  const goNext = () => {
    if (!survey || submitting) return
    const question = survey.questions[currentIndex]
    const err = validate(question, answers[question.id])
    if (err) {
      setErrors({ [question.id]: err })
      return
    }
    setErrors({})
    const next = currentIndex + 1
    if (next >= survey.questions.length) {
      void handleSubmit()
    } else {
      saveDraft(next)
      setCurrentIndex(next)
    }
  }

  async function handleSubmit() {
    if (!survey || submitting) return
    if (getMode(survey) === 'scroll') {
      const errs: Record<string, string> = {}
      let first: string | null = null
      for (const q of survey.questions) {
        const msg = validate(q, answers[q.id])
        if (msg) {
          errs[q.id] = msg
          if (first === null) first = q.id
        }
      }
      setErrors(errs)
      if (first) {
        document.getElementById(`q-${first}`)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
        return
      }
    }
    setErrors({})
    setSubmitting(true)
    setSubmitFailed(false)
    try {
      const payload = survey.questions.map((q) => buildAnswer(q, answers[q.id]))
      await publicApi.submitResponse(slug ?? '', {
        respondent_ref: getRespondentRef(slug ?? ''),
        time_spent_secs: Math.round((Date.now() - (startTimeRef.current ?? Date.now())) / 1000),
        answers: payload,
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

  const handleBlur = (e: FocusEvent<HTMLDivElement>) => {
    const related = e.relatedTarget as Node | null
    if (!e.currentTarget.contains(related)) setFocusedId(null)
  }

  const renderAnswer = (question: PublicQuestion) => {
    const qid = question.id
    const config = question.config ?? {}
    const a = answers[qid]

    switch (question.type) {
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
        const outOfRange =
          hasBounds && num !== null && !Number.isNaN(num) && (num < min || num > max)
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

  if (status === 'loading') {
    return (
      <div style={centered}>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
          <span
            style={{
              width: 22,
              height: 22,
              border: '2px solid var(--line)',
              borderTopColor: 'var(--wine)',
              borderRadius: '50%',
              animation: 'spin 0.8s linear infinite',
              display: 'inline-block',
            }}
          />
          <span className="eyebrow">Carregando…</span>
        </div>
      </div>
    )
  }

  if (status === 'notfound') {
    return (
      <div style={centered}>
        <div style={{ maxWidth: 380 }}>
          <span className="eyebrow">Formly</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 8 }}>Questionário não encontrado</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: 6 }}>
            Este link pode estar incorreto ou o questionário foi removido.
          </p>
          <a className="btn ghost" href="https://formly.app" style={{ ...btnFlex, marginTop: 16 }}>
            Ir para Formly
          </a>
        </div>
      </div>
    )
  }

  if (status === 'error') {
    return (
      <div style={centered}>
        <div style={{ maxWidth: 380 }}>
          <span className="eyebrow">Formly</span>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, marginTop: 8 }}>Não foi possível carregar o questionário</h2>
          <p style={{ color: 'var(--muted)', fontSize: '.9rem', marginTop: 6 }}>
            Verifique sua conexão e tente novamente.
          </p>
          <button type="button" className="btn" style={{ ...btnFlex, marginTop: 16 }} onClick={() => slug && void loadSurvey(slug)}>
            <ArrowClockwise size={14} />
            Tentar novamente
          </button>
        </div>
      </div>
    )
  }

  if (!survey) return null

  const total = survey.questions.length
  const brandColors = (survey.brand_colors ?? {}) as Record<string, any>
  const introText =
    (brandColors.intro_text as string) || (brandColors.opening_text as string) || ''
  const closingText = (brandColors.closing_text as string) || ''
  const scrollMode = getMode(survey) === 'scroll'
  const logoUrl = (survey.logo_url as string | undefined) ?? ''

  if (status === 'intro') {
    return (
      <div style={centered}>
        <div className="wrap" style={{ width: '100%', maxWidth: 480 }}>
          <div className="screen-intro">
            <span className="eyebrow">Formly</span>
            <h2>{survey.title}</h2>
            {introText ? <p style={{ whiteSpace: 'pre-line' }}>{introText}</p> : null}
            <p style={{ fontSize: '.82rem', color: 'var(--muted)' }}>
              ~ {total} {total === 1 ? 'pergunta' : 'perguntas'}
            </p>
            <button type="button" className="btn" onClick={handleStart}>
              Começar
            </button>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'done') {
    return (
      <div style={centered}>
        <div className="wrap" style={{ width: '100%', maxWidth: 480 }}>
          <div className="screen-done">
            <span className="eyebrow">Concluído</span>
            <h2>obrigado</h2>
            <p>Suas respostas foram enviadas. Pode fechar esta janela.</p>
            {closingText ? <p style={{ whiteSpace: 'pre-line' }}>{closingText}</p> : null}
            <a
              href="https://formly.app"
              style={{ fontFamily: 'var(--mono)', fontSize: '.68rem', letterSpacing: '.06em', color: 'var(--wine)', textTransform: 'uppercase' }}
            >
              Criado com Formly
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (status === 'already') {
    return (
      <div style={centered}>
        <div className="wrap" style={{ width: '100%', maxWidth: 480 }}>
          <div className="screen-done">
            <span className="eyebrow">Formly</span>
            <h2>você já respondeu</h2>
            <p>Obrigado! Suas respostas já foram registradas.</p>
            <a
              href="https://formly.app"
              style={{ fontFamily: 'var(--mono)', fontSize: '.68rem', letterSpacing: '.06em', color: 'var(--wine)', textTransform: 'uppercase' }}
            >
              Criado com Formly
            </a>
          </div>
        </div>
      </div>
    )
  }

  if (status !== 'ready') return null

  if (total === 0) {
    return (
      <div style={centered}>
        <p style={{ color: 'var(--muted)', fontSize: '.9rem' }}>Este questionário ainda não tem perguntas.</p>
      </div>
    )
  }

  const question = survey.questions[currentIndex]
  const isLast = currentIndex === total - 1
  const progressPct = Math.round(((currentIndex + 1) / total) * 100)

  const renderCard = (q: PublicQuestion) => {
    const answered = isAnswered(q, answers[q.id])
    return (
      <div
        id={`q-${q.id}`}
        className={`q ${q.required ? 'q-required' : ''} ${focusedId === q.id ? 'focused' : ''} ${answered ? 'answered' : ''} ${errors[q.id] ? 'error' : ''}`}
        onFocusCapture={() => setFocusedId(q.id)}
        onBlurCapture={handleBlur}
      >
        <span className="q-kind">{kindBadge(q.type, q.config)}</span>
        <div className="q-label">{q.title}</div>
        {typeof q.config?.hint === 'string' && q.config.hint ? <div className="q-hint">{q.config.hint}</div> : null}
        {renderAnswer(q)}
        {errors[q.id] ? <div className="q-err">{errors[q.id]}</div> : null}
      </div>
    )
  }

  const renderFooter = (
    <span
      style={{
        display: 'block',
        textAlign: 'center',
        fontFamily: 'var(--mono)',
        fontSize: '.62rem',
        letterSpacing: '.06em',
        color: 'var(--muted)',
        marginTop: '2rem',
        textTransform: 'uppercase',
      }}
    >
      Criado com Formly
    </span>
  )

  const renderToast = submitFailed && (
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
        borderRadius: 'var(--radius)',
        border: '1.5px solid var(--wine)',
        background: 'var(--card)',
        color: 'var(--ink)',
        fontSize: 13,
        boxShadow: '0 8px 24px rgba(26,26,26,.12)',
        maxWidth: '90vw',
      }}
    >
      <Warning size={16} weight="fill" color="var(--wine)" />
      <span>Erro ao enviar. Suas respostas foram salvas neste dispositivo.</span>
      <button type="button" className="btn ghost" style={{ whiteSpace: 'nowrap' }} onClick={() => void handleSubmit()}>
        Tentar novamente
      </button>
    </div>
  )

  if (scrollMode) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
        <div className="wrap" style={{ width: '100%' }}>
          {logoUrl ? (
            <div style={{ textAlign: 'center', marginBottom: 24 }}>
              <img src={logoUrl} alt="" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
            </div>
          ) : (
            <span className="eyebrow" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
              {survey.title}
            </span>
          )}
          <div style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
            <h1 style={{ fontFamily: 'var(--display)', fontWeight: 700, fontSize: 'clamp(1.5rem,4vw,2rem)', letterSpacing: '-.02em' }}>
              {survey.title}
            </h1>
            {introText ? <p style={{ color: 'var(--muted)', fontSize: '.92rem', marginTop: 8 }}>{introText}</p> : null}
          </div>
          {survey.questions.map((q) => renderCard(q))}
          <div className="submit-sticky">
            <button type="button" className="btn" style={btnFlex} disabled={submitting} onClick={() => void handleSubmit()}>
              {submitting ? <Spinner size={13} /> : <Check size={14} weight="bold" />}
              {submitting ? 'Enviando…' : 'Enviar respostas'}
            </button>
          </div>
          {renderFooter}
        </div>
        {renderToast}
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      <div className="wrap" style={{ width: '100%' }}>
        {logoUrl ? (
          <div style={{ textAlign: 'center', marginBottom: 24 }}>
            <img src={logoUrl} alt="" style={{ height: 40, maxWidth: 160, objectFit: 'contain' }} />
          </div>
        ) : (
          <span className="eyebrow" style={{ display: 'block', textAlign: 'center', marginBottom: 24 }}>
            {survey.title}
          </span>
        )}

        <div key={question.id} className="q-in">
          {renderCard(question)}
        </div>

        <div className="nav-stage">
          <div className="progress-bar">
            <i style={{ width: `${progressPct}%` }} />
          </div>
          <div className="progress-info">
            {total <= 6 ? (
              survey.questions.map((q, i) => (
                <span key={q.id} className={i === currentIndex ? 'on' : ''}>
                  {i === currentIndex ? '●' : '○'} etapa {i + 1}
                </span>
              ))
            ) : (
              <span>
                Etapa {currentIndex + 1} de {total}
              </span>
            )}
          </div>
          <div className="nav-buttons">
            <button
              type="button"
              className="btn ghost"
              style={btnFlex}
              disabled={currentIndex === 0 || submitting}
              onClick={goPrev}
            >
              <ArrowLeft size={14} />
              Voltar
            </button>
            <span className="spacer" />
            <button type="button" className="btn" style={btnFlex} disabled={submitting} onClick={goNext}>
              {submitting ? (
                'Enviando…'
              ) : isLast ? (
                <>
                  <Check size={14} weight="bold" />
                  Enviar respostas
                </>
              ) : (
                <>
                  Avançar
                  <ArrowRight size={14} />
                </>
              )}
            </button>
          </div>
        </div>

        {renderFooter}
      </div>
      {renderToast}
    </div>
  )
}
