import { parseDate, parseNumber, toDateKey, getWeekNumber, getWeekYear } from './parsers.js'
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

const DIMENSION_CANON = new Map()
const FLOW_CANON = new Map([
  ['demanda', 'Demanda'],
  ['enhanced content', 'Enhanced Content'],
  ['enhancement', 'Enhancement'],
  ['fallos', 'Fallos'],
  ['soporte', 'Soporte'],
  ['validacion', 'Validacion'],
  ['validación', 'Validacion'],
])

function dimensionKey(value) {
  return String(value || '')
    .trim()
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
}

function normalizeDimension(value, fallback) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ')
  if (!clean) return fallback
  const key = dimensionKey(clean)
  if (!DIMENSION_CANON.has(key)) DIMENSION_CANON.set(key, clean)
  return DIMENSION_CANON.get(key)
}

function normalizeFlujo(value) {
  const clean = String(value || '').trim().replace(/\s+/g, ' ')
  if (!clean) return 'Sin flujo'
  return FLOW_CANON.get(dimensionKey(clean)) || normalizeDimension(clean, 'Sin flujo')
}

function buildDateFields(fecha) {
  const week = fecha ? getWeekNumber(fecha) : null
  const weekYear = fecha ? getWeekYear(fecha) : null
  return {
    fecha,
    fechaKey: toDateKey(fecha),
    week,
    weekYear,
    weekKey: week && weekYear ? `${weekYear}-W${String(week).padStart(2, '0')}` : null,
  }
}

export function normalizeHistoricoRow(raw) {
  const fecha = parseDate(get(raw, 'Fecha'))
  const idLink = get(raw, 'ID - LINK', 'ID Sugerencia | ID Ticket', 'ID Sugerencia', 'ID Ticket')
  return {
    ...buildDateFields(fecha),
    usuario: normalizeDimension(get(raw, 'Usuario'), ''),
    flujo: normalizeFlujo(get(raw, 'Flujo de Tarea')),
    idLink,
    idCdm: get(raw, 'ID CDM', 'ID_CDM'),
    groupId: get(raw, 'GROUP_ID', 'Group ID', 'group_id'),
    status: get(raw, 'Status').toUpperCase(),
    iniciativa: normalizeDimension(get(raw, 'Iniciativa'), 'Sin iniciativa'),
    incidencia: get(raw, 'Incidencias') || null,
    idsTC: Math.max(1, parseNumber(get(raw, 'IDs trabajados'))),
    comentarios: get(raw, 'Comentarios') || null,
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
    ...buildDateFields(fecha),
    week: parseNumber(raw['Week']) || (fecha ? getWeekNumber(fecha) : null),
    usuario: normalizeDimension(raw['Usuario'], ''),
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
    ...buildDateFields(fecha),
    idCaso: (raw['id_caso'] || raw['casoId'] || '').trim(),
    sugerenciaId: String(raw['sugerencia_id'] || '').trim(),
    dominio: (raw['Dominio'] || '').trim() || null,
    usuario: normalizeDimension(raw['usuario'], ''),
    estadoCaso: (raw['estado_caso'] || '').trim(),
    suggestionReason: (raw['suggestion_reason'] || '').trim() || null,
    accionCorrecta: (raw['Accion_Correcta'] || '').trim() || null,
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
  const fechaRaw = (raw['FECHA_ACCIONAMIENTO'] || '').trim()
  const fechaBase = parseFechaEspanol(fechaRaw)
  const fecha = fechaBase ? new Date(fechaBase.getTime() + 7 * 24 * 60 * 60 * 1000) : null

  const estadoFinal   = (raw['EstadoFinal_esCorrecto'] || '').trim()
  const motivoRechazo = (raw['Motivo_de_Rechazo_esCorrecto'] || '').trim()

  return {
    ...buildDateFields(fecha),
    idCaso:      (raw['ID_CDM'] || '').trim(),
    sugerenciaId: (raw['ID_CDM'] || '').trim(),
    dominio:     (raw['DOMINIO'] || '').trim() || null,
    usuario:     normalizeDimension(raw['COLABORADOR'], ''),
    pdpId:       (raw['PDP_ID'] || '').trim() || null,
    pdpLink:     (raw['PDP_LINK'] || '').trim() || null,
    itemId:      (raw['ITEM_ID'] || '').trim() || null,
    itemLink:    (raw['LINK_ITEM'] || '').trim() || null,
    resolucion:  (raw['RESOLUCION'] || '').trim() || null,
    suggestionReason: (raw['RESOLUCION'] || '').trim() || null,
    accionCorrecta: (raw['Accion_Correcta'] || '').trim() || null,
    auditor:     (raw['Auditor'] || '').trim(),
    estadoFinal,
    motivoRechazo,
    calidad: clasificarCalidad(estadoFinal, motivoRechazo),
    casuisticas: (raw['Casuisticas'] || '').trim() || null,
    comentario:  (raw['Comentario'] || raw['COMENTARIO'] || '').trim() || null,
    tipo: 'mao',
  }
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
  const idLink = get(raw, 'ID - LINK', 'ID Sugerencia | ID Ticket', 'ID Sugerencia', 'ID Ticket')
  return {
    usuario: normalizeDimension(get(raw, 'Usuario'), ''),
    flujo: normalizeFlujo(get(raw, 'Flujo de Tarea')),
    idLink,
    idCdm: get(raw, 'ID CDM', 'ID_CDM'),
    groupId: get(raw, 'GROUP_ID', 'Group ID', 'group_id'),
    status: get(raw, 'Status').toUpperCase(),
    iniciativa: normalizeDimension(get(raw, 'Iniciativa'), 'Sin iniciativa'),
    incidencia: get(raw, 'Incidencias') || null,
    idsTC: Math.max(1, parseNumber(get(raw, 'IDs trabajados'))),
    comentarios: get(raw, 'Comentarios') || null,
  }
}

export function normalizeHold(rows) {
  return rows.map(normalizeHoldRow).filter(r => r.usuario)
}

function parseDurationSeconds(raw) {
  if (raw == null) return null
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    // Excel/Sheets pueden exportar duraciones como fracción de día.
    return raw > 0 && raw < 1 ? Math.round(raw * 86400) : Math.round(raw)
  }
  const s = String(raw || '').trim()
  if (!s) return null
  const sign = s.startsWith('-') ? -1 : 1
  const clean = s
    .replace(/^-/, '')
    .replace(',', '.')
    .replace(/\s+/g, ' ')

  const colonParts = clean.split(':')
  if (colonParts.length >= 2 && colonParts.length <= 3) {
    const parts = colonParts.map(Number)
    if (!parts.some(n => Number.isNaN(n))) {
      const [a, b, c = 0] = parts
      const seconds = colonParts.length === 2 ? (a * 60 + b) : (a * 3600 + b * 60 + c)
      return sign * Math.round(seconds)
    }
  }

  const textMatch = clean.match(/(?:(\d+(?:\.\d+)?)\s*h)?\s*(?:(\d+(?:\.\d+)?)\s*m(?:in)?)?\s*(?:(\d+(?:\.\d+)?)\s*s(?:eg)?)?/i)
  if (textMatch && (textMatch[1] || textMatch[2] || textMatch[3])) {
    const h = Number(textMatch[1] || 0)
    const m = Number(textMatch[2] || 0)
    const sec = Number(textMatch[3] || 0)
    return sign * Math.round(h * 3600 + m * 60 + sec)
  }

  const numeric = Number(clean)
  if (Number.isFinite(numeric)) {
    return sign * (numeric > 0 && numeric < 1 ? Math.round(numeric * 86400) : Math.round(numeric))
  }

  return null
}

export function normalizeTiemposCdmRow(raw) {
  const fechaFinalizacion = parseDate(get(raw, 'fecha_finalizacion'))
  const duracionRaw = get(raw, 'duración', 'duracion', 'duraciÃ³n')
  const duracionSegundos = parseDurationSeconds(duracionRaw)
  const colaborador = normalizeDimension(get(raw, 'COLABORADOR'), '')
  const iniciadoVsFinalizado = normalizeDimension(get(raw, 'Iniciado vs Finalizado'), 'Sin dato')
  const comentarioTl = get(raw, 'Comentario tl', 'Comentario TL') || null
  const linkCaso = get(raw, 'Link caso') || null
  return {
    ...buildDateFields(fechaFinalizacion),
    idCdm: get(raw, 'ID_CDM'),
    macroCaja: normalizeDimension(get(raw, 'Macro_caja', 'Macro caja'), 'Sin macro caja'),
    flujo: normalizeDimension(get(raw, 'Flujo'), 'Sin flujo'),
    colaborador,
    usuario: colaborador,
    iniciadoVsFinalizado,
    fechaFinalizacion,
    monthKey: fechaFinalizacion ? `${fechaFinalizacion.getFullYear()}-${String(fechaFinalizacion.getMonth() + 1).padStart(2, '0')}` : null,
    horaPrimerAsignacion: get(raw, 'hora_primer_asignacion') || null,
    horaFinalizacion: get(raw, 'hora_finalizacion') || null,
    duracionRaw,
    duracionSegundos,
    duracionMinutos: duracionSegundos != null ? duracionSegundos / 60 : null,
    linkCaso,
    comentarioTl,
    tieneComentario: !!comentarioTl,
    tieneLink: !!linkCaso,
    esDuracionNegativa: duracionSegundos != null && duracionSegundos < 0,
    esDuracionCorta5s: duracionSegundos != null && duracionSegundos >= 0 && duracionSegundos <= 5,
    esDuracionCorta10s: duracionSegundos != null && duracionSegundos >= 0 && duracionSegundos <= 10,
    esDuracionMayor1h: duracionSegundos != null && duracionSegundos > 3600,
    esDistintoDia: iniciadoVsFinalizado.toLowerCase().includes('distinto') || iniciadoVsFinalizado.toLowerCase().includes('otro'),
  }
}

export function normalizeTiemposCdm(rows) {
  return rows.map(normalizeTiemposCdmRow).filter(r => r.idCdm && r.usuario && r.fechaFinalizacion)
}

// CSV real: ID_MELI,Nombre,Rol,Equipo,Ubicación,Fecha Ingreso,Mail Externo
// Fechas en formato DD-MM-YYYY.
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
    usuario: idMeli,
  }
}

export function normalizeEquipo(rows) {
  if (!rows?.length) return []

  const sampleKeys = Object.keys(rows[0] || {})
  console.log('[Equipo] Columnas detectadas en CSV:', sampleKeys)
  console.log('[Equipo] Primera fila raw:', rows[0])

  const result = rows.map(normalizeEquipoRow).filter(r => r.idMeli)
  console.log(`[Equipo] Filas normalizadas: ${result.length} de ${rows.length} totales`)
  if (result.length === 0 && rows.length > 0) {
    console.error('[Equipo] Todas las filas fueron descartadas. Verificar columna ID_MELI.')
    console.error('[Equipo] Claves disponibles:', sampleKeys)
  }
  return result
}
