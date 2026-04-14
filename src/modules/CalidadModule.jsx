import { useMemo, useState, useEffect } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, LineChart, Line, Cell, Legend } from 'recharts'
import { calcCalidadKPIs, calidadPorSemana, calidadPorUsuario, calidadPorAuditor, calidadPorDominio, calidadPorError, concentracionDesvios } from '../utils/metrics/calidadMetrics.js'
import { CALIDAD_LABELS, CALIDAD_COLORS } from '../utils/normalizers.js'
import { formatNumber } from '../utils/parsers.js'
import { COPY } from '../config/copy.js'
import { THRESHOLDS } from '../config/thresholds.js'
import { EmptyState, CustomTooltip, ExportCSVButton, CalidadBar, KPICard } from '../components/ui/index.jsx'
import { useTableSort, SortTh } from '../hooks/useTableSort.jsx'
import { formatCalidadColab, formatCalidadError, formatCalidadAuditor } from '../utils/exportUtils.js'

function PctCell({ val, total, type }) {
  const pct = total > 0 ? Math.round(val/total*100) : 0
  const color = type==='correcto'?'var(--green)':type==='desvio_grave'?'var(--red)':type==='desvio_leve'?'var(--yellow)':'var(--slate)'
  return <span style={{ color, fontWeight:600 }}>{val} <span style={{ color:'var(--text3)', fontWeight:400 }}>({pct}%)</span></span>
}

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
        <span style={{ fontSize:'0.72rem', color: available ? 'var(--text3)' : 'var(--text3)', fontWeight: available ? 400 : 600 }}>
          {available ? 'disponible' : 'sin datos en este período'}
        </span>
        {active && available && (
          <span style={{
            fontSize:'0.65rem', fontWeight:700, color:'#fff',
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

export function CalidadModule({ model, auditados, auditadosMao }) {
  const { calidadModel } = model
  const [fuente, setFuente] = useState('sdc')
  const [autoSwitched, setAutoSwitched] = useState(false)

  const hasSdc = (auditados?.length || 0) > 0
  const hasMao = (auditadosMao?.length || 0) > 0

  useEffect(() => {
    if (fuente === 'sdc' && !hasSdc && hasMao) {
      setFuente('mao')
      setAutoSwitched(true)
    } else if (fuente === 'mao' && !hasMao && hasSdc) {
      setFuente('sdc')
      setAutoSwitched(true)
    } else {
      setAutoSwitched(false)
    }
  }, [hasSdc, hasMao, fuente])

  const auditadosActivos = useMemo(() => {
    if (fuente === 'mao')       return auditadosMao || []
    if (fuente === 'combinado') return [...(auditados || []), ...(auditadosMao || [])]
    return auditados || []
  }, [fuente, auditados, auditadosMao])

  const kpis          = useMemo(() => calcCalidadKPIs(auditadosActivos), [auditadosActivos])
  const porUsuario    = useMemo(() => calidadPorUsuario(auditadosActivos), [auditadosActivos])
  const porAuditor_   = useMemo(() => calidadPorAuditor(auditadosActivos), [auditadosActivos])
  const porDominio    = useMemo(() => calidadPorDominio(auditadosActivos), [auditadosActivos])
  const porError_     = useMemo(() => calidadPorError(auditadosActivos), [auditadosActivos])
  const concentracion = useMemo(() => concentracionDesvios(auditadosActivos), [auditadosActivos])
  const porSemana     = useMemo(() => calidadPorSemana(auditadosActivos), [auditadosActivos])

  const { sorted: errorSorted, sortKey: errSortKey, sortDir: errSortDir, onSort: errOnSort } = useTableSort(porError_ || [], porError_ || [])
  const { sorted: auditorSorted, sortKey: audSortKey, sortDir: audSortDir, onSort: audOnSort } = useTableSort(porAuditor_ || [], porAuditor_ || [])
  const { sorted: usuarioSorted, sortKey: usuSortKey, sortDir: usuSortDir, onSort: usuOnSort } = useTableSort(porUsuario || [], porUsuario || [])

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

  if (!auditadosActivos?.length) return <EmptyState message={fuente === 'mao' ? 'No hay datos MAO para este corte. Cambiá la fuente o el período.' : 'No hay datos SdC para este corte. Cambiá la fuente o el período.'} />
  if (!kpis) return <EmptyState message={COPY.empty} />

    const prevKpis = fuente === 'sdc' ? calidadModel?.prevKpis : null

  const efPct     = Math.round(kpis.efectividadSug * 100)
  const efCasoPct = Math.round(kpis.efectividadCaso * 100)
  const efColor   = efPct>=90?'var(--green)':efPct>=80?'var(--yellow)':'var(--red)'
  const gapPp     = Math.abs(efPct - efCasoPct)

  // Vocabulario dinámico según fuente
  const vocab = fuente === 'sdc' ? {
    unidad:         'sugerencia',
    unidades:       'sugerencias',
    unidadCap:      'Sugerencia',
    labelPrincipal: 'Sugerencias correctas',
    labelGraves:    'Errores graves',
    subGraves:      (pct) => `${pct}% del total. Requieren acción inmediata.`,
    mostrarCasos:   true,
    mostrarComposicion: true,
    labelDistribucion: 'Distribución — por sugerencia_id',
    subDistribucion: 'Muestra dónde se concentra el error. Por sugerencia_id (métrica principal).',
    colHeader:      'Sugs',
  } : fuente === 'mao' ? {
    unidad:         'acción',
    unidades:       'acciones',
    unidadCap:      'Acción',
    labelPrincipal: 'Acciones correctas',
    labelGraves:    'Acciones con error grave',
    subGraves:      (pct) => `${pct}% del total. Requieren revisión inmediata.`,
    mostrarCasos:   false,
    mostrarComposicion: false,
    labelDistribucion: 'Distribución — por acción auditada',
    subDistribucion: 'Muestra dónde se concentra el error en las acciones MAO.',
    colHeader:      'Acc.',
  } : {
    // Combinado
    unidad:         'registro',
    unidades:       'registros',
    unidadCap:      'Registro',
    labelPrincipal: 'Registros correctos',
    labelGraves:    'Errores graves',
    subGraves:      (pct) => `${pct}% del total combinado (SdC + MAO).`,
    mostrarCasos:   false,
    mostrarComposicion: false,
    labelDistribucion: 'Distribución — SdC + MAO combinado',
    subDistribucion: 'Vista unificada de ambas fuentes de auditoría.',
    colHeader:      'Reg.',
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
      <div style={{
        display:'grid', gridTemplateColumns: hasSdc && hasMao ? '1fr 1fr' : '1fr',
        gap:'0.5rem',
      }}>
        <FuenteStatus
          label="SdC"
          available={hasSdc}
          active={fuente === 'sdc' || fuente === 'combinado'}
          count={auditados?.length || 0}
        />
        {(hasMao || !hasSdc) && (
          <FuenteStatus
            label="MAO"
            available={hasMao}
            active={fuente === 'mao' || fuente === 'combinado'}
            count={auditadosMao?.length || 0}
          />
        )}
      </div>

      {autoSwitched && (
        <div style={{
          display:'flex', alignItems:'flex-start', gap:'0.6rem',
          padding:'0.6rem 0.85rem',
          background:'rgba(251,146,60,0.08)', border:'1px solid rgba(251,146,60,0.3)',
          borderRadius:'var(--radius-sm)', fontSize:'0.78rem', color:'#fb923c',
        }}>
          <span style={{ fontWeight:700, flexShrink:0, marginTop:1 }}>↻</span>
          <span>
            <strong>Mostrando {fuente === 'mao' ? 'MAO' : 'SdC'}</strong> — no hay datos de {fuente === 'mao' ? 'SdC' : 'MAO'} en este período.
            {' '}<span style={{ color:'var(--text3)' }}>Cambiá el período si necesitás ver la otra fuente.</span>
          </span>
        </div>
      )}
      <div className="metric-note">
        📊 {COPY.modules.calidadPrincipal}
      </div>

      {/* Estado general */}
      <div className="grid grid-4">
        <div className="card" style={{ gridColumn: 'span 1' }}>
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
            <div style={{ fontSize:'0.72rem', color:'var(--text3)', marginBottom:'0.3rem' }}>Define cómo se interpreta la calidad. Si cambia, la lectura cambia.</div>
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

      {/* Distribución */}
      <div className="card">
        <div className="card-header">
          <div className="card-title">{vocab.labelDistribucion}</div>
          <div className="card-subtitle">{vocab.subDistribucion}</div>
        </div>
        <div style={{ display:'flex', gap:'1rem', flexWrap:'wrap' }}>
          {Object.entries(kpis.bySug||{}).filter(([,v])=>v>0).map(([cat,val])=>(
            <div key={cat} style={{ background:'var(--bg3)', border:`1px solid ${CALIDAD_COLORS[cat]}40`, borderLeft:`3px solid ${CALIDAD_COLORS[cat]}`, borderRadius:'var(--radius-sm)', padding:'0.5rem 0.85rem', minWidth:130 }}>
              <div style={{ fontSize:'0.7rem', color:'var(--text3)', marginBottom:'0.1rem' }}>{CALIDAD_LABELS[cat]}</div>
              <div style={{ fontSize:'1.2rem', fontWeight:700, color:CALIDAD_COLORS[cat] }}>{formatNumber(val)}</div>
              <div style={{ fontSize:'0.7rem', color:'var(--text3)' }}>{kpis.totalSugs>0?Math.round(val/kpis.totalSugs*100):0}%</div>
            </div>
          ))}
        </div>
      </div>

      {/* Concentración de errores */}
      {concentracion && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Concentración de errores</div>
              <div className="card-subtitle">Define si el problema es focalizado o sistémico. Si los top 3 explican más del 60% de los desvíos, la acción es clara.</div>
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

      {/* Evolución con target */}
      {porSemana.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div className="card-title">¿El sistema mejora o empeora?</div>
            <div className="card-subtitle">Línea roja = target 90%. Si un patrón crece sostenidamente, ya es riesgo aunque no sea lo más grande.</div>
          </div>
          <ResponsiveContainer width="100%" height={210}>
            <LineChart data={porSemana} margin={{ top:5, right:10, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="week" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={v=>`S${v}`} />
              <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} domain={[0.5,1]} tickFormatter={v=>`${Math.round(v*100)}%`} />
              <Tooltip content={<CustomTooltip valueFormatter={v=>`${Math.round(v*100)}%`} labelFormatter={v=>`Semana ${v}`} />} />
              <Legend wrapperStyle={{ fontSize:'0.75rem', color:'var(--text3)' }} />
              <Line type="monotone" dataKey={()=>0.9} name="Target 90%" stroke="var(--red)" strokeWidth={1} strokeDasharray="4 2" dot={false} legendType="none" />
              <Line type="monotone" dataKey="efectividadSug" name={fuente === 'sdc' ? 'Por sugerencia_id (principal)' : fuente === 'mao' ? 'Acciones correctas' : 'Registros correctos'} stroke="var(--green)" strokeWidth={2} dot={{ r:3 }} />
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
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={porDominio.slice(0,10)} layout="vertical" margin={{ top:0, right:10, left:0, bottom:0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:10 }} tickFormatter={v=>`${Math.round(v*100)}%`} domain={[0,1]} />
                <YAxis type="category" dataKey="dominio" tick={{ fill:'var(--text3)', fontSize:10 }} width={130} />
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
                <div className="card-subtitle">Volumen y resultados por auditor. El volumen afecta la representatividad.</div>
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

      {/* Por colaborador */}
      {porUsuario?.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Calidad por colaborador</div>
              <div className="card-subtitle">{fuente === 'sdc' ? 'Principal: por sugerencia_id · Contextual: por id_caso (columnas grises)' : fuente === 'mao' ? 'Efectividad por acción auditada' : 'Efectividad combinada SdC + MAO'}</div>
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

      {/* Acciones */}
      <div className="card">
        <div className="card-header" style={{ marginBottom:'0.75rem' }}>
          <div className="card-title">Acciones sugeridas</div>
          <span className="badge badge-slate" style={{ fontSize:'0.65rem' }}>Si no dispara una revisión concreta, el análisis quedó incompleto.</span>
        </div>
        <ul style={{ listStyle:'none', display:'flex', flexDirection:'column', gap:'0.5rem' }}>
          {acciones.map((a,i)=>(
            <li key={i} style={{ fontSize:'0.82rem', color:'var(--text2)', padding:'0.5rem 0.75rem', borderLeft:'2px solid var(--border2)', lineHeight:1.5 }}>{a}</li>
          ))}
        </ul>
      </div>
    </div>
  )
}
