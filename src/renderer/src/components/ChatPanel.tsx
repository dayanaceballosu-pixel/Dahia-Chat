import { useEffect, useRef, useState } from 'react'
import type { Client } from '../types'
import { CatMascot } from './CatMascot'

const MODE_LABEL: Record<string, string> = {
  charla: '💬 Charla',
  coqueto: '😏 Coqueto',
  explicito: '🔥 Explícito'
}

// Nombre corto y amigable del modelo (para mostrar cuál respondió)
const MODEL_NAMES: Record<string, string> = {
  'thedrummer/cydonia-24b-v4.1': 'Cydonia 24B',
  'sao10k/l3.3-euryale-70b': 'Euryale 70B',
  'nousresearch/hermes-3-llama-3.1-70b': 'Hermes-3 70B',
  'gryphe/mythomax-l2-13b': 'Mythomax 13B',
  'thedrummer/rocinante-12b': 'Rocinante 12B',
  'anthracite-org/magnum-v4-72b': 'Magnum 72B'
}
function shortModel(id: string): string {
  return MODEL_NAMES[id] || id.split('/').pop() || id
}

interface Props {
  client: Client | null
  onPickSuggestion: (herText: string, clientText: string) => void
  onToggleInfo: () => void
  onFeedback: (clientMsg: string, badReply: string) => void
  // Texto inyectado desde el atajo global; al cambiar el nonce, se rellena y genera solo
  prefill?: { text: string; nonce: number } | null
  copPerUsd?: number
  onGenerated?: () => void // avisa a la app para refrescar el contador de gasto
  onNeedFact?: (clientMsg: string, label: string) => void // pedir un dato real de ella
  onImport?: () => void // abrir el modal de importar conversación
  onFlipMessage?: (messageId: string) => void // corregir de qué lado es un mensaje
}

export function ChatPanel({
  client,
  onPickSuggestion,
  onToggleInfo,
  onFeedback,
  prefill,
  copPerUsd = 4100,
  onGenerated,
  onNeedFact,
  onImport,
  onFlipMessage
}: Props): JSX.Element {
  const [incoming, setIncoming] = useState('')
  const [suggestions, setSuggestions] = useState<string[]>([]) // lo que se copia (idioma del chat)
  const [translations, setTranslations] = useState<string[]>([]) // traducción al español (para mostrar)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [elapsed, setElapsed] = useState(0) // segundos en vivo mientras genera
  const [lastMs, setLastMs] = useState<number | null>(null) // tiempo de la última generación
  const [lastCost, setLastCost] = useState<number | null>(null) // costo USD de la última generación
  const [lastModel, setLastModel] = useState<string>('') // modelo que respondió
  const timerRef = useRef<number | undefined>(undefined)

  const stopTimer = (): void => {
    if (timerRef.current !== undefined) {
      window.clearInterval(timerRef.current)
      timerRef.current = undefined
    }
  }

  // Al cambiar de cliente, limpiar el estado local (sin remontar el componente)
  const clientId = client?.id
  useEffect(() => {
    stopTimer()
    setIncoming('')
    setSuggestions([])
    setTranslations([])
    setError('')
    setLoading(false)
    setElapsed(0)
    setLastMs(null)
  }, [clientId])

  // Limpiar el cronómetro si el componente se desmonta
  useEffect(() => stopTimer, [])

  // Texto inyectado desde el atajo global → rellenar y generar automáticamente
  const prefillNonce = prefill?.nonce
  useEffect(() => {
    if (prefill && prefill.text && client) {
      generate(prefill.text)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [prefillNonce])

  if (!client) {
    return (
      <section className="chat-panel">
        <div className="empty">
          <div className="cat">
            <CatMascot size={130} />
          </div>
          <h2>Selecciona una conversación</h2>
          <p>
            Elige un cliente de la izquierda o crea uno nuevo. Aquí verás el historial y las
            sugerencias de respuesta.
          </p>
        </div>
      </section>
    )
  }

  const generate = async (textArg?: string): Promise<void> => {
    const text = (textArg ?? incoming).trim()
    if (!text || loading) return
    setIncoming(text)
    setLoading(true)
    setError('')
    setSuggestions([])
    setLastMs(null)
    setElapsed(0)
    const start = performance.now()
    timerRef.current = window.setInterval(() => {
      setElapsed((performance.now() - start) / 1000)
    }, 100)
    const res = await window.dahia.ai.generate(client.id, text)
    stopTimer()
    setLastMs(performance.now() - start)
    setLoading(false)
    if (res.error === 'model-not-found') {
      setError('Aún no hay un modelo de IA instalado. Ábrelo en Ajustes ⚙️ para descargarlo.')
    } else if (res.error === 'api-key-missing' || res.error === 'api-key-invalid') {
      setError('Falta la llave de OpenRouter o no es válida. Revísala en Ajustes ⚙️.')
    } else if (res.error === 'api-no-credit') {
      setError('Se acabó el crédito de OpenRouter. Recárgalo para seguir generando.')
    } else if (res.error === 'api-timeout' || res.error?.startsWith('api-')) {
      setError('Los servidores de IA están saturados ahora mismo. Intenta de nuevo en unos segundos.')
    } else if (res.needFact) {
      // El cliente pregunta un dato de ella que no sabemos → se lo pedimos a ella.
      onNeedFact?.(text, res.needFact)
    } else if (res.error) {
      setError('Ups, la IA tuvo un problema. Intenta de nuevo.')
    } else {
      setSuggestions(res.suggestions ?? [])
      setTranslations(res.translations ?? [])
      setLastCost(typeof res.cost === 'number' ? res.cost : null)
      setLastModel(res.model ?? '')
      onGenerated?.() // refrescar el contador de gasto
    }
  }

  const pick = (text: string): void => {
    onPickSuggestion(text, incoming)
    setSuggestions([])
    setIncoming('')
    setError('')
  }

  return (
    <section className="chat-panel">
      <header className="chat-header">
        <div className="avatar">{client.username.slice(0, 2).toUpperCase()}</div>
        <div className="meta">
          <h2>{client.username}</h2>
          <div className="sub">
            <span className="pill">{MODE_LABEL[client.mode]}</span>
            <span>🌐 {client.language}</span>
            {client.tags.map((t) => (
              <span key={t} className="tag">
                {t}
              </span>
            ))}
          </div>
        </div>
        <button
          className="icon-btn"
          title="Importar conversación previa"
          onClick={() => onImport?.()}
        >
          📥
        </button>
        <button className="icon-btn" title="Info del cliente" onClick={onToggleInfo}>
          ℹ️
        </button>
      </header>

      <div className="messages">
        {client.messages.length === 0 && (
          <div style={{ margin: 'auto', color: 'var(--text-muted)', fontSize: 13 }}>
            Sin mensajes todavía. Pega el primer mensaje del cliente abajo. 💕
          </div>
        )}
        {client.messages.map((m) => (
          <div key={m.id} className={`bubble-row ${m.from}`}>
            <button
              title="¿Lado equivocado? Cambiar entre cliente y ella"
              onClick={() => onFlipMessage?.(m.id)}
              style={{
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: 'var(--text-muted)',
                fontSize: 15,
                opacity: 0.45,
                padding: '0 5px',
                alignSelf: 'center'
              }}
            >
              ⇄
            </button>
            <div className={`bubble ${m.from}`}>
              {m.text}
              <span className="t">{m.time}</span>
            </div>
          </div>
        ))}
      </div>

      <div className="composer">
        <div className="composer-top">
          <textarea
            className="paste-area"
            placeholder="Pega aquí el mensaje del cliente... (Enter genera · Shift+Enter salto de línea)"
            value={incoming}
            onChange={(e) => setIncoming(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault()
                generate()
              }
            }}
          />
          <button className="btn-generate" onClick={() => generate()} disabled={loading}>
            {loading ? `💭 Pensando... ${elapsed.toFixed(1)}s` : '✨ Generar'}
          </button>
        </div>

        {error && (
          <div style={{ fontSize: 13, color: 'var(--primary)', padding: '4px 2px' }}>{error}</div>
        )}

        {loading && (
          <div className="suggestions-label">
            ⏱️ Generando... {elapsed.toFixed(1)}s
          </div>
        )}

        {suggestions.length > 0 && (
          <div className="suggestions">
            <div className="suggestions-head">
              <span className="suggestions-label">
                Elige una respuesta (se copia sola)
                {lastMs !== null && (
                  <span style={{ color: 'var(--primary)', marginLeft: 8 }}>
                    · ⏱️ {(lastMs / 1000).toFixed(1)}s
                  </span>
                )}
                {lastCost !== null && lastCost > 0 && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    · 💸 ${Math.round(lastCost * copPerUsd).toLocaleString('es-CO')}
                  </span>
                )}
                {lastModel && (
                  <span style={{ color: 'var(--text-muted)', marginLeft: 6 }}>
                    · 🤖 {shortModel(lastModel)}
                  </span>
                )}
              </span>
              <button
                className="regen-btn"
                onClick={() => generate(incoming)}
                disabled={loading}
                title="Generar otras opciones"
              >
                🔄 Regenerar
              </button>
            </div>
            {suggestions.map((s, i) => {
              const es = translations[i]
              const translated = !!es && es !== s
              return (
                <div key={i} className="suggestion">
                  <button className="suggestion-main" onClick={() => pick(s)}>
                    <span className="num">{i + 1}</span>
                    <span className="txt">
                      {translated ? es : s}
                      {translated && (
                        <span
                          style={{
                            display: 'block',
                            marginTop: 5,
                            color: 'var(--text-muted)',
                            fontSize: 12.5
                          }}
                        >
                          🇬🇧 {s}
                        </span>
                      )}
                    </span>
                    <span className="copy-hint">
                      {translated ? 'clic = copiar en inglés ✓' : 'clic = copiar ✓'}
                    </span>
                  </button>
                  <button
                    className="suggestion-flag"
                    title="Corregir a la IA (esta respuesta está mal)"
                    onClick={() => onFeedback(incoming, s)}
                  >
                    🚩
                  </button>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </section>
  )
}
