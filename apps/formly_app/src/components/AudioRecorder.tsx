import { useCallback, useEffect, useRef, useState } from 'react'
import { Microphone, Stop, ArrowClockwise, PaperPlaneTilt, CheckCircle, Warning } from '@phosphor-icons/react'
import { transcribe } from '../lib/api'

type Status = 'idle' | 'recording' | 'recorded' | 'transcribing' | 'done' | 'error'

export interface AudioRecorderProps {
  onRecorded: (blob: Blob) => void
  onTranscription: (text: string) => void
  maxDurationSecs?: number
}

function formatTime(total: number): string {
  const mm = Math.floor(total / 60).toString().padStart(2, '0')
  const ss = (total % 60).toString().padStart(2, '0')
  return `${mm}:${ss}`
}

export default function AudioRecorder({ onRecorded, onTranscription, maxDurationSecs = 60 }: AudioRecorderProps) {
  const [status, setStatus] = useState<Status>('idle')
  const [elapsed, setElapsed] = useState(0)
  const [url, setUrl] = useState<string | null>(null)
  const [failed, setFailed] = useState(false)

  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<BlobPart[]>([])
  const streamRef = useRef<MediaStream | null>(null)
  const blobRef = useRef<Blob | null>(null)
  const timerRef = useRef<number | null>(null)

  const stopTimer = () => {
    if (timerRef.current !== null) {
      window.clearInterval(timerRef.current)
      timerRef.current = null
    }
  }

  const cleanupStream = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
  }

  const finishRecording = useCallback(() => {
    stopTimer()
    const recorder = recorderRef.current
    if (recorder && recorder.state !== 'inactive') recorder.stop()
    else cleanupStream()
  }, [])

  const start = useCallback(async () => {
    setFailed(false)
    setElapsed(0)
    if (url) {
      URL.revokeObjectURL(url)
      setUrl(null)
    }
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
        setUrl(URL.createObjectURL(blob))
        onRecorded(blob)
        cleanupStream()
        setStatus('recorded')
      }
      recorder.start()
      setStatus('recording')
      timerRef.current = window.setInterval(() => {
        setElapsed((prev) => {
          if (prev + 1 >= maxDurationSecs) {
            finishRecording()
            return maxDurationSecs
          }
          return prev + 1
        })
      }, 1000)
    } catch {
      cleanupStream()
      setFailed(true)
      setStatus('error')
    }
  }, [finishRecording, maxDurationSecs, onRecorded, url])

  const retry = () => {
    if (status === 'error') setStatus('idle')
    void start()
  }

  const submit = async () => {
    if (!blobRef.current) return
    setStatus('transcribing')
    try {
      const blob = blobRef.current
      const file = new File([blob], 'audio.webm', { type: blob.type || 'audio/webm' })
      const result = await transcribe(file)
      onTranscription(result.text)
      setFailed(false)
      setStatus('done')
    } catch {
      setFailed(true)
      onTranscription('')
      setStatus('error')
    }
  }

  useEffect(() => {
    return () => {
      stopTimer()
      const recorder = recorderRef.current
      if (recorder && recorder.state !== 'inactive') recorder.stop()
      cleanupStream()
      if (url) URL.revokeObjectURL(url)
    }
  }, [url])

  const mmss = formatTime(elapsed)

  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12,
        padding: 16,
        borderRadius: 'var(--rl)',
        border: '1px solid var(--gb)',
        background: 'var(--glass)',
      }}
    >
      {(status === 'idle' || status === 'recorded' || status === 'error') && (
        <button
          type="button"
          onClick={() => void start()}
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 56,
            height: 56,
            borderRadius: '50%',
            border: 'none',
            background: 'var(--ac-grad)',
            color: '#fff',
            cursor: 'pointer',
            boxShadow: 'var(--shadow-3)',
          }}
        >
          <Microphone size={24} weight="fill" />
        </button>
      )}

      {status === 'recording' && (
        <>
          <button
            type="button"
            onClick={finishRecording}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              width: 56,
              height: 56,
              borderRadius: '50%',
              border: '2px solid var(--urg)',
              background: 'var(--udim)',
              color: 'var(--urg)',
              cursor: 'pointer',
            }}
          >
            <Stop size={24} weight="fill" />
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'var(--urg)' }}>{mmss}</span>
            <div style={{ display: 'flex', alignItems: 'center', gap: 3, height: 28 }}>
              {Array.from({ length: 24 }).map((_, i) => (
                <span
                  key={i}
                  style={{
                    width: 3,
                    height: 8,
                    borderRadius: 2,
                    background: 'var(--urg)',
                    animation: `formly-wave ${0.5 + (i % 5) * 0.12}s ease-in-out ${i * 0.04}s infinite`,
                  }}
                />
              ))}
            </div>
          </div>
          <span style={{ fontSize: 12, color: 'var(--mu2)' }}>Gravando… toque para parar</span>
        </>
      )}

      {status === 'recorded' && url && (
        <>
          <audio controls src={url} style={{ width: '100%', maxWidth: 320 }} />
          <div style={{ display: 'flex', gap: 8 }}>
            <button
              type="button"
              onClick={retry}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--r)',
                border: '1px solid var(--gb2)',
                background: 'transparent',
                color: 'var(--mu2)',
                fontSize: 13,
                cursor: 'pointer',
              }}
            >
              <ArrowClockwise size={14} />
              Regravar
            </button>
            <button
              type="button"
              onClick={() => void submit()}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 6,
                padding: '7px 14px',
                borderRadius: 'var(--r)',
                border: 'none',
                background: 'var(--ac-grad)',
                color: '#fff',
                fontSize: 13,
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              <PaperPlaneTilt size={14} weight="fill" />
              Enviar e transcrever
            </button>
          </div>
        </>
      )}

      {status === 'transcribing' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--mu2)', fontSize: 13 }}>
          <span style={{ width: 14, height: 14, border: '2px solid var(--gb2)', borderTopColor: 'var(--ac)', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          Transcrevendo…
        </div>
      )}

      {status === 'done' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: 'var(--ok)', fontSize: 13, fontWeight: 500 }}>
          <CheckCircle size={16} weight="fill" />
          Transcrição concluída
        </div>
      )}

      {failed && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 8,
            width: '100%',
            padding: '8px 12px',
            borderRadius: 'var(--r)',
            background: 'var(--adm2)',
            border: '1px solid var(--att)',
            color: 'var(--att)',
            fontSize: 12,
          }}
        >
          <Warning size={14} weight="fill" />
          Não foi possível transcrever o áudio, mas ele permanece salvo.
        </div>
      )}
    </div>
  )
}
