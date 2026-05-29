# Dashboard Operativo - Team Catalogo

Dashboard interno para seguimiento de productividad, calidad y friccion operativa del equipo de Catalogo.

## Stack

- React 18
- Vite
- Recharts
- PapaParse
- GitHub Pages

## Desarrollo

```bash
npm install
npm run dev
```

Servidor local: `http://localhost:5173`

Build de produccion:

```bash
npm run build
```

Deploy manual:

```bash
npm run deploy
```

## Estructura

```text
src/
  components/      Componentes compartidos
  config/          Fuentes, umbrales, textos y segmentos
  hooks/           Carga de datos, filtros y modelos de vista
  modules/         Vistas principales del dashboard
  utils/           Normalizacion, parseo, exportacion y metricas

public/data/       CSVs publicados junto con la app
scripts/           Utilidades de mantenimiento de datos
```

## Datos

Los datasets se publican en `public/data/`.

| Archivo | Uso | Requerido |
|---|---|---|
| `historico_part_*.csv` o `historico.csv` | Registro operativo de tareas | Si |
| `auditados.csv` | Auditorias SdC | Si |
| `equipo_colaboradores.csv` | Padron del equipo activo | Si |
| `hold.csv` | Snapshot de tareas en HOLD | Si |
| `auditados_mao.csv` | Auditorias MAO | No |
| `tiempos_cdm.csv` | Tiempos de accionamiento CDM | No |

El historico puede publicarse completo como `historico.csv` o dividido en partes declaradas en `historico.manifest.json`. Cuando existe el manifiesto, el dashboard carga todos los archivos listados y los concatena en memoria.

Ejemplo:

```json
{
  "files": [
    "historico_part_001.csv",
    "historico_part_002.csv"
  ]
}
```

## Esquemas

### Historico

Estructura vigente:

```text
Fecha, Usuario, Flujo de Tarea, ID Sugerencia | ID Ticket, ID CDM, GROUP_ID, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

Tambien se mantiene compatibilidad con el encabezado anterior:

```text
Fecha, Usuario, Flujo de Tarea, ID - LINK, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

Notas:

- `ID Sugerencia | ID Ticket` identifica la sugerencia o ticket resuelto.
- `ID CDM` identifica la tarjeta de origen. Puede agrupar una o mas sugerencias/tickets.
- `GROUP_ID` se informa cuando la tarea implico una creacion o modificacion via Brand Central.

### Hold

```text
Usuario, Flujo de Tarea, ID Sugerencia | ID Ticket, ID CDM, GROUP_ID, Status, Iniciativa, Incidencias, IDs trabajados, Comentarios
```

Tambien acepta `ID - LINK` para archivos anteriores.

### Auditorias SdC

```text
ultimaActualizacion, id_caso, casoId, sugerencia_id, Dominio, usuario,
estado_caso, suggestion_reason, Auditor, EstadoFinal_esCorrecto,
Motivo_de_Rechazo_esCorrecto, Accion_Correcta, Casuisticas, Comentario
```

### Auditorias MAO

```text
FECHA_ACCIONAMIENTO, ID_CDM, productora, COLABORADOR, DOMINIO, RESOLUCION,
Auditor, EstadoFinal_esCorrecto, Motivo_de_Rechazo_esCorrecto, Casuisticas, Comentario
```

### Equipo

```text
ID_MELI, Nombre, Slack_ID, Rol, Equipo, Ubicacion, Fecha Ingreso, CUIL, Mail Productora, Mail Externo
```

## Actualizacion del historico

El historico se mantiene fuera del repo como fuente maestra, por ejemplo en Google Sheets. Para actualizar el dashboard:

1. Exportar la hoja como CSV.
2. Separar el archivo por trimestre o por tamano si supera el limite de GitHub.
3. Copiar las partes a `public/data/`.
4. Actualizar `public/data/historico.manifest.json`.
5. Commit y push.

Para generar partes por tamano:

```bash
npm run split:historico -- ~/exports/historico.csv public/data 20
```

El tercer parametro es el tamano maximo por parte, en MB.

## Reglas de negocio

Productividad:

- Fuente unica: historico.
- Una fila representa una tarea.
- `IDs trabajados` representa volumen operativo; si viene vacio se toma como `1`.
- Un dia activo es cualquier fecha con al menos un registro del colaborador.

Calidad:

- SdC usa `sugerencia_id` como unidad principal.
- MAO usa la accion auditada como unidad de medicion.
- La clasificacion se deriva de `EstadoFinal_esCorrecto` y `Motivo_de_Rechazo_esCorrecto`.

HOLD:

- El historico aporta tendencia y recurrencia.
- `hold.csv` representa el snapshot vigente.
- Los dias en HOLD se calculan cruzando el snapshot contra el historico completo.

## Configuracion

| Archivo | Descripcion |
|---|---|
| `src/config/datasources.js` | Fuentes de datos y cobertura |
| `src/config/thresholds.js` | Umbrales de alertas |
| `src/config/copy.js` | Textos visibles |
| `src/config/segments.js` | Segmentos de antiguedad |
