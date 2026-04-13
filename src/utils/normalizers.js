import { parseDate, parseNumber, toDateKey, getWeekNumber } from './parsers.js'
import { segmentoAntiguedad } from '../config/segments.js'

// Helper: acceso tolerante a claves con variantes de nombre
function get(raw, ...keys) {
  for (const key of keys) {
    if (raw[key] !== undefined && raw[key] !== null && raw[key] !== '') return String(raw[key]).trim()
    // Búsqueda case-insensitive como fallback
    const kLow = key.toLowerCase()
    for (const k of Object.keys(raw)) {
      if (k.toLowerCase() === kLow && raw[k] !== undefined && raw[k] !== null && raw[k] !== '') {
        return String(raw[k]).trim()
      }
    }
  }
  return ''
}

export function normalizeHistoricoRow(raw) {
  const fecha = parseDate(raw['Fecha'])
  return {
    fecha,
    fechaKey: toDateKey(fecha),
    week: fecha ? getWeekNumber(fecha) : null,
    usuario: (raw['Usuario'] || '').trim(),
    flujo: (raw['Flujo de Tarea'] || '').trim(),
    idLink: (raw['ID - LINK'] || '').trim(),
    status: (raw['Status'] || '').trim().toUpperCase(),
    iniciativa: (raw['Iniciativa'] || '').trim() || null,
    incidencia: (raw['Incidencias'] || '').trim() || null,
    idsTC: Math.max(1, parseNumber(raw['IDs trabajados'])),
    comentarios: (raw['Comentarios'] || '').trim() || null,
  }
}

export function normalizeHistorico(rows) {
  return rows.map(normalizeHistoricoRow).filter(r => r.fecha && r.usuario)
}

const FLUJOS_FINALIZADAS = ['Demanda', 'Enhanced Content', 'Enhancement', 'Fallos', 'Soporte', 'Validación']

export function normalizeFinalizadasRow(raw) {
  const fecha = parseDate(raw['Fecha'])
  const byFlujo = {}
  let totalFlujos = 0
  for (const f of FLUJOS_FINALIZADAS) {
    const v = parseNumber(raw[f])
    byFlujo[f] = v
    totalFlujos += v
  }
  return {
    fecha,
    fechaKey: toDateKey(fecha),
    week: parseNumber(raw['Week']) || (fecha ? getWeekNumber(fecha) : null),
    usuario: (raw['Usuario'] || '').trim(),
    byFlujo,
    idsTC: Math.max(1, parseNumber(raw['IDs trabajados'])),
    total: parseNumber(raw['Total']),
    totalEfectivo: parseNumber(raw['Total']) || totalFlujos,
  }
}

export function normalizeFinalizadas(rows) {
  return rows.map(normalizeFinalizadasRow).filter(r => r.fecha && r.usuario)
}

export function clasificarCalidad(estadoFinal, motivoRechazo) {
  const ef = (estadoFinal || '').trim().toUpperCase()
  const mr = (motivoRechazo || '').trim().toUpperCase()
  if (ef === 'OK' && mr === 'OK') return 'correcto'
  if (ef === 'OK' && mr === 'NOT OK') return 'desvio_leve'
  if (ef === 'NOT OK' && mr === 'NOT OK') return 'desvio_grave'
  return 'sin_clasificar'
}

export const CALIDAD_LABELS = {
  correcto: 'Correcto', desvio_leve: 'Desvío leve',
  desvio_grave: 'Desvío grave', sin_clasificar: 'Sin clasificar',
}
export const CALIDAD_COLORS = {
  correcto: '#22c55e', desvio_leve: '#f59e0b',
  desvio_grave: '#ef4444', sin_clasificar: '#94a3b8',
}

export function normalizeAuditadoRow(raw) {
  const fecha = parseDate(raw['ultimaActualizacion'])
  const estadoFinal = (raw['EstadoFinal_esCorrecto'] || '').trim()
  const motivoRechazo = (raw['Motivo_de_Rechazo_esCorrecto'] || '').trim()
  return {
    fecha,
    fechaKey: toDateKey(fecha),
    week: fecha ? getWeekNumber(fecha) : null,
    idCaso: (raw['id_caso'] || raw['casoId'] || '').trim(),
    sugerenciaId: String(raw['sugerencia_id'] || '').trim(),
    dominio: (raw['Dominio'] || '').trim() || null,
    usuario: (raw['usuario'] || '').trim(),
    estadoCaso: (raw['estado_caso'] || '').trim(),
    suggestionReason: (raw['suggestion_reason'] || '').trim() || null,
    auditor: (raw['Auditor'] || '').trim(),
    estadoFinal,
    motivoRechazo,
    calidad: clasificarCalidad(estadoFinal, motivoRechazo),
    casuisticas: (raw['Casuisticas'] || '').trim() || null,
    casuisticasAgrupadas: (raw['Casuisticas agrupadas'] || '').trim() || null,
    comentario: (raw['Comentario'] || '').trim() || null,
    aplicaBtc: (raw['Aplica_BTC'] || '').trim() || null,
    tipoBtc: (raw['Tipo_de_BTC'] || '').trim() || null,
  }
}

export function normalizeAuditados(rows) {
  return rows.map(normalizeAuditadoRow).filter(r => r.idCaso && r.usuario)
}

// Campos: FECHA_ACCIONAMIENTO, ID_CDM, COLABORADOR, DOMINIO, RESOLUCION,
//         Auditor, EstadoFinal_esCorrecto, Motivo_de_Rechazo_esCorrecto

export function normalizeMaoRow(raw) {
  // Fecha: "29 dic 2025" → parseDate lo maneja vía DD MMM YYYY
  // El parseDate existente soporta DD/MM/YYYY y DD-MM-YYYY.
  // Para "29 dic 2025" necesitamos convertirlo primero.
  const fechaRaw = (raw['FECHA_ACCIONAMIENTO'] || '').trim()
  const fecha = parseFechaEspanol(fechaRaw)

  const estadoFinal   = (raw['EstadoFinal_esCorrecto'] || '').trim()
  const motivoRechazo = (raw['Motivo_de_Rechazo_esCorrecto'] || '').trim()

  return {
    fecha,
    fechaKey: toDateKey(fecha),
    week: fecha ? getWeekNumber(fecha) : null,
    idCaso:      (raw['ID_CDM'] || '').trim(),
    sugerenciaId: (raw['ID_CDM'] || '').trim(),     dominio:     (raw['DOMINIO'] || '').trim() || null,
    usuario:     (raw['COLABORADOR'] || '').trim(),
    resolucion:  (raw['RESOLUCION'] || '').trim() || null,
    suggestionReason: (raw['RESOLUCION'] || '').trim() || null, // equivalente a suggestion_reason en SdC
    auditor:     (raw['Auditor'] || '').trim(),
    estadoFinal,
    motivoRechazo,
    calidad: clasificarCalidad(estadoFinal, motivoRechazo),
    casuisticas: (raw['Casuisticas'] || '').trim() || null,
    comentario:  (raw['Comentario'] || raw['COMENTARIO'] || '').trim() || null,
    tipo: 'mao',   }
}

// Parsea fechas en formato "29 dic 2025" (español abreviado)
const MESES_ES = {
  ene:1, feb:2, mar:3, abr:4, may:5, jun:6,
  jul:7, ago:8, sep:9, oct:10, nov:11, dic:12,
}
function parseFechaEspanol(s) {
  if (!s) return null
  const parts = s.trim().toLowerCase().split(/\s+/)
  if (parts.length !== 3) return null
  const d = parseInt(parts[0], 10)
  const m = MESES_ES[parts[1]]
  const y = parseInt(parts[2], 10)
  if (!d || !m || !y || y < 2000) return null
  return new Date(y, m - 1, d)
}

export function normalizeMao(rows) {
  return rows.map(normalizeMaoRow).filter(r => r.idCaso && r.usuario)
}

export function normalizeHoldRow(raw) {
  return {
    usuario: (raw['Usuario'] || '').trim(),
    flujo: (raw['Flujo de Tarea'] || '').trim(),
    idLink: String(raw['ID - LINK'] || '').trim(),
    status: (raw['Status'] || '').trim().toUpperCase(),
    iniciativa: (raw['Iniciativa'] || '').trim() || null,
    incidencia: (raw['Incidencias'] || '').trim() || null,
    idsTC: Math.max(1, parseNumber(raw['IDs trabajados'])),
    comentarios: (raw['Comentarios'] || '').trim() || null,
  }
}

export function normalizeHold(rows) {
  return rows.map(normalizeHoldRow).filter(r => r.usuario)
}

// CSV real: ID_MELI,Nombre,Rol,Equipo,Ubicación,Fecha Ingreso,Mail Externo
// Fechas en formato DD-MM-YYYY (soportado por parsers.js v4)
// Columnas opcionales: CUIL, Slack_ID, Mail Productora (pueden no existir)

export function normalizeEquipoRow(raw) {
  // ID_MELI: búsqueda robusta por si el nombre de columna viene alterado
  const idMeli = (
    get(raw, 'ID_MELI', 'id_meli', 'Id_Meli', 'IDMELI') ||
    // Fallback: buscar cualquier clave que contenga "meli" (case-insensitive)
    (Object.entries(raw).find(([k]) => k.toLowerCase().includes('meli'))?.[1] || '')
  ).trim()

  const mailExterno  = get(raw, 'Mail Externo', 'Mail_Externo', 'mail_externo').trim()

  // Fecha Ingreso: "Fecha Ingreso" con espacio (formato real del CSV)
  const fechaStr     = get(raw, 'Fecha Ingreso', 'Fecha_Ingreso', 'fecha_ingreso')
  const fechaIngreso = parseDate(fechaStr)

  const hoy = new Date()
  const antiguedadDias  = fechaIngreso
    ? Math.floor((hoy - fechaIngreso) / (1000 * 60 * 60 * 24))
    : null
  const antiguedadMeses = antiguedadDias != null ? Math.floor(antiguedadDias / 30) : null

  return {
    idMeli,
    nombre:        get(raw, 'Nombre'),
    slackId:       get(raw, 'Slack_ID', 'Slack ID') || null,
    rol:           get(raw, 'Rol') || null,
    equipo:        get(raw, 'Equipo') || null,
    // Ubicación: tolera con/sin tilde, con/sin mayúsculas
    ubicacion:     get(raw, 'Ubicación', 'Ubicacion', 'ubicacion', 'UBICACION', 'Ubicación') || null,
    fechaIngreso,
    fechaIngresoKey: toDateKey(fechaIngreso),
    cuil:          get(raw, 'CUIL', 'cuil') || null,
    mailProductora: get(raw, 'Mail Productora', 'Mail_Productora') || null,
    mailExterno:   mailExterno || null,
    // Derivados
    extUser:       idMeli.startsWith('ext_') || mailExterno.length > 0,
    antiguedadDias,
    antiguedadMeses,
    segmentoAntiguedad: segmentoAntiguedad(antiguedadDias),
    // Alias para join con histórico/finalizadas
    usuario: idMeli,
  }
}

export function normalizeEquipo(rows) {
  if (!rows?.length) return []

  // Log diagnóstico: mostrar las claves reales que llegan del CSV
  const sampleKeys = Object.keys(rows[0] || {})
  console.log('[Equipo] Columnas detectadas en CSV:', sampleKeys)
  console.log('[Equipo] Primera fila raw:', rows[0])

  const result = rows.map(normalizeEquipoRow).filter(r => r.idMeli)
  console.log(`[Equipo] Filas normalizadas: ${result.length} de ${rows.length} totales`)
  if (result.length === 0 && rows.length > 0) {
    console.error('[Equipo] ❌ Todas las filas fueron descartadas. Verificar columna ID_MELI.')
    console.error('[Equipo] Claves disponibles:', sampleKeys)
  }
  return result
}
