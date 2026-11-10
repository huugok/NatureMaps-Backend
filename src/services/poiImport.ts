import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { pois } from '../db/schema.js'
import { CatalogError } from './catalogError.js'
import { fetchHeritageLayer, HERITAGE_SOURCES, heritageLayers } from './valenciaHeritage.js'
import type { HeritageSource, PoiRecord } from './valenciaHeritage.js'

// Importación de los POIs histórico-culturales del geoportal municipal (NM-06).
// Es idempotente: la clave natural es (source, external_id) y cada ejecución
// refresca nombre, categoría y coordenadas sin tocar la descripción curada ni la
// foto (poi_profiles y las columnas de imagen se escriben en la seed de perfiles).

async function registerSource(source: HeritageSource, downloadedAt: string) {
  await db.execute(sql`
    insert into data_sources (code, provider, name, url, license, license_url, attribution, logo_url, last_downloaded_at)
    values (${source.code}, ${source.provider}, ${source.name}, ${source.url}, ${source.license},
      ${source.licenseUrl}, ${source.attribution}, ${source.logoUrl}, ${downloadedAt}::timestamptz)
    on conflict (code) do update set provider = excluded.provider, name = excluded.name, url = excluded.url,
      license = excluded.license, license_url = excluded.license_url, attribution = excluded.attribution,
      logo_url = excluded.logo_url, last_downloaded_at = excluded.last_downloaded_at
  `)
}

/** Upsert por lotes: 347 POIs en una sola sentencia es más de lo que admite el driver. */
async function storeRecords(records: PoiRecord[], chunkSize = 100) {
  let stored = 0
  for (let index = 0; index < records.length; index += chunkSize) {
    const chunk = records.slice(index, index + chunkSize)
    await db.insert(pois).values(chunk.map((record) => ({
      source: record.source,
      externalId: record.externalId,
      name: record.name,
      category: record.category,
      latitude: record.latitude,
      longitude: record.longitude,
      sourceUrl: record.sourceUrl,
      // La descripción del geoportal, si la trae, no pisa una curada/importada previa.
      description: record.description,
      infoUrl: record.infoUrl,
    }))).onConflictDoUpdate({
      target: [pois.source, pois.externalId],
      set: {
        name: sql`excluded.name`,
        category: sql`excluded.category`,
        latitude: sql`excluded.latitude`,
        longitude: sql`excluded.longitude`,
        sourceUrl: sql`excluded.source_url`,
        infoUrl: sql`coalesce(excluded.info_url, ${pois.infoUrl})`,
        description: sql`coalesce(excluded.description, ${pois.description})`,
      },
    })
    stored += chunk.length
  }
  return stored
}

export async function importValenciaPois() {
  const downloadedAt = new Date().toISOString()
  const layers = heritageLayers()
  const pages = await Promise.all(layers.map((layer) => fetchHeritageLayer(layer)))
  const records = pages.flatMap((page) => page.records)
  const invalid = pages.reduce((total, page) => total + page.invalid, 0)
  try {
    const stored = await storeRecords(records)
    for (const source of HERITAGE_SOURCES) await registerSource(source, downloadedAt)
    return {
      fetched: pages.reduce((total, page) => total + page.fetched, 0),
      stored,
      invalid,
      downloadedAt,
      sources: HERITAGE_SOURCES.map((source) => source.code),
    }
  } catch (error) {
    if (error instanceof CatalogError) throw error
    throw new CatalogError(500, 'No se pudieron guardar los POIs')
  }
}
