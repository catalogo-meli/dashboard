import { useMemo, useState } from 'react'
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ComposedChart, Line } from 'recharts'
import { formatNumber } from '../utils/parsers.js'
import { COPY } from '../config/copy.js'
import { THRESHOLDS } from '../config/thresholds.js'
import { KPICard, EmptyState, CustomTooltip, ExportCSVButton } from '../components/ui/index.jsx'
import { formatHoldHistorico, formatHoldSnapshot } from '../utils/exportUtils.js'
import { useTableSort, SortTh } from '../hooks/useTableSort.jsx'
import { useGitHubFileDate } from '../hooks/useGitHubFileDate.js'

const INC_COLORS = ['#ef4444','#f97316','#f59e0b','#eab308','#84cc16','#22c55e','#14b8a6','#06b6d4']

function diasATexto(dias) {
  if (dias == null) return '—'
  if (dias === 0) return 'menos de 1 día'
  if (dias === 1) return '1 día'
  if (dias <= 7) return `${dias} días`
  const semanas = Math.round(dias / 7)
  return `${semanas} semana${semanas > 1 ? 's' : ''}`
}

function interpretarLeadTime(p50) {
  if (p50 == null) return null
  if (p50 <= 1) return { texto: 'Rápido — la mayoría se resuelve en 1 día', color: 'var(--green)' }
  if (p50 <= 3) return { texto: `Aceptable — la mitad se resuelve en ${diasATexto(p50)}`, color: 'var(--green)' }
  if (p50 <= 7) return { texto: `Moderado — la mitad tarda ${diasATexto(p50)} en resolverse`, color: 'var(--yellow)' }
  return { texto: `Lento — la mitad tarda más de ${diasATexto(p50)}. Revisá dependencias sistémicas.`, color: 'var(--red)' }
}

function SubTab({ label, active, onClick, badge }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '0.45rem 1.1rem',
        fontSize: '0.82rem',
        fontWeight: active ? 700 : 400,
        color: active ? 'var(--text)' : 'var(--text3)',
        background: active ? 'var(--bg3)' : 'transparent',
        border: 'none',
        borderBottom: active ? '2px solid var(--accent)' : '2px solid transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        gap: '0.4rem',
        transition: 'color 0.15s',
      }}
    >
      {label}
      {badge != null && (
        <span style={{
          background: 'var(--red)', color: '#fff',
          borderRadius: '99px', fontSize: '0.65rem',
          padding: '1px 6px', fontWeight: 700,
        }}>{badge}</span>
      )}
    </button>
  )
}

export function FriccionModule({ model, holdSnapshot, holdLoadedAt, historicoCompleto, filters }) {
  const { friccionModel, prodModel } = model
  if (!friccionModel) return <EmptyState message={COPY.empty} />

  const [subTab, setSubTab] = useState('historico')
  const [granBloqueos, setGranBloqueos] = useState('semanal')

  // Fecha real del CSV desde GitHub (repo público)
  const { date: holdCsvDate } = useGitHubFileDate(
    'catalogo-meli', 'dashboard', 'public/data/hold.csv'
  )

  const { kpisHold, leadTime, holdSem, snapshot } = friccionModel

  const holdRate = kpisHold && prodModel?.kpis?.totalTareas > 0
    ? Math.round(kpisHold.idsUnicos / prodModel.kpis.totalTareas * 100) : null

  // Agrupaciones alternativas para gráfico de evolución de bloqueos
  const bloqueosDiario = useMemo(() => {
    const hist = model?.filteredHistorico || []
    const map = new Map()
    for (const r of hist) {
      if (r.status !== 'HOLD' || !r.fechaKey) continue
      if (!map.has(r.fechaKey)) map.set(r.fechaKey, { key: r.fechaKey, total: 0, setIds: new Set() })
      const e = map.get(r.fechaKey)
      e.total += 1
      if (r.idLink) e.setIds.add(r.idLink)
    }
    return [...map.values()]
      .map(e => ({ key: e.key, total: e.total, idsUnicos: e.setIds.size }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [model?.filteredHistorico])

  const bloqueosMensual = useMemo(() => {
    const hist = model?.filteredHistorico || []
    const map = new Map()
    for (const r of hist) {
      if (r.status !== 'HOLD' || !r.fecha) continue
      const mes = `${r.fecha.getFullYear()}-${String(r.fecha.getMonth()+1).padStart(2,'0')}`
      if (!map.has(mes)) map.set(mes, { key: mes, total: 0, setIds: new Set() })
      const e = map.get(mes)
      e.total += 1
      if (r.idLink) e.setIds.add(r.idLink)
    }
    return [...map.values()]
      .map(e => ({ key: e.key, total: e.total, idsUnicos: e.setIds.size }))
      .sort((a, b) => a.key.localeCompare(b.key))
  }, [model?.filteredHistorico])

  const bloqueosData = granBloqueos === 'diario' ? bloqueosDiario
    : granBloqueos === 'mensual' ? bloqueosMensual
    : holdSem.map(s => ({ key: String(s.week), total: s.total, idsUnicos: s.idsUnicos }))

  const topIncidencias = Object.entries(kpisHold.byIncidencia || {}).sort((a,b)=>b[1]-a[1]).slice(0,10)
  const byFlujoData    = Object.entries(kpisHold.byFlujo || {}).map(([flujo,total])=>({flujo,total})).sort((a,b)=>b.total-a.total)
  const byUsuarioData  = Object.entries(kpisHold.byUsuario || {}).map(([usuario,total])=>({usuario,total})).sort((a,b)=>b.total-a.total)
  const leadInterpret  = leadTime ? interpretarLeadTime(leadTime.stats.p50) : null

  // Enriquecer snapshot con equipo + días en HOLD
  // Usa historicoCompleto (sin filtro de fecha) para cálculo preciso de diasEnHold
  const equipoMap = model.equipoMap
  const histBase  = historicoCompleto || model.filteredHistorico || []
  const snapshotEnriquecido = useMemo(() => {
    if (!holdSnapshot?.length) return []
    const primerHoldMap = new Map()
    for (const r of histBase) {
      if (r.status !== 'HOLD' || !r.idLink || !r.usuario) continue
      const key = `${r.usuario}||${r.idLink}`
      const prev = primerHoldMap.get(key)
      if (!prev || r.fecha < prev) primerHoldMap.set(key, r.fecha)
    }
    const hoy = new Date()
    return holdSnapshot.map(r => {
      const eq = equipoMap?.get(r.usuario)
      const key = `${r.usuario}||${r.idLink}`
      const primeraFechaHold = primerHoldMap.get(key)
      const diasEnHold = primeraFechaHold
        ? Math.max(0, Math.floor((hoy - primeraFechaHold) / (1000 * 60 * 60 * 24)))
        : null
      return {
        ...r,
        equipoNombre: eq?.equipo ?? 'Fuera de padrón actual',
        rol: eq?.rol ?? 'No informado',
        diasEnHold,
      }
    })
  }, [holdSnapshot, equipoMap, histBase])

  // Fecha de última actualización: primero intenta la fecha real del commit de GitHub,
  // si no está disponible aún usa la hora de carga del browser como fallback
  const snapshotFecha = useMemo(() => {
    const ref = holdCsvDate || holdLoadedAt
    if (!ref) return null
    return ref.toLocaleDateString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        weekday: 'short', day: 'numeric', month: 'short',
      }) + ' · ' + ref.toLocaleTimeString('es-AR', {
        timeZone: 'America/Argentina/Buenos_Aires',
        hour: '2-digit', minute: '2-digit', hour12: false,
      })
  }, [holdCsvDate, holdLoadedAt])

  const snapshotTotal = snapshot?.total ?? 0

  // Snapshot filtrado usando los filtros globales del dashboard
  const snapshotFiltrado = useMemo(() => snapshotEnriquecido.filter(r => {
    if (filters?.equipo  && r.equipoNombre !== filters.equipo)  return false
    if (filters?.flujo   && r.flujo        !== filters.flujo)   return false
    if (filters?.usuario && r.usuario      !== filters.usuario) return false
    return true
  }), [snapshotEnriquecido, filters?.equipo, filters?.flujo, filters?.usuario])

  // KPIs de días en HOLD sobre snapshot filtrado
  const diasKpis = useMemo(() => {
    const conDias = snapshotFiltrado.filter(r => r.diasEnHold != null)
    if (!conDias.length) return null
    const dias = conDias.map(r => r.diasEnHold)
    const promedio = Math.round(dias.reduce((s, d) => s + d, 0) / dias.length)
    const maximo   = Math.max(...dias)
    const mas7     = dias.filter(d => d > 7).length
    const mas14    = dias.filter(d => d > 14).length
    return { promedio, maximo, mas7, mas14, total: snapshotFiltrado.length }
  }, [snapshotFiltrado])

  const hayFiltrosSnap = filters?.equipo || filters?.flujo || filters?.usuario

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      <div className="metric-note">⚡ {COPY.modules.friccionQue}</div>

      {/* ── Sub-tabs ─────────────────────────────────────────── */}
      <div style={{
        display: 'flex',
        borderBottom: '1px solid var(--border)',
        gap: 0,
      }}>
        <SubTab label="📈 Histórico" active={subTab === 'historico'} onClick={() => setSubTab('historico')} />
        <SubTab
          label="📸 Estado actual"
          active={subTab === 'snapshot'}
          onClick={() => setSubTab('snapshot')}
          badge={snapshotTotal > 0 ? snapshotTotal : null}
        />
      </div>

      {/* ══════════════════════════════════════════════════════
          SUB-TAB: HISTÓRICO
      ══════════════════════════════════════════════════════ */}
      {subTab === 'historico' && (
        <>
          {/* KPIs */}
          <div className="grid grid-4">
            <KPICard label="Registros en HOLD" value={formatNumber(kpisHold.totalRegistros)}
              sub="Total de registros con status HOLD en el período."
              icon="⏸️" color="var(--red)" />
            <KPICard label="IDs únicos en espera" value={formatNumber(kpisHold.idsUnicos)}
              sub="Productos distintos que pasaron por HOLD. Cada uno se cuenta una sola vez."
              icon="🔑" color="var(--yellow)" />
            {holdRate != null && (
              <KPICard label="% en espera (HOLD relativo)" value={`${holdRate}%`}
                sub="IDs en HOLD sobre total de tareas. Si sube, la operación pierde fluidez."
                icon="📊"
                color={holdRate > THRESHOLDS.friccion.holdRelativo.warn*100 ? 'var(--red)'
                  : holdRate > THRESHOLDS.friccion.holdRelativo.ok*100 ? 'var(--yellow)' : 'var(--green)'} />
            )}
            {leadTime?.stats.total > 0 && (
              <KPICard
                label="Tiempo típico de resolución"
                value={diasATexto(leadTime.stats.p50)}
                sub={`La mitad de los bloqueos se resuelven en ${diasATexto(leadTime.stats.p50)} o menos. El 25% más lento tarda más de ${diasATexto(leadTime.stats.p75)}.`}
                icon="⏱"
                color={leadInterpret?.color || 'var(--text3)'} />
            )}
          </div>

          {/* Lead time detallado */}
          {leadTime?.stats.total > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">¿Cuánto tardan los bloqueos en resolverse?</div>
                  <div className="card-subtitle">
                    {formatNumber(leadTime.stats.total)} ciclos cerrados ·{' '}
                    {formatNumber(leadTime.sinCierre)} todavía sin cierre en el período
                  </div>
                </div>
              </div>
              {leadInterpret && (
                <div style={{
                  background: 'var(--bg3)', border: `1px solid ${leadInterpret.color}40`,
                  borderLeft: `3px solid ${leadInterpret.color}`,
                  borderRadius: 'var(--radius-sm)', padding: '0.65rem 0.85rem',
                  fontSize: '0.82rem', color: leadInterpret.color, fontWeight: 600,
                  marginBottom: '1rem',
                }}>
                  {leadInterpret.texto}
                </div>
              )}
              <div className="grid grid-4" style={{ marginBottom: '1rem' }}>
                {[
                  { label: 'La mitad se resuelve en', val: diasATexto(leadTime.stats.p50), sub: '50% de los casos cerrados', color: leadTime.stats.p50 <= 3 ? 'var(--green)' : leadTime.stats.p50 <= 7 ? 'var(--yellow)' : 'var(--red)' },
                  { label: '3 de cada 4 resueltos en', val: diasATexto(leadTime.stats.p75), sub: '75% de los casos cerrados', color: leadTime.stats.p75 <= 7 ? 'var(--green)' : leadTime.stats.p75 <= 14 ? 'var(--yellow)' : 'var(--red)' },
                  { label: 'Tiempo promedio', val: diasATexto(leadTime.stats.promedio), sub: 'Puede estar inflado por casos extremos', color: 'var(--text3)' },
                ].map(({ label, val, sub, color }) => (
                  <div key={label} style={{ background:'var(--bg3)', borderRadius:'var(--radius-sm)', padding:'0.6rem 0.85rem' }}>
                    <div style={{ fontSize:'0.68rem', color:'var(--text3)', marginBottom:2 }}>{label}</div>
                    <div style={{ fontSize:'1.1rem', fontWeight:700, color }}>{val}</div>
                    <div style={{ fontSize:'0.65rem', color:'var(--text3)' }}>{sub}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolución de bloqueos con granularidad */}
          {holdSem.length > 0 && (
            <div className="card">
              <div className="card-header">
                <div>
                  <div className="card-title">Evolución de bloqueos</div>
                  <div className="card-subtitle">Si sube sostenidamente, hay dependencias sistémicas sin resolver.</div>
                </div>
                <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
                  {['diario','semanal','mensual'].map(g => (
                    <button key={g}
                      onClick={() => setGranBloqueos(g)}
                      style={{
                        padding:'0.25rem 0.7rem', fontSize:'0.72rem', fontWeight: granBloqueos===g ? 700 : 400,
                        background: granBloqueos===g ? 'var(--accent)' : 'transparent',
                        color: granBloqueos===g ? '#fff' : 'var(--text2)',
                        border:'none', cursor:'pointer', borderRight:'1px solid var(--border)',
                        textTransform:'capitalize',
                      }}
                    >{g.charAt(0).toUpperCase() + g.slice(1)}</button>
                  ))}
                </div>
              </div>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart data={bloqueosData} margin={{ top:5, right:10, left:0, bottom:5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="key" tick={{ fill:'var(--text3)', fontSize:11 }}
                    tickFormatter={v => granBloqueos === 'semanal' ? `Sem ${v}` : granBloqueos === 'diario' ? v?.slice(5)||v : v} />
                  <YAxis tick={{ fill:'var(--text3)', fontSize:11 }} />
                  <Tooltip content={<CustomTooltip
                    labelFormatter={v => granBloqueos === 'semanal' ? `Semana ${v}` : v}
                    valueFormatter={formatNumber} />} />
                  <Bar dataKey="total" name="Registros HOLD" fill="#ef4444" radius={[3,3,0,0]} />
                  <Bar dataKey="idsUnicos" name="IDs únicos en HOLD" fill="#f97316" radius={[3,3,0,0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}

          {/* Distribución */}
          <div className="grid grid-2">
            {byFlujoData.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom:'0.5rem' }}>Origen de bloqueos por flujo</div>
                <div className="card-subtitle" style={{ marginBottom:'0.75rem' }}>Priorizá el flujo con más registros.</div>
                <ResponsiveContainer width="100%" height={200}>
                  <BarChart data={byFlujoData} layout="vertical" margin={{ top:0, right:10, left:0, bottom:0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
                    <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:10 }} tickFormatter={formatNumber} />
                    <YAxis type="category" dataKey="flujo" tick={{ fill:'var(--text3)', fontSize:10 }} width={110} />
                    <Tooltip content={<CustomTooltip valueFormatter={formatNumber} />} />
                    <Bar dataKey="total" name="Registros HOLD" fill="#f97316" radius={[0,3,3,0]} />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
            {topIncidencias.length > 0 && (
              <div className="card">
                <div className="card-title" style={{ marginBottom:'0.5rem' }}>Motivos de bloqueo (top 10)</div>
                <div className="card-subtitle" style={{ marginBottom:'0.75rem' }}>Alta concentración en pocos motivos = acción focalizada posible.</div>
                <div className="table-wrap">
                  <table>
                    <thead><tr><th>Motivo</th><th>Registros</th><th>%</th></tr></thead>
                    <tbody>
                      {topIncidencias.map(([inc,cnt],i)=>(
                        <tr key={inc}>
                          <td>
                            <span style={{ width:8,height:8,borderRadius:'50%',background:INC_COLORS[i%INC_COLORS.length],display:'inline-block',marginRight:6 }}/>
                            {inc}
                          </td>
                          <td className="num bold">{formatNumber(cnt)}</td>
                          <td className="num" style={{ color:'var(--text3)' }}>
                            {kpisHold.totalRegistros>0 ? Math.round(cnt/kpisHold.totalRegistros*100) : 0}%
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>

          {/* Bloqueos por colaborador — con ordenamiento */}
          {byUsuarioData.length > 0 && (
            <ColaboradoresHoldTable data={byUsuarioData} totalRegistros={kpisHold.totalRegistros} />
          )}
        </>
      )}

      {/* ══════════════════════════════════════════════════════
          SUB-TAB: ESTADO ACTUAL (SNAPSHOT)
      ══════════════════════════════════════════════════════ */}
      {subTab === 'snapshot' && (
        <>
          {/* Banner */}
          <div className="snapshot-banner">
            <span className="snapshot-icon">📸</span>
            <div>
              <div style={{ fontWeight:600, fontSize:'0.82rem' }}>Vista de estado actual</div>
              <div style={{ fontSize:'0.75rem', color:'var(--text3)' }}>
                {COPY.modules.holdSnapshot}
                {snapshotFecha && (
                  <span> {holdCsvDate ? 'Subido al repo:' : 'Última carga:'} {snapshotFecha}.</span>
                )}
              </div>
            </div>
          </div>

          {snapshot && snapshot.total > 0 ? (
            <>
              {/* ── Resumen filtrado ── */}
              {hayFiltrosSnap && (
                <div style={{ fontSize:'0.75rem', color:'var(--text3)', padding:'0.3rem 0' }}>
                  Mostrando {snapshotFiltrado.length} de {snapshotEnriquecido.length} tareas según los filtros activos.
                </div>
              )}

              {/* ── KPIs globales ── */}
              <div className="grid grid-4">
                <KPICard label="Tareas en HOLD" value={formatNumber(snapshotFiltrado.length)}
                  sub={hayFiltrosSnap ? 'Con los filtros aplicados.' : 'Tareas que no pueden cerrarse sin acción externa.'}
                  icon="🔴" color="var(--red)" />
                {diasKpis && (<>
                  <KPICard label="Promedio días en HOLD" value={`${diasKpis.promedio}d`}
                    sub={`Tiempo promedio que llevan en espera las ${diasKpis.total} tareas con dato disponible.`}
                    icon="⏱"
                    color={diasKpis.promedio > 14 ? 'var(--red)' : diasKpis.promedio > 7 ? 'var(--yellow)' : 'var(--green)'} />
                  <KPICard label="Caso más largo" value={`${diasKpis.maximo}d`}
                    sub="La tarea que lleva más tiempo en HOLD."
                    icon="⚠️"
                    color={diasKpis.maximo > 14 ? 'var(--red)' : 'var(--yellow)'} />
                  <KPICard label="Más de 7 días" value={formatNumber(diasKpis.mas7)}
                    sub={`${diasKpis.mas14} llevan más de 14 días. Requieren atención urgente.`}
                    icon="🕐"
                    color={diasKpis.mas14 > 0 ? 'var(--red)' : diasKpis.mas7 > 0 ? 'var(--yellow)' : 'var(--green)'} />
                </>)}
              </div>

              {/* ── Tabla detallada ── */}
              <HoldTable snapshotEnriquecido={snapshotFiltrado} snapshotFecha={snapshotFecha} />
            </>
          ) : (
            <div className="card">
              <div className="empty-state">Sin datos de HOLD activo. El archivo hold.csv puede estar vacío o no cargado.</div>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function ColaboradoresHoldTable({ data, totalRegistros }) {
  const dataEnriquecida = useMemo(() =>
    data.map(r => ({ ...r, pct: totalRegistros > 0 ? Math.round(r.total / totalRegistros * 100) : 0 }))
  , [data, totalRegistros])

  const { sorted, sortKey, sortDir, onSort } = useTableSort(dataEnriquecida, dataEnriquecida)

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Bloqueos por colaborador</div>
          <div className="card-subtitle">Alta concentración puede indicar tipo de tarea o flujo asignado, no necesariamente un problema individual.</div>
        </div>
        <ExportCSVButton data={formatHoldHistorico(data, totalRegistros)} filename="hold_historico_colaboradores.csv" />
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>#</th>
              <SortTh colKey="usuario" label="Colaborador" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh colKey="total" label="Registros HOLD" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              <SortTh colKey="pct" label="% del total" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
            </tr>
          </thead>
          <tbody>
            {sorted.map((r,i)=>(
              <tr key={r.usuario}>
                <td style={{ color:'var(--text3)' }}>{i+1}</td>
                <td className="bold">{r.usuario}</td>
                <td>{formatNumber(r.total)}</td>
                <td style={{ color:'var(--yellow)' }}>{r.pct}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

const PAGE_SIZE = 25

function HoldTable({ snapshotEnriquecido, snapshotFecha }) {
  const [page, setPage] = useState(0)
  const [copied, setCopied] = useState(null)

  const { sorted, sortKey, sortDir, onSort } = useTableSort(snapshotEnriquecido, snapshotEnriquecido)

  const total = sorted.length
  const totalPages = Math.ceil(total / PAGE_SIZE)
  const pageData = sorted.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE)

  function copyId(id) {
    if (!id) return
    navigator.clipboard.writeText(String(id)).then(() => {
      setCopied(id)
      setTimeout(() => setCopied(null), 1500)
    })
  }

  // Reset page when sort changes
  const handleSort = (key) => { onSort(key); setPage(0) }

  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Detalle — tareas en HOLD ahora</div>
          <div className="card-subtitle">
            {total} {total === 1 ? 'tarea' : 'tareas'} en HOLD.
            {snapshotFecha && ` Foto tomada: ${snapshotFecha}.`}
            {' '}Hacé click en el ID para copiarlo.
          </div>
        </div>
        <div style={{ display:'flex', gap:'0.5rem', alignItems:'center' }}>
          <ExportCSVButton data={formatHoldSnapshot(sorted)} filename="hold_activo_snapshot.csv" />
          <span className="badge badge-yellow">Foto actual</span>
        </div>
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <SortTh colKey="usuario"      label="Colaborador"    sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh colKey="equipoNombre" label="Equipo"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh colKey="flujo"        label="Flujo"          sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th>ID</th>
              <SortTh colKey="incidencia"   label="Motivo"         sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh colKey="idsTC"        label="IDs"            sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <SortTh colKey="diasEnHold"   label="Días en HOLD"   sortKey={sortKey} sortDir={sortDir} onSort={handleSort} />
              <th>Comentarios</th>
            </tr>
          </thead>
          <tbody>
            {pageData.map((r, i) => {
              const idText = r.idLink
                ? (r.idLink.split('/').filter(Boolean).pop() || r.idLink)
                : (r.id || r.idTask || null)
              const isCopied = copied === (idText || r.idLink)
              return (
                <tr key={i}>
                  <td className="bold">{r.usuario}</td>
                  <td style={{ fontSize:'0.75rem', color:'var(--text3)' }}>{r.equipoNombre || '—'}</td>
                  <td>{r.flujo}</td>
                  <td>
                    {idText ? (
                      <span
                        onClick={() => copyId(idText)}
                        title="Click para copiar ID"
                        style={{
                          fontSize:'0.72rem', fontFamily:'monospace',
                          cursor:'pointer', padding:'2px 6px', borderRadius:'4px',
                          background: isCopied ? 'var(--green-dim, rgba(34,197,94,0.15))' : 'var(--bg3)',
                          color: isCopied ? 'var(--green)' : 'var(--text2)',
                          userSelect:'all', display:'inline-block',
                          transition:'background 0.2s, color 0.2s',
                        }}
                      >
                        {isCopied ? '✓ copiado' : idText}
                      </span>
                    ) : '—'}
                  </td>
                  <td>{r.incidencia ? <span className="badge badge-yellow">{r.incidencia}</span> : '—'}</td>
                  <td>{r.idsTC}</td>
                  <td style={{ fontVariantNumeric:'tabular-nums', color: r.diasEnHold != null ? (r.diasEnHold > 14 ? 'var(--red)' : r.diasEnHold > 7 ? 'var(--yellow)' : 'var(--text2)') : 'var(--text3)' }}>
                    {r.diasEnHold != null ? `${r.diasEnHold}d` : '—'}
                  </td>
                  <td style={{ fontSize:'0.72rem', color:'var(--text3)', maxWidth:200, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}
                      title={r.comentarios || ''}>
                    {r.comentarios || '—'}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div style={{ display:'flex', alignItems:'center', justifyContent:'space-between', padding:'0.6rem 0.75rem', borderTop:'1px solid var(--border)', fontSize:'0.78rem', color:'var(--text3)' }}>
          <span>Mostrando {page * PAGE_SIZE + 1}–{Math.min((page + 1) * PAGE_SIZE, total)} de {total}</span>
          <div style={{ display:'flex', gap:'0.3rem', alignItems:'center' }}>
            <button onClick={() => setPage(0)} disabled={page === 0} style={{ padding:'2px 8px', fontSize:'0.75rem', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--bg2)', cursor: page===0 ? 'default' : 'pointer', opacity: page===0 ? 0.4 : 1 }}>«</button>
            <button onClick={() => setPage(p => Math.max(0, p - 1))} disabled={page === 0} style={{ padding:'2px 8px', fontSize:'0.75rem', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--bg2)', cursor: page===0 ? 'default' : 'pointer', opacity: page===0 ? 0.4 : 1 }}>‹</button>
            <span style={{ padding:'0 6px', color:'var(--text2)' }}>Pág. {page + 1} / {totalPages}</span>
            <button onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))} disabled={page === totalPages - 1} style={{ padding:'2px 8px', fontSize:'0.75rem', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--bg2)', cursor: page===totalPages-1 ? 'default' : 'pointer', opacity: page===totalPages-1 ? 0.4 : 1 }}>›</button>
            <button onClick={() => setPage(totalPages - 1)} disabled={page === totalPages - 1} style={{ padding:'2px 8px', fontSize:'0.75rem', border:'1px solid var(--border)', borderRadius:'4px', background:'var(--bg2)', cursor: page===totalPages-1 ? 'default' : 'pointer', opacity: page===totalPages-1 ? 0.4 : 1 }}>»</button>
          </div>
        </div>
      )}
    </div>
  )
}
