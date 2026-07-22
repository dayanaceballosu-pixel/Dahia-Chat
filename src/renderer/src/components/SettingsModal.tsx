import { useEffect, useState } from 'react'

interface Settings {
  personaName: string
  personalityPrompt: string
  suggestionCount: number
  engine: 'local' | 'api'
  modelFile: string
  apiKey: string
  apiModel: string
  apiClassifierModel: string
}
interface AiStatus {
  modelFile: string
  modelPresent: boolean
  loaded: boolean
  engine: string
  apiReady?: boolean
}

// Modelos recomendados para el modo API (nube). El clasificador va aparte y fijo.
const API_MODELS = [
  { id: 'nousresearch/hermes-3-llama-3.1-70b', label: 'Hermes-3 70B — calidad + barato (recomendado)' },
  { id: 'anthracite-org/magnum-v4-72b', label: 'Magnum 72B — máxima calidad (más caro)' },
  { id: 'thedrummer/cydonia-24b-v4.1', label: 'Cydonia 24B — el más barato y rápido' },
  { id: 'gryphe/mythomax-l2-13b', label: 'Mythomax 13B — roleplay clásico, muy disponible' }
]
interface Correction {
  id: string
  clientMsg: string
  badReply: string
  note: string
}
interface Fact {
  id: string
  label: string
  value: string
}
interface MenuItem {
  id: string
  name: string
  price: string
  description: string
}

interface Props {
  onClose: () => void
  onSaved: () => void
}

export function SettingsModal({ onClose, onSaved }: Props): JSX.Element {
  const [s, setS] = useState<Settings | null>(null)
  const [status, setStatus] = useState<AiStatus | null>(null)
  const [corrections, setCorrections] = useState<Correction[]>([])
  const [facts, setFacts] = useState<Fact[]>([])
  const [newLabel, setNewLabel] = useState('')
  const [newValue, setNewValue] = useState('')
  const [menu, setMenu] = useState<MenuItem[]>([])
  const [newItemName, setNewItemName] = useState('')
  const [newItemPrice, setNewItemPrice] = useState('')
  const [newItemDesc, setNewItemDesc] = useState('')

  const loadCorrections = (): void => {
    window.dahia.db.listCorrections().then((c) => setCorrections(c as Correction[]))
  }
  const loadFacts = (): void => {
    window.dahia.db.listFacts().then((f) => setFacts(f as Fact[]))
  }
  const loadMenu = (): void => {
    window.dahia.db.listMenu().then((m) => setMenu(m as MenuItem[]))
  }

  useEffect(() => {
    window.dahia.settings.get().then((v) => setS(v as Settings))
    window.dahia.ai.status().then(setStatus)
    loadCorrections()
    loadFacts()
    loadMenu()
  }, [])

  const addItem = async (): Promise<void> => {
    if (!newItemName.trim()) return
    await window.dahia.db.addMenuItem(newItemName.trim(), newItemPrice.trim(), newItemDesc.trim())
    setNewItemName('')
    setNewItemPrice('')
    setNewItemDesc('')
    loadMenu()
  }
  const removeItem = async (id: string): Promise<void> => {
    await window.dahia.db.deleteMenuItem(id)
    loadMenu()
  }

  const addFact = async (): Promise<void> => {
    if (!newLabel.trim() || !newValue.trim()) return
    await window.dahia.db.upsertFact(newLabel.trim(), newValue.trim())
    setNewLabel('')
    setNewValue('')
    loadFacts()
  }
  const removeFact = async (id: string): Promise<void> => {
    await window.dahia.db.deleteFact(id)
    loadFacts()
  }

  const removeCorrection = async (id: string): Promise<void> => {
    await window.dahia.db.deleteCorrection(id)
    loadCorrections()
  }

  const save = async (): Promise<void> => {
    if (!s) return
    await window.dahia.settings.set({
      personaName: s.personaName,
      personalityPrompt: s.personalityPrompt,
      suggestionCount: Number(s.suggestionCount) || 3,
      engine: s.engine,
      apiKey: s.apiKey,
      apiModel: s.apiModel,
      apiClassifierModel: s.apiClassifierModel
    })
    onSaved()
    onClose()
  }

  if (!s) return <div />

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h2>⚙️ Ajustes</h2>
          <button className="icon-btn" onClick={onClose}>
            ✕
          </button>
        </div>

        {/* Motor de IA: Local vs API (nube) */}
        <div>
          <div className="section-label" style={{ padding: '0 0 8px' }}>
            Motor de IA
          </div>

          <div className="field" style={{ marginBottom: 10 }}>
            <label>¿De dónde salen las respuestas?</label>
            <select
              value={s.engine}
              onChange={(e) => setS({ ...s, engine: e.target.value as 'local' | 'api' })}
            >
              <option value="api">☁️ Nube (OpenRouter) — rápido, sin usar tu PC</option>
              <option value="local">💻 Local — gratis y sin internet (necesita el modelo)</option>
            </select>
          </div>

          {s.engine === 'api' ? (
            <>
              {status && (
                <div className="status-chip">
                  <span className={`status-dot ${status.apiReady ? 'on' : 'off'}`} />
                  {status.apiReady ? 'Llave configurada ✓' : 'Falta la llave de OpenRouter'}
                </div>
              )}
              <div className="field" style={{ marginTop: 8 }}>
                <label>Llave de OpenRouter (API key)</label>
                <input
                  type="password"
                  placeholder="sk-or-v1-..."
                  value={s.apiKey}
                  onChange={(e) => setS({ ...s, apiKey: e.target.value })}
                />
                <span className="hint">
                  Se guarda solo en tu PC. Consíguela en openrouter.ai → API Keys (ponle un tope de
                  crédito para controlar el gasto).
                </span>
              </div>
              <div className="field">
                <label>Modelo (el que escribe las respuestas)</label>
                <select
                  value={s.apiModel}
                  onChange={(e) => setS({ ...s, apiModel: e.target.value })}
                >
                  {API_MODELS.map((m) => (
                    <option key={m.id} value={m.id}>
                      {m.label}
                    </option>
                  ))}
                </select>
                <span className="hint">
                  El clasificador del momento usa <b>{s.apiClassifierModel}</b> (fijo, barato y
                  preciso). Puedes cambiar de modelo cuando quieras, sin descargar nada.
                </span>
              </div>
            </>
          ) : (
            <>
              {status && (
                <div className="status-chip">
                  <span className={`status-dot ${status.modelPresent ? 'on' : 'off'}`} />
                  {status.modelPresent
                    ? status.loaded
                      ? 'Modelo cargado y listo'
                      : 'Modelo instalado (se carga al generar)'
                    : 'Modelo aún no instalado'}
                </div>
              )}
              <div className="hint" style={{ marginTop: 8 }}>
                Modelo local: <b>{s.modelFile}</b>
                <br />
                {status && !status.modelPresent
                  ? 'La descarga se hace desde el proyecto. Cuando esté, aquí se pondrá verde.'
                  : 'Corre 100% en tu PC, sin internet.'}
              </div>
            </>
          )}
        </div>

        {/* Personalidad global */}
        <div className="field">
          <label>Nombre del personaje</label>
          <input
            type="text"
            value={s.personaName}
            onChange={(e) => setS({ ...s, personaName: e.target.value })}
          />
        </div>

        <div className="field">
          <label>Personalidad (moldéala a tu gusto)</label>
          <textarea
            value={s.personalityPrompt}
            onChange={(e) => setS({ ...s, personalityPrompt: e.target.value })}
          />
          <span className="hint">
            Describe cómo es ella: su forma de ser, cómo trata a los usuarios, su chispa. Esto guía
            TODAS las respuestas. El tono picante/charla se ajusta por chat aparte.
          </span>
        </div>

        <div className="field">
          <label>Cuántas sugerencias generar</label>
          <input
            type="number"
            min={1}
            max={5}
            value={s.suggestionCount}
            onChange={(e) => setS({ ...s, suggestionCount: Number(e.target.value) })}
          />
        </div>

        {/* Sobre mí: datos reales de ella (la IA nunca los inventa) */}
        <div>
          <div className="section-label" style={{ padding: '0 0 8px' }}>
            🙋 Sobre mí — datos reales ({facts.length})
          </div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Tus datos reales (edad, ciudad, a qué te dedicas...). La IA usa SOLO esto y nunca inventa.
            Si un cliente pregunta algo que no está aquí, la app te lo pedirá y se guardará solo.
          </div>
          {facts.map((f) => (
            <div key={f.id} className="correction-item">
              <div className="c-body">
                <div className="c-note">
                  <b>{f.label}:</b> {f.value}
                </div>
              </div>
              <button className="c-del" title="Borrar" onClick={() => removeFact(f.id)}>
                🗑
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="text"
              placeholder="Dato (ej. edad)"
              value={newLabel}
              onChange={(e) => setNewLabel(e.target.value)}
              style={{ flex: '0 0 38%' }}
            />
            <input
              type="text"
              placeholder="Valor (ej. 24)"
              value={newValue}
              onChange={(e) => setNewValue(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addFact()
              }}
              style={{ flex: 1 }}
            />
            <button
              className="btn-new"
              style={{ flex: 'none', padding: '0 16px' }}
              disabled={!newLabel.trim() || !newValue.trim()}
              onClick={addFact}
            >
              ＋
            </button>
          </div>
        </div>

        {/* Menú de servicios (lo que ofrece; la IA lo propone solo cuando encaja) */}
        <div>
          <div className="section-label" style={{ padding: '0 0 8px' }}>
            🍔 Mi menú de servicios ({menu.length})
          </div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Lo que ofreces y sus precios (ej. “Baile sexy — 50 tokens”). La IA lo propone SOLO cuando
            el momento lo permite (cliente caliente o si pregunta qué haces/precios) — nunca de forma
            invasiva ni en charla normal.
          </div>
          {menu.map((it) => (
            <div key={it.id} className="correction-item">
              <div className="c-body">
                <div className="c-note">
                  <b>{it.name}</b>
                  {it.price ? ` — ${it.price}` : ''}
                </div>
                {it.description && (
                  <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{it.description}</div>
                )}
              </div>
              <button className="c-del" title="Borrar" onClick={() => removeItem(it.id)}>
                🗑
              </button>
            </div>
          ))}
          <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
            <input
              type="text"
              placeholder="Servicio (ej. Control Domi)"
              value={newItemName}
              onChange={(e) => setNewItemName(e.target.value)}
              style={{ flex: 1 }}
            />
            <input
              type="text"
              placeholder="Precio (ej. 100 tokens)"
              value={newItemPrice}
              onChange={(e) => setNewItemPrice(e.target.value)}
              style={{ flex: '0 0 34%' }}
            />
          </div>
          <div style={{ display: 'flex', gap: 6, marginTop: 6 }}>
            <input
              type="text"
              placeholder="¿Qué es exactamente? (opcional, ej. el cliente controla mi juguete)"
              value={newItemDesc}
              onChange={(e) => setNewItemDesc(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') addItem()
              }}
              style={{ flex: 1 }}
            />
            <button
              className="btn-new"
              style={{ flex: 'none', padding: '0 16px' }}
              disabled={!newItemName.trim()}
              onClick={addItem}
            >
              ＋
            </button>
          </div>
        </div>

        {/* Correcciones aprendidas (memoria global de la IA) */}
        <div>
          <div className="section-label" style={{ padding: '0 0 8px' }}>
            🧠 Correcciones aprendidas ({corrections.length})
          </div>
          <div className="hint" style={{ marginBottom: 8 }}>
            Reglas que la IA aplica en TODAS las respuestas. Se crean con el botón 🚩 en cada
            sugerencia. Bórralas si ya no aplican.
          </div>
          {corrections.length === 0 ? (
            <div className="hint">Todavía no hay correcciones.</div>
          ) : (
            corrections.map((c) => (
              <div key={c.id} className="correction-item">
                <div className="c-body">
                  {c.badReply && (
                    <div style={{ color: 'var(--text-muted)' }}>
                      ✗ “{c.badReply.slice(0, 60)}
                      {c.badReply.length > 60 ? '…' : ''}”
                    </div>
                  )}
                  <div className="c-note">→ {c.note}</div>
                </div>
                <button className="c-del" title="Borrar" onClick={() => removeCorrection(c.id)}>
                  🗑
                </button>
              </div>
            ))
          )}
        </div>

        <div className="modal-actions">
          <button className="btn-ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="btn-new" style={{ flex: 'none', padding: '11px 24px' }} onClick={save}>
            💾 Guardar
          </button>
        </div>
      </div>
    </div>
  )
}
