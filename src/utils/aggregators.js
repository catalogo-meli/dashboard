// Reexporta metricas para mantener compatibilidad con imports existentes.
export { calcCalidadKPIs, calcPorCaso as calcCalidadPorCaso, calidadPorUsuario, calidadPorAuditor, calidadPorDominio, calidadPorError, calidadPorSemana } from './metrics/calidadMetrics.js'
export { calcProductividadKPIs, agruparPorSemana, rankingColaboradores as rankingPorColaborador } from './metrics/productividadMetrics.js'
export { calcHoldKPIs, calcHoldLeadTime, holdPorSemana, calcSnapshotHold as holdSnapshotStats } from './metrics/friccionMetrics.js'

export function groupBy(arr, keyFn, initFn, reduceFn) {
  const map = new Map()
  for (const item of arr) {
    const key = keyFn(item)
    if (key == null || key === '') continue
    if (!map.has(key)) map.set(key, initFn(item))
    reduceFn(map.get(key), item)
  }
  return map
}
export function sumBy(arr, fn) { return arr.reduce((acc, item) => acc + (fn(item) || 0), 0) }
export function mapToArray(map, keyName = 'key') { return Array.from(map.entries()).map(([k, v]) => ({ [keyName]: k, ...v })) }
