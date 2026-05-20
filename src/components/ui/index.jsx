/**
 * COMPONENTES UI REUTILIZABLES
 */

import { formatNumber, formatPct, truncate } from '../../utils/parsers.js'
import { CALIDAD_LABELS, CALIDAD_COLORS } from '../../utils/normalizers.js'

// ─── KPI Card ─────────────────────────────────────────────────────────────────
export function KPICard({ label, value, sub, icon, color = 'var(--accent)', className = '', help }) {
  return (
    <div className={`card ${className}`}>
      <div className="card-header" style={{ marginBottom: '0.5rem' }}>
        <span className="card-title">
          {label}
          {help && <span title={help} style={{ color:'var(--text3)', cursor:'help', marginLeft:6 }}>ⓘ</span>}
        </span>
        {icon && (
          <div className="kpi-icon" style={{ background: `${color}20`, color }}>
            {icon}
          </div>
        )}
      </div>
      <div className="kpi-value">{value}</div>
      {sub && <div className="kpi-sub">{sub}</div>}
    </div>
  )
}

// ─── Coverage Badge ────────────────────────────────────────────────────────────
export function CoverageBadge({ label }) {
  return <span className="badge badge-slate" title="Cobertura temporal del dataset">📅 {label}</span>
}

// ─── Empty State ───────────────────────────────────────────────────────────────
export function EmptyState({ message = 'Sin datos para mostrar' }) {
  return (
    <div className="empty-state">
      <span style={{ fontSize: '2rem' }}>📭</span>
      <span>{message}</span>
    </div>
  )
}

// ─── Loading ───────────────────────────────────────────────────────────────────
export function Spinner({ label = 'Cargando datos…' }) {
  return (
    <div className="loading-screen">
      <div className="spinner" />
      <span style={{ fontSize: '0.82rem' }}>{label}</span>
    </div>
  )
}

// ─── Custom Tooltip ────────────────────────────────────────────────────────────
export function CustomTooltip({ active, payload, label, labelFormatter, valueFormatter, hideZero = false, hideNames = [] }) {
  if (!active || !payload || payload.length === 0) return null
  const hidden = new Set(hideNames)
  const visiblePayload = payload.filter(p => {
    if (hidden.has(p.name)) return false
    if (hideZero && (p.value == null || Number(p.value) === 0)) return false
    return true
  })
  if (visiblePayload.length === 0) return null
  return (
    <div className="custom-tooltip">
      <div className="label">{labelFormatter ? labelFormatter(label) : label}</div>
      {visiblePayload.map((p, i) => (
        <div key={i} style={{ color: p.color || 'var(--text)', fontWeight: 600, fontSize: '0.82rem' }}>
          {p.name}: {valueFormatter ? valueFormatter(p.value) : formatNumber(p.value)}
        </div>
      ))}
    </div>
  )
}

// ─── Calidad Chip ──────────────────────────────────────────────────────────────
export function TrendTasksTooltip({
  active,
  payload,
  label,
  labelFormatter,
  valueFormatter = formatNumber,
  totalKey = 'totalTareas',
  totalLabel = 'Tareas totales',
  hiddenNames = ['Sin flujo'],
  lineFormatters = {},
  extraRows = [],
}) {
  if (!active || !payload || payload.length === 0) return null
  const row = payload[0]?.payload || {}
  const hidden = new Set(hiddenNames)
  const lineNames = new Set(Object.keys(lineFormatters))
  const total = row[totalKey] ?? row.total
  const flows = payload.filter(p => (
    !hidden.has(p.name) &&
    !lineNames.has(p.name) &&
    p.value != null &&
    Number(p.value) > 0
  ))
  const lines = payload.filter(p => lineNames.has(p.name) && p.value != null)

  return (
    <div className="custom-tooltip">
      <div className="label">{labelFormatter ? labelFormatter(label) : label}</div>
      {total != null && (
        <div style={{ color:'var(--text)', fontWeight:700, fontSize:'0.82rem', marginBottom:4 }}>
          {totalLabel}: {valueFormatter(total)}
        </div>
      )}
      {flows.map((p, i) => (
        <div key={`flow-${i}`} style={{ color: p.color || 'var(--text)', fontWeight:600, fontSize:'0.82rem' }}>
          {p.name}: {valueFormatter(p.value)}
        </div>
      ))}
      {lines.map((p, i) => (
        <div key={`line-${i}`} style={{ color: p.color || 'var(--text)', fontWeight:600, fontSize:'0.82rem', marginTop: i === 0 ? 6 : 0 }}>
          {p.name}: {lineFormatters[p.name] ? lineFormatters[p.name](p.value) : valueFormatter(p.value)}
        </div>
      ))}
      {extraRows.map((extra, i) => {
        const value = row[extra.key]
        if (value == null) return null
        const formatter = extra.formatter || valueFormatter
        return (
          <div key={`extra-${extra.key}`} style={{ color: extra.color || 'var(--text2)', fontWeight:600, fontSize:'0.82rem', marginTop: i === 0 ? 6 : 0 }}>
            {extra.label}: {formatter(value)}
          </div>
        )
      })}
    </div>
  )
}

export function CalidadChip({ calidad }) {
  const label = CALIDAD_LABELS[calidad] || calidad
  return <span className={`q-chip ${calidad}`}>{label}</span>
}

// ─── Bar indicator ─────────────────────────────────────────────────────────────
export function BarIndicator({ value, max, color = 'var(--accent)' }) {
  const pct = max > 0 ? Math.min(100, (value / max) * 100) : 0
  return (
    <div className="progress-bar">
      <div className="progress-fill" style={{ width: `${pct}%`, background: color }} />
    </div>
  )
}

// ─── Stacked quality bar ───────────────────────────────────────────────────────
export function CalidadBar({ correcto, desvio_leve, desvio_grave, sin_clasificar, total }) {
  if (!total) return null
  const pct = (v) => Math.round((v / total) * 100)
  return (
    <div style={{ display: 'flex', height: '8px', borderRadius: '99px', overflow: 'hidden', gap: '1px' }}>
      {correcto > 0 && <div style={{ flex: correcto, background: CALIDAD_COLORS.correcto }} title={`Correcto: ${pct(correcto)}%`} />}
      {desvio_leve > 0 && <div style={{ flex: desvio_leve, background: CALIDAD_COLORS.desvio_leve }} title={`Desvío leve: ${pct(desvio_leve)}%`} />}
      {desvio_grave > 0 && <div style={{ flex: desvio_grave, background: CALIDAD_COLORS.desvio_grave }} title={`Desvío grave: ${pct(desvio_grave)}%`} />}
      {sin_clasificar > 0 && <div style={{ flex: sin_clasificar, background: CALIDAD_COLORS.sin_clasificar }} title={`Sin clasificar: ${pct(sin_clasificar)}%`} />}
    </div>
  )
}

// ─── Section Header ────────────────────────────────────────────────────────────
export function SectionHeader({ title, badge, action }) {
  return (
    <div className="section-title">
      <span>{title}</span>
      {badge && <span>{badge}</span>}
      {action && <div style={{ marginLeft: 'auto' }}>{action}</div>}
    </div>
  )
}

// ─── Export CSV Button ─────────────────────────────────────────────────────────
export function ExportCSVButton({ data, filename = 'export.csv', label = 'Exportar CSV' }) {
  function handleClick() {
    if (!data || data.length === 0) return
    const headers = Object.keys(data[0])
    const escape = v => {
      if (v === null || v === undefined) return ''
      const s = String(v)
      return s.includes(',') || s.includes('"') || s.includes('\n')
        ? `"${s.replace(/"/g, '""')}"` : s
    }
    const rows = data.map(r => headers.map(h => escape(r[h])).join(','))
    const csv = '\uFEFF' + [headers.join(','), ...rows].join('\n')
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }
  return (
    <button className="btn" onClick={handleClick} title="Descargar CSV filtrado">
      ⬇ {label}
    </button>
  )
}

// ─── Copy Insights Button ──────────────────────────────────────────────────────
export function CopyInsightsButton({ insights }) {
  function handleClick() {
    const text = insights.join('\n')
    navigator.clipboard.writeText(text).catch(() => {
      const ta = document.createElement('textarea')
      ta.value = text
      document.body.appendChild(ta)
      ta.select()
      document.execCommand('copy')
      document.body.removeChild(ta)
    })
  }
  return (
    <button className="btn btn-accent" onClick={handleClick}>
      📋 Copiar insights
    </button>
  )
}
