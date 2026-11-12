import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import type { RoutePoint, RouteStop, RouteStopKind } from '../db/schema.js'
import { CatalogError } from './catalogError.js'
import { valhallaRoute } from './valhalla.js'
import type { ValhallaPoint } from './valhalla.js'

// Generador de rutas botánico-culturales (método reutilizable). Dado un punto de
// partida, una longitud objetivo y el contenido de las paradas, busca paradas
// radialmente en el catálogo, intenta cerrar un anillo repartido alrededor del
// inicio y, si la zona no da para eso, cae a una ruta lineal en la dirección con
// más paradas (siempre con la longitud objetivo: mejor en línea que no generar).
// Las métricas reales (distancia, duración, geometría) las mide Valhalla sobre
// el grafo OSM; aquí solo se elige dónde parar y en qué orden. La seed de rutas
// predefinidas lo llama una vez por ruta; el futuro `POST /routes` de rutas de
// usuario llamará a este mismo método.

export type RouteTheme = 'botanica' | 'cultural' | 'mixta'
export type RouteShape = 'circular' | 'lineal'

export interface GenerateRouteOptions {
  start: { latitude: number, longitude: number }
  /** Distancia de caminata objetivo en metros. */
  targetDistance: number
  content: RouteTheme
}

export interface GeneratedRoute {
  theme: RouteTheme
  shape: RouteShape
  distanceMeters: number
  durationSeconds: number
  stops: RouteStop[]
  path: RoutePoint[]
}

// Metros de recorrido por parada: una ruta de 5 km lleva ~10 paradas.
const METERS_PER_STOP = 500
// Factor de desvío a pie: el camino real por calles es ~30 % más largo que la
// línea recta entre puntos; con él se traduce la longitud objetivo en radios.
const WALKING_DETOUR = 1.3
// Radios relativos que se prueban para cerrar el anillo, del más natural al más forzado.
const RING_SCALES = [1, 1.15, 0.85, 1.3, 0.7]
// (RING_SCALES quedó del diseño inicial: el bucle actual reescala con la
// medición real de Valhalla, que manda sobre cualquier estimación.)
// Radio máximo de búsqueda: el mismo tope que el contrato de /trees/nearby.
const MAX_SEARCH_RADIUS = 10_000

type Candidate = RouteStop & { distance: number }
type Plane = { x: number, y: number }

// Proyección local equirectangular a metros alrededor del origen: para elegir
// paradas (ángulos, radios, corredores) da exactitud de sobra y evita SQL.
function project(origin: { latitude: number, longitude: number }, point: { latitude: number, longitude: number }): Plane {
  const x = (point.longitude - origin.longitude) * 111_320 * Math.cos((origin.latitude * Math.PI) / 180)
  const y = (point.latitude - origin.latitude) * 110_540
  return { x, y }
}

function angleOf(point: Plane) {
  return (Math.atan2(point.y, point.x) * 180) / Math.PI
}

/** Diferencia de ángulos en grados, reducida a [-180, 180]. */
function angleDiff(from: number, to: number) {
  const diff = ((to - from) % 360 + 540) % 360 - 180
  return diff
}

/** Paradas candidatas del catálogo (plantas del inventario y/o POIs), con su
 * distancia al inicio en metros. Un límite generoso por tabla: sobra con las
 * más cercanas y la proyección local se encarga del resto. */
async function fetchCandidates(
  start: { latitude: number, longitude: number },
  content: RouteTheme,
  searchRadius: number,
): Promise<Candidate[]> {
  const metersPerDegree = 111_320
  const cosLatitude = Math.max(Math.cos((start.latitude * Math.PI) / 180), 0.01)
  const distance = sql`6371000 * 2 * asin(sqrt(
    power(sin(radians(p.latitude - ${start.latitude}::double precision) / 2), 2)
    + cos(radians(${start.latitude}::double precision)) * cos(radians(p.latitude))
      * power(sin(radians(p.longitude - ${start.longitude}::double precision) / 2), 2)
  ))`
  const bbox = sql`p.latitude between ${start.latitude - searchRadius / metersPerDegree}
    and ${start.latitude + searchRadius / metersPerDegree}
    and p.longitude between ${start.longitude - searchRadius / (metersPerDegree * cosLatitude)}
    and ${start.longitude + searchRadius / (metersPerDegree * cosLatitude)}`

  const queries = [
    content !== 'cultural' ? db.execute<Candidate>(sql`
      select 'planta'::text as kind, p.id, coalesce(n.name, s.scientific_name, p.reported_scientific_name, 'Planta sin identificar') as name,
        p.latitude, p.longitude, round(${distance}::numeric)::int as distance
      from plant_locations p
      left join species s on s.id = p.species_id
      left join lateral (
        select name from plant_names where plant_location_id = p.id and language in ('es', 'ca', 'en')
        order by array_position(array['es', 'ca', 'en'], language) limit 1
      ) n on true
      where ${bbox} and ${distance} <= ${searchRadius}::double precision
      order by random() limit 800`) : null,
    content !== 'botanica' ? db.execute<Candidate>(sql`
      select 'poi'::text as kind, p.id, p.name, p.latitude, p.longitude,
        round(${distance}::numeric)::int as distance
      from pois p
      where ${bbox} and ${distance} <= ${searchRadius}::double precision
      order by ${distance} asc limit 300`) : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null)

  const results = await Promise.all(queries)
  const candidates: Candidate[] = []
  for (const result of results) for (const row of result.rows) {
    if (row.kind === 'planta' || row.kind === 'poi') {
      candidates.push({ kind: row.kind as RouteStopKind, id: row.id, name: row.name,
        latitude: row.latitude, longitude: row.longitude, distance: row.distance })
    }
  }
  return candidates
}

/** Contenido de cada hueco: en la mixta alternan planta y POI por construcción
 * (empezando por planta, que nunca falta); en las demás, el tipo de la ruta. */
function slotKind(slot: number, content: RouteTheme): RouteStopKind {
  if (content === 'botanica') return 'planta'
  if (content === 'cultural') return 'poi'
  return slot % 2 === 0 ? 'planta' : 'poi'
}

/** Devuelve la candidata sin usar con mejor puntuación del pool; `null` descarta. */
function pickNearest(pool: Candidate[], used: Set<Candidate>, scoreOf: (candidate: Candidate) => number | null): Candidate | undefined {
  let best: { candidate: Candidate, score: number } | undefined
  for (const candidate of pool) {
    if (used.has(candidate)) continue
    const score = scoreOf(candidate)
    if (score === null) continue
    if (best === undefined || score < best.score) best = { candidate, score }
  }
  return best?.candidate
}

/** Elige `slotCount` paradas repartidas alrededor del inicio: para cada ángulo
 * ideal (reparto uniforme) toma la parada sin usar más cercana al punto ideal
 * del anillo. El tipo de cada hueco viene de `slotKind` (la mixta alterna por
 * construcción); si ese tipo no tiene candidata cerca del ideal, el hueco se
 * cubre con lo que haya, para que el anillo no quede con agujeros. */
function pickRing(candidates: Candidate[], start: { latitude: number, longitude: number }, ringRadius: number, slotCount: number, content: RouteTheme): RouteStop[] {
  const used = new Set<Candidate>()
  const pools: Record<RouteStopKind, Candidate[]> = {
    planta: candidates.filter((candidate) => candidate.kind === 'planta'),
    poi: candidates.filter((candidate) => candidate.kind === 'poi'),
  }
  const toStop = (candidate: Candidate): { stop: RouteStop, angle: number } => ({
    stop: { kind: candidate.kind, id: candidate.id, name: candidate.name,
      latitude: candidate.latitude, longitude: candidate.longitude },
    angle: angleOf(project(start, candidate)),
  })
  const scoreOf = (candidate: Candidate, ideal: Plane) => {
    const point = project(start, candidate)
    // Puntaje: distancia al punto ideal, penalizando el desvío radial (una
    // parada cerca del ideal pero a mitad de radio no cierra el anillo).
    const radial = Math.hypot(point.x, point.y)
    // El desvío radial pesa el doble: una parada pegada al círculo evita
    // zigzags hacia dentro y fuera que alargan el recorrido real.
    const score = Math.hypot(point.x - ideal.x, point.y - ideal.y) + 2 * Math.abs(radial - ringRadius)
    return score <= ringRadius ? score : null
  }
  const placed: Array<{ stop: RouteStop, angle: number }> = []
  for (let slot = 0; slot < slotCount; slot++) {
    const radians = (((360 / slotCount) * slot - 90) * Math.PI) / 180 // primera al norte
    const ideal = { x: ringRadius * Math.cos(radians), y: ringRadius * Math.sin(radians) }
    const kind = slotKind(slot, content)
    const chosen = pickNearest(pools[kind], used, (candidate) => scoreOf(candidate, ideal))
      ?? pickNearest(candidates, used, (candidate) => scoreOf(candidate, ideal))
    if (!chosen) continue
    used.add(chosen)
    placed.push(toStop(chosen))
  }
  // Recorrido en orden angular para no cruzarse al caminar el anillo.
  return placed.sort((a, b) => a.angle - b.angle).map((entry) => entry.stop)
}

/** Elige paradas a lo largo de la dirección con más candidatas (ruta lineal con
 * la misma longitud objetivo: mejor en línea que no generar). Mismo reparto de
 * tipos por hueco que el anillo (`slotKind`), con fallback si un tipo no tiene
 * candidata en el corredor. */
function pickLinear(candidates: Candidate[], start: { latitude: number, longitude: number }, targetDistance: number, content: RouteTheme): RouteStop[] {
  const projected = candidates.map((candidate) => ({ candidate, point: project(start, candidate) }))
  // Sector de 90° con más candidatas: la dirección general de la zona.
  const bins = new Array<number>(8).fill(0)
  for (const entry of projected) {
    const sector = Math.floor(((angleOf(entry.point) + 360) % 360) / 45)
    const bin = bins[sector]
    if (bin !== undefined) bins[sector] = bin + 1
  }
  let bestSector = 0
  let bestCount = -1
  bins.forEach((count, sector) => { if (count > bestCount) { bestCount = count; bestSector = sector } })
  const center = bestSector * 45 + 22.5

  const extent = targetDistance / WALKING_DETOUR // largo en línea recta de la ruta
  const slotCount = Math.min(20, Math.max(4, Math.round(targetDistance / METERS_PER_STOP)))
  const used = new Set<Candidate>()
  const byCandidate = new Map<Candidate, { candidate: Candidate, point: Plane }>()
  for (const entry of projected) byCandidate.set(entry.candidate, entry)
  const inCorridor = (entry: { candidate: Candidate, point: Plane }, idealDistance: number) => {
    if (Math.abs(angleDiff(center, angleOf(entry.point))) > 45) return null // fuera del corredor
    const radial = Math.hypot(entry.point.x, entry.point.y)
    if (radial > extent) return null
    // Puntaje: acercarse al ideal a lo largo del corredor y poco desvío lateral.
    const lateral = Math.abs(radial * Math.sin((angleDiff(center, angleOf(entry.point)) * Math.PI) / 180))
    return Math.abs(radial - idealDistance) + lateral
  }
  const stops: Array<{ stop: RouteStop, distance: number }> = []
  for (let slot = 0; slot < slotCount; slot++) {
    const idealDistance = (extent * (slot + 1)) / (slotCount + 1)
    const kind = slotKind(slot, content)
    const corridorOf = (candidate: Candidate) => {
      const entry = byCandidate.get(candidate)
      return entry ? inCorridor(entry, idealDistance) : null
    }
    const chosen = pickNearest(candidates.filter((candidate) => candidate.kind === kind), used, corridorOf)
      ?? pickNearest(candidates, used, corridorOf)
    if (!chosen) continue
    used.add(chosen)
    stops.push({ stop: { kind: chosen.kind, id: chosen.id, name: chosen.name,
      latitude: chosen.latitude, longitude: chosen.longitude },
      distance: chosen.distance })
  }
  // Orden de ida: de la parada más cercana a la más lejana.
  const ordered = stops.sort((a, b) => a.distance - b.distance).map((entry) => entry.stop)
  // Red de seguridad: si el corredor dio muy pocas, la línea con las más lejanas.
  if (ordered.length < 3) {
    const byDistance = [...projected].sort((a, b) => a.candidate.distance - b.candidate.distance)
    const picked: RouteStop[] = []
    for (let index = Math.max(0, byDistance.length - slotCount); index < byDistance.length; index++) {
      const entry = byDistance[index]
      if (entry) picked.push({ kind: entry.candidate.kind, id: entry.candidate.id, name: entry.candidate.name,
        latitude: entry.candidate.latitude, longitude: entry.candidate.longitude })
    }
    return picked.length >= Math.max(1, ordered.length) ? picked : ordered
  }
  return ordered
}

/** Ruta encadenando tramos consecutivos con Valhalla (a pie): con dos puntos por
 * petición no depende del límite de waypoints del servidor. En serie, con pausa
 * entre tramos y un reintento único por tramo (el servidor demo a veces suelta
 * 429/5xx). */
async function routeChain(waypoints: ValhallaPoint[]): Promise<{ distanceMeters: number, durationSeconds: number, path: RoutePoint[] }> {
  const round = (value: number) => Math.round(value * 1e6) / 1e6
  const path: RoutePoint[] = []
  let distanceMeters = 0
  let durationSeconds = 0
  for (let index = 0; index < waypoints.length - 1; index++) {
    const origin = waypoints[index]
    const destination = waypoints[index + 1]
    if (!origin || !destination) continue
    let legs = await valhallaRoute([origin, destination])
    let leg = legs[0]
    if (!leg || !leg.points.length) {
      await new Promise((resolve) => setTimeout(resolve, 800))
      legs = await valhallaRoute([origin, destination])
      leg = legs[0]
    }
    if (!leg) throw new CatalogError(502, 'El servicio de rutas devolvió un tramo vacío')
    if (leg.points.length) {
      const last = path[path.length - 1]
      const first = leg.points[0]
      const contiguous = path.length > 0 && last && first
        && round(last.latitude) === round(first.latitude) && round(last.longitude) === round(first.longitude)
      const segment = contiguous ? leg.points.slice(1) : leg.points
      for (const point of segment) path.push({ latitude: round(point.latitude), longitude: round(point.longitude) })
    }
    distanceMeters += leg.distanceMeters
    durationSeconds += leg.durationSeconds
    if (index < waypoints.length - 2) await new Promise((resolve) => setTimeout(resolve, 300))
  }
  if (path.length < 2) throw new CatalogError(502, 'El servicio de rutas no devolvió geometría')
  return { distanceMeters, durationSeconds, path }
}

/** Genera una ruta: elige paradas (anillo si se puede, línea si no), las mide
 * con Valhalla y ajusta el radio hasta acercarse a la longitud objetivo. */
export async function generateRoute(options: GenerateRouteOptions): Promise<GeneratedRoute> {
  const { start, content } = options
  const target = options.targetDistance
  if (!(target >= 300)) throw new CatalogError(400, 'La longitud objetivo debe ser de al menos 300 metros')

  const baseRingRadius = target / (2 * Math.PI * WALKING_DETOUR)
  const searchRadius = Math.min(MAX_SEARCH_RADIUS, Math.max(baseRingRadius * 1.6, (target / WALKING_DETOUR) * 1.1))
  let candidates = await fetchCandidates(start, content, searchRadius)
  if (!candidates.length) {
    candidates = await fetchCandidates(start, content, MAX_SEARCH_RADIUS)
  }
  if (!candidates.length) throw new CatalogError(500, 'No hay paradas suficientes alrededor del punto de partida')

  const slotCount = Math.min(20, Math.max(5, Math.round(target / METERS_PER_STOP)))
  // 40 % de los huecos: con cultivos escasos (POIs) un mínimo alto mata el
  // anillo a radios menores y obliga al fallback lineal innecesariamente.
  const minStops = Math.max(3, Math.floor(slotCount * 0.4))

  let best: GeneratedRoute | undefined
  // Hasta cuatro intentos (anillo → línea, reescalando con la medición real de
  // Valhalla si se desvía >15 % de la longitud objetivo): se queda el intento
  // más cercano.
  let scale = 1
  for (let attempt = 0; attempt < 4; attempt++) {
    const ringRadius = baseRingRadius * scale
    // 1) Intento de anillo: paradas en una banda alrededor del radio ideal.
    const band = candidates.filter((candidate) => {
      const point = project(start, candidate)
      const radial = Math.hypot(point.x, point.y)
      return radial >= ringRadius * 0.45 && radial <= ringRadius * 1.55
    })
    const ringStops = band.length >= minStops ? pickRing(band, start, ringRadius, slotCount, content) : []
    let shape: RouteShape
    let stops: RouteStop[]
    if (ringStops.length >= minStops) {
      shape = 'circular'
      stops = ringStops
    } else {
      shape = 'lineal'
      stops = pickLinear(candidates, start, target * scale, content)
    }
    const waypoints: ValhallaPoint[] = [
      { latitude: start.latitude, longitude: start.longitude },
      ...stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude })),
      ...(shape === 'circular' ? [{ latitude: start.latitude, longitude: start.longitude }] : []),
    ]
    const routed = await routeChain(waypoints)
    const result: GeneratedRoute = { theme: content, shape, ...routed, stops }
    const deviation = Math.abs(routed.distanceMeters - target) / target
    if (best === undefined || deviation < Math.abs(best.distanceMeters - target) / target) best = result
    if (deviation <= 0.15) return best
    // La medición real manda: corrección multiplicativa sobre el último
    // intento (distancia ∝ radio, aproximadamente, dentro del anillo vivo).
    scale = Math.min(1.6, Math.max(0.5, (scale * target) / Math.max(routed.distanceMeters, 1)))
  }
  if (!best) throw new CatalogError(502, 'No se pudo calcular la ruta con el servicio de rutas')
  return best
}
