import type { Client } from '../types'
import logo from '../assets/logo.png'
import { UsageMeter } from './UsageMeter'

interface Props {
  clients: Client[]
  activeId: string | null
  query: string
  theme: 'light' | 'dark'
  collapsed: boolean
  engine: 'local' | 'api'
  copPerUsd: number
  usageNonce: number
  onQuery: (q: string) => void
  onSelect: (id: string) => void
  onNew: () => void
  onToggleTheme: () => void
  onOpenSettings: () => void
  onToggleCollapse: () => void
  onDeleteClient?: (id: string, username: string) => void
}

function initials(name: string): string {
  return name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 2).toUpperCase()
}

export function Sidebar({
  clients,
  activeId,
  query,
  theme,
  collapsed,
  engine,
  copPerUsd,
  usageNonce,
  onQuery,
  onSelect,
  onNew,
  onToggleTheme,
  onOpenSettings,
  onToggleCollapse,
  onDeleteClient
}: Props): JSX.Element {
  const filtered = clients.filter((c) => c.username.toLowerCase().includes(query.toLowerCase()))

  // ---------- MODO COMPACTO (riel finito) ----------
  if (collapsed) {
    return (
      <aside className="sidebar collapsed">
        <button className="icon-btn" title="Expandir" onClick={onToggleCollapse}>
          ☰
        </button>
        <img className="mini-logo" src={logo} alt="Dahia" onClick={onToggleCollapse} />
        <button className="icon-btn accent" title="Nuevo chat" onClick={onNew}>
          ＋
        </button>
        <button className="icon-btn" title="Buscar" onClick={onToggleCollapse}>
          🔍
        </button>

        <div className="chat-list collapsed">
          {filtered.map((c) => (
            <button
              key={c.id}
              className={`avatar mini ${c.id === activeId ? 'active' : ''}`}
              title={c.username}
              onClick={() => onSelect(c.id)}
            >
              {initials(c.username)}
              {c.unread ? <span className="mini-badge">{c.unread}</span> : null}
            </button>
          ))}
        </div>

        <div className="sidebar-footer collapsed">
          {engine === 'api' && (
            <UsageMeter copPerUsd={copPerUsd} nonce={usageNonce} collapsed />
          )}
          <button className="icon-btn" title="Tema" onClick={onToggleTheme}>
            {theme === 'light' ? '🌙' : '☀️'}
          </button>
          <button className="icon-btn" title="Ajustes" onClick={onOpenSettings}>
            ⚙️
          </button>
        </div>
      </aside>
    )
  }

  // ---------- MODO NORMAL ----------
  return (
    <aside className="sidebar">
      <div className="brand">
        <img src={logo} alt="Dahia" />
        <div style={{ flex: 1 }}>
          <h1>Dahia Chat</h1>
          <small>Tu copiloto de respuestas</small>
        </div>
        <button className="icon-btn" title="Compactar" onClick={onToggleCollapse}>
          «
        </button>
      </div>

      <div className="search-box">
        <span>🔍</span>
        <input
          placeholder="Buscar cliente por usuario..."
          value={query}
          onChange={(e) => onQuery(e.target.value)}
        />
      </div>

      <button className="btn-new" onClick={onNew}>
        <span>＋</span> Nuevo chat
      </button>

      <div className="section-label">Conversaciones recientes</div>

      <div className="chat-list">
        {filtered.map((c) => {
          const last = c.messages[c.messages.length - 1]
          return (
            <div
              key={c.id}
              className={`chat-item ${c.id === activeId ? 'active' : ''}`}
              onClick={() => onSelect(c.id)}
            >
              <div className="avatar">{initials(c.username)}</div>
              <div className="meta">
                <div className="row">
                  <span className="name">{c.username}</span>
                  <span className="time">{c.lastActivity}</span>
                </div>
                <div className="preview">{last ? last.text : 'Sin mensajes'}</div>
              </div>
              {c.unread ? <span className="badge">{c.unread}</span> : null}
              <button
                title="Borrar conversación"
                onClick={(e) => {
                  e.stopPropagation()
                  onDeleteClient?.(c.id, c.username)
                }}
                style={{
                  background: 'transparent',
                  border: 'none',
                  cursor: 'pointer',
                  fontSize: 14,
                  opacity: 0.4,
                  padding: '0 2px',
                  alignSelf: 'center'
                }}
              >
                🗑
              </button>
            </div>
          )
        })}
        {filtered.length === 0 && (
          <div style={{ padding: '20px 12px', fontSize: 13, color: 'var(--text-muted)' }}>
            No hay clientes que coincidan.
          </div>
        )}
      </div>

      {engine === 'api' && (
        <div style={{ padding: '0 2px 8px' }}>
          <UsageMeter copPerUsd={copPerUsd} nonce={usageNonce} />
        </div>
      )}

      <div className="sidebar-footer">
        <button className="theme-toggle" onClick={onToggleTheme}>
          {theme === 'light' ? '🌙' : '☀️'}
          {theme === 'light' ? ' Modo oscuro' : ' Modo claro'}
        </button>
        <button className="icon-btn" title="Ajustes" onClick={onOpenSettings}>
          ⚙️
        </button>
      </div>
    </aside>
  )
}
