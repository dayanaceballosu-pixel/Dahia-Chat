import { useState } from 'react'

interface Props {
  clientId: string
  clientName: string
  onClose: () => void
  onDone: (count: number) => void
}

// Pega una conversación larga previa → la IA la estructura (quién dijo qué) y queda
// como historial/contexto de ese cliente.
export function ImportModal({ clientId, clientName, onClose, onDone }: Props): JSX.Element {
  const [text, setText] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  const doImport = async (): Promise<void> => {
    if (!text.trim() || loading) return
    setLoading(true)
    setError('')
    const res = await window.dahia.ai.importConversation(clientId, text.trim())
    setLoading(false)
    if (res.error === 'parse-empty') {
      setError('No pude reconocer mensajes. Revisa que se vea la conversación (cliente y ella).')
    } else if (res.error === 'api-key-missing' || res.error === 'model-not-found') {
      setError('Configura primero el motor de IA en Ajustes ⚙️.')
    } else if (res.error) {
      setError('Ups, hubo un problema al importar. Intenta de nuevo.')
    } else {
      onDone(res.count ?? 0)
    }
  }

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" style={{ maxWidth: 560 }} onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>📥 Importar conversación</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        <p className="hint">
          Pega la conversación con <b>{clientName}</b> (como sea, tal cual la copiaste). La IA la
          ordenará sola —quién dijo qué— y quedará como <b>contexto</b>. Si el chat ya tiene mensajes,
          esto <b>se agrega al final</b> (no borra ni reinicia lo que ya hay).
        </p>

        <div className="field">
          <label>Conversación</label>
          <textarea
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={'Pega aquí toda la charla...\n\nEj:\nÉl: hola preciosa\nYo: hola guapo 😏\nÉl: ...'}
            style={{ minHeight: 200 }}
          />
          <span className="hint">
            Incluye ambos lados (lo que él escribió y lo que tú respondiste). No importa el formato ni
            el largo: puedes pegar la conversación <b>completa</b> (si es muy larga, tarda unos
            segundos más).
          </span>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--primary)', padding: '2px 2px 6px' }}>{error}</div>
        )}

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose} disabled={loading}>
            Cancelar
          </button>
          <button
            className="btn-new"
            style={{ flex: 'none', padding: '11px 24px' }}
            disabled={!text.trim() || loading}
            onClick={doImport}
          >
            {loading ? '🧠 Ordenando...' : '📥 Importar'}
          </button>
        </div>
      </div>
    </div>
  )
}
