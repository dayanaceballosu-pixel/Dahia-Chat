import { useState } from 'react'

interface Props {
  onClose: () => void
  onCreate: (username: string) => void
}

export function NewChatModal({ onClose, onCreate }: Props): JSX.Element {
  const [username, setUsername] = useState('')

  const create = (): void => {
    const u = username.trim()
    if (!u) return
    onCreate(u)
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>➕ Nuevo cliente</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="field">
          <label>Nombre de usuario del cliente</label>
          <input
            type="text"
            autoFocus
            placeholder="ej. Carlos_88"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') create()
              if (e.key === 'Escape') onClose()
            }}
          />
          <span className="hint">Así queda registrado e identificado en la app.</span>
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="btn-new"
            style={{ flex: 'none', padding: '11px 24px' }}
            onClick={create}
            disabled={!username.trim()}
          >
            Crear chat
          </button>
        </div>
      </div>
    </div>
  )
}
