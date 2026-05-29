# Dashboard Operativo — Team Catálogo

Dashboard interno para el monitoreo de productividad, calidad y fricción del equipo de Catálogo MercadoLibre.

**Stack:** React 18 · Vite 5 · Recharts · PapaParse · GitHub Pages

---

## Inicio rápido

```bash
git clone https://github.com/catalogo-meli/dashboard.git
cd dashboard
npm install
npm run dev        # http://localhost:5173
```

Para deployar:

```bash
npm run deploy     # build + push a gh-pages automático
```

---

## Estructura del proyecto

```
src/
  config/
    datasources.js        # URLs y metadata de cada fuente de datos
    thresholds.js         # Umbrales de alerta (calidad, fricción, etc.)
    copy.js               # Textos y labels del dashboard
    segments.js           # Definición de segmentos de antigüedad
  hooks/
    useDataLoader.js      # Carga paralela de CSVs con manejo de opcionales
    useGlobalFilters.js   # Filtros globales reactivos (período, equipo, rol, etc.)
    useCalidadFilters.js  # Filtros específicos de calidad
    useDashboardModel.js  # Modelo central: KPIs, rankings, insights
    useTableSort.jsx      # Hook de ordenamiento de tablas (asc/desc/default)
    useGitHubFileDate.js  # Fecha de último commit vía GitHub API pública
  utils/
    normalizers.js        # Normalización tipada por dataset
    parsers.js            # Parseo de fechas y números
    exportUtils.js        # Formateo y descarga de CSVs y ZIPs
    metrics/              # KPIs, rankings y métricas por módulo
    selectors/            # Joins entre datasets y estado de URL
  components/
    ui/index.jsx          # Componentes reutilizables (KPICard, tablas, badges)
    FiltersBar.jsx        # Barra de filtros globales
  modules/
    ExecutiveModule.jsx   # Resumen ejecutivo, alertas y acciones sugeridas
    ProductividadModule.jsx
    CalidadModule.jsx     # SdC y MAO con toggle, doble métrica sug/caso
    FriccionModule.jsx    # HOLD histórico y snapshot en vivo (sub-tabs)
    EquipoModule.jsx      # Performance por segmento y directorio
    IndividualModule.jsx  # Perfil individual y comparación entre pares
public/
  data/                   # CSVs de datos — reemplazar para actualizar
```

---

## Fuentes de datos

Los archivos van en `public/data/`. El dashboard los carga en paralelo al iniciar.

| Archivo | Contenido | Requerido |
|---|---|---|
| `historico.csv` | Registro operativo de tareas | ✅ |
| `auditados.csv` | Auditorías SdC | ✅ |
| `equipo_colaboradores.csv` | Padrón del equipo activo | ✅ |
| `hold.csv` | Snapshot de tareas en HOLD | ✅ |
| `auditados_mao.csv` | Auditorías MAO | Opcional |

Los archivos opcionales no generan error si no están — el dashboard desactiva las funcionalidades asociadas.

---

Nota: `historico.csv` tambien puede publicarse dividido en partes listadas en `historico.manifest.json`; el dashboard concatena esas partes automaticamente.

## Esquema de columnas

### `historico.csv`
```
Fecha, Usuario, Flujo de Tarea, ID - LINK, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

Tambien se acepta la estructura nueva:

```
Fecha, Usuario, Flujo de Tarea, ID Sugerencia | ID Ticket, ID CDM, GROUP_ID, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

### `auditados.csv`
```
ultimaActualizacion, id_caso, casoId, sugerencia_id, Dominio, usuario,
estado_caso, suggestion_reason, Auditor, EstadoFinal_esCorrecto,
Motivo_de_Rechazo_esCorrecto, Accion_Correcta, Casuisticas, Comentario
```

### `auditados_mao.csv`
```
FECHA_ACCIONAMIENTO, ID_CDM, productora, COLABORADOR, DOMINIO, RESOLUCION,
Auditor, EstadoFinal_esCorrecto, Motivo_de_Rechazo_esCorrecto, Casuisticas, Comentario
```

### `equipo_colaboradores.csv`
```
ID_MELI, Nombre, Slack_ID, Rol, Equipo, Ubicacion, Fecha Ingreso, CUIL, Mail Productora, Mail Externo
```

### `hold.csv`
```
Usuario, Flujo de Tarea, ID - LINK, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

---

## Reglas de negocio

**Productividad**
- Fuente única: `historico.csv`. Una fila = una tarea.
- El campo `IDs trabajados` indica el volumen real (fallback a 1 si está vacío).
- Día hábil = cualquier fecha con al menos un registro del colaborador.

**Calidad SdC**
- Métrica principal: por `sugerencia_id`. Métrica contextual: por `id_caso`.
- Clasificación por `EstadoFinal_esCorrecto` + `Motivo_de_Rechazo_esCorrecto`:
  - Ambos OK → Correcto
  - EstadoFinal OK + Motivo NOT OK → Desvío leve
  - EstadoFinal NOT OK → Desvío grave

**Calidad MAO**
- Unidad de medida: acción auditada (cada fila = un ítem trabajado sobre un `ITEM_ID`).
- Un mismo `ID_CDM` puede tener múltiples filas (distintos ítems dentro del mismo PDP).
- Misma lógica de clasificación que SdC.

**HOLD**
- Histórico: filas con `Status == HOLD` en `historico.csv`.
- Snapshot: `hold.csv` completo, representa el estado actual.
- `Días en HOLD` se calcula cruzando snapshot contra historico completo (sin filtro de fecha).

**Colaboradores fuera de padrón**
- Colaboradores en datos históricos pero ausentes de `equipo_colaboradores.csv` se agrupan como "Fuera de padrón actual". No aparecen en rankings ni señales del equipo.

---

## Actualizar datos

```bash
cp ~/exports/historico.csv public/data/
cp ~/exports/auditados.csv public/data/
# etc.

git add public/data/
git commit -m "datos: actualización semana 15"
git push
```

El workflow de GitHub Actions deployará automáticamente.

### Historico mayor a 25 MB

Si GitHub no permite subir `historico.csv` desde la web por superar 25 MB, dividilo en partes menores y subi esas partes a `public/data/` junto con el manifiesto:

```bash
npm run split:historico -- ~/exports/historico.csv public/data 20
git add public/data/historico_part_*.csv public/data/historico.manifest.json
git commit -m "datos: actualizacion historico por partes"
git push
```

El dashboard lee `historico.manifest.json` si existe. Si el manifiesto apunta a partes, carga y concatena todas; si no existe, usa `historico.csv` como fallback.

---

## Configuración

| Archivo | Qué configura |
|---|---|
| `src/config/datasources.js` | URLs de los CSVs y flags de opcionalidad |
| `src/config/thresholds.js` | Umbrales para alertas (calidad, fricción, productividad) |
| `src/config/copy.js` | Textos y labels visibles del dashboard |

---

## Deploy

El repo usa GitHub Actions para deploy automático a `gh-pages` en cada push a `main`. Requiere que GitHub Pages esté habilitado apuntando a la rama `gh-pages`.

Para deploy manual:

```bash
npm run build    # genera dist/
npm run deploy   # sube dist/ a gh-pages
```
