import fs from 'node:fs/promises'
import path from 'node:path'
import Papa from 'papaparse'

const [, , inputArg, outputArg = 'public/data', maxMbArg = '20'] = process.argv

if (!inputArg) {
  console.error('Uso: npm run split:historico -- <historico.csv> [public/data] [max_mb]')
  process.exit(1)
}

const inputPath = path.resolve(inputArg)
const outputDir = path.resolve(outputArg)
const maxBytes = Math.floor(Number(maxMbArg) * 1024 * 1024)

if (!Number.isFinite(maxBytes) || maxBytes <= 0) {
  console.error('max_mb debe ser un numero positivo.')
  process.exit(1)
}

const text = await fs.readFile(inputPath, 'utf8')
const parsed = Papa.parse(text, {
  header: true,
  skipEmptyLines: true,
  dynamicTyping: false,
})

if (parsed.errors?.length) {
  console.warn(`PapaParse reporto ${parsed.errors.length} advertencias. Se continua con las filas parseadas.`)
}

const rows = parsed.data.filter(row => Object.values(row).some(value => String(value ?? '').trim()))
const fields = parsed.meta.fields || Object.keys(rows[0] || {})

if (!fields.length || !rows.length) {
  console.error('El CSV no tiene encabezados o filas validas.')
  process.exit(1)
}

await fs.mkdir(outputDir, { recursive: true })

const headerLine = Papa.unparse([Object.fromEntries(fields.map(field => [field, field]))], {
  columns: fields,
  header: false,
})
const headerBytes = Buffer.byteLength(`${headerLine}\n`, 'utf8')

const files = []
let part = 1
let chunkRows = []
let chunkBytes = headerBytes

async function flushChunk() {
  if (!chunkRows.length) return
  const name = `historico_part_${String(part).padStart(3, '0')}.csv`
  const csv = Papa.unparse(chunkRows, { columns: fields, header: true, newline: '\n' })
  await fs.writeFile(path.join(outputDir, name), `${csv}\n`, 'utf8')
  files.push(name)
  part += 1
  chunkRows = []
  chunkBytes = headerBytes
}

for (const row of rows) {
  const rowLine = Papa.unparse([row], { columns: fields, header: false })
  const rowBytes = Buffer.byteLength(`${rowLine}\n`, 'utf8')
  if (chunkRows.length && chunkBytes + rowBytes > maxBytes) {
    await flushChunk()
  }
  chunkRows.push(row)
  chunkBytes += rowBytes
}

await flushChunk()

const manifest = {
  files,
  rowCount: rows.length,
  sourceFile: path.basename(inputPath),
  maxBytes,
  generatedAt: new Date().toISOString(),
}

await fs.writeFile(
  path.join(outputDir, 'historico.manifest.json'),
  `${JSON.stringify(manifest, null, 2)}\n`,
  'utf8',
)

console.log(`Historico dividido en ${files.length} archivo(s), ${rows.length} filas.`)
console.log(`Manifest: ${path.join(outputDir, 'historico.manifest.json')}`)
