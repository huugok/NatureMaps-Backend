import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { getDataSource } from './dataSources.js'
import { articlesForGroups } from './editorialCatalog.js'
import { distanceToGeometry, parseAreaGeometry } from './geometry.js'
import type { AreaGeometry } from './geometry.js'
import { groupTitle } from './valenciaGreenAreas.js'

// Consultas de zonas verdes (NM-08): la capa del mapa (contornos), la zona que
// contiene un punto (enlace desde la ficha de un POI) y la ficha de una zona
// con su flora, sus puntos de interés y sus artículos.

type AreaRow = {
  id: number
  groupSlug: string
  name: string
  typology: string | null
  neighborhood: string | null
  areaM2: number | null
  featured: boolean
  latitude: number
  longitude: number
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
  source: string
  externalId: string
  sourceUrl: string
  geometry?: unknown
  plants?: number
}

const FIELDS = sql`g.id, g.group_slug as "groupSlug", g.name, g.typology, g.neighborhood,
  g.area_m2 as "areaM2", g.featured, g.latitude, g.longitude,
  g.min_latitude as "minLatitude", g.max_latitude as "maxLatitude",
  g.min_longitude as "minLongitude", g.max_longitude as "maxLongitude",
  g.source, g.external_id as "externalId", g.source_url as "sourceUrl"`

function geometryOf(row: AreaRow): AreaGeometry | null {
  return parseAreaGeometry(typeof row.geometry === 'string' ? JSON.parse(row.geometry) : row.geometry)
}

function publicArea(row: AreaRow, withGeometry: boolean) {
  return {
    id: Number(row.id),
    groupSlug: row.groupSlug,
    name: row.name,
    groupName: groupTitle(row.groupSlug, row.name),
    typology: row.typology,
    neighborhood: row.neighborhood,
    areaM2: row.areaM2 === null ? null : Number(row.areaM2),
    featured: row.featured === true || (row.featured as unknown) === 't',
    center: { latitude: Number(row.latitude), longitude: Number(row.longitude) },
    // [oeste, sur, este, norte], el orden de GeoJSON y de Leaflet.fitBounds.
    bbox: [Number(row.minLongitude), Number(row.minLatitude), Number(row.maxLongitude), Number(row.maxLatitude)],
    ...(row.plants === undefined ? {} : { plants: Number(row.plants) }),
    ...(withGeometry ? { geometry: geometryOf(row) } : {}),
  }
}

export type PublicGreenArea = ReturnType<typeof publicArea>

export interface AreaBounds { south: number, west: number, north: number, east: number }

/**
 * Zonas de la capa del mapa. Por defecto solo parques y jardines (`featured`);
 * `all` incluye también el verde viario. `bounds` recorta a la vista del mapa.
 */
export async function listGreenAreas(all: boolean, withGeometry: boolean, bounds: AreaBounds | null) {
  const conditions: SQL[] = [all ? sql`true` : sql`g.featured`]
  if (bounds) {
    conditions.push(sql`g.max_latitude >= ${bounds.south}::double precision and g.min_latitude <= ${bounds.north}::double precision
      and g.max_longitude >= ${bounds.west}::double precision and g.min_longitude <= ${bounds.east}::double precision`)
  }
  const [result, withArticles, dataSources] = await Promise.all([
    db.execute<AreaRow>(sql`
      select ${FIELDS} ${withGeometry ? sql`, g.geometry` : sql``},
        (select count(*)::int from plant_locations p where p.green_area_id = g.id) as plants
      from green_areas g where ${sql.join(conditions, sql` and `)}
      order by g.area_m2 desc nulls last, g.id
    `),
    db.execute<{ group: string }>(sql`
      select distinct green_area_group as "group" from editorial_articles where green_area_group is not null
    `),
    db.execute<{ source: string }>(sql`select distinct source from green_areas`),
  ])
  const groupsWithArticle = new Set(withArticles.rows.map((row) => row.group))
  const sources = await Promise.all(dataSources.rows.map((row) => getDataSource(row.source)))
  return {
    returned: result.rows.length,
    sources: sources.filter((source) => source !== null),
    areas: result.rows.map((row) => ({
      ...publicArea(row, withGeometry),
      hasArticle: groupsWithArticle.has(row.groupSlug),
    })),
  }
}

/**
 * Zona verde de un punto: la que lo contiene o, si no hay ninguna, el parque o
 * jardín más cercano dentro de `radius` metros. Es el enlace POI → zona verde
 * (PA 3012): se resuelve por coordenadas, sin relación guardada.
 */
export async function greenAreaAt(latitude: number, longitude: number, radius: number) {
  const metersPerDegree = 111_320
  const cosLatitude = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const dLat = radius / metersPerDegree
  const dLon = radius / (metersPerDegree * cosLatitude)
  const result = await db.execute<AreaRow>(sql`
    select ${FIELDS}, g.geometry from green_areas g
    where g.max_latitude >= ${latitude - dLat}::double precision and g.min_latitude <= ${latitude + dLat}::double precision
      and g.max_longitude >= ${longitude - dLon}::double precision and g.min_longitude <= ${longitude + dLon}::double precision
  `)
  let best: { row: AreaRow, distance: number } | null = null
  for (const row of result.rows) {
    const geometry = geometryOf(row)
    if (!geometry) continue
    const distance = distanceToGeometry(longitude, latitude, geometry)
    // Fuera de una zona solo se ofrecen parques y jardines, no una isleta vecina.
    if (distance > radius || (distance > 0 && !(row.featured === true || (row.featured as unknown) === 't'))) continue
    const better = best === null
      || distance < best.distance
      || (distance === best.distance && Number(row.areaM2 ?? Infinity) < Number(best.row.areaM2 ?? Infinity))
    if (better) best = { row, distance }
  }
  if (!best) return { point: { latitude, longitude }, radius, relation: null, distance: null, area: null }
  return {
    point: { latitude, longitude },
    radius,
    relation: best.distance === 0 ? 'inside' as const : 'near' as const,
    distance: Math.round(best.distance),
    area: publicArea(best.row, false),
  }
}

async function topSpecies(areaIds: number[], language: string, limit: number) {
  const ids = sql`array[${sql.join(areaIds.map((id) => sql`${id}::integer`), sql`, `)}]`
  const base = language.split('-')[0] ?? language
  const result = await db.execute<{ speciesId: number, scientificName: string, commonName: string | null, plants: number }>(sql`
    select p.species_id as "speciesId", s.scientific_name as "scientificName",
      coalesce(min(n.name) filter (where n.language = ${base}), min(n.name) filter (where n.language = 'es'), min(n.name)) as "commonName",
      count(distinct p.id)::int as plants
    from plant_locations p
    join species s on s.id = p.species_id
    left join plant_names n on n.plant_location_id = p.id
    where p.green_area_id = any(${ids})
    group by p.species_id, s.scientific_name
    order by plants desc, s.scientific_name
    limit ${limit}
  `)
  return result.rows.map((row) => ({ ...row, speciesId: Number(row.speciesId), plants: Number(row.plants) }))
}

async function poisInside(rows: AreaRow[]) {
  const south = Math.min(...rows.map((row) => Number(row.minLatitude)))
  const north = Math.max(...rows.map((row) => Number(row.maxLatitude)))
  const west = Math.min(...rows.map((row) => Number(row.minLongitude)))
  const east = Math.max(...rows.map((row) => Number(row.maxLongitude)))
  const result = await db.execute<{ id: number, name: string, category: string, latitude: number, longitude: number }>(sql`
    select id, name, category, latitude, longitude from pois
    where latitude between ${south}::double precision and ${north}::double precision
      and longitude between ${west}::double precision and ${east}::double precision
    order by name limit 500
  `)
  const geometries = rows.map(geometryOf).filter((geometry) => geometry !== null)
  return result.rows
    .filter((poi) => geometries.some((geometry) => distanceToGeometry(Number(poi.longitude), Number(poi.latitude), geometry) === 0))
    .map((poi) => ({
      id: Number(poi.id), name: poi.name, category: poi.category,
      latitude: Number(poi.latitude), longitude: Number(poi.longitude),
    }))
}

/** Ficha de una zona verde: todos los polígonos de su grupo, flora, POIs y artículos. */
export async function getGreenAreaGroup(groupSlug: string, language: string, selectedId: number | null = null) {
  const result = await db.execute<AreaRow>(sql`
    select ${FIELDS}, g.geometry from green_areas g where g.group_slug = ${groupSlug} order by g.name, g.id
  `)
  const rows = result.rows
  if (rows.length === 0) return null
  const ids = rows.map((row) => Number(row.id))
  const idList = sql`array[${sql.join(ids.map((id) => sql`${id}::integer`), sql`, `)}]`
  const [count, species, pois, articles, dataSource] = await Promise.all([
    db.execute<{ total: number, species: number }>(sql`
      select count(*)::int as total, count(distinct species_id)::int as species
      from plant_locations where green_area_id = any(${idList})
    `),
    topSpecies(ids, language, 10),
    poisInside(rows),
    articlesForGroups(language, [groupSlug]),
    getDataSource(rows[0]!.source),
  ])
  const areas = rows.map((row) => publicArea(row, true))
  const totalArea = areas.reduce((total, area) => total + (area.areaM2 ?? 0), 0)
  return {
    groupSlug,
    name: groupTitle(groupSlug, rows[0]!.name),
    selectedId,
    typology: rows[0]!.typology,
    neighborhoods: [...new Set(rows.map((row) => row.neighborhood).filter((value) => value !== null))],
    areaM2: totalArea > 0 ? Math.round(totalArea) : null,
    bbox: [
      Math.min(...areas.map((area) => area.bbox[0]!)), Math.min(...areas.map((area) => area.bbox[1]!)),
      Math.max(...areas.map((area) => area.bbox[2]!)), Math.max(...areas.map((area) => area.bbox[3]!)),
    ],
    areas,
    plants: { total: Number(count.rows[0]?.total ?? 0), species: Number(count.rows[0]?.species ?? 0) },
    topSpecies: species,
    pois,
    articles,
    language,
    dataSource,
  }
}

export async function getGreenArea(id: number, language: string) {
  const row = (await db.execute<{ groupSlug: string }>(sql`
    select group_slug as "groupSlug" from green_areas where id = ${id}
  `)).rows[0]
  if (!row) return null
  return getGreenAreaGroup(row.groupSlug, language, id)
}

/** Parques y jardines donde hay ejemplares de una especie, por número de ejemplares (PA 3013). */
export async function greenAreasForSpecies(speciesId: number, limit = 5) {
  const result = await db.execute<{ groupSlug: string, id: number, name: string, plants: number }>(sql`
    select g.group_slug as "groupSlug", min(g.id)::int as id, min(g.name) as name, count(*)::int as plants
    from plant_locations p join green_areas g on g.id = p.green_area_id
    where p.species_id = ${speciesId} and g.featured
    group by g.group_slug
    order by plants desc, g.group_slug
    limit ${limit}
  `)
  if (result.rows.length === 0) return []
  const groups = result.rows.map((row) => row.groupSlug)
  const list = sql`array[${sql.join(groups.map((group) => sql`${group}::text`), sql`, `)}]`
  const withArticles = await db.execute<{ group: string }>(sql`
    select distinct green_area_group as "group" from editorial_articles where green_area_group = any(${list})
  `)
  const hasArticle = new Set(withArticles.rows.map((row) => row.group))
  return result.rows.map((row) => ({
    groupSlug: row.groupSlug,
    id: Number(row.id),
    name: groupTitle(row.groupSlug, row.name),
    plants: Number(row.plants),
    hasArticle: hasArticle.has(row.groupSlug),
  }))
}
