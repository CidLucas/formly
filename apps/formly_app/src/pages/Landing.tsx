import { useEffect, useRef, useState } from 'react'
import type { KeyboardEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { transcribe } from '../lib/api'

const INTENT_KEY = 'formly_intent'
const EMAIL_KEY = 'formly_email'
const NAME_KEY = 'formly_name'
const MAX_REC_SECS = 120 // 2 minutos

const fmtTime = (s: number) => {
  const m = Math.floor(s / 60)
  const r = s % 60
  return `${m}:${String(r).padStart(2, '0')}`
}

export default function Landing() {
  const navigate = useNavigate()
  const [text, setText] = useState('')
  const [recording, setRecording] = useState(false)
  const [elapsed, setElapsed] = useState(0)
  const [stage, setStage] = useState<'idle' | 'transcribing' | 'review'>('idle')
  const [transcript, setTranscript] = useState('')
  const [email, setEmail] = useState('')
  const [name, setName] = useState('')
  const [emailErr, setEmailErr] = useState(false)
  const [limitMsg, setLimitMsg] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const intervalRef = useRef<number | null>(null)

  const savedEmail = window.localStorage.getItem(EMAIL_KEY) || ''
  const needsEmail = !savedEmail

  const stopTracks = () => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }

  const clearTimer = () => {
    if (intervalRef.current !== null) {
      window.clearInterval(intervalRef.current)
      intervalRef.current = null
    }
  }

  const goToBuilder = (intent: string) => {
    const trimmed = intent.trim()
    if (!trimmed) return
    window.sessionStorage.setItem(INTENT_KEY, trimmed)
    navigate(`/builder?description=${encodeURIComponent(trimmed)}`)
  }

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key !== 'Enter' || !text.trim()) return
    if (needsEmail) {
      setTranscript(text.trim())
      setStage('review')
      return
    }
    goToBuilder(text)
  }

  const stopRecording = (autoStop = false) => {
    setRecording(false)
    clearTimer()
    if (autoStop) setLimitMsg(true)
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else stopTracks()
  }

  const sendForTranscription = async (blob: Blob) => {
    setStage('transcribing')
    try {
      const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' })
      const result = await transcribe(file)
      setTranscript(result.text)
      setStage('review')
    } catch {
      setStage('idle')
      alert('Não foi possível transcrever o áudio. Tente novamente.')
    }
  }

  const handleAudio = async () => {
    if (recording) {
      stopRecording()
      return
    }
    if (!navigator.mediaDevices || typeof MediaRecorder === 'undefined') {
      alert('Gravação de áudio requer HTTPS ou localhost. Abra via https:// ou http://localhost para usar.')
      return
    }
    setLimitMsg(false)
    setRecording(true)
    setElapsed(0)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream
      const recorder = new MediaRecorder(stream)
      recorderRef.current = recorder
      chunksRef.current = []
      recorder.ondataavailable = (event) => {
        if (event.data.size > 0) chunksRef.current.push(event.data)
      }
      recorder.onstop = () => {
        const blob = new Blob(chunksRef.current, { type: recorder.mimeType || 'audio/webm' })
        stopTracks()
        void sendForTranscription(blob)
      }
      recorder.start()
      intervalRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= MAX_REC_SECS) {
            window.setTimeout(() => stopRecording(true), 0)
            return MAX_REC_SECS
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      setRecording(false)
      clearTimer()
      stopTracks()
      alert('Não foi possível acessar o microfone. Verifique a permissão do navegador.')
    }
  }

  const confirmReview = () => {
    const emailOk = !needsEmail || /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email.trim())
    if (needsEmail && !emailOk) {
      setEmailErr(true)
      return
    }
    setEmailErr(false)
    if (needsEmail) {
      window.localStorage.setItem(EMAIL_KEY, email.trim())
      window.localStorage.setItem(NAME_KEY, name.trim() || email.split('@')[0] || '')
    }
    goToBuilder(transcript)
  }

  useEffect(() => {
    return () => {
      clearTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      stopTracks()
    }
  }, [])

  // ── render ────────────────────────────────────────────────
  if (stage === 'transcribing') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="landing">
          <div className="logo">formly</div>
          <div className="question" style={{ fontFamily: 'var(--mono)', fontSize: '0.9rem', color: 'var(--muted)' }}>
            Transcrevendo...
          </div>
        </div>
      </div>
    )
  }

  if (stage === 'review') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <div className="landing" style={{ maxWidth: 520 }}>
          <div className="logo">formly</div>
          <div className="question">Confira o texto</div>
          <textarea
            className="textarea-long"
            style={{ width: '100%', minHeight: 120 }}
            value={transcript}
            onChange={(e) => setTranscript(e.target.value)}
            placeholder="Transcrição do áudio..."
            autoFocus
          />
          {needsEmail && (
            <>
              <div className="section-label" style={{ alignSelf: 'flex-start', marginTop: 8 }}>
                Seu nome
              </div>
              <input
                type="text"
                className="email-input"
                style={{ width: '100%', marginBottom: 10 }}
                placeholder="Como podemos te chamar?"
                value={name}
                onChange={(e) => setName(e.target.value)}
              />
              <div className="section-label" style={{ alignSelf: 'flex-start' }}>
                Seu e-mail
              </div>
              <input
                type="email"
                className="email-input"
                style={{ width: '100%' }}
                placeholder="voce@exemplo.com"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value)
                  setEmailErr(false)
                }}
              />
              {emailErr && (
                <div style={{ color: 'var(--wine)', fontFamily: 'var(--body)', fontSize: '.82rem', marginTop: 6 }}>
                  Digite um e-mail válido.
                </div>
              )}
            </>
          )}
          <div style={{ display: 'flex', gap: 12, marginTop: 20, width: '100%' }}>
            <button
              type="button"
              className="btn ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setStage('idle')
                setTranscript('')
                setEmail('')
                setName('')
              }}
            >
              Refazer
            </button>
            <button type="button" className="btn" style={{ flex: 2 }} onClick={confirmReview}>
              Continuar →
            </button>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <div className="landing">
        <div className="logo">formly</div>

        <div className="question">Precisa de um questionário?</div>

        <div className="input-wrap">
          <input
            type="text"
            className="input-main"
            placeholder="Me fala qual, ou grave um áudio..."
            value={text}
            onChange={(event) => setText(event.target.value)}
            onKeyDown={handleKeyDown}
            autoFocus
          />
        </div>

        <div className="or-divider">ou</div>

        <button
          type="button"
          className={recording ? 'btn-audio recording' : 'btn-audio'}
          onClick={() => void handleAudio()}
        >
          <span className="audio-dot" />
          <span>{recording ? 'Parar' : 'Gravar áudio'}</span>
        </button>

        {recording && (
          <div className="mono" style={{ fontSize: '0.9rem', color: 'var(--wine)' }}>
            {fmtTime(elapsed)} / {fmtTime(MAX_REC_SECS)}
          </div>
        )}
        {limitMsg && (
          <div className="mono" style={{ fontSize: '0.78rem', color: 'var(--muted)' }}>
            Máximo de 2 minutos atingido.
          </div>
        )}
      </div>
    </div>
  )
}
