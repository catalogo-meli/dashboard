// Textos visibles del dashboard.
export const COPY = {
  // Estados del sistema
  loading:       'Cargando datos. Esto puede tardar unos segundos.',
  loadingFilter: 'Actualizando con los filtros elegidos.',
  empty:         'No hay datos para esta combinación de filtros. Probá ampliar el período o quitar algún filtro.',
  emptyGlobal:   'Sin datos disponibles. Verificá que los archivos CSV estén cargados correctamente.',
  errorCarga:    'No pudimos cargar los datos. Recargá la página o verificá la conexión.',
  errorFiltros:  'No pudimos aplicar los filtros. Limpialos o recargá la vista.',
  parcial:       'Parte de esta vista usa datos con cobertura distinta. Revisá la cobertura antes de comparar.',
  snapshotViejo: 'El snapshot de HOLD activo puede estar desactualizado. Los datos reflejan el estado al momento de la última carga del archivo.',

  // Filtros
  filtros: {
    preset:           'Período',
    fechaDesde:       'Desde',
    fechaHasta:       'Hasta',
    semana:           'Semana',
    colaborador:      'Colaborador',
    flujo:            'Flujo',
    rol:              'Rol',
    equipo:           'Equipo',
    ubicacion:        'Ubicación',
    segAnti:          'Antigüedad',
    extUser:          'Tipo',
    status:           'Estado',
    auditor:          'Auditor',
    dominio:          'Dominio',
    suggestionReason: 'Código de error',
    calidad:          'Tipo de desvío',
  },
  placeholder: {
    semana:           'Todas las semanas',
    colaborador:      'Todos los colaboradores',
    flujo:            'Todos los flujos',
    rol:              'Todos los roles',
    equipo:           'Todos los equipos',
    ubicacion:        'Todas las ubicaciones',
    segAnti:          'Todas las antigüedades',
    extUser:          'Todos los tipos',
    status:           'Todos los estados',
    auditor:          'Todos los auditores',
    dominio:          'Todos los dominios',
    suggestionReason: 'Todos los códigos',
    calidad:          'Todos los desvíos',
  },

  // ─── KPIs — label + help ──────────────────────────────────────
  kpis: {
    tareasFinalizadas: {
      label: 'Tareas',
      help:  'Cantidad de tareas registradas en el período. Una tarea = un registro en el histórico operativo. No confundir con IDs trabajados.',
    },
    idsTC: {
      label: 'IDs trabajados',
      help:  'Cantidad de productos (IDs) distintos accionados al ejecutar las tareas. Un solo ID puede involucrar varias sugerencias. Este número es diferente al de tareas.',
    },
    relTareasIds: {
      label: 'IDs por tarea',
      help:  'Cuántos IDs se trabajaron en promedio por cada tarea finalizada. Si sube, cada tarea involucra más productos.',
    },
    prodPorDia: {
      label: 'Tareas por día activo',
      help:  'Cuántas tareas finaliza el equipo en días con actividad real registrada. Mide eficiencia operativa, no solo presencia.',
    },
    idsPorDia: {
      label: 'IDs por día activo',
      help:  'Cuántos IDs trabaja el equipo en días con actividad real. Complementa la métrica de tareas para entender el volumen de productos accionados.',
    },
    colaborActivos: {
      label: 'Colaboradores activos',
      help:  'Personas que registraron al menos una tarea en el período.',
    },
    diasActivos: {
      label: 'Días activos (promedio)',
      help:  'Promedio de días con actividad por colaborador. Caídas pueden indicar ausencias o menor operación.',
    },
    efSug: {
      label: 'Sugerencias correctas',
      help:  'Métrica principal de calidad definida por el cliente. Porcentaje de sugerencias auditadas sin error. Target: 90%.',
      unit:  '%',
    },
    efCaso: {
      label: 'Casos correctos',
      help:  'Porcentaje de casos en que TODAS las sugerencias son correctas. Métrica contextual — complementa la vista por sugerencia.',
      unit:  '%',
    },
    holdRelativo: {
      label: '% IDs en espera',
      help:  'Porcentaje de IDs únicos que pasaron por estado HOLD sobre el total procesado. Si sube, la operación pierde fluidez.',
      unit:  '%',
    },
    leadTimeP50: {
      label: 'Días en espera (mediana)',
      help:  'La mitad de los bloqueos HOLD se resuelven en este tiempo o menos. Mide la velocidad de resolución de dependencias.',
      unit:  'días',
    },
    gapAuditoria: {
      label: 'Desfase de auditoría',
      help:  'Días de diferencia entre la última fecha operativa y la última auditoría. Si es alto, la calidad refleja trabajo anterior, no el actual.',
      unit:  'días',
    },
  },

  // ─── Módulos ──────────────────────────────────────────────────
  modules: {
    prodVolumen:       'Volumen bruto sin ponderación por complejidad. Un ID en Soporte puede requerir más trabajo que uno en Demanda.',
    prodTareasVsIds:   'Tareas y IDs son métricas distintas. Una tarea puede involucrar múltiples IDs. No las uses como sinónimos.',
    calidadPrincipal:  'La calidad se mide principalmente por sugerencia_id — definición del cliente. La vista por caso agrega contexto, no reemplaza.',
    friccionQue:       'HOLD = tarea bloqueada por dependencia externa (ticket, seller, herramienta). No es un error del colaborador.',
    holdSnapshot:      'Esta vista refleja el estado ACTUAL de las tareas en HOLD, al momento de la última actualización del archivo.',
    equipoContexto:    'Usá esta capa para detectar diferencias entre segmentos del equipo, no solo entre personas.',
    comparPeriodo:     'El período anterior tiene la misma duración que el actual, calculado automáticamente hacia atrás.',
  },

  // ─── Actualización de archivos ────────────────────────────────
  upload: {
    titulo:        'Actualizar datos',
    descripcion:   'Para actualizar el dashboard, reemplazá los archivos CSV en la carpeta /public/data del repositorio. Los archivos deben tener exactamente los nombres indicados.',
    instruccion:   'Subí los archivos CSV con los nombres correctos. El dashboard se actualizará al recargar la página.',
    advertencia:   'Esta función no sube archivos al repositorio directamente. Descargá el archivo procesado y reemplazalo en /public/data/ del repo.',
    exito:         'Archivo validado correctamente. Descargalo y reemplazalo en el repositorio para actualizar el dashboard.',
    error:         'El archivo no pudo validarse. Revisá que sea un CSV con el formato correcto.',
    archivoMal:    'El nombre del archivo no coincide con ninguno esperado.',
    columnasError: 'Faltan columnas requeridas: ',
  },
}
