import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { looksMojibake, repairMojibake } from './textEncoding.js'

// Corrige los nombres que ya están guardados con la codificación rota (ver textEncoding.ts).
// Es idempotente: una segunda ejecución no encuentra nada. Con `apply: false` solo cuenta.

const MARK = 'Ã'
const MARK_B = 'Â'

export interface RepairReport {
  /** Filas con la marca de codificación rota. */
  rows: number
  /** Valores distintos que se pueden corregir con seguridad. */
  repairable: number
  /** Filas realmente actualizadas (0 si `apply` es false). */
  updated: number
  /** Valores que no se tocan: no son corregibles o la versión buena ya existe. */
  skipped: number
}

export interface RepairResult {
  plantNames: RepairReport
  reportedScientificNames: RepairReport
  speciesNames: RepairReport
}

async function brokenValues(query: ReturnType<typeof sql>): Promise<string[]> {
  const result = await db.execute<{ value: string }>(query)
  return result.rows.map((row) => row.value)
}

function pairsOf(values: string[]) {
  return values
    .map((broken) => ({ broken, fixed: repairMojibake(broken) }))
    .filter((pair) => pair.fixed !== pair.broken && !looksMojibake(pair.fixed))
}

export async function repairStoredNames(options: { apply: boolean }): Promise<RepairResult> {
  const { apply } = options

  async function count(query: ReturnType<typeof sql>): Promise<number> {
    const result = await db.execute<{ total: number }>(query)
    return Number(result.rows[0]?.total ?? 0)
  }

  // Nombres comunes por ejemplar (castellano y valenciano).
  const names = pairsOf(await brokenValues(sql`
    select distinct name as value from plant_names where name like ${`%${MARK}%`} or name like ${`%${MARK_B}%`}`))
  const plantNames: RepairReport = {
    rows: await count(sql`select count(*)::int as total from plant_names where name like ${`%${MARK}%`} or name like ${`%${MARK_B}%`}`),
    repairable: names.length, updated: 0, skipped: 0,
  }
  if (apply && names.length > 0) {
    const result = await db.execute(sql`
      update plant_names set name = v.fixed
      from jsonb_to_recordset(${JSON.stringify(names)}::jsonb) as v(broken text, fixed text)
      where plant_names.name = v.broken returning plant_names.id`)
    plantNames.updated = result.rows.length
  }

  // Nombre científico tal y como lo declara el inventario.
  const reported = pairsOf(await brokenValues(sql`
    select distinct reported_scientific_name as value from plant_locations
    where reported_scientific_name like ${`%${MARK}%`} or reported_scientific_name like ${`%${MARK_B}%`}`))
  const reportedScientificNames: RepairReport = {
    rows: await count(sql`select count(*)::int as total from plant_locations
      where reported_scientific_name like ${`%${MARK}%`} or reported_scientific_name like ${`%${MARK_B}%`}`),
    repairable: reported.length, updated: 0, skipped: 0,
  }
  if (apply && reported.length > 0) {
    const result = await db.execute(sql`
      update plant_locations set reported_scientific_name = v.fixed
      from jsonb_to_recordset(${JSON.stringify(reported)}::jsonb) as v(broken text, fixed text)
      where plant_locations.reported_scientific_name = v.broken returning plant_locations.id`)
    reportedScientificNames.updated = result.rows.length
  }

  // Especies: el nombre es único por fuente, así que no se renombra si la versión buena ya existe.
  const speciesBroken = await brokenValues(sql`
    select distinct scientific_name as value from species
    where scientific_name like ${`%${MARK}%`} or scientific_name like ${`%${MARK_B}%`}`)
  const speciesPairs = pairsOf(speciesBroken)
  const speciesNames: RepairReport = {
    rows: await count(sql`select count(*)::int as total from species
      where scientific_name like ${`%${MARK}%`} or scientific_name like ${`%${MARK_B}%`}`),
    repairable: speciesPairs.length, updated: 0, skipped: speciesBroken.length - speciesPairs.length,
  }
  if (apply && speciesPairs.length > 0) {
    const result = await db.execute(sql`
      update species set scientific_name = v.fixed
      from jsonb_to_recordset(${JSON.stringify(speciesPairs)}::jsonb) as v(broken text, fixed text)
      where species.scientific_name = v.broken
        and not exists (select 1 from species other where other.source = species.source and other.scientific_name = v.fixed)
      returning species.id`)
    speciesNames.updated = result.rows.length
    speciesNames.skipped += speciesNames.rows - speciesNames.updated - (speciesBroken.length - speciesPairs.length)
  }

  return { plantNames, reportedScientificNames, speciesNames }
}
