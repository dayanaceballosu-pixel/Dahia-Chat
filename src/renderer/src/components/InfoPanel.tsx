import { useState } from 'react'
import type { Client, Tag } from '../types'

interface Props {
  client: Client
  onClose: () => void
  onSave: (id: string, patch: Record<string, unknown>) => void
  onDelete: (id: string) => void
  onRename: (id: string, username: string) => void
}

const ALL_TAGS: Tag[] = ['VIP', 'habitual', 'nuevo', 'pesado']

export function InfoPanel({ client, onClose, onSave, onDelete, onRename }: Props): JSX.Element {
  const [language, setLanguage] = useState(client.language)
  const [mode, setMode] = useState(client.mode)
  const [notes, setNotes] = useState(client.memory.notes)
  const [likes, setLikes] = useState(client.memory.likes)
  const [turnOns, setTurnOns] = useState(client.memory.turnOns)
  const [spends, setSpends] = useState(client.memory.spends)
  const [tags, setTags] = useState<Tag[]>(client.tags)
  const [editingName, setEditingName] = useState(false)
  const [username, setUsername] = useState(client.username)
  const [confirmDel, setConfirmDel] = useState(false)

  const toggleTag = (t: Tag): void => {
    setTags((prev) => (prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t]))
  }

  const save = (): void => {
    onSave(client.id, {
      language,
      mode,
      tags,
      memory: { notes, likes, turnOns, spends }
    })
  }

  return (
    <aside className="info-panel">
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>Ficha del cliente</h3>
        <button className="icon-btn" onClick={onClose} title="Cerrar">
          ✕
        </button>
      </div>

      <div className="info-card">
        <div className="k">Usuario</div>
        {editingName ? (
          <div style={{ display: 'flex', gap: 6 }}>
            <input
              type="text"
              autoFocus
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              style={{
                flex: 1,
                padding: '7px 10px',
                borderRadius: 8,
                border: '1px solid var(--glass-border)',
                background: 'var(--glass)',
                color: 'var(--text)',
                fontFamily: 'var(--font)'
              }}
            />
            <button
              className="btn-new"
              style={{ flex: 'none', padding: '7px 12px' }}
              onClick={() => {
                if (username.trim() && username.trim() !== client.username) {
                  onRename(client.id, username.trim())
                }
                setEditingName(false)
              }}
            >
              ✓
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span className="v">{client.username}</span>
            <button className="icon-btn" title="Editar usuario" onClick={() => setEditingName(true)}>
              ✏️
            </button>
          </div>
        )}
      </div>

      <div className="field">
        <label>Idioma de este chat</label>
        <select value={language} onChange={(e) => setLanguage(e.target.value)}>
          <option>Español</option>
          <option>Inglés</option>
          <option>Portugués</option>
          <option>Francés</option>
        </select>
      </div>

      <div className="field">
        <label>Modo / tono</label>
        <select value={mode} onChange={(e) => setMode(e.target.value as Client['mode'])}>
          <option value="charla">💬 Charla</option>
          <option value="coqueto">😏 Coqueto</option>
          <option value="explicito">🔥 Explícito</option>
        </select>
      </div>

      <div>
        <div className="k" style={{ marginBottom: 6 }}>
          Etiquetas
        </div>
        <div className="tags-row">
          {ALL_TAGS.map((t) => (
            <span
              key={t}
              className="tag"
              style={{ opacity: tags.includes(t) ? 1 : 0.4, cursor: 'pointer' }}
              onClick={() => toggleTag(t)}
            >
              {tags.includes(t) ? '✓ ' : ''}
              {t}
            </span>
          ))}
        </div>
      </div>

      <div className="info-card">
        <div className="k">Le gusta</div>
        <textarea value={likes} onChange={(e) => setLikes(e.target.value)} placeholder="—" />
      </div>
      <div className="info-card">
        <div className="k">Le excita</div>
        <textarea value={turnOns} onChange={(e) => setTurnOns(e.target.value)} placeholder="—" />
      </div>
      <div className="info-card">
        <div className="k">Gasto</div>
        <textarea value={spends} onChange={(e) => setSpends(e.target.value)} placeholder="—" />
      </div>
      <div className="info-card">
        <div className="k">Notas manuales</div>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Anota lo que quieras recordar de este cliente..."
        />
      </div>

      {client.summary ? (
        <div className="info-card" style={{ borderColor: 'var(--primary-soft)' }}>
          <div className="k">🧠 Memoria automática (IA)</div>
          <div className="v" style={{ fontStyle: 'italic' }}>
            {client.summary}
          </div>
        </div>
      ) : null}

      <button className="btn-new" onClick={save}>
        💾 Guardar cambios
      </button>

      {!confirmDel ? (
        <button className="btn-danger" onClick={() => setConfirmDel(true)}>
          🗑 Borrar cliente
        </button>
      ) : (
        <div className="info-card" style={{ borderColor: '#ff8f8f' }}>
          <div className="v" style={{ marginBottom: 10 }}>
            ¿Seguro? Se borrará <b>{client.username}</b> y todo su historial. No se puede deshacer.
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn-ghost" style={{ flex: 1 }} onClick={() => setConfirmDel(false)}>
              Cancelar
            </button>
            <button className="btn-danger" style={{ flex: 1 }} onClick={() => onDelete(client.id)}>
              Sí, borrar
            </button>
          </div>
        </div>
      )}
    </aside>
  )
}
