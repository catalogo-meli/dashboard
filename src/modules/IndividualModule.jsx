import { useMemo, useState } from 'react'
import { ComposedChart, Bar, LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts'
import { formatDateDisplay, formatNumber } from '../utils/parsers.js'
import { COPY } from '../config/copy.js'
import { labelSegmento } from '../config/segments.js'
import { KPICard, EmptyState, CalidadBar, CustomTooltip, TrendTasksTooltip } from '../components/ui/index.jsx'
import { colorMapForFlows } from '../utils/flowColors.js'

function isVisibleFlujo(flujo) {
  return Boolean(flujo) && flujo !== 'Sin flujo'
}

function semanalProductividad(historico, usuario) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (r.usuario !== usuario || !r.week) continue
    const key = r.weekKey || `${r.weekYear || r.fecha?.getFullYear() || ''}-W${String(r.week).padStart(2, '0')}`
    if (!map.has(key)) map.set(key, { key, label: `Sem ${String(r.week).padStart(2, '0')} ${r.weekYear || r.fecha?.getFullYear() || ''}`, week: r.week, totalTareas: 0, totalIds: 0, dias: new Set(), byFlujo: {} })
    const e = map.get(key)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
    if (isVisibleFlujo(r.flujo)) e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
    if (r.fechaKey) e.dias.add(r.fechaKey)
  }
  return [...map.values()]
    .map(e => ({ ...e, diasHabiles: e.dias.size, promTareasPorDia: e.dias.size > 0 ? Math.round(e.totalTareas / e.dias.size) : 0 }))
    .sort((a, b) => a.key.localeCompare(b.key))
}

function semanalCalidad(auditados, usuario) {
  const base = (auditados || []).filter(r => r.usuario === usuario && r.week)
  const mapSug = new Map()
  for (const r of base) {
    const k = r.weekKey || `${r.weekYear || r.fecha?.getFullYear() || ''}-W${String(r.week).padStart(2, '0')}`
    if (!mapSug.has(k)) mapSug.set(k, { key: k, label: `Sem ${String(r.week).padStart(2, '0')} ${r.weekYear || r.fecha?.getFullYear() || ''}`, week: r.week, total: 0, correcto: 0 })
    const e = mapSug.get(k)
    e.total++
    if (r.calidad === 'correcto') e.correcto++
  }
  // Calidad por caso (idCaso) para la segunda línea contextual
  const casos = new Map()
  for (const r of base) {
    if (!r.idCaso) continue
    if (!casos.has(r.idCaso)) casos.set(r.idCaso, { key: r.weekKey || `${r.weekYear || r.fecha?.getFullYear() || ''}-W${String(r.week).padStart(2, '0')}`, sugs: [] })
    casos.get(r.idCaso).sugs.push(r.calidad)
  }
  const mapCaso = new Map()
  for (const [, c] of casos) {
    const k = c.key
    if (!mapCaso.has(k)) mapCaso.set(k, { totalCasos: 0, correctoCasos: 0 })
    const e = mapCaso.get(k)
    e.totalCasos++
    if (c.sugs.every(s => s === 'correcto')) e.correctoCasos++
  }
  return [...mapSug.values()].map(e => {
    const cd = mapCaso.get(e.week) || { totalCasos: 0, correctoCasos: 0 }
    return {
      ...e,
      efectividadSug:  e.total > 0 ? e.correcto / e.total : 0,
      efectividadCaso: cd.totalCasos > 0 ? cd.correctoCasos / cd.totalCasos : 0,
    }
  }).sort((a, b) => a.key.localeCompare(b.key))
}

function calidadPorGranularidad(auditados, usuario, granularidad) {
  if (granularidad === 'semanal') return semanalCalidad(auditados, usuario)
  const base = (auditados || []).filter(r => r.usuario === usuario && r.fecha)
  const map = new Map()
  for (const r of base) {
    const key = granularidad === 'diario'
      ? r.fechaKey
      : `${r.fecha.getFullYear()}-${String(r.fecha.getMonth() + 1).padStart(2, '0')}`
    const label = granularidad === 'diario'
      ? formatDateDisplay(r.fecha)
      : `${String(r.fecha.getMonth() + 1).padStart(2, '0')}/${r.fecha.getFullYear()}`
    if (!map.has(key)) map.set(key, { key, label, total: 0, correcto: 0, casos: new Map() })
    const e = map.get(key)
    e.total += 1
    if (r.calidad === 'correcto') e.correcto += 1
    if (r.idCaso) {
      if (!e.casos.has(r.idCaso)) e.casos.set(r.idCaso, [])
      e.casos.get(r.idCaso).push(r.calidad)
    }
  }
  return [...map.values()].map(e => {
    let totalCasos = 0
    let correctoCasos = 0
    for (const vals of e.casos.values()) {
      totalCasos += 1
      if (vals.every(v => v === 'correcto')) correctoCasos += 1
    }
    return {
      key: e.key,
      label: e.label,
      total: e.total,
      efectividadSug: e.total > 0 ? e.correcto / e.total : 0,
      efectividadCaso: totalCasos > 0 ? correctoCasos / totalCasos : 0,
    }
  }).sort((a, b) => a.key.localeCompare(b.key))
}

const MODOS = [
  { id: 'individual', label: 'Individual' },
  { id: 'comparar',   label: 'Comparar' },
]

const MAX_COMPARE_PROFILES = 7
const emptyCompareSlots = () => Array(MAX_COMPARE_PROFILES).fill('')

function ColaboradorSelector({ search, onSearch, selectedUser, onSelect, usuarios, label, placeholder }) {
  // usuarios: array de { id, nombre } ordenado por nombre
  const [open, setOpen] = useState(false)

  const filtrados = useMemo(() => {
    if (!search.trim()) return usuarios
    const q = search.toLowerCase()
    return usuarios.filter(u =>
      u.nombre.toLowerCase().includes(q) || u.id.toLowerCase().includes(q)
    )
  }, [usuarios, search])

  const seleccionado = usuarios.find(u => u.id === selectedUser)

  function handleSelect(u) {
    onSelect(u.id)
    onSearch('')
    setOpen(false)
  }

  function handleClear(e) {
    e.stopPropagation()
    onSelect('')
    onSearch('')
    setOpen(false)
  }

  // Highlight matching text
  function highlight(text, q) {
    if (!q.trim()) return text
    const idx = text.toLowerCase().indexOf(q.toLowerCase())
    if (idx === -1) return text
    return <>{text.slice(0, idx)}<mark style={{ background:'var(--accent)', color:'#fff', borderRadius:2, padding:'0 2px' }}>{text.slice(idx, idx + q.length)}</mark>{text.slice(idx + q.length)}</>
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'0.35rem', flex:'1 1 220px', minWidth:200, position:'relative' }}>
      {label && <div style={{ fontSize:'0.72rem', color:'var(--text3)', fontWeight:600, textTransform:'uppercase', letterSpacing:'0.05em' }}>{label}</div>}

      {/* Input de búsqueda */}
      <div style={{ position:'relative' }}>
        <input
          type="text"
          value={seleccionado && !open ? '' : search}
          placeholder={seleccionado ? `${seleccionado.nombre}` : (placeholder || 'Buscar por nombre o ID...')}
          onFocus={() => setOpen(true)}
          onChange={e => { onSearch(e.target.value); setOpen(true) }}
          style={{
            width: '100%', boxSizing: 'border-box',
            background: 'var(--bg3)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', padding: '0.45rem 2rem 0.45rem 0.75rem',
            fontSize: '0.82rem', color: seleccionado && !open ? 'var(--text)' : 'var(--text)',
            outline: 'none', cursor: 'text',
          }}
          onBlur={() => setTimeout(() => setOpen(false), 150)}
        />
        {/* Ícono lupa / X */}
        <span style={{ position:'absolute', right:8, top:'50%', transform:'translateY(-50%)', fontSize:'0.75rem', color:'var(--text3)', cursor: seleccionado ? 'pointer' : 'default' }}
          onClick={seleccionado ? handleClear : undefined}>
          {seleccionado ? '✕' : '🔍'}
        </span>
      </div>

      {/* Chip del seleccionado (cuando hay uno y no está en modo búsqueda) */}
      {seleccionado && !open && (
        <div style={{ display:'flex', alignItems:'center', gap:6, background:'var(--bg3)', border:'1px solid var(--accent)', borderRadius:'var(--radius-sm)', padding:'0.3rem 0.6rem' }}>
          <div style={{ width:26, height:26, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.7rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
            {seleccionado.nombre[0]?.toUpperCase() || '?'}
          </div>
          <div style={{ minWidth:0 }}>
            <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)', whiteSpace:'nowrap', overflow:'hidden', textOverflow:'ellipsis' }}>{seleccionado.nombre}</div>
            <div style={{ fontSize:'0.68rem', color:'var(--text3)' }}>{seleccionado.id}</div>
          </div>
          <button onClick={handleClear} style={{ marginLeft:'auto', background:'none', border:'none', color:'var(--text3)', cursor:'pointer', fontSize:'0.75rem', padding:'0 2px' }}>✕</button>
        </div>
      )}

      {/* Dropdown de resultados */}
      {open && (
        <div style={{
          position:'absolute', top:'100%', left:0, right:0, zIndex:100,
          background:'var(--bg2)', border:'1px solid var(--border)',
          borderRadius:'var(--radius-sm)', boxShadow:'0 4px 16px rgba(0,0,0,0.4)',
          maxHeight:260, overflowY:'auto', marginTop:2,
        }}>
          {filtrados.length === 0 ? (
            <div style={{ padding:'0.6rem 0.75rem', fontSize:'0.78rem', color:'var(--text3)' }}>
              Sin resultados para "{search}"
            </div>
          ) : (
            <>
              {!search.trim() && (
                <div style={{ padding:'0.35rem 0.75rem', fontSize:'0.68rem', color:'var(--text3)', borderBottom:'1px solid var(--border)' }}>
                  {usuarios.length} colaboradores — escribí para filtrar
                </div>
              )}
              {filtrados.map(u => (
                <div key={u.id} onMouseDown={() => handleSelect(u)}
                  style={{
                    display:'flex', alignItems:'center', gap:'0.5rem',
                    padding:'0.45rem 0.75rem', cursor:'pointer',
                    background: u.id === selectedUser ? 'var(--bg3)' : 'transparent',
                    borderBottom:'1px solid var(--border)',
                  }}
                  onMouseEnter={e => e.currentTarget.style.background = 'var(--bg3)'}
                  onMouseLeave={e => e.currentTarget.style.background = u.id === selectedUser ? 'var(--bg3)' : 'transparent'}
                >
                  <div style={{ width:28, height:28, borderRadius:'50%', background:'var(--accent)', display:'flex', alignItems:'center', justifyContent:'center', fontSize:'0.72rem', fontWeight:700, color:'#fff', flexShrink:0 }}>
                    {u.nombre[0]?.toUpperCase() || '?'}
                  </div>
                  <div style={{ minWidth:0 }}>
                    <div style={{ fontSize:'0.8rem', fontWeight:600, color:'var(--text)' }}>{highlight(u.nombre, search)}</div>
                    <div style={{ fontSize:'0.68rem', color:'var(--text3)' }}>{highlight(u.id, search)}</div>
                  </div>
                  {u.id === selectedUser && <span style={{ marginLeft:'auto', color:'var(--accent)', fontSize:'0.75rem' }}>✓</span>}
                </div>
              ))}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function usePerfilColaborador(usuario, model, equipo, todos) {
  return useMemo(() => {
    if (!usuario) return null
    const perfilEq = equipo?.find(e => e.idMeli === usuario) || null
    const finUser  = model.prodModel?.ranking?.find(r => r.usuario === usuario) || null
    const audUser  = model.calidadModel?.porUsuario?.find(r => r.usuario === usuario) || null
    const holdUser = model.friccionModel?.kpisHold
      ? { total: model.friccionModel.kpisHold.byUsuario?.[usuario] || 0 } : null
    return { usuario, perfilEq, finUser, audUser, holdUser }
  }, [usuario, model, equipo])
}

// Promedios de comparación para un colaborador (vs equipo, rol, segmento)
function useComparaciones(perfilEq, usuario, model, equipo) {
  return useMemo(() => {
    if (!perfilEq || !model.prodModel?.ranking) return null
    const rank = model.prodModel.ranking
    const calPorUsuario = model.calidadModel?.porUsuario || []

    function grupoPromedio(filterFn) {
      const peers = rank.filter(r => r.usuario !== usuario && (() => {
        const eq = equipo?.find(e => e.idMeli === r.usuario)
        return eq ? filterFn(eq) : false
      })())
      if (!peers.length) return null
      const cPeers = calPorUsuario.filter(c => peers.some(p => p.usuario === c.usuario))
      return {
        n: peers.length,
        avgTareas: Math.round(peers.reduce((s,r)=>s+r.totalTareas,0)/peers.length),
        avgIds:    Math.round(peers.reduce((s,r)=>s+r.totalIds,0)/peers.length),
        avgDia:    Math.round(peers.reduce((s,r)=>s+r.promTareasPorDia,0)/peers.length),
        avgEfSug:  cPeers.length > 0
          ? Math.round(cPeers.reduce((s,c)=>s+c.efectividadSug,0)/cPeers.length*100) : null,
      }
    }
    return {
      equipo:   perfilEq.equipo   ? grupoPromedio(e => e.equipo   === perfilEq.equipo)   : null,
      rol:      perfilEq.rol      ? grupoPromedio(e => e.rol      === perfilEq.rol)      : null,
      segmento: perfilEq.segmentoAntiguedad
        ? grupoPromedio(e => e.segmentoAntiguedad === perfilEq.segmentoAntiguedad) : null,
    }
  }, [perfilEq, usuario, model, equipo])
}

function generarInsightsComparacion(perfiles) {
  const activos = perfiles.filter(p => p !== null)
  if (activos.length < 2) return []
  const ins = []

  // Quién produce más tareas
  const sortedProd = [...activos].filter(p=>p.finUser).sort((a,b)=>b.finUser.totalTareas-a.finUser.totalTareas)
  if (sortedProd.length >= 2 && sortedProd[0].finUser && sortedProd[sortedProd.length-1].finUser) {
    const ratio = sortedProd[0].finUser.totalTareas > 0
      ? sortedProd[sortedProd.length-1].finUser.totalTareas / sortedProd[0].finUser.totalTareas : null
    if (ratio != null && ratio < 0.7) {
      ins.push({ tipo:'atencion', texto:`${sortedProd[0].usuario} finalizó ${Math.round((1-ratio)*100)}% más tareas que ${sortedProd[sortedProd.length-1].usuario}. La diferencia puede deberse a tipo de tarea o días activos.` })
    }
  }

  // Quién tiene mayor complejidad (IDs/tarea)
  const sortedComp = [...activos].filter(p=>p.finUser).sort((a,b)=>b.finUser.relIdsPorTarea-a.finUser.relIdsPorTarea)
  if (sortedComp.length >= 2 && sortedComp[0].finUser?.relIdsPorTarea > sortedComp[sortedComp.length-1].finUser?.relIdsPorTarea) {
    ins.push({ tipo:'contexto', texto:`${sortedComp[0].usuario} trabaja tareas más complejas (${sortedComp[0].finUser.relIdsPorTarea}x IDs/tarea vs ${sortedComp[sortedComp.length-1].finUser.relIdsPorTarea}x). Comparar volumen sin considerar esto puede ser engañoso.` })
  }

  // Calidad
  const sortedCal = [...activos].filter(p=>p.audUser).sort((a,b)=>b.audUser.efectividadSug-a.audUser.efectividadSug)
  if (sortedCal.length >= 2) {
    const gap = Math.round((sortedCal[0].audUser.efectividadSug - sortedCal[sortedCal.length-1].audUser.efectividadSug)*100)
    if (gap >= 10) {
      ins.push({ tipo:'atencion', texto:`Brecha de calidad de ${gap} pp entre ${sortedCal[0].usuario} (${Math.round(sortedCal[0].audUser.efectividadSug*100)}%) y ${sortedCal[sortedCal.length-1].usuario} (${Math.round(sortedCal[sortedCal.length-1].audUser.efectividadSug*100)}%).` })
    }
  }

  // HOLD
  const sortedHold = [...activos].filter(p=>p.holdUser && p.finUser?.totalTareas > 0)
    .sort((a,b)=>
      (b.holdUser.total/b.finUser.totalTareas)-(a.holdUser.total/a.finUser.totalTareas))
  if (sortedHold.length >= 2) {
    const pctMax = Math.round(sortedHold[0].holdUser.total/sortedHold[0].finUser.totalTareas*100)
    const pctMin = Math.round(sortedHold[sortedHold.length-1].holdUser.total/sortedHold[sortedHold.length-1].finUser.totalTareas*100)
    if (pctMax - pctMin >= 10) {
      ins.push({ tipo:'atencion', texto:`${sortedHold[0].usuario} tiene ${pctMax}% de sus tareas en HOLD vs ${pctMin}% de ${sortedHold[sortedHold.length-1].usuario}. Puede indicar tipo de tarea o dependencia de terceros.` })
    }
  }

  return ins
}

function ColaboradorCol({ perfil, rank, comparaciones }) {
  const { usuario, perfilEq, finUser, audUser, holdUser } = perfil
  if (!usuario) return <div className="indiv-col-empty">—</div>

  const efColor = audUser
    ? audUser.efectividadSug>=0.9?'var(--green)':audUser.efectividadSug>=0.75?'var(--yellow)':'var(--red)'
    : 'var(--text3)'

  return (
    <div className="indiv-col">
      {/* Perfil */}
      <div className="indiv-col-header">
        <div className="indiv-col-avatar">
          {(perfilEq?.nombre||usuario).replace('ext_','')[0]?.toUpperCase()||'?'}
        </div>
        <div>
          <div style={{ fontWeight:700, fontSize:'0.85rem', color:'var(--text)' }}>{perfilEq?.nombre||usuario}</div>
          <div style={{ fontSize:'0.68rem', color:'var(--text3)' }}>
            {[perfilEq?.rol, perfilEq?.equipo].filter(Boolean).join(' · ')||usuario}
          </div>
          {perfilEq?.segmentoAntiguedad && (
            <div style={{ fontSize:'0.65rem', color:'var(--text3)' }}>
              {labelSegmento(perfilEq.segmentoAntiguedad)}
              {perfilEq.antiguedadDias != null ? ` (${perfilEq.antiguedadDias}d)` : ''}
            </div>
          )}
        </div>
      </div>

      {/* Productividad */}
      <div className="indiv-col-section">Productividad</div>
      <MetricRow label="Tareas" value={finUser ? formatNumber(finUser.totalTareas) : '—'} highlight={rank==='best'} />
      <MetricRow label="IDs trabajados" value={finUser ? formatNumber(finUser.totalIds) : '—'} />
      <MetricRow label="IDs por tarea" value={finUser ? `${finUser.relIdsPorTarea}x` : '—'} />
      <MetricRow label="Tareas/día" value={finUser ? formatNumber(finUser.promTareasPorDia) : '—'} highlight={rank==='best'} />
      <MetricRow label="Días activos" value={finUser ? finUser.diasHabiles : '—'} />

      {/* Calidad */}
      <div className="indiv-col-section">Calidad</div>
      <MetricRow label="Ef. sugerencias" value={audUser ? `${Math.round(audUser.efectividadSug*100)}%` : '—'}
        valueColor={audUser ? efColor : 'var(--text3)'} highlight={rank==='bestCal'} />
      {audUser && (
        <div style={{ padding:'0 0.75rem 0.5rem' }}>
          <CalidadBar correcto={audUser.correcto||0} desvio_leve={audUser.desvio_leve||0}
            desvio_grave={audUser.desvio_grave||0} sin_clasificar={audUser.sin_clasificar||0}
            total={audUser.totalSugs} />
        </div>
      )}
      <MetricRow label="Ef. casos" value={audUser ? `${Math.round(audUser.efectividadCaso*100)}%` : '—'}
        note="contextual" />

      {/* Fricción */}
      <div className="indiv-col-section">Fricción</div>
      <MetricRow label="Registros HOLD" value={holdUser ? formatNumber(holdUser.total) : '—'}
        valueColor={holdUser?.total > 0 ? 'var(--red)' : 'var(--text3)'} />
      {holdUser && finUser?.totalTareas > 0 && (
        <MetricRow label="% en HOLD" value={`${Math.round(holdUser.total/finUser.totalTareas*100)}%`}
          valueColor={holdUser.total/finUser.totalTareas>0.1?'var(--red)':holdUser.total/finUser.totalTareas>0.05?'var(--yellow)':'var(--green)'} />
      )}
    </div>
  )
}

function MetricRow({ label, value, valueColor, highlight, note }) {
  return (
    <div style={{
      display:'flex', justifyContent:'space-between', alignItems:'center',
      padding:'5px 0.75rem', borderBottom:'1px solid var(--border)',
      background: highlight ? 'rgba(99,102,241,0.06)' : 'transparent',
    }}>
      <span style={{ fontSize:'0.75rem', color:'var(--text3)' }}>
        {label}{note && <span style={{ marginLeft:4, fontSize:'0.65rem', color:'var(--text3)' }}>({note})</span>}
      </span>
      <span style={{ fontSize:'0.82rem', fontWeight:highlight?700:600,
        color: valueColor || (highlight ? 'var(--accent2)' : 'var(--text)') }}>
        {value}
      </span>
    </div>
  )
}

function agruparDiarioInd(historico, usuario) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (r.usuario !== usuario || !r.fechaKey) continue
    if (!map.has(r.fechaKey)) map.set(r.fechaKey, { key: r.fechaKey, label: formatDateDisplay(r.fecha), totalTareas: 0, totalIds: 0, byFlujo: {} })
    const e = map.get(r.fechaKey)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
    if (isVisibleFlujo(r.flujo)) e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function agruparMensualInd(historico, usuario) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (r.usuario !== usuario || !r.fecha) continue
    const mes = `${r.fecha.getFullYear()}-${String(r.fecha.getMonth()+1).padStart(2,'0')}`
    if (!map.has(mes)) map.set(mes, { key: mes, label: `${String(r.fecha.getMonth()+1).padStart(2,'0')}/${r.fecha.getFullYear()}`, totalTareas: 0, totalIds: 0, byFlujo: {} })
    const e = map.get(mes)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
    if (isVisibleFlujo(r.flujo)) e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function flujosInd(data) {
  const totals = new Map()
  for (const row of data) {
    for (const [f, v] of Object.entries(row.byFlujo || {})) {
      if (!isVisibleFlujo(f) || v <= 0) continue
      totals.set(f, (totals.get(f) || 0) + v)
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([f]) => f)
}

function GraficoProdSemanal({ usuario, filteredHistorico }) {
  const [gran, setGran] = useState('semanal')
  const dataSemanal = useMemo(() => semanalProductividad(filteredHistorico, usuario), [filteredHistorico, usuario])
  const dataDiario  = useMemo(() => agruparDiarioInd(filteredHistorico, usuario), [filteredHistorico, usuario])
  const dataMensual = useMemo(() => agruparMensualInd(filteredHistorico, usuario), [filteredHistorico, usuario])

  const data = gran === 'diario' ? dataDiario : gran === 'mensual' ? dataMensual
    : dataSemanal
  const flowNames = useMemo(() => flujosInd(data), [data])
  const flowColors = useMemo(() => colorMapForFlows(flowNames), [flowNames])

  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Tendencia — Tareas e IDs</div>
        <div className="empty-state" style={{ padding:'1rem' }}>Sin datos de productividad para esta granularidad.</div>
      </div>
    )
  }
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Tendencia — Tareas e IDs</div>
          <div className="card-subtitle">Barras = tareas · Línea = IDs trabajados. Si divergen, la complejidad promedio cambió.</div>
        </div>
        <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
          {['Diario','Semanal','Mensual'].map(g => {
            const id = g.toLowerCase()
            return (
              <button key={id} onClick={() => setGran(id)}
                style={{
                  padding:'0.25rem 0.7rem', fontSize:'0.72rem', fontWeight: gran===id ? 700 : 400,
                  background: gran===id ? 'var(--accent)' : 'transparent',
                  color: gran===id ? '#fff' : 'var(--text2)',
                  border:'none', cursor:'pointer', borderRight:'1px solid var(--border)',
                }}>{g}</button>
            )
          })}
        </div>
      </div>
      <ResponsiveContainer width="100%" height={240}>
        <ComposedChart data={data} margin={{ top:5, right:40, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill:'var(--text3)', fontSize:11 }} interval="preserveStartEnd" />
          <YAxis yAxisId="left" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
          <YAxis yAxisId="right" orientation="right" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
          <Tooltip content={<TrendTasksTooltip
            labelFormatter={v => v}
            valueFormatter={formatNumber}
            lineFormatters={{ 'IDs trabajados': formatNumber }} />} />
          <Legend wrapperStyle={{ fontSize:'0.72rem', color:'var(--text3)' }} />
          {flowNames.map((flujo, idx) => (
            <Bar key={flujo} yAxisId="left" stackId="tareas"
              dataKey={row => row.byFlujo?.[flujo] || 0}
              name={flujo}
              fill={flowColors.get(flujo)}
              radius={idx === flowNames.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
          ))}
          <Line yAxisId="right" type="monotone" dataKey="totalIds" name="IDs trabajados" stroke="#fb923c" strokeWidth={2} dot={{ r:3 }} />
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  )
}

function GraficoCalSemanal({ usuario, auditados }) {
  const [gran, setGran] = useState('semanal')
  const data = useMemo(() => calidadPorGranularidad(auditados, usuario, gran), [auditados, usuario, gran])
  if (data.length === 0) {
    return (
      <div className="card">
        <div className="card-title">Â¿El sistema mejora o empeora?</div>
        <div className="empty-state" style={{ padding:'1rem' }}>Sin auditorÃ­as para el perÃ­odo seleccionado.</div>
      </div>
    )
  }
  return (
    <div className="card">
      <div className="card-header">
        <div className="card-title">¿El sistema mejora o empeora?</div>
        <div className="card-subtitle">Línea roja = target 90%. Si un patrón crece sostenidamente, ya es riesgo aunque no sea lo más grande.</div>
      </div>
      <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden', width:'fit-content', marginBottom:'0.75rem' }}>
        {['Diario','Semanal','Mensual'].map(g => {
          const id = g.toLowerCase()
          return (
            <button key={id} onClick={() => setGran(id)}
              style={{
                padding:'0.25rem 0.7rem', fontSize:'0.72rem', fontWeight: gran===id ? 700 : 400,
                background: gran===id ? 'var(--accent)' : 'transparent',
                color: gran===id ? '#fff' : 'var(--text2)',
                border:'none', cursor:'pointer', borderRight:'1px solid var(--border)',
              }}>{g}</button>
          )
        })}
      </div>
      <ResponsiveContainer width="100%" height={210}>
        <LineChart data={data} margin={{ top:5, right:10, left:0, bottom:5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
          <XAxis dataKey="label" tick={{ fill:'var(--text3)', fontSize:11 }} interval="preserveStartEnd" />
          <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} domain={[0.5,1]} tickFormatter={v=>`${Math.round(v*100)}%`} />
          <Tooltip content={<CustomTooltip valueFormatter={v=>`${Math.round(v*100)}%`} labelFormatter={v=>v} />} />
          <Legend wrapperStyle={{ fontSize:'0.75rem', color:'var(--text3)' }} />
          <Line type="monotone" dataKey={()=>0.9} name="Target 90%" stroke="var(--red)" strokeWidth={1} strokeDasharray="4 2" dot={false} legendType="none" />
          <Line type="monotone" dataKey="efectividadSug" name="Por sugerencia_id (principal)" stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
          <Line type="monotone" dataKey="efectividadCaso" name="Por id_caso (contextual)" stroke="var(--accent2)" strokeWidth={2} strokeDasharray="5 3" dot={{ r:3 }} />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

export function IndividualModule({ model, equipo, options, filteredHistorico, auditados }) {
  const [modo, setModo] = useState('individual')

  // Individual
  const [search1, setSearch1] = useState('')
  const [user1, setUser1]     = useState('')

  // Comparar
  const [compareSearches, setCompareSearches] = useState(emptyCompareSlots)
  const [compareUsers, setCompareUsers] = useState(emptyCompareSlots)

  // Build enriched user list: { id, nombre } sorted by nombre
  const todosUsuarios = useMemo(() => {
    const ids = [...new Set([...(options.usuarios?.map(u => u.value) || [])])]
    return ids.map(id => {
      const eq = equipo?.find(e => e.idMeli === id)
      return { id, nombre: eq?.nombre || id }
    }).sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
  }, [options.usuarios, equipo])

  // Perfiles
  const perfilIndividual = usePerfilColaborador(user1, model, equipo, todosUsuarios)
  const compar0 = usePerfilColaborador(compareUsers[0], model, equipo, todosUsuarios)
  const compar1 = usePerfilColaborador(compareUsers[1], model, equipo, todosUsuarios)
  const compar2 = usePerfilColaborador(compareUsers[2], model, equipo, todosUsuarios)
  const compar3 = usePerfilColaborador(compareUsers[3], model, equipo, todosUsuarios)
  const compar4 = usePerfilColaborador(compareUsers[4], model, equipo, todosUsuarios)
  const compar5 = usePerfilColaborador(compareUsers[5], model, equipo, todosUsuarios)
  const compar6 = usePerfilColaborador(compareUsers[6], model, equipo, todosUsuarios)
  const compareProfiles = useMemo(() => [compar0, compar1, compar2, compar3, compar4, compar5, compar6],
    [compar0, compar1, compar2, compar3, compar4, compar5, compar6])
  const selectedCompareCount = compareUsers.filter(Boolean).length

  const perfilEqInd  = equipo?.find(e => e.idMeli === user1) || null
  const comparaciones = useComparaciones(perfilEqInd, user1, model, equipo)

  const insights = useMemo(() => generarInsightsComparacion(compareProfiles), [compareProfiles])

  function setCompareSearch(index, value) {
    setCompareSearches(prev => prev.map((item, i) => i === index ? value : item))
  }

  function setCompareUser(index, value) {
    setCompareUsers(prev => prev.map((item, i) => i === index ? value : item))
  }

  function usuariosDisponiblesParaSlot(index) {
    const currentUser = compareUsers[index]
    return todosUsuarios.filter(u => u.id === currentUser || !compareUsers.includes(u.id))
  }

  function clearCompare() {
    setCompareUsers(emptyCompareSlots())
    setCompareSearches(emptyCompareSlots())
  }

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      {/* Toggle modo */}
      <div style={{ display:'flex', gap:4, background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:3, width:'fit-content' }}>
        {MODOS.map(m => (
          <button key={m.id}
            className={`filter-preset-btn${modo===m.id?' active':''}`}
            style={{ padding:'5px 18px' }}
            onClick={() => setModo(m.id)}>
            {m.label}
          </button>
        ))}
      </div>

      {/* ── MODO INDIVIDUAL ────────────────────────────────── */}
      {modo === 'individual' && (
        <>
          <div className="card" style={{ padding:'1rem 1.25rem' }}>
            <div style={{ fontSize:'0.82rem', color:'var(--text2)', fontWeight:600, marginBottom:'0.6rem' }}>
              Seleccioná un colaborador
            </div>
            <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap', alignItems:'flex-end' }}>
              <ColaboradorSelector
                search={search1} onSearch={setSearch1}
                selectedUser={user1} onSelect={setUser1}
                usuarios={todosUsuarios}
                placeholder="— Elegir colaborador —"
              />
              {user1 && (
                <button className="btn" onClick={() => { setUser1(''); setSearch1('') }}>✕ Limpiar</button>
              )}
            </div>
          </div>

          {!user1 && <EmptyState message="Seleccioná un colaborador para ver su perfil. Usá el buscador para encontrarlo rápido." />}

          {user1 && perfilIndividual && (
            <>
              {/* Perfil organizacional */}
              <div className="card">
                <div style={{ display:'flex', alignItems:'center', gap:'0.75rem', flexWrap:'wrap' }}>
                  <div className="indiv-avatar-lg">
                    {(perfilIndividual.perfilEq?.nombre||user1).replace('ext_','')[0]?.toUpperCase()||'?'}
                  </div>
                  <div style={{ flex:1 }}>
                    <div style={{ fontSize:'1rem', fontWeight:700, color:'var(--text)' }}>
                      {perfilIndividual.perfilEq?.nombre||user1}
                    </div>
                    <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginTop:2 }}>
                      {[perfilIndividual.perfilEq?.rol, perfilIndividual.perfilEq?.equipo,
                        perfilIndividual.perfilEq?.ubicacion].filter(Boolean).join(' · ')}
                    </div>
                  </div>
                  {perfilIndividual.perfilEq && (
                    <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
                      {[
                        { label:'Antigüedad', value: perfilIndividual.perfilEq.antiguedadDias != null ? `${perfilIndividual.perfilEq.antiguedadDias}d` : '—' },
                        { label:'Segmento',   value: perfilIndividual.perfilEq.segmentoAntiguedad ? labelSegmento(perfilIndividual.perfilEq.segmentoAntiguedad) : '—' },
                      ].map(({ label, value }) => (
                        <div key={label} >
                          <div style={{ fontSize:'0.65rem', color:'var(--text3)' }}>{label}</div>
                          <div style={{ fontSize:'0.82rem', fontWeight:600, color:'var(--text)' }}>{value}</div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {/* ── 1. KPIs: 6 cards en UNA sola línea ─────────────── */}
              {perfilIndividual.finUser ? (
                <>
                  <div className="metric-note metric-note-important">ℹ️ Tareas y IDs son métricas distintas. Una tarea puede involucrar varios IDs.</div>
                  <div style={{ display:'grid', gridTemplateColumns:'repeat(6, 1fr)', gap:'0.75rem' }}>
                    <KPICard label="Tareas" value={formatNumber(perfilIndividual.finUser.totalTareas)}
                      sub="Registros DONE." icon="📦" />
                    <KPICard label="IDs trabajados" value={formatNumber(perfilIndividual.finUser.totalIds)}
                      sub="Productos accionados." icon="🔗" color="#38bdf8" />
                    <KPICard label="IDs por tarea" value={`${perfilIndividual.finUser.relIdsPorTarea}x`}
                      sub="Complejidad." icon="🔄" color="var(--slate)" />
                    <KPICard label="Tareas/día activo" value={formatNumber(perfilIndividual.finUser.promTareasPorDia)}
                      sub="Días con actividad." icon="⚡" color="var(--green)" />
                    <KPICard label="Días activos" value={perfilIndividual.finUser.diasHabiles}
                      sub="Con al menos 1 tarea." icon="📅" color="var(--accent2)" />
                    <KPICard label="Registros HOLD" value={perfilIndividual.holdUser ? formatNumber(perfilIndividual.holdUser.total) : '—'}
                      sub={perfilIndividual.holdUser && perfilIndividual.finUser.totalTareas > 0
                        ? `${Math.round(perfilIndividual.holdUser.total/perfilIndividual.finUser.totalTareas*100)}% en HOLD.`
                        : 'Sin datos de HOLD.'}
                      icon="⏸️" color="var(--red)" />
                  </div>
                </>
              ) : (
                <div className="card">
                  <div className="empty-state" style={{ padding:'1.5rem' }}>
                    Sin datos de productividad para {user1} en el período. Probá ampliar el rango de fechas.
                  </div>
                </div>
              )}

              {/* ── 2. Tareas por flujo ─────────────────────────────── */}
              {perfilIndividual.finUser && Object.entries(perfilIndividual.finUser.byFlujo||{}).some(([flujo,v])=>isVisibleFlujo(flujo) && v>0) && (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Tareas por flujo</div>
                  </div>
                  <div style={{ display:'flex', gap:'0.75rem', flexWrap:'wrap' }}>
                    {Object.entries(perfilIndividual.finUser.byFlujo).filter(([flujo,v])=>isVisibleFlujo(flujo) && v>0).sort((a,b)=>b[1]-a[1]).map(([flujo,val])=>(
                      <div key={flujo} style={{ background:'var(--bg3)', border:'1px solid var(--border)',
                        borderRadius:'var(--radius-sm)', padding:'0.5rem 0.85rem', minWidth:110 }}>
                        <div style={{ fontSize:'0.7rem', color:'var(--text3)' }}>{flujo}</div>
                        <div style={{ fontSize:'1.1rem', fontWeight:700, color:'var(--text)' }}>{formatNumber(val)}</div>
                        <div style={{ fontSize:'0.68rem', color:'var(--text3)' }}>
                          {perfilIndividual.finUser.totalTareas>0?Math.round(val/perfilIndividual.finUser.totalTareas*100):0}%
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* ── 3. Tendencia semanal — Tareas e IDs ─────────────── */}
              <GraficoProdSemanal usuario={user1} filteredHistorico={filteredHistorico} />

              {/* ── 4. Comparación con su contexto ──────────────────── */}
              {comparaciones && perfilIndividual.finUser && (
                <div className="card">
                  <div className="card-header" style={{ marginBottom:'0.75rem' }}>
                    <div className="card-title">Comparación con su contexto</div>
                    <div className="card-subtitle">Promedio de los pares en cada grupo. El ratio indica su posición relativa.</div>
                  </div>
                  <div className="table-wrap">
                    <table>
                      <thead>
                        <tr>
                          <th>Métrica</th>
                          <th style={{ color:'var(--accent2)'}}>
                            {perfilIndividual.perfilEq?.nombre||user1}
                          </th>
                          {comparaciones.equipo && (
                            <th style={{ color:'var(--text3)'}}>
                              Equipo "{perfilIndividual.perfilEq?.equipo}"
                              <div style={{fontSize:'0.65rem',fontWeight:400}}>{comparaciones.equipo.n} peers</div>
                            </th>
                          )}
                          {comparaciones.rol && (
                            <th style={{ color:'var(--text3)'}}>
                              Rol "{perfilIndividual.perfilEq?.rol}"
                              <div style={{fontSize:'0.65rem',fontWeight:400}}>{comparaciones.rol.n} peers</div>
                            </th>
                          )}
                          {comparaciones.segmento && (
                            <th style={{ color:'var(--text3)'}}>
                              {labelSegmento(perfilIndividual.perfilEq?.segmentoAntiguedad)}
                              <div style={{fontSize:'0.65rem',fontWeight:400}}>{comparaciones.segmento.n} peers</div>
                            </th>
                          )}
                        </tr>
                      </thead>
                      <tbody>
                        {[
                          { label:'Tareas', personal: perfilIndividual.finUser.totalTareas, key:'avgTareas', fmt: formatNumber },
                          { label:'IDs trabajados', personal: perfilIndividual.finUser.totalIds, key:'avgIds', fmt: formatNumber },
                          { label:'Tareas por día activo', personal: perfilIndividual.finUser.promTareasPorDia, key:'avgDia', fmt: formatNumber },
                        ].map(({ label, personal, key, fmt }) => (
                          <tr key={label}>
                            <td style={{ color:'var(--text2)'}}>{label}</td>
                            <td style={{ fontWeight:700}}>{fmt(personal)}</td>
                            {comparaciones.equipo && <ComparCell personal={personal} prom={comparaciones.equipo[key]} fmt={fmt} />}
                            {comparaciones.rol     && <ComparCell personal={personal} prom={comparaciones.rol[key]}   fmt={fmt} />}
                            {comparaciones.segmento&& <ComparCell personal={personal} prom={comparaciones.segmento[key]} fmt={fmt} />}
                          </tr>
                        ))}
                        {perfilIndividual.audUser && (
                          <tr>
                            <td style={{ color:'var(--text2)'}}>Sugerencias correctas</td>
                            <td style={{ fontWeight:700,
                              color: perfilIndividual.audUser.efectividadSug>=0.9?'var(--green)':perfilIndividual.audUser.efectividadSug>=0.75?'var(--yellow)':'var(--red)'}}>
                              {Math.round(perfilIndividual.audUser.efectividadSug*100)}%
                            </td>
                            {comparaciones.equipo && <ComparCell personal={perfilIndividual.audUser.efectividadSug*100} prom={comparaciones.equipo.avgEfSug} fmt={v=>v!=null?`${Math.round(v)}%`:'—'} />}
                            {comparaciones.rol     && <ComparCell personal={perfilIndividual.audUser.efectividadSug*100} prom={comparaciones.rol.avgEfSug}     fmt={v=>v!=null?`${Math.round(v)}%`:'—'} />}
                            {comparaciones.segmento&& <ComparCell personal={perfilIndividual.audUser.efectividadSug*100} prom={comparaciones.segmento.avgEfSug} fmt={v=>v!=null?`${Math.round(v)}%`:'—'} />}
                          </tr>
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}

              {/* ── 5. Calidad auditada ─────────────────────────────── */}
              {perfilIndividual.audUser ? (
                <div className="card">
                  <div className="card-header">
                    <div className="card-title">Calidad auditada</div>
                    <span className="badge badge-accent">Por sugerencia_id (principal)</span>
                  </div>
                  <div style={{ display:'flex', gap:'1.5rem', flexWrap:'wrap', alignItems:'center' }}>
                    <div>
                      <div style={{ fontSize:'1.8rem', fontWeight:700,
                        color: perfilIndividual.audUser.efectividadSug>=0.9?'var(--green)':perfilIndividual.audUser.efectividadSug>=0.75?'var(--yellow)':'var(--red)' }}>
                        {Math.round(perfilIndividual.audUser.efectividadSug*100)}%
                      </div>
                      <div style={{ fontSize:'0.72rem', color:'var(--text3)' }}>
                        {formatNumber(perfilIndividual.audUser.totalSugs)} sugerencias · Target: 90%
                      </div>
                    </div>
                    <div style={{ flex:1, minWidth:180 }}>
                      <CalidadBar correcto={perfilIndividual.audUser.correcto||0}
                        desvio_leve={perfilIndividual.audUser.desvio_leve||0}
                        desvio_grave={perfilIndividual.audUser.desvio_grave||0}
                        sin_clasificar={perfilIndividual.audUser.sin_clasificar||0}
                        total={perfilIndividual.audUser.totalSugs} />
                    </div>
                  </div>
                  <div style={{ fontSize:'0.75rem', color:'var(--text3)', marginTop:'0.5rem' }}>
                    Por caso (contextual): <strong>{Math.round(perfilIndividual.audUser.efectividadCaso*100)}%</strong>
                    <span style={{ marginLeft:6 }}>({perfilIndividual.audUser.totalCasos} casos)</span>
                  </div>
                </div>
              ) : (
                <div className="card">
                  <div className="empty-state" style={{ padding:'1rem' }}>
                    Sin auditorías para {user1} en el período. Ampliá el rango o verificá si fue auditado.
                  </div>
                </div>
              )}

              {/* ── 6. ¿El sistema mejora o empeora? ───────────────── */}
              <GraficoCalSemanal usuario={user1} auditados={auditados} />
            </>
          )}
        </>
      )}

      {/* ── MODO COMPARAR ──────────────────────────────────── */}
      {modo === 'comparar' && (
        <>
          <div className="metric-note metric-note-important">
            Seleccioná hasta 7 colaboradores para comparar su productividad, calidad y fricción en paralelo.
          </div>

          {/* Selectores de colaboradores */}
          <div className="card" style={{ padding:'1rem 1.25rem' }}>
            <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
              {compareUsers.map((selectedUser, index) => (
                <ColaboradorSelector
                  key={index}
                  search={compareSearches[index]}
                  onSearch={value => setCompareSearch(index, value)}
                  selectedUser={selectedUser}
                  onSelect={value => setCompareUser(index, value)}
                  usuarios={usuariosDisponiblesParaSlot(index)}
                  label={`Colaborador ${index + 1}${index > 1 ? ' (opcional)' : ''}`}
                />
              ))}
            </div>
            {selectedCompareCount > 0 && (
              <button className="btn" style={{ marginTop:'0.75rem' }}
                onClick={clearCompare}>
                ✕ Limpiar comparación
              </button>
            )}
          </div>

          {selectedCompareCount < 2 && (
            <EmptyState message="Seleccioná al menos 2 colaboradores para comparar." />
          )}

          {selectedCompareCount >= 2 && (
            <>
              {/* Insights automáticos */}
              {insights.length > 0 && (
                <div className="card">
                  <div className="card-header" style={{ marginBottom:'0.75rem' }}>
                    <div className="card-title">Hallazgos de la comparación</div>
                  </div>
                  <div style={{ display:'flex', flexDirection:'column', gap:'0.4rem' }}>
                    {insights.map((ins, i) => (
                      <div key={i} className={`alert-item ${ins.tipo==='atencion'?'alert-atencion':'alert-contexto'}`}>
                        <span>{ins.tipo==='atencion'?'🟡':'🔵'}</span>
                        <span style={{ fontSize:'0.82rem', color:'var(--text2)' }}>{ins.texto}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Columnas de comparación */}
              <div className="indiv-compare-grid" style={{
                display:'grid',
                gridTemplateColumns:`repeat(${selectedCompareCount}, minmax(210px, 1fr))`,
                gap:'0.75rem',
                overflowX:'auto',
                paddingBottom:'0.25rem',
              }}>
                {compareUsers.map((user, index) => ({ perfil: compareProfiles[index], user })).filter(x => x.user).map(({ perfil, user }) => (
                  <ColaboradorCol key={user} perfil={perfil || { usuario: user, perfilEq:null, finUser:null, audUser:null, holdUser:null }} />
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  )
}

function ComparCell({ personal, prom, fmt }) {
  if (prom == null) return <td style={{ color:'var(--text3)'}}>—</td>
  const ratio = prom > 0 ? personal / prom : null
  const color = ratio == null ? 'var(--text3)'
    : ratio >= 0.9 ? 'var(--green)' : ratio >= 0.7 ? 'var(--yellow)' : 'var(--red)'
  return (
    <td >
      <div style={{ color:'var(--text2)' }}>{fmt(Math.round(prom))}</div>
      {ratio != null && (
        <div style={{ fontSize:'0.68rem', color, fontWeight:600 }}>{Math.round(ratio*100)}%</div>
      )}
    </td>
  )
}
