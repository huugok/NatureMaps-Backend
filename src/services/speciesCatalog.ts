import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../db/index.js'

function selectSpecies(condition: SQL, limit: number, offset: number, language: string) {
  const languages = [...new Set([language, language.split('-')[0] ?? language, 'es', 'ca', 'en'])]
  const order = sql`array[${sql.join(languages.map((lang) => sql`${lang}::text`), sql`, `)}]`
  return db.execute(sql`
    select s.id, s.scientific_name as "scientificName",
      coalesce((select jsonb_agg(distinct jsonb_build_object('name', n.name, 'language', n.language))
        from plant_names n join plant_locations p on p.id = n.plant_location_id
        where p.species_id = s.id), '[]'::jsonb) as names,
      e.description, e.extract as "culturalExtract", e.language as "wikipediaLang",
      e.source_url as "wikipediaUrl", e.wikidata_id as "wikidataId", e.image_url as "imageUrl",
      e.source, e.fetched_at as "fetchedAt",
      case when e.id is not null then jsonb_build_object(
        'language', e.language, 'content', coalesce(e.extract, e.description),
        'source', e.source, 'url', e.source_url, 'license', e.license, 'licenseUrl', e.license_url
      ) end as enrichment,
      case when e.image_url is not null then jsonb_build_object(
        'url', e.image_url, 'sourceUrl', e.image_source_url, 'author', e.image_author,
        'license', e.image_license, 'licenseUrl', e.image_license_url, 'attribution', e.image_attribution
      ) end as image
    from species s
    left join lateral (
      select * from species_enrichments where species_id = s.id and source = 'WIKIPEDIA'
      order by array_position(${order}, language) nulls last, id limit 1
    ) e on true
    where ${condition} order by s.id limit ${limit} offset ${offset}
  `)
}

export async function listSpecies(limit: number, offset: number, language: string) {
  const [rows, count] = await Promise.all([
    selectSpecies(sql`true`, limit, offset, language),
    db.execute<{ total: number }>(sql`select count(*)::int as total from species`),
  ])
  return { total: count.rows[0]?.total ?? 0, returned: rows.rows.length, limit, offset, species: rows.rows }
}

export async function getSpecies(id: number, language: string) {
  return (await selectSpecies(sql`s.id = ${id}`, 1, 0, language)).rows[0] ?? null
}
