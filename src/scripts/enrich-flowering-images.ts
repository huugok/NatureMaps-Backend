import 'dotenv/config'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { enrichSpecies } from '../services/speciesEnrichment.js'

const delay = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds))

function option(name: string, fallback: number, min: number, max: number) {
  const value = process.argv.find((argument) => argument.startsWith(`--${name}=`))?.split('=')[1]
  if (value === undefined) return fallback
  if (!/^\d+$/.test(value) || Number(value) < min || Number(value) > max) {
    throw new Error(`--${name} debe ser un entero entre ${min} y ${max}`)
  }
  return Number(value)
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env')
  const limit = option('limit', 200, 1, 200)
  const afterId = option('after-id', 0, 0, 2_147_483_647)
  const targets = await db.execute<{ id: number, scientificName: string }>(sql`
    select s.id, s.scientific_name as "scientificName"
    from species s
    where s.id > ${afterId}
      and exists (select 1 from species_flowering_periods fp where fp.species_id = s.id)
      and not exists (
        select 1 from species_enrichments e where e.species_id = s.id and e.image_url is not null
      )
    order by s.id limit ${limit}`)

  let saved = 0
  let noReusableImage = 0
  let failed = 0
  for (const target of targets.rows) {
    try {
      let data = await enrichSpecies(target.scientificName, 'es')
      if (!data?.image?.licenseVerified) data = await enrichSpecies(target.scientificName, 'en')
      const image = data?.image
      if (!data || !image?.licenseVerified || !image.sourceUrl || !image.author || !image.license
        || !image.licenseUrl || !image.attribution) {
        noReusableImage++
        continue
      }

      const result = await db.execute(sql`
        insert into species_enrichments (
          species_id, source, language, source_url, wikidata_id, description, extract,
          license, license_url, image_url, image_source_url, image_author,
          image_license, image_license_url, image_attribution
        ) values (
          ${target.id}, 'WIKIPEDIA', ${data.language}, ${data.articleUrl}, ${data.wikidataId},
          ${data.description}, ${data.extract}, ${data.license}, ${data.licenseUrl},
          ${image.url}, ${image.sourceUrl}, ${image.author}, ${image.license},
          ${image.licenseUrl}, ${image.attribution}
        )
        on conflict (species_id, source, language) do update set
          image_url = excluded.image_url,
          image_source_url = excluded.image_source_url,
          image_author = excluded.image_author,
          image_license = excluded.image_license,
          image_license_url = excluded.image_license_url,
          image_attribution = excluded.image_attribution
        where species_enrichments.image_url is null and excluded.image_url is not null
        returning id`)
      if (result.rows.length > 0) saved++
    } catch {
      failed++
    }
    await delay(500)
  }

  console.log(JSON.stringify({
    selectedFloweringSpecies: targets.rows.length,
    saved,
    noReusableImage,
    failed,
    nextAfterId: targets.rows.length === limit ? targets.rows.at(-1)?.id ?? null : null,
  }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudieron enriquecer las imágenes de floración')
  process.exitCode = 1
})
