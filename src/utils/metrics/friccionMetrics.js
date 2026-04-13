/**
 * FRICCION METRICS v4
 *
 * DISTINCIÓN CRÍTICA:
 * - historico.csv → datos históricos acumulados de HOLD (tendencia)
 * - hold.csv      → SNAPSHOT del estado actual (foto en vivo)
 *
 * Nunca mezclar ambas fuentes como si fueran lo mismo.
 * El snapshot debe mostrarse siempre con su fecha de actualización.
 */

export function calcHoldKPIs(historico) {
  const holds = historico.filter(r => r.status === 'HOLD')
  const totalRegistros = holds.length
  const byFlujo = {}
  const byIncidencia = {}
  const byUsuario = {}
  for (const r of holds) {
    byFlujo[r.flujo]    = (byFlujo[r.flujo] || 0) + 1
    const inc = r.incidencia || 'Sin incidencia'
    byIncidencia[inc]   = (byIncidencia[inc] || 0) + 1
    byUsuario[r.usuario] = (byUsuario[r.usuario] || 0) + 1
  }
  const idsUnicos = new Set(holds.map(r => r.idLink)).size
  return { totalRegistros, idsUnicos, byFlujo, byIncidencia, byUsuario }
}

export function calcHoldLeadTime(historico) {
  const grupos = new Map()
  for (const r of historico) {
    if (!r.idLink || !r.usuario) continue
    const key = `${r.usuario}||${r.idLink}`
    if (!grupos.has(key)) grupos.set(key, [])
    grupos.get(key).push(r)
  }
  const ciclos = []
  let sinCierre = 0
  for (const [, registros] of grupos) {
    const sorted = registros.slice().sort((a, b) => (a.fecha || 0) - (b.fecha || 0))
    if (!sorted.some(r => r.status === 'HOLD')) continue
    let firstHold = null, holdRegistros = 0, doneDate = null, flujo = null, incidencia = null
    for (const r of sorted) {
      if (r.status === 'HOLD') {
        holdRegistros++
        if (!firstHold) { firstHold = r.fecha; flujo = r.flujo; incidencia = r.incidencia || null }
      } else if (r.status === 'DONE' && firstHold) { doneDate = r.fecha; break }
    }
    if (firstHold && doneDate) {
      const leadTimeDias = Math.round((doneDate - firstHold) / (1000 * 60 * 60 * 24))
      ciclos.push({ idLink: sorted[0].idLink, usuario: sorted[0].usuario, flujo, incidencia, firstHold, doneDate, holdRegistros, leadTimeDias })
    } else if (firstHold && !doneDate) sinCierre++
  }
  const tiempos = ciclos.map(c => c.leadTimeDias).sort((a, b) => a - b)
  const n = tiempos.length
  const pct = p => n > 0 ? tiempos[Math.floor(n * p)] : 0
  const stats = { p25: pct(0.25), p50: pct(0.50), p75: pct(0.75), promedio: n > 0 ? Math.round(tiempos.reduce((s, v) => s + v, 0) / n) : 0, max: n > 0 ? tiempos[n-1] : 0, total: n }
  const byHoldRegistros = {}
  for (const c of ciclos) byHoldRegistros[c.holdRegistros] = (byHoldRegistros[c.holdRegistros] || 0) + 1
  return { ciclos, sinCierre, stats, byHoldRegistros }
}

export function holdPorSemana(historico) {
  const holds = historico.filter(r => r.status === 'HOLD')
  const map = new Map()
  for (const r of holds) {
    const key = r.week || 'sin semana'
    if (!map.has(key)) map.set(key, { week: key, total: 0, idsUnicos: new Set(), byFlujo: {} })
    const e = map.get(key)
    e.total++
    if (r.idLink) e.idsUnicos.add(r.idLink)
    e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
  }
  return Array.from(map.values()).map(e => ({ ...e, idsUnicos: e.idsUnicos.size })).sort((a, b) => Number(a.week) - Number(b.week))
}

/**
 * Snapshot de HOLD activo — hold.csv
 * Siempre mostrar con metadata de timestamp y tratar como "foto del momento"
 */
export function calcSnapshotHold(holdData, loadedAt) {
  if (!holdData?.length) return null
  const byFlujo = {}, byIncidencia = {}, byUsuario = {}
  for (const r of holdData) {
    byFlujo[r.flujo]    = (byFlujo[r.flujo] || 0) + 1
    const inc = r.incidencia || 'Sin incidencia'
    byIncidencia[inc]   = (byIncidencia[inc] || 0) + 1
    byUsuario[r.usuario] = (byUsuario[r.usuario] || 0) + 1
  }
  // Detectar si el snapshot es viejo (sin fecha de carga, no podemos calcular con certeza)
  const esViejo = false // sin timestamp en CSV, se marca como no determinado
  return { total: holdData.length, byFlujo, byIncidencia, byUsuario, loadedAt, esViejo, datos: holdData }
}

export function holdSnapshotStats(holdData) { return calcSnapshotHold(holdData, null) }
