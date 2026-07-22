// Tipos de datos de Dahia Chat (Fase 1: solo estructura, datos de ejemplo)

export type ChatMode = 'charla' | 'coqueto' | 'explicito'

export type Tag = 'VIP' | 'habitual' | 'nuevo' | 'pesado'

export interface Message {
  id: string
  // 'client' = lo que escribió el usuario (pegado por ella)
  // 'her' = la respuesta que ella eligió y envió
  from: 'client' | 'her'
  text: string
  time: string
}

export interface Client {
  id: string
  username: string // nombre de usuario en la plataforma (identificador)
  tags: Tag[]
  language: string // idioma de este chat (ej. 'Español', 'Inglés')
  mode: ChatMode
  lastActivity: string // texto relativo de ejemplo ("hace 5 min")
  unread?: number
  summary?: string // resumen automático de largo plazo
  summarizedCount?: number
  // Ficha que la IA recordará (Fase 3+). Por ahora, ejemplo.
  memory: {
    likes: string
    turnOns: string
    spends: string
    notes: string // notas manuales de ella
  }
  messages: Message[]
}

export interface Suggestion {
  id: string
  text: string
  withEmojis?: boolean
}
