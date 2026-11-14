import { CatalogError } from './catalogError.js'
import { boundingBox, mergeGeometries, parseAreaGeometry, representativePoint } from './geometry.js'
import type { AreaGeometry, BoundingBox } from './geometry.js'
import { displayName } from './valenciaHeritage.js'
import { isObject } from './valenciaOpenData.js'

// Zonas verdes del geoportal municipal (NM-08): capa de polígonos «Espais
// Verds / Espacios Verdes» de OPENDATA/MedioAmbiente, el mismo servicio que el
// inventario de arbolado (capa 151). Trae 807 polígonos; solo los parques
// urbanos y los jardines de especial protección se muestran en el mapa
// (`featured`), el resto (isletas, bulevares, acompañamiento viario) sirve para
// saber en qué zona está cada ejemplar.

const LAYER_URL = 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/8'

export const GREEN_AREAS_SOURCE = {
  code: 'VALENCIA_ESPACIOS_VERDES',
  provider: 'Ajuntament de València',
  name: 'Espais Verds — Espacios Verdes',
  url: LAYER_URL,
  license: 'CC BY 4.0',
  licenseUrl: 'https://creativecommons.org/licenses/by/4.0/',
  attribution: 'Fuente de los datos: Ajuntament de València – Dades Obertes (Geoportal, espacios verdes). Nombres normalizados y contornos simplificados por Nature MAPS.',
  logoUrl: 'https://www.valencia.es/o/valencia-theme/css/img/Ajuntament_logo_compacto.png',
}

const FEATURED_TYPOLOGIES = new Set(['Parques Urbanos', 'Jardines Especial Protección'])

// Curación de nombres y grupos. La fuente escribe en mayúsculas, con formato
// callejero y alguna errata («JARDIN DE LAS ESPERIDES»); aquí se fija el nombre
// con el que se conoce el parque y un slug estable para enlazar artículos. La
// clave es `id_jardin`, que es el identificador oficial y queda en external_id.
const CURATED: Record<string, { group: string, name: string }> = {
  99120311: { group: 'jardin-de-las-hesperides', name: 'Jardín de las Hespérides' },
  99100501: { group: 'jardines-del-real', name: 'Jardines del Real (Viveros)' },
  99120440: { group: 'parque-de-cabecera', name: 'Parque de Cabecera' },
  99120611: { group: 'jardin-de-monforte', name: 'Jardín de Monforte' },
  99120210: { group: 'parque-central', name: 'Parque Central' },
  99121620: { group: 'parque-de-benicalap', name: 'Parque de Benicalap' },
  99110130: { group: 'parterre', name: 'Jardín del Parterre' },
  99110119: { group: 'glorieta', name: 'Jardines de la Glorieta' },
  99100601: { group: 'paseo-de-la-alameda', name: 'Paseo de la Alameda' },
  99120510: { group: 'parque-de-marxalenes', name: 'Parque de Marxalenes' },
  99120730: { group: 'parque-del-oeste', name: 'Parque del Oeste' },
  99120441: { group: 'jardin-de-polifilo', name: 'Jardín de Polifilo' },
  99121210: { group: 'jardin-de-ayora', name: 'Jardín de Ayora' },
  99121531: { group: 'parque-de-orriols', name: 'Parque de Orriols' },
  99110926: { group: 'parque-de-la-rambleta', name: 'Parque de la Rambleta' },
  99121031: { group: 'parque-de-malilla', name: 'Parque Urbano de Malilla' },
  99121150: { group: 'parque-de-natzaret', name: 'Parque de Natzaret' },
}

// Grupos formados por varios polígonos: nombre del conjunto para la ficha.
export const GROUP_TITLES: Record<string, string> = {
  'jardin-del-turia': 'Jardín del Turia',
}

const TURIA_SECTION = /^JARD[IÍ]N DEL TURIA \(TRAMO (\d+)\)$/i

/** Nombre del grupo: el del conjunto si tiene varios polígonos, o el de su zona. */
export function groupTitle(groupSlug: string, fallback: string): string {
  return GROUP_TITLES[groupSlug] ?? fallback
}

export function curate(externalId: string, reportedName: string): { group: string, name: string } {
  const curated = CURATED[externalId]
  if (curated) return curated
  const turia = TURIA_SECTION.exec(reportedName)
  if (turia) return { group: 'jardin-del-turia', name: `Jardín del Turia (tramo ${Number(turia[1])})` }
  return { group: `zona-${externalId}`, name: readableName(reportedName) }
}

/** Nombre de la fuente en mayúscula inicial, también tras un paréntesis: «(ISLETA)» → «(Isleta)». */
function readableName(reportedName: string): string {
  return displayName(reportedName).replace(/\(\p{Ll}/gu, (match) => match.toLocaleUpperCase('es'))
}

export interface GreenAreaRecord extends BoundingBox {
  source: string
  externalId: string
  name: string
  reportedName: string
  groupSlug: string
  typology: string | null
  neighborhood: string | null
  areaM2: number | null
  featured: boolean
  geometry: AreaGeometry
  latitude: number
  longitude: number
  sourceUrl: string
}

function text(value: unknown): string | null {
  if (typeof value !== 'string') return null
  return value.replace(/ /g, ' ').replace(/\s+/g, ' ').trim() || null
}

function featureUrl(externalId: string): string {
  const url = new URL(`${LAYER_URL}/query`)
  url.searchParams.set('where', `id_jardin='${externalId.replaceAll("'", "''")}'`)
  url.searchParams.set('outFields', 'id_jardin,nombre,barrio,tipologia,sup_total')
  url.searchParams.set('outSR', '4326')
  url.searchParams.set('f', 'geojson')
  return url.toString()
}

interface RawArea {
  externalId: string
  reportedName: string
  typology: string | null
  neighborhood: string | null
  areaM2: number | null
  geometry: AreaGeometry
}

function normalizeFeature(feature: unknown): RawArea {
  if (!isObject(feature) || feature.type !== 'Feature' || !isObject(feature.properties)) {
    throw new Error('Invalid feature')
  }
  const geometry = parseAreaGeometry(feature.geometry)
  if (!geometry) throw new Error('Invalid geometry')
  const properties = feature.properties
  const externalId = text(properties.id_jardin)
  if (!externalId) throw new Error('Missing id_jardin')
  const reportedName = text(properties.nombre)
  if (!reportedName) throw new Error('Missing name')
  const area = properties.sup_total
  return {
    externalId,
    reportedName,
    typology: text(properties.tipologia),
    neighborhood: text(properties.barrio),
    areaM2: typeof area === 'number' && Number.isFinite(area) && area > 0 ? area : null,
    geometry,
  }
}

const PAGE_SIZE = 1000

async function fetchPage(offset: number) {
  const url = new URL(`${LAYER_URL}/query`)
  for (const [key, value] of Object.entries({
    where: '1=1',
    outFields: 'objectid,id_jardin,nombre,barrio,tipologia,sup_total',
    outSR: '4326',
    // Contorno simplificado en origen (~1 m) y 6 decimales: suficiente para
    // pintar el borde en el móvil y varias veces más ligero que el original.
    maxAllowableOffset: '0.00001',
    geometryPrecision: '6',
    orderByFields: 'objectid ASC',
    resultOffset: String(offset),
    resultRecordCount: String(PAGE_SIZE),
    f: 'geojson',
  })) url.searchParams.set(key, value)

  let data: unknown
  try {
    const response = await fetch(url, { signal: AbortSignal.timeout(60_000) })
    if (!response.ok) throw new Error('Upstream HTTP error')
    data = await response.json()
  } catch {
    throw new CatalogError(502, 'No se pudo descargar la capa de espacios verdes del geoportal de València')
  }
  if (!isObject(data) || data.type !== 'FeatureCollection' || !Array.isArray(data.features)) {
    throw new CatalogError(502, 'Formato inesperado de la capa de espacios verdes')
  }
  const properties = isObject(data.properties) ? data.properties : {}
  const exceeded = data.exceededTransferLimit ?? properties.exceededTransferLimit
  const fetched = data.features.length
  const hasMore = exceeded === true || (exceeded !== false && fetched === PAGE_SIZE)
  return { features: data.features as unknown[], fetched, nextOffset: hasMore && fetched > 0 ? offset + fetched : null }
}

/** Descarga y normaliza todas las zonas verdes. Une los polígonos con el mismo id_jardin. */
export async function fetchValenciaGreenAreas() {
  const byId = new Map<string, RawArea & { parts: AreaGeometry[] }>()
  let fetched = 0
  let invalid = 0
  let offset: number | null = 0
  while (offset !== null) {
    const page = await fetchPage(offset)
    fetched += page.fetched
    for (const feature of page.features) {
      try {
        const area = normalizeFeature(feature)
        const existing = byId.get(area.externalId)
        if (existing) existing.parts.push(area.geometry)
        else byId.set(area.externalId, { ...area, parts: [area.geometry] })
      } catch { invalid++ }
    }
    offset = page.nextOffset
  }

  const records: GreenAreaRecord[] = [...byId.values()].map((area) => {
    const geometry = mergeGeometries(area.parts)
    const curated = curate(area.externalId, area.reportedName)
    return {
      source: GREEN_AREAS_SOURCE.code,
      externalId: area.externalId,
      name: curated.name,
      reportedName: area.reportedName,
      groupSlug: curated.group,
      typology: area.typology,
      neighborhood: area.neighborhood ? displayName(area.neighborhood) : null,
      areaM2: area.areaM2,
      featured: area.typology !== null && FEATURED_TYPOLOGIES.has(area.typology),
      geometry,
      ...boundingBox(geometry),
      ...representativePoint(geometry),
      sourceUrl: featureUrl(area.externalId),
    }
  })
  return { records, fetched, invalid }
}
