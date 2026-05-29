import { useState, useMemo } from 'react'

const EMPTY_FILTERS = {
  fechaDesde: null,
  fechaHasta: null,
  semana: null,
  usuario: null,
  flujo: null,
  status: null,
  auditor: null,
  dominio: null,
  suggestionReason: null,
  calidad: null,
}

export function useFilters(data) {
  const [filters, setFilters] = useState(EMPTY_FILTERS)

  function setFilter(key, value) {
    setFilters(prev => ({ ...prev, [key]: value || null }))
  }

  function resetFilters() {
    setFilters(EMPTY_FILTERS)
  }

  const options = useMemo(() => {
    if (!data) return {}

    const usuarios = [...new Set([
      ...(data.historico || []).map(r => r.usuario),
      ...(data.finalizadas || []).map(r => r.usuario),
    ])].filter(Boolean).sort()

    const flujos = [...new Set((data.historico || []).map(r => r.flujo))].filter(Boolean).sort()
    const statuses = [...new Set((data.historico || []).map(r => r.status))].filter(Boolean).sort()
    const auditores = [...new Set((data.auditados || []).map(r => r.auditor))].filter(Boolean).sort()
    const dominios = [...new Set((data.auditados || []).map(r => r.dominio))].filter(Boolean).sort()
    const suggestionReasons = [...new Set((data.auditados || []).map(r => r.suggestionReason))].filter(Boolean).sort()
    const semanas = [...new Set([
      ...(data.finalizadas || []).map(r => r.week),
    ])].filter(Boolean).sort((a, b) => a - b)

    return { usuarios, flujos, statuses, auditores, dominios, suggestionReasons, semanas }
  }, [data])

  // Datos filtrados
  const filtered = useMemo(() => {
    if (!data) return data

    function matchDate(r) {
      if (!r.fecha) return true
      if (filters.fechaDesde && r.fecha < filters.fechaDesde) return false
      if (filters.fechaHasta && r.fecha > filters.fechaHasta) return false
      return true
    }

    const historico = (data.historico || []).filter(r => {
      if (!matchDate(r)) return false
      if (filters.semana && r.week !== Number(filters.semana)) return false
      if (filters.usuario && r.usuario !== filters.usuario) return false
      if (filters.flujo && r.flujo !== filters.flujo) return false
      if (filters.status && r.status !== filters.status) return false
      return true
    })

    const finalizadas = (data.finalizadas || []).filter(r => {
      if (!matchDate(r)) return false
      if (filters.semana && r.week !== Number(filters.semana)) return false
      if (filters.usuario && r.usuario !== filters.usuario) return false
      if (filters.flujo && !r.byFlujo[filters.flujo]) return false
      return true
    })

    const auditados = (data.auditados || []).filter(r => {
      if (!matchDate(r)) return false
      if (filters.semana && r.week !== Number(filters.semana)) return false
      if (filters.usuario && r.usuario !== filters.usuario) return false
      if (filters.auditor && r.auditor !== filters.auditor) return false
      if (filters.dominio && r.dominio !== filters.dominio) return false
      if (filters.suggestionReason && r.suggestionReason !== filters.suggestionReason) return false
      if (filters.calidad && r.calidad !== filters.calidad) return false
      return true
    })

    const hold = data.hold || []

    return { historico, finalizadas, auditados, hold }
  }, [data, filters])

  const activeCount = Object.values(filters).filter(v => v !== null).length

  return { filters, filtered, options, setFilter, resetFilters, activeCount }
}
