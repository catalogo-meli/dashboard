import { useState, useMemo, useCallback, useEffect } from 'react'
import { readFromURL, writeToURL } from '../utils/selectors/queryState.js'

const EMPTY_CAL = { auditor: [], dominio: [], suggestionReason: [], calidad: [] }

const CAL_LABELS = {
  correcto: 'Correcto', desvio_leve: 'Desvio leve',
  desvio_grave: 'Desvio grave', sin_clasificar: 'Sin clasificar',
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

function matches(value, selected) {
  const list = toList(selected)
  return list.length === 0 || list.includes(String(value ?? ''))
}

export function useCalidadFilters(globalFiltered) {
  const url = readFromURL()
  const [calFilters, setCalFilters] = useState({
    auditor:          readList(url.auditor),
    dominio:          readList(url.dominio),
    suggestionReason: readList(url.suggestionReason),
    calidad:          readList(url.calidad),
  })

  useEffect(() => {
    writeToURL({
      auditor:          writeList(calFilters.auditor),
      dominio:          writeList(calFilters.dominio),
      suggestionReason: writeList(calFilters.suggestionReason),
      calidad:          writeList(calFilters.calidad),
    })
  }, [calFilters])

  const setCalFilter = useCallback((key, value) => {
    setCalFilters(prev => {
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

  const resetCalFilters = useCallback(() => setCalFilters({ ...EMPTY_CAL }), [])

  const auditadosFiltrados = useMemo(() => {
    const base = globalFiltered?.auditados || []
    return base.filter(r => {
      if (!matches(r.auditor, calFilters.auditor)) return false
      if (!matches(r.dominio, calFilters.dominio)) return false
      if (!matches(r.suggestionReason, calFilters.suggestionReason)) return false
      if (!matches(r.calidad, calFilters.calidad)) return false
      return true
    })
  }, [globalFiltered?.auditados, calFilters])

  const calChips = useMemo(() => {
    const chips = []
    const meta = {
      auditor: 'Auditor', dominio: 'Dominio',
      suggestionReason: 'Codigo', calidad: 'Desvio',
    }
    for (const [key, label] of Object.entries(meta)) {
      for (const rawValue of toList(calFilters[key])) {
        chips.push({
          key: `${key}:${rawValue}`,
          filterKey: key,
          label,
          contextual: true,
          rawValue,
          value: key === 'calidad' ? (CAL_LABELS[rawValue] ?? rawValue) : rawValue,
        })
      }
    }
    return chips
  }, [calFilters])

  return { calFilters, setCalFilter, resetCalFilters, auditadosFiltrados, calChips, activeCalCount: calChips.length }
}
