import { app, shell, BrowserWindow, globalShortcut, clipboard, ipcMain } from 'electron'
import { join } from 'path'
import { spawn } from 'child_process'
import * as db from './db'
import * as ai from './ai'
import { getSettings, saveSettings, type Settings } from './settings'
import { initUpdater } from './updater'

let mainWindow: BrowserWindow | null = null

interface ClientRow {
  language: string
  mode: 'charla' | 'coqueto' | 'explicito'
  memory: { likes: string; turnOns: string; spends: string; notes: string }
  summary: string
  summarizedCount: number
  messages: { from: 'client' | 'her'; text: string }[]
}

// Mantiene ~10 mensajes recientes tal cual; los anteriores se condensan en el resumen.
const RECENT_WINDOW = 10
const MIN_BATCH = 8

async function maybeSummarize(clientId: string, s: Settings): Promise<void> {
  const c = db.getClient(clientId) as ClientRow | null
  if (!c) return
  const total = c.messages.length
  const start = c.summarizedCount
  const olderEnd = total - RECENT_WINDOW
  const batch = c.messages.slice(start, olderEnd)
  if (batch.length < MIN_BATCH) return // aún no hace falta resumir
  try {
    const newSummary = await ai.summarize(c.summary, batch, s)
    db.updateSummary(clientId, newSummary, start + batch.length)
  } catch {
    /* si falla el resumen, seguimos sin bloquear la generación */
  }
}

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1100,
    height: 780,
    minWidth: 420,
    minHeight: 560,
    show: false,
    autoHideMenuBar: true,
    backgroundColor: '#ffeaf4',
    title: 'Dahia Chat',
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false,
      contextIsolation: true
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow?.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // Cargar renderer: dev server o archivos empaquetados
  if (process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// Simula Ctrl+C en la ventana que tenga el foco (la plataforma de cam) para copiar
// la selección actual SIN que ella tenga que apretar Ctrl+C. Solo Windows (su PC);
// en otros sistemas es un no-op y se usa lo que ya esté en el portapapeles.
// Sin dependencias nativas: usa PowerShell + SendKeys (nada que compilar).
function copySelection(): Promise<void> {
  return new Promise((resolve) => {
    if (process.platform !== 'win32') return resolve()
    try {
      const ps = spawn(
        'powershell.exe',
        [
          '-NoProfile',
          '-WindowStyle',
          'Hidden',
          '-Command',
          'Add-Type -AssemblyName System.Windows.Forms; [System.Windows.Forms.SendKeys]::SendWait("^c")'
        ],
        { windowsHide: true }
      )
      // Pequeña espera tras el Ctrl+C para que el portapapeles se actualice
      ps.on('exit', () => setTimeout(resolve, 120))
      ps.on('error', () => resolve())
    } catch {
      resolve()
    }
  })
}

// Atajo global: copia lo que ella tenga SELECCIONADO y trae la app al frente con ese texto.
function registerGlobalShortcut(): void {
  const ok = globalShortcut.register('CommandOrControl+Shift+D', async () => {
    if (!mainWindow) return
    // 1) Copiar la selección actual (en su plataforma) antes de robar el foco.
    const before = clipboard.readText()
    await copySelection()
    // 2) Lo recién copiado; si no había selección, cae en lo que ya estuviera copiado.
    const text = clipboard.readText() || before
    // 3) Traer la app al frente con el texto capturado.
    if (mainWindow.isMinimized()) mainWindow.restore()
    mainWindow.show()
    mainWindow.focus()
    mainWindow.webContents.send('quick-capture', text)
  })
  if (!ok) console.warn('No se pudo registrar el atajo global Ctrl+Shift+D')
}

app.whenReady().then(async () => {
  // Inicializar base de datos (y sembrar ejemplo la primera vez)
  await db.initDb()
  if (db.isEmpty()) db.seedSample()

  createWindow()
  registerGlobalShortcut()
  initUpdater(() => mainWindow) // auto-actualización (solo en la app instalada)

  // IPC: copiar al portapapeles la sugerencia elegida
  ipcMain.handle('clipboard:write', (_e, text: string) => {
    clipboard.writeText(text ?? '')
    return true
  })
  ipcMain.handle('clipboard:read', () => clipboard.readText())

  // IPC: base de datos
  ipcMain.handle('db:listClients', (_e, query: string) => db.listClients(query))
  ipcMain.handle('db:getClient', (_e, id: string) => db.getClient(id))
  ipcMain.handle('db:createClient', (_e, data: { username: string }) => db.createClient(data))
  ipcMain.handle('db:updateClient', (_e, id: string, patch: Record<string, unknown>) =>
    db.updateClient(id, patch)
  )
  ipcMain.handle('db:deleteClient', (_e, id: string) => db.deleteClient(id))
  ipcMain.handle('db:renameClient', (_e, id: string, username: string) =>
    db.renameClient(id, username)
  )
  ipcMain.handle('db:clearUnread', (_e, id: string) => db.clearUnread(id))
  ipcMain.handle('db:usernameExists', (_e, username: string) => db.usernameExists(username))
  ipcMain.handle('db:addMessage', (_e, clientId: string, msg: { from: 'client' | 'her'; text: string }) =>
    db.addMessage(clientId, msg)
  )
  ipcMain.handle('db:flipMessage', (_e, id: string) => db.flipMessage(id))

  // IPC: correcciones globales (retroalimentación)
  ipcMain.handle('db:listCorrections', () => db.listCorrections())
  ipcMain.handle('db:addCorrection', (_e, clientMsg: string, badReply: string, note: string) =>
    db.addCorrection(clientMsg, badReply, note)
  )
  ipcMain.handle('db:deleteCorrection', (_e, id: string) => db.deleteCorrection(id))

  // IPC: perfil real de Dahia (datos de ella, para no inventar)
  ipcMain.handle('db:listFacts', () => db.listFacts())
  ipcMain.handle('db:upsertFact', (_e, label: string, value: string) => db.upsertFact(label, value))
  ipcMain.handle('db:deleteFact', (_e, id: string) => db.deleteFact(id))

  // IPC: menú de servicios
  ipcMain.handle('db:listMenu', () => db.listMenu())
  ipcMain.handle('db:addMenuItem', (_e, name: string, price: string, description: string) =>
    db.addMenuItem(name, price, description)
  )
  ipcMain.handle('db:deleteMenuItem', (_e, id: string) => db.deleteMenuItem(id))

  // IPC: configuración
  ipcMain.handle('settings:get', () => getSettings())
  ipcMain.handle('settings:set', (_e, patch: Partial<Settings>) => saveSettings(patch))

  // IPC: IA
  ipcMain.handle('ai:status', async () => {
    const s = getSettings()
    return {
      modelFile: s.modelFile,
      modelPresent: ai.modelExists(s.modelFile),
      loaded: ai.isLoaded(),
      engine: s.engine,
      apiModel: s.apiModel,
      apiClassifierModel: s.apiClassifierModel,
      apiReady: !!(s.apiKey && s.apiKey.trim())
    }
  })

  ipcMain.handle('ai:generate', async (_e, clientId: string, incoming: string) => {
    const s = getSettings()
    // En modo local hace falta el modelo; en modo API hace falta la llave.
    if (s.engine === 'local' && !ai.modelExists(s.modelFile)) return { error: 'model-not-found' }
    if (s.engine === 'api' && !(s.apiKey && s.apiKey.trim())) return { error: 'api-key-missing' }
    try {
      // 1) Actualizar la memoria de largo plazo si la charla creció lo suficiente
      await maybeSummarize(clientId, s)
      // 2) Recargar el cliente (con el resumen fresco) y generar
      const client = db.getClient(clientId) as ClientRow | null
      if (!client) throw new Error('client-not-found')

      // 2.5) Si el cliente pregunta un DATO de ella que no sabemos, pedírselo a ella
      //      (nunca inventar: es una persona real). El dato quedará guardado para siempre.
      const facts = db.listFacts() as { label: string; value: string }[]
      // Momento + idioma del mensaje del cliente (una sola llamada). El idioma de la
      // RESPUESTA sigue al del cliente (si escribe en inglés, se responde en inglés).
      const { register, language: detectedLang } = await ai.classify(incoming, client.messages, s)
      const targetLang = detectedLang || client.language || 'Español'
      if (register === 'pregunta') {
        const missing = await ai.detectMissingFact(incoming, facts, client.messages, s)
        if (missing) {
          ai.takeUsage() // no generamos: descartamos el consumo de este chequeo
          return { needFact: missing }
        }
      }

      const corrections = db.listCorrections() as {
        clientMsg: string
        badReply: string
        note: string
      }[]
      const menu = db.listMenu() as { name: string; price: string; description?: string }[]
      const suggestions = await ai.generateSuggestions(
        {
          mode: client.mode,
          language: targetLang,
          memory: client.memory,
          summary: client.summary,
          corrections,
          facts,
          menu,
          register,
          history: client.messages,
          incoming
        },
        s
      )
      // Si el mensaje del cliente NO es en español, traducir al español para que ella
      // lo entienda (lo que se copia/envía sigue siendo el original en su idioma).
      let translations: string[] | undefined
      const lang = targetLang.toLowerCase()
      if (!lang.startsWith('espa')) {
        translations = await ai.translateToSpanish(suggestions, s)
      }

      // Costo de ESTA generación (clasificar + generar + traducir), para mostrarlo en vivo.
      const usage = ai.takeUsage()
      return {
        suggestions,
        translations,
        cost: usage.cost,
        tokens: usage.promptTokens + usage.completionTokens,
        model: s.engine === 'api' ? ai.getLastModel() : s.modelFile
      }
    } catch (err) {
      return { error: (err as Error).message || 'ai-error' }
    }
  })

  // IPC: importar una conversación pegada → la IA la estructura y se guarda como historial
  ipcMain.handle('ai:importConversation', async (_e, clientId: string, raw: string) => {
    const s = getSettings()
    if (s.engine === 'local' && !ai.modelExists(s.modelFile)) return { error: 'model-not-found' }
    if (s.engine === 'api' && !(s.apiKey && s.apiKey.trim())) return { error: 'api-key-missing' }
    const client = db.getClient(clientId) as { username?: string } | null
    if (!client) return { error: 'client-not-found' }
    try {
      const msgs = await ai.parseConversation(raw, s.personaName, client.username || '', s)
      ai.takeUsage()
      if (!msgs.length) return { error: 'parse-empty' }
      db.importMessages(clientId, msgs)
      return { count: msgs.length }
    } catch (err) {
      return { error: (err as Error).message || 'import-error' }
    }
  })

  // IPC: saldo/consumo de la llave de OpenRouter (para el contador de gasto)
  ipcMain.handle('ai:credit', async () => {
    const s = getSettings()
    if (s.engine !== 'api' || !(s.apiKey && s.apiKey.trim())) return { error: 'no-api' }
    try {
      const credit = await ai.getApiCredit(s)
      return { credit, copPerUsd: s.copPerUsd }
    } catch (err) {
      return { error: (err as Error).message || 'credit-error' }
    }
  })

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit()
})

app.on('will-quit', () => {
  globalShortcut.unregisterAll()
})
