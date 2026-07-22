import { useState } from 'react'

interface Props {
  clientMsg: string
  label: string // el dato que falta (ej. "edad", "de dónde eres")
  onClose: () => void
  onSave: (value: string) => void
}

// Cuando el cliente pregunta un dato de ella que aún no sabemos, se lo pedimos a ELLA
// (es una persona real, no se inventa). Queda guardado para siempre y se reutiliza.
export function AskFactModal({ clientMsg, label, onClose, onSave }: Props): JSX.Element {
  const [value, setValue] = useState('')

  const save = (): void => {
    if (!value.trim()) return
    onSave(value.trim())
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 500 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>🙋 El cliente pregunta algo de ti</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="hint">
          La IA <b>no inventa</b> tus datos (eres real). Dinos tu respuesta real una sola vez:
          quedará <b>guardada para siempre</b> y la usará igual con todos, sin contradecirse.
        </p>

        {clientMsg && (
          <div className="info-card">
            <div className="k">El cliente preguntó</div>
            <div className="v">{clientMsg}</div>
          </div>
        )}

        <div className="info-card" style={{ borderColor: 'var(--primary)' }}>
          <div className="k">Necesita saber</div>
          <div className="v">{label}</div>
        </div>

        <div className="field">
          <label>Tu respuesta real</label>
          <input
            autoFocus
            type="text"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Escribe tu dato real..."
            onKeyDown={(e) => {
              if (e.key === 'Enter' && value.trim()) save()
            }}
          />
          <span className="hint">
            Se guarda como <b>{label}</b>. Podrás editarlo o borrarlo luego en Ajustes ⚙️ → “Sobre
            mí”.
          </span>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-new"
            style={{ flex: 'none', padding: '11px 24px' }}
            disabled={!value.trim()}
            onClick={save}
          >
            💾 Guardar y responder
          </button>
        </div>
      </div>
    </div>
  )
}
