import { useEffect, useState } from 'react'

// Contador de gasto de la IA (modo API). Los totales los calcula OpenRouter
// (gasto del día/mes y crédito restante); aquí solo se muestran, en pesos.
interface Credit {
  limit: number | null
  usage: number
  usageDaily: number
  usageMonthly: number
  remaining: number | null
  resetPeriod: string | null
}

interface Props {
  copPerUsd: number
  nonce: number // al cambiar, refresca (se incrementa tras cada generación)
  collapsed?: boolean
}

export function UsageMeter({ copPerUsd, nonce, collapsed }: Props): JSX.Element | null {
  const [credit, setCredit] = useState<Credit | null>(null)
  const [hidden, setHidden] = useState(false)

  const load = async (): Promise<void> => {
    const r = await window.dahia.ai.credit()
    if (r.error || !r.credit) {
      setHidden(true)
      return
    }
    setHidden(false)
    setCredit(r.credit)
  }

  // Cargar al montar + refrescar cada 20s (la consulta no gasta tokens)
  useEffect(() => {
    load()
    const id = window.setInterval(load, 20000)
    return () => window.clearInterval(id)
  }, [])

  // Refrescar justo después de una generación
  useEffect(() => {
    if (nonce > 0) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nonce])

  if (hidden || !credit) return null

  const rate = copPerUsd || 4100
  const cop = (usd: number): string => '$' + Math.round(usd * rate).toLocaleString('es-CO')
  const spent = credit.usageMonthly
  const limit = credit.limit
  const pct = limit && limit > 0 ? Math.min(100, (spent / limit) * 100) : 0
  const near = pct >= 85
  const fillColor = near ? '#e5484d' : 'var(--primary, #ff7ab8)'

  const bar = (
    <div
      style={{
        height: 6,
        borderRadius: 6,
        background: 'var(--border, rgba(0,0,0,0.12))',
        overflow: 'hidden',
        marginTop: 5
      }}
    >
      <div
        style={{
          width: `${pct}%`,
          height: '100%',
          background: fillColor,
          transition: 'width .4s ease'
        }}
      />
    </div>
  )

  // Modo compacto: solo icono + barrita, con tooltip
  if (collapsed) {
    return (
      <div
        title={`Gasto este mes: ${cop(spent)}${limit ? ' de ' + cop(limit) : ''}${
          credit.remaining != null ? ` · quedan ${cop(credit.remaining)}` : ''
        }`}
        style={{ width: 44, textAlign: 'center', fontSize: 15 }}
      >
        💸
        <div style={{ padding: '0 3px' }}>{bar}</div>
      </div>
    )
  }

  return (
    <div
      style={{
        padding: '9px 11px',
        borderRadius: 12,
        background: 'var(--surface-2, rgba(255,255,255,0.5))',
        border: '1px solid var(--border, rgba(0,0,0,0.08))',
        fontSize: 12.5
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ color: 'var(--text-muted)' }}>💸 Gasto este mes</span>
        <b>
          {cop(spent)}
          {limit ? (
            <span style={{ fontWeight: 400, color: 'var(--text-muted)' }}> / {cop(limit)}</span>
          ) : null}
        </b>
      </div>
      {limit ? bar : null}
      <div style={{ marginTop: 5, color: 'var(--text-muted)', fontSize: 11.5 }}>
        Hoy: {cop(credit.usageDaily)}
        {credit.remaining != null && <> · Quedan: {cop(credit.remaining)}</>}
        {near && <span style={{ color: '#e5484d', fontWeight: 600 }}> · ¡ojo, casi al tope!</span>}
      </div>
    </div>
  )
}
