/**
 * HOOK: useGlobalFilters
 * Filtros globales con soporte organizacional (rol, equipo, ubicación, antigüedad, extUser)
 * + persistencia URL + presets + chips + conteo por opción
 */
import { useState, useMemo, useCallback, useEffect } from 'react'
import { readFromURL, writeToURL } from '../utils/selectors/queryState.js'
import { ANTIGUEDAD_SEGMENTOS, labelSegmento } from '../config/segments.js'

export const PRESETS = [
  { id: 'all',    label: 'Todo el período' },
  { id: 'week',   label: 'Esta semana' },
  { id: 'lastweek', label: 'Semana anterior' },
  { id: 'month',  label: 'Último mes' },
  { id: 'custom', label: 'Personalizado' },
]

function presetToDates(id) {
  const now = new Date()
  if (id === 'week') {
    const d = new Date(now); d.setDate(now.getDate() - ((now.getDay() || 7) - 1)); d.setHours(0,0,0,0)
    return { fechaDesde: d, fechaHasta: null }
  }
  if (id === 'lastweek') {
    // Semana anterior completa: lunes a domingo de la semana pasada
    const dayOfWeek = now.getDay() || 7 // lunes=1 ... domingo=7
    const lastMonday = new Date(now)
    lastMonday.setDate(now.getDate() - dayOfWeek - 6)
    lastMonday.setHours(0, 0, 0, 0)
    const lastSunday = new Date(lastMonday)
    lastSunday.setDate(lastMonday.getDate() + 6)
    lastSunday.setHours(23, 59, 59, 999)
    return { fechaDesde: lastMonday, fechaHasta: lastSunday }
  }
  if (id === 'month') {
    const d = new Date(now); d.setDate(now.getDate() - 29); d.setHours(0,0,0,0)
    return { fechaDesde: d, fechaHasta: null }
  }
  return { fechaDesde: null, fechaHasta: null }
}

const EMPTY = {
  preset: 'all', fechaDesde: null, fechaHasta: null, semana: null,
  usuario: null, flujo: null, rol: null, equipo: null,
  ubicacion: null, segAnti: null, extUser: null, status: null,
}

function urlToFilters(url) {
  const f = {
    preset: url.preset || 'all',
    fechaDesde: url.desde ? new Date(url.desde + 'T00:00:00') : null,
    fechaHasta: url.hasta ? new Date(url.hasta + 'T23:59:59') : null,
    semana: url.semana ? Number(url.semana) : null,
    usuario: url.usuario || null,
    flujo: url.flujo || null,
    rol: url.rol || null,
    equipo: url.equipo || null,
    ubicacion: url.ubicacion || null,
    segAnti: url.segAnti || null,
    extUser: url.extUser || null,
    status: url.status || null,
  }
  if (f.preset !== 'all' && !f.fechaDesde && !f.fechaHasta) {
    const dates = presetToDates(f.preset)
    f.fechaDesde = dates.fechaDesde
    f.fechaHasta = dates.fechaHasta
  }
  return f
}

function filtersToURL(f) {
  return {
    preset: f.preset !== 'all' ? f.preset : null,
    desde: f.fechaDesde ? f.fechaDesde.toISOString().slice(0,10) : null,
    hasta: f.fechaHasta ? f.fechaHasta.toISOString().slice(0,10) : null,
    semana: f.semana, usuario: f.usuario, flujo: f.flujo,
    rol: f.rol, equipo: f.equipo, ubicacion: f.ubicacion,
    segAnti: f.segAnti, extUser: f.extUser, status: f.status,
  }
}

export function matchGlobalFilters(r, f) {
  if (f.fechaDesde && r.fecha < f.fechaDesde) return false
  if (f.fechaHasta && r.fecha > f.fechaHasta) return false
  if (f.semana && r.week !== f.semana) return false
  if (f.usuario && r.usuario !== f.usuario) return false
  if (f.flujo) {
    // historico: r.flujo; finalizadas: byFlujo
    if (r.flujo != null && r.flujo !== f.flujo) return false
    if (r.byFlujo != null && !(r.byFlujo[f.flujo] > 0)) return false
  }
  if (f.status && r.status !== f.status) return false
  // Organizacionales — solo si el row tiene esos campos (after join)
  if (f.rol && r.rol !== f.rol) return false
  if (f.equipo && r.equipo !== f.equipo) return false
  if (f.ubicacion && r.ubicacion !== f.ubicacion) return false
  if (f.segAnti && r.segmentoAntiguedad !== f.segAnti) return false
  if (f.extUser != null && f.extUser !== '') {
    const isExt = f.extUser === 'true'
    if (r.extUser !== isExt) return false
  }
  return true
}

// ─── Conteo por opción ────────────────────────────────────────────────────────

function countBy(arr, keyFn) {
  const m = new Map()
  for (const r of arr) {
    const k = keyFn(r)
    if (k != null && k !== '') m.set(k, (m.get(k) || 0) + 1)
  }
  return m
}

function toOpts(allValues, counts) {
  return [...new Set(allValues)].filter(Boolean).sort().map(v => ({
    value: String(v), label: String(v), count: counts.get(String(v)) || 0,
  }))
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function useGlobalFilters(joinedData) {
  const [filters, setFilters] = useState(() => urlToFilters(readFromURL()))

  useEffect(() => { writeToURL({ ...filtersToURL(filters) }) }, [filters])

  const setFilter = useCallback((key, value) => {
    setFilters(prev => {
      const next = { ...prev, [key]: value ?? null }
      if (key === 'preset') {
        if (value && value !== 'all' && value !== 'custom') {
          const dates = presetToDates(value)
          next.fechaDesde = dates.fechaDesde
          next.fechaHasta = dates.fechaHasta
        } else if (value === 'all') {
          next.fechaDesde = null
          next.fechaHasta = null
        }
        // 'custom': no tocamos las fechas; el usuario las elige manualmente
      }
      if (key === 'fechaDesde' || key === 'fechaHasta') next.preset = 'custom'
      return next
    })
  }, [])

  const resetFilters = useCallback(() => setFilters(EMPTY), [])
  const resetCalidadFilters = useCallback(() => setFilters(prev => ({
    ...prev, auditor: null, dominio: null, suggestionReason: null, calidad: null,
  })), [])

  // Datos filtrados — aplicar a cada fuente
  const filtered = useMemo(() => {
    if (!joinedData) return null
    const hist = (joinedData.historico || []).filter(r => matchGlobalFilters(r, filters))
    const aud  = (joinedData.auditados || []).filter(r => {
      if (filters.fechaDesde && r.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && r.fecha > filters.fechaHasta) return false
      if (filters.semana && r.week !== filters.semana) return false
      if (filters.usuario && r.usuario !== filters.usuario) return false
      if (filters.rol && r.rol !== filters.rol) return false
      if (filters.equipo && r.equipo !== filters.equipo) return false
      if (filters.ubicacion && r.ubicacion !== filters.ubicacion) return false
      if (filters.segAnti && r.segmentoAntiguedad !== filters.segAnti) return false
      if (filters.extUser != null && filters.extUser !== '') {
        if (r.extUser !== (filters.extUser === 'true')) return false
      }
      return true
    })
    return { historico: hist, finalizadas: [], auditados: aud, auditados_mao: joinedData.auditados_mao || [], hold: joinedData.hold || [] }
  }, [joinedData, filters])

  // Opciones con conteo — fuente única: historico
  const options = useMemo(() => {
    if (!joinedData) return {}
    const hist = joinedData.historico || []
    const aud  = joinedData.auditados || []

    const baseHist = hist.filter(r => {
      if (filters.fechaDesde && r.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && r.fecha > filters.fechaHasta) return false
      return true
    })
    const baseAud = aud.filter(r => {
      if (filters.fechaDesde && r.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && r.fecha > filters.fechaHasta) return false
      return true
    })

    const allUsers = [...new Set(baseHist.map(r=>r.usuario))]
    const uCounts  = countBy(baseHist, r => r.usuario)
    const flCounts = countBy(baseHist, r => r.flujo)
    const rolCounts = countBy(baseHist.filter(r=>r.rol), r => r.rol)
    const eqCounts  = countBy(baseHist.filter(r=>r.equipo), r => r.equipo)
    const ubCounts  = countBy(baseHist.filter(r=>r.ubicacion), r => r.ubicacion)
    const auCounts  = countBy(baseAud, r => r.auditor)
    const doCounts  = countBy(baseAud, r => r.dominio)
    const srCounts  = countBy(baseAud, r => r.suggestionReason)

    const segAntiOpts = ANTIGUEDAD_SEGMENTOS.map(s => {
      const count = baseHist.filter(r => r.segmentoAntiguedad === s.id).length
      return { value: s.id, label: s.label, count }
    }).filter(o => o.count > 0)

    // Semanas desde historico (week calculado en normalizeHistoricoRow)
    const semanasHist = [...new Set(baseHist.map(r=>r.week))].filter(Boolean).sort((a,b)=>a-b)

    return {
      usuarios:    toOpts(allUsers, uCounts),
      flujos:      toOpts([...new Set(baseHist.map(r=>r.flujo))], flCounts),
      roles:       toOpts([...new Set(baseHist.map(r=>r.rol))].filter(Boolean), rolCounts),
      equipos:     toOpts([...new Set(baseHist.map(r=>r.equipo))].filter(Boolean), eqCounts),
      ubicaciones: toOpts([...new Set(baseHist.map(r=>r.ubicacion))].filter(Boolean), ubCounts),
      segAnti:     segAntiOpts,
      statuses:    toOpts([...new Set(baseHist.map(r=>r.status))], countBy(baseHist, r=>r.status)),
      auditores:   toOpts([...new Set(baseAud.map(r=>r.auditor))], auCounts),
      dominios:    toOpts([...new Set(baseAud.map(r=>r.dominio))], doCounts),
      suggestionReasons: toOpts([...new Set(baseAud.map(r=>r.suggestionReason))], srCounts),
      semanas: semanasHist.map(s => ({ value: s, label: `Sem ${s}`, count: countBy(baseHist, r=>String(r.week)).get(String(s)) || 0 })),
    }
  }, [joinedData, filters.fechaDesde, filters.fechaHasta, filters.semana])

  // Chips activos
  const CHIP_META = {
    preset:    { label: 'Período',      fmt: v => PRESETS.find(p=>p.id===v)?.label ?? v, skip: v => v === 'all' || v === 'custom' },
    usuario:   { label: 'Colaborador',  fmt: v => v },
    flujo:     { label: 'Flujo',        fmt: v => v },
    rol:       { label: 'Rol',          fmt: v => v },
    equipo:    { label: 'Equipo',       fmt: v => v },
    ubicacion: { label: 'Ubicación',    fmt: v => v },
    status:    { label: 'Status',       fmt: v => v },
  }

  const activeChips = useMemo(() => {
    const chips = []
    for (const [key, meta] of Object.entries(CHIP_META)) {
      const val = filters[key]
      if (!val || (meta.skip && meta.skip(val))) continue
      chips.push({ key, label: meta.label, value: meta.fmt(val), contextual: false })
    }
    return chips
  }, [filters])

  return { filters, filtered, options, setFilter, resetFilters, resetCalidadFilters, activeChips, activeCount: activeChips.length }
}
