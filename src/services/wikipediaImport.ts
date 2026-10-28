import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { speciesEnrichments } from '../db/schema.js'
import { enrichSpecies } from './speciesEnrichment.js'
import type { WikipediaLanguage } from './speciesEnrichment.js'

async function storeEnrichment(speciesId: number, data: NonNullable<Awaited<ReturnType<typeof enrichSpecies>>>) {
  const image = data.image?.licenseVerified ? data.image : null
  await db.insert(speciesEnrichments).values({
    speciesId, source: 'WIKIPEDIA', language: data.language, sourceUrl: data.articleUrl,
    wikidataId: data.wikidataId, description: data.description, extract: data.extract,
    license: data.license, licenseUrl: data.licenseUrl,
    imageUrl: image?.url ?? null, imageSourceUrl: image?.sourceUrl ?? null,
    imageAuthor: image?.author ?? null, imageLicense: image?.license ?? null,
    imageLicenseUrl: image?.licenseUrl ?? null, imageAttribution: image?.attribution ?? null,
  }).onConflictDoNothing()
}

export async function enrichCatalogSpecies(limit: number, afterId: number, language?: WikipediaLanguage) {
  const completed = sql`exists (select 1 from species_enrichments e where e.species_id = s.id
    and e.source = 'WIKIPEDIA' ${language ? sql`and e.language = ${language}` : sql``})`
  const counts = await db.execute<{ total: number; done: number }>(sql`
    select count(*)::int as total, count(*) filter (where ${completed})::int as done from species s`)
  const targets = await db.execute<{ id: number; name: string }>(sql`
    select s.id, s.scientific_name as name from species s
    where s.id > ${afterId} and not ${completed} order by s.id limit ${limit}`)
  let enriched = 0
  let notFound = 0
  const failed: string[] = []
  const cache = new Map<string, Awaited<ReturnType<typeof enrichSpecies>>>()
  for (const target of targets.rows) {
    try {
      if (!cache.has(target.name)) cache.set(target.name, await enrichSpecies(target.name, language))
      const data = cache.get(target.name)
      if (!data) { notFound++; continue }
      await storeEnrichment(target.id, data)
      enriched++
    } catch { failed.push(target.name) }
  }
  return { totalSpecies: counts.rows[0]?.total ?? 0, alreadyStored: counts.rows[0]?.done ?? 0,
    enriched, notFound, failed, limit, afterId,
    ...(language ? { language } : {}),
    nextAfterId: targets.rows.length === limit ? targets.rows.at(-1)?.id ?? null : null }
}
