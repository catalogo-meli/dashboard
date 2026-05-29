// Parseo de fechas y numeros exportados desde CSV/Sheets.

export function parseDate(raw) {
  if (!raw) return null
  if (raw instanceof Date) return isNaN(raw) ? null : new Date(raw.getFullYear(), raw.getMonth(), raw.getDate())
  const s = String(raw).trim().replace(/\u00a0/g, ' ')
  if (!s) return null

  // YYYY-MM-DD / YYYY/MM/DD (ISO o exportaciones similares).
  let m = s.match(/^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/)
  if (m) return buildValidDate(Number(m[1]), Number(m[2]), Number(m[3]))

  // DD/MM/YYYY o DD-MM-YYYY, con hora opcional al final.
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})(?:\s+.*)?$/)
  if (m) return buildValidDate(Number(m[3]), Number(m[2]), Number(m[1]))

  // DD mmm YYYY en español, usado por tiempos_cdm.csv.
  m = s.toLowerCase().match(/^(\d{1,2})\s+([a-záéíóúñ]{3,})\s+(\d{4})$/i)
  if (m) {
    const month = {
      ene: 1, enero: 1,
      feb: 2, febrero: 2,
      mar: 3, marzo: 3,
      abr: 4, abril: 4,
      may: 5, mayo: 5,
      jun: 6, junio: 6,
      jul: 7, julio: 7,
      ago: 8, agosto: 8,
      sep: 9, sept: 9, septiembre: 9, set: 9, setiembre: 9,
      oct: 10, octubre: 10,
      nov: 11, noviembre: 11,
      dic: 12, diciembre: 12,
    }[m[2]]
    return buildValidDate(Number(m[3]), month, Number(m[1]))
  }

  // Serial Excel/Sheets, por si el CSV llega exportado con numero de fecha.
  if (/^\d{5}(\.\d+)?$/.test(s)) {
    const serial = Number(s)
    const utc = Math.round((serial - 25569) * 86400 * 1000)
    const d = new Date(utc)
    return isNaN(d) ? null : new Date(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate())
  }

  return null
}

function buildValidDate(year, month, day) {
  if (!year || !month || !day || year < 1900 || month < 1 || month > 12 || day < 1 || day > 31) return null
  const date = new Date(year, month - 1, day)
  if (date.getFullYear() !== year || date.getMonth() !== month - 1 || date.getDate() !== day) return null
  return date
}

export function toDateKey(date) {
  if (!date) return null
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function formatDateDisplay(date) {
  if (!date) return '-'
  const d = String(date.getDate()).padStart(2, '0')
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const y = date.getFullYear()
  return `${d}/${m}/${y}`
}

export function getWeekNumber(date) {
  if (!date) return null
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1))
  return Math.ceil((((d - yearStart) / 86400000) + 1) / 7)
}

export function getWeekYear(date) {
  if (!date) return null
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()))
  const dayNum = d.getUTCDay() || 7
  d.setUTCDate(d.getUTCDate() + 4 - dayNum)
  return d.getUTCFullYear()
}

export function parseNumber(raw) {
  if (raw === null || raw === undefined || raw === '') return 0
  if (typeof raw === 'number') return raw
  const s = String(raw).replace(',', '.').replace('%', '').trim()
  const n = parseFloat(s)
  return isNaN(n) ? 0 : n
}

export function normalizeKey(str) {
  return String(str || '').trim().toLowerCase()
}

export function safeGet(obj, key, fallback = null) {
  if (!obj) return fallback
  if (key in obj) return obj[key] ?? fallback
  const nk = normalizeKey(key)
  for (const k of Object.keys(obj)) {
    if (normalizeKey(k) === nk) return obj[k] ?? fallback
  }
  return fallback
}

export function truncate(str, max = 30) {
  if (!str) return '-'
  return str.length > max ? str.substring(0, max) + '...' : str
}

export function formatNumber(n) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return new Intl.NumberFormat('es-AR').format(n)
}

export function formatPct(n, decimals = 1) {
  if (n === null || n === undefined || isNaN(n)) return '-'
  return `${(n * 100).toFixed(decimals)}%`
}
