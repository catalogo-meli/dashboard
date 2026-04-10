/**
 * CALIDAD METRICS v4
 * Unidad principal: sugerencia_id
 * Unidad contextual: id_caso
 */

export function calcCalidadKPIs(auditados) {
  if (!auditados?.length) return null

  const totalSugs = auditados.length
  const bySug = { correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0 }
  for (const r of auditados) bySug[r.calidad] = (bySug[r.calidad] || 0) + 1

  // Por caso
  const casos = calcPorCaso(auditados)
  const totalCasos = casos.length
  const byCaso = { correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0 }
  for (const c of casos) byCaso[c.calidad] = (byCaso[c.calidad] || 0) + 1

  const promSugs = totalCasos > 0 ? totalSugs / totalCasos : 0
  const pctSingle = totalCasos > 0 ? casos.filter(c => c.nSugerencias === 1).length / totalCasos : 0

  return {
    // Por sugerencia (PRINCIPAL)
    totalSugs,
    bySug,
    efectividadSug: totalSugs > 0 ? bySug.correcto / totalSugs : 0,
    // Por caso (CONTEXTUAL)
    totalCasos,
    byCaso,
    efectividadCaso: totalCasos > 0 ? byCaso.correcto / totalCasos : 0,
    // Gap entre ambas
    gapEfectividad: null, // se calcula después
    // Composición
    promSugs: Math.round(promSugs * 10) / 10,
    pctSingle,
    pctMulti: 1 - pctSingle,
  }
}

export function calcPorCaso(auditados) {
  const casos = new Map()
  for (const r of auditados) {
    if (!casos.has(r.idCaso)) {
      casos.set(r.idCaso, { idCaso: r.idCaso, usuario: r.usuario, auditor: r.auditor,
        fechaKey: r.fechaKey, week: r.week, dominio: r.dominio, sugerencias: [] })
    }
    casos.get(r.idCaso).sugerencias.push(r)
  }
  return Array.from(casos.values()).map(c => {
    const sug = c.sugerencias
    const todasOk = sug.every(s => s.calidad === 'correcto')
    const tieneGrave = sug.some(s => s.calidad === 'desvio_grave')
    const tieneLeve  = sug.some(s => s.calidad === 'desvio_leve')
    return {
      ...c,
      nSugerencias: sug.length,
      calidad: todasOk ? 'correcto' : tieneGrave ? 'desvio_grave' : tieneLeve ? 'desvio_leve' : 'sin_clasificar',
    }
  })
}

export function calidadPorDominio(auditados) {
  const map = new Map()
  for (const r of auditados) {
    const k = r.dominio || 'Sin dominio'
    if (!map.has(k)) map.set(k, { dominio: k, total: 0, correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0 })
    const e = map.get(k)
    e.total++
    e[r.calidad] = (e[r.calidad] || 0) + 1
  }
  return Array.from(map.values())
    .map(e => ({ ...e, efectividad: e.total > 0 ? e.correcto / e.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

export function calidadPorError(auditados) {
  const map = new Map()
  for (const r of auditados) {
    const k = r.suggestionReason || 'Sin código'
    if (!map.has(k)) map.set(k, { error: k, total: 0, correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0 })
    const e = map.get(k)
    e.total++
    e[r.calidad] = (e[r.calidad] || 0) + 1
  }
  return Array.from(map.values())
    .map(e => ({ ...e, efectividad: e.total > 0 ? e.correcto / e.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

export function calidadPorUsuario(auditados) {
  const mapSug = new Map()
  for (const r of auditados) {
    if (!mapSug.has(r.usuario)) {
      mapSug.set(r.usuario, { usuario: r.usuario, totalSugs: 0, correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0,
        rol: r.rol || null, equipo: r.equipo || null, extUser: r.extUser ?? null })
    }
    const e = mapSug.get(r.usuario)
    e.totalSugs++
    e[r.calidad] = (e[r.calidad] || 0) + 1
  }
  const casos = calcPorCaso(auditados)
  const mapCaso = new Map()
  for (const c of casos) {
    if (!mapCaso.has(c.usuario)) mapCaso.set(c.usuario, { totalCasos: 0, correctoCasos: 0 })
    const e = mapCaso.get(c.usuario)
    e.totalCasos++
    if (c.calidad === 'correcto') e.correctoCasos++
  }
  return Array.from(mapSug.values()).map(e => {
    const cd = mapCaso.get(e.usuario) || { totalCasos: 0, correctoCasos: 0 }
    return {
      ...e,
      efectividadSug:  e.totalSugs > 0 ? e.correcto / e.totalSugs : 0,
      totalCasos:      cd.totalCasos,
      efectividadCaso: cd.totalCasos > 0 ? cd.correctoCasos / cd.totalCasos : 0,
    }
  }).sort((a, b) => b.efectividadSug - a.efectividadSug)
}

export function calidadPorAuditor(auditados) {
  const map = new Map()
  for (const r of auditados) {
    if (!map.has(r.auditor)) map.set(r.auditor, { auditor: r.auditor, total: 0, correcto: 0, desvio_leve: 0, desvio_grave: 0, sin_clasificar: 0 })
    const e = map.get(r.auditor)
    e.total++
    e[r.calidad] = (e[r.calidad] || 0) + 1
  }
  return Array.from(map.values())
    .map(e => ({ ...e, efectividad: e.total > 0 ? e.correcto / e.total : 0 }))
    .sort((a, b) => b.total - a.total)
}

export function calidadPorSemana(auditados) {
  const mapSug = new Map()
  for (const r of auditados) {
    const k = r.week || 'sin semana'
    if (!mapSug.has(k)) mapSug.set(k, { week: k, total: 0, correcto: 0, desvio_leve: 0, desvio_grave: 0 })
    const e = mapSug.get(k)
    e.total++
    e[r.calidad] = (e[r.calidad] || 0) + 1
  }
  const casos = calcPorCaso(auditados)
  const mapCaso = new Map()
  for (const c of casos) {
    const k = c.week || 'sin semana'
    if (!mapCaso.has(k)) mapCaso.set(k, { totalCasos: 0, correctoCasos: 0 })
    const e = mapCaso.get(k)
    e.totalCasos++
    if (c.calidad === 'correcto') e.correctoCasos++
  }
  return Array.from(mapSug.values()).map(e => {
    const cd = mapCaso.get(e.week) || { totalCasos: 0, correctoCasos: 0 }
    return {
      ...e,
      efectividadSug:  e.total > 0 ? e.correcto / e.total : 0,
      efectividadCaso: cd.totalCasos > 0 ? cd.correctoCasos / cd.totalCasos : 0,
    }
  }).sort((a, b) => Number(a.week) - Number(b.week))
}

export function concentracionDesvios(auditados) {
  const porError = calidadPorError(auditados)
  const totalDesv = auditados.filter(r => r.calidad !== 'correcto').length
  const top3Desv = porError.slice(0, 3).reduce((s, e) => s + (e.desvio_leve || 0) + (e.desvio_grave || 0), 0)
  const pctTop3 = totalDesv > 0 ? top3Desv / totalDesv : 0
  return { porError, totalDesv, top3Desv, pctTop3 }
}
