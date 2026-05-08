const FLOW_COLORS = {
  Demanda: '#6366f1',
  Enhancement: '#38bdf8',
  'Enhanced Content': '#a78bfa',
  Soporte: '#fb923c',
  Fallos: '#ef4444',
  Validacion: '#22c55e',
  'Validación': '#22c55e',
}

const FALLBACK_COLORS = [
  '#14b8a6',
  '#f59e0b',
  '#ec4899',
  '#84cc16',
  '#06b6d4',
  '#f97316',
  '#8b5cf6',
  '#10b981',
]

export function colorMapForFlows(flujos = []) {
  const used = new Set()
  const map = new Map()
  for (const flujo of flujos) {
    const known = FLOW_COLORS[flujo]
    if (known) {
      map.set(flujo, known)
      used.add(known)
    }
  }
  let idx = 0
  for (const flujo of flujos) {
    if (map.has(flujo)) continue
    let color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
    while (used.has(color) && idx < FALLBACK_COLORS.length * 2) {
      idx += 1
      color = FALLBACK_COLORS[idx % FALLBACK_COLORS.length]
    }
    map.set(flujo, color)
    used.add(color)
    idx += 1
  }
  return map
}

