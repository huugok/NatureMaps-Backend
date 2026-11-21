import 'dotenv/config'
import { sql } from 'drizzle-orm'

const PHENOBASE_URL = 'https://biscicol.org/phenobase/api/v1/query//phenobase2/_search'
const REGION = { name: 'Valencia', minLat: 37.8, maxLat: 40.9, minLon: -1.5, maxLon: 0.5 }
// Match the public Phenobase download client: search_after avoids Elasticsearch's
// 10,000-record result-window limit.
const PAGE_SIZE = 5_000

interface Observation {
  scientificName: string
  year: number
  dayOfYear: number
  dataSource: string
  sourceRecordUrl: string | null
}

async function main() {
  if (!process.env.DATABASE_URL) throw new Error('Falta DATABASE_URL en .env')
  const { db } = await import('../db/index.js')
  const species = await db.execute<{ scientificName: string }>(sql`
    select scientific_name as "scientificName" from species order by scientific_name`)
  const names = [...new Set(species.rows.map((row) => row.scientificName))]
  if (names.length === 0) throw new Error('El catálogo no contiene especies')

  const observations: Observation[] = []
  let total: number | null = null
  let searchAfter: unknown[] | undefined
  while (true) {
    const body: Record<string, unknown> = {
      size: PAGE_SIZE,
      query: { bool: { must: [
        { term: { mappedTraits: 'flower present' } },
        { range: { latitude: { gte: REGION.minLat, lte: REGION.maxLat } } },
        { range: { longitude: { gte: REGION.minLon, lte: REGION.maxLon } } },
      ] } },
      _source: ['scientificName', 'year', 'dayOfYear', 'dataSource', 'sourceRecordUrl'],
      sort: [{ annotationID: { order: 'asc', missing: '_last' } }],
      track_total_hits: observations.length === 0,
    }
    if (searchAfter) body.search_after = searchAfter
    const response = await fetch(PHENOBASE_URL, {
      method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(body),
    })
    if (!response.ok) throw new Error(`Phenobase respondió HTTP ${response.status}`)
    const payload = await response.json() as {
      hits?: { total?: { value?: number }, hits?: Array<{ _source?: Observation, sort?: unknown[] }> }
    }
    const hits = payload.hits?.hits ?? []
    if (observations.length === 0) total = payload.hits?.total?.value ?? null
    observations.push(...hits.flatMap((hit) => hit._source ? [hit._source] : []))
    const last = hits.at(-1)
    searchAfter = last?.sort
    if (!searchAfter || hits.length < PAGE_SIZE) break
  }
  const bySpecies = new Map<string, { count: number, months: Set<number>, years: Set<number>, sources: Set<string> }>()
  const evidenceByMonth = new Map<string, { scientificName: string, month: number, count: number, years: Set<number> }>()
  for (const observation of observations) {
    if (typeof observation.scientificName !== 'string' || !Number.isInteger(observation.year) || !Number.isInteger(observation.dayOfYear)
      || observation.dayOfYear < 1 || observation.dayOfYear > 366) continue
    const key = observation.scientificName.toLocaleLowerCase()
    const date = new Date(Date.UTC(observation.year, 0, observation.dayOfYear))
    const item = bySpecies.get(key) ?? { count: 0, months: new Set<number>(), years: new Set<number>(), sources: new Set<string>() }
    item.count += 1
    item.months.add(date.getUTCMonth() + 1)
    item.years.add(observation.year)
    item.sources.add(observation.dataSource)
    bySpecies.set(key, item)
    const month = date.getUTCMonth() + 1
    const evidenceKey = `${key}:${month}`
    const monthEvidence = evidenceByMonth.get(evidenceKey) ?? {
      scientificName: observation.scientificName, month, count: 0, years: new Set<number>(),
    }
    monthEvidence.count += 1
    monthEvidence.years.add(observation.year)
    evidenceByMonth.set(evidenceKey, monthEvidence)
  }

  const rows = names.flatMap((scientificName) => {
    const coverage = bySpecies.get(scientificName.toLocaleLowerCase())
    return coverage ? [{
      scientificName,
      observations: coverage.count,
      years: coverage.years.size,
      months: [...coverage.months].sort((a, b) => a - b),
      dataSources: [...coverage.sources].sort(),
    }] : []
  })
  const coverageReport = {
    region: REGION,
    catalogSpecies: names.length,
    phenobaseTotal: total,
    rowsReturned: observations.length,
    speciesWithObservations: rows.length,
    speciesWithoutObservations: names.length - rows.length,
    truncatedAtPageLimit: total !== null && observations.length < total,
    coverage: rows,
  }

  const apply = process.argv.includes('--apply')
  if (apply) {
    const exactCatalogNames = new Set(names.map((name) => name.toLocaleLowerCase()))
    const periods = [...evidenceByMonth.values()].filter((item) => exactCatalogNames.has(item.scientificName.toLocaleLowerCase()))
    const sourceName = 'Phenobase / iNaturalist (flower present observations)'
    const sourceUrl = 'https://phenobase.netlify.app/'
    await db.execute(sql`
      update species_flowering_periods set region = ${REGION.name}
      where region = 'Valencia vicinity' and source_url = ${sourceUrl}`)
    const statements = periods.map((period) => db.execute(sql`
      insert into species_flowering_periods (species_id, start_month, end_month, region, source_name, source_url)
      select s.id, ${period.month}, ${period.month}, ${REGION.name}, ${sourceName}, ${sourceUrl}
      from species s where lower(s.scientific_name) = lower(${period.scientificName})
      on conflict (species_id, start_month, end_month, region, source_url)
      do update set source_name = excluded.source_name`))
    for (let index = 0; index < statements.length; index += 100) {
      const chunk = statements.slice(index, index + 100)
      const [first, ...rest] = chunk
      if (first) await db.batch([first, ...rest])
    }
    const stored = await db.execute<{ periods: number, species: number }>(sql`
      select count(*)::int as periods, count(distinct species_id)::int as species
      from species_flowering_periods where region = ${REGION.name} and source_url = ${sourceUrl}`)
    console.log(JSON.stringify({
      mode: 'imported', region: REGION.name, catalogSpecies: names.length,
      phenobaseRecords: observations.length, speciesWithObservations: rows.length,
      speciesWithoutObservations: names.length - rows.length,
      periodsUpserted: periods.length, stored: stored.rows[0] ?? null,
    }, null, 2))
    return
  }

  console.log(JSON.stringify({ ...coverageReport, mode: 'dry-run' }, null, 2))
}

main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : 'No se pudo consultar la cobertura de floración')
  process.exitCode = 1
})
