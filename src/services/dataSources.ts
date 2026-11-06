import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'

export type DataSource = {
  code: string; provider: string; name: string; url: string
  license: string; licenseUrl: string; attribution: string
  logoUrl: string | null; lastDownloadedAt: string | null
  /** Solo en /sources: plantas guardadas de esta fuente. */
  storedRecords?: number
}

const fields = sql`d.code, d.provider, d.name, d.url, d.license, d.license_url as "licenseUrl",
  d.attribution, d.logo_url as "logoUrl", d.last_downloaded_at as "lastDownloadedAt"`
const storedRecords = sql`, (select count(*)::int from plant_locations p where p.source = d.code) as "storedRecords"`

// Lista de fuentes con el número de plantas guardadas de cada una.
export async function listDataSources() {
  return (await db.execute<DataSource>(sql`select ${fields} ${storedRecords} from data_sources d order by d.code`)).rows
}

// Una fuente por su código. Sin contador: se usa en cada ficha y no debe recorrer plant_locations.
export async function getDataSource(code: string, withCount = false) {
  const query = sql`select ${fields} ${withCount ? storedRecords : sql``} from data_sources d where d.code = ${code}`
  return (await db.execute<DataSource>(query)).rows[0] ?? null
}
