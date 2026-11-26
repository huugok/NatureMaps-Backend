import { createHash } from 'node:crypto'
import { getRoute } from './routeCatalog.js'
import { getTree } from './treeCatalog.js'
import { getPoi } from './poiCatalog.js'
import { getSpeciesDetail } from './speciesCatalog.js'
import { CatalogError } from './catalogError.js'

/** Un paquete de lectura: nunca genera rutas, enriquece Wikipedia ni descarga
 * imágenes en el servidor. Conserva las licencias y el idioma real de cada ficha. */
export async function getRouteOffline(id: number, language: string) {
  const route = await getRoute(id)
  if (!route) return null
  const species = new Map<number, Awaited<ReturnType<typeof getSpeciesDetail>>>()
  const stops = []
  // Secuencial y deduplicado: evita una ráfaga de consultas en Neon.
  const plants = new Map<number, Awaited<ReturnType<typeof getTree>>>()
  const pois = new Map<number, Awaited<ReturnType<typeof getPoi>>>()
  for (const stop of route.stops) {
    if (stop.kind === 'planta') {
      if (!plants.has(stop.id)) plants.set(stop.id, await getTree(stop.id, language))
      const plant = plants.get(stop.id)
      if (!plant) throw new CatalogError(409, 'La ruta contiene una parada que ya no existe')
      if (plant.speciesId !== null && !species.has(plant.speciesId)) {
        species.set(plant.speciesId, await getSpeciesDetail(plant.speciesId, language, 50, 0))
      }
      stops.push({ kind: stop.kind, id: stop.id, plant, poi: null })
    } else {
      if (!pois.has(stop.id)) pois.set(stop.id, await getPoi(stop.id, language))
      const poi = pois.get(stop.id)
      if (!poi) throw new CatalogError(409, 'La ruta contiene una parada que ya no existe')
      stops.push({ kind: stop.kind, id: stop.id, plant: null, poi })
    }
  }
  // Las mismas fotos pueden aparecer en varias paradas/especies.
  const images = new Map<string, Record<string, unknown>>()
  for (const item of [...species.values(), ...pois.values()]) {
    const image = item && 'image' in item ? item.image : null
    if (image && typeof image === 'object' && 'url' in image && typeof image.url === 'string') {
      images.set(image.url, image as Record<string, unknown>)
    }
  }
  const content = {
    schemaVersion: 3 as const,
    language,
    route,
    stops,
    species: [...species.values()].filter((item) => item !== null),
    images: [...images.values()],
  }
  return { ...content, revision: createHash('sha256').update(JSON.stringify(content)).digest('hex') }
}
