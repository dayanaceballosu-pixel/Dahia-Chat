import { app } from 'electron'
import { join } from 'path'
import { existsSync } from 'fs'
import type { Settings } from './settings'

// Servicio de IA local (node-llama-cpp). Se importa de forma diferida (ESM).

/* eslint-disable @typescript-eslint/no-explicit-any */
let llamaMod: any = null
let llama: any = null
let model: any = null
let currentModelPath = ''

export function modelsDir(): string {
  return app.isPackaged ? join(app.getPath('userData'), 'models') : join(process.cwd(), 'models')
}
export function modelPath(file: string): string {
  return join(modelsDir(), file)
}
export function modelExists(file: string): boolean {
  return existsSync(modelPath(file))
}

async function ensureLlama(): Promise<any> {
  if (!llamaMod) llamaMod = await import('node-llama-cpp')
  return llamaMod
}

export async function getBackendInfo(): Promise<string> {
  const { getLlama } = await ensureLlama()
  if (!llama) llama = await getLlama()
  return llama.gpu ? `GPU: ${llama.gpu}` : 'CPU'
}

// ---------------------------------------------------------------------------
// Modo API (OpenRouter) — plan B: usa un modelo en la nube en vez del local.
// Compatible con OpenAI. No requiere dependencias: usa el fetch de Node/Electron.
// Arquitectura de 2 modelos (según pruebas): un instructivo barato para CLASIFICAR
// el momento (ministral-14b, 6/6 aciertos) y un modelo de roleplay sin censura
// para GENERAR (cydonia-24b, rápido; o euryale-70b premium).
// ---------------------------------------------------------------------------
// Hermes-3 70B como principal: calidad de 70B, sigue bien el contexto, proveedor
// DeepInfra (confiable), barato y rápido. Si falla o tarda >10s, salta a los respaldos.
const DEFAULT_GEN_MODEL = 'nousresearch/hermes-3-llama-3.1-70b'
const DEFAULT_CLS_MODEL = 'mistralai/ministral-14b-2512'
// Respaldos sin censura en PROVEEDORES DISTINTOS (Mancer, various, NextBit) para que
// sea casi imposible que fallen todos a la vez.
const GEN_FALLBACKS = [
  'anthracite-org/magnum-v4-72b', // Mancer — máxima calidad
  'thedrummer/cydonia-24b-v4.1', // barato, rápido
  'gryphe/mythomax-l2-13b' // NextBit — roleplay clásico, muy disponible
]

function generatorModel(s: Settings): string {
  return (s.apiModel || '').trim() || DEFAULT_GEN_MODEL
}

// Último modelo que realmente respondió (para mostrarlo en la UI y saber cuál sirve).
let lastGeneratorModel = ''
export function getLastModel(): string {
  return lastGeneratorModel
}
function classifierModel(s: Settings): string {
  return (s.apiClassifierModel || '').trim() || DEFAULT_CLS_MODEL
}

type ChatMsg = { role: 'system' | 'user' | 'assistant'; content: string }

interface ApiOpts {
  temperature: number
  topP?: number
  topK?: number
  repetitionPenalty?: number
  maxTokens: number
}

// Acumulador de consumo: cada llamada a la API suma aquí su costo/tokens. index.ts
// hace takeUsage() tras generar para saber cuánto costó ESA generación (clasificar+generar).
interface Usage {
  cost: number
  promptTokens: number
  completionTokens: number
  calls: number
}
let pendingUsage: Usage = { cost: 0, promptTokens: 0, completionTokens: 0, calls: 0 }
export function takeUsage(): Usage {
  const u = pendingUsage
  pendingUsage = { cost: 0, promptTokens: 0, completionTokens: 0, calls: 0 }
  return u
}

// Saldo real de la llave según OpenRouter (ya trae gastos por día/mes y lo que queda).
export interface ApiCredit {
  limit: number | null
  usage: number
  usageDaily: number
  usageMonthly: number
  remaining: number | null
  resetPeriod: string | null
}
export async function getApiCredit(s: Settings): Promise<ApiCredit> {
  const key = (s.apiKey || '').trim()
  if (!key) throw new Error('api-key-missing')
  const base = (s.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')
  const res = await fetch(`${base}/key`, { headers: { Authorization: `Bearer ${key}` } })
  if (!res.ok) throw new Error(`api-${res.status}`)
  const d = ((await res.json()) as { data?: Record<string, number | string | null> }).data || {}
  return {
    limit: (d.limit as number | null) ?? null,
    usage: (d.usage as number) ?? 0,
    usageDaily: (d.usage_daily as number) ?? 0,
    usageMonthly: (d.usage_monthly as number) ?? 0,
    remaining: (d.limit_remaining as number | null) ?? null,
    resetPeriod: (d.limit_reset as string | null) ?? null
  }
}

async function apiChat(model: string, messages: ChatMsg[], opts: ApiOpts, s: Settings): Promise<string> {
  const key = (s.apiKey || '').trim()
  if (!key) throw new Error('api-key-missing')
  const base = (s.apiBaseUrl || 'https://openrouter.ai/api/v1').replace(/\/+$/, '')

  const body: Record<string, unknown> = {
    model,
    messages,
    temperature: opts.temperature,
    top_p: opts.topP ?? 0.9,
    max_tokens: opts.maxTokens,
    // Desactiva el "razonamiento" en modelos que lo tengan: queremos respuesta
    // directa y rápida (los razonadores gastan tokens pensando → lentos y caros).
    reasoning: { enabled: false },
    // Prioriza los proveedores más rápidos (evita los que tardan 15-20s). El chat
    // es en vivo, la velocidad importa más que ahorrar centésimas de centavo.
    provider: { sort: 'throughput' }
  }
  if (opts.repetitionPenalty) body.repetition_penalty = opts.repetitionPenalty
  if (opts.topK) body.top_k = opts.topK

  // Timeout: si el modelo tarda más de 10s, abortamos y saltamos al respaldo
  // (nunca "pensando" eterno). Un proveedor sano responde en 2-6s.
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 10000)
  let res: Response
  try {
    res = await fetch(`${base}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
        'HTTP-Referer': 'https://dahia.chat',
        'X-Title': 'Dahia Chat'
      },
      body: JSON.stringify(body),
      signal: controller.signal
    })
  } catch (e) {
    if ((e as Error)?.name === 'AbortError') throw new Error('api-timeout')
    throw e
  } finally {
    clearTimeout(timer)
  }

  if (!res.ok) {
    const t = await res.text().catch(() => '')
    if (res.status === 401) throw new Error('api-key-invalid')
    if (res.status === 402) throw new Error('api-no-credit')
    throw new Error(`api-${res.status}: ${t.slice(0, 300)}`)
  }
  const data = (await res.json()) as {
    choices?: { message?: { content?: string } }[]
    usage?: { cost?: number; prompt_tokens?: number; completion_tokens?: number }
  }
  // Registrar consumo de esta llamada (OpenRouter devuelve el costo exacto en USD).
  const u = data.usage
  if (u) {
    pendingUsage.cost += u.cost || 0
    pendingUsage.promptTokens += u.prompt_tokens || 0
    pendingUsage.completionTokens += u.completion_tokens || 0
    pendingUsage.calls += 1
  }
  const content = data?.choices?.[0]?.message?.content
  if (!content) throw new Error('api-empty')
  return content
}

// Instrucciones del clasificador: devuelve MOMENTO + IDIOMA del último mensaje.
const CLASSIFY_SYSTEM = `Analizas el ÚLTIMO mensaje de un cliente hacia una chica en un chat para adultos y devuelves DOS datos:
1) MOMENTO: su estado/intención en UNA palabra de esta lista exacta:
- caliente (quiere verla, sexual, excitado, pide que le muestre algo)
- tierno (romántico, la halaga, cariñoso, sin pedir nada sexual)
- personal (habla de su vida, problemas, está triste o cansado)
- pregunta (le pregunta cosas de ELLA: edad, gustos, de dónde es)
- casual (charla ligera, risas, sin más)
- neutro (saludo simple, "hola ¿cómo estás?")
2) IDIOMA: el idioma del ÚLTIMO mensaje del cliente, escrito en español (Español, Inglés, Portugués, Francés, Italiano...). Si el mensaje es muy corto o ambiguo (ej. "ok", "jaja", solo emojis), escribe DEFAULT.
Ejemplos de momento: "hola preciosa"→neutro; "eres hermosa"→tierno; "muéstrame algo"→caliente; "tuve un día malo"→personal; "de dónde eres?"→pregunta; "jaja"→casual.
Responde EXACTAMENTE en este formato, sin nada más:
momento=<palabra>; idioma=<idioma>`

const REGISTER_RE = /caliente|tierno|personal|pregunta|casual|neutro/

export async function loadModel(file: string): Promise<void> {
  const path = modelPath(file)
  if (!existsSync(path)) throw new Error('model-not-found')
  if (model && currentModelPath === path) return
  const { getLlama } = await ensureLlama()
  if (!llama) llama = await getLlama()
  if (model) {
    try {
      await model.dispose()
    } catch {
      /* noop */
    }
    model = null
  }
  model = await llama.loadModel({ modelPath: path })
  currentModelPath = path
}

export function isLoaded(): boolean {
  return !!model
}

// Crea un contexto tolerante a poca VRAM: si el tamaño pedido no cabe, reintenta con menos.
async function createContextSafe(preferred: number): Promise<any> {
  const candidates = [preferred, 2048, 1536, 1024].filter((s) => s <= preferred)
  let lastErr: unknown
  for (const size of candidates) {
    try {
      return await model.createContext({ contextSize: size })
    } catch (err) {
      lastErr = err
    }
  }
  throw lastErr
}

export interface GenPayload {
  mode: 'charla' | 'coqueto' | 'explicito'
  language: string
  memory: { likes: string; turnOns: string; spends: string; notes: string }
  summary?: string // resumen automático de lo anterior (memoria de largo plazo)
  corrections?: { clientMsg: string; badReply: string; note: string }[] // aprendizaje global
  facts?: { label: string; value: string }[] // DATOS REALES de ella (nunca inventar)
  menu?: { name: string; price: string; description?: string }[] // servicios que ofrece
  history: { from: 'client' | 'her'; text: string }[]
  incoming: string
  register?: Register // si ya se clasificó, se pasa para no repetir el paso 1
}

function modeInstruction(mode: string): string {
  switch (mode) {
    case 'explicito':
      return 'Sé explícita y sexual, sin filtros (siempre legal y entre adultos). Sigue el deseo del usuario y llévalo más lejos.'
    case 'coqueto':
      return 'Coqueta, insinuante y juguetona. Sube la tensión y el morbo poco a poco, sin ser todavía explícita.'
    default:
      return 'Conversa cercana, cálida y con interés real en el usuario. Nada sexual salvo que el usuario lo lleve ahí.'
  }
}

type Register = 'caliente' | 'tierno' | 'personal' | 'pregunta' | 'casual' | 'neutro'

// Guion según el MOMENTO del cliente (lo elige el clasificador). Clave: en los registros
// NO sexuales el guion ni menciona la venta → es imposible vender a destiempo.
const GUION: Record<Register, string> = {
  caliente:
    'EL MOMENTO: está caliente o te pide verte / que le muestres algo. VENDE en 1-2 frases invitándolo al PRIVADO o proponiéndole UN ítem de TU MENÚ (elige lo que mejor encaje; NO listes todo el menú, ofrece máximo una cosa concreta): (1) valídalo y caliéntalo, (2) tease EN POSITIVO con promesa concreta de lo que ÉL va a ver/recibir ("aquí solo una probadita... en privado/en X te enseño todo"), (3) invitación clara con CTA. FOCO EN ÉL (lo que ÉL va a ver/recibir; NUNCA gires a que TÚ quieres verlo). Nunca lo des gratis, nunca enfríes, nunca lo dejes en un "casi" vago. Si te pide algo GRATIS aquí primero, NO cedas: reencuádralo con cariño y firmeza hacia el privado o el menú.',
  tierno:
    'EL MOMENTO: está romántico o te está halagando. Responde con calidez, hazlo sentir especial y coquetea suave. PROHIBIDO vender o mencionar el "privado". Cierra con una pregunta o un guiño que profundice la conexión.',
  personal:
    'EL MOMENTO: te habla de su vida o está bajón/cansado. Escúchalo de verdad, muestra interés genuino y hazle una pregunta que profundice. PROHIBIDO vender o mencionar el "privado": aquí primero va la conexión. Sin emojis alegres ni de burla.',
  pregunta:
    'EL MOMENTO: te pregunta cosas de TI (edad, gustos, de dónde eres…). Responde USANDO ÚNICAMENTE "TUS DATOS REALES" de arriba; jamás inventes ni cambies un dato tuyo. Sé cálida y DEVUÉLVELE la pregunta para crear intimidad. PROHIBIDO vender o mencionar el "privado".',
  casual:
    'EL MOMENTO: charla ligera o risas. Sigue la corriente con chispa y un coqueteo suave; mantén la conversación viva con una pregunta o un guiño. PROHIBIDO vender o mencionar el "privado".',
  neutro:
    'EL MOMENTO: saludo o mensaje neutro. Responde cálida y coqueta, muestra interés real y engancha con una pregunta. PROHIBIDO vender o mencionar el "privado" todavía.'
}

type Msg = { from: 'client' | 'her'; text: string }

// Arma un bloque con los últimos mensajes para dar CONTEXTO al clasificador/detector.
function recentContext(history: Msg[], persona: string): string {
  const h = (history || []).slice(-6)
  if (!h.length) return ''
  return h.map((m) => `${m.from === 'client' ? 'Cliente' : persona}: ${m.text}`).join('\n')
}

export interface Moment {
  register: Register
  language: string // idioma detectado del mensaje del cliente ('' = usar el del chat)
}

function parseMoment(raw: string): Moment {
  const txt = raw.replace(/[*`_]/g, '') // quita markdown que a veces agrega el modelo
  const regM = txt
    .toLowerCase()
    .match(/momento\s*=\s*(caliente|tierno|personal|pregunta|casual|neutro)/)
  const register = (regM ? regM[1] : txt.toLowerCase().match(REGISTER_RE)?.[0] || 'neutro') as Register
  const langM = txt.match(/idioma\s*=\s*([A-Za-zÁÉÍÓÚáéíóúñü]+)/i)
  let language = langM ? langM[1] : ''
  if (/default/i.test(language)) language = ''
  language = language ? language.charAt(0).toUpperCase() + language.slice(1).toLowerCase() : ''
  return { register, language }
}

// Paso 1: clasifica el MOMENTO del cliente + detecta el IDIOMA de su mensaje (una
// sola llamada barata). Usa el CONTEXTO de la conversación para no malinterpretar.
async function classifyMoment(incoming: string, history: Msg[], s: Settings): Promise<Moment> {
  const ctx = recentContext(history, s.personaName)
  const userMsg = ctx
    ? `Conversación reciente (contexto):\n${ctx}\n\nTeniendo en cuenta ese contexto, analiza el ÚLTIMO mensaje del cliente: "${incoming}"`
    : `Analiza este mensaje del cliente: "${incoming}"`

  // Modo API: usa el modelo instructivo barato (obediente para clasificar).
  if (s.engine === 'api') {
    try {
      const raw = await apiChat(
        classifierModel(s),
        [
          { role: 'system', content: CLASSIFY_SYSTEM },
          { role: 'user', content: userMsg }
        ],
        { temperature: 0, maxTokens: 24 },
        s
      )
      return parseMoment(raw)
    } catch {
      return { register: 'neutro', language: '' } // ante fallo, lo más seguro
    }
  }

  // Modo local (node-llama-cpp)
  const { LlamaChatSession } = await ensureLlama()
  const context = await createContextSafe(1024)
  try {
    const session = new LlamaChatSession({ contextSequence: context.getSequence() })
    const raw = await session.prompt(`${CLASSIFY_SYSTEM}\n\n${userMsg}`, {
      temperature: 0,
      maxTokens: 24
    })
    return parseMoment(raw)
  } finally {
    try {
      await context.dispose()
    } catch {
      /* noop */
    }
  }
}

// Expuesto para orquestar desde index.ts: clasificar una sola vez y reusar.
export async function classify(incoming: string, history: Msg[], s: Settings): Promise<Moment> {
  return classifyMoment(incoming, history, s)
}

// Detecta si el cliente pide un DATO PERSONAL de ella que aún no conocemos.
// Devuelve una etiqueta corta de ese dato (para pedírselo a ella) o null.
export async function detectMissingFact(
  incoming: string,
  facts: { label: string; value: string }[],
  history: Msg[],
  s: Settings
): Promise<string | null> {
  const known = facts.length ? facts.map((f) => `- ${f.label}: ${f.value}`).join('\n') : '(ninguno)'
  const ctx = recentContext(history, s.personaName)
  const sys =
    'Analizas el mensaje de un cliente hacia una chica de webcam (persona REAL). Decides si el ' +
    'cliente le PIDE EXPLÍCITAMENTE un dato personal FIJO de su biografía que aún no conocemos. ' +
    'CUENTAN solo datos fijos: nombre, edad, de dónde es, dónde vive, a qué se dedica/estudia, ' +
    'estado civil o pareja, hijos, estatura, idiomas. ' +
    'NO CUENTAN (responde OK): saludos, cómo está, qué hace ahora, planes, eventos o temas de la ' +
    'conversación ("¿fuiste a la clase?", "¿comiste?"), piropos, opiniones, sentimientos, o cualquier ' +
    'cosa que dependa del contexto o se pueda responder sin un dato biográfico. ' +
    'Ante la duda, responde OK. NUNCA uses "nombre" como respuesta por defecto.'
  const user = `Ejemplos:
- "¿cómo te llamas?" → FALTA: nombre
- "¿cuántos años tenés?" → FALTA: edad
- "¿de dónde sos?" → FALTA: de dónde eres
- "¿a qué te dedicas?" → FALTA: a qué te dedicas
- "al final fuiste a la clase que tenías?" → OK
- "hola preciosa, ¿cómo estás?" → OK
- "¿qué haces linda?" → OK
- "eres hermosa" → OK
- "¿ya comiste?" → OK

${ctx ? `Conversación reciente (contexto):\n${ctx}\n\n` : ''}Mensaje del cliente: "${incoming}"

Datos que YA sabemos de ella:
${known}

Responde "FALTA: <dato en 1-4 palabras>" SOLO si el cliente pide EXPLÍCITAMENTE un dato personal fijo que NO está en la lista de arriba. En cualquier otro caso responde solo: OK`

  let raw = ''
  try {
    if (s.engine === 'api') {
      raw = await apiChat(
        classifierModel(s),
        [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        { temperature: 0, maxTokens: 20 },
        s
      )
    } else {
      await loadModel(s.modelFile)
      const { LlamaChatSession } = await ensureLlama()
      const context = await createContextSafe(1024)
      try {
        const session = new LlamaChatSession({
          contextSequence: context.getSequence(),
          systemPrompt: sys
        })
        raw = await session.prompt(user, { temperature: 0, maxTokens: 20 })
      } finally {
        try {
          await context.dispose()
        } catch {
          /* noop */
        }
      }
    }
  } catch {
    return null // si falla la detección, no bloqueamos: se genera normal
  }
  const m = raw.match(/FALTA:\s*(.+)/i)
  if (!m) return null
  const label = m[1].trim().replace(/^["'“”]+|["'“”.]+$/g, '').trim()
  return label || null
}

function buildFacts(p: GenPayload): string {
  if (!p.facts?.length) return ''
  const lines = p.facts.map((f) => `- ${f.label}: ${f.value}`)
  return (
    'TUS DATOS REALES (son los ÚNICOS ciertos sobre ti; úsalos con naturalidad y NUNCA los contradigas):\n' +
    lines.join('\n')
  )
}

function buildMenu(p: GenPayload): string {
  if (!p.menu?.length) return ''
  const lines = p.menu.map(
    (m) => `- ${m.name}${m.description ? ` — ${m.description}` : ''}${m.price ? ` (${m.price})` : ''}`
  )
  return (
    'TU MENÚ (los ÚNICOS servicios que ofreces, con precios). Reglas:\n' +
    '• Es tu única referencia de lo que ofreces. NUNCA inventes servicios que no estén en esta lista.\n' +
    '• Si el cliente PREGUNTA por un servicio, sus precios, o NOMBRA algo que coincide con un ítem ' +
    '(aunque lo diga distinto, abreviado o en otro idioma, ej. "domi"→"Control Domi", "squirt", "pies", ' +
    '"c2c"), SIEMPRE reconócelo y ofréceselo con su PRECIO, coqueta y concreta. Esto vale aunque el ' +
    'momento no sea caliente (si te preguntan, respondes).\n' +
    '• NO SEAS INVASIVA: si NO te preguntan, ofrece el privado o UN ítem del menú SOLO cuando el ' +
    'momento lo permita (cliente caliente/muy interesado). En charla normal, cariño o tristeza NO ' +
    'menciones menú ni precios.\n' +
    '• Propón UNA sola cosa que encaje; nunca sueltes toda la lista de golpe.\n' +
    'MENÚ:\n' +
    lines.join('\n')
  )
}

function buildSystem(s: Settings, p: GenPayload, register: Register): string {
  const mem: string[] = []
  if (p.memory.likes) mem.push(`- Le gusta: ${p.memory.likes}`)
  if (p.memory.turnOns) mem.push(`- Le excita: ${p.memory.turnOns}`)
  if (p.memory.spends) mem.push(`- Gasto: ${p.memory.spends}`)
  if (p.memory.notes) mem.push(`- Notas: ${p.memory.notes}`)

  return [
    `Eres ${s.personaName}, una MUJER REAL que atiende en una plataforma para adultos por webcam. Tienes una personalidad y una voz propias y FIJAS. NUNCA eres una IA ni un asistente; jamás lo admites ni haces meta-comentarios.`,
    s.personalityPrompt ? `Tu personalidad: ${s.personalityPrompt}` : '',
    // DATOS REALES de ella + regla dura de no inventar (es una persona real).
    buildFacts(p),
    'DATOS PERSONALES: NUNCA inventes ni supongas datos tuyos (edad, nombre, ciudad, de dónde eres, a qué te dedicas, pareja, etc.). Usa SOLO lo que aparece en "TUS DATOS REALES". Si te preguntan un dato que no está ahí, NO lo inventes.',
    `IDIOMA: escribe SIEMPRE en ${p.language} natural, coloquial y correcto, como chatea una persona real. SOLO ${p.language}, ni una palabra en inglés ni en otro idioma. Sin frases rotas, sin formalismos ("mi desnudez", "deseas que…"), buena ortografía y gramática.`,
    'EMOJIS: usa emojis REALES (como 😊 🔥 😏) o ninguno. NUNCA escribas el nombre de un emoji como texto (nada de :sonrojada:, :beso:, :paso:).',
    // Capa 1: universales
    'REGLAS SIEMPRE:',
    '• Responde DE VERDAD a lo que él dijo, a su contenido y su emoción. Nada enlatado.',
    '• COHERENCIA: sigue el HILO de la conversación de abajo. Responde a lo que se venía hablando; NO cambies de tema de golpe ni ignores el mensaje anterior. Si su mensaje se entiende por el contexto, respóndelo según ese contexto.',
    '• Voz fija: misma personalidad, mismo tono y mismo nivel de emoji.',
    '• NO espejes sus palabras (no repitas literal lo que él dijo): varía el vocabulario.',
    '• Frases cortas, sin monólogos, máximo un "!", sin MAYÚSCULAS de más. Emoji 0-1, natural.',
    '• Cierra con un enganche (pregunta o guiño). Nunca dejes la conversación muerta.',
    `NIVEL DE PICANTE máximo permitido (lo eligió ella): ${modeInstruction(p.mode)}`,
    // Capa 2: SOLO el guion del momento actual
    GUION[register],
    // Menú de servicios (con su regla de "no invasivo")
    buildMenu(p),
    'LÍMITES: nada ilegal; jamás contenido con menores. Todo legal y entre adultos.',
    mem.length ? `LO QUE RECUERDAS DEL USUARIO:\n${mem.join('\n')}` : '',
    buildCorrections(p)
  ]
    .filter(Boolean)
    .join('\n')
}

function buildCorrections(p: GenPayload): string {
  if (!p.corrections?.length) return ''
  const lines = p.corrections
    .slice(0, 25)
    .map(
      (c) =>
        `- Ante un mensaje como "${c.clientMsg}", NO respondas algo como "${c.badReply}". Problema: ${c.note}`
    )
  return (
    'CORRECCIONES APRENDIDAS (reglas obligatorias, aplican a TODAS tus respuestas; evita repetir estos errores):\n' +
    lines.join('\n')
  )
}

function buildUserPrompt(s: Settings, p: GenPayload, n: number): string {
  const hist = p.history
    .slice(-10)
    .map((m) => `${m.from === 'client' ? 'Usuario' : s.personaName}: ${m.text}`)
    .join('\n')
  return [
    p.summary ? `Resumen de lo anterior con este usuario:\n${p.summary}\n` : '',
    hist ? `Conversación reciente:\n${hist}\n` : '',
    `El usuario acaba de escribirte: "${p.incoming}"`,
    '',
    `Dame ${n} respuestas posibles COHERENTES con la conversación de arriba (responde a lo que se venía hablando, sin cambiar de tema), siguiendo EL MOMENTO indicado, en ${p.language} natural y correcto, con TU voz y sin repetir sus palabras. Cada una funciona sola y varía en las palabras.`,
    `Una por línea: "1) ...", "2) ...". Escribe SOLO las ${n} respuestas (lo que le dirías a él); NO repitas estas instrucciones ni describas tu personaje.`
  ]
    .filter((x) => x !== '')
    .join('\n')
}

function clean(s: string): string {
  let t = s
    .replace(/:[a-záéíóúüñ_]{2,}:/gi, '') // quita placeholders de emoji tipo :sonrojada:
    .replace(/^["“”'`]+|["“”'`]+$/g, '')
    .replace(/\s+/g, ' ')
    .trim()
  // Corta fugas de instrucciones del sistema que a veces se cuelan al final
  // (ej. "...en privado? 😈 Eres Dahia, mujer real en plataforma adulta...").
  const leak = t.search(
    /\b(Eres [A-ZÁÉÍÓÚ][\wáéíóúñ]+,|plataforma (adulta|para adultos|de webcam|de cam)|No menciones|m[aá]ximo un emoji|SOLO (en )?espa[nñ]ol|frases cortas|cierra con un|Recuerda que eres)/i
  )
  if (leak > 20) t = t.slice(0, leak).replace(/[\s,;:–—-]+$/, '').trim()
  return t
}

function parseOptions(text: string, n: number): string[] {
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean)
  const opts: string[] = []
  for (const l of lines) {
    const m = l.match(/^\d+\s*[).\-:]\s*(.+)$/)
    if (m) {
      const c = clean(m[1])
      if (c) opts.push(c)
    }
  }
  if (opts.length < n) {
    for (const l of lines) {
      const c = clean(l.replace(/^\d+\s*[).\-:]\s*/, ''))
      if (c && !opts.includes(c)) opts.push(c)
      if (opts.length >= n) break
    }
  }
  return opts.slice(0, n)
}

export async function generateSuggestions(payload: GenPayload, s: Settings): Promise<string[]> {
  // ----- Modo API (OpenRouter): clasifica + genera por la nube -----
  if (s.engine === 'api') {
    const register =
      payload.register ?? (await classifyMoment(payload.incoming, payload.history, s)).register
    const n = s.suggestionCount || 3
    const messages = [
      { role: 'system' as const, content: buildSystem(s, payload, register) },
      { role: 'user' as const, content: buildUserPrompt(s, payload, n) }
    ]
    const genOpts = { temperature: 0.7, topP: 0.9, topK: 40, repetitionPenalty: 1.15, maxTokens: 400 }

    // Intenta el modelo elegido; si falla (caído/lento), prueba los respaldos.
    const chain = [generatorModel(s), ...GEN_FALLBACKS.filter((m) => m !== generatorModel(s))]
    let raw = ''
    let lastErr: unknown
    for (const model of chain) {
      try {
        raw = await apiChat(model, messages, genOpts, s)
        lastGeneratorModel = model // registrar cuál respondió de verdad
        break
      } catch (err) {
        lastErr = err
        // llave inválida o sin crédito: no tiene sentido probar otros modelos
        const msg = (err as Error)?.message || ''
        if (msg === 'api-key-invalid' || msg === 'api-no-credit' || msg === 'api-key-missing') throw err
      }
    }
    if (!raw) throw lastErr instanceof Error ? lastErr : new Error('api-error')

    const opts = parseOptions(raw, n)
    return opts.length ? opts : [clean(raw)]
  }

  // ----- Modo local (node-llama-cpp) -----
  await loadModel(s.modelFile)
  const { LlamaChatSession } = await ensureLlama()

  // Paso 1: leer el momento (clasificar). Paso 2: generar solo con ese guion.
  const register =
    payload.register ?? (await classifyMoment(payload.incoming, payload.history, s)).register

  const context = await createContextSafe(3072)
  try {
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: buildSystem(s, payload, register)
    })
    const n = s.suggestionCount || 3
    const raw = await session.prompt(buildUserPrompt(s, payload, n), {
      temperature: 0.7,
      topP: 0.9,
      topK: 40,
      repeatPenalty: { penalty: 1.15, lastTokens: 64 },
      maxTokens: 400
    })
    const opts = parseOptions(raw, n)
    return opts.length ? opts : [clean(raw)]
  } finally {
    try {
      await context.dispose()
    } catch {
      /* noop */
    }
  }
}

// Traduce las sugerencias al español (para que ella las entienda) cuando el chat es en
// otro idioma. Lo que se envía sigue siendo el original; esto es solo para mostrarle.
export async function translateToSpanish(texts: string[], s: Settings): Promise<string[]> {
  if (!texts.length) return []
  const numbered = texts.map((t, i) => `${i + 1}) ${t}`).join('\n')
  const sys =
    'Traduces mensajes de un chat coqueto al español natural y coloquial (no literal, como hablaría ' +
    'una persona real). Conservas el tono y los emojis.'
  const user = `Traduce al español cada respuesta, conservando su número y su tono. Devuelve SOLO las traducciones, una por línea con su número:\n${numbered}`
  try {
    if (s.engine === 'api') {
      const raw = await apiChat(
        classifierModel(s),
        [
          { role: 'system', content: sys },
          { role: 'user', content: user }
        ],
        { temperature: 0.2, maxTokens: 500 },
        s
      )
      const out = parseOptions(raw, texts.length)
      return out.length === texts.length ? out : texts
    }
    await loadModel(s.modelFile)
    const { LlamaChatSession } = await ensureLlama()
    const context = await createContextSafe(2048)
    try {
      const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: sys })
      const raw = await session.prompt(user, { temperature: 0.2, maxTokens: 500 })
      const out = parseOptions(raw, texts.length)
      return out.length === texts.length ? out : texts
    } finally {
      try {
        await context.dispose()
      } catch {
        /* noop */
      }
    }
  } catch {
    return texts // si falla la traducción, mostramos el original (mejor que nada)
  }
}

// Interpreta una conversación PEGADA (texto crudo) y la divide en mensajes ordenados,
// marcando quién dijo cada uno (ella / el cliente). Sirve para importar historial previo.
// Formato por LÍNEAS (más robusto que JSON: si se corta, solo pierde la última línea).
function parseLineMessages(
  out: string,
  personaName: string,
  clientName: string
): { from: 'client' | 'her'; text: string }[] {
  const res: { from: 'client' | 'her'; text: string }[] = []
  const persona = (personaName || '').toLowerCase().trim()
  const client = (clientName || '').toLowerCase().trim()
  for (const rawLine of out.split('\n')) {
    // Limpia viñetas/markdown al inicio y negritas (**, __)
    const line = rawLine.replace(/^[\s>*\-–—•#]+/, '').replace(/\*\*|__/g, '')
    const m = line.match(/^([^:]{1,40}?)\s*[:\-–—]\s*(.+)$/)
    if (!m) continue
    const label = m[1].toLowerCase().trim()
    const text = m[2].trim().replace(/^["“”']+|["“”']+$/g, '').trim()
    if (!text) continue
    let from: 'client' | 'her' | null = null
    if (/^(cliente|client|usuario|user|él|el|he|him)\b/.test(label) || (client && label.includes(client)))
      from = 'client'
    else if (/^(ella|her|yo|me|she)\b/.test(label) || (persona && label.includes(persona)))
      from = 'her'
    if (from) res.push({ from, text })
  }
  return res
}

// Llama al modelo con un system+user (para las tareas de importación).
async function runImportModel(model: string, sys: string, input: string, s: Settings): Promise<string> {
  if (s.engine === 'api') {
    return apiChat(
      model,
      [
        { role: 'system', content: sys },
        { role: 'user', content: input }
      ],
      { temperature: 0, maxTokens: 4000 },
      s
    )
  }
  await loadModel(s.modelFile)
  const { LlamaChatSession } = await ensureLlama()
  const context = await createContextSafe(4096)
  try {
    const session = new LlamaChatSession({ contextSequence: context.getSequence(), systemPrompt: sys })
    return await session.prompt(input, { temperature: 0, maxTokens: 4000 })
  } finally {
    try {
      await context.dispose()
    } catch {
      /* noop */
    }
  }
}

// Segmentación por CÓDIGO del formato Chaturbate. Señal clave: la INICIAL del usuario
// (una letra sola, o su nombre) precede los mensajes del CLIENTE; los de ELLA no la llevan.
interface SegMsg {
  text: string
  marked: boolean // venía precedido por la inicial del cliente
  lang?: string
}

const RE_DATE = /^\d{1,2} de \p{L}+ de \d{4}$/iu
const RE_DAYTIME = /^(lun|mar|mié|mie|jue|vie|sáb|sab|dom)[a-zé]*\.?,?\s*\d{1,2}:\d{2}/i
const RE_TIME = /^\d{1,2}:\d{2}\s*(a\.?\s*m\.?|p\.?\s*m\.?)?$/i
const RE_SYS = /^(private conversation|caution|start of conversation|scroll to bottom|following|merch)\b/i

function isSkipLine(l: string): boolean {
  return !l || RE_DATE.test(l) || RE_DAYTIME.test(l) || RE_TIME.test(l) || RE_SYS.test(l)
}

function segmentChaturbate(raw: string, clientName: string): SegMsg[] {
  const user = (clientName || '').toLowerCase().trim()
  const msgs: SegMsg[] = []
  let pending = false
  for (const rawLine of raw.split('\n')) {
    const l = rawLine.trim()
    if (isSkipLine(l)) continue
    // Marca del cliente: una sola letra (su inicial) o su nombre de usuario en su propia línea.
    if (/^[A-Za-z]$/.test(l) || (user && l.toLowerCase() === user)) {
      pending = true
      continue
    }
    msgs.push({ text: l, marked: pending })
    pending = false
  }
  return msgs
}

// Detecta el idioma de cada mensaje (por lotes). Tarea simple para el modelo.
async function detectLangsPerMessage(msgs: SegMsg[], s: Settings): Promise<void> {
  const sys =
    'Para cada mensaje numerado, di SOLO su idioma en código de 2 letras (es, en, hu, pt, fr, it, ' +
    'de, ru...). Responde una línea por mensaje con el formato "N: xx" y nada más.'
  const BATCH = 60
  for (let start = 0; start < msgs.length; start += BATCH) {
    const batch = msgs.slice(start, start + BATCH)
    const numbered = batch.map((m, i) => `${i + 1}. ${m.text}`).join('\n')
    const out = await runImportModel(classifierModel(s), sys, numbered, s)
    for (const line of out.split('\n')) {
      const m = line.trim().match(/^(\d+)\D+([a-z]{2})\b/i)
      if (m) {
        const idx = start + parseInt(m[1], 10) - 1
        if (msgs[idx]) msgs[idx].lang = m[2].toLowerCase()
      }
    }
  }
}

function modeOf(arr: string[]): string {
  const c: Record<string, number> = {}
  for (const x of arr) if (x) c[x] = (c[x] || 0) + 1
  const e = Object.entries(c).sort((a, b) => b[1] - a[1])
  return e.length ? e[0][0] : ''
}

// ¿En qué idioma (código 2 letras) escribe el CLIENTE? (para conversaciones bilingües)
async function detectClientLang(raw: string, s: Settings): Promise<string> {
  const sys =
    'Una chica de webcam chatea con un cliente/fan; a veces escriben en idiomas distintos. El CLIENTE ' +
    'es quien la saluda por su nombre y le declara amor/deseo primero. ¿En qué idioma escribe el ' +
    'CLIENTE? Responde SOLO el código de 2 letras (es, en, hu, pt...).'
  const out = await runImportModel(classifierModel(s), sys, raw.slice(0, 4000), s)
  const m = out.toLowerCase().match(/[a-z]{2}/)
  return m ? m[0] : ''
}

// Atribución por REMITENTE (rol/marcas/alternancia) — para conversaciones en UN solo idioma.
async function attributeBySender(
  texts: string[],
  personaName: string,
  clientName: string,
  s: Settings
): Promise<{ from: 'client' | 'her'; text: string }[]> {
  const sys =
    `Separas una conversación entre una chica de webcam "${personaName}" y un cliente` +
    `${clientName ? ` (usuario "${clientName}")` : ''} en mensajes, marcando quién dijo cada uno.\n` +
    'Salida: UN mensaje por línea, empezando EXACTAMENTE con "CLIENTE:" o "ELLA:" (sin negritas ni ' +
    'viñetas, sin usar los nombres).\n' +
    'REGLA: NO asumas que se turnan de a uno; un lado puede mandar varios seguidos.\n' +
    'Señales: 1) marcas/nombres si hay. 2) A quién se dirige: quien saluda/nombra a la chica o le pide ' +
    'cosas es el CLIENTE. 3) Rol: el cliente inicia/pide/halaga; ella responde/agradece/invita.\n' +
    'Une multilínea. No inventes. Solo líneas CLIENTE:/ELLA:.'
  const all: { from: 'client' | 'her'; text: string }[] = []
  for (const input of chunkByLines(texts.join('\n'), 6000)) {
    const out = await runImportModel(generatorModel(s), sys, input, s)
    all.push(...parseLineMessages(out, personaName, clientName))
  }
  return all
}

export async function parseConversation(
  raw: string,
  personaName: string,
  clientName: string,
  s: Settings
): Promise<{ from: 'client' | 'her'; text: string }[]> {
  // 1) Segmentar por código (detecta la inicial del cliente, mantiene el orden).
  const msgs = segmentChaturbate(raw, clientName)
  if (!msgs.length) return []
  const hasMarks = msgs.some((m) => m.marked)

  // 2) Idioma de cada mensaje (para decidir bilingüe).
  await detectLangsPerMessage(msgs, s)

  const langCounts: Record<string, number> = {}
  for (const m of msgs) if (m.lang) langCounts[m.lang] = (langCounts[m.lang] || 0) + 1
  const sortedL = Object.entries(langCounts).sort((a, b) => b[1] - a[1])

  if (hasMarks) {
    // La inicial nos dice el idioma del cliente sin adivinar.
    const clientLang = modeOf(msgs.filter((m) => m.marked).map((m) => m.lang || ''))
    const herLang = modeOf(msgs.filter((m) => !m.marked).map((m) => m.lang || ''))
    if (clientLang && herLang && clientLang !== herLang) {
      // Bilingüe: agrupar por idioma (más robusto que la marca en cada línea).
      return msgs.map((m) => ({ from: m.lang === clientLang ? 'client' : 'her', text: m.text }))
    }
    // Un idioma: la marca decide (cliente = con inicial; ella = sin inicial).
    return msgs.map((m) => ({ from: m.marked ? 'client' : 'her', text: m.text }))
  }

  // Sin marcas: si es bilingüe, por idioma; si no, por rol.
  const bilingual = sortedL.length >= 2 && sortedL[1][1] >= msgs.length * 0.2
  if (bilingual) {
    let clientLang = await detectClientLang(raw, s)
    if (!clientLang || !(clientLang in langCounts)) clientLang = sortedL[0][0]
    return msgs.map((m) => ({ from: m.lang === clientLang ? 'client' : 'her', text: m.text }))
  }
  return attributeBySender(
    msgs.map((m) => m.text),
    personaName,
    clientName,
    s
  )
}

// Parte un texto en trozos por líneas, cada uno de ~maxChars (respeta líneas enteras).
function chunkByLines(text: string, maxChars: number): string[] {
  const lines = text.split('\n')
  const chunks: string[] = []
  let cur = ''
  for (const line of lines) {
    if (cur && cur.length + line.length + 1 > maxChars) {
      chunks.push(cur)
      cur = ''
    }
    cur += (cur ? '\n' : '') + line
  }
  if (cur) chunks.push(cur)
  return chunks
}

// Resume un lote de mensajes antiguos e integra con el resumen previo.
export async function summarize(
  prevSummary: string,
  batch: { from: 'client' | 'her'; text: string }[],
  s: Settings
): Promise<string> {
  const convoText = batch
    .map((m) => `${m.from === 'client' ? 'Usuario' : s.personaName}: ${m.text}`)
    .join('\n')
  const sumSystem =
    'Eres un asistente que resume conversaciones para recordar lo importante más adelante. ' +
    'Escribes en español, breve y concreto. No inventas nada.'
  const sumUser = [
    `Resumen previo (puede estar vacío):\n${prevSummary || '(ninguno)'}`,
    '',
    `Mensajes nuevos a integrar:\n${convoText}`,
    '',
    'Actualiza el resumen integrando lo nuevo. Incluye datos y gustos del usuario, qué pasó, ' +
      'promesas/acuerdos y el tono. Máximo 6 frases. Devuelve SOLO el resumen actualizado.'
  ].join('\n')

  // ----- Modo API -----
  if (s.engine === 'api') {
    const raw = await apiChat(
      classifierModel(s),
      [
        { role: 'system', content: sumSystem },
        { role: 'user', content: sumUser }
      ],
      { temperature: 0.3, maxTokens: 300 },
      s
    )
    return clean(raw)
  }

  // ----- Modo local -----
  await loadModel(s.modelFile)
  const { LlamaChatSession } = await ensureLlama()
  const context = await createContextSafe(2048)
  try {
    const session = new LlamaChatSession({
      contextSequence: context.getSequence(),
      systemPrompt: sumSystem
    })
    const raw = await session.prompt(sumUser, { temperature: 0.3, topP: 0.9, maxTokens: 300 })
    return clean(raw)
  } finally {
    try {
      await context.dispose()
    } catch {
      /* noop */
    }
  }
}
