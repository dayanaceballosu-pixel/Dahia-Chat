import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Configuración global de la app (personalidad, motor, etc.) en un JSON simple.

export interface Settings {
  personaName: string
  personalityPrompt: string
  suggestionCount: number
  engine: 'local' | 'api'
  modelFile: string
  // API (OpenRouter). Dos modelos: uno para clasificar el momento y otro para generar.
  apiProvider: string
  apiBaseUrl: string
  apiKey: string
  apiModel: string // generador (roleplay sin censura)
  apiClassifierModel: string // clasificador del momento (instructivo barato)
  copPerUsd: number // tasa para mostrar el gasto en pesos colombianos
}

const DEFAULTS: Settings = {
  personaName: 'Dahia',
  personalityPrompt:
    'Eres una chica coqueta, dulce y con chispa. Te encanta hacer sentir especial a quien te escribe, ' +
    'seguir el juego según el ánimo del usuario y crear conexión. Hablas natural, como una persona real.',
  suggestionCount: 3,
  engine: 'local',
  modelFile: 'Qwen2.5-7B-Instruct-abliterated-v2.Q5_K_M.gguf',
  apiProvider: 'openrouter',
  apiBaseUrl: 'https://openrouter.ai/api/v1',
  apiKey: '',
  apiModel: 'nousresearch/hermes-3-llama-3.1-70b',
  apiClassifierModel: 'mistralai/ministral-14b-2512',
  copPerUsd: 4100
}

function file(): string {
  return join(app.getPath('userData'), 'settings.json')
}

// Valores por defecto horneados en el instalador (llave, motor, modelos) para que la
// app funcione al instalar sin configurar nada. El archivo lo pone Sinfi al empaquetar
// (resources/dahia-defaults.json); NO va en git. Solo se usa en el PRIMER arranque.
function bundledDefaults(): Partial<Settings> {
  try {
    const p = join(process.resourcesPath, 'dahia-defaults.json')
    if (existsSync(p)) return JSON.parse(readFileSync(p, 'utf-8')) as Partial<Settings>
  } catch {
    /* no hay archivo horneado: se usan los DEFAULTS */
  }
  return {}
}

export function getSettings(): Settings {
  try {
    if (existsSync(file())) {
      return { ...DEFAULTS, ...JSON.parse(readFileSync(file(), 'utf-8')) }
    }
  } catch {
    /* usa defaults */
  }
  // Primer arranque: DEFAULTS + lo horneado en el instalador (llave de ella, etc.)
  return { ...DEFAULTS, ...bundledDefaults() }
}

export function saveSettings(patch: Partial<Settings>): Settings {
  const next = { ...getSettings(), ...patch }
  writeFileSync(file(), JSON.stringify(next, null, 2))
  return next
}
