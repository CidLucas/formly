import { useEffect, useRef, useState } from 'react'
import { ArrowDown, ArrowUp, Check, CloudArrowUp, Copy, Trash, X } from '@phosphor-icons/react'
import type { Question } from '../lib/api'

interface TypeOption {
  label: string
  type: string
  multiple?: boolean
}

const TYPE_LIST: TypeOption[] = [
  { label: 'TEXTO CURTO', type: 'text_short' },
  { label: 'TEXTO LONGO', type: 'text_long' },
  { label: 'MÚLTIPLA [○]', type: 'multiple_choice', multiple: false },
  { label: '[✓✓]', type: 'multiple_choice', multiple: true },
  { label: 'ESCALA', type: 'scale' },
  { label: 'NPS', type: 'nps' },
  { label: 'RANKING', type: 'ranking' },
  { label: 'MATRIZ', type: 'matrix' },
  { label: 'ARQUIVO', type: 'file_upload' },
  { label: 'DATA', type: 'datetime' },
  { label: 'NÚMERO', type: 'number' },
  { label: 'LISTA', type: 'dyn_list' },
  { label: 'ÁUDIO', type: 'audio' },
]

function defaultConfig(type: string, multiple?: boolean): Record<string, any> {
  switch (type) {
    case 'text_short':
      return { max_chars: 500, placeholder: '' }
    case 'text_long':
      return { max_chars: 400, placeholder: '', audio_enabled: false }
    case 'multiple_choice':
      return { options: ['', ''], multiple: Boolean(multiple) }
    case 'audio':
      return { max_duration_secs: 60, follow_up_enabled: false }
    case 'scale':
      return { min: 1, max: 5, label_min: 'Discordo', label_max: 'Concordo', na_option: true }
    case 'nps':
      return { min: 0, max: 10 }
    case 'ranking':
      return { options: ['', '', ''] }
    case 'matrix':
      return { rows: ['', ''], columns: ['Ruim', 'Bom', 'Ótimo'] }
    case 'file_upload':
      return { allowed_types: ['pdf', 'docx', 'png'], max_size_mb: 10 }
    case 'datetime':
      return { include_time: true }
    case 'number':
      return { min: 1, max: 500 }
    case 'dyn_list':
      return { suggestions: ['Briefing', 'Produção', 'Entrega'], placeholder: 'Nome do item' }
    default:
      return {}
  }
}

function badgeLabel(question: Question): string {
  const cfg = question.config ?? {}
  switch (question.type) {
    case 'text_short':
      return 'TEXTO CURTO'
    case 'text_long':
      return 'TEXTO LONGO'
    case 'multiple_choice':
      return cfg.multiple ? '[✓✓]' : 'MÚLTIPLA [○]'
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
      return String(question.type ?? '').toUpperCase().replace(/_/g, ' ')
  }
}

function npsZone(n: number): string {
  if (n <= 6) return 'nps-zone-detractor'
  if (n <= 8) return 'nps-zone-neutral'
  return 'nps-zone-promoter'
}

function range(min: number, max: number): number[] {
  const out: number[] = []
  for (let v = min; v <= max; v++) out.push(v)
  return out
}

export interface QuestionCardProps {
  question: Question
  onChange: (q: Question) => void
  onRemove: () => void
  onDuplicate: () => void
  onMoveUp?: () => void
  onMoveDown?: () => void
}

export default function QuestionCard({
  question,
  onChange,
  onRemove,
  onDuplicate,
  onMoveUp,
  onMoveDown,
}: QuestionCardProps) {
  const [menuOpen, setMenuOpen] = useState(false)
  const [hintOpen, setHintOpen] = useState(false)

  const titleRef = useRef<HTMLTextAreaElement>(null)
  const resizeTitle = () => {
    const el = titleRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = el.scrollHeight + 'px'
  }
  useEffect(() => {
    resizeTitle()
  }, [question.title])

  const config = question.config ?? {}
  const required = Boolean(question.required)
  const hint = typeof config.hint === 'string' ? config.hint : ''

  const patchConfig = (patch: Record<string, any>) => onChange({ ...question, config: { ...config, ...patch } })

  const options: string[] = Array.isArray(config.options) ? config.options : []
  const rows: string[] = Array.isArray(config.rows) ? config.rows : []
  const columns: string[] = Array.isArray(config.columns) ? config.columns : []
  const suggestions: string[] = Array.isArray(config.suggestions) ? config.suggestions : []

  const addOption = () => patchConfig({ options: [...options, ''] })
  const updateOption = (i: number, value: string) =>
    patchConfig({ options: options.map((o, j) => (j === i ? value : o)) })
  const removeOption = (i: number) => patchConfig({ options: options.filter((_, j) => j !== i) })

  const addRow = () => patchConfig({ rows: [...rows, ''] })
  const updateRow = (i: number, value: string) => patchConfig({ rows: rows.map((r, j) => (j === i ? value : r)) })
  const removeRow = (i: number) => patchConfig({ rows: rows.filter((_, j) => j !== i) })

  const addColumn = () => patchConfig({ columns: [...columns, ''] })
  const updateColumn = (i: number, value: string) =>
    patchConfig({ columns: columns.map((c, j) => (j === i ? value : c)) })
  const removeColumn = (i: number) => patchConfig({ columns: columns.filter((_, j) => j !== i) })

  const addSuggestion = () => patchConfig({ suggestions: [...suggestions, ''] })
  const updateSuggestion = (i: number, value: string) =>
    patchConfig({ suggestions: suggestions.map((s, j) => (j === i ? value : s)) })
  const removeSuggestion = (i: number) => patchConfig({ suggestions: suggestions.filter((_, j) => j !== i) })

  const changeType = (t: TypeOption) => {
    const next = defaultConfig(t.type, t.multiple)
    if (Array.isArray(config.options) && (t.type === 'multiple_choice' || t.type === 'ranking')) {
      next.options = config.options
    }
    if (Array.isArray(config.rows) && t.type === 'matrix') next.rows = config.rows
    if (Array.isArray(config.columns) && t.type === 'matrix') next.columns = config.columns
    if (Array.isArray(config.suggestions) && t.type === 'dyn_list') next.suggestions = config.suggestions
    onChange({ ...question, type: t.type, config: next })
  }

  const isCurrent = (t: TypeOption): boolean => {
    if (question.type !== t.type) return false
    if (t.type === 'multiple_choice') return Boolean(config.multiple) === Boolean(t.multiple)
    return true
  }

  const min = Number(config.min) || 1
  const max = Number(config.max) || 5
  const maxChars = Number(config.max_chars) || (question.type === 'text_short' ? 500 : 5000)
  const multiple = Boolean(config.multiple)
  const audioEnabled = Boolean(config.audio_enabled)
  const includeTime = config.include_time !== false

  const renderBody = () => {
    switch (question.type) {
      case 'text_short':
        return (
          <>
            <input
              className="input-short"
              readOnly
              placeholder={(config.placeholder as string) || 'ex.: Atendimento · coordenação'}
            />
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Máx. caracteres</span>
                <input
                  type="number"
                  className="q-config-input num"
                  value={maxChars}
                  onChange={(e) => patchConfig({ max_chars: Number(e.target.value) })}
                />
              </label>
            </div>
          </>
        )
      case 'text_long':
        return (
          <>
            <textarea
              className="textarea-long"
              readOnly
              rows={4}
              placeholder={(config.placeholder as string) || 'Conte do jeito que vier...'}
            />
            <div className="q-counter">
              0/{maxChars}
            </div>
            {audioEnabled && (
              <>
                <div className="audio-divider">ou</div>
                <button type="button" className="rec-btn">
                  <span className="rec-dot" />
                  Gravar áudio
                </button>
              </>
            )}
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Máx. caracteres</span>
                <input
                  type="number"
                  className="q-config-input num"
                  value={maxChars}
                  onChange={(e) => patchConfig({ max_chars: Number(e.target.value) })}
                />
              </label>
              <label className="q-config-field">
                <span className="q-config-label">Áudio companion</span>
                <button
                  type="button"
                  className={`q-tool-btn ${audioEnabled ? 'on' : ''}`}
                  onClick={() => patchConfig({ audio_enabled: !audioEnabled })}
                >
                  {audioEnabled ? <Check size={12} weight="bold" /> : null}
                  {audioEnabled ? 'Sim' : 'Não'}
                </button>
              </label>
            </div>
          </>
        )
      case 'multiple_choice':
        return (
          <>
            <div className="choices">
              {options.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                  Nenhuma opção ainda — adicione uma abaixo.
                </span>
              ) : (
                options.map((opt, i) => (
                  <div className="choice" key={i}>
                    <span className={multiple ? 'check-ind' : 'radio-ind'} />
                    <input
                      className="choice-edit"
                      value={opt}
                      placeholder={`Opção ${i + 1}`}
                      onChange={(e) => updateOption(i, e.target.value)}
                      style={{ position: 'static', opacity: 1, pointerEvents: 'auto' }}
                    />
                    <button type="button" className="q-tool-btn" title="Remover opção" onClick={() => removeOption(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button type="button" className="add-option-link" onClick={addOption}>
              + opção
            </button>
          </>
        )
      case 'scale':
        return (
          <>
            <div className="likert">
              <div className="likert-row" style={{ position: 'relative' }}>
                <div className="likert-line" />
                {range(min, max).map((v) => (
                  <span className="likert-pt" key={v} />
                ))}
              </div>
              <div className="likert-labels">
                <span>{(config.label_min as string) || 'Discordo totalmente'}</span>
                <span>{(config.label_max as string) || 'Concordo totalmente'}</span>
              </div>
              <div className="likert-neutral">neutro</div>
              <label className="likert-na">
                <input type="radio" readOnly />
                <span
                  className="radio-ind"
                  style={{ width: '.9rem', height: '.9rem', borderRadius: '50%', border: '1.5px solid var(--muted)', display: 'inline-block' }}
                />
                Não sei / Não se aplica
              </label>
            </div>
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Mín.</span>
                <input
                  type="number"
                  className="q-config-input num"
                  min={1}
                  max={10}
                  value={min}
                  onChange={(e) => patchConfig({ min: Number(e.target.value) })}
                />
              </label>
              <label className="q-config-field">
                <span className="q-config-label">Máx.</span>
                <input
                  type="number"
                  className="q-config-input num"
                  min={1}
                  max={10}
                  value={max}
                  onChange={(e) => patchConfig({ max: Number(e.target.value) })}
                />
              </label>
              <label className="q-config-field" style={{ flex: 1, minWidth: 110 }}>
                <span className="q-config-label">Rótulo mín.</span>
                <input
                  className="q-config-input"
                  value={(config.label_min as string) ?? ''}
                  placeholder="Discordo"
                  onChange={(e) => patchConfig({ label_min: e.target.value })}
                />
              </label>
              <label className="q-config-field" style={{ flex: 1, minWidth: 110 }}>
                <span className="q-config-label">Rótulo máx.</span>
                <input
                  className="q-config-input"
                  value={(config.label_max as string) ?? ''}
                  placeholder="Concordo"
                  onChange={(e) => patchConfig({ label_max: e.target.value })}
                />
              </label>
            </div>
          </>
        )
      case 'nps':
        return (
          <>
            <div className="nps-row">
              {[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => (
                <span className={`nps-pt ${npsZone(n)}`} key={n}>
                  {n}
                </span>
              ))}
            </div>
            <div className="nps-labels">
              <span>Não recomendaria</span>
              <span>Com certeza recomendaria</span>
            </div>
          </>
        )
      case 'ranking':
        return (
          <>
            <div className="rank-list">
              {options.length === 0 ? (
                <span style={{ fontSize: 13, color: 'var(--muted)', fontStyle: 'italic' }}>
                  Nenhum item ainda — adicione abaixo.
                </span>
              ) : (
                options.map((opt, i) => (
                  <div className="rank-item" key={i}>
                    <span className="rank-grip">⠿</span>
                    <span className="rank-num">{i + 1}</span>
                    <input
                      className="rank-edit"
                      value={opt}
                      placeholder={`Item ${i + 1}`}
                      onChange={(e) => updateOption(i, e.target.value)}
                    />
                    <button type="button" className="q-tool-btn" title="Remover item" onClick={() => removeOption(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))
              )}
            </div>
            <button type="button" className="add-option-link" onClick={addOption}>
              + item
            </button>
          </>
        )
      case 'matrix':
        return (
          <>
            <div className="matrix-wrap">
              <table className="matrix">
                <thead>
                  <tr>
                    <th></th>
                    {columns.map((c, i) => (
                      <th key={i}>{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{r}</td>
                      {columns.map((_, j) => (
                        <td key={j}>
                          <span className="mat-radio" />
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="q-config">
              <div className="q-config-list">
                <span className="q-config-list-title">Linhas</span>
                {rows.map((r, i) => (
                  <div className="q-config-row" key={i}>
                    <input
                      className="q-config-input"
                      style={{ flex: 1 }}
                      value={r}
                      placeholder={`Linha ${i + 1}`}
                      onChange={(e) => updateRow(i, e.target.value)}
                    />
                    <button type="button" className="q-tool-btn" title="Remover linha" onClick={() => removeRow(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-option-link" onClick={addRow}>
                  + linha
                </button>
              </div>
              <div className="q-config-list">
                <span className="q-config-list-title">Colunas</span>
                {columns.map((c, i) => (
                  <div className="q-config-row" key={i}>
                    <input
                      className="q-config-input"
                      style={{ flex: 1 }}
                      value={c}
                      placeholder={`Coluna ${i + 1}`}
                      onChange={(e) => updateColumn(i, e.target.value)}
                    />
                    <button type="button" className="q-tool-btn" title="Remover coluna" onClick={() => removeColumn(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-option-link" onClick={addColumn}>
                  + coluna
                </button>
              </div>
            </div>
          </>
        )
      case 'file_upload':
        return (
          <div className="dropzone">
            <span className="dz-icon">
              <CloudArrowUp size="1em" />
            </span>
            <span className="dz-text">arraste aqui ou toque para selecionar</span>
          </div>
        )
      case 'datetime':
        return (
          <>
            <div className="datetime-row">
              <input type="text" placeholder="dd/mm/aaaa" value="15/08/2026" readOnly />
              {includeTime && <input type="text" placeholder="hh:mm" value="14:30" readOnly style={{ maxWidth: '8rem' }} />}
            </div>
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Incluir hora</span>
                <button
                  type="button"
                  className={`q-tool-btn ${includeTime ? 'on' : ''}`}
                  onClick={() => patchConfig({ include_time: !includeTime })}
                >
                  {includeTime ? <Check size={12} weight="bold" /> : null}
                  {includeTime ? 'Sim' : 'Não'}
                </button>
              </label>
            </div>
          </>
        )
      case 'number':
        return (
          <>
            <input className="input-num" type="number" value={String(min)} readOnly />
            <div className="num-meta">
              mín. {min} · máx. {max}
            </div>
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Mín.</span>
                <input
                  type="number"
                  className="q-config-input num"
                  value={min}
                  onChange={(e) => patchConfig({ min: Number(e.target.value) })}
                />
              </label>
              <label className="q-config-field">
                <span className="q-config-label">Máx.</span>
                <input
                  type="number"
                  className="q-config-input num"
                  value={max}
                  onChange={(e) => patchConfig({ max: Number(e.target.value) })}
                />
              </label>
            </div>
          </>
        )
      case 'dyn_list':
        return (
          <>
            <ul className="dyn-list">
              {suggestions.slice(0, 2).map((s, i) => (
                <li className="dyn-item" key={i}>
                  <span className="dyn-grip">⠿</span>
                  <span className="dyn-num">{i + 1}</span>
                  <input type="text" value={s} readOnly />
                  <button type="button" className="dyn-del">
                    ×
                  </button>
                </li>
              ))}
            </ul>
            <button type="button" className="dyn-add">
              + adicionar etapa
            </button>
            <div className="dyn-suggestions">
              <span className="dyn-sug-label">Sugestões — toque para adicionar</span>
              <div className="dyn-sug-chips">
                {suggestions.map((s, i) => (
                  <button type="button" className="dyn-chip" key={i}>
                    {s}
                  </button>
                ))}
              </div>
            </div>
            <div className="q-config">
              <label className="q-config-field" style={{ flex: 1, minWidth: 160 }}>
                <span className="q-config-label">Placeholder</span>
                <input
                  className="q-config-input"
                  value={(config.placeholder as string) ?? ''}
                  placeholder="Nome do item"
                  onChange={(e) => patchConfig({ placeholder: e.target.value })}
                />
              </label>
              <div className="q-config-list">
                <span className="q-config-list-title">Sugestões</span>
                {suggestions.map((s, i) => (
                  <div className="q-config-row" key={i}>
                    <input
                      className="q-config-input"
                      style={{ flex: 1 }}
                      value={s}
                      placeholder={`Sugestão ${i + 1}`}
                      onChange={(e) => updateSuggestion(i, e.target.value)}
                    />
                    <button type="button" className="q-tool-btn" title="Remover sugestão" onClick={() => removeSuggestion(i)}>
                      <X size={12} />
                    </button>
                  </div>
                ))}
                <button type="button" className="add-option-link" onClick={addSuggestion}>
                  + sugestão
                </button>
              </div>
            </div>
          </>
        )
      case 'audio':
        return (
          <>
            <button type="button" className="rec-btn">
              <span className="rec-dot" />
              Gravar áudio
            </button>
            <div className="q-config">
              <label className="q-config-field">
                <span className="q-config-label">Duração máx. (s)</span>
                <input
                  type="number"
                  className="q-config-input num"
                  min={10}
                  value={Number(config.max_duration_secs) || 60}
                  onChange={(e) => patchConfig({ max_duration_secs: Number(e.target.value) })}
                />
              </label>
            </div>
          </>
        )
      default:
        return <input className="input-short" readOnly placeholder="Resposta" />
    }
  }

  return (
    <div className="q-card">
      <div className="q-header">
        <textarea
          ref={titleRef}
          className="q-title-input"
          value={question.title}
          placeholder="Pergunta sem título"
          rows={1}
          wrap="soft"
          onChange={(e) => {
            onChange({ ...question, title: e.target.value })
            e.target.style.height = 'auto'
            e.target.style.height = e.target.scrollHeight + 'px'
          }}
        />
        {required && <span style={{ color: 'var(--wine)', fontFamily: 'var(--mono)', fontSize: '.8rem', marginLeft: 4 }}>*</span>}
        <div className="type-menu-wrap">
          <button type="button" className={`q-badge-btn ${menuOpen ? 'open' : ''}`} onClick={() => setMenuOpen((v) => !v)}>
            {badgeLabel(question)}
          </button>
          {menuOpen && (
            <>
              <div style={{ position: 'fixed', inset: 0, zIndex: 39 }} onClick={() => setMenuOpen(false)} />
              <div className="type-menu">
                {TYPE_LIST.map((t) => (
                  <button
                    type="button"
                    key={t.label}
                    className={`type-menu-item ${isCurrent(t) ? 'current' : ''}`}
                    onClick={() => {
                      changeType(t)
                      setMenuOpen(false)
                    }}
                  >
                    <span>{t.label}</span>
                    <Check size={12} weight="bold" className="tm-check" />
                  </button>
                ))}
              </div>
            </>
          )}
        </div>
      </div>

      {hint || hintOpen ? (
        <input
          className="q-hint-input"
          value={hint}
          placeholder="Adicionar descrição (opcional)"
          onChange={(e) => patchConfig({ hint: e.target.value })}
          onBlur={() => {
            if (!hint.trim()) setHintOpen(false)
          }}
        />
      ) : (
        <button type="button" className="q-hint-add" onClick={() => setHintOpen(true)}>
          + descrição
        </button>
      )}

      <div>{renderBody()}</div>

      <div className="q-toolbar">
        <button
          type="button"
          className={`q-tool-btn ${required ? 'on' : ''}`}
          onClick={() => onChange({ ...question, required: !required })}
        >
          {required ? <Check size={12} weight="bold" /> : null}
          Obrigatória
        </button>
        <span className="q-tool-sep" />
        <span style={{ flex: 1 }} />
        <button type="button" className="q-tool-btn" title="Mover para cima" disabled={!onMoveUp} onClick={onMoveUp}>
          <ArrowUp size={13} />
        </button>
        <button type="button" className="q-tool-btn" title="Mover para baixo" disabled={!onMoveDown} onClick={onMoveDown}>
          <ArrowDown size={13} />
        </button>
        <button type="button" className="q-tool-btn" title="Duplicar" onClick={onDuplicate}>
          <Copy size={13} />
        </button>
        <button type="button" className="q-tool-btn" title="Excluir" onClick={onRemove}>
          <Trash size={13} />
        </button>
      </div>
    </div>
  )
}
