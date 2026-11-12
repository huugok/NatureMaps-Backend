import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { CatalogError } from './catalogError.js'
import { parseAreaGeometry, pointInGeometry } from './geometry.js'
import type { AreaGeometry } from './geometry.js'
import { fetchValenciaGreenAreas, GREEN_AREAS_SOURCE } from './valenciaGreenAreas.js'
import type { GreenAreaRecord } from './valenciaGreenAreas.js'

// Importación de zonas verdes (NM-08) y cruce con el arbolado. Idempotente:
// la clave natural es (source, external_id); repetirla refresca nombre, grupo,
// tipología y contorno. Después recalcula a qué zona pertenece cada ejemplar y
// solo escribe los que cambian, así que una segunda ejecución no toca nada.

async function registerSource(downloadedAt: string) {
  const source = GREEN_AREAS_SOURCE
  await db.execute(sql`
    insert into data_sources (code, provider, name, url, license, license_url, attribution, logo_url, last_downloaded_at)
    values (${source.code}, ${source.provider}, ${source.name}, ${source.url}, ${source.license},
      ${source.licenseUrl}, ${source.attribution}, ${source.logoUrl}, ${downloadedAt}::timestamptz)
    on conflict (code) do update set provider = excluded.provider, name = excluded.name, url = excluded.url,
      license = excluded.license, license_url = excluded.license_url, attribution = excluded.attribution,
      logo_url = excluded.logo_url, last_downloaded_at = excluded.last_downloaded_at
  `)
}

/** Upsert por lotes: los contornos pesan, así que van de 25 en 25. */
async function storeRecords(records: GreenAreaRecord[], chunkSize = 25) {
  for (let index = 0; index < records.length; index += chunkSize) {
    const rows = records.slice(index, index + chunkSize).map((r) => sql`(
      ${r.source}, ${r.externalId}, ${r.name}, ${r.reportedName}, ${r.groupSlug}, ${r.typology},
      ${r.neighborhood}, ${r.areaM2}::double precision, ${r.featured}::boolean, ${JSON.stringify(r.geometry)}::jsonb,
      ${r.minLatitude}::double precision, ${r.maxLatitude}::double precision,
      ${r.minLongitude}::double precision, ${r.maxLongitude}::double precision,
      ${r.latitude}::double precision, ${r.longitude}::double precision, ${r.sourceUrl})`)
    await db.execute(sql`
      insert into green_areas (source, external_id, name, reported_name, group_slug, typology, neighborhood,
        area_m2, featured, geometry, min_latitude, max_latitude, min_longitude, max_longitude,
        latitude, longitude, source_url)
      values ${sql.join(rows, sql`, `)}
      on conflict (source, external_id) do update set name = excluded.name,
        reported_name = excluded.reported_name, group_slug = excluded.group_slug,
        typology = excluded.typology, neighborhood = excluded.neighborhood, area_m2 = excluded.area_m2,
        featured = excluded.featured, geometry = excluded.geometry,
        min_latitude = excluded.min_latitude, max_latitude = excluded.max_latitude,
        min_longitude = excluded.min_longitude, max_longitude = excluded.max_longitude,
        latitude = excluded.latitude, longitude = excluded.longitude, source_url = excluded.source_url,
        imported_at = now()
    `)
  }
}

interface AreaIndexEntry {
  id: number
  size: number
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  geometry: AreaGeometry
}

async function loadAreaIndex(): Promise<AreaIndexEntry[]> {
  const result = await db.execute<{
    id: number, areaM2: number | null, geometry: unknown
    minLatitude: number, maxLatitude: number, minLongitude: number, maxLongitude: number
  }>(sql`
    select id, area_m2 as "areaM2", geometry, min_latitude as "minLatitude", max_latitude as "maxLatitude",
      min_longitude as "minLongitude", max_longitude as "maxLongitude"
    from green_areas order by id
  `)
  const entries: AreaIndexEntry[] = []
  for (const row of result.rows) {
    const geometry = parseAreaGeometry(typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry)
    if (!geometry) continue
    const boxSize = (Number(row.maxLatitude) - Number(row.minLatitude)) * (Number(row.maxLongitude) - Number(row.minLongitude))
    entries.push({
      id: Number(row.id),
      // Para desempatar zonas solapadas gana la más pequeña (la más específica).
      size: row.areaM2 === null ? boxSize * 1e10 : Number(row.areaM2),
      minLatitude: Number(row.minLatitude),
      maxLatitude: Number(row.maxLatitude),
      minLongitude: Number(row.minLongitude),
      maxLongitude: Number(row.maxLongitude),
      geometry,
    })
  }
  return entries.sort((a, b) => a.size - b.size)
}

/** Zona que contiene el punto: la más pequeña de las que lo incluyen, o null. */
export function areaContaining(areas: AreaIndexEntry[], latitude: number, longitude: number): number | null {
  for (const area of areas) {
    if (latitude < area.minLatitude || latitude > area.maxLatitude
      || longitude < area.minLongitude || longitude > area.maxLongitude) continue
    if (pointInGeometry(longitude, latitude, area.geometry)) return area.id
  }
  return null
}

/**
 * Recalcula plant_locations.green_area_id para todo el inventario. Recorre los
 * ejemplares por clave (id) en páginas y solo actualiza los que cambian.
 */
export async function assignPlantsToGreenAreas(pageSize = 5000, chunkSize = 1000) {
  const areas = await loadAreaIndex()
  let scanned = 0
  let inside = 0
  let updated = 0
  let afterId = 0
  for (;;) {
    const page = await db.execute<{ id: number, latitude: number, longitude: number, greenAreaId: number | null }>(sql`
      select id, latitude, longitude, green_area_id as "greenAreaId"
      from plant_locations where id > ${afterId} order by id limit ${pageSize}
    `)
    if (page.rows.length === 0) break
    const changes: Array<{ id: number, areaId: number | null }> = []
    for (const row of page.rows) {
      const areaId = areaContaining(areas, Number(row.latitude), Number(row.longitude))
      if (areaId !== null) inside++
      const current = row.greenAreaId === null ? null : Number(row.greenAreaId)
      if (areaId !== current) changes.push({ id: Number(row.id), areaId })
    }
    for (let index = 0; index < changes.length; index += chunkSize) {
      const values = changes.slice(index, index + chunkSize)
        .map((change) => sql`(${change.id}::integer, ${change.areaId}::integer)`)
      await db.execute(sql`
        update plant_locations p set green_area_id = v.area_id
        from (values ${sql.join(values, sql`, `)}) as v(id, area_id) where p.id = v.id
      `)
    }
    updated += changes.length
    scanned += page.rows.length
    afterId = Number(page.rows.at(-1)!.id)
    if (page.rows.length < pageSize) break
  }
  return { scanned, inside, updated }
}

export async function importValenciaGreenAreas() {
  const downloadedAt = new Date().toISOString()
  const { records, fetched, invalid } = await fetchValenciaGreenAreas()
  try {
    await storeRecords(records)
    await registerSource(downloadedAt)
    const plants = await assignPlantsToGreenAreas()
    return {
      fetched,
      stored: records.length,
      featured: records.filter((record) => record.featured).length,
      invalid,
      plants,
      downloadedAt,
      source: GREEN_AREAS_SOURCE.code,
    }
  } catch (error) {
    if (error instanceof CatalogError) throw error
    throw new CatalogError(500, 'No se pudieron guardar las zonas verdes')
  }
}
