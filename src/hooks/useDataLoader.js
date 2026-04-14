/**
 * HOOK: useDataLoader v4
 * Carga los 5 datasets en paralelo con caché en sessionStorage.
 *
 * IMPORTANTE: La caché usa una version key. Si un dataset falla (retorna [])
 * NO se cachea el resultado vacío, para que el próximo reload intente de nuevo.
 * Esto evita que archivos recién subidos queden ocultos por caché stale.
 */
import { useState, useEffect, useRef } from 'react'
import Papa from 'papaparse'
import { DATA_SOURCES, APP_CONFIG } from '../config/datasources.js'
import {
  normalizeHistorico, normalizeFinalizadas,
  normalizeAuditados, normalizeHold, normalizeEquipo, normalizeMao,
} from '../utils/normalizers.js'

const NORMALIZERS = {
  historico:    normalizeHistorico,
  finalizadas:  normalizeFinalizadas,
  auditados:    normalizeAuditados,
  hold:         normalizeHold,
  equipo:       normalizeEquipo,
  auditados_mao: normalizeMao,
}

const CACHE_VERSION = 'v6'

function cacheKey(id) { return `catalogo_${CACHE_VERSION}_${id}` }

const DATE_FIELDS = ['fecha', 'fechaIngreso']

function rehydrateDates(rows) {
  if (!rows?.length) return rows
  return rows.map(r => {
    const out = { ...r }
    for (const f of DATE_FIELDS) {
      if (typeof out[f] === 'string' && out[f]) out[f] = new Date(out[f])
    }
    return out
  })
}

function readCache(id) {
  try {
    const raw = sessionStorage.getItem(cacheKey(id))
    if (!raw) return null
    const { ts, data } = JSON.parse(raw)
    if (Date.now() - ts > APP_CONFIG.cacheMs) {
      sessionStorage.removeItem(cacheKey(id))
      return null
    }
    return rehydrateDates(data)
  } catch { return null }
}

function writeCache(id, data) {
  // No cachear arrays vacíos — puede ser un archivo recién subido que falló
  if (!data || data.length === 0) return
  try {
    sessionStorage.setItem(cacheKey(id), JSON.stringify({ ts: Date.now(), data }))
  } catch {}
}

function clearCache(id) {
  try { sessionStorage.removeItem(cacheKey(id)) } catch {}
}

// Limpiar cachés de versiones anteriores
function clearOldCaches() {
  try {
    const oldPrefixes = ['catalogo_v1_', 'catalogo_v2_', 'catalogo_v3_', 'catalogo_v4_', 'catalogo_v5_', 'catalogo_dash_']
    for (let i = 0; i < sessionStorage.length; i++) {
      const key = sessionStorage.key(i)
      if (key && oldPrefixes.some(p => key.startsWith(p))) {
        sessionStorage.removeItem(key)
      }
    }
  } catch {}
}

async function fetchCsv(url) {
  // Primero verificar que el archivo existe (fetch HEAD para detectar 404 rápido)
  let httpOk = true
  try {
    const probe = await fetch(url, { method: 'HEAD' })
    if (!probe.ok) httpOk = false
  } catch {
    httpOk = false
  }
  if (!httpOk) {
    const err = new Error('NOT_FOUND')
    err.type = 'not_found'
    throw err
  }

  return new Promise((resolve, reject) => {
    Papa.parse(url, {
      download: true, header: true, skipEmptyLines: true, dynamicTyping: false,
      complete: r => {
        if (r.errors?.length && r.data?.length === 0) {
          const err = new Error('PARSE_ERROR')
          err.type = 'parse_error'
          err.details = r.errors
          reject(err)
        } else {
          resolve(r.data)
        }
      },
      error: err => {
        const e = new Error('PARSE_ERROR')
        e.type = 'parse_error'
        e.cause = err
        reject(e)
      },
    })
  })
}

async function loadDataset(source) {
  const cached = readCache(source.id)
  if (cached) return cached

  const rawRows = source.type === 'appsscript'
    ? await fetch(source.url).then(r => r.json())
    : await fetchCsv(source.url)

  if (!rawRows || rawRows.length === 0) {
    const err = new Error('EMPTY')
    err.type = 'empty'
    throw err
  }

  const normalize = NORMALIZERS[source.id]
  const data = normalize ? normalize(rawRows) : rawRows

  writeCache(source.id, data)
  return data
}

export function useDataLoader() {
  const [state, setState] = useState({
    historico: null, auditados: null,
    hold: null, equipo: null, auditados_mao: null,
    loading: true, errors: {}, loadedAt: null,
  })
  const mounted = useRef(true)

  useEffect(() => {
    clearOldCaches()
    mounted.current = true
    load()
    return () => { mounted.current = false }
  }, [])

  async function load() {
    setState(prev => ({ ...prev, loading: true, errors: {} }))
    const results = {}
    const errors = {}
    await Promise.allSettled(
      Object.values(DATA_SOURCES).map(async source => {
        console.log(`[${source.label}] Iniciando carga desde ${source.url}`)
        try {
          results[source.id] = await loadDataset(source)
          console.log(`[${source.label}] ✅ CSV cargado correctamente: ${results[source.id].length} registros`)
        } catch (err) {
          const errorType = err.type || 'unknown'

          // Datasets opcionales: si no se encuentran, resultado vacío silencioso (sin error)
          if (source.optional && errorType === 'not_found') {
            console.log(`[${source.label}] ℹ️ Archivo opcional no presente — se continúa sin él`)
            results[source.id] = []
            return
          }

          let userMsg

          if (errorType === 'not_found') {
            userMsg = `No se pudo cargar ${source.id}.csv (archivo no encontrado)`
            console.error(`[${source.label}] ❌ Archivo no encontrado: ${source.url}`)
          } else if (errorType === 'parse_error') {
            userMsg = `Error al procesar ${source.id}.csv`
            console.error(`[${source.label}] ❌ Error de parseo:`, err.details || err.cause || err)
          } else if (errorType === 'empty') {
            userMsg = `El archivo ${source.id}.csv no contiene datos`
            console.warn(`[${source.label}] ⚠️ Archivo vacío: ${source.url}`)
          } else {
            userMsg = err.message || 'Error desconocido'
            console.error(`[${source.label}] ❌ Error inesperado:`, err)
          }

          errors[source.id] = { type: errorType, message: userMsg }
          results[source.id] = []
          clearCache(source.id)
        }
      })
    )
    if (mounted.current) {
      setState({
        historico:     results.historico      || [],
        auditados:     results.auditados      || [],
        hold:          results.hold           || [],
        equipo:        results.equipo         || [],
        auditados_mao: results.auditados_mao  || [],
        loading: false, errors, loadedAt: new Date(),
      })
    }
  }

  return { ...state, reload: load }
}
