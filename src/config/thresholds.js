// Umbrales compartidos para alertas e indicadores.
export const THRESHOLDS = {
  calidad: {
    efectividadSug:  { ok: 0.90, warn: 0.80 },
    efectividadCaso: { ok: 0.90, warn: 0.80 },
    desvioGravePct:  { ok: 0.02, warn: 0.05 },
  },
  friccion: {
    holdRelativo:  { ok: 0.05,  warn: 0.10 },
    leadTimeP50:   { ok: 3,     warn: 7 },
    leadTimeP75:   { ok: 7,     warn: 14 },
    snapshotMaxAgeHours: 48,   // cuántas horas antes de marcar snapshot como viejo
  },
  productividad: {
    caida:           { warn: 0.10, critico: 0.25 },
    concentracionTop5: { warn: 0.70 },
  },
  concentracion: {
    erroresTop3: { warn: 0.60 },
    dominiosTop5: { warn: 0.70 },
  },
  coverage: {
    desfaseMaxDias: 14,
  },
}

export function nivel(value, threshold) {
  if (value == null) return 'sin-datos'
  if (value >= threshold.ok) return 'ok'
  if (value >= threshold.warn) return 'warn'
  return 'critico'
}

export function nivelInverso(value, threshold) {
  if (value == null) return 'sin-datos'
  if (value <= threshold.ok) return 'ok'
  if (value <= threshold.warn) return 'warn'
  return 'critico'
}

export const NIVEL_COLOR = {
  ok: 'var(--green)',
  warn: 'var(--yellow)',
  critico: 'var(--red)',
  'sin-datos': 'var(--text3)',
}
