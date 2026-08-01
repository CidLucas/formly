import type { CSSProperties, HTMLAttributes, ReactNode } from 'react'
import { DotsSixVertical, ArrowUp, ArrowDown, Copy, Trash, X, Plus, Hash } from '@phosphor-icons/react'
import type { Question } from '../lib/api'

const QUESTION_TYPES = ['text_short', 'text_long', 'multiple_choice', 'audio', 'scale', 'file_upload']

const TYPE_LABELS: Record<string, string> = {
  text_short: 'Texto curto',
  text_long: 'Texto longo',
  multiple_choice: 'Múltipla escolha',
  audio: 'Áudio',
  scale: 'Escala',
  file_upload: 'Upload de arquivo',
}

function Toggle({ checked, onChange, label }: { checked: boolean; onChange: (v: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        padding: '4px 10px',
        borderRadius: 'var(--r)',
        border: '1px solid var(--gb)',
        background: 'transparent',
        color: 'var(--mu2)',
        fontSize: 12,
        cursor: 'pointer',
      }}
    >
      <span
        style={{
          position: 'relative',
          width: 26,
          height: 14,
          borderRadius: 7,
          background: checked ? 'var(--ac)' : 'var(--gb2)',
          transition: 'background 0.2s',
        }}
      >
        <span
          style={{
            position: 'absolute',
            top: 2,
            left: checked ? 14 : 2,
            width: 10,
            height: 10,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s',
          }}
        />
      </span>
      {label}
    </button>
  )
}

function ActionButton({ onClick, icon, title }: { onClick?: () => void; icon: ReactNode; title: string }) {
  return (
    <button
      type="button"
      onClick={() => onClick?.()}
      title={title}
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        width: 26,
        height: 26,
        borderRadius: 'var(--r)',
        border: '1px solid var(--gb)',
        background: 'transparent',
        color: 'var(--mu2)',
        cursor: 'pointer',
      }}
    >
      {icon}
    </button>
  )
}

function FieldLabel({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 11, color: 'var(--mu2)', fontWeight: 500 }}>
      {label}
      {children}
    </label>
  )
}

const inputStyle: CSSProperties = {
  padding: '6px 10px',
  borderRadius: 'var(--r)',
  border: '1px solid var(--gb)',
  background: 'var(--surface)',
  color: 'var(--fg)',
  fontSize: 13,
  outline: 'none',
}

export interface QuestionCardProps {
  question: Question
  index: number
  onChange: (q: Question) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
  dragHandleProps?: HTMLAttributes<HTMLDivElement>
}

export default function QuestionCard({
  question,
  index,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
  dragHandleProps,
}: QuestionCardProps) {
  const config = question.config ?? {}

  const patchConfig = (patch: Record<string, any>) => {
    onChange({ ...question, config: { ...config, ...patch } })
  }

  const options: string[] = Array.isArray(config.options) ? config.options : []

  const addOption = () => patchConfig({ options: [...options, ''] })
  const updateOption = (i: number, value: string) =>
    patchConfig({ options: options.map((opt, j) => (j === i ? value : opt)) })
  const removeOption = (i: number) => patchConfig({ options: options.filter((_, j) => j !== i) })

  const maxCharsDefault = question.type === 'text_short' ? 500 : 5000

  return (
    <div
      style={{
        background: 'var(--glass)',
        border: '1px solid var(--gb)',
        borderRadius: 'var(--rl)',
        padding: 16,
        display: 'flex',
        flexDirection: 'column',
        gap: 12,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '3px 8px',
            borderRadius: 'var(--r)',
            background: 'var(--adim)',
            color: 'var(--ac-hi)',
            fontSize: 12,
            fontWeight: 600,
          }}
        >
          <Hash size={12} />
          {index + 1}
        </span>
        <select
          value={question.type}
          onChange={(e) => onChange({ ...question, type: e.target.value })}
          style={inputStyle}
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t}>
              {TYPE_LABELS[t] ?? t}
            </option>
          ))}
        </select>
        <Toggle checked={Boolean(question.required)} onChange={(v) => onChange({ ...question, required: v })} label="Obrigatória" />
        <div style={{ flex: 1 }} />
        {dragHandleProps ? (
          <div
            {...dragHandleProps}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'grab',
              color: 'var(--mu)',
              ...dragHandleProps.style,
            }}
          >
            <DotsSixVertical size={18} />
          </div>
        ) : null}
        <ActionButton onClick={onMoveUp} icon={<ArrowUp size={14} />} title="Mover para cima" />
        <ActionButton onClick={onMoveDown} icon={<ArrowDown size={14} />} title="Mover para baixo" />
        <ActionButton onClick={onDuplicate} icon={<Copy size={14} />} title="Duplicar" />
        <ActionButton onClick={onRemove} icon={<Trash size={14} />} title="Excluir" />
      </div>

      <input
        value={question.title}
        onChange={(e) => onChange({ ...question, title: e.target.value })}
        placeholder="Título da pergunta"
        style={{
          ...inputStyle,
          fontSize: 14,
          border: '1px solid transparent',
          background: 'var(--surface)',
        }}
      />

      {question.type === 'multiple_choice' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {options.map((opt, i) => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <input
                value={opt}
                onChange={(e) => updateOption(i, e.target.value)}
                placeholder={`Opção ${i + 1}`}
                style={inputStyle}
              />
              <ActionButton onClick={() => removeOption(i)} icon={<X size={14} />} title="Remover opção" />
            </div>
          ))}
          <button
            type="button"
            onClick={addOption}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              alignSelf: 'flex-start',
              padding: '6px 12px',
              borderRadius: 'var(--r)',
              border: '1px dashed var(--gb2)',
              background: 'transparent',
              color: 'var(--ac-hi)',
              fontSize: 12,
              cursor: 'pointer',
            }}
          >
            <Plus size={14} />
            Adicionar opção
          </button>
          <Toggle
            checked={Boolean(config.multiple)}
            onChange={(v) => patchConfig({ multiple: v })}
            label="Permitir múltipla seleção"
          />
        </div>
      )}

      {question.type === 'scale' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', gap: 12 }}>
            <FieldLabel label="Mínimo">
              <input
                type="number"
                min={1}
                max={10}
                value={config.min ?? 1}
                onChange={(e) => patchConfig({ min: Number(e.target.value) })}
                style={{ ...inputStyle, width: 80 }}
              />
            </FieldLabel>
            <FieldLabel label="Máximo">
              <input
                type="number"
                min={1}
                max={10}
                value={config.max ?? 5}
                onChange={(e) => patchConfig({ max: Number(e.target.value) })}
                style={{ ...inputStyle, width: 80 }}
              />
            </FieldLabel>
          </div>
          <div style={{ display: 'flex', gap: 12 }}>
            <FieldLabel label="Label mínimo (opcional)">
              <input
                value={config.label_min ?? ''}
                onChange={(e) => patchConfig({ label_min: e.target.value })}
                placeholder="Ex: Ruim"
                style={inputStyle}
              />
            </FieldLabel>
            <FieldLabel label="Label máximo (opcional)">
              <input
                value={config.label_max ?? ''}
                onChange={(e) => patchConfig({ label_max: e.target.value })}
                placeholder="Ex: Excelente"
                style={inputStyle}
              />
            </FieldLabel>
          </div>
        </div>
      )}

      {question.type === 'audio' && (
        <div style={{ display: 'flex', gap: 12 }}>
          <FieldLabel label="Duração máxima (segundos)">
            <input
              type="number"
              min={10}
              value={config.max_duration_secs ?? 60}
              onChange={(e) => patchConfig({ max_duration_secs: Number(e.target.value) })}
              style={{ ...inputStyle, width: 120 }}
            />
          </FieldLabel>
          <div style={{ display: 'flex', alignItems: 'flex-end', paddingBottom: 2 }}>
            <Toggle
              checked={Boolean(config.follow_up_enabled)}
              onChange={(v) => patchConfig({ follow_up_enabled: v })}
              label="Pergunta de acompanhamento"
            />
          </div>
        </div>
      )}

      {(question.type === 'text_short' || question.type === 'text_long') && (
        <FieldLabel label="Máximo de caracteres">
          <input
            type="number"
            value={config.max_chars ?? maxCharsDefault}
            onChange={(e) => patchConfig({ max_chars: Number(e.target.value) })}
            style={{ ...inputStyle, width: 120 }}
          />
        </FieldLabel>
      )}
    </div>
  )
}
