import { CatalogError } from './catalogError.js'
import { isObject } from './valenciaOpenData.js'

// POIs histórico-culturales del geoportal municipal (NM-06). Se importan dos
// capas de puntos de OPENDATA/Turismo: monumentos turísticos y recursos
// turísticos (palacios, iglesias, patrimonio industrial de las rutas de barrio).
// Las capas de BIC/BRL son polígonos con varias geometrías por bien y quedan
// fuera de esta UT: necesitan centroide y deduplicación propios.

const GEOPORTAL = 'https://geoportal.valencia.es/server/rest/services/OPENDATA/Turismo/MapServer'

export type PoiCategory = 'monumento' | 'recurso-turistico'

export interface HeritageSource {
  code: string
  provider: string
  name: string
  url: string
  license: string
  licenseUrl: string
  attribution: string
  logoUrl: string | null
}

// Mismo propietario y licencia que el inventario de arbolado (VALENCIA_ARBOLADO):
// son capas de Dades Obertes del Ajuntament. El logo es el que publica el portal;
// CC BY cubre los datos, no el escudo, así que la ficha usa también la atribución.
const PROVIDER = 'Ajuntament de València'
const LICENSE = 'CC BY 4.0'
const LICENSE_URL = 'https://creativecommons.org/licenses/by/4.0/'
const LOGO_URL = 'https://www.valencia.es/o/valencia-theme/css/img/Ajuntament_logo_compacto.png'

export const MONUMENTOS_SOURCE: HeritageSource = {
  code: 'VALENCIA_MONUMENTOS',
  provider: PROVIDER,
  name: 'Monumentos turísticos',
  url: `${GEOPORTAL}/202`,
  license: LICENSE,
  licenseUrl: LICENSE_URL,
  attribution: 'Fuente de los datos: Ajuntament de València – Dades Obertes (Geoportal, monumentos turísticos). Campos normalizados por Nature MAPS.',
  logoUrl: LOGO_URL,
}

export const RECURSOS_SOURCE: HeritageSource = {
  code: 'VALENCIA_RECURSOS',
  provider: PROVIDER,
  name: 'Recursos turísticos',
  url: `${GEOPORTAL}/226`,
  license: LICENSE,
  licenseUrl: LICENSE_URL,
  attribution: 'Fuente de los datos: Ajuntament de València – Dades Obertes (Geoportal, recursos turísticos). Campos normalizados por Nature MAPS.',
  logoUrl: LOGO_URL,
}

export const HERITAGE_SOURCES: HeritageSource[] = [MONUMENTOS_SOURCE, RECURSOS_SOURCE]

export interface PoiRecord {
  source: string
  externalId: string
  name: string
  category: PoiCategory
  latitude: number
  longitude: number
  sourceUrl: string
  description: string | null
  /** Documento oficial de la ficha del bien (PDF del Ayuntamiento), si lo trae. */
  infoUrl: string | null
}

interface LayerConfig {
  source: HeritageSource
  layer: number
  category: PoiCategory
  idField: string
  fields: string[]
}

const LAYERS: LayerConfig[] = [
  { source: MONUMENTOS_SOURCE, layer: 202, category: 'monumento', idField: 'gid', fields: ['gid', 'nombre'] },
  {
    source: RECURSOS_SOURCE,
    layer: 226,
    category: 'recurso-turistico',
    idField: 'objectid',
    fields: ['objectid', 'nombre', 'descripcion', 'informacion_recurso'],
  },
]

const PAGE_SIZE = 1000

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  // La fuente usa espacios duros (U+00A0) dentro de los nombres.
  return value.replace(/\u00a0/g, ' ').replace(/\s+/g, ' ').trim() || null
}

const CONNECTORS = new Set([
  'de', 'del', 'dels', 'la', 'el', 'els', 'les', 'i', 'y', 'en', 'a', 'al', 'als', 'o',
  'l', 'd', 'pel', 'pels', 'amb', 'per',
])

// Partículas con apóstrofo (`d'`, `l'`, `s'`, `n'`): el apóstrofo no separa
// palabras para el geoportal, así que el token se parte aparte. La partícula va
// en minúscula dentro del nombre y solo se capitaliza al principio.
const PARTICLES = new Set(['d', 'l', 's', 'n'])

// Números romanos completos (`II`, `IV`, `XVII`…). Capitalizar letra a letra los
// dejaba como `Ii`.
const ROMAN = /^(?=[ivxlcdm])[ivxlcdm]{1,7}$/

function capitalize(word: string): string {
  return word.charAt(0).toLocaleUpperCase('ca') + word.slice(1)
}

/**
 * Los nombres del geoportal vienen en mayúsculas (`PALAU DELS MARQUESOS…`). Se
 * pasan a mayúscula inicial, respetando conectores, partículas y números
 * romanos, para que la ficha no grite. El valor original del geoportal queda
 * trazado en sourceUrl.
 *
 * Dos reglas existen por casos reales ya guardados en la base:
 * - partículas con apóstrofo (`CASA PALAU DELS COMTES D'ALMENARA` →
 *   `d'Almenara`, `L'ALMOINA…` → `L'Almoina`);
 * - números romanos (`CASA CONSISTORIAL… - II`), que no deben quedar como `Ii`.
 */
export function displayName(raw: string): string {
  const words = raw.toLocaleLowerCase('ca').split(' ')
  return words
    .map((word, index) => {
      const apostrophe = word.indexOf("'")
      if (apostrophe > 0 && PARTICLES.has(word.slice(0, apostrophe))) {
        const particle = word.slice(0, apostrophe + 1)
        const rest = capitalize(word.slice(apostrophe + 1))
        return (index === 0 ? capitalize(particle) : particle) + rest
      }
      // Los conectores mandan sobre los números romanos: `i` es conector y
      // también numeral, y en `CASA CONSISTORIAL I ENTORN` debe ser minúscula.
      if (index > 0 && CONNECTORS.has(word)) return word
      if (ROMAN.test(word)) return word.toLocaleUpperCase('ca')
      if (word.length <= 1) return word.toLocaleUpperCase('ca')
      return capitalize(word)
    })
    .join(' ')
}

function httpsUrl(value: unknown): string | null {
  if (typeof value !== 'string') return null
  try {
    const url = new URL(value.trim())
    return url.protocol === 'https:' || url.protocol === 'http:' ? url.toString() : null
  } catch { return null }
}

function featureUrl(layer: number, idField: string, externalId: string, fields: string[]): string {
  const url = new URL(`${GEOPORTAL}/${layer}/query`)
  url.searchParams.set('where', `${idField}=${/^\d+$/.test(externalId) ? externalId : `'${externalId.replaceAll("'", "''")}'`}`)
  url.searchParams.set('outFields', fields.join(','))
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('f', 'json')
  return url.toString()
}

function normalizeFeature(feature: unknown, config: LayerConfig): PoiRecord {
  if (!isObject(feature) || !isObject(feature.attributes) || !isObject(feature.geometry)) {
    throw new Error('Invalid feature')
  }
  const attributes = feature.attributes
  const geometry = feature.geometry
  const longitude = geometry.x
  const latitude = geometry.y
  if (typeof longitude !== 'number' || typeof latitude !== 'number'
    || !Number.isFinite(longitude) || !Number.isFinite(latitude)
    || longitude < -180 || longitude > 180 || latitude < -90 || latitude > 90) {
    throw new Error('Invalid coordinates')
  }
  const id = attributes[config.idField]
  const externalId = typeof id === 'number' ? String(id) : text(id)
  if (!externalId) throw new Error('Missing source id')
  const name = text(attributes.nombre)
  if (!name) throw new Error('Missing name')
  return {
    source: config.source.code,
    externalId: `${config.layer}:${externalId}`,
    name: displayName(name),
    category: config.category,
    latitude,
    longitude,
    sourceUrl: featureUrl(config.layer, config.idField, externalId, config.fields),
    description: text(attributes.descripcion),
    infoUrl: httpsUrl(attributes.informacion_recurso),
  }
}

async function fetchPage(config: LayerConfig, offset: number) {
  const url = new URL(`${GEOPORTAL}/${config.layer}/query`)
  for (const [key, value] of Object.entries({
    where: '1=1',
    outFields: config.fields.join(','),
    outSR: '4326',
    orderByFields: `${config.idField} ASC`,
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: 'json',
  })) url.searchParams.set(key, value)

  let data: unknown
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(45_000) })
    if (!response.ok) throw new Error('Upstream HTTP error')
    data = await response.json()
  } catch {
    throw new CatalogError(502, `No se pudo descargar la capa ${config.layer} del geoportal de València`)
  }
  if (!isObject(data) || !Array.isArray(data.features)) {
    throw new CatalogError(502, 'Formato inesperado del geoportal de València')
  }
  const records: PoiRecord[] = []
  let invalid = 0
  for (const feature of data.features as unknown[]) {
    try { records.push(normalizeFeature(feature, config)) } catch { invalid++ }
  }
  const fetched = data.features.length
  const hasMore = data.exceededTransferLimit === true
    || (data.exceededTransferLimit !== false && fetched === PAGE_SIZE)
  return { records, fetched, invalid, nextOffset: hasMore ? offset + fetched : null }
}

/** Descarga completa de una capa del geoportal: pocas páginas, sin filtrar. */
export async function fetchHeritageLayer(config: LayerConfig) {
  const records: PoiRecord[] = []
  let invalid = 0
  let fetched = 0
  let offset: number | null = 0
  while (offset !== null) {
    const page = await fetchPage(config, offset)
    records.push(...page.records)
    invalid += page.invalid
    fetched += page.fetched
    offset = page.nextOffset
  }
  return { records, fetched, invalid }
}

export function heritageLayers(): LayerConfig[] {
  return LAYERS
}
