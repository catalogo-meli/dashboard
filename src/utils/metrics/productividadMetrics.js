// Metricas de productividad calculadas desde el historico operativo.

export function calcProductividadKPIs(historico) {
  if (!historico?.length) return null

  let totalTareas = 0
  let totalIds    = 0
  const fechasSet = new Set()
  const byFlujo   = {}

  for (const r of historico) {
    totalTareas += 1
    const ids = r.idsTC ?? 1
    totalIds += ids

    if (r.fechaKey) fechasSet.add(r.fechaKey)

    if (r.flujo) {
      byFlujo[r.flujo] = (byFlujo[r.flujo] || 0) + 1
    }
  }

  if (totalIds < totalTareas) {
    console.error(`[Productividad] IDs (${totalIds}) menor que tareas (${totalTareas}). Aplicando fallback.`)
    totalIds = totalTareas
  }

  const diasHabiles      = fechasSet.size
  const promTareasPorDia = diasHabiles > 0 ? Math.round(totalTareas / diasHabiles) : 0
  const promIdsPorDia    = diasHabiles > 0 ? Math.round(totalIds    / diasHabiles) : 0
  const relIdsPorTarea   = totalTareas > 0 ? Math.round((totalIds / totalTareas) * 10) / 10 : 0

  return {
    totalTareas,
    totalIds,
    relIdsPorTarea,
    promTareasPorDia,
    promIdsPorDia,
    diasHabiles,
    byFlujo,
    byFlujoIds: Object.fromEntries(Object.keys(byFlujo).map(f => [
      f,
      historico.filter(r => r.flujo === f).reduce((s, r) => s + (r.idsTC ?? 1), 0),
    ])),
  }
}

export function agruparPorSemana(historico) {
  const map = new Map()
  for (const r of (historico || [])) {
    const key = r.weekKey || `${r.weekYear || r.fecha?.getFullYear() || ''}-W${String(r.week).padStart(2, '0')}`
    if (!key) continue
    if (!map.has(key)) map.set(key, { key, week: r.week, weekYear: r.weekYear || r.fecha?.getFullYear(), totalTareas: 0, totalIds: 0, dias: new Set() })
    const e = map.get(key)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
    if (r.fechaKey) e.dias.add(r.fechaKey)
  }
  return Array.from(map.values())
    .map(e => {
      if (e.totalIds < e.totalTareas) {
        console.error(`[Productividad] Semana ${e.week}: IDs (${e.totalIds}) menor que tareas (${e.totalTareas}). Corrigiendo.`)
        e.totalIds = e.totalTareas
      }
      return {
        ...e,
        diasHabiles:      e.dias.size,
        promTareasPorDia: e.dias.size > 0 ? Math.round(e.totalTareas / e.dias.size) : 0,
        promIdsPorDia:    e.dias.size > 0 ? Math.round(e.totalIds    / e.dias.size) : 0,
      }
    })
    .sort((a, b) => a.key.localeCompare(b.key))
}

export function agruparPorSemanaConHistorico(finalizadas_ignorado, historico) {
  return agruparPorSemana(historico)
}

export function rankingColaboradores(historico) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (!r.usuario) continue
    if (!map.has(r.usuario)) {
      map.set(r.usuario, {
        usuario: r.usuario,
        totalTareas: 0, totalIds: 0,
        dias: new Set(), byFlujo: {},
        rol: r.rol || null, equipo: r.equipo || null,
        ubicacion: r.ubicacion || null, extUser: r.extUser ?? null,
        segmentoAntiguedad: r.segmentoAntiguedad || null,
        nombre: r.nombre || null,
      })
    }
    const e = map.get(r.usuario)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
    if (r.fechaKey) e.dias.add(r.fechaKey)
    if (r.flujo) {
      e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
    }
  }
  return Array.from(map.values()).map(e => {
    const ids = Math.max(e.totalIds, e.totalTareas) // IDs >= tareas
    return {
      ...e,
      totalIds:          ids,
      diasHabiles:       e.dias.size,
      promTareasPorDia:  e.dias.size > 0 ? Math.round(e.totalTareas / e.dias.size) : 0,
      promIdsPorDia:     e.dias.size > 0 ? Math.round(ids / e.dias.size) : 0,
      relIdsPorTarea:    e.totalTareas > 0 ? Math.round((ids / e.totalTareas) * 10) / 10 : 0,
    }
  }).sort((a, b) => b.totalTareas - a.totalTareas)
}

export function top5Bottom5(ranking) {
  const sorted = [...ranking].sort((a, b) => b.totalTareas - a.totalTareas)
  return { top5: sorted.slice(0, 5), bottom5: sorted.slice(-5).reverse() }
}

export function complejidadPorFlujo(historico) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (!r.flujo) continue
    if (!map.has(r.flujo)) map.set(r.flujo, { flujo: r.flujo, totalTareas: 0, totalIds: 0 })
    const e = map.get(r.flujo)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
  }
  return Array.from(map.values()).map(e => ({
    ...e,
    totalIds:       Math.max(e.totalIds, e.totalTareas), // IDs >= tareas
    relIdsPorTarea: e.totalTareas > 0
      ? Math.round((Math.max(e.totalIds, e.totalTareas) / e.totalTareas) * 10) / 10
      : 0,
  })).sort((a, b) => b.relIdsPorTarea - a.relIdsPorTarea)
}
