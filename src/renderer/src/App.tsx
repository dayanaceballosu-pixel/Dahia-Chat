import { useEffect, useMemo, useState } from 'react'
import { Sidebar } from './components/Sidebar'
import { ChatPanel } from './components/ChatPanel'
import { InfoPanel } from './components/InfoPanel'
import { SettingsModal } from './components/SettingsModal'
import { NewChatModal } from './components/NewChatModal'
import { QuickCapture } from './components/QuickCapture'
import { FeedbackModal } from './components/FeedbackModal'
import { AskFactModal } from './components/AskFactModal'
import { ImportModal } from './components/ImportModal'
import type { Client } from './types'

export default function App(): JSX.Element {
  const [theme, setTheme] = useState<'light' | 'dark'>(
    () => (localStorage.getItem('theme') as 'light' | 'dark') || 'light'
  )
  const [collapsed, setCollapsed] = useState<boolean>(
    () => localStorage.getItem('collapsed') === '1'
  )
  const [clients, setClients] = useState<Client[]>([])
  const [activeId, setActiveId] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [showInfo, setShowInfo] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [showNewChat, setShowNewChat] = useState(false)
  const [showImport, setShowImport] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; username: string } | null>(null)
  const [capture, setCapture] = useState<string | null>(null) // texto del atajo global
  const [prefill, setPrefill] = useState<{ text: string; nonce: number } | null>(null)
  const [feedback, setFeedback] = useState<{ clientMsg: string; badReply: string } | null>(null)
  const [needFact, setNeedFact] = useState<{ clientMsg: string; label: string } | null>(null)
  const [toast, setToast] = useState('')
  const [engine, setEngine] = useState<'local' | 'api'>('local')
  const [copPerUsd, setCopPerUsd] = useState(4100)
  const [usageNonce, setUsageNonce] = useState(0) // sube tras cada generación → refresca el contador

  // Cargar config (motor local/API y tasa de pesos) para el contador de gasto
  const loadConfig = async (): Promise<void> => {
    const cfg = (await window.dahia.settings.get()) as {
      engine?: 'local' | 'api'
      copPerUsd?: number
    }
    setEngine(cfg.engine ?? 'local')
    setCopPerUsd(cfg.copPerUsd ?? 4100)
  }
  useEffect(() => {
    loadConfig()
  }, [])

  useEffect(() => {
    document.documentElement.setAttribute('data-theme', theme)
    localStorage.setItem('theme', theme)
  }, [theme])

  useEffect(() => {
    localStorage.setItem('collapsed', collapsed ? '1' : '0')
  }, [collapsed])

  // Cargar clientes de la base de datos al iniciar
  const refresh = async (selectFirst = false): Promise<Client[]> => {
    const list = (await window.dahia.db.listClients('')) as Client[]
    setClients(list)
    if (selectFirst && list.length && !activeId) setActiveId(list[0].id)
    return list
  }

  useEffect(() => {
    refresh(true)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Atajo global: abre el selector de "respuesta rápida" con el texto capturado
  useEffect(() => {
    if (!window.dahia) return
    const off = window.dahia.onQuickCapture((text) => {
      setCapture(text ?? '')
    })
    return off
  }, [])

  const activeClient = useMemo(
    () => clients.find((c) => c.id === activeId) ?? null,
    [clients, activeId]
  )

  const showToast = (): void => {
    window.setTimeout(() => setToast(''), 2200)
  }

  // Al elegir una sugerencia: guarda el mensaje del cliente (si lo hay) + la respuesta,
  // copia al portapapeles, y refresca desde la base de datos.
  const handlePick = async (herText: string, clientText: string): Promise<void> => {
    await window.dahia.copyToClipboard(herText)
    if (activeId) {
      if (clientText.trim()) {
        await window.dahia.db.addMessage(activeId, { from: 'client', text: clientText.trim() })
      }
      await window.dahia.db.addMessage(activeId, { from: 'her', text: herText })
      await refresh()
    }
    setToast('¡Copiado! Ya puedes pegarlo 💕')
    showToast()
  }

  const handleSaveClient = async (id: string, patch: Record<string, unknown>): Promise<void> => {
    await window.dahia.db.updateClient(id, patch)
    await refresh()
    setToast('Guardado ✓')
    showToast()
  }

  // Abrir un chat: además limpia el contador de "no leídos"
  const handleSelect = async (id: string): Promise<void> => {
    setActiveId(id)
    const c = clients.find((x) => x.id === id)
    if (c?.unread) {
      await window.dahia.db.clearUnread(id)
      await refresh()
    }
  }

  const handleCreate = async (username: string): Promise<void> => {
    if (await window.dahia.db.usernameExists(username)) {
      setToast('Ya existe un cliente con ese usuario')
      showToast()
      return
    }
    const created = (await window.dahia.db.createClient({ username })) as Client
    setShowNewChat(false)
    await refresh()
    setActiveId(created.id)
    setToast('Cliente creado ✓')
    showToast()
  }

  const handleDeleteClient = async (id: string): Promise<void> => {
    await window.dahia.db.deleteClient(id)
    setShowInfo(false)
    const list = await refresh()
    setActiveId(list[0]?.id ?? null)
    setToast('Cliente eliminado')
    showToast()
  }

  const handleRenameClient = async (id: string, username: string): Promise<void> => {
    await window.dahia.db.renameClient(id, username)
    await refresh()
    setToast('Usuario actualizado ✓')
    showToast()
  }

  // Corregir de qué lado es un mensaje (cliente ↔ ella)
  const handleFlipMessage = async (messageId: string): Promise<void> => {
    await window.dahia.db.flipMessage(messageId)
    await refresh()
  }

  const handleSaveFeedback = async (note: string): Promise<void> => {
    if (!feedback) return
    await window.dahia.db.addCorrection(feedback.clientMsg, feedback.badReply, note)
    setFeedback(null)
    setToast('🧠 Aprendido — se aplicará a todas las respuestas')
    showToast()
  }

  // Guardar el dato real de ella y volver a generar (ahora sí, sin inventar)
  const handleSaveFact = async (value: string): Promise<void> => {
    if (!needFact) return
    await window.dahia.db.upsertFact(needFact.label, value)
    const clientMsg = needFact.clientMsg
    setNeedFact(null)
    setToast('💾 Guardado para siempre — generando...')
    showToast()
    // Reintentar la generación con el dato ya conocido (vía prefill del ChatPanel)
    setPrefill({ text: clientMsg, nonce: performance.now() })
  }

  // Atajo global: enrutar el texto capturado a un chat existente
  const routeCapture = (clientId: string, text: string): void => {
    setActiveId(clientId)
    setCapture(null)
    if (text.trim()) setPrefill({ text: text.trim(), nonce: performance.now() })
  }

  // Atajo global: crear cliente nuevo y responderle de una (o ir al existente si ya está)
  const routeCaptureNew = async (username: string, text: string): Promise<void> => {
    const existing = clients.find((c) => c.username.toLowerCase() === username.toLowerCase())
    let targetId: string
    if (existing) {
      targetId = existing.id
    } else {
      const created = (await window.dahia.db.createClient({ username })) as Client
      await refresh()
      targetId = created.id
    }
    setActiveId(targetId)
    setCapture(null)
    if (text.trim()) setPrefill({ text: text.trim(), nonce: performance.now() })
  }

  return (
    <div className={`app ${collapsed ? 'compact' : ''}`}>
      <Sidebar
        clients={clients}
        activeId={activeId}
        query={query}
        theme={theme}
        collapsed={collapsed}
        engine={engine}
        copPerUsd={copPerUsd}
        usageNonce={usageNonce}
        onQuery={setQuery}
        onSelect={handleSelect}
        onNew={() => setShowNewChat(true)}
        onToggleTheme={() => setTheme((t) => (t === 'light' ? 'dark' : 'light'))}
        onOpenSettings={() => setShowSettings(true)}
        onToggleCollapse={() => setCollapsed((c) => !c)}
        onDeleteClient={(id, username) => setConfirmDelete({ id, username })}
      />

      <ChatPanel
        client={activeClient}
        onPickSuggestion={handlePick}
        onToggleInfo={() => setShowInfo((s) => !s)}
        onFeedback={(clientMsg, badReply) => setFeedback({ clientMsg, badReply })}
        prefill={prefill}
        copPerUsd={copPerUsd}
        onGenerated={() => setUsageNonce((n) => n + 1)}
        onNeedFact={(clientMsg, label) => setNeedFact({ clientMsg, label })}
        onImport={() => setShowImport(true)}
        onFlipMessage={handleFlipMessage}
      />

      {showInfo && activeClient && (
        <>
          <div className="info-backdrop" onClick={() => setShowInfo(false)} />
          <InfoPanel
            key={activeClient.id}
            client={activeClient}
            onClose={() => setShowInfo(false)}
            onSave={handleSaveClient}
            onDelete={handleDeleteClient}
            onRename={handleRenameClient}
          />
        </>
      )}

      {showNewChat && (
        <NewChatModal onClose={() => setShowNewChat(false)} onCreate={handleCreate} />
      )}

      {confirmDelete && (
        <div className="modal-overlay" onClick={() => setConfirmDelete(null)}>
          <div className="modal" style={{ maxWidth: 420 }} onClick={(e) => e.stopPropagation()}>
            <div className="modal-head">
              <h2>🗑 Borrar conversación</h2>
              <button className="icon-btn" onClick={() => setConfirmDelete(null)}>
                ✕
              </button>
            </div>
            <p className="hint">
              ¿Seguro que quieres borrar la conversación con <b>{confirmDelete.username}</b>? Se
              eliminan sus mensajes, notas y memoria. Esto <b>no se puede deshacer</b>.
            </p>
            <div className="modal-actions">
              <button className="btn-ghost" onClick={() => setConfirmDelete(null)}>
                Cancelar
              </button>
              <button
                className="btn-new"
                style={{ flex: 'none', padding: '11px 24px', background: '#e5484d' }}
                onClick={async () => {
                  const d = confirmDelete
                  setConfirmDelete(null)
                  await handleDeleteClient(d.id)
                }}
              >
                🗑 Borrar
              </button>
            </div>
          </div>
        </div>
      )}

      {showImport && activeClient && (
        <ImportModal
          clientId={activeClient.id}
          clientName={activeClient.username}
          onClose={() => setShowImport(false)}
          onDone={async (count) => {
            setShowImport(false)
            await refresh()
            setToast(`📥 Importado: ${count} mensajes de contexto`)
            showToast()
          }}
        />
      )}

      {capture !== null && (
        <QuickCapture
          clients={clients}
          initialText={capture}
          onClose={() => setCapture(null)}
          onPick={routeCapture}
          onNewChat={routeCaptureNew}
        />
      )}

      {feedback && (
        <FeedbackModal
          clientMsg={feedback.clientMsg}
          badReply={feedback.badReply}
          onClose={() => setFeedback(null)}
          onSave={handleSaveFeedback}
        />
      )}

      {needFact && (
        <AskFactModal
          clientMsg={needFact.clientMsg}
          label={needFact.label}
          onClose={() => setNeedFact(null)}
          onSave={handleSaveFact}
        />
      )}

      {showSettings && (
        <SettingsModal
          onClose={() => setShowSettings(false)}
          onSaved={() => {
            loadConfig()
            setUsageNonce((n) => n + 1)
            setToast('Ajustes guardados ✓')
            showToast()
          }}
        />
      )}

      <div className={`toast ${toast ? 'show' : ''}`}>{toast}</div>
    </div>
  )
}
