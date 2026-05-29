// Generacion de alertas e insights del resumen ejecutivo.
import { THRESHOLDS } from '../../config/thresholds.js'

const SEV = { CRITICO: 'critico', ATENCION: 'atencion', CONTEXTO: 'contexto' }

function pct(v) { return `${Math.round((v ?? 0) * 100)}%` }
function fmt(v) { return (v ?? 0).toLocaleString('es-AR') }
function d(a, b) { return (b == null || b === 0) ? null : (a - b) / Math.abs(b) }

export function generarInsights({ kpisProd, kpisCalidad, kpisHold, snapshot, leadTime,
  prevKpisProd, prevKpisCalidad, semanas, rankColab,
  porDominio, porError, equipoPerf, coverage }) {
  const ins = []

  // Calidad
  if (kpisCalidad) {
    const ef = kpisCalidad.efectividadSug
    if (ef < THRESHOLDS.calidad.efectividadSug.warn) {
      ins.push({ severity: SEV.CRITICO,
        title: 'Efectividad de calidad por debajo del target',
        message: `Solo el ${pct(ef)} de las sugerencias auditadas son correctas. El target es 90%.`,
        whyItMatters: 'Es la métrica principal de calidad del cliente. Un valor bajo impacta directamente la percepción del servicio.',
        action: 'Revisá el tab Calidad → Distribución por dominio y por código de error.',
        module: 'calidad' })
    } else if (ef < THRESHOLDS.calidad.efectividadSug.ok) {
      ins.push({ severity: SEV.ATENCION,
        title: 'Efectividad de calidad cerca del límite',
        message: `${pct(ef)} de sugerencias correctas — por encima del target pero con margen reducido.`,
        whyItMatters: 'Una caída pequeña puede cruzar el umbral de 90%.',
        action: 'Monitoreá la evolución semanal en Calidad.',
        module: 'calidad' })
    }

    const gravePct = kpisCalidad.totalSugs > 0 ? (kpisCalidad.bySug?.desvio_grave || 0) / kpisCalidad.totalSugs : 0
    // Solo alertar sobre errores graves si además la efectividad general está bajo target.
    // Si el equipo cumple el objetivo de calidad (≥90%), un % de graves es contexto, no alarma.
    if (gravePct >= THRESHOLDS.calidad.desvioGravePct.warn && ef < THRESHOLDS.calidad.efectividadSug.ok) {
      ins.push({ severity: SEV.ATENCION,
        title: 'Concentración de errores graves',
        message: `El ${pct(gravePct)} de las sugerencias tienen desvío grave (${fmt(kpisCalidad.bySug?.desvio_grave)} sugerencias).`,
        whyItMatters: 'Los errores graves son los de mayor impacto en la calidad percibida.',
        action: 'Identificá qué dominios y colaboradores concentran los desvíos graves.',
        module: 'calidad' })
    }

    if (prevKpisCalidad) {
      const delta = d(ef, prevKpisCalidad.efectividadSug)
      if (delta != null && delta < -THRESHOLDS.productividad.caida.warn) {
        ins.push({ severity: SEV.ATENCION,
          title: 'La calidad cayó vs el período anterior',
          message: `La efectividad por sugerencia bajó ${pct(Math.abs(delta))} respecto del período previo.`,
          whyItMatters: 'Una tendencia descendente puede volverse sistémica.',
          action: 'Revisá la evolución semanal y qué cambió en el período.',
          module: 'calidad' })
      }
    }
  }

  // Concentracion de errores
  if (porError?.length) {
    const totalDesv = porError.reduce((s, e) => s + (e.total - (e.correcto || 0)), 0)
    const top3 = porError.slice(0, 3).reduce((s, e) => s + (e.total - (e.correcto || 0)), 0)
    const conc = totalDesv > 0 ? top3 / totalDesv : 0
    if (conc >= THRESHOLDS.concentracion.erroresTop3.warn) {
      ins.push({ severity: SEV.ATENCION,
        title: 'Los errores se concentran en pocos códigos',
        message: `Los 3 códigos de error más frecuentes explican el ${pct(conc)} de todos los desvíos.`,
        whyItMatters: 'Alta concentración = el problema es focalizado. Una sola acción correctiva puede tener gran impacto.',
        action: `Revisá los códigos "${porError.slice(0,3).map(e=>e.error).join('", "')}" en el tab Calidad.`,
        module: 'calidad' })
    }
  }

  // Productividad
  if (kpisProd && prevKpisProd) {
    const delta = d(kpisProd.totalTareas, prevKpisProd.totalTareas)
    if (delta != null && delta < -THRESHOLDS.productividad.caida.critico) {
      ins.push({ severity: SEV.CRITICO,
        title: 'Caída crítica de tareas',
        message: `Las tareas bajaron ${pct(Math.abs(delta))} vs el período anterior (${fmt(prevKpisProd.totalTareas)} → ${fmt(kpisProd.totalTareas)}).`,
        whyItMatters: 'Una caída de esta magnitud puede indicar ausencias, bloqueos o cambios en la distribución de flujos.',
        action: 'Revisá capacidad (colaboradores activos) y fricción (HOLD) en el período.',
        module: 'productividad' })
    } else if (delta != null && delta < -THRESHOLDS.productividad.caida.warn) {
      ins.push({ severity: SEV.ATENCION,
        title: 'Caída de tareas vs período anterior',
        message: `Las tareas bajaron ${pct(Math.abs(delta))} respecto del período previo.`,
        whyItMatters: 'Puede indicar menor capacidad, más fricción o cambio en la composición del trabajo.',
        action: 'Revisá Productividad → Capacidad y Fricción.',
        module: 'productividad' })
    }

    // IDs trabajados también
    const deltaIds = d(kpisProd.totalIds, prevKpisProd.totalIds)
    if (deltaIds != null && Math.abs(deltaIds) > 0.15 && delta != null && Math.sign(deltaIds) !== Math.sign(delta)) {
      ins.push({ severity: SEV.CONTEXTO,
        title: 'Tareas e IDs evolucionaron en direcciones distintas',
        message: `Las tareas variaron ${pct(delta || 0)} y los IDs trabajados variaron ${pct(deltaIds)} en el mismo período.`,
        whyItMatters: 'Significa que cambió la complejidad promedio de las tareas (más o menos IDs por tarea).',
        action: 'Revisá la relación IDs/tarea en el tab Productividad.',
        module: 'productividad' })
    }
  }

  if (semanas?.length >= 2) {
    const last = semanas[semanas.length - 1]
    const prev = semanas[semanas.length - 2]
    const semanaCompleta = (last.diasHabiles ?? 0) >= 4
    if (!semanaCompleta) {
      // Semana en curso con datos parciales — no comparar con la semana anterior
      ins.push({ severity: SEV.CONTEXTO,
        title: `Semana ${last.week} — dato parcial`,
        message: `La semana ${last.week} aún está en curso (${last.diasHabiles ?? 0} día${last.diasHabiles === 1 ? '' : 's'} con actividad). El total de tareas va a ser menor al esperado.`,
        whyItMatters: 'Comparar contra una semana incompleta puede generar falsas alarmas de caída de productividad.',
        action: 'Esperá al cierre de la semana para evaluar el resultado real.',
        module: 'productividad' })
    } else {
      const dSem = d(last.totalTareas, prev.totalTareas)
      if (dSem != null && dSem < -THRESHOLDS.productividad.caida.warn) {
        ins.push({ severity: SEV.ATENCION,
          title: `Caída de productividad en la semana ${last.week}`,
          message: `Sem ${last.week}: ${fmt(last.totalTareas)} tareas, un ${pct(Math.abs(dSem))} menos que la semana anterior.`,
          whyItMatters: 'Caídas semanales sostenidas son señal temprana de problemas.',
          action: 'Revisá flujos y capacidad en esa semana.',
          module: 'productividad' })
      }
    }
  }

  // Friccion
  if (kpisHold && kpisProd) {
    const hr = kpisProd.totalTareas > 0 ? kpisHold.idsUnicos / kpisProd.totalTareas : 0
    if (hr >= THRESHOLDS.friccion.holdRelativo.warn) {
      ins.push({ severity: SEV.CRITICO,
        title: '% de IDs en espera en nivel crítico',
        message: `El ${pct(hr)} de las tareas tuvieron IDs en HOLD — por encima del umbral del ${pct(THRESHOLDS.friccion.holdRelativo.warn)}.`,
        whyItMatters: 'Un alto % de espera indica dependencias externas frecuentes que traban el flujo.',
        action: 'Revisá flujos e incidencias en el tab Fricción.',
        module: 'friccion' })
    } else if (hr >= THRESHOLDS.friccion.holdRelativo.ok) {
      ins.push({ severity: SEV.ATENCION,
        title: '% de IDs en espera en zona de atención',
        message: `El ${pct(hr)} de las tareas tuvieron IDs en HOLD.`,
        whyItMatters: 'Dentro del rango tolerable, pero conviene monitorear la tendencia.',
        action: 'Revisá la evolución en Fricción.',
        module: 'friccion' })
    }
  }

  if (leadTime?.stats.p75 > THRESHOLDS.friccion.leadTimeP75.warn) {
    ins.push({ severity: SEV.ATENCION,
      title: 'Los bloqueos tardan en resolverse',
      message: `El 25% de los bloqueos HOLD tarda más de ${leadTime.stats.p75} días en cerrarse.`,
      whyItMatters: 'Bloqueos prolongados afectan la predictibilidad del flujo.',
      action: 'Revisá qué incidencias tienen mayor tiempo de espera en Fricción.',
      module: 'friccion' })
  }

  // Segmentacion organizacional
  // Excluir "Fuera de padrón actual" de señales del equipo activo
  const equipoPerfActivo = (equipoPerf || []).filter(s => s.segmento !== 'Fuera de padrón actual')
  if (equipoPerfActivo.length >= 2) {
    const sorted = [...equipoPerfActivo].filter(s => s.efectividadSug != null).sort((a, b) => b.efectividadSug - a.efectividadSug)
    if (sorted.length >= 2) {
      const gap = sorted[0].efectividadSug - sorted[sorted.length-1].efectividadSug
      if (gap > 0.15) {
        ins.push({ severity: SEV.ATENCION,
          title: 'Brecha de calidad entre segmentos del equipo',
          message: `Diferencia de ${pct(gap)} de efectividad entre "${sorted[0].segmento}" (${pct(sorted[0].efectividadSug)}) y "${sorted[sorted.length-1].segmento}" (${pct(sorted[sorted.length-1].efectividadSug)}).`,
          whyItMatters: 'Una brecha estructural sugiere diferencias en proceso, soporte o carga — no solo en desempeño individual.',
          action: 'Revisá el tab Equipo para entender el patrón y si se repite en otras métricas.',
          module: 'equipo' })
      }
    }
  }

  // Cobertura: eliminado — el desfase entre auditorías y operativo
  // depende del modelo de auditoría del cliente, no es accionable por el equipo.

  return ins
}
