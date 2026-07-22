import { useMemo, useState } from 'react'
import type { Client } from '../types'

interface Props {
  clients: Client[]
  initialText: string
  onClose: () => void
  onPick: (clientId: string, text: string) => void
  onNewChat: (username: string, text: string) => void
}

export function QuickCapture({ clients, initialText, onClose, onPick, onNewChat }: Props): JSX.Element {
  const [text, setText] = useState(initialText)
  const [query, setQuery] = useState('')
  const [creating, setCreating] = useState(false)
  const [newUser, setNewUser] = useState('')

  const filtered = useMemo(
    () => clients.filter((c) => c.username.toLowerCase().includes(query.toLowerCase())),
    [clients, query]
  )

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 540 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>⚡ Respuesta rápida</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="field">
          <label>Mensaje del cliente (capturado)</label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="El texto que copiaste aparece aquí. Puedes editarlo."
            style={{ minHeight: 70 }}
          />
        </div>

        {!creating ? (
          <>
            <div className="field">
              <label>¿A qué chat va?</label>
              <div className="search-box">
                <span>🔍</span>
                <input
                  autoFocus
                  placeholder="Buscar cliente por usuario..."
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                />
              </div>
            </div>

            <button className="btn-ghost" onClick={() => setCreating(true)}>
              ＋ Nuevo cliente
            </button>

            <div className="chat-list" style={{ maxHeight: 280, flex: 'none' }}>
              {filtered.map((c) => {
                const last = c.messages[c.messages.length - 1]
                return (
                  <div key={c.id} className="chat-item" onClick={() => onPick(c.id, text)}>
                    <div className="avatar">{c.username.slice(0, 2).toUpperCase()}</div>
                    <div className="meta">
                      <div className="row">
                        <span className="name">{c.username}</span>
                        <span className="time">{c.lastActivity}</span>
                      </div>
                      <div className="preview">{last ? last.text : 'Sin mensajes'}</div>
                    </div>
                  </div>
                )
              })}
              {filtered.length === 0 && (
                <div style={{ padding: 12, color: 'var(--text-muted)', fontSize: 13 }}>
                  Sin coincidencias. Usa “＋ Nuevo cliente”.
                </div>
              )}
            </div>
          </>
        ) : (
          <div className="field">
            <label>Nombre de usuario del nuevo cliente</label>
            <input
              type="text"
              autoFocus
              value={newUser}
              placeholder="ej. Nuevo_User"
              onChange={(e) => setNewUser(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newUser.trim()) onNewChat(newUser.trim(), text)
              }}
            />
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setCreating(false)}>
                Volver
              </button>
              <button
                className="btn-new"
                style={{ flex: 'none', padding: '11px 24px' }}
                disabled={!newUser.trim()}
                onClick={() => onNewChat(newUser.trim(), text)}
              >
                Crear y responder
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
