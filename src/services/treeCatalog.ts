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
}

function selectTrees(language: string, condition: SQL, limit: number, offset: number, detail = false) {
  const languages = [...new Set([language, language.split('-')[0] ?? language, 'es', 'ca', 'en'])]
  const languageOrder = sql`array[${sql.join(languages.map((lang) => sql`${lang}::text`), sql`, `)}]`
  return db.execute<TreeRow>(sql`
    select p.id, p.species_id as "speciesId", s.scientific_name as "scientificName",
      p.reported_scientific_name as "reportedScientificName", n.name as "commonName",
      n.language as "commonNameLanguage", p.latitude, p.longitude, p.source, p.external_id as "externalId"
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
