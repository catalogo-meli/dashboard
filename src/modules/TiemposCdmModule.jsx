import { useMemo, useState } from 'react'
import {
  BarChart, Bar, ComposedChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, Legend, Cell,
} from 'recharts'
import { CustomTooltip, EmptyState, ExportCSVButton, KPICard } from '../components/ui/index.jsx'
import { formatDateDisplay, formatNumber } from '../utils/parsers.js'
import { useTableSort, SortTh } from '../hooks/useTableSort.jsx'

const COLORS = ['#6366f1', '#38bdf8', '#a78bfa', '#fb923c', '#22c55e', '#f59e0b', '#ef4444', '#14b8a6']

function isVisibleFlujo(flujo) {
  return Boolean(flujo) && flujo !== 'Sin flujo'
}

function formatDuration(seconds) {
  if (seconds == null || Number.isNaN(seconds)) return '-'
  const sign = seconds < 0 ? '-' : ''
  const abs = Math.abs(Math.round(seconds))
  const h = Math.floor(abs / 3600)
  const m = Math.floor((abs % 3600) / 60)
  const s = abs % 60
  if (h > 0) return `${sign}${h}h ${String(m).padStart(2, '0')}m`
  if (m > 0) return `${sign}${m}m ${String(s).padStart(2, '0')}s`
  return `${sign}${s}s`
}

function pct(part, total) {
  return total > 0 ? `${Math.round((part / total) * 100)}%` : '0%'
}

function percentile(values, p) {
  const clean = values.filter(v => v != null && !Number.isNaN(v)).sort((a, b) => a - b)
  if (!clean.length) return null
  const idx = Math.min(clean.length - 1, Math.max(0, Math.ceil((p / 100) * clean.length) - 1))
  return clean[idx]
}

function groupRows(rows, keyFn, labelKey) {
  const map = new Map()
  for (const r of rows) {
    const key = keyFn(r) || 'Sin dato'
    if (!map.has(key)) {
      map.set(key, {
        [labelKey]: key,
        total: 0,
        duraciones: [],
        mayor1h: 0,
        corta10: 0,
        colaboradores: new Set(),
        dias: new Set(),
      })
    }
    const e = map.get(key)
    e.total += 1
    if (r.duracionSegundos != null) e.duraciones.push(r.duracionSegundos)
    if (r.esDuracionMayor1h) e.mayor1h += 1
    if (r.esDuracionCorta10s) e.corta10 += 1
    if (r.usuario) e.colaboradores.add(r.usuario)
    if (r.fechaKey) e.dias.add(r.fechaKey)
  }
  return [...map.values()].map(e => ({
    ...e,
    colaboradores: e.colaboradores.size,
    dias: e.dias.size,
    tareasDia: e.dias.size > 0 ? Math.round(e.total / e.dias.size) : 0,
    medianaSeg: percentile(e.duraciones, 50),
    p90Seg: percentile(e.duraciones, 90),
    pctMayor1h: e.total > 0 ? e.mayor1h / e.total : 0,
    pctCorta10: e.total > 0 ? e.corta10 / e.total : 0,
  })).sort((a, b) => b.total - a.total)
}

function aggregateTrend(rows, mode) {
  const map = new Map()
  for (const r of rows) {
    if (!r.fecha) continue
    let key
    let label
    if (mode === 'diario') {
      key = r.fechaKey
      label = formatDateDisplay(r.fecha)
    } else if (mode === 'mensual') {
      key = r.monthKey
      label = `${String(r.fecha.getMonth() + 1).padStart(2, '0')}/${r.fecha.getFullYear()}`
    } else {
      key = r.weekKey
      label = `Sem ${String(r.week).padStart(2, '0')} ${r.weekYear}`
    }
    if (!map.has(key)) map.set(key, { key, label, total: 0, duraciones: [], dias: new Set(), byFlujo: {} })
    const e = map.get(key)
    e.total += 1
    if (isVisibleFlujo(r.flujo)) e.byFlujo[r.flujo] = (e.byFlujo[r.flujo] || 0) + 1
    if (r.duracionSegundos != null) e.duraciones.push(r.duracionSegundos)
    e.dias.add(r.fechaKey)
  }
  return [...map.values()].map(e => ({
    key: e.key,
    label: e.label,
    total: e.total,
    byFlujo: e.byFlujo,
    tareasDia: e.dias.size > 0 ? Math.round(e.total / e.dias.size) : 0,
    medianaMin: (percentile(e.duraciones, 50) || 0) / 60,
    p90Min: (percentile(e.duraciones, 90) || 0) / 60,
  })).sort((a, b) => a.key.localeCompare(b.key))
}

function flujosEnTendencia(data) {
  const totals = new Map()
  for (const row of data) {
    for (const [flujo, value] of Object.entries(row.byFlujo || {})) {
      if (!isVisibleFlujo(flujo) || value <= 0) continue
      totals.set(flujo, (totals.get(flujo) || 0) + value)
    }
  }
  return [...totals.entries()].sort((a, b) => b[1] - a[1]).map(([flujo]) => flujo)
}

function buildRanking(rows) {
  return groupRows(rows, r => r.usuario, 'usuario').map(r => ({
    ...r,
    equipo: rows.find(x => x.usuario === r.usuario)?.equipo || 'Fuera de padrón actual',
  }))
}

function exportRows(rows) {
  return rows.map(r => ({
    ID_CDM: r.idCdm,
    Fecha: formatDateDisplay(r.fechaFinalizacion),
    Macro_caja: r.macroCaja,
    Flujo: r.flujo,
    Colaborador: r.usuario,
    Equipo: r.equipo || '',
    Duracion: r.duracionRaw,
    Duracion_segundos: r.duracionSegundos,
    Iniciado_vs_Finalizado: r.iniciadoVsFinalizado,
    Link_caso: r.linkCaso || '',
    Comentario_TL: r.comentarioTl || '',
  }))
}

function GranularityToggle({ value, onChange }) {
  return (
    <div style={{ display:'flex', gap:0, border:'1px solid var(--border)', borderRadius:'var(--radius-sm)', overflow:'hidden' }}>
      {[
        ['diario', 'Diario'],
        ['semanal', 'Semanal'],
        ['mensual', 'Mensual'],
      ].map(([id, label]) => (
        <button key={id} onClick={() => onChange(id)}
          style={{
            padding:'0.25rem 0.75rem',
            fontSize:'0.72rem',
            fontWeight: value === id ? 700 : 400,
            background: value === id ? 'var(--accent)' : 'transparent',
            color: value === id ? '#fff' : 'var(--text2)',
            border:'none',
            cursor:'pointer',
            borderRight:'1px solid var(--border)',
          }}>
          {label}
        </button>
      ))}
    </div>
  )
}

export function TiemposCdmModule({ rows }) {
  const [granularity, setGranularity] = useState('diario')
  const [macroFilter, setMacroFilter] = useState([])

  const macroOptions = useMemo(() => [...new Set((rows || []).map(r => r.macroCaja).filter(Boolean))].sort(), [rows])
  const filteredRows = useMemo(() => {
    if (!macroFilter.length) return rows || []
    return (rows || []).filter(r => macroFilter.includes(r.macroCaja))
  }, [rows, macroFilter])

  const model = useMemo(() => {
    const data = filteredRows || []
    const duraciones = data.map(r => r.duracionSegundos).filter(v => v != null)
    const dias = new Set(data.map(r => r.fechaKey).filter(Boolean))
    const colaboradores = new Set(data.map(r => r.usuario).filter(Boolean))
    const macro = groupRows(data, r => r.macroCaja, 'macroCaja')
    const flujo = groupRows(data.filter(r => isVisibleFlujo(r.flujo)), r => r.flujo, 'flujo')
    const equipo = groupRows(data, r => r.equipo || 'Fuera de padrón actual', 'equipo')
    const ranking = buildRanking(data)
    const anomalies = {
      negativas: data.filter(r => r.esDuracionNegativa),
      corta5: data.filter(r => r.esDuracionCorta5s),
      corta10: data.filter(r => r.esDuracionCorta10s),
      mayor1h: data.filter(r => r.esDuracionMayor1h),
      distintoDia: data.filter(r => r.esDistintoDia),
      conComentario: data.filter(r => r.tieneComentario),
    }
    return {
      total: data.length,
      dias: dias.size,
      colaboradores: colaboradores.size,
      tareasDia: dias.size > 0 ? Math.round(data.length / dias.size) : 0,
      medianaSeg: percentile(duraciones, 50),
      p90Seg: percentile(duraciones, 90),
      promedioSeg: duraciones.length ? Math.round(duraciones.reduce((s, v) => s + v, 0) / duraciones.length) : null,
      macro,
      flujo,
      equipo,
      ranking,
      anomalies,
    }
  }, [filteredRows])

  const trend = useMemo(() => aggregateTrend(filteredRows, granularity), [filteredRows, granularity])
  const trendFlujos = useMemo(() => flujosEnTendencia(trend), [trend])
  const { sorted: rankingSorted, sortKey, sortDir, onSort } = useTableSort(model.ranking, model.ranking)

  function toggleMacro(macro) {
    setMacroFilter(prev => prev.includes(macro) ? prev.filter(v => v !== macro) : [...prev, macro])
  }

  if (!rows?.length) {
    return <EmptyState message="No hay datos de accionamiento CDM para el período seleccionado." />
  }

  const anomalyCards = [
    { label: 'Resueltas en 5 segundos o menos', value: model.anomalies.corta5.length, sub: `${pct(model.anomalies.corta5.length, model.total)} del total` },
    { label: 'Resueltas en 10 segundos o menos', value: model.anomalies.corta10.length, sub: `${pct(model.anomalies.corta10.length, model.total)} del total` },
    { label: 'Más de 1 hora', value: model.anomalies.mayor1h.length, sub: `${pct(model.anomalies.mayor1h.length, model.total)} del total` },
    { label: 'Finalizadas otro día', value: model.anomalies.distintoDia.length, sub: `${pct(model.anomalies.distintoDia.length, model.total)} del total` },
  ]

  return (
    <div style={{ display:'flex', flexDirection:'column', gap:'1.25rem' }}>
      <div className="card" style={{ padding:'0.9rem 1rem' }}>
        <div className="card-header" style={{ marginBottom:'0.65rem' }}>
          <div>
            <div className="card-title">Accionamiento CDM</div>
            <div className="card-subtitle">Analizá el volumen, los tiempos y los casos que conviene revisar.</div>
          </div>
          <ExportCSVButton data={exportRows(filteredRows)} filename="tiempos_cdm_filtrado.csv" />
        </div>
        <div style={{ display:'flex', gap:'0.5rem', flexWrap:'wrap' }}>
          {macroOptions.map(macro => (
            <button key={macro} className={`filter-preset-btn${macroFilter.includes(macro) ? ' active' : ''}`}
              onClick={() => toggleMacro(macro)}
              style={{ border:'1px solid var(--border)', padding:'5px 12px' }}>
              {macro}
            </button>
          ))}
          {macroFilter.length > 0 && (
            <button className="filter-reset" onClick={() => setMacroFilter([])}>Limpiar macro</button>
          )}
        </div>
      </div>

      <div className="grid grid-4">
        <KPICard label="Tareas accionadas" value={formatNumber(model.total)} sub={`${model.colaboradores} colaboradores`} icon="📦" />
        <KPICard label="Tareas/día" value={formatNumber(model.tareasDia)} sub={`${model.dias} días con actividad`} icon="⚡" color="var(--green)" />
        <KPICard label="Tiempo habitual por tarea" value={formatDuration(model.medianaSeg)} sub={`Promedio: ${formatDuration(model.promedioSeg)}`} icon="⏱️" color="#38bdf8" />
        <KPICard label="Tiempo alto, pero esperable" value={formatDuration(model.p90Seg)} sub="El 90% de las tareas termina antes de este tiempo" icon="📈" color="#fb923c" />
      </div>

      <div className="grid grid-4">
        {anomalyCards.map(card => (
          <KPICard key={card.label} label={card.label} value={formatNumber(card.value)} sub={card.sub} icon="!" color={card.value > 0 ? 'var(--yellow)' : 'var(--slate)'} />
        ))}
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Evolución temporal</div>
            <div className="card-subtitle">Barras apiladas por flujo. Las líneas muestran tiempo habitual y tiempo alto.</div>
          </div>
          <GranularityToggle value={granularity} onChange={setGranularity} />
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <ComposedChart data={trend} margin={{ top:5, right:35, left:0, bottom:5 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
            <XAxis dataKey="label" tick={{ fill:'var(--text3)', fontSize:11 }} interval="preserveStartEnd" />
            <YAxis yAxisId="left" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
            <YAxis yAxisId="right" orientation="right" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={v => `${Math.round(v)}m`} />
            <Tooltip content={<CustomTooltip
              valueFormatter={v => typeof v === 'number' ? formatNumber(Math.round(v)) : v}
              hideZero
              hideNames={['Sin flujo']} />} />
            <Legend wrapperStyle={{ fontSize:'0.72rem', color:'var(--text3)' }} />
            {trendFlujos.map((flujo, idx) => (
              <Bar key={flujo} yAxisId="left" stackId="tareas"
                dataKey={row => row.byFlujo?.[flujo] || 0}
                name={flujo}
                fill={COLORS[idx % COLORS.length]}
                radius={idx === trendFlujos.length - 1 ? [3,3,0,0] : [0,0,0,0]} />
            ))}
            <Line yAxisId="right" type="monotone" dataKey="medianaMin" name="Tiempo habitual (min)" stroke="#38bdf8" strokeWidth={2} dot={{ r:3 }} />
            <Line yAxisId="right" type="monotone" dataKey="p90Min" name="Tiempo alto (min)" stroke="#fb923c" strokeWidth={2} dot={{ r:3 }} />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-2">
        <BreakdownChart title="Tareas por flujo" data={model.flujo.slice(0, 10)} dataKey="flujo" />
        <BreakdownChart title="Tareas por macro caja" data={model.macro} dataKey="macroCaja" />
      </div>

      <div className="grid grid-2">
        <BreakdownChart title="Resultado por equipo" data={model.equipo.slice(0, 10)} dataKey="equipo" />
        <AnomalyList rows={[...model.anomalies.negativas, ...model.anomalies.mayor1h, ...model.anomalies.distintoDia].slice(0, 8)} />
      </div>

      <div className="card">
        <div className="card-header">
          <div>
            <div className="card-title">Ranking por colaborador</div>
            <div className="card-subtitle">Tareas, productividad diaria y tiempos de accionamiento.</div>
          </div>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <SortTh colKey="usuario" label="Colaborador" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="equipo" label="Equipo" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="total" label="Tareas" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="tareasDia" label="Tareas/día" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="medianaSeg" label="Tiempo habitual" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="p90Seg" label="Tiempo alto" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="pctCorta10" label="Hasta 10 seg." sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
                <SortTh colKey="pctMayor1h" label="Más de 1 hora" sortKey={sortKey} sortDir={sortDir} onSort={onSort} />
              </tr>
            </thead>
            <tbody>
              {rankingSorted.map(r => (
                <tr key={r.usuario}>
                  <td className="bold">{r.usuario}</td>
                  <td>{r.equipo}</td>
                  <td>{formatNumber(r.total)}</td>
                  <td>{formatNumber(r.tareasDia)}</td>
                  <td>{formatDuration(r.medianaSeg)}</td>
                  <td>{formatDuration(r.p90Seg)}</td>
                  <td>{Math.round(r.pctCorta10 * 100)}%</td>
                  <td>{Math.round(r.pctMayor1h * 100)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

function BreakdownChart({ title, data, dataKey }) {
  if (!data?.length) return null
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-subtitle">Volumen y tiempo habitual de accionamiento.</div>
        </div>
      </div>
      <ResponsiveContainer width="100%" height={260}>
        <BarChart data={data} layout="vertical" margin={{ top:0, right:20, left:20, bottom:0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" horizontal={false} />
          <XAxis type="number" tick={{ fill:'var(--text3)', fontSize:11 }} tickFormatter={formatNumber} />
          <YAxis type="category" dataKey={dataKey} tick={{ fill:'var(--text3)', fontSize:10 }} width={120} />
          <Tooltip content={<CustomTooltip valueFormatter={formatNumber} hideZero hideNames={['Sin flujo']} />} />
          <Bar dataKey="total" name="Tareas" radius={[0,3,3,0]}>
            {data.map((_, idx) => <Cell key={idx} fill={COLORS[idx % COLORS.length]} />)}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  )
}

function AnomalyList({ rows }) {
  return (
    <div className="card">
      <div className="card-header">
        <div>
          <div className="card-title">Casos para revisar</div>
          <div className="card-subtitle">Registros con tiempo inconsistente, tareas de más de 1 hora o finalizadas otro día.</div>
        </div>
      </div>
      {!rows.length ? (
        <div className="empty-state" style={{ padding:'1rem' }}>Sin registros críticos en el filtro actual.</div>
      ) : (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>ID CDM</th>
                <th>Fecha</th>
                <th>Colaborador</th>
                <th>Flujo</th>
                <th>Tiempo</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(r => (
                <tr key={`${r.idCdm}-${r.usuario}`}>
                  <td className="bold">{r.idCdm}</td>
                  <td>{formatDateDisplay(r.fechaFinalizacion)}</td>
                  <td>{r.usuario}</td>
                  <td>{r.flujo}</td>
                  <td style={{ color: r.esDuracionMayor1h || r.esDuracionNegativa ? 'var(--yellow)' : 'var(--text2)' }}>
                    {formatDuration(r.duracionSegundos)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
