import 'dotenv/config'
import { readFile } from 'node:fs/promises'
import path from 'node:path'
import { sql } from 'drizzle-orm'

interface FloweringPeriod {
  scientificName: string
  startMonth: number
  endMonth: number
  region: string
  sourceName: string
  sourceUrl: string
}

function parsePeriod(value: unknown, index: number): FloweringPeriod {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) {
    throw new Error(`Registro ${index + 1}: se esperaba un objeto`)
  }
  const row = value as Record<string, unknown>
  const stringFields = ['scientificName', 'region', 'sourceName', 'sourceUrl'] as const
  for (const field of stringFields) {
    if (typeof row[field] !== 'string' || row[field].trim() === '') {
      throw new Error(`Registro ${index + 1}: ${field} es obligatorio`)
    }
  }
  for (const field of ['startMonth', 'endMonth'] as const) {
    if (!Number.isInteger(row[field]) || Number(row[field]) < 1 || Number(row[field]) > 12) {
      throw new Error(`Registro ${index + 1}: ${field} debe ser un mes entre 1 y 12`)
    }
  }
  let url: URL
  try { url = new URL(row.sourceUrl as string) } catch { throw new Error(`Registro ${index + 1}: sourceUrl no es una URL`) }
  if (url.protocol !== 'http:' && url.protocol !== 'https:') {
    throw new Error(`Registro ${index + 1}: sourceUrl debe usar http o https`)
  }
  return {
    scientificName: (row.scientificName as string).trim(),
    startMonth: Number(row.startMonth),
    endMonth: Number(row.endMonth),
    region: (row.region as string).trim(),
    sourceName: (row.sourceName as string).trim(),
    sourceUrl: url.toString(),
  }
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env')
  const fileArgument = process.argv.slice(2).find((arg) => arg.startsWith('--file='))?.slice('--file='.length)
  if (!fileArgument) throw new Error('Uso: npm run import:floracion -- --file=data/flowering-periods.json')
  const file = path.resolve(fileArgument)
  const parsed: unknown = JSON.parse(await readFile(file, 'utf8'))
  if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('El fichero debe ser un array JSON con al menos un periodo')
  const periods = parsed.map(parsePeriod)

  // Importar el módulo después de validar el fichero evita cargar la conexión si hay errores de formato.
  const { db } = await import('../db/index.js')
  const catalog = await db.execute<{ scientificName: string }>(sql`select distinct scientific_name as "scientificName" from species`)
  const knownNames = new Set(catalog.rows.map((row) => row.scientificName.toLocaleLowerCase()))
  const unmatched = [...new Set(periods.map((row) => row.scientificName)
    .filter((name) => !knownNames.has(name.toLocaleLowerCase())))]
  if (unmatched.length > 0) {
    throw new Error(`No hay coincidencia científica exacta para: ${unmatched.join(', ')}`)
  }

  const statements = periods.map((row) => db.execute(sql`
    insert into species_flowering_periods (species_id, start_month, end_month, region, source_name, source_url)
    select s.id, ${row.startMonth}, ${row.endMonth}, ${row.region}, ${row.sourceName}, ${row.sourceUrl}
    from species s where lower(s.scientific_name) = lower(${row.scientificName})
    on conflict (species_id, start_month, end_month, region, source_url)
    do update set source_name = excluded.source_name`))
  const [firstStatement, ...remainingStatements] = statements
  if (firstStatement === undefined) throw new Error('El fichero no contiene periodos')
  await db.batch([firstStatement, ...remainingStatements])

  console.log(`Periodos importados/actualizados: ${periods.length}`)
  console.log(`Especies incluidas: ${new Set(periods.map((row) => row.scientificName.toLocaleLowerCase())).size}`)
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudieron importar los periodos de floración')
  process.exitCode = 1
})
