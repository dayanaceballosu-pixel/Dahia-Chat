import initSqlJs, { type Database } from 'sql.js'
import { app } from 'electron'
import { join } from 'path'
import { existsSync, readFileSync, writeFileSync } from 'fs'

// Base de datos SQLite en JavaScript puro (sql.js / WASM).
// Se guarda como un único archivo .db en la carpeta de datos del usuario.
// Ventaja: sin compilar nada nativo → funciona igual en cualquier PC Windows.

let db: Database
let dbPath: string

// Localiza el archivo .wasm de sql.js (dev y empaquetado)
function locateWasm(): string {
  try {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    return require.resolve('sql.js/dist/sql-wasm.wasm')
  } catch {
    return join(process.resourcesPath, 'sql-wasm.wasm')
  }
}

function persist(): void {
  const data = db.export()
  writeFileSync(dbPath, Buffer.from(data))
}

export async function initDb(): Promise<void> {
  const wasmBinary = new Uint8Array(readFileSync(locateWasm()))
  const SQL = await initSqlJs({ wasmBinary: wasmBinary as unknown as ArrayBuffer })
  dbPath = join(app.getPath('userData'), 'dahia.db')

  if (existsSync(dbPath)) {
    db = new SQL.Database(new Uint8Array(readFileSync(dbPath)))
  } else {
    db = new SQL.Database()
  }

  db.run(`
    CREATE TABLE IF NOT EXISTS clients (
      id TEXT PRIMARY KEY,
      username TEXT NOT NULL,
      tags TEXT DEFAULT '[]',
      language TEXT DEFAULT 'Español',
      mode TEXT DEFAULT 'charla',
      likes TEXT DEFAULT '',
      turn_ons TEXT DEFAULT '',
      spends TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      unread INTEGER DEFAULT 0,
      summary TEXT DEFAULT '',
      summarized_count INTEGER DEFAULT 0,
      created_at INTEGER,
      last_activity INTEGER
    );
    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      client_id TEXT NOT NULL,
      sender TEXT NOT NULL,
      text TEXT NOT NULL,
      time TEXT,
      created_at INTEGER,
      FOREIGN KEY (client_id) REFERENCES clients(id) ON DELETE CASCADE
    );
    CREATE INDEX IF NOT EXISTS idx_msg_client ON messages(client_id);
    CREATE TABLE IF NOT EXISTS corrections (
      id TEXT PRIMARY KEY,
      client_msg TEXT DEFAULT '',
      bad_reply TEXT DEFAULT '',
      note TEXT DEFAULT '',
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS persona_facts (
      id TEXT PRIMARY KEY,
      label TEXT NOT NULL,
      value TEXT NOT NULL,
      created_at INTEGER
    );
    CREATE TABLE IF NOT EXISTS menu_items (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      price TEXT DEFAULT '',
      description TEXT DEFAULT '',
      created_at INTEGER
    );
  `)

  // Migración para bases de datos ya existentes (añade columnas si faltan)
  try {
    db.run("ALTER TABLE clients ADD COLUMN summary TEXT DEFAULT ''")
  } catch {
    /* ya existe */
  }
  try {
    db.run('ALTER TABLE clients ADD COLUMN summarized_count INTEGER DEFAULT 0')
  } catch {
    /* ya existe */
  }
  try {
    db.run("ALTER TABLE menu_items ADD COLUMN description TEXT DEFAULT ''")
  } catch {
    /* ya existe */
  }
  persist()
}

// ---------- Helpers ----------
function now(): number {
  return Date.now()
}

function formatRelative(ts: number | null): string {
  if (!ts) return ''
  const diff = Date.now() - ts
  const m = Math.floor(diff / 60000)
  if (m < 1) return 'ahora'
  if (m < 60) return `hace ${m} min`
  const h = Math.floor(m / 60)
  if (h < 24) return `hace ${h} h`
  const d = Math.floor(h / 24)
  return `hace ${d} d`
}

function rowsToObjects(sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = db.prepare(sql)
  stmt.bind(params as never)
  const out: Record<string, unknown>[] = []
  while (stmt.step()) out.push(stmt.getAsObject())
  stmt.free()
  return out
}

function loadMessages(clientId: string): unknown[] {
  return rowsToObjects(
    'SELECT id, sender as "from", text, time FROM messages WHERE client_id = ? ORDER BY created_at ASC',
    [clientId]
  )
}

function mapClient(row: Record<string, unknown>): Record<string, unknown> {
  return {
    id: row.id,
    username: row.username,
    tags: JSON.parse((row.tags as string) || '[]'),
    language: row.language,
    mode: row.mode,
    unread: row.unread || 0,
    lastActivity: formatRelative(row.last_activity as number),
    summary: row.summary || '',
    summarizedCount: row.summarized_count || 0,
    memory: {
      likes: row.likes || '',
      turnOns: row.turn_ons || '',
      spends: row.spends || '',
      notes: row.notes || ''
    },
    messages: loadMessages(row.id as string)
  }
}

// ---------- API ----------
export function listClients(query = ''): unknown[] {
  const rows = query
    ? rowsToObjects(
        'SELECT * FROM clients WHERE username LIKE ? ORDER BY last_activity DESC',
        [`%${query}%`]
      )
    : rowsToObjects('SELECT * FROM clients ORDER BY last_activity DESC')
  return rows.map(mapClient)
}

export function getClient(id: string): unknown | null {
  const rows = rowsToObjects('SELECT * FROM clients WHERE id = ?', [id])
  return rows[0] ? mapClient(rows[0]) : null
}

export function createClient(data: { username: string }): unknown {
  const id = `c${now()}`
  const t = now()
  db.run(
    `INSERT INTO clients (id, username, tags, language, mode, created_at, last_activity)
     VALUES (?, ?, '["nuevo"]', 'Español', 'charla', ?, ?)`,
    [id, data.username, t, t]
  )
  persist()
  return getClient(id)
}

export function updateClient(id: string, patch: Record<string, unknown>): unknown {
  const memory = (patch.memory as Record<string, string>) || {}
  db.run(
    `UPDATE clients SET
       tags = COALESCE(?, tags),
       language = COALESCE(?, language),
       mode = COALESCE(?, mode),
       likes = COALESCE(?, likes),
       turn_ons = COALESCE(?, turn_ons),
       spends = COALESCE(?, spends),
       notes = COALESCE(?, notes)
     WHERE id = ?`,
    [
      patch.tags ? JSON.stringify(patch.tags) : null,
      (patch.language as string) ?? null,
      (patch.mode as string) ?? null,
      memory.likes ?? null,
      memory.turnOns ?? null,
      memory.spends ?? null,
      memory.notes ?? null,
      id
    ]
  )
  persist()
  return getClient(id)
}

export function deleteClient(id: string): boolean {
  db.run('DELETE FROM messages WHERE client_id = ?', [id])
  db.run('DELETE FROM clients WHERE id = ?', [id])
  persist()
  return true
}

export function renameClient(id: string, username: string): unknown {
  db.run('UPDATE clients SET username = ? WHERE id = ?', [username, id])
  persist()
  return getClient(id)
}

export function clearUnread(id: string): void {
  db.run('UPDATE clients SET unread = 0 WHERE id = ?', [id])
  persist()
}

// ---------- Correcciones globales (retroalimentación que aplica a TODO el proyecto) ----------
export function listCorrections(): Record<string, unknown>[] {
  return rowsToObjects(
    'SELECT id, client_msg as clientMsg, bad_reply as badReply, note FROM corrections ORDER BY created_at DESC'
  )
}
export function addCorrection(clientMsg: string, badReply: string, note: string): unknown {
  const id = `f${now()}`
  db.run(
    'INSERT INTO corrections (id, client_msg, bad_reply, note, created_at) VALUES (?, ?, ?, ?, ?)',
    [id, clientMsg, badReply, note, now()]
  )
  persist()
  return listCorrections()
}
export function deleteCorrection(id: string): boolean {
  db.run('DELETE FROM corrections WHERE id = ?', [id])
  persist()
  return true
}
// ---------- Perfil real de Dahia (datos de ELLA, globales, para siempre) ----------
// La IA usa SOLO estos datos y nunca inventa. Cuando falta uno, se le pide a ella.
export function listFacts(): { id: string; label: string; value: string }[] {
  return rowsToObjects(
    'SELECT id, label, value FROM persona_facts ORDER BY created_at ASC'
  ) as { id: string; label: string; value: string }[]
}

// Guarda un dato; si ya existe uno con la misma etiqueta, lo actualiza (no duplica).
export function upsertFact(label: string, value: string): unknown {
  const clean = label.trim()
  const existing = rowsToObjects('SELECT id FROM persona_facts WHERE LOWER(label) = LOWER(?)', [
    clean
  ])
  if (existing[0]) {
    db.run('UPDATE persona_facts SET value = ? WHERE id = ?', [value.trim(), existing[0].id as string])
  } else {
    db.run('INSERT INTO persona_facts (id, label, value, created_at) VALUES (?, ?, ?, ?)', [
      `pf${now()}`,
      clean,
      value.trim(),
      now()
    ])
  }
  persist()
  return listFacts()
}

export function deleteFact(id: string): boolean {
  db.run('DELETE FROM persona_facts WHERE id = ?', [id])
  persist()
  return true
}

// ---------- Menú de servicios (lo que ella ofrece, con precios) ----------
export function listMenu(): { id: string; name: string; price: string; description: string }[] {
  return rowsToObjects(
    'SELECT id, name, price, description FROM menu_items ORDER BY created_at ASC'
  ) as { id: string; name: string; price: string; description: string }[]
}
export function addMenuItem(name: string, price: string, description = ''): unknown {
  db.run(
    'INSERT INTO menu_items (id, name, price, description, created_at) VALUES (?, ?, ?, ?, ?)',
    [`mi${now()}`, name.trim(), (price || '').trim(), (description || '').trim(), now()]
  )
  persist()
  return listMenu()
}
export function deleteMenuItem(id: string): boolean {
  db.run('DELETE FROM menu_items WHERE id = ?', [id])
  persist()
  return true
}

export function usernameExists(username: string): boolean {
  const rows = rowsToObjects('SELECT COUNT(*) as n FROM clients WHERE LOWER(username) = LOWER(?)', [
    username
  ])
  return (rows[0]?.n as number) > 0
}

export function addMessage(
  clientId: string,
  msg: { from: 'client' | 'her'; text: string }
): unknown {
  const id = `m${now()}`
  const t = now()
  const time = new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
  db.run(
    'INSERT INTO messages (id, client_id, sender, text, time, created_at) VALUES (?, ?, ?, ?, ?, ?)',
    [id, clientId, msg.from, msg.text, time, t]
  )
  db.run('UPDATE clients SET last_activity = ? WHERE id = ?', [t, clientId])
  persist()
  return getClient(clientId)
}

// Inserta en bloque una conversación importada, EN ORDEN, SIN borrar lo que ya haya.
// - Si el chat YA tiene mensajes: los importados se AGREGAN después (no reinicia).
// - Si está vacío: se colocan en el pasado, como historial previo.
export function importMessages(
  clientId: string,
  msgs: { from: 'client' | 'her'; text: string }[]
): unknown {
  const rows = rowsToObjects('SELECT MAX(created_at) as m FROM messages WHERE client_id = ?', [
    clientId
  ])
  const lastTs = (rows[0]?.m as number) || 0
  const base = lastTs > 0 ? lastTs + 60000 : now() - msgs.length * 60000
  msgs.forEach((m, i) => {
    const t = base + i * 60000
    const time = new Date(t).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' })
    db.run(
      'INSERT INTO messages (id, client_id, sender, text, time, created_at) VALUES (?, ?, ?, ?, ?, ?)',
      [`im${base}_${i}`, clientId, m.from, m.text, time, t]
    )
  })
  db.run('UPDATE clients SET last_activity = ? WHERE id = ?', [now(), clientId])
  persist()
  return getClient(clientId)
}

// Cambia el remitente de un mensaje (cliente ↔ ella) para corregir a mano.
export function flipMessage(id: string): void {
  db.run(
    "UPDATE messages SET sender = CASE sender WHEN 'client' THEN 'her' ELSE 'client' END WHERE id = ?",
    [id]
  )
  persist()
}

export function updateSummary(id: string, summary: string, count: number): void {
  db.run('UPDATE clients SET summary = ?, summarized_count = ? WHERE id = ?', [summary, count, id])
  persist()
}

export function isEmpty(): boolean {
  const rows = rowsToObjects('SELECT COUNT(*) as n FROM clients')
  return (rows[0]?.n as number) === 0
}

// Siembra clientes de ejemplo la primera vez (para no arrancar en blanco).
export function seedSample(): void {
  const base = now()
  const sample = [
    {
      id: 'c1', username: 'Carlos_88', tags: ['VIP', 'habitual'], language: 'Español',
      mode: 'coqueto', likes: 'Le gusta que le hablen de su día, es tímido al inicio',
      turn_ons: 'Juego de roles, que ella tome la iniciativa', spends: 'Suele gastar los viernes',
      notes: 'Cumpleaños en agosto. Le dije que soy de Medellín.', unread: 2, ago: 3 * 60000,
      msgs: [
        { from: 'client', text: 'Holaa, ¿cómo estás hoy preciosa?' },
        { from: 'her', text: 'Hola guapo 😏 justo pensaba en ti, ¿cómo va tu día?' },
        { from: 'client', text: 'Mejor ahora que te veo jaja' }
      ]
    },
    {
      id: 'c2', username: 'mike_ny', tags: ['nuevo'], language: 'Inglés', mode: 'charla',
      likes: 'Just wants to talk, seems lonely', turn_ons: '', spends: 'New, unknown',
      notes: 'From New York. First time chatting.', unread: 0, ago: 12 * 60000,
      msgs: [{ from: 'client', text: 'hey, how are you doing?' }]
    },
    {
      id: 'c3', username: 'ElJefe_23', tags: ['habitual'], language: 'Español', mode: 'explicito',
      likes: 'Directo, sabe lo que quiere', turn_ons: 'Mensajes atrevidos, poco preámbulo',
      spends: 'Gasto medio-alto', notes: '', unread: 0, ago: 60 * 60000,
      msgs: [
        { from: 'client', text: 'ya te extrañaba nena' },
        { from: 'her', text: 'mmm yo también te tenía en mente 🔥' }
      ]
    }
  ]

  for (const c of sample) {
    const t = base - c.ago
    db.run(
      `INSERT INTO clients (id, username, tags, language, mode, likes, turn_ons, spends, notes, unread, created_at, last_activity)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      [c.id, c.username, JSON.stringify(c.tags), c.language, c.mode, c.likes, c.turn_ons,
        c.spends, c.notes, c.unread, t, t]
    )
    c.msgs.forEach((m, i) => {
      const mt = t + i * 60000
      db.run(
        'INSERT INTO messages (id, client_id, sender, text, time, created_at) VALUES (?, ?, ?, ?, ?, ?)',
        [`${c.id}_m${i}`, c.id, m.from, m.text,
          new Date(mt).toLocaleTimeString('es', { hour: '2-digit', minute: '2-digit' }), mt]
      )
    })
  }
  persist()
}
