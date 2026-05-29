import { useMemo } from 'react'
import { COPY } from '../config/copy.js'
import { THRESHOLDS } from '../config/thresholds.js'
import { formatNumber } from '../utils/parsers.js'
import { delta, deltaLabel, deltaColor } from '../utils/metrics/comparisonMetrics.js'
import { EmptyState } from '../components/ui/index.jsx'

const SEV = {
  critico:  { icon: '🔴', cls: 'alert-critico' },
  atencion: { icon: '🟡', cls: 'alert-atencion' },
  contexto: { icon: '🔵', cls: 'alert-contexto' },
}

// Semáforo de calidad/fricción
function nivelColor(value, threshold, inverso = false) {
  if (value == null) return 'var(--text3)'
  if (!inverso) return value >= threshold.ok ? 'var(--green)' : value >= threshold.warn ? 'var(--yellow)' : 'var(--red)'
  return value <= threshold.ok ? 'var(--green)' : value <= threshold.warn ? 'var(--yellow)' : 'var(--red)'
}

// Días en número → texto claro sin jerga estadística
function diasTexto(dias) {
  if (dias == null) return '—'
  if (dias <= 1) return '1 día'
  if (dias <= 7) return `${dias} días`
  return `${Math.round(dias / 7)} sem.`
}

const fmt = v => (v ?? 0).toLocaleString('es-AR')
const pct = v => `${Math.round((v ?? 0) * 100)}%`

// Acciones sugeridas basadas en los datos disponibles.
function buildAcciones({ kpisCalidad, kpisHold, prodModel, calidadModel, equipoModel }) {
  const acc = []
  if (kpisCalidad) {
    const porDominio = calidadModel?.porDominio || []
    const worst = porDominio.find(d => d.efectividad < 0.85 && d.total >= 5)
    if (worst) acc.push({ texto: `Revisar criterios de auditoría en dominio "${worst.dominio}" — efectividad ${Math.round(worst.efectividad*100)}%.`, module: 'calidad' })
    const porError = calidadModel?.porError || []
    // Solo sugerir acción si el código concentra al menos 10 desvíos graves — volumen mínimo para ser accionable
    if (porError[0]?.desvio_grave >= 10)
      acc.push({ texto: `Analizar código de error "${porError[0].error}" — es el más frecuente en desvíos.`, module: 'calidad' })
  }
  if (equipoModel?.porSegmento?.length) {
    const seg = [...equipoModel.porSegmento]
      .filter(s => s.efectividadSug != null && s.segmento !== 'Fuera de padrón actual')
      .sort((a, b) => a.efectividadSug - b.efectividadSug)[0]
    if (seg && seg.efectividadSug < 0.85 && seg.auditadas >= 3)
      acc.push({ texto: `Refuerzo en perfiles "${seg.segmento}" — efectividad ${Math.round(seg.efectividadSug*100)}%.`, module: 'equipo' })
  }
  if (kpisHold) {
    const topFlujo = Object.entries(kpisHold.byFlujo || {}).sort((a,b)=>b[1]-a[1])[0]
    if (topFlujo && kpisHold.totalRegistros > 0 && topFlujo[1] / kpisHold.totalRegistros > 0.4)
      acc.push({ texto: `Resolver bloqueos en flujo "${topFlujo[0]}" — concentra el ${Math.round(topFlujo[1]/kpisHold.totalRegistros*100)}% del HOLD.`, module: 'friccion' })
  }
  if (!acc.length) acc.push({ texto: 'Sin acciones prioritarias detectadas. Mantener seguimiento semanal.', module: null })
  return acc
}

// Capa organizacional desde equipoModel — solo equipo activo
function buildOrgLayer(equipoModel) {
  if (!equipoModel?.porEquipo?.length) return null
  const FUERA = 'Fuera de padrón actual'
  const eq = equipoModel.porEquipo.filter(e => e.segmento !== FUERA)
  const conFriccion = [...eq].filter(e => e.holdRelativo != null).sort((a,b)=>b.holdRelativo-a.holdRelativo)
  const conCalidad  = [...eq].filter(e => e.efectividadSug != null && e.auditadas >= 3).sort((a,b)=>b.efectividadSug-a.efectividadSug)
  const porSegmento = (equipoModel.porSegmento || []).filter(s => s.efectividadSug != null && s.auditadas >= 3 && s.segmento !== FUERA)
  const segRiesgoCandidate = [...porSegmento].sort((a,b)=>a.efectividadSug-b.efectividadSug)[0]

  // Mejor/peor calidad: solo mostrar si la brecha supera 5pp
  const brecha = conCalidad.length >= 2
    ? conCalidad[0].efectividadSug - conCalidad[conCalidad.length-1].efectividadSug
    : 0
  const mostrarCalidadExtremos = brecha >= 0.05

  // Segmento en riesgo: solo si efectividad está bajo target (90%)
  const segRiesgo = segRiesgoCandidate && segRiesgoCandidate.efectividadSug < 0.90
    ? segRiesgoCandidate
    : null

  return {
    mayorFriccion: conFriccion[0] || null,
    mejorCalidad:  mostrarCalidadExtremos ? conCalidad[0] : null,
    peorCalidad:   mostrarCalidadExtremos ? conCalidad[conCalidad.length-1] : null,
    segRiesgo,
  }
}

function KPICmd({ label, value, unit, help, color, d, deltaInverso, target, badge }) {
  const dl = d != null ? deltaLabel(d) : null
  const dc = d != null ? deltaColor(d, deltaInverso) : null
  return (
    <div className="kpi-resumen-card" title={help}>
      <div className="kpi-resumen-label">
        {label}
        {badge && <span className="kpi-badge">{badge}</span>}
        {help && <span className="kpi-help-icon" aria-label={help}>ⓘ</span>}
      </div>
      <div className="kpi-resumen-value" style={{ color: color || 'var(--text)' }}>
        {value}{unit && <span className="kpi-resumen-unit"> {unit}</span>}
      </div>
      {dl && <div className="kpi-resumen-delta" style={{ color: dc }}>{dl} vs período anterior</div>}
      {target && <div className="kpi-resumen-target">Target: {target}</div>}
    </div>
  )
}

export function ExecutiveModule({ model, navigateTo, holdLoadedAt }) {
  const { prodModel, calidadModel, friccionModel, equipoModel, insights } = model

  if (!prodModel && !calidadModel) return <EmptyState message={COPY.emptyGlobal}/>

  const kpisProd    = prodModel?.kpis
  const kpisCalidad = calidadModel?.kpis
  const kpisHold    = friccionModel?.kpisHold
  const snapshot    = friccionModel?.snapshot
  const leadTime    = friccionModel?.leadTime

  const dTareas = delta(kpisProd?.totalTareas,     prodModel?.prevKpis?.totalTareas)
  const dIds    = delta(kpisProd?.totalIds,         prodModel?.prevKpis?.totalIds)
  const dEf     = delta(kpisCalidad?.efectividadSug, calidadModel?.prevKpis?.efectividadSug)
  const dDia    = delta(kpisProd?.promTareasPorDia,  prodModel?.prevKpis?.promTareasPorDia)

  const holdRate = kpisHold && kpisProd?.totalTareas > 0
    ? kpisHold.idsUnicos / kpisProd.totalTareas : null

  // Timestamp snapshot
  const snapshotLabel = (snapshot?.loadedAt || holdLoadedAt)
    ? (snapshot?.loadedAt || holdLoadedAt).toLocaleTimeString('es-AR', {
        timeZone:'America/Argentina/Buenos_Aires', hour:'2-digit', minute:'2-digit', hour12: false,
      })
    : null

  const criticos   = insights.filter(i => i.severity === 'critico')
  const atenciones = insights.filter(i => i.severity === 'atencion')
  const contextos  = insights.filter(i => i.severity === 'contexto')
  const allAlerts  = [...criticos, ...atenciones, ...contextos]

  const orgLayer = useMemo(() => buildOrgLayer(equipoModel), [equipoModel])
  const acciones = useMemo(() => buildAcciones({ kpisCalidad, kpisHold, prodModel, calidadModel, equipoModel }),
    [kpisCalidad, kpisHold, prodModel, calidadModel, equipoModel])

  // Para mapa de impacto: señal/tendencia (no repetir valor)
  const topError      = calidadModel?.porError?.[0]?.error || null
  const topFlujoHold  = kpisHold ? Object.entries(kpisHold.byFlujo||{}).sort((a,b)=>b[1]-a[1])[0]?.[0] : null

  return (
    <div className="executive-layout">

      {/* ── 1. ESTADO GENERAL ─────────────────────────────────── */}
      <section className="exec-section">
        <div className="exec-section-title">Estado general</div>

        <div className="exec-kpi-group-label">Productividad</div>
        <div className="exec-kpi-grid">
          <KPICmd label="Tareas"
            value={kpisProd ? fmt(kpisProd.totalTareas) : '—'}
            help={COPY.kpis.tareasFinalizadas.help}
            color="var(--accent)" d={dTareas} />
          <KPICmd label="IDs trabajados"
            value={kpisProd ? fmt(kpisProd.totalIds) : '—'}
            help={COPY.kpis.idsTC.help}
            color="#38bdf8" d={dIds} />
          <KPICmd label="IDs por tarea"
            value={kpisProd ? kpisProd.relIdsPorTarea : '—'}
            unit="IDs/tarea"
            help="Cuántos IDs se trabajaron por cada tarea. Si sube, cada tarea involucra más productos y aumenta la carga operativa."
            color="var(--slate)" badge="COMPLEJIDAD" />
          <KPICmd label="Tareas por día activo"
            value={kpisProd ? fmt(kpisProd.promTareasPorDia) : '—'}
            unit="tareas/día"
            help={COPY.kpis.prodPorDia.help}
            color="var(--green)" d={dDia} />
        </div>

        <div className="exec-kpi-group-label">Calidad</div>
        <div className="exec-kpi-grid">
          <KPICmd label="Sugerencias correctas"
            value={kpisCalidad ? `${Math.round(kpisCalidad.efectividadSug*100)}%` : '—'}
            help={COPY.kpis.efSug.help}
            color={kpisCalidad ? nivelColor(kpisCalidad.efectividadSug, THRESHOLDS.calidad.efectividadSug) : 'var(--text3)'}
            d={dEf} target="≥ 90%" badge="Principal" />
          <KPICmd label="Casos correctos"
            value={kpisCalidad ? `${Math.round(kpisCalidad.efectividadCaso*100)}%` : '—'}
            help={COPY.kpis.efCaso.help}
            color={kpisCalidad ? nivelColor(kpisCalidad.efectividadCaso, THRESHOLDS.calidad.efectividadCaso) : 'var(--text3)'}
            badge="Contextual" />
          {kpisCalidad && (
            <KPICmd label="Gap sugerencia vs caso"
              value={`${Math.abs(Math.round((kpisCalidad.efectividadSug - kpisCalidad.efectividadCaso)*100))} pp`}
              help="Diferencia entre efectividad por sugerencia y por caso. Si es alta, hay casos con muchas sugerencias donde cada error tiene más impacto."
              color={Math.abs(kpisCalidad.efectividadSug - kpisCalidad.efectividadCaso) > 0.1 ? 'var(--yellow)' : 'var(--text3)'} />
          )}
        </div>

        <div className="exec-kpi-group-label">Fricción</div>
        <div className="exec-kpi-grid">
          {/* HOLD snapshot — con timestamp integrado en la card */}
          <div className="kpi-resumen-card">
            <div className="kpi-resumen-label">
              % IDs en espera (HOLD)
              {snapshotLabel && <span className="kpi-badge kpi-badge-snapshot">📸 {snapshotLabel}</span>}
              <span className="kpi-help-icon" title={COPY.kpis.holdRelativo.help}>ⓘ</span>
            </div>
            <div className="kpi-resumen-value" style={{ color: holdRate != null
              ? nivelColor(holdRate, THRESHOLDS.friccion.holdRelativo, true) : 'var(--text3)' }}>
              {holdRate != null ? `${Math.round(holdRate*100)}%` : '—'}
            </div>
            {snapshot?.total != null && (
              <div className="kpi-resumen-delta" style={{ color:'var(--text3)' }}>
                {fmt(snapshot.total)} tareas bloqueadas ahora
              </div>
            )}
            <div className="kpi-resumen-target">Meta: &lt; {pct(THRESHOLDS.friccion.holdRelativo.ok)}</div>
          </div>
          {/* Lead time — texto claro sin P50 */}
          <KPICmd
            label="Tiempo típico de resolución"
            value={leadTime?.stats.p50 != null ? diasTexto(leadTime.stats.p50) : '—'}
            help={`La mitad de los bloqueos se resuelven en este tiempo o menos. El 25% más lento tarda más de ${diasTexto(leadTime?.stats.p75)}.`}
            color={leadTime?.stats.p50 != null
              ? nivelColor(leadTime.stats.p50, THRESHOLDS.friccion.leadTimeP50, true) : 'var(--text3)'} />
        </div>
      </section>

      {/* ── 2. ALERTAS ────────────────────────────────────────── */}
      {allAlerts.length > 0 && (
        <section className="exec-section">
          <div className="exec-section-title">
            Alertas y riesgos
            <div className="exec-alert-counts">
              {criticos.length  > 0 && <span className="exec-count exec-count-critico">🔴 {criticos.length} crítico</span>}
              {atenciones.length > 0 && <span className="exec-count exec-count-atencion">🟡 {atenciones.length} atención</span>}
              {contextos.length > 0 && <span className="exec-count exec-count-contexto">🔵 {contextos.length} contexto</span>}
            </div>
          </div>
          <div className="exec-alerts-list">
            {allAlerts.map((ins, i) => (
              <div key={i} className={`alert-item ${SEV[ins.severity].cls}`}>
                <span className="alert-icon">{SEV[ins.severity].icon}</span>
                <div style={{ flex:1 }}>
                  <div className="alert-title">{ins.title}</div>
                  <div className="alert-message">{ins.message}</div>
                  {ins.whyItMatters && <div className="alert-why">Por qué importa: {ins.whyItMatters}</div>}
                  {ins.action && (
                    <button className="insight-action-btn" onClick={() => navigateTo(ins.module)}>
                      {ins.action} →
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* ── 4. MAPA DE IMPACTO ────────────────────────────────── */}
      {/* No repite los valores ya visibles arriba — muestra señal/tendencia */}
      <section className="exec-section">
        <div className="exec-section-title">¿Dónde entrar ahora?</div>
        <div className="exec-impact-grid">
          <ImpactCard title="Productividad" icon="📦"
            signal={dTareas != null
              ? (dTareas >= 0 ? `↑ ${Math.round(dTareas*100)}% vs período anterior`
                             : `↓ ${Math.round(Math.abs(dTareas)*100)}% vs período anterior`)
              : kpisProd ? `${fmt(kpisProd.totalTareas)} tareas` : '—'}
            signalColor={dTareas != null ? deltaColor(dTareas) : 'var(--text3)'}
            context={kpisProd ? `${fmt(kpisProd.totalIds)} IDs · ${kpisProd.relIdsPorTarea}x por tarea` : ''}
            cta="Ver productividad"
            alert={dTareas != null && dTareas < -THRESHOLDS.productividad.caida.warn}
            onClick={() => navigateTo('productividad')} />

          <ImpactCard title="Calidad" icon="✅"
            signal={kpisCalidad
              ? (kpisCalidad.efectividadSug >= 0.9 ? '✓ En target (≥90%)'
                : `⚠ ${Math.round(kpisCalidad.efectividadSug*100)}% — bajo target`)
              : '—'}
            signalColor={kpisCalidad ? nivelColor(kpisCalidad.efectividadSug, THRESHOLDS.calidad.efectividadSug) : 'var(--text3)'}
            context={topError ? `Error dominante: ${topError}` : kpisCalidad ? `${fmt(kpisCalidad.totalSugs)} sugerencias auditadas` : ''}
            cta="Ver calidad"
            alert={kpisCalidad ? kpisCalidad.efectividadSug < THRESHOLDS.calidad.efectividadSug.ok : false}
            onClick={() => navigateTo('calidad')} />

          <ImpactCard title="Fricción" icon="⏸️"
            signal={holdRate != null
              ? `${Math.round(holdRate*100)}% de IDs pasaron por HOLD`
              : snapshot?.total ? `${fmt(snapshot.total)} en HOLD ahora` : '—'}
            signalColor={holdRate != null ? nivelColor(holdRate, THRESHOLDS.friccion.holdRelativo, true) : 'var(--text3)'}
            context={topFlujoHold ? `Flujo más afectado: ${topFlujoHold}` : leadTime?.stats.p50 != null ? `Resolución típica: ${diasTexto(leadTime.stats.p50)}` : ''}
            cta="Ver fricción"
            alert={holdRate != null && holdRate > THRESHOLDS.friccion.holdRelativo.warn}
            onClick={() => navigateTo('friccion')} />

          <ImpactCard title="Equipo" icon="👥"
            signal={orgLayer?.mayorFriccion
              ? `Mayor fricción: ${orgLayer.mayorFriccion.segmento}`
              : prodModel ? `${prodModel.colabActivos} colaboradores activos` : '—'}
            signalColor="var(--text3)"
            context={orgLayer?.peorCalidad
              ? `Peor calidad: ${orgLayer.peorCalidad.segmento} (${Math.round((orgLayer.peorCalidad.efectividadSug||0)*100)}%)`
              : 'Composición y segmentación'}
            cta="Ver equipo"
            onClick={() => navigateTo('equipo')} />
        </div>
      </section>

      {/* ── 5. CAPA ORGANIZACIONAL ────────────────────────────── */}
      {orgLayer && (
        <section className="exec-section">
          <div className="exec-section-title">Señales del equipo</div>
          <div className="exec-org-grid">
            {orgLayer.mayorFriccion && (
              <OrgCard icon="⏸️" label="Mayor fricción" value={orgLayer.mayorFriccion.segmento}
                detail={`${Math.round((orgLayer.mayorFriccion.holdRelativo||0)*100)}% de tareas en espera`}
                color="var(--red)" onClick={() => navigateTo('equipo')} />
            )}
            {orgLayer.peorCalidad && orgLayer.peorCalidad.segmento !== orgLayer.mejorCalidad?.segmento && (
              <OrgCard icon="⚠️" label="Calidad más baja" value={orgLayer.peorCalidad.segmento}
                detail={`${Math.round((orgLayer.peorCalidad.efectividadSug||0)*100)}% sugerencias correctas`}
                color="var(--yellow)"
                onClick={() => navigateTo('calidad', { equipo: orgLayer.peorCalidad.segmento })} />
            )}
            {orgLayer.mejorCalidad && (
              <OrgCard icon="🏆" label="Mejor calidad" value={orgLayer.mejorCalidad.segmento}
                detail={`${Math.round((orgLayer.mejorCalidad.efectividadSug||0)*100)}% sugerencias correctas`}
                color="var(--green)" onClick={() => navigateTo('equipo')} />
            )}
            {orgLayer.segRiesgo && (
              <OrgCard icon="🕐" label="Segmento en riesgo" value={orgLayer.segRiesgo.segmento}
                detail={`Efectividad ${Math.round((orgLayer.segRiesgo.efectividadSug||0)*100)}% — revisar onboarding`}
                color="var(--yellow)" onClick={() => navigateTo('equipo')} />
            )}
          </div>
        </section>
      )}

      {/* ── 6. ACCIONES SUGERIDAS ─────────────────────────────── */}
      <section className="exec-section">
        <div className="exec-section-title">Acciones sugeridas</div>
        <div className="exec-acciones">
          {acciones.map((a, i) => (
            <div key={i} className="exec-accion">
              <span className="exec-accion-num">{i+1}</span>
              <span className="exec-accion-texto">{a.texto}</span>
              {a.module && (
                <button className="insight-action-btn" onClick={() => navigateTo(a.module)}>Ir →</button>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  )
}

function ImpactCard({ title, icon, signal, signalColor, context, cta, alert, onClick }) {
  return (
    <button className={`impact-card${alert ? ' impact-card-alert' : ''}`} onClick={onClick}>
      <div className="impact-card-header">
        <span className="impact-card-icon">{icon}</span>
        <span className="impact-card-title">{title}</span>
      </div>
      <div className="impact-card-signal" style={{ color: signalColor, fontSize:'0.85rem', fontWeight:600, margin:'4px 0 2px' }}>{signal}</div>
      {context && <div className="impact-card-kpi" style={{ fontSize:'0.72rem' }}>{context}</div>}
      <div className="impact-card-cta">{cta} →</div>
    </button>
  )
}

function OrgCard({ icon, label, value, detail, color, onClick }) {
  return (
    <button className="org-card" onClick={onClick}>
      <div className="org-card-icon" style={{ color }}>{icon}</div>
      <div className="org-card-label">{label}</div>
      <div className="org-card-value" style={{ color }}>{value}</div>
      <div className="org-card-detail">{detail}</div>
    </button>
  )
}
