export const DATA_SOURCES = {
  historico: {
    id: 'historico', label: 'Histórico Operativo', type: 'csv',
    url: './data/historico.csv', coverageLabel: 'Feb–Mar 2026',
  },
  auditados: {
    id: 'auditados', label: 'Auditorías SdC', type: 'csv',
    url: './data/auditados.csv', coverageLabel: 'Dic 2025–Mar 2026',
  },
  auditados_mao: {
    id: 'auditados_mao', label: 'Auditorías MAO', type: 'csv',
    url: './data/auditados_mao.csv', coverageLabel: 'Dic 2025–Mar 2026',
    optional: true,
  },
  hold: {
    id: 'hold', label: 'HOLD Activo', type: 'csv',
    url: './data/hold.csv', coverageLabel: 'Snapshot 31/03/2026',
  },
  equipo: {
    id: 'equipo', label: 'Equipo Colaboradores', type: 'csv',
    url: './data/equipo_colaboradores.csv', coverageLabel: 'Actual',
  },
}

export const APP_CONFIG = {
  title: 'Team Catálogo',
  subtitle: 'Monitoreo operativo',
  refreshIntervalMs: null,
  cacheMs: 5 * 60 * 1000,
}
