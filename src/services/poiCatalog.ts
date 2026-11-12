import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../db/index.js'
import { getDataSource } from './dataSources.js'

// Consultas de POIs (NM-06): puntos de interés histórico-culturales del mapa con
// su ficha. Por defecto la lista de cercanos viaja con la ficha completa para que
// abrir un marcador no dependa de una segunda petición; `detail=lite` sirve la
// proyección que pinta el mapa (resumen corto + imagen) y el detalle se pide
// aparte. El endpoint de detalle existe para enlaces directos y para el mapa en frío.

export type PoiImage = {
  url: string
  sourceUrl: string
  author: string
  license: string
  licenseUrl: string
  attribution: string
}

export type PoiProfile = {
  description: string
  language: string
  source: string
  sourceUrl: string
  license: string | null
  licenseUrl: string | null
}

type PoiRow = {
  id: number
  name: string
  category: string
  latitude: number
  longitude: number
  address: string | null
  source: string
  externalId: string
  sourceUrl: string
  infoUrl: string | null
  wikidataId: string | null
  wikipediaUrl: string | null
  imageUrl: string | null
  imageSourceUrl: string | null
  imageAuthor: string | null
  imageLicense: string | null
  imageLicenseUrl: string | null
  imageAttribution: string | null
  profileDescription: string | null
  profileLanguage: string | null
  profileSource: string | null
  profileSourceUrl: string | null
  profileLicense: string | null
  profileLicenseUrl: string | null
}

const SELECT_FIELDS = sql`p.id, p.name, p.category, p.latitude, p.longitude, p.address,
  p.source, p.external_id as "externalId", p.source_url as "sourceUrl", p.info_url as "infoUrl",
  p.wikidata_id as "wikidataId", p.wikipedia_url as "wikipediaUrl",
  p.image_url as "imageUrl", p.image_source_url as "imageSourceUrl", p.image_author as "imageAuthor",
  p.image_license as "imageLicense", p.image_license_url as "imageLicenseUrl",
  p.image_attribution as "imageAttribution",
  pr.description as "profileDescription", pr.language as "profileLanguage",
  pr.source as "profileSource", pr.source_url as "profileSourceUrl",
  pr.license as "profileLicense", pr.license_url as "profileLicenseUrl"`

// Idioma pedido primero y luego los del contenido curado; nunca se deja la
// descripción vacía si existe en otro idioma (la fuente lo indica en `language`).
function profileLanguageOrder(language: string) {
  const languages = [...new Set([language, language.split('-')[0] ?? language, 'es', 'ca', 'en'])]
  return sql`array[${sql.join(languages.map((lang) => sql`${lang}::text`), sql`, `)}]`
}

/** Descripción curada en el idioma pedido, luego es/ca/en. Un solo array de parámetros. */
function profileJoin(language: string) {
  const languageOrder = profileLanguageOrder(language)
  return sql`left join lateral (
    select description, language, source, source_url, license, license_url
    from poi_profiles where poi_id = p.id and language = any(${languageOrder})
    order by array_position(${languageOrder}, language) limit 1
  ) pr on true`
}

function selectPois(language: string, condition: SQL, limit: number, offset = 0) {
  return db.execute<PoiRow>(sql`
    select ${SELECT_FIELDS}
    from pois p ${profileJoin(language)}
    where ${condition} order by p.id limit ${limit} offset ${offset}
  `)
}

function image(row: PoiRow): PoiImage | null {
  if (!row.imageUrl || !row.imageSourceUrl || !row.imageAuthor || !row.imageLicense
    || !row.imageLicenseUrl || !row.imageAttribution) return null
  return {
    url: row.imageUrl,
    sourceUrl: row.imageSourceUrl,
    author: row.imageAuthor,
    license: row.imageLicense,
    licenseUrl: row.imageLicenseUrl,
    attribution: row.imageAttribution,
  }
}

function profile(row: PoiRow): PoiProfile | null {
  if (!row.profileDescription || !row.profileLanguage || !row.profileSource || !row.profileSourceUrl) return null
  return {
    description: row.profileDescription,
    language: row.profileLanguage,
    source: row.profileSource,
    sourceUrl: row.profileSourceUrl,
    license: row.profileLicense,
    licenseUrl: row.profileLicenseUrl,
  }
}

function publicPoi(row: PoiRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    address: row.address,
    source: row.source,
    externalId: row.externalId,
    sourceUrl: row.sourceUrl,
    infoUrl: row.infoUrl,
    wikidataId: row.wikidataId,
    wikipediaUrl: row.wikipediaUrl,
    image: image(row),
    profile: profile(row),
  }
}

export type PublicPoi = ReturnType<typeof publicPoi>
export type NearbyPoi = PublicPoi & { distance: number }

/** Proyección que consume el mapa con `detail=lite`: lo que pinta la tarjeta. */
export type NearbyPoiLite = {
  id: number
  name: string
  category: string
  latitude: number
  longitude: number
  distance: number
  source: string
  summary: string | null
  hasProfile: boolean
  imageUrl: string | null
}

/** Resumen de la tarjeta del mapa: recorta la descripción curada, no consulta más. */
const SUMMARY_LENGTH = 200

function litePoi(row: PoiRow & { distance: number }): NearbyPoiLite {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    latitude: row.latitude,
    longitude: row.longitude,
    distance: row.distance,
    source: row.source,
    summary: row.profileDescription ? row.profileDescription.slice(0, SUMMARY_LENGTH) : null,
    hasProfile: profile(row) !== null,
    imageUrl: row.imageUrl,
  }
}

// Straight-line distance in meters, same plain math as treeCatalog.
function distanceMeters(latitude: number, longitude: number) {
  return sql`6371000 * 2 * asin(sqrt(
    power(sin(radians(p.latitude - ${latitude}::double precision) / 2), 2)
    + cos(radians(${latitude}::double precision)) * cos(radians(p.latitude))
      * power(sin(radians(p.longitude - ${longitude}::double precision) / 2), 2)
  ))`
}

async function sourcesFor(codes: string[]) {
  const entries = await Promise.all([...new Set(codes)].map(async (code) => [code, await getDataSource(code)] as const))
  return Object.fromEntries(entries.filter(([, source]) => source !== null))
}

export async function listNearbyPois(
  latitude: number, longitude: number, radius: number, limit: number, language: string,
  detail: 'lite' | 'full' = 'full',
) {
  const metersPerDegree = 111_320
  const cosLatitude = Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const distance = distanceMeters(latitude, longitude)
  const result = await db.execute<PoiRow & { distance: number }>(sql`
    select ${SELECT_FIELDS}, round(${distance}::numeric)::int as distance
    from pois p ${profileJoin(language)}
    where p.latitude between ${latitude - radius / metersPerDegree} and ${latitude + radius / metersPerDegree}
      and p.longitude between ${longitude - radius / (metersPerDegree * cosLatitude)} and ${longitude + radius / (metersPerDegree * cosLatitude)}
      and ${distance} <= ${radius}::double precision
    order by ${distance} asc
    limit ${limit}
  `)
  const sources = await sourcesFor(result.rows.map((row) => row.source))
  const pois = detail === 'lite'
    ? result.rows.map(litePoi)
    : result.rows.map((row) => ({ ...publicPoi(row), distance: row.distance }))
  return {
    center: { latitude, longitude },
    radius,
    returned: pois.length,
    limit,
    language,
    sources,
    pois,
  }
}

export async function getPoi(id: number, language: string) {
  const row = (await selectPois(language, sql`p.id = ${id}`, 1)).rows[0]
  if (!row) return null
  const dataSource = await getDataSource(row.source)
  return { ...publicPoi(row), dataSource }
}
