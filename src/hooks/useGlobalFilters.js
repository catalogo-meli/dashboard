import { useState, useMemo, useCallback, useEffect } from 'react'
import { readFromURL, writeToURL } from '../utils/selectors/queryState.js'
import { getWeekNumber, getWeekYear } from '../utils/parsers.js'

export const PERIODO_MODOS = ['year', 'month', 'week', 'custom']

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']
const SEGMENT_FILTERS = ['usuario', 'flujo', 'equipo', 'iniciativa']

function isVisibleFlujo(flujo) {
  return Boolean(flujo) && flujo !== 'Sin flujo'
}

export function weekRangeLabel(year, week) {
  const { desde, hasta } = weekRangeDates(year, week)
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  return `W${String(week).padStart(2,'0')} - ${fmt(desde)}-${fmt(hasta)}`
}

export function weekRangeDates(year, week) {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (dayOfWeek - 1) + (week - 1) * 7)
  monday.setHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  sunday.setHours(23, 59, 59, 999)
  return { desde: monday, hasta: sunday }
}

function quarterRange(year, q) {
  const starts = [0, 3, 6, 9]
  const ends   = [2, 5, 8, 11]
  const desde = new Date(year, starts[q - 1], 1)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(year, ends[q - 1] + 1, 0)
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

function monthRange(year, month) {
  const desde = new Date(year, month, 1)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(year, month + 1, 0)
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

function yearRange(year) {
  const desde = new Date(year, 0, 1)
  desde.setHours(0, 0, 0, 0)
  const hasta = new Date(year, 11, 31)
  hasta.setHours(23, 59, 59, 999)
  return { desde, hasta }
}

const CURRENT_YEAR = new Date().getFullYear()

const EMPTY = {
  modo: 'week',
  year: CURRENT_YEAR,
  subYear: 'all',
  month: null,
  week: null,
  fechaDesde: null,
  fechaHasta: null,
  usuario: [],
  flujo: [],
  equipo: [],
  iniciativa: [],
}

function toList(value) {
  if (Array.isArray(value)) return value.filter(v => v != null && v !== '').map(String)
  if (value == null || value === '') return []
  return [String(value)]
}

function readList(value) {
  if (!value) return []
  try {
    const parsed = JSON.parse(value)
    if (Array.isArray(parsed)) return toList(parsed)
  } catch {}
  return String(value).split('|').filter(Boolean)
}

function writeList(values) {
  const list = toList(values)
  return list.length ? JSON.stringify(list) : null
}

function stateToDateRange(s) {
  if (s.modo === 'custom') return { desde: s.fechaDesde, hasta: s.fechaHasta }
  if (s.modo === 'year') {
    if (s.subYear === 'all') return yearRange(s.year)
    const q = parseInt(s.subYear.replace('q',''))
    return quarterRange(s.year, q)
  }
  if (s.modo === 'month' && s.month !== null) return monthRange(s.year, s.month)
  if (s.modo === 'week' && s.week !== null) return weekRangeDates(s.year, s.week)
  return { desde: null, hasta: null }
}

function urlToState(url) {
  const modo = PERIODO_MODOS.includes(url.pmodo) ? url.pmodo : 'week'
  return {
    ...EMPTY,
    modo,
    year:     url.pyear  ? parseInt(url.pyear)  : CURRENT_YEAR,
    subYear:  url.psuby  || 'all',
    month:    url.pmonth !== undefined ? parseInt(url.pmonth) : null,
    week:     url.pweek  !== undefined ? parseInt(url.pweek)  : null,
    fechaDesde: url.desde ? new Date(url.desde + 'T00:00:00') : null,
    fechaHasta: url.hasta ? new Date(url.hasta + 'T23:59:59') : null,
    usuario:    readList(url.usuario),
    flujo:      readList(url.flujo),
    equipo:     readList(url.equipo),
    iniciativa: readList(url.iniciativa),
  }
}

function stateToURL(s) {
  return {
    pmodo:  s.modo !== 'week' ? s.modo : null,
    pyear:  s.year !== CURRENT_YEAR ? String(s.year) : null,
    psuby:  s.subYear !== 'all' ? s.subYear : null,
    pmonth: s.month !== null ? String(s.month) : null,
    pweek:  s.week  !== null ? String(s.week)  : null,
    desde:  s.fechaDesde ? s.fechaDesde.toISOString().slice(0,10) : null,
    hasta:  s.fechaHasta ? s.fechaHasta.toISOString().slice(0,10) : null,
    usuario: writeList(s.usuario),
    flujo: writeList(s.flujo),
    equipo: writeList(s.equipo),
    iniciativa: writeList(s.iniciativa),
  }
}

function hasAny(s, key) {
  return toList(s[key]).length > 0
}

function matchesValue(rowValue, selected) {
  const list = toList(selected)
  return list.length === 0 || list.includes(String(rowValue ?? ''))
}

export function buildAvailability(rows) {
  const weekSet  = new Set()
  const monthSet = new Set()
  const yearSet  = new Set()
  for (const r of rows) {
    if (!r.fecha) continue
    const y = r.fecha.getFullYear()
    const m = r.fecha.getMonth()
    const w = r.week || getWeekNumber(r.fecha)
    const wy = r.weekYear || getWeekYear(r.fecha) || y
    yearSet.add(y)
    monthSet.add(`${y}-${m}`)
    if (w) weekSet.add(`${wy}-${w}`)
  }
  return { weekSet, monthSet, yearSet }
}

function isIgnored(ignore, key) {
  return Array.isArray(ignore) ? ignore.includes(key) : ignore === key
}

export function matchGlobalFilters(r, desde, hasta, s, opts = {}) {
  const ignore = opts.ignoreKey
  if (desde && r.fecha < desde) return false
  if (hasta && r.fecha > hasta) return false
  if (!isIgnored(ignore, 'usuario') && !matchesValue(r.usuario, s.usuario)) return false
  if (!isIgnored(ignore, 'flujo') && hasAny(s, 'flujo')) {
    const flujos = toList(s.flujo)
    if (r.flujo != null && !flujos.includes(String(r.flujo))) return false
    if (r.byFlujo != null && !flujos.some(f => r.byFlujo[f] > 0)) return false
  }
  if (!isIgnored(ignore, 'equipo') && !matchesValue(r.equipo, s.equipo)) return false
  if (!isIgnored(ignore, 'iniciativa') && !matchesValue(r.iniciativa, s.iniciativa)) return false
  return true
}

function matchAuditBase(r, desde, hasta, s) {
  if (desde && r.fecha < desde) return false
  if (hasta && r.fecha > hasta) return false
  if (!matchesValue(r.usuario, s.usuario)) return false
  if (!matchesValue(r.equipo, s.equipo)) return false
  return true
}

function countBy(arr, keyFn) {
  const m = new Map()
  for (const r of arr) {
    const k = keyFn(r)
    if (k != null && k !== '') m.set(String(k), (m.get(String(k)) || 0) + 1)
  }
  return m
}

function toOpts(values, counts) {
  return [...new Set(values.map(v => String(v)).filter(Boolean))]
    .sort((a, b) => a.localeCompare(b, 'es'))
    .map(v => ({ value: v, label: v, count: counts.get(v) || 0 }))
}

function optionRows(hist, dateRange, state, key, extraIgnore = []) {
  const { desde, hasta } = dateRange
  return (hist || []).filter(r => matchGlobalFilters(r, desde, hasta, state, { ignoreKey: [key, ...extraIgnore] }))
}

function sameList(a, b) {
  const aa = toList(a)
  const bb = toList(b)
  return aa.length === bb.length && aa.every((v, i) => v === bb[i])
}

export function useGlobalFilters(joinedData, activeTab) {
  const [state, setState] = useState(() => urlToState(readFromURL()))

  useEffect(() => { writeToURL(stateToURL(state)) }, [state])

  const setModo = useCallback(modo => {
    setState(prev => ({ ...prev, modo, month: null, week: null, subYear: 'all', fechaDesde: null, fechaHasta: null }))
  }, [])

  const setYear = useCallback(year => {
    setState(prev => ({ ...prev, year, month: null, week: null, subYear: 'all' }))
  }, [])

  const setSubYear = useCallback(sub => setState(prev => ({ ...prev, subYear: sub })), [])
  const setMonth = useCallback(m => setState(prev => ({ ...prev, month: m })), [])
  const setWeek = useCallback(w => setState(prev => ({ ...prev, week: w })), [])
  const setFechaDesde = useCallback(d => setState(prev => ({ ...prev, fechaDesde: d, modo: 'custom' })), [])
  const setFechaHasta = useCallback(d => setState(prev => ({ ...prev, fechaHasta: d, modo: 'custom' })), [])

  const setSegFilter = useCallback((key, value) => {
    setState(prev => {
      const current = toList(prev[key])
      const next = Array.isArray(value)
        ? toList(value)
        : value == null
          ? []
          : current.includes(String(value))
            ? current.filter(v => v !== String(value))
            : [...current, String(value)]
      return { ...prev, [key]: next }
    })
  }, [])

  const resetFilters = useCallback(() => setState({ ...EMPTY }), [])

  const availability = useMemo(() => {
    if (!joinedData) return { weekSet: new Set(), monthSet: new Set(), yearSet: new Set() }
    const isCalidad = activeTab === 'calidad'
    const isTiemposCdm = activeTab === 'tiempos_cdm'
    const rows = isCalidad
      ? [...(joinedData.auditados || []), ...(joinedData.auditados_mao || [])]
      : isTiemposCdm
        ? (joinedData.tiempos_cdm || [])
      : (joinedData.historico || [])
    return buildAvailability(rows)
  }, [joinedData, activeTab])

  const availableYears = useMemo(() => [...availability.yearSet].sort((a, b) => a - b), [availability])
  const dateRange = useMemo(() => stateToDateRange(state), [state])

  const filtered = useMemo(() => {
    if (!joinedData) return null
    const { desde, hasta } = dateRange
    const hist = (joinedData.historico || []).filter(r => matchGlobalFilters(r, desde, hasta, state))
    const tiemposCdm = (joinedData.tiempos_cdm || []).filter(r => matchGlobalFilters(r, desde, hasta, state, { ignoreKey: 'iniciativa' }))
    const histOnlyFilterActive = hasAny(state, 'flujo') || hasAny(state, 'iniciativa')
    const allowedUsuarios = new Set(hist.map(r => r.usuario))
    const aud  = (joinedData.auditados || []).filter(r => {
      if (!matchAuditBase(r, desde, hasta, state)) return false
      if (histOnlyFilterActive && !allowedUsuarios.has(r.usuario)) return false
      return true
    })
    return {
      historico: hist,
      finalizadas: [],
      auditados: aud,
      auditados_mao: joinedData.auditados_mao || [],
      hold: joinedData.hold || [],
      tiempos_cdm: tiemposCdm,
    }
  }, [joinedData, dateRange, state])

  const options = useMemo(() => {
    if (!joinedData) return {}
    const isTiemposCdm = activeTab === 'tiempos_cdm'
    const hist = isTiemposCdm ? (joinedData.tiempos_cdm || []) : (joinedData.historico || [])
    const extraIgnore = isTiemposCdm ? ['iniciativa'] : []
    const rowsUsuario = optionRows(hist, dateRange, state, 'usuario', extraIgnore)
    const rowsFlujo = optionRows(hist, dateRange, state, 'flujo', extraIgnore)
    const rowsEquipo = optionRows(hist, dateRange, state, 'equipo', extraIgnore)
    const rowsIniciativa = isTiemposCdm ? [] : optionRows(hist, dateRange, state, 'iniciativa')

    const aud = (joinedData.auditados || []).filter(r => matchAuditBase(r, dateRange.desde, dateRange.hasta, state))
    const auCounts = countBy(aud, r => r.auditor)
    const doCounts = countBy(aud, r => r.dominio)
    const srCounts = countBy(aud, r => r.suggestionReason)
    const calCounts = countBy(aud, r => r.calidad)
    const CAL_LABELS = { correcto:'Correcto', desvio_leve:'Desvio leve', desvio_grave:'Desvio grave', sin_clasificar:'Sin clasificar' }
    const calidadOpts = ['correcto','desvio_leve','desvio_grave','sin_clasificar']
      .filter(c => (calCounts.get(c) || 0) > 0)
      .map(c => ({ value: c, label: CAL_LABELS[c] }))

    return {
      usuarios: toOpts(rowsUsuario.map(r => r.usuario), countBy(rowsUsuario, r => r.usuario)),
      flujos: toOpts(rowsFlujo.map(r => r.flujo).filter(isVisibleFlujo), countBy(rowsFlujo.filter(r => isVisibleFlujo(r.flujo)), r => r.flujo)),
      equipos: toOpts(rowsEquipo.map(r => r.equipo).filter(Boolean), countBy(rowsEquipo, r => r.equipo)),
      iniciativas: toOpts(rowsIniciativa.map(r => r.iniciativa), countBy(rowsIniciativa, r => r.iniciativa)),
      auditores: toOpts(aud.map(r => r.auditor), auCounts),
      dominios: toOpts(aud.map(r => r.dominio), doCounts),
      suggestionReasons: toOpts(aud.map(r => r.suggestionReason), srCounts),
      calidadOpts,
    }
  }, [joinedData, dateRange, state, activeTab])

  // Limpia selecciones que se volvieron imposibles por otros filtros o por fecha.
  useEffect(() => {
    if (!joinedData) return
    setState(prev => {
      let next = prev
      const optionMap = {
        usuario: options.usuarios || [],
        flujo: options.flujos || [],
        equipo: options.equipos || [],
        iniciativa: options.iniciativas || [],
      }
      for (const key of SEGMENT_FILTERS) {
        const allowed = new Set(optionMap[key].map(o => String(o.value)))
        const current = toList(prev[key])
        const valid = current.filter(v => allowed.has(v))
        if (!sameList(current, valid)) next = { ...next, [key]: valid }
      }
      return next
    })
  }, [joinedData, options.usuarios, options.flujos, options.equipos, options.iniciativas])

  const weeksForYear = useMemo(() => {
    const out = []
    for (let w = 1; w <= 53; w++) {
      const key = `${state.year}-${w}`
      const hasData = availability.weekSet.has(key)
      out.push({ week: w, label: weekRangeLabel(state.year, w), hasData })
    }
    return out.filter((_, i, arr) => {
      const lastWithData = arr.reduce((acc, x, idx) => x.hasData ? idx : acc, -1)
      return i <= lastWithData
    })
  }, [state.year, availability])

  const monthsForYear = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => ({
      month: idx,
      label,
      hasData: availability.monthSet.has(`${state.year}-${idx}`),
    }))
  }, [state.year, availability])

  const activeChips = useMemo(() => {
    const chips = []
    const meta = {
      usuario: 'Colaborador',
      flujo: 'Flujo',
      equipo: 'Equipo',
      iniciativa: 'Iniciativa',
    }
    for (const [key, label] of Object.entries(meta)) {
      for (const value of toList(state[key])) {
        chips.push({ key: `${key}:${value}`, filterKey: key, label, value, contextual: false })
      }
    }
    return chips
  }, [state])

  const filters = {
    ...state,
    fechaDesde: dateRange.desde,
    fechaHasta: dateRange.hasta,
  }

  return {
    filters,
    state,
    filtered,
    options,
    availability,
    availableYears,
    weeksForYear,
    monthsForYear,
    setModo,
    setYear,
    setSubYear,
    setMonth,
    setWeek,
    setFechaDesde,
    setFechaHasta,
    setSegFilter,
    resetFilters,
    activeChips,
    activeCount: activeChips.length,
  }
}
