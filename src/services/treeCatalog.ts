import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { getDataSource } from './dataSources.js'
import { getSpecies } from './speciesCatalog.js'

type TreeRow = {
  id: number; speciesId: number | null; scientificName: string | null
  reportedScientificName: string | null; commonName: string | null
  commonNameLanguage: string | null; latitude: number; longitude: number
  source: string; externalId: string
  /** Zona verde que contiene el ejemplar (NM-08); null en arbolado viario. */
  greenAreaId: number | null
}

// Order for the lateral common-name join: requested language first (with any
// regional variant), then the fallbacks the catalog uses everywhere.
function nameLanguageOrder(language: string) {
  const languages = [...new Set([language, language.split('-')[0] ?? language, 'es', 'ca', 'en'])]
  return sql`array[${sql.join(languages.map((lang) => sql`${lang}::text`), sql`, `)}]`
}

function selectTrees(language: string, condition: SQL, limit: number, offset: number, detail = false) {
  const languageOrder = nameLanguageOrder(language)
  return db.execute<TreeRow>(sql`
    select p.id, p.species_id as "speciesId", s.scientific_name as "scientificName",
      p.reported_scientific_name as "reportedScientificName", n.name as "commonName",
      n.language as "commonNameLanguage", p.latitude, p.longitude, p.source, p.external_id as "externalId",
      p.green_area_id as "greenAreaId"
      ${detail ? sql`, p.district, p.neighborhood, p.source_url as "sourceUrl", p.imported_at as "importedAt",
        (select coalesce(jsonb_agg(jsonb_build_object('language', language, 'name', name) order by language), '[]'::jsonb)
         from plant_names where plant_location_id = p.id) as names` : sql``}
    from plant_locations p left join species s on s.id = p.species_id
    left join lateral (
      select name, language from plant_names where plant_location_id = p.id and language = any(${languageOrder})
      order by array_position(${languageOrder}, language) limit 1
    ) n on true
    where ${condition} order by p.id limit ${limit} offset ${offset}
  `)
}

function publicTree(row: TreeRow) {
  return { ...row, displayName: row.commonName ?? row.scientificName ?? row.reportedScientificName ?? 'Planta sin identificar' }
}

export async function listTrees(limit: number, offset: number, language: string) {
  const [result, count] = await Promise.all([
    selectTrees(language, sql`true`, limit, offset),
    db.execute<{ total: number }>(sql`select count(*)::int as total from plant_locations`),
  ])
  const total = count.rows[0]?.total ?? 0
  const trees = result.rows.map(publicTree)
  return { total, returned: trees.length, limit, offset, language,
    nextOffset: offset + trees.length < total ? offset + trees.length : null, trees }
}

export async function getTree(id: number, language: string) {
  const row = (await selectTrees(language, sql`p.id = ${id}`, 1, 0, true)).rows[0]
  if (!row) return null
  // dataSource: organismo, licencia, atribución, logo y fecha de descarga para mostrar en la ficha.
  // Es null si esa fuente aún no se ha registrado (se registra en la primera importación).
  return { ...publicTree(row), dataSource: await getDataSource(row.source),
    species: row.speciesId ? await getSpecies(row.speciesId, language) : null }
}

// Straight-line (great-circle) distance in meters between the given point and
// each row. Plain math, no Postgres extension needed. `p` is plant_locations.
function distanceMeters(latitude: number, longitude: number) {
  return sql`6371000 * 2 * asin(sqrt(
    power(sin(radians(p.latitude - ${latitude}::double precision) / 2), 2)
    + cos(radians(${latitude}::double precision)) * cos(radians(p.latitude))
      * power(sin(radians(p.longitude - ${longitude}::double precision) / 2), 2)
  ))`
}

// Plants around a point, closest first. The bounding box makes the coordinate
// index usable; the exact distance filter keeps only the circle inside it.
export async function listNearbyTrees(
  latitude: number,
  longitude: number,
  radius: number,
  limit: number,
  language: string,
) {
  const metersPerDegree = 111_320
  const cosLatitude = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const distance = distanceMeters(latitude, longitude)
  const result = await db.execute<TreeRow & { distance: number }>(sql`
    select p.id, p.species_id as "speciesId", s.scientific_name as "scientificName",
      p.reported_scientific_name as "reportedScientificName", n.name as "commonName",
      n.language as "commonNameLanguage", p.latitude, p.longitude, p.source, p.external_id as "externalId",
      p.green_area_id as "greenAreaId", round(${distance}::numeric)::int as distance
    from plant_locations p left join species s on s.id = p.species_id
    left join lateral (
      select name, language from plant_names where plant_location_id = p.id and language = any(${nameLanguageOrder(language)})
      order by array_position(${nameLanguageOrder(language)}, language) limit 1
    ) n on true
    where p.latitude between ${latitude - radius / metersPerDegree} and ${latitude + radius / metersPerDegree}
      and p.longitude between ${longitude - radius / (metersPerDegree * cosLatitude)} and ${longitude + radius / (metersPerDegree * cosLatitude)}
      and ${distance} <= ${radius}::double precision
    order by ${distance} asc
    limit ${limit}
  `)
  const trees = result.rows.map(publicTree)
  return { center: { latitude, longitude }, radius, returned: trees.length, limit, language, trees }
}
