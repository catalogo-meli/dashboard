import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, Legend } from 'recharts'
import { calcCalidadKPIs, calcPorCaso, calidadPorSemana, calidadPorUsuario, calidadPorAuditor, calidadPorDominio, calidadPorError, concentracionDesvios } from '../utils/metrics/calidadMetrics.js'
import { CALIDAD_LABELS, CALIDAD_COLORS } from '../utils/normalizers.js'
import { formatNumber } from '../utils/parsers.js'
import { COPY } from '../config/copy.js'
import { THRESHOLDS } from '../config/thresholds.js'
import { EmptyState, CustomTooltip, ExportCSVButton, CalidadBar, KPICard } from '../components/ui/index.jsx'
import { useTableSort, SortTh } from '../hooks/useTableSort.jsx'
import { formatCalidadColab, formatCalidadError, formatCalidadAuditor } from '../utils/exportUtils.js'

// ── Helpers ───────────────────────────────────────────────────────────────────
function PctCell({ val, total, type }) {
  const pct = total > 0 ? Math.round(val/total*100) : 0
  const color = type==='correcto'?'var(--green)':type==='desvio_grave'?'var(--red)':type==='desvio_leve'?'var(--yellow)':'var(--slate)'
  return <span style={{ color, fontWeight:600 }}>{val} <span style={{ color:'var(--text3)', fontWeight:400 }}>({pct}%)</span></span>
}

function exportCSV(rows, filename) {
  if (!rows?.length) return
  const keys = Object.keys(rows[0])
  const header = keys.join(',')
  const body = rows.map(r => keys.map(k => {
    const v = r[k] ?? ''
    return typeof v === 'string' && v.includes(',') ? `"${v}"` : v
  }).join(',')).join('\n')
  const blob = new Blob([header + '\n' + body], { type: 'text/csv;charset=utf-8;' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a'); a.href = url; a.download = filename; a.click()
  URL.revokeObjectURL(url)
}

// ── Tabla inline de casos auditados ───────────────────────────────────────────
// ── Helpers de links ──────────────────────────────────────────────────────────
const SITE_MAP = {
  MLB: { dominio: 'produto.mercadolivre.com.br', subdominio: 'produto.mercadolivre.com.br' },
  MCO: { dominio: 'articulo.mercadolibre.com.co', subdominio: 'articulo.mercadolibre.com.co' },
  MLA: { dominio: 'articulo.mercadolibre.com.ar', subdominio: 'articulo.mercadolibre.com.ar' },
  MPE: { dominio: 'articulo.mercadolibre.com.pe', subdominio: 'articulo.mercadolibre.com.pe' },
  MLU: { dominio: 'articulo.mercadolibre.com.uy', subdominio: 'articulo.mercadolibre.com.uy' },
  MLC: { dominio: 'articulo.mercadolibre.cl',     subdominio: 'articulo.mercadolibre.cl' },
  MLM: { dominio: 'articulo.mercadolibre.com.mx', subdominio: 'articulo.mercadolibre.com.mx' },
}

function getSitePrefix(id) {
  if (!id) return null
  return id.slice(0, 3).toUpperCase()
}

function buildPdpLink(pdpId, pdpLinkFallback) {
  if (pdpLinkFallback) return pdpLinkFallback
  if (!pdpId) return null
  const prefix = getSitePrefix(pdpId)
  const site = SITE_MAP[prefix]
  if (!site) return null
  return `https://${site.dominio}/p/${pdpId}`
}

function buildItemLink(itemId, itemLinkFallback) {
  if (itemLinkFallback) return itemLinkFallback
  if (!itemId) return null
  const prefix = getSitePrefix(itemId)
  const site = SITE_MAP[prefix]
  if (!site) return null
  // Insertar guion entre sigla y números: MLB3188360950 → MLB-3188360950
  const numeros = itemId.slice(3)
  return `https://${site.dominio}/${prefix}-${numeros}`
}

function ExternalLink({ href, label }) {
  if (!href) return <span style={{ color:'var(--text3)', fontSize:'0.75rem' }}>{label || '—'}</span>
  return (
    <a href={href} target="_blank" rel="noopener noreferrer"
      style={{ color:'var(--accent)', fontSize:'0.75rem', textDecoration:'none', fontFamily:'monospace' }}
      onClick={e => e.stopPropagation()}
    >
      {label} ↗
    </a>
  )
}

// ── Tabla de casos inline ─────────────────────────────────────────────────────
function TablaCasosInline({ rows, titulo, onClose, fuente, calidad }) {
  if (!rows?.length) return (
    <div style={{ padding:'0.75rem', fontSize:'0.8rem', color:'var(--text3)' }}>Sin casos para mostrar.</div>
  )

  const esMao = fuente === 'mao'
  const mostrarCodigos = calidad === 'desvio_leve' || calidad === 'desvio_grave'

  const csvRows = rows.map(r => {
    const base = {
      usuario: r.usuario || '—',
      auditor: r.auditor || '—',
      dominio: r.dominio || '—',
      calidad: r.calidad || '—',
      semana: r.week ? `Sem ${r.week}` : '—',
    }
    if (esMao) {
      return {
        id_pdp: r.pdpId || '—',
        id_item: r.itemId || '—',
        ...base,
        ...(mostrarCodigos ? { codigo_utilizado: r.resolucion || '—', codigo_correcto: r.accionCorrecta || '—' } : {}),
      }
    }
    return {
      id_caso: r.idCaso || '—',
      id_sugerencia: r.sugerenciaId || '—',
      ...base,
      ...(mostrarCodigos ? { codigo_utilizado: r.suggestionReason || '—', codigo_correcto: r.accionCorrecta || '—' } : {}),
    }
  })

  return (
    <div style={{ marginTop:'0.75rem', borderTop:'1px solid var(--border)', paddingTop:'0.75rem' }}>
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', marginBottom:'0.5rem' }}>
        <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text2)' }}>
          {titulo} — {rows.length} registros
        </span>
        <div style={{ display:'flex', gap:'0.5rem' }}>
          <button onClick={() => exportCSV(csvRows, 'detalle_calidad.csv')}
            style={{ fontSize:'0.72rem', padding:'0.2rem 0.6rem', background:'var(--bg3)', border:'1px solid var(--border)',
              borderRadius:'var(--radius-sm)', color:'var(--text2)', cursor:'pointer' }}>
            Exportar CSV
          </button>
          <button onClick={onClose}
            style={{ fontSize:'0.72rem', padding:'0.2rem 0.6rem', background:'transparent', border:'1px solid var(--border)',
              borderRadius:'var(--radius-sm)', color:'var(--text3)', cursor:'pointer' }}>
            ✕ Cerrar
          </button>
        </div>
      </div>
      <div className="table-wrap" style={{ maxHeight:360, overflowY:'auto', overflowX:'hidden' }}>
        <table style={{ tableLayout:'fixed', width:'100%' }}>
          <colgroup>
            {esMao ? (
              <>
                <col style={{ width: mostrarCodigos ? '14%' : '18%' }} /> {/* ID PDP */}
                <col style={{ width: mostrarCodigos ? '14%' : '18%' }} /> {/* ID ITEM */}
                <col style={{ width: mostrarCodigos ? '10%' : '14%' }} /> {/* Usuario */}
                <col style={{ width: mostrarCodigos ? '10%' : '14%' }} /> {/* Auditor */}
                <col style={{ width: mostrarCodigos ? '14%' : '18%' }} /> {/* Dominio */}
                <col style={{ width: mostrarCodigos ? '10%' : '14%' }} /> {/* Calidad */}
                <col style={{ width: mostrarCodigos ? '6%'  : '8%'  }} /> {/* Semana */}
                {mostrarCodigos && <col style={{ width:'11%' }} />}         {/* Código utilizado */}
                {mostrarCodigos && <col style={{ width:'11%' }} />}         {/* Código correcto */}
              </>
            ) : (
              <>
                <col style={{ width: mostrarCodigos ? '14%' : '18%' }} /> {/* ID CASO */}
                <col style={{ width: mostrarCodigos ? '12%' : '16%' }} /> {/* ID SUGERENCIA */}
                <col style={{ width: mostrarCodigos ? '10%' : '14%' }} /> {/* Usuario */}
                <col style={{ width: mostrarCodigos ? '10%' : '14%' }} /> {/* Auditor */}
                <col style={{ width: mostrarCodigos ? '14%' : '18%' }} /> {/* Dominio */}
                <col style={{ width: mostrarCodigos ? '10%' : '12%' }} /> {/* Calidad */}
                <col style={{ width: mostrarCodigos ? '6%'  : '8%'  }} /> {/* Semana */}
                {mostrarCodigos && <col style={{ width:'12%' }} />}         {/* Código utilizado */}
                {mostrarCodigos && <col style={{ width:'12%' }} />}         {/* Código correcto */}
              </>
            )}
          </colgroup>
          <thead>
            <tr>
              {esMao ? (
                <>
                  <th>ID PDP</th>
                  <th>ID ITEM</th>
                </>
              ) : (
                <>
                  <th>ID CASO</th>
                  <th>ID SUGERENCIA</th>
                </>
              )}
              <th>Usuario</th>
              <th>Auditor</th>
              <th>Dominio</th>
              <th>Calidad</th>
              <th>Sem.</th>
              {mostrarCodigos && <th>Código utilizado</th>}
              {mostrarCodigos && <th>Código correcto</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={i}>
                {esMao ? (
                  <>
                    <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <ExternalLink href={buildPdpLink(r.pdpId, r.pdpLink)} label={r.pdpId || '—'} />
                    </td>
                    <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      <ExternalLink href={buildItemLink(r.itemId, r.itemLink)} label={r.itemId || '—'} />
                    </td>
                  </>
                ) : (
                  <>
                    <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
                      {r.idCaso
                        ? <ExternalLink href={`https://catalog-domains.adminml.com/ruler/product-suggestions/${r.idCaso}`} label={r.idCaso} />
                        : <span style={{ color:'var(--text3)' }}>—</span>
                      }
                    </td>
                    <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontFamily:'monospace', fontSize:'0.75rem', color:'var(--text2)' }}>
                      {r.sugerenciaId || '—'}
                    </td>
                  </>
                )}
                <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.78rem' }}>{r.usuario || '—'}</td>
                <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.78rem', color:'var(--text3)' }}>{r.auditor || '—'}</td>
                <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.75rem', color:'var(--text3)' }}>{r.dominio || '—'}</td>
                <td>
                  <span style={{ color: CALIDAD_COLORS[r.calidad], fontWeight:600, fontSize:'0.75rem', whiteSpace:'nowrap' }}>
                    {CALIDAD_LABELS[r.calidad] || r.calidad}
                  </span>
                </td>
                <td style={{ color:'var(--text3)', fontSize:'0.75rem' }}>{r.week ? `S${r.week}` : '—'}</td>
                {mostrarCodigos && (
                  <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.75rem', color:'var(--text2)' }}>
                    {(esMao ? r.resolucion : r.suggestionReason) || '—'}
                  </td>
                )}
                {mostrarCodigos && (
                  <td style={{ overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', fontSize:'0.75rem', color:'var(--text2)' }}>
                    {r.accionCorrecta || '—'}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ── Cards de distribución clicables ──────────────────────────────────────────
function DistribCard({ cat, val, total, isSelected, onToggle, combinado }) {
  return (
    <div
      onClick={combinado ? undefined : onToggle}
      style={{
        background:'var(--bg3)',
        border:`1px solid ${isSelected ? CALIDAD_COLORS[cat] : CALIDAD_COLORS[cat]+'40'}`,
        borderLeft:`3px solid ${CALIDAD_COLORS[cat]}`,
        borderRadius:'var(--radius-sm)',
        padding:'0.5rem 0.85rem', minWidth:130,
        cursor: combinado ? 'default' : 'pointer',
        transition:'box-shadow 0.15s, border-color 0.15s',
        boxShadow: isSelected ? `0 0 0 2px ${CALIDAD_COLORS[cat]}60` : 'none',
      }}
    >
      <div style={{ fontSize:'0.7rem', color:'var(--text3)', marginBottom:'0.1rem' }}>{CALIDAD_LABELS[cat]}</div>
      <div style={{ fontSize:'1.2rem', fontWeight:700, color:CALIDAD_COLORS[cat] }}>{formatNumber(val)}</div>
      <div style={{ fontSize:'0.7rem', color:'var(--text3)' }}>{total>0?Math.round(val/total*100):0}%</div>
      {!combinado && (
        <div style={{ fontSize:'0.65rem', color: isSelected ? CALIDAD_COLORS[cat] : 'var(--text3)', marginTop:3 }}>
          {isSelected ? '▲ Ocultar' : '▼ Ver casos'}
        </div>
      )}
    </div>
  )
}

// ── Acciones sugeridas con detalle expandible ─────────────────────────────────
function AccionItem({ accion, auditadosActivos, porUsuario, fuente }) {
  const [open, setOpen] = useState(false)

  const filas = useMemo(() => {
    if (!open) return []
    const matchDominio = accion.match(/["""\u201c\u201d]([^"""\u201c\u201d]+)["""\u201c\u201d]\s*(?:tiene|\u2014)/)
    if (matchDominio) {
      const dom = matchDominio[1]
      return auditadosActivos.filter(r => r.dominio === dom)
    }
    if (accion.includes('colaborador')) {
      const bajos = (porUsuario || []).filter(u => u.efectividadSug < 0.8 && u.totalSugs >= 5).map(u => u.usuario)
      return auditadosActivos.filter(r => bajos.includes(r.usuario))
    }
    return []
  }, [open, accion, auditadosActivos, porUsuario])

  // Derivar calidad predominante para activar columnas de códigos
  const calidadPanel = useMemo(() => {
    if (!filas.length) return null
    if (filas.some(r => r.calidad === 'desvio_grave')) return 'desvio_grave'
    if (filas.some(r => r.calidad === 'desvio_leve'))  return 'desvio_leve'
    return 'correcto'
  }, [filas])

  return (
    <li style={{ fontSize:'0.82rem', color:'var(--text2)', borderLeft:'2px solid var(--border2)',
      lineHeight:1.5, borderRadius:'0 var(--radius-sm) var(--radius-sm) 0',
      background: open ? 'var(--bg3)' : 'transparent', transition:'background 0.15s',
    }}>
      <div style={{ display:'flex', alignItems:'flex-start', justifyContent:'space-between', gap:'0.75rem', padding:'0.5rem 0.75rem' }}>
        <span style={{ flex:1 }}>{accion}</span>
        <button
          onClick={() => setOpen(o => !o)}
          style={{ flexShrink:0, fontSize:'0.72rem', padding:'0.2rem 0.65rem',
            background: open ? 'var(--accent)' : 'var(--bg3)',
            color: open ? '#fff' : 'var(--text2)',
            border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', cursor:'pointer',
            whiteSpace:'nowrap',
          }}>
          {open ? '\u25b2 Cerrar' : 'Ver casos'}
        </button>
      </div>
      {open && (
        <div style={{ padding:'0 0.75rem 0.75rem' }}>
          {filas.length > 0 ? (
            <TablaCasosInline
              rows={filas}
              titulo={`Detalle \u2014 ${filas.length} registros`}
              onClose={() => setOpen(false)}
              fuente={fuente}
              calidad={calidadPanel}
            />
          ) : (
            <div style={{ fontSize:'0.78rem', color:'var(--text3)', fontStyle:'italic', padding:'0.25rem 0' }}>
              No se pudo determinar un conjunto de casos espec\u00edfico para esta acci\u00f3n. Revis\u00e1 el tab correspondiente.
            </div>
          )}
        </div>
      )}
    </li>
  )
}
// ── Componentes de fuente ──────────────────────────────────────────────────────
function FuenteStatus({ label, available, active, count }) {
  const color = available ? (label === 'SdC' ? 'var(--green)' : 'var(--accent2)') : 'var(--border2)'
  const bg    = available ? (label === 'SdC' ? 'rgba(34,197,94,0.06)' : 'rgba(99,102,241,0.06)') : 'var(--bg3)'
  return (
    <div style={{
      display:'flex', alignItems:'center', justifyContent:'space-between',
      padding:'0.55rem 0.85rem',
      background: bg,
      border:`1px solid ${color}`,
      borderLeft:`3px solid ${color}`,
      borderRadius:'var(--radius-sm)',
    }}>
      <div style={{ display:'flex', alignItems:'center', gap:'0.5rem' }}>
        <span style={{ fontSize:'0.8rem', fontWeight:700, color: available ? color : 'var(--text3)' }}>{label}</span>
        <span style={{ fontSize:'0.72rem', color:'var(--text3)', fontWeight: available ? 400 : 600 }}>
          {available ? 'disponible' : 'sin datos en este período'}
        </span>
        {active && available && (
          <span style={{ fontSize:'0.65rem', fontWeight:700, color:'#fff',
            background: label === 'SdC' ? 'var(--green)' : 'var(--accent2)',
            padding:'2px 7px', borderRadius:99, textTransform:'uppercase', letterSpacing:'0.04em',
          }}>viendo</span>
        )}
      </div>
      <div style={{ textAlign:'right' }}>
        {available
          ? <span style={{ fontSize:'0.78rem', fontWeight:600, color:'var(--text2)' }}>{count.toLocaleString('es-AR')} registros</span>
          : <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>—</span>
        }
      </div>
    </div>
  )
}

function FuenteToggle({ value, onChange, hasMao }) {
  const opts = [
    { id: 'sdc',       label: 'SdC' },
    { id: 'mao',       label: 'MAO', disabled: !hasMao },
    { id: 'combinado', label: 'Combinado', disabled: !hasMao },
  ]
  return (
    <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden', width:'fit-content' }}>
      {opts.map(o => (
        <button key={o.id} disabled={o.disabled}
          onClick={() => !o.disabled && onChange(o.id)}
          style={{
            padding:'0.3rem 0.9rem', fontSize:'0.78rem', fontWeight: value===o.id ? 700 : 400,
            background: value===o.id ? 'var(--accent)' : 'transparent',
            color: value===o.id ? '#fff' : o.disabled ? 'var(--text3)' : 'var(--text2)',
            border:'none', cursor: o.disabled ? 'default' : 'pointer',
            borderRight:'1px solid var(--border)',
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

// Vista principal
export function CalidadModule({ model, auditados, auditadosMao }) {
  const { calidadModel } = model
  const [fuente, setFuente] = useState('sdc')
  const [autoSwitched, setAutoSwitched] = useState(false)
  // Estado compartido para el panel de detalle de distribución
  // { grupo: 'sug'|'caso', cat: string } | null
  const [distribSelected, setDistribSelected] = useState(null)

  function toggleDistrib(grupo, cat) {
    setDistribSelected(prev =>
      prev?.grupo === grupo && prev?.cat === cat ? null : { grupo, cat }
    )
  }

  const hasSdc = (auditados?.length || 0) > 0
  const hasMao = (auditadosMao?.length || 0) > 0

  useEffect(() => {
    if (fuente === 'sdc' && !hasSdc && hasMao) { setFuente('mao'); setAutoSwitched(true) }
    else if (fuente === 'mao' && !hasMao && hasSdc) { setFuente('sdc'); setAutoSwitched(true) }
    else setAutoSwitched(false)
  }, [hasSdc, hasMao, fuente])

  const auditadosActivos = useMemo(() => {
    if (fuente === 'mao')       return auditadosMao || []
    if (fuente === 'combinado') return [...(auditados || []), ...(auditadosMao || [])]
    return auditados || []
  }, [fuente, auditados, auditadosMao])

  const kpis          = useMemo(() => calcCalidadKPIs(auditadosActivos), [auditadosActivos])
  const casosData     = useMemo(() => calcPorCaso(auditadosActivos), [auditadosActivos])
  const porUsuario    = useMemo(() => calidadPorUsuario(auditadosActivos), [auditadosActivos])
  const porAuditor_   = useMemo(() => calidadPorAuditor(auditadosActivos), [auditadosActivos])
  const porDominio    = useMemo(() => calidadPorDominio(auditadosActivos), [auditadosActivos])
  const porError_     = useMemo(() => calidadPorError(auditadosActivos), [auditadosActivos])
  const concentracion = useMemo(() => concentracionDesvios(auditadosActivos), [auditadosActivos])
  const porSemana     = useMemo(() => calidadPorSemana(auditadosActivos), [auditadosActivos])

  const { sorted: errorSorted, sortKey: errSortKey, sortDir: errSortDir, onSort: errOnSort } = useTableSort(porError_ || [], porError_ || [])
  const { sorted: auditorSorted, sortKey: audSortKey, sortDir: audSortDir, onSort: audOnSort } = useTableSort(porAuditor_ || [], porAuditor_ || [])
  const { sorted: usuarioSorted, sortKey: usuSortKey, sortDir: usuSortDir, onSort: usuOnSort } = useTableSort(porUsuario || [], porUsuario || [])

  // Filas para el panel de detalle compartido de distribución
  const distribFilas = useMemo(() => {
    if (!distribSelected) return []
    if (distribSelected.grupo === 'caso') {
      // Una fila por caso — filtrar casosData por calidad del caso
      const casosFiltrados = (casosData || []).filter(c => c.calidad === distribSelected.cat)
      // Enriquecer cada caso con datos resumidos de sus sugerencias
      return casosFiltrados.map(c => {
        const sugs = c.sugerencias || []
        const sugIds = sugs.map(s => s.sugerenciaId).filter(Boolean).join(', ')
        // Códigos: los de las sugerencias con desvío, o el primero si todas correctas
        const sugsDesvio = sugs.filter(s => s.calidad !== 'correcto')
        const sugRef = sugsDesvio.length > 0 ? sugsDesvio[0] : sugs[0]
        return {
          // Campos de caso
          idCaso:          c.idCaso,
          usuario:         c.usuario,
          auditor:         c.auditor,
          dominio:         c.dominio,
          week:            c.week,
          calidad:         c.calidad,
          // Campos enriquecidos desde sugerencias
          sugerenciaId:    sugIds || '—',
          suggestionReason: sugRef?.suggestionReason || null,
          accionCorrecta:  sugRef?.accionCorrecta   || null,
          resolucion:      sugRef?.resolucion        || null,
          // MAO
          pdpId:    c.pdpId    || sugs[0]?.pdpId    || null,
          pdpLink:  c.pdpLink  || sugs[0]?.pdpLink  || null,
          itemId:   c.itemId   || sugs[0]?.itemId   || null,
          itemLink: c.itemLink || sugs[0]?.itemLink  || null,
        }
      })
    }
    return auditadosActivos.filter(r => r.calidad === distribSelected.cat)
  }, [distribSelected, auditadosActivos, casosData])

  const acciones = useMemo(() => {
    const a = []
    if (!kpis) return ['Sin datos para generar acciones.']
    if (kpis.efectividadSug < THRESHOLDS.calidad.efectividadSug.warn) {
      const efPctTmp = Math.round(kpis.efectividadSug * 100)
      a.push(`Efectividad crítica (${efPctTmp}%). Revisá los códigos de error dominantes.`)
    }
    const domMalo = (porDominio||[]).find(d => d.efectividad < 0.85 && d.total >= 5)
    if (domMalo) a.push(`Dominio "${domMalo.dominio}" tiene efectividad de ${Math.round(domMalo.efectividad*100)}%. Revisá criterios de auditoría o reforzá capacitación.`)
    const levePct = kpis.totalSugs > 0 ? (kpis.bySug?.desvio_leve||0) / kpis.totalSugs : 0
    if (levePct > 0.05) a.push(`Los desvíos leves representan el ${Math.round(levePct*100)}%. Considerá refuerzo en criterios operativos.`)
    const colabBajo = (porUsuario||[]).find(u => u.efectividadSug < 0.8 && u.totalSugs >= 5)
    if (colabBajo) a.push(`${(porUsuario||[]).filter(u=>u.efectividadSug<0.8&&u.totalSugs>=5).length} colaborador(es) con efectividad menor al 80%. Revisalos en la vista Individual.`)
    if (!a.length) a.push('Sin acciones prioritarias. Mantener seguimiento semanal.')
    return a
  }, [kpis, porDominio, porUsuario])

  if (!hasSdc && !hasMao) return (
    <div style={{ display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:'0.75rem', padding:'3rem 1.5rem', textAlign:'center' }}>
      <span style={{ fontSize:'2rem' }}>📭</span>
      <span style={{ fontSize:'0.92rem', fontWeight:600, color:'var(--text2)' }}>Sin auditorías en este período</span>
      <span style={{ fontSize:'0.8rem', color:'var(--text3)', maxWidth:320 }}>
        No hay datos de SdC ni MAO para el corte seleccionado. Probá con otra semana o ampliá el período.
      </span>
    </div>
  )

  if (!auditadosActivos?.length) return <EmptyState message={fuente === 'mao' ? 'No hay datos MAO para este corte.' : 'No hay datos SdC para este corte.'} />
  if (!kpis) return <EmptyState message={COPY.empty} />

  const efPct     = Math.round(kpis.efectividadSug * 100)
  const efCasoPct = Math.round(kpis.efectividadCaso * 100)
  const efColor   = efPct>=90?'var(--green)':efPct>=80?'var(--yellow)':'var(--red)'
  const gapPp     = Math.abs(efPct - efCasoPct)

  const vocab = fuente === 'sdc' ? {
    unidad:'sugerencia', unidades:'sugerencias', unidadCap:'Sugerencia',
    labelPrincipal:'Sugerencias correctas', labelGraves:'Errores graves',
    subGraves:(pct) => `${pct}% del total. Requieren acción inmediata.`,
    mostrarCasos:true, mostrarComposicion:true,
    labelDistribucion:'Distribución — por Sugerencia',
    labelDistribucionCaso:'Distribución — por Caso',
    subDistribucion:'Muestra dónde se concentra el error. Por sugerencia_id (métrica principal).',
    subDistribucionCaso:'Misma lectura pero agrupando todas las sugerencias de un caso. Si el caso tiene al menos un desvío, se cuenta como desviado.',
    colHeader:'Sugs',
  } : fuente === 'mao' ? {
    unidad:'acción', unidades:'acciones', unidadCap:'Acción',
    labelPrincipal:'Acciones correctas', labelGraves:'Acciones con error grave',
    subGraves:(pct) => `${pct}% del total. Requieren revisión inmediata.`,
    mostrarCasos:false, mostrarComposicion:false,
    labelDistribucion:'Distribución — por acción auditada',
    labelDistribucionCaso:null,
    subDistribucion:'Muestra dónde se concentra el error en las acciones MAO.',
    subDistribucionCaso:null,
    colHeader:'Acc.',
  } : {
    unidad:'registro', unidades:'registros', unidadCap:'Registro',
    labelPrincipal:'Registros correctos', labelGraves:'Errores graves',
    subGraves:(pct) => `${pct}% del total combinado (SdC + MAO).`,
    mostrarCasos:false, mostrarComposicion:false,
    labelDistribucion:'Distribución — SdC + MAO combinado',
    labelDistribucionCaso:null,
    subDistribucion:'Vista unificada de ambas fuentes de auditoría.',
    subDistribucionCaso:null,
    colHeader:'Reg.',
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* ── Selector de fuente ── */}
      <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', flexWrap:'wrap', gap:'0.5rem' }}>
        <div style={{ display:'flex', alignItems:'center', gap:'0.75rem' }}>
          <span style={{ fontSize:'0.72rem', color:'var(--text3)', fontWeight:600 }}>Fuente de auditoría:</span>
          <FuenteToggle value={fuente} onChange={setFuente} hasMao={hasMao} />
        </div>
        <span style={{ fontSize:'0.72rem', color:'var(--text3)' }}>
          {formatNumber(auditadosActivos.length)} registros
        </span>
      </div>

      {/* ── Disponibilidad de fuentes ── */}
      <div style={{ display:'grid', gridTemplateColumns:'1fr 1fr', gap:'0.5rem' }}>
        <FuenteStatus label="SdC" available={hasSdc} active={fuente==='sdc'||fuente==='combinado'} count={auditados?.length||0} />
        <FuenteStatus label="MAO" available={hasMao} active={fuente==='mao'||fuente==='combinado'} count={auditadosMao?.length||0} />
      </div>

      {autoSwitched && (
        <div style={{ display:'flex', alignItems:'flex-start', gap:'0.6rem', padding:'0.6rem 0.85rem',
          background:'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.3)',
          borderRadius:'var(--radius-sm)', fontSize:'0.78rem', color:'#fb923c' }}>
          <span style={{ fontWeight:700, flexShrink:0, marginTop:1 }}>↻</span>
          <span>
            <strong>Mostrando {fuente === 'mao' ? 'MAO' : 'SdC'}</strong> — no hay datos de {fuente === 'mao' ? 'SdC' : 'MAO'} en este período.
            {' '}<span style={{ color:'var(--text3)' }}>Cambiá el período si necesitás ver la otra fuente.</span>
          </span>
        </div>
      )}
      <div className="metric-note">📊 {COPY.modules.calidadPrincipal}</div>

      {/* ── Estado general ── */}
      <div className="grid grid-4">
        <div className="card" style={{ gridColumn:'span 1' }}>
          <div className="card-header" style={{ marginBottom:'0.4rem' }}>
            <span className="card-title" title={COPY.kpis.efSug.help}>{vocab.labelPrincipal} ⓘ</span>
            <span className="badge badge-accent">Principal</span>
          </div>
          <div className="kpi-value" style={{ color:efColor, fontSize:'2rem' }}>{efPct}%</div>
          <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginTop:2 }}>
            Target: 90% · {formatNumber(kpis.totalSugs)} {vocab.unidades}
          </div>
          <div className="kpi-sub">{COPY.kpis.efSug.help}</div>
        </div>

        {vocab.mostrarCasos && (
          <div className="card">
            <div className="card-header" style={{ marginBottom:'0.4rem' }}>
              <span className="card-title" title={COPY.kpis.efCaso.help}>{COPY.kpis.efCaso.label} ⓘ</span>
              <span className="badge badge-slate">Contextual</span>
            </div>
            <div className="kpi-value" style={{ color:efCasoPct>=90?'var(--green)':efCasoPct>=80?'var(--yellow)':'var(--red)' }}>{efCasoPct}%</div>
            <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginTop:2 }}>{formatNumber(kpis.totalCasos)} casos · Gap vs sugerencia: {gapPp} pp</div>
            <div className="kpi-sub">{COPY.kpis.efCaso.help}</div>
          </div>
        )}

        <KPICard label={vocab.labelGraves} value={formatNumber(kpis.bySug?.desvio_grave||0)}
          sub={vocab.subGraves(kpis.totalSugs>0?Math.round((kpis.bySug?.desvio_grave||0)/kpis.totalSugs*100):0)}
          icon="🔴" color="var(--red)" />

        {vocab.mostrarComposicion && (
          <div className="card">
            <div className="card-header" style={{ marginBottom:'0.5rem' }}>
              <span className="card-title">Composición de muestra</span>
            </div>
            <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginBottom:'0.3rem' }}>Define cómo se interpreta la calidad.</div>
            <div style={{ fontSize:'0.82rem', display:'flex', flexDirection:'column', gap:'0.25rem' }}>
              {[
                ['Sugerencias', formatNumber(kpis.totalSugs)],
                ['Casos', formatNumber(kpis.totalCasos)],
                ['Sugs/caso', kpis.promSugs],
                ['Casos simples (1 sug)', `${Math.round(kpis.pctSingle*100)}%`],
                ['Gap ef. sug vs caso', `${gapPp} pp`],
              ].map(([l,v])=>(
                <div key={l}><span style={{ color:'var(--text3)' }}>{l}:</span> <strong>{v}</strong></div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* ── Distribuciones: Sugerencia + Caso en misma fila, panel compartido ── */}
      <div className="card">
        <div style={{ display:'grid', gridTemplateColumns: vocab.mostrarCasos && kpis.byCaso ? '1fr 1fr' : '1fr', gap:'1.5rem' }}>

          {/* Bloque Sugerencia */}
          <div>
            <div className="card-title" style={{ marginBottom:'0.25rem' }}>{vocab.labelDistribucion}</div>
            <div className="card-subtitle" style={{ marginBottom:'0.75rem' }}>{vocab.subDistribucion}</div>
            <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
              {Object.entries(kpis.bySug||{}).filter(([,v])=>v>0).map(([cat,val])=>(
                <DistribCard
                  key={cat}
                  cat={cat}
                  val={val}
                  total={kpis.totalSugs}
                  isSelected={distribSelected?.grupo==='sug' && distribSelected?.cat===cat}
                  onToggle={() => toggleDistrib('sug', cat)}
                  combinado={fuente === 'combinado'}
                />
              ))}
            </div>
          </div>

          {/* Bloque Caso (solo SdC) */}
          {vocab.mostrarCasos && kpis.byCaso && (
            <div style={{ borderLeft:'1px solid var(--border)', paddingLeft:'1.5rem' }}>
              <div className="card-title" style={{ marginBottom:'0.25rem' }}>{vocab.labelDistribucionCaso}</div>
              <div className="card-subtitle" style={{ marginBottom:'0.75rem' }}>{vocab.subDistribucionCaso}</div>
              <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                {Object.entries(kpis.byCaso||{}).filter(([,v])=>v>0).map(([cat,val])=>(
                  <DistribCard
                    key={cat}
                    cat={cat}
                    val={val}
                    total={kpis.totalCasos}
                    isSelected={distribSelected?.grupo==='caso' && distribSelected?.cat===cat}
                    onToggle={() => toggleDistrib('caso', cat)}
                    combinado={fuente === 'combinado'}
                  />
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Panel de detalle — ancho completo, debajo de las dos columnas */}
        {distribSelected && fuente !== 'combinado' && (
          <div style={{ marginTop:'1rem', borderTop:'1px solid var(--border)', paddingTop:'0.75rem' }}>
            <TablaCasosInline
              rows={distribFilas}
              titulo={`${CALIDAD_LABELS[distribSelected.cat]} — ${distribSelected.grupo === 'sug' ? vocab.labelDistribucion : vocab.labelDistribucionCaso}`}
              onClose={() => setDistribSelected(null)}
              fuente={fuente}
              calidad={distribSelected.cat}
            />
          </div>
        )}
      </div>

      {/* ── Concentración de errores ── */}
      {concentracion && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Concentración de errores</div>
              <div className="card-subtitle">Define si el problema es focalizado o sistémico.</div>
            </div>
            <ExportCSVButton data={formatCalidadError(concentracion?.porError)} filename="calidad_por_error.csv" />
          </div>
          <div style={{ fontSize:'0.82rem', color:'var(--text2)', marginBottom:'0.75rem' }}>
            Los 3 códigos de error más frecuentes explican el <strong style={{ color: concentracion.pctTop3 >= 0.6 ? 'var(--yellow)' : 'var(--text)' }}>{Math.round(concentracion.pctTop3*100)}%</strong> de todos los desvíos.
          </div>
          <div className="table-wrap">
            <table>
              <thead><tr><th>#</th><th>Código de error</th><th>Total</th><th>Correcto</th><th>Desvíos</th><th>Efectividad</th></tr></thead>
              <tbody>
                {concentracion.porError.slice(0,8).map((e,i)=>(
                  <tr key={e.error}>
                    <td style={{ color:'var(--text3)' }}>{i+1}</td>
                    <td className="bold">{e.error}</td>
                    <td className="num">{e.total}</td>
                    <td><PctCell val={e.correcto||0} total={e.total} type="correcto" /></td>
                    <td><PctCell val={(e.desvio_leve||0)+(e.desvio_grave||0)} total={e.total} type="desvio_leve" /></td>
                    <td><span style={{ fontWeight:700, color:e.efectividad>=0.9?'var(--green)':e.efectividad>=0.75?'var(--yellow)':'var(--red)' }}>{Math.round(e.efectividad*100)}%</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Evolución con target ── */}
      {porSemana.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">¿El sistema mejora o empeora?</div>
            <div className="card-subtitle">Línea roja = target 90%. Si un patrón crece sostenidamente, ya es riesgo.</div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={porSemana} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={v=>`S${v}`} />
              <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} domain={[0.5,1]} tickFormatter={v=>`${Math.round(v*100)}%`} />
              <Tooltip content={<CustomTooltip valueFormatter={v=>`${Math.round(v*100)}%`} labelFormatter={v=>`Semana ${v}`} />} />
              <Legend wrapperStyle={{ fontSize:'0.75rem', color:'var(--text3)' }} />
              <Line type="monotone" dataKey={()=>0.9} name="Target 90%" stroke="var(--red)" strokeWidth={1} strokeDasharray="4 2" dot={false} legendType="none" />
              <Line type="monotone" dataKey="efectividadSug" name={fuente==='sdc'?'Por sugerencia_id (principal)':fuente==='mao'?'Acciones correctas':'Registros correctos'} stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
              {vocab.mostrarCasos && (
                <Line type="monotone" dataKey="efectividadCaso" name="Por id_caso (contextual)" stroke="var(--accent2)" strokeWidth={2} strokeDasharray="5 3" dot={{ r:3 }} />
              )}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}

      <div className="grid grid-2">
        {/* Por dominio */}
        {porDominio?.length > 0 && (
          <div className="card">
            <div className="card-title" style={{ marginBottom:'0.5rem' }}>Por dominio — efectividad</div>
            <div className="card-subtitle" style={{ marginBottom:'0.75rem' }}>Top 10 · color = estado vs target 90%</div>
            <ResponsiveContainer width="100%" height={Math.max(220, porDominio.slice(0,10).length * 28)}>
              <BarChart data={porDominio.slice(0,10)} layout="vertical" margin={{ top:0, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:10 }} tickFormatter={v=>`${Math.round(v*100)}%`} domain={[0,1]} />
                <YAxis type="category" dataKey="dominio" tick={{ fill:'var(--text3)', fontSize:10 }} width={Math.min(220, Math.max(100, (porDominio.slice(0,10).reduce((max,e)=>Math.max(max,(e.dominio||'').length),0)*6.5)))} />
                <Tooltip content={<CustomTooltip valueFormatter={v=>`${Math.round(v*100)}%`} />} />
                <Bar dataKey="efectividad" name="Efectividad" radius={[0,3,3,0]}>
                  {porDominio.slice(0,10).map((e,i)=>(
                    <Cell key={i} fill={e.efectividad>=0.9?CALIDAD_COLORS.correcto:e.efectividad>=0.75?CALIDAD_COLORS.desvio_leve:CALIDAD_COLORS.desvio_grave} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {/* Por auditor */}
        {porAuditor_?.length > 0 && (
          <div className="card">
            <div className="card-header" style={{ marginBottom:'0.5rem' }}>
              <div>
                <div className="card-title">Por auditor</div>
                <div className="card-subtitle">Volumen y resultados por auditor.</div>
              </div>
              <ExportCSVButton data={formatCalidadAuditor(porAuditor_)} filename="calidad_por_auditor.csv" />
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr>
                  <SortTh colKey="auditor"      label="Auditor"  sortKey={audSortKey} sortDir={audSortDir} onSort={audOnSort} />
                  <SortTh colKey="total"        label={vocab.colHeader} sortKey={audSortKey} sortDir={audSortDir} onSort={audOnSort} />
                  <SortTh colKey="correcto"     label="Correcto" sortKey={audSortKey} sortDir={audSortDir} onSort={audOnSort} />
                  <SortTh colKey="desvio_grave" label="Grave"    sortKey={audSortKey} sortDir={audSortDir} onSort={audOnSort} />
                  <th>Dist.</th>
                </tr></thead>
                <tbody>
                  {auditorSorted.map(r=>(
                    <tr key={r.auditor}>
                      <td className="bold">{r.auditor}</td>
                      <td className="num">{r.total}</td>
                      <td><PctCell val={r.correcto||0} total={r.total} type="correcto" /></td>
                      <td><PctCell val={r.desvio_grave||0} total={r.total} type="desvio_grave" /></td>
                      <td style={{ minWidth:90 }}><CalidadBar correcto={r.correcto||0} desvio_leve={r.desvio_leve||0} desvio_grave={r.desvio_grave||0} sin_clasificar={r.sin_clasificar||0} total={r.total} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>

      {/* ── Por colaborador ── */}
      {porUsuario?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Calidad por colaborador</div>
              <div className="card-subtitle">{fuente==='sdc'?'Principal: por sugerencia_id · Contextual: por id_caso':fuente==='mao'?'Efectividad por acción auditada':'Efectividad combinada SdC + MAO'}</div>
            </div>
            <ExportCSVButton data={formatCalidadColab(porUsuario)} filename="calidad_por_colaborador.csv" />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <SortTh colKey="usuario"        label="Colaborador" sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} />
                  <SortTh colKey="totalSugs"      label={vocab.colHeader} sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} />
                  <SortTh colKey="efectividadSug" label="Ef. sug. ⓘ"  sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} title={COPY.kpis.efSug.help} />
                  <SortTh colKey="correcto"       label="Correcto"    sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} />
                  <SortTh colKey="desvio_leve"    label="Leve"        sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} />
                  <SortTh colKey="desvio_grave"   label="Grave"       sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} />
                  {vocab.mostrarCasos && <><SortTh colKey="totalCasos" label="Casos ⓘ" sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} title={COPY.kpis.efCaso.help} style={{ color:'var(--text3)' }} /><SortTh colKey="efectividadCaso" label="Ef. caso" sortKey={usuSortKey} sortDir={usuSortDir} onSort={usuOnSort} style={{ color:'var(--text3)' }} /></>}
                  <th>Dist.</th>
                </tr>
              </thead>
              <tbody>
                {usuarioSorted.map(r=>(
                  <tr key={r.usuario}>
                    <td className="bold">{r.usuario}</td>
                    <td className="num">{r.totalSugs}</td>
                    <td><span style={{ color:r.efectividadSug>=0.9?'var(--green)':r.efectividadSug>=0.75?'var(--yellow)':'var(--red)', fontWeight:700 }}>{Math.round(r.efectividadSug*100)}%</span></td>
                    <td><PctCell val={r.correcto||0} total={r.totalSugs} type="correcto" /></td>
                    <td><PctCell val={r.desvio_leve||0} total={r.totalSugs} type="desvio_leve" /></td>
                    <td><PctCell val={r.desvio_grave||0} total={r.totalSugs} type="desvio_grave" /></td>
                    {vocab.mostrarCasos && <><td className="num" style={{ color:'var(--text3)' }}>{r.totalCasos}</td><td style={{ color:'var(--text3)', fontSize:'0.78rem' }}>{Math.round(r.efectividadCaso*100)}%</td></>}
                    <td style={{ minWidth:110 }}><CalidadBar correcto={r.correcto||0} desvio_leve={r.desvio_leve||0} desvio_grave={r.desvio_grave||0} sin_clasificar={r.sin_clasificar||0} total={r.totalSugs} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Acciones sugeridas — con tabla de detalle inline ── */}
      <div className="card">
        <div className="card-header" style={{ marginBottom:'0.75rem' }}>
          <div className="card-title">Acciones sugeridas</div>
          <span className="badge badge-slate" style={{ fontSize:'0.65rem' }}>Hacé click en "Ver casos" para ver el detalle.</span>
        </div>
        <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {acciones.map((a,i)=>(
            <AccionItem
              key={i}
              accion={a}
              auditadosActivos={auditadosActivos}
              porUsuario={porUsuario}
              fuente={fuente}
            />
          ))}
        </ul>
      </div>
    </div>
  )
}
