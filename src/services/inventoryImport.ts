import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { CatalogError } from './catalogError.js'
import { fetchValenciaTrees, VALENCIA_SOURCE } from './valenciaOpenData.js'

export async function importValenciaInventory(limit: number, offset: number) {
  const page = await fetchValenciaTrees(limit, offset)
  const records = page.records.filter((record) => record.isPlant)
  try {
    // One atomic batch: species, locations and localized names succeed together.
    const [, result] = await db.batch([
      db.execute(sql`select pg_advisory_xact_lock(74101, 1)`),
      db.execute<{ stored: number }>(sql`
        with incoming as materialized (
          select * from jsonb_to_recordset(${JSON.stringify(records)}::jsonb) as i(
            "externalId" text, "sourceUrl" text, "reportedScientificName" text,
            "taxonName" text, "commonNameEs" text, "commonNameCa" text,
            district text, neighborhood text, latitude double precision, longitude double precision
          )
        ), fresh as materialized (
          select * from incoming i where not exists (
            select 1 from plant_locations p where p.source = ${VALENCIA_SOURCE.code} and p.external_id = i."externalId"
          )
        ), added_species as (
          insert into species (scientific_name, source)
          select distinct "taxonName", ${VALENCIA_SOURCE.code} from fresh where "taxonName" is not null
          on conflict (source, scientific_name) do nothing returning id, scientific_name
        ), resolved as (
          select id, scientific_name from species where source = ${VALENCIA_SOURCE.code}
          union all select id, scientific_name from added_species
        ), locations as (
          insert into plant_locations (species_id, reported_scientific_name, latitude, longitude,
            district, neighborhood, source, external_id, source_url)
          select s.id, f."reportedScientificName", f.latitude, f.longitude, f.district,
            f.neighborhood, ${VALENCIA_SOURCE.code}, f."externalId", f."sourceUrl"
          from fresh f left join resolved s on s.scientific_name = f."taxonName"
          on conflict (source, external_id) do nothing returning id, external_id
        ), names as (
          insert into plant_names (plant_location_id, language, name)
          select p.id, n.language, n.name from locations p join fresh f on f."externalId" = p.external_id
          cross join lateral (values ('es', f."commonNameEs"), ('ca', f."commonNameCa")) n(language, name)
          where n.name is not null returning id
        ) select count(*)::int as stored from locations
      `),
    ])
    const stored = result.rows[0]?.stored ?? 0
    return { status: page.invalid ? 'failed' : 'succeeded', fetched: page.fetched, stored,
      excluded: page.records.length - records.length, skipped: records.length - stored,
      failed: page.invalid, limit, offset, nextOffset: page.nextOffset }
  } catch {
    throw new CatalogError(500, 'No se pudo guardar el inventario')
  }
}
