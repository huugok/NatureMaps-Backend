import { CatalogError } from './catalogError.js'
import { toBinomialName } from './taxonomyNames.js'

export const VALENCIA_SOURCE = {
  code: 'VALENCIA_ARBOLADO',
  provider: 'Ajuntament de València',
  name: 'Arbolado — Arbratge',
  url: 'https://opendata.vlci.valencia.es/es/dataset/arbratge-arbolado',
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Fuente de los datos: Ajuntament de València – Dades Obertes. Campos normalizados por Nature MAPS.',
  // Logo que el propio portal muestra como organización del conjunto de datos. CC BY cubre los datos,
  // no necesariamente el uso del escudo: confirmar antes de mostrarlo. Si es null, la ficha usa
  // solo `provider` y `attribution` como identificación de la fuente.
  logoUrl: 'https://www.valencia.es/o/valencia-theme/css/img/Ajuntament_logo_compacto.png',
}

const ENDPOINT = 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151/query'

export interface InventoryRecord {
  isPlant: boolean
  externalId: string
  sourceUrl: string
  reportedScientificName: string | null
  taxonName: string | null
  commonNameEs: string | null
  commonNameCa: string | null
  district: string | null
  neighborhood: string | null
  latitude: number
  longitude: number
}

export function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function optionalText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  if (typeof value !== 'string') throw new Error('Invalid text')
  return value.trim().replace(/\s+/g, ' ') || null
}

function normalizeFeature(feature: unknown): InventoryRecord {
  if (!isObject(feature) || feature.type !== 'Feature' || !isObject(feature.properties)
    || !isObject(feature.geometry) || feature.geometry.type !== 'Point') {
    throw new Error('Invalid feature')
  }
  const properties = feature.properties
  const coordinates = feature.geometry.coordinates
  if (!Array.isArray(coordinates)) throw new Error('Invalid coordinates')
  const [longitude, latitude] = coordinates as unknown[]
  if (typeof longitude !== 'number' || typeof latitude !== 'number'
    || !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('Invalid coordinates')
  }
  const externalId = optionalText(properties.idarbol)
  if (!externalId) throw new Error('Missing idarbol')
  const scientificName = optionalText(properties.nom_botanico)
  const status = optionalText(properties.estado_gral)
  const commonName = (value: unknown) => {
    const name = optionalText(value)
    return name?.toLowerCase() === 'falta' ? null : name
  }
  const sourceUrl = new URL(ENDPOINT)
  sourceUrl.searchParams.set('where', `idarbol='${externalId.replaceAll("'", "''")}'`)
  sourceUrl.searchParams.set('outFields', 'idarbol,nom_botanico,nom_comu_c,nom_comu_v,estado_gral,distrito,barrio')
  sourceUrl.searchParams.set('outSR', '4326')
  sourceUrl.searchParams.set('f', 'geojson')
  return {
    isPlant: scientificName?.toLowerCase() !== 'falta' && status?.toLowerCase() !== 'falta',
    externalId,
    sourceUrl: sourceUrl.toString(),
    reportedScientificName: scientificName,
    // Conservative source-local label, not a globally verified taxonomic match.
    taxonName: scientificName ? toBinomialName(scientificName) : null,
    commonNameEs: commonName(properties.nom_comu_c),
    commonNameCa: commonName(properties.nom_comu_v),
    district: optionalText(properties.distrito),
    neighborhood: optionalText(properties.barrio),
    latitude,
    longitude,
  }
}

export async function fetchValenciaTrees(limit: number, offset: number) {
  const url = new URL(ENDPOINT)
  for (const [key, value] of Object.entries({
    where: '1=1',
    outFields: 'objectid,idarbol,nom_botanico,nom_comu_c,nom_comu_v,estado_gral,distrito,barrio',
    outSR: '4326',
    orderByFields: 'objectid ASC',
    resultRecordCount: String(limit),
    resultOffset: String(offset),
    f: 'geojson',
  })) url.searchParams.set(key, value)

  let data: unknown
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(30_000) })
    if (!response.ok) throw new Error('Upstream HTTP error')
    data = await response.json()
  } catch {
    throw new CatalogError(502, 'No se pudo descargar el inventario de València')
  }
  if (!isObject(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)
    || data.features.length > limit) {
    throw new CatalogError(502, 'Formato inesperado del inventario de València')
  }
  const records: InventoryRecord[] = []
  const seen = new Set<string>()
  let invalid = 0
  for (const feature of data.features as unknown[]) {
    try {
      const record = normalizeFeature(feature)
      if (seen.has(record.externalId)) throw new Error('Duplicate source ID')
      seen.add(record.externalId)
      records.push(record)
    } catch {
      invalid++
    }
  }
  const fetched = data.features.length
  const hasMore = fetched > 0 && (data.exceededTransferLimit === true
    || (data.exceededTransferLimit !== false && fetched === limit))
  return { records, fetched, invalid, nextOffset: hasMore ? offset + fetched : null }
}
