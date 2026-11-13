import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { CatalogError } from './catalogError.js'
import { boundingBox, parseAreaGeometry, pointInGeometry } from './geometry.js'
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
  featured: boolean
  size: number
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  geometry: AreaGeometry
}

// `type` y no `interface`: db.execute<T> exige T asignable a Record<string, unknown>,
// y una interface no lleva índice de cadena implícito.
type AreaIndexRow = {
  id: number
  featured: boolean
  areaM2: number | null
  geometry: unknown
  minLatitude?: number
  maxLatitude?: number
  minLongitude?: number
  maxLongitude?: number
}

/**
 * Ordena las zonas para resolver los solapamientos. Las zonas del geoportal se
 * pisan entre sí: un parque grande comparte terreno con las isletas y medianas
 * de «Acompañamiento Viario» que lo bordean. Si ganara siempre la más pequeña,
 * esas isletas se quedarían con los ejemplares y el parque —que es el que el
 * usuario abre desde el mapa— saldría vacío. Así que primero ganan los parques
 * y jardines destacados, y solo entre iguales decide el tamaño.
 */
export function buildAreaIndex(rows: AreaIndexRow[]): AreaIndexEntry[] {
  const entries: AreaIndexEntry[] = []
  for (const row of rows) {
    const geometry = parseAreaGeometry(typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry)
    if (!geometry) continue
    const box = boundingBox(geometry)
    const minLatitude = row.minLatitude === undefined ? box.minLatitude : Number(row.minLatitude)
    const maxLatitude = row.maxLatitude === undefined ? box.maxLatitude : Number(row.maxLatitude)
    const minLongitude = row.minLongitude === undefined ? box.minLongitude : Number(row.minLongitude)
    const maxLongitude = row.maxLongitude === undefined ? box.maxLongitude : Number(row.maxLongitude)
    const boxSize = (maxLatitude - minLatitude) * (maxLongitude - minLongitude)
    entries.push({
      id: Number(row.id),
      featured: row.featured === true,
      size: row.areaM2 === null ? boxSize * 1e10 : Number(row.areaM2),
      minLatitude,
      maxLatitude,
      minLongitude,
      maxLongitude,
      geometry,
    })
  }
  return entries.sort((a, b) => Number(b.featured) - Number(a.featured) || a.size - b.size)
}

async function loadAreaIndex(): Promise<AreaIndexEntry[]> {
  const result = await db.execute<AreaIndexRow>(sql`
    select id, featured, area_m2 as "areaM2", geometry, min_latitude as "minLatitude", max_latitude as "maxLatitude",
      min_longitude as "minLongitude", max_longitude as "maxLongitude"
    from green_areas order by id
  `)
  return buildAreaIndex(result.rows)
}

/**
 * Zona que contiene el punto. Entre varias que lo contengan gana el parque o
 * jardín destacado; a igualdad, la más pequeña. Devuelve null si ninguna.
 */
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
