import { useState } from 'react'
import { COPY } from '../config/copy.js'

function toInputDate(d) {
  if (!d) return ''
  return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`
}

function Divider() {
  return <div style={{ width:1, height:20, background:'var(--border)', margin:'0 6px', flexShrink:0 }} />
}

function GroupLabel({ children }) {
  return <span style={{ fontSize:'0.68rem', color:'var(--text3)', fontWeight:700, textTransform:'uppercase', letterSpacing:'0.07em', flexShrink:0 }}>{children}</span>
}

function ModeBtn({ active, onClick, children }) {
  return (
    <button
      className={`filter-preset-btn${active ? ' active' : ''}`}
      onClick={onClick}
    >{children}</button>
  )
}

function Sel({ value, onChange, placeholder, opts }) {
  return (
    <select className="filter-select" value={value} onChange={e => onChange(e.target.value || null)}>
      <option value="">{placeholder}</option>
      {opts.map(o => (
        <option key={o.value} value={String(o.value)} disabled={o.disabled}>
          {o.label}{!o.disabled && o.count != null && o.count > 0 ? ` (${o.count.toLocaleString('es-AR')})` : ''}
        </option>
      ))}
    </select>
  )
}

function YearSel({ year, years, onChange }) {
  if (!years.length) return null
  return (
    <select className="filter-select" value={year} onChange={e => onChange(parseInt(e.target.value))}
      style={{ minWidth:72 }}>
      {years.map(y => <option key={y} value={y}>{y}</option>)}
    </select>
  )
}

export function FiltersBar({
  filters, state, options,
  setModo, setYear, setSubYear, setMonth, setWeek, setFechaDesde, setFechaHasta,
  setSegFilter, resetFilters,
  calFilters, setCalFilter, resetCalFilters,
  allChips, activeCount, activeTab,
  availability, availableYears, weeksForYear, monthsForYear,
}) {
  const [calOpen, setCalOpen] = useState(false)
  const isCalidad  = activeTab === 'calidad'
  const hasCalChips = allChips.some(c => c.contextual)
  const modo = state.modo

  return (
    <div className="filters-wrap">

      {/* ── Fila principal ── */}
      <div className="filters-bar">

        {/* PERÍODO: selector de modo */}
        <GroupLabel>Período</GroupLabel>
        <div className="filter-preset-group">
          <ModeBtn active={modo==='year'}   onClick={()=>setModo('year')}>Año</ModeBtn>
          <ModeBtn active={modo==='month'}  onClick={()=>setModo('month')}>Mes</ModeBtn>
          <ModeBtn active={modo==='week'}   onClick={()=>setModo('week')}>Semana</ModeBtn>
          <ModeBtn active={modo==='custom'} onClick={()=>setModo('custom')}>Personalizado</ModeBtn>
        </div>

        {/* Sub-controles por modo */}
        {modo === 'year' && (
          <>
            <YearSel year={state.year} years={availableYears} onChange={setYear} />
            <select className="filter-select" value={state.subYear} onChange={e => setSubYear(e.target.value)}>
              {[
                { id:'all', label:'Todo el año' },
                { id:'q1',  label:'Q1 — Ene/Mar' },
                { id:'q2',  label:'Q2 — Abr/Jun' },
                { id:'q3',  label:'Q3 — Jul/Sep' },
                { id:'q4',  label:'Q4 — Oct/Dic' },
              ].map(({ id, label }) => {
                const hasData = availability.yearSet.has(state.year)
                return <option key={id} value={id} disabled={!hasData}>{label}</option>
              })}
            </select>
          </>
        )}

        {modo === 'month' && (
          <>
            <YearSel year={state.year} years={availableYears} onChange={setYear} />
            <select className="filter-select" value={state.month ?? ''} onChange={e => setMonth(e.target.value === '' ? null : parseInt(e.target.value))}>
              <option value="">Todos los meses</option>
              {monthsForYear.map(({ month, label, hasData }) => (
                <option key={month} value={month} disabled={!hasData}>
                  {label}{!hasData ? ' (sin datos)' : ''}
                </option>
              ))}
            </select>
          </>
        )}

        {modo === 'week' && (
          <>
            <YearSel year={state.year} years={availableYears} onChange={setYear} />
            <select className="filter-select" value={state.week ?? ''} onChange={e => setWeek(e.target.value === '' ? null : parseInt(e.target.value))} style={{ minWidth: 180 }}>
              <option value="">Todas las semanas</option>
              {weeksForYear.map(({ week, label, hasData }) => (
                <option key={week} value={week} disabled={!hasData}>
                  {label}{!hasData ? ' (sin datos)' : ''}
                </option>
              ))}
            </select>
          </>
        )}

        {modo === 'custom' && (
          <>
            <input type="date" className="filter-date"
              value={filters.fechaDesde ? toInputDate(filters.fechaDesde) : ''}
              onChange={e => setFechaDesde(e.target.value ? new Date(e.target.value + 'T00:00:00') : null)} />
            <span className="filter-date-sep">→</span>
            <input type="date" className="filter-date"
              value={filters.fechaHasta ? toInputDate(filters.fechaHasta) : ''}
              onChange={e => setFechaHasta(e.target.value ? new Date(e.target.value + 'T23:59:59') : null)} />
          </>
        )}

        <Divider />

        {/* SEGMENTO */}
        <GroupLabel>Segmento</GroupLabel>

        <Sel value={filters.flujo||''} onChange={v=>setSegFilter('flujo',v)}
          placeholder="Todos los flujos" opts={options.flujos||[]} />

        <Sel value={filters.equipo||''} onChange={v=>setSegFilter('equipo',v)}
          placeholder="Todos los equipos" opts={options.equipos||[]} />

        <Sel value={filters.usuario||''} onChange={v=>setSegFilter('usuario',v)}
          placeholder="Todos los colaboradores" opts={options.usuarios||[]} />

        {/* CALIDAD — solo en tab calidad */}
        {isCalidad && (
          <>
            <Divider />
            <button
              className={`filter-advanced-btn${calOpen?' active':''}${hasCalChips?' has-active':''}`}
              onClick={() => setCalOpen(o => !o)}
            >
              Calidad {hasCalChips && <span className="filter-advanced-dot" />}
              <span className="filter-advanced-caret">{calOpen ? '▴' : '▾'}</span>
            </button>
          </>
        )}

        {activeCount > 0 && (
          <>
            <Divider />
            <button className="filter-reset" onClick={() => { resetFilters(); resetCalFilters() }}>✕ Limpiar</button>
          </>
        )}
      </div>

      {/* Panel CALIDAD expandible */}
      {isCalidad && calOpen && (
        <div className="filters-advanced-panel" style={{ flexWrap:'wrap', gap:'0.5rem 0.75rem', alignItems:'center' }}>
          <GroupLabel>Calidad</GroupLabel>

          <Sel value={calFilters.auditor||''} onChange={v=>setCalFilter('auditor',v||null)}
            placeholder="Todos los auditores" opts={options.auditores||[]} />

          <Sel value={calFilters.dominio||''} onChange={v=>setCalFilter('dominio',v||null)}
            placeholder="Todos los dominios" opts={options.dominios||[]} />

          <Sel value={calFilters.suggestionReason||''} onChange={v=>setCalFilter('suggestionReason',v||null)}
            placeholder="Todos los códigos" opts={options.suggestionReasons||[]} />

          <Sel value={calFilters.calidad||''} onChange={v=>setCalFilter('calidad',v||null)}
            placeholder="Todos los desvíos"
            opts={options.calidadOpts||[]} />

          {hasCalChips && (
            <button className="filter-reset" style={{ marginLeft:'auto' }} onClick={resetCalFilters}>
              ✕ Limpiar Calidad
            </button>
          )}
        </div>
      )}

      {/* Chips */}
      {allChips.length > 0 && (
        <div className="filters-chips">
          {allChips.map(chip => (
            <button
              key={chip.key}
              className={`filter-chip${chip.contextual ? ' contextual' : ''}`}
              onClick={() => chip.contextual ? setCalFilter(chip.key, null) : setSegFilter(chip.key, null)}
              title={`Quitar filtro: ${chip.label}`}
            >
              <span className="filter-chip-label">{chip.label}:</span>
              <span className="filter-chip-value">{chip.value}</span>
              <span className="filter-chip-remove">✕</span>
            </button>
          ))}
          {allChips.length > 1 && (
            <button className="filter-chip filter-chip-clear"
              onClick={() => { resetFilters(); resetCalFilters() }}>
              Quitar todos
            </button>
          )}
        </div>
      )}
    </div>
  )
}
