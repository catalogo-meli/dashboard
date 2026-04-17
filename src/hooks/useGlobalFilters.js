import { useState, useMemo, useCallback, useEffect } from 'react'
import { readFromURL, writeToURL } from '../utils/selectors/queryState.js'
import { getWeekNumber } from '../utils/parsers.js'

export const PERIODO_MODOS = ['year', 'month', 'week', 'custom']

const MONTH_LABELS = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic']

export function weekRangeLabel(year, week) {
  const jan4 = new Date(year, 0, 4)
  const dayOfWeek = jan4.getDay() || 7
  const monday = new Date(jan4)
  monday.setDate(jan4.getDate() - (dayOfWeek - 1) + (week - 1) * 7)
  const sunday = new Date(monday)
  sunday.setDate(monday.getDate() + 6)
  const fmt = d => `${String(d.getDate()).padStart(2,'0')}/${String(d.getMonth()+1).padStart(2,'0')}`
  return `W${String(week).padStart(2,'0')} · ${fmt(monday)}–${fmt(sunday)}`
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
  usuario: null,
  flujo: null,
  equipo: null,
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
    modo,
    year:     url.pyear  ? parseInt(url.pyear)  : CURRENT_YEAR,
    subYear:  url.psuby  || 'all',
    month:    url.pmonth !== undefined ? parseInt(url.pmonth) : null,
    week:     url.pweek  !== undefined ? parseInt(url.pweek)  : null,
    fechaDesde: url.desde ? new Date(url.desde + 'T00:00:00') : null,
    fechaHasta: url.hasta ? new Date(url.hasta + 'T23:59:59') : null,
    usuario:  url.usuario || null,
    flujo:    url.flujo   || null,
    equipo:   url.equipo  || null,
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
    usuario: s.usuario,
    flujo:   s.flujo,
    equipo:  s.equipo,
  }
}

function collectYears(rows, dateField) {
  const years = new Set()
  for (const r of rows) {
    const d = r.fecha || r[dateField]
    if (d) years.add(d instanceof Date ? d.getFullYear() : new Date(d).getFullYear())
  }
  return [...years].sort()
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
    yearSet.add(y)
    monthSet.add(`${y}-${m}`)
    if (w) weekSet.add(`${y}-${w}`)
  }
  return { weekSet, monthSet, yearSet }
}

export function matchGlobalFilters(r, desde, hasta, s) {
  if (desde && r.fecha < desde) return false
  if (hasta && r.fecha > hasta) return false
  if (s.usuario && r.usuario !== s.usuario) return false
  if (s.flujo) {
    if (r.flujo != null && r.flujo !== s.flujo) return false
    if (r.byFlujo != null && !(r.byFlujo[s.flujo] > 0)) return false
  }
  if (s.equipo && r.equipo !== s.equipo) return false
  return true
}

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

export function useGlobalFilters(joinedData, activeTab) {
  const [state, setState] = useState(() => urlToState(readFromURL()))

  useEffect(() => { writeToURL(stateToURL(state)) }, [state])

  const setModo = useCallback(modo => {
    setState(prev => ({ ...prev, modo, month: null, week: null, subYear: 'all', fechaDesde: null, fechaHasta: null }))
  }, [])

  const setYear = useCallback(year => {
    setState(prev => ({ ...prev, year, month: null, week: null, subYear: 'all' }))
  }, [])

  const setSubYear = useCallback(sub => {
    setState(prev => ({ ...prev, subYear: sub }))
  }, [])

  const setMonth = useCallback(m => {
    setState(prev => ({ ...prev, month: m }))
  }, [])

  const setWeek = useCallback(w => {
    setState(prev => ({ ...prev, week: w }))
  }, [])

  const setFechaDesde = useCallback(d => {
    setState(prev => ({ ...prev, fechaDesde: d, modo: 'custom' }))
  }, [])

  const setFechaHasta = useCallback(d => {
    setState(prev => ({ ...prev, fechaHasta: d, modo: 'custom' }))
  }, [])

  const setSegFilter = useCallback((key, value) => {
    setState(prev => ({ ...prev, [key]: value ?? null }))
  }, [])

  const resetFilters = useCallback(() => setState(EMPTY), [])

  // Availability: computed from the relevant dataset for the active tab
  const availability = useMemo(() => {
    if (!joinedData) return { weekSet: new Set(), monthSet: new Set(), yearSet: new Set() }
    const isCalidad = activeTab === 'calidad'
    const rows = isCalidad
      ? [...(joinedData.auditados || []), ...(joinedData.auditados_mao || [])]
      : (joinedData.historico || [])
    return buildAvailability(rows)
  }, [joinedData, activeTab])

  const availableYears = useMemo(() => [...availability.yearSet].sort(), [availability])

  // Date range derived from current state
  const dateRange = useMemo(() => stateToDateRange(state), [state])

  // Filtered datasets
  const filtered = useMemo(() => {
    if (!joinedData) return null
    const { desde, hasta } = dateRange
    const hist = (joinedData.historico || []).filter(r => matchGlobalFilters(r, desde, hasta, state))
    const aud  = (joinedData.auditados || []).filter(r => {
      if (desde && r.fecha < desde) return false
      if (hasta && r.fecha > hasta) return false
      if (state.usuario && r.usuario !== state.usuario) return false
      if (state.equipo  && r.equipo  !== state.equipo)  return false
      return true
    })
    return {
      historico: hist,
      finalizadas: [],
      auditados: aud,
      auditados_mao: joinedData.auditados_mao || [],
      hold: joinedData.hold || [],
    }
  }, [joinedData, dateRange, state])

  // Options with counts — sourced from full dataset, filtered only by dates
  const options = useMemo(() => {
    if (!joinedData) return {}
    const { desde, hasta } = dateRange
    const hist = (joinedData.historico || []).filter(r => {
      if (desde && r.fecha < desde) return false
      if (hasta && r.fecha > hasta) return false
      return true
    })
    const aud = (joinedData.auditados || []).filter(r => {
      if (desde && r.fecha < desde) return false
      if (hasta && r.fecha > hasta) return false
      return true
    })
    const uCounts  = countBy(hist, r => r.usuario)
    const flCounts = countBy(hist, r => r.flujo)
    const eqCounts = countBy(hist.filter(r => r.equipo), r => r.equipo)
    const auCounts = countBy(aud, r => r.auditor)
    const doCounts = countBy(aud, r => r.dominio)
    const srCounts = countBy(aud, r => r.suggestionReason)
    const calCounts = countBy(aud, r => r.calidad)
    const CAL_LABELS = { correcto:'Correcto', desvio_leve:'Desvío leve', desvio_grave:'Desvío grave', sin_clasificar:'Sin clasificar' }
    const calidadOpts = ['correcto','desvio_leve','desvio_grave','sin_clasificar']
      .filter(c => (calCounts.get(c) || 0) > 0)
      .map(c => ({ value: c, label: CAL_LABELS[c] }))
    const allUsers = [...new Set(hist.map(r => r.usuario))]
    return {
      usuarios:          toOpts(allUsers, uCounts),
      flujos:            toOpts([...new Set(hist.map(r => r.flujo))], flCounts),
      equipos:           toOpts([...new Set(hist.map(r => r.equipo))].filter(Boolean), eqCounts),
      auditores:         toOpts([...new Set(aud.map(r => r.auditor))], auCounts),
      dominios:          toOpts([...new Set(aud.map(r => r.dominio))], doCounts),
      suggestionReasons: toOpts([...new Set(aud.map(r => r.suggestionReason))], srCounts),
      calidadOpts,
    }
  }, [joinedData, dateRange])

  // Weeks for selector — from availability, for current year
  const weeksForYear = useMemo(() => {
    const out = []
    for (let w = 1; w <= 53; w++) {
      const key = `${state.year}-${w}`
      const hasData = availability.weekSet.has(key)
      out.push({ week: w, label: weekRangeLabel(state.year, w), hasData })
    }
    return out.filter((_, i, arr) => {
      // trim trailing weeks with no data at end; keep all up to last week with data
      const lastWithData = arr.reduce((acc, x, idx) => x.hasData ? idx : acc, -1)
      return i <= lastWithData
    })
  }, [state.year, availability])

  // Months for selector — 12 months, disabled if no data
  const monthsForYear = useMemo(() => {
    return MONTH_LABELS.map((label, idx) => ({
      month: idx,
      label,
      hasData: availability.monthSet.has(`${state.year}-${idx}`),
    }))
  }, [state.year, availability])

  // Active chips
  const activeChips = useMemo(() => {
    const chips = []
    if (state.usuario) chips.push({ key: 'usuario', label: 'Colaborador', value: state.usuario, contextual: false })
    if (state.flujo)   chips.push({ key: 'flujo',   label: 'Flujo',       value: state.flujo,   contextual: false })
    if (state.equipo)  chips.push({ key: 'equipo',  label: 'Equipo',      value: state.equipo,  contextual: false })
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
