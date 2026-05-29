// Validador local de archivos antes de publicarlos en public/data.

import { useState, useCallback } from 'react'
import Papa from 'papaparse'

const EXPECTED_FILES = {
  'historico.csv': {
    label: 'Histórico Operativo',
    requiredColumns: ['Fecha','Usuario','Flujo de Tarea','ID - LINK','Status','IDs trabajados'],
    columnAliases: {
      'ID - LINK': ['ID - LINK', 'ID Sugerencia | ID Ticket', 'ID Sugerencia', 'ID Ticket'],
    },
    description: 'Registro histórico de tareas por colaborador con estados TO DO / WIP / HOLD / DONE.',
  },
  'finalizadas.csv': {
    label: 'Tareas Finalizadas (no requerido)',
    requiredColumns: ['Fecha','Usuario','Total','IDs trabajados','Week'],
    description: 'Este archivo ya no es necesario. Las métricas de productividad se calculan desde historico.csv.',
  },
  'auditados.csv': {
    label: 'Auditorías SdC',
    requiredColumns: ['ultimaActualizacion','id_caso','sugerencia_id','usuario','Auditor','EstadoFinal_esCorrecto','Motivo_de_Rechazo_esCorrecto'],
    description: 'Resultados de auditorías de calidad por sugerencia.',
  },
  'hold.csv': {
    label: 'HOLD Activo (Snapshot)',
    requiredColumns: ['Usuario','Flujo de Tarea','ID - LINK','Status','IDs trabajados'],
    columnAliases: {
      'ID - LINK': ['ID - LINK', 'ID Sugerencia | ID Ticket', 'ID Sugerencia', 'ID Ticket'],
    },
    description: 'Foto del estado actual de tareas en HOLD. Se trata como snapshot, no como histórico.',
  },
  'equipo_colaboradores.csv': {
    label: 'Equipo Colaboradores',
    requiredColumns: ['ID_MELI','Nombre','Rol','Equipo'],
    description: 'Datos organizacionales del equipo para segmentación por rol, equipo, ubicación y antigüedad.',
  },
}

function validateCsv(filename, rows, columns) {
  const config = EXPECTED_FILES[filename]
  if (!config) return { ok: false, error: `El archivo "${filename}" no corresponde a ningún dataset esperado. Los nombres válidos son: ${Object.keys(EXPECTED_FILES).join(', ')}.` }
  const missing = config.requiredColumns.filter(c => {
    const aliases = config.columnAliases?.[c] || [c]
    return !aliases.some(alias => columns.includes(alias))
  })
  if (missing.length > 0) return { ok: false, error: `Faltan columnas requeridas en "${filename}": ${missing.join(', ')}. Verificá que el archivo tenga el formato correcto.` }
  if (rows.length === 0) return { ok: false, error: `El archivo "${filename}" está vacío o no tiene filas de datos.` }
  return { ok: true, config, rows: rows.length }
}

function FileUploadCard({ filename, config, status, onFile }) {
  const handleDrop = useCallback(e => {
    e.preventDefault()
    const file = e.dataTransfer?.files?.[0] || e.target?.files?.[0]
    if (file) onFile(file)
  }, [onFile])

  const statusLabel = status === 'ok' ? 'Validado' : status === 'error' ? 'Error' : status === 'loading' ? 'Validando' : 'Pendiente'
  const statusColor = status === 'ok' ? 'var(--green)' : status === 'error' ? 'var(--red)' : status === 'loading' ? 'var(--yellow)' : 'var(--text3)'

  return (
    <div className={`upload-card${status === 'ok' ? ' upload-card-ok' : status === 'error' ? ' upload-card-error' : ''}`}>
      <div style={{ display:'flex', justifyContent:'space-between', alignItems:'flex-start', marginBottom:'0.5rem' }}>
        <div>
          <div style={{ fontWeight:600, fontSize:'0.85rem', color:'var(--text)' }}>{config.label}</div>
          <code style={{ fontSize:'0.72rem', color:'var(--text3)', background:'var(--bg3)', padding:'1px 6px', borderRadius:4 }}>{filename}</code>
        </div>
        <span style={{ fontSize:'0.68rem', color:statusColor, fontWeight:600, textTransform:'uppercase', letterSpacing:0 }}>{statusLabel}</span>
      </div>
      <div style={{ fontSize:'0.75rem', color:'var(--text3)', marginBottom:'0.75rem' }}>{config.description}</div>
      <div style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:'0.5rem' }}>
        Columnas requeridas: <span style={{ color:'var(--text2)' }}>{formatRequiredColumns(config)}</span>
      </div>
      <label style={{ display:'block', cursor:'pointer' }}>
        <div
          className="upload-drop-zone"
          onDrop={handleDrop}
          onDragOver={e => e.preventDefault()}
        >
          Arrastrá el archivo acá o <span style={{ color:'var(--accent2)', textDecoration:'underline' }}>hacé clic para seleccionar</span>
        </div>
        <input type="file" accept=".csv" style={{ display:'none' }} onChange={e => { if(e.target.files?.[0]) onFile(e.target.files[0]) }} />
      </label>
    </div>
  )
}

export function DataUpdateModule() {
  const [results, setResults] = useState({})
  const [statuses, setStatuses] = useState({})

  function handleFile(filename, file) {
    setStatuses(prev => ({ ...prev, [filename]: 'loading' }))
    Papa.parse(file, {
      header: true, skipEmptyLines: true,
      complete: ({ data, meta }) => {
        const validation = validateCsv(filename, data, meta.fields || [])
        setResults(prev => ({ ...prev, [filename]: { ...validation, file, data, originalName: file.name } }))
        setStatuses(prev => ({ ...prev, [filename]: validation.ok ? 'ok' : 'error' }))
      },
      error: () => {
        setResults(prev => ({ ...prev, [filename]: { ok: false, error: 'No se pudo leer el archivo. Verificá que sea un CSV válido.' } }))
        setStatuses(prev => ({ ...prev, [filename]: 'error' }))
      }
    })
  }

  function downloadValidated(filename) {
    const result = results[filename]
    if (!result?.ok || !result.data) return
    const keys = Object.keys(result.data[0] || {})
    const rows = result.data.map(r => keys.map(k => { const v = r[k] ?? ''; return String(v).includes(',') || String(v).includes('"') ? `"${String(v).replace(/"/g,'""')}"` : String(v) }).join(','))
    const csv = [keys.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type:'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
    URL.revokeObjectURL(url)
  }

  const allOk = Object.keys(EXPECTED_FILES).filter(f => statuses[f] === 'ok').length
  const anyError = Object.values(results).some(r => r?.ok === false)

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <div className="card" style={{ background:'var(--bg3)', border:'1px solid var(--border2)' }}>
        <div className="card-title" style={{ marginBottom:'0.75rem' }}>Actualización de datos</div>
        <div style={{ display:'flex', flexDirection:'column', gap:'0.75rem', fontSize:'0.82rem', color:'var(--text2)' }}>
          <div>
            <strong style={{ color:'var(--text)' }}>Validación local:</strong> los archivos se revisan en el navegador antes de reemplazarlos en el repositorio.
          </div>
          <div>
            <strong style={{ color:'var(--text)' }}>Flujo de trabajo:</strong>
            <ol style={{ marginLeft:'1.25rem', marginTop:'0.25rem', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
              <li>Subí el CSV y verificá estructura, nombre y columnas.</li>
              <li>Descargá el archivo validado.</li>
              <li>Reemplazalo en <code style={{ background:'var(--bg)',padding:'1px 6px',borderRadius:3 }}>public/data/</code>.</li>
              <li>Recargá el dashboard.</li>
            </ol>
          </div>
        </div>
      </div>

      <div style={{ display:'flex', alignItems:'center', gap:'1rem' }}>
        <div style={{ flex:1, background:'var(--bg3)', borderRadius:99, height:6 }}>
          <div style={{ width:`${allOk/Object.keys(EXPECTED_FILES).length*100}%`, background:'var(--green)', borderRadius:99, height:6, transition:'width 0.3s' }} />
        </div>
        <span style={{ fontSize:'0.78rem', color:'var(--text3)', whiteSpace:'nowrap' }}>{allOk} de {Object.keys(EXPECTED_FILES).length} archivos validados</span>
      </div>

      <div style={{ display:'grid', gridTemplateColumns:'repeat(auto-fill, minmax(320px, 1fr))', gap:'1rem' }}>
        {Object.entries(EXPECTED_FILES).map(([filename, config]) => (
          <div key={filename}>
            <FileUploadCard filename={filename} config={config} status={statuses[filename]} onFile={f => handleFile(filename, f)} />
            {results[filename] && (
              <div style={{ marginTop:'0.5rem', padding:'0.5rem 0.75rem', borderRadius:'var(--radius-sm)', fontSize:'0.75rem',
                background: results[filename].ok ? 'rgba(34,197,94,0.08)' : 'rgba(239,68,68,0.08)',
                color: results[filename].ok ? 'var(--green)' : 'var(--red)',
                border: `1px solid ${results[filename].ok ? 'rgba(34,197,94,0.3)' : 'rgba(239,68,68,0.3)'}`,
              }}>
                {results[filename].ok
                  ? `Validado - ${formatNumber(results[filename].rows)} filas. Listo para reemplazar en el repo.`
                  : results[filename].error}
              </div>
            )}
            {results[filename]?.ok && (
              <button className="btn" style={{ marginTop:'0.4rem', width:'100%' }} onClick={() => downloadValidated(filename)}>
                Descargar {filename} validado
              </button>
            )}
          </div>
        ))}
      </div>
      {allOk > 0 && (
        <div className="card" style={{ borderColor:'var(--green)', borderWidth:1 }}>
          <div className="card-title" style={{ marginBottom:'0.5rem', color:'var(--green)' }}>Próximos pasos para aplicar los cambios</div>
          <ol style={{ fontSize:'0.82rem', color:'var(--text2)', marginLeft:'1.25rem', display:'flex', flexDirection:'column', gap:'0.3rem' }}>
            <li>Descargá los archivos validados usando los botones de arriba.</li>
            <li>Accedé al repositorio en GitHub.</li>
            <li>Navegá a <code style={{ background:'var(--bg3)',padding:'1px 6px',borderRadius:3 }}>catalogo-dashboard/public/data/</code>.</li>
            <li>Para cada archivo: hacé clic en el archivo existente → Edit → pegá el contenido o subí el nuevo archivo.</li>
            <li>Commiteá los cambios. El dashboard se desplegará automáticamente si tenés GitHub Actions configurado.</li>
            <li>Recargá el dashboard para ver los datos actualizados.</li>
          </ol>
        </div>
      )}
    </div>
  )
}

function formatNumber(n) { return (n ?? 0).toLocaleString('es-AR') }

function formatRequiredColumns(config) {
  return config.requiredColumns.map(column => {
    const aliases = config.columnAliases?.[column]
    return aliases?.length ? `${column} (${aliases.join(' / ')})` : column
  }).join(', ')
}
