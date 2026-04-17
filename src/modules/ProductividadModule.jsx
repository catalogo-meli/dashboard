import { useMemo, useState } from 'react'
import {
  ComposedChart, Bar, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend,
} from 'recharts'
import { formatNumber } from '../utils/parsers.js'
import { COPY } from '../config/copy.js'
import { delta, deltaLabel, deltaColor } from '../utils/metrics/comparisonMetrics.js'
import { EmptyState, CustomTooltip, ExportCSVButton } from '../components/ui/index.jsx'
import { useTableSort, SortTh } from '../hooks/useTableSort.jsx'
import { formatProductividadColab } from '../utils/exportUtils.js'

const FLUJO_COLORS = {
  'Demanda':'#6366f1','Enhancement':'#38bdf8','Enhanced Content':'#a78bfa',
  'Soporte':'#fb923c','Fallos':'#ef4444','Validación':'#22c55e',
}

function agruparPorDia(historico) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (!r.fechaKey) continue
    if (!map.has(r.fechaKey)) map.set(r.fechaKey, { key: r.fechaKey, totalTareas: 0, totalIds: 0 })
    const e = map.get(r.fechaKey)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function agruparPorMes(historico) {
  const map = new Map()
  for (const r of (historico || [])) {
    if (!r.fecha) continue
    const mes = `${r.fecha.getFullYear()}-${String(r.fecha.getMonth() + 1).padStart(2, '0')}`
    if (!map.has(mes)) map.set(mes, { key: mes, totalTareas: 0, totalIds: 0 })
    const e = map.get(mes)
    e.totalTareas += 1
    e.totalIds    += r.idsTC ?? 1
  }
  return [...map.values()].sort((a, b) => a.key.localeCompare(b.key))
}

function GranularidadToggle({ value, onChange, disabled }) {
  const opts = [
    { id: 'diario',  label: 'Diario' },
    { id: 'semanal', label: 'Semanal' },
    { id: 'mensual', label: 'Mensual' },
  ]
  return (
    <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
      {opts.map(o => (
        <button key={o.id}
          onClick={() => onChange(o.id)}
          style={{
            padding:'0.25rem 0.75rem', fontSize:'0.72rem', fontWeight: value===o.id ? 700 : 400,
            background: value===o.id ? 'var(--accent)' : 'transparent',
            color: value===o.id ? '#fff' : 'var(--text2)',
            border:'none', cursor:'pointer',
            borderRight:'1px solid var(--border)',
          }}
        >{o.label}</button>
      ))}
    </div>
  )
}

function tareasDiaColor(v) {
  if (v == null) return 'var(--text)'
  if (v >= 90) return 'var(--green)'
  if (v >= 80) return 'var(--yellow)'
  return 'var(--red)'
}

export function ProductividadModule({ model }) {
  const { prodModel } = model
  if (!prodModel) return <EmptyState message={COPY.empty} />

  const { kpis, semanas, ranking, top5, bottom5, complejidadFlujo, colabActivos, promDiasActivos, prevKpis } = prodModel
  const histData = model.filteredHistorico || []

  const dTareas = delta(kpis.totalTareas,     prevKpis?.totalTareas)
  const dIds    = delta(kpis.totalIds,         prevKpis?.totalIds)
  const dDia    = delta(kpis.promTareasPorDia, prevKpis?.promTareasPorDia)

  const { sorted: rankingSorted, sortKey: rankSortKey, sortDir: rankSortDir, onSort: rankOnSort } = useTableSort(ranking, ranking)

  const [granularidad, setGranularidad] = useState('semanal')

  const tendenciaData = useMemo(() => {
    if (granularidad === 'diario')  return agruparPorDia(histData)
    if (granularidad === 'mensual') return agruparPorMes(histData)
    return semanas.map(s => ({ ...s, key: s.week }))
  }, [granularidad, histData, semanas])

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>

      <div className="metric-note metric-note-important">
        ℹ️ {COPY.modules.prodTareasVsIds}
      </div>

      {/* ── CAPACIDAD + TAREAS en la misma fila ───────────────── */}
      <div className="grid grid-4">
        <KPIv6 label={COPY.kpis.colaborActivos.label} value={colabActivos}
          help={COPY.kpis.colaborActivos.help} icon="👥" color="var(--accent)" />
        <KPIv6 label={COPY.kpis.diasActivos.label} value={`${promDiasActivos}d`}
          help={COPY.kpis.diasActivos.help} icon="📅" color="var(--accent2)" />
        <KPIv6 label={COPY.kpis.tareasFinalizadas.label} value={formatNumber(kpis.totalTareas)}
          help={COPY.kpis.tareasFinalizadas.help} icon="📦" color="var(--accent)" d={dTareas} />
        <KPIv6 label={COPY.kpis.prodPorDia.label} value={`${formatNumber(kpis.promTareasPorDia)} / día`}
          help={COPY.kpis.prodPorDia.help} icon="⚡" color="var(--green)" d={dDia} />
      </div>

      {/* ── IDs TRABAJADOS ───────────────────────────────────── */}
      <div className="grid grid-4">
        <KPIv6 label={COPY.kpis.idsTC.label} value={formatNumber(kpis.totalIds)}
          help={COPY.kpis.idsTC.help} icon="🔗" color="#38bdf8" d={dIds} />
        <KPIv6 label={COPY.kpis.idsPorDia.label} value={`${formatNumber(kpis.promIdsPorDia)} / día`}
          help={COPY.kpis.idsPorDia.help} icon="🔢" color="#a78bfa" />
        <KPIv6 label={COPY.kpis.relTareasIds.label} value={`${kpis.relIdsPorTarea}x`}
          help={COPY.kpis.relTareasIds.help} icon="🔄" color="var(--slate)" />
      </div>

      {/* ── TENDENCIA con toggle granularidad ─────────────────── */}
      {tendenciaData.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Tendencia — Tareas e IDs</div>
              <div className="card-subtitle">
                Barras = tareas · Línea = IDs trabajados. Si divergen, la complejidad promedio cambió.
              </div>
            </div>
            <GranularidadToggle value={granularidad} onChange={setGranularidad} />
          </div>
          <ResponsiveContainer width="100%" height={240}>
            <ComposedChart data={tendenciaData} margin={{ top:5, right:40, left:0, bottom:5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
              <XAxis dataKey="key"
                tick={{ fill:'var(--text3)', fontSize:11 }}
                tickFormatter={v => {
                  if (granularidad === 'semanal') return `Sem ${v}`
                  if (granularidad === 'diario')  return v?.slice(5) || v
                  return v
                }} />
              <YAxis yAxisId="left" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
              <YAxis yAxisId="right" orientation="right" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
              <Tooltip content={<CustomTooltip
                labelFormatter={v => granularidad === 'semanal' ? `Semana ${v}` : v}
                valueFormatter={formatNumber} />} />
              <Legend wrapperStyle={{ fontSize:'0.72rem', color:'var(--text3)' }} />
              <Bar yAxisId="left" dataKey="totalTareas" name="Tareas"
                fill="var(--accent)" radius={[3,3,0,0]} />
              <Line yAxisId="right" type="monotone" dataKey="totalIds" name="IDs trabajados"
                stroke="#fb923c" strokeWidth={2} dot={{ r:3 }} />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      )}

      {/* ── DISTRIBUCIÓN POR FLUJO + COMPLEJIDAD en misma fila ─ */}
      <div className="grid grid-2">
        {kpis.byFlujo && (
          <div className="card">
            <div className="card-header">
              <div className="card-title">Distribución de tareas por flujo</div>
              <div className="card-subtitle">Alta concentración en un solo flujo = riesgo operativo si ese flujo se traba.</div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {Object.entries(kpis.byFlujo).filter(([,v])=>v>0).sort((a,b)=>b[1]-a[1]).map(([flujo,val]) => {
                const max = Math.max(...Object.values(kpis.byFlujo))
                return (
                  <div key={flujo}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', marginBottom:3 }}>
                      <span style={{ color:'var(--text2)' }}>{flujo}</span>
                      <span style={{ color:'var(--text)', fontWeight:600 }}>
                        {formatNumber(val)} tareas
                        <span style={{ color:'var(--text3)', fontWeight:400, marginLeft:4 }}>
                          ({kpis.totalTareas>0?Math.round(val/kpis.totalTareas*100):0}%)
                        </span>
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill"
                        style={{ width:`${max>0?val/max*100:0}%`,
                                 background: FLUJO_COLORS[flujo]||'var(--accent)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {complejidadFlujo?.length > 0 && (
          <div className="card">
            <div className="card-header">
              <div>
                <div className="card-title">Complejidad operativa por flujo</div>
                <div className="card-subtitle">IDs por tarea en cada flujo. Más alto = mayor carga operativa.</div>
              </div>
            </div>
            <div style={{ display:'flex', flexDirection:'column', gap:'0.6rem' }}>
              {complejidadFlujo.map(f => {
                const max = complejidadFlujo[0].relIdsPorTarea || 1
                return (
                  <div key={f.flujo}>
                    <div style={{ display:'flex', justifyContent:'space-between', fontSize:'0.78rem', marginBottom:3 }}>
                      <span style={{ color:'var(--text2)' }}>{f.flujo}</span>
                      <span style={{ color:'var(--text)', fontWeight:600 }}>
                        {f.relIdsPorTarea}x IDs/tarea
                        <span style={{ color:'var(--text3)', fontWeight:400, marginLeft:4 }}>
                          ({formatNumber(f.totalTareas)} tareas)
                        </span>
                      </span>
                    </div>
                    <div className="progress-bar">
                      <div className="progress-fill"
                        style={{ width:`${(f.relIdsPorTarea/max)*100}%`,
                                 background: FLUJO_COLORS[f.flujo] || 'var(--accent)' }} />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}
      </div>

      {/* ── TOP 5 / BOTTOM 5 ─────────────────────────────────── */}
      {(top5?.length > 0 || bottom5?.length > 0) && (
        <div className="grid grid-2">
          <RankCard title="Top 5 — más tareas" rows={top5} color="var(--green)" />
          <RankCard title="Bottom 5 — menos tareas" rows={bottom5} color="var(--yellow)" />
        </div>
      )}

      {/* ── RANKING COMPLETO ──────────────────────────────────── */}
      {ranking.length > 0 && (
        <div className="card">
          <div className="card-header">
            <div>
              <div className="card-title">Ranking completo por colaborador</div>
            </div>
            <ExportCSVButton
              data={formatProductividadColab(ranking)}
              filename="productividad_colaboradores.csv"
            />
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>#</th>
                  <SortTh colKey="usuario"          label="Colaborador"  sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} />
                  <SortTh colKey="totalTareas"      label="Tareas"       sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} title={COPY.kpis.tareasFinalizadas.help} />
                  <SortTh colKey="totalIds"         label="IDs"          sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} title={COPY.kpis.idsTC.help} />
                  <SortTh colKey="relIdsPorTarea"   label="IDs/tarea"    sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} title={COPY.kpis.relTareasIds.help} />
                  <SortTh colKey="diasHabiles"      label="Días activos" sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} />
                  <SortTh colKey="promTareasPorDia" label="Tareas/día"   sortKey={rankSortKey} sortDir={rankSortDir} onSort={rankOnSort} />
                </tr>
              </thead>
              <tbody>
                {rankingSorted.map((r, i) => {
                  const tdColor = tareasDiaColor(r.promTareasPorDia)
                  return (
                    <tr key={r.usuario}>
                      <td style={{ color:'var(--text3)' }}>{i+1}</td>
                      <td style={{ fontWeight:600 }}>{r.usuario}</td>
                      <td>{formatNumber(r.totalTareas)}</td>
                      <td style={{ color:'#38bdf8' }}>{formatNumber(r.totalIds)}</td>
                      <td style={{ color:'var(--text3)' }}>{r.relIdsPorTarea}x</td>
                      <td>{r.diasHabiles}</td>
                      <td style={{ fontWeight:700, color: tdColor }}>{formatNumber(r.promTareasPorDia)}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}

function KPIv6({ label, value, help, icon, color, d }) {
  const dl = d != null ? deltaLabel(d) : null
  const dc = d != null ? deltaColor(d) : null
  return (
    <div className="card">
      <div className="card-header" style={{ marginBottom:'0.4rem' }}>
        <span className="card-title" title={help}>{label}{help && <span style={{ fontSize:'0.65rem', color:'var(--text3)', marginLeft:3 }}>ⓘ</span>}</span>
        {icon && <div className="kpi-icon" style={{ background:`${color}20`, color }}>{icon}</div>}
      </div>
      <div className="kpi-value" style={{ color }}>{value}</div>
      {dl && <div style={{ fontSize:'0.72rem', color:dc, marginTop:2, fontWeight:600 }}>{dl} vs período anterior</div>}
      {help && <div className="kpi-sub">{help}</div>}
    </div>
  )
}

function RankCard({ title, rows, color }) {
  if (!rows?.length) return null
  return (
    <div className="card">
      <div className="card-title" style={{ marginBottom:'0.75rem' }}>{title}</div>
      <table style={{ width:'100%', fontSize:'0.78rem', borderCollapse:'collapse' }}>
        <thead>
          <tr>
            <th style={{ color:'var(--text3)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>Colaborador</th>
            <th style={{ color:'var(--text3)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>Tareas</th>
            <th style={{ color:'var(--text3)', padding:'4px 0', borderBottom:'1px solid var(--border)' }}>IDs</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={r.usuario}>
              <td style={{ padding:'5px 0', borderBottom:'1px solid var(--border)' }}>{r.usuario}</td>
              <td style={{ padding:'5px 0', borderBottom:'1px solid var(--border)', fontWeight:600, color }}>{formatNumber(r.totalTareas)}</td>
              <td style={{ padding:'5px 0', borderBottom:'1px solid var(--border)', color:'var(--text3)' }}>{formatNumber(r.totalIds)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
