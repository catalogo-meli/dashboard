import { useState, useMemo, useCallback, useEffect } from 'react'
import { readFromURL, writeToURL } from '../utils/selectors/queryState.js'

const EMPTY_CAL = { auditor: null, dominio: null, suggestionReason: null, calidad: null }

const CAL_LABELS = {
  correcto: 'Correcto', desvio_leve: 'Desvío leve',
  desvio_grave: 'Desvío grave', sin_clasificar: 'Sin clasificar',
}

export function useCalidadFilters(globalFiltered) {
  const url = readFromURL()
  const [calFilters, setCalFilters] = useState({
    auditor:          url.auditor          || null,
    dominio:          url.dominio          || null,
    suggestionReason: url.suggestionReason || null,
    calidad:          url.calidad          || null,
  })

  useEffect(() => {
    writeToURL({
      auditor:          calFilters.auditor,
      dominio:          calFilters.dominio,
      suggestionReason: calFilters.suggestionReason,
      calidad:          calFilters.calidad,
    })
  }, [calFilters])

  const setCalFilter = useCallback((key, value) => {
    setCalFilters(prev => ({ ...prev, [key]: value ?? null }))
  }, [])

  const resetCalFilters = useCallback(() => setCalFilters(EMPTY_CAL), [])

  const auditadosFiltrados = useMemo(() => {
    const base = globalFiltered?.auditados || []
    return base.filter(r => {
      if (calFilters.auditor          && r.auditor          !== calFilters.auditor)          return false
      if (calFilters.dominio          && r.dominio          !== calFilters.dominio)          return false
      if (calFilters.suggestionReason && r.suggestionReason !== calFilters.suggestionReason) return false
      if (calFilters.calidad          && r.calidad          !== calFilters.calidad)          return false
      return true
    })
  }, [globalFiltered?.auditados, calFilters])

  const calChips = useMemo(() => {
    const chips = []
    const meta = {
      auditor: 'Auditor', dominio: 'Dominio',
      suggestionReason: 'Código', calidad: 'Desvío',
    }
    for (const [key, label] of Object.entries(meta)) {
      const val = calFilters[key]
      if (!val) continue
      chips.push({
        key, label, contextual: true,
        value: key === 'calidad' ? (CAL_LABELS[val] ?? val) : val,
      })
    }
    return chips
  }, [calFilters])

  return { calFilters, setCalFilter, resetCalFilters, auditadosFiltrados, calChips, activeCalCount: calChips.length }
}
