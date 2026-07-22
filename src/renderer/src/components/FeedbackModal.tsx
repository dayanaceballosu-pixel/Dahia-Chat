import { useState } from 'react'

interface Props {
  clientMsg: string
  badReply: string
  onClose: () => void
  onSave: (note: string) => void
}

export function FeedbackModal({ clientMsg, badReply, onClose, onSave }: Props): JSX.Element {
  const [note, setNote] = useState('')

  const save = (): void => {
    if (!note.trim()) return
    onSave(note.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🚩 Corregir a la IA</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="hint">
          Esto le enseña a la IA para <b>todas</b> las respuestas futuras (de todos los clientes). Úsalo
          cuando una respuesta esté <b>mal</b> (no tiene sentido, error de lógica o gramática), no solo
          porque no te guste.
        </p>

        {clientMsg && (
          <div className="info-card">
            <div className="k">El cliente dijo</div>
            <div className="v">{clientMsg}</div>
          </div>
        )}
        <div className="info-card" style={{ borderColor: '#ff8f8f' }}>
          <div className="k">Respuesta incorrecta</div>
          <div className="v">{badReply}</div>
        </div>

        <div className="field">
          <label>¿Qué está mal? Explícalo</label>
          <textarea
            autoFocus
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder='ej. "Está al revés: si él dice que YO lo inspiro, no puedo decir que él me inspira. Lo correcto sería: me alegra inspirarte."'
            style={{ minHeight: 90 }}
          />
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-new"
            style={{ flex: 'none', padding: '11px 24px' }}
            disabled={!note.trim()}
            onClick={save}
          >
            🧠 Guardar aprendizaje
          </button>
        </div>
      </div>
    </div>
  )
}
