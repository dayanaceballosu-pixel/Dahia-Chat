import { contextBridge, ipcRenderer } from 'electron'

// Puente seguro entre el proceso de Electron y la interfaz (React).
const api = {
  // Copiar al portapapeles (la sugerencia elegida)
  copyToClipboard: (text: string): Promise<boolean> =>
    ipcRenderer.invoke('clipboard:write', text),
  readClipboard: (): Promise<string> => ipcRenderer.invoke('clipboard:read'),
  // Escuchar el atajo global (texto capturado)
  onQuickCapture: (cb: (text: string) => void): (() => void) => {
    const listener = (_e: unknown, text: string): void => cb(text)
    ipcRenderer.on('quick-capture', listener)
    return () => ipcRenderer.removeListener('quick-capture', listener)
  },
  // Base de datos
  db: {
    listClients: (query = ''): Promise<unknown[]> => ipcRenderer.invoke('db:listClients', query),
    getClient: (id: string): Promise<unknown> => ipcRenderer.invoke('db:getClient', id),
    createClient: (data: { username: string }): Promise<unknown> =>
      ipcRenderer.invoke('db:createClient', data),
    updateClient: (id: string, patch: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('db:updateClient', id, patch),
    deleteClient: (id: string): Promise<boolean> => ipcRenderer.invoke('db:deleteClient', id),
    renameClient: (id: string, username: string): Promise<unknown> =>
      ipcRenderer.invoke('db:renameClient', id, username),
    clearUnread: (id: string): Promise<void> => ipcRenderer.invoke('db:clearUnread', id),
    usernameExists: (username: string): Promise<boolean> =>
      ipcRenderer.invoke('db:usernameExists', username),
    addMessage: (clientId: string, msg: { from: 'client' | 'her'; text: string }): Promise<unknown> =>
      ipcRenderer.invoke('db:addMessage', clientId, msg),
    flipMessage: (id: string): Promise<void> => ipcRenderer.invoke('db:flipMessage', id),
    // Correcciones globales (retroalimentación)
    listCorrections: (): Promise<
      { id: string; clientMsg: string; badReply: string; note: string }[]
    > => ipcRenderer.invoke('db:listCorrections'),
    addCorrection: (clientMsg: string, badReply: string, note: string): Promise<unknown> =>
      ipcRenderer.invoke('db:addCorrection', clientMsg, badReply, note),
    deleteCorrection: (id: string): Promise<boolean> =>
      ipcRenderer.invoke('db:deleteCorrection', id),
    // Perfil real de Dahia (datos de ella)
    listFacts: (): Promise<{ id: string; label: string; value: string }[]> =>
      ipcRenderer.invoke('db:listFacts'),
    upsertFact: (label: string, value: string): Promise<unknown> =>
      ipcRenderer.invoke('db:upsertFact', label, value),
    deleteFact: (id: string): Promise<boolean> => ipcRenderer.invoke('db:deleteFact', id),
    // Menú de servicios
    listMenu: (): Promise<{ id: string; name: string; price: string; description: string }[]> =>
      ipcRenderer.invoke('db:listMenu'),
    addMenuItem: (name: string, price: string, description: string): Promise<unknown> =>
      ipcRenderer.invoke('db:addMenuItem', name, price, description),
    deleteMenuItem: (id: string): Promise<boolean> => ipcRenderer.invoke('db:deleteMenuItem', id)
  },
  // Configuración
  settings: {
    get: (): Promise<unknown> => ipcRenderer.invoke('settings:get'),
    set: (patch: Record<string, unknown>): Promise<unknown> =>
      ipcRenderer.invoke('settings:set', patch)
  },
  // IA
  ai: {
    status: (): Promise<{
      modelFile: string
      modelPresent: boolean
      loaded: boolean
      engine: string
      apiModel?: string
      apiClassifierModel?: string
      apiReady?: boolean
    }> => ipcRenderer.invoke('ai:status'),
    generate: (
      clientId: string,
      incoming: string
    ): Promise<{
      suggestions?: string[]
      translations?: string[]
      cost?: number
      tokens?: number
      model?: string
      needFact?: string
      error?: string
    }> => ipcRenderer.invoke('ai:generate', clientId, incoming),
    // Importar una conversación pegada (la IA la estructura como historial)
    importConversation: (
      clientId: string,
      raw: string
    ): Promise<{ count?: number; error?: string }> =>
      ipcRenderer.invoke('ai:importConversation', clientId, raw),
    // Saldo/consumo de la llave (contador de gasto)
    credit: (): Promise<{
      credit?: {
        limit: number | null
        usage: number
        usageDaily: number
        usageMonthly: number
        remaining: number | null
        resetPeriod: string | null
      }
      copPerUsd?: number
      error?: string
    }> => ipcRenderer.invoke('ai:credit')
  }
}

contextBridge.exposeInMainWorld('dahia', api)

export type DahiaApi = typeof api
