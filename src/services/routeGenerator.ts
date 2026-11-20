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
  /** Forma pedida: «lineal» va recto en una dirección, «circular» cierra el
   * anillo (y, si la zona no da para cerrarlo, cae a lineal). Por defecto,
   * circular. */
  shape?: RouteShape
}

export interface GeneratedRoute {
  theme: RouteTheme
  /** Punto real donde empieza la ruta: la primera parada (el centro del
   * anillo es solo un parámetro de búsqueda, no un punto del mapa). */
  start: RoutePoint
  shape: RouteShape
  distanceMeters: number
  durationSeconds: number
  stops: RouteStop[]
  path: RoutePoint[]
}

// Metros de recorrido por parada: una ruta de 5 km lleva ~20 paradas. Paradas
// densas hacen que los tramos sean cortos y la traza siga las calles del anillo
// en vez de cortar en diagonal.
const METERS_PER_STOP = 350
// Factor de desvío a pie: el camino real por calles es ~30 % más largo que la
// línea recta entre puntos; con él se traduce la longitud objetivo en radios.
const WALKING_DETOUR = 1.3
// Semiancho del corredor de una ruta recta: quanto más estrecho, menos zigzags.
const CORRIDOR_HALF_DEGREES = 30
// Radio máximo de búsqueda: el mismo tope que el contrato de /trees/nearby.
// Radio máximo de búsqueda: el mismo tope que el contrato de /trees/nearby.
const MAX_SEARCH_RADIUS = 10_000

type Candidate = RouteStop & { distance: number }
type Plane = { x: number, y: number }

// Dos puntos del mismo tramo se consideran «el mismo sitio» si están a menos
// de estos metros; y hay ida y vuelta si entre ellos el camino recorre más de
// estos otros metros.
const OUT_AND_BACK_NEAR_METERS = 25
const OUT_AND_BACK_PATH_METERS = 150

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

/** ¿El tramo va y vuelve por el mismo sitio? Se detecta cuando el camino
 * vuelve a pasar por un punto por el que ya había pasado tras recorrer un
 * trecho largo (una calle de ida y vuelta, el caso típico). Devuelve el
 * tamaño del mayor rodeo encontrado (0 si no hay ninguno). */
function outAndBackScore(points: RoutePoint[]): number {
  if (points.length < 3) return 0
  const projected = points.map((point) => project({ latitude: 0, longitude: 0 }, point))
  const walked: number[] = [0]
  for (let index = 1; index < projected.length; index++) {
    const previous = projected[index - 1]
    const current = projected[index]
    if (!previous || !current) continue
    walked.push((walked[index - 1] ?? 0) + Math.hypot(current.x - previous.x, current.y - previous.y))
  }
  let worst = 0
  for (let i = 0; i < projected.length; i++) {
    const from = projected[i]
    if (!from) continue
    for (let j = i + 2; j < projected.length; j++) {
      const to = projected[j]
      if (!to) continue
      const close = Math.hypot(to.x - from.x, to.y - from.y)
      const along = (walked[j] ?? 0) - (walked[i] ?? 0)
      if (close <= OUT_AND_BACK_NEAR_METERS && along >= OUT_AND_BACK_PATH_METERS && along > worst) worst = along
    }
  }
  return worst
}

/** Puntos del círculo por los que debe pasar un tramo entre dos paradas: el
 * punto medio del arco y sus dos vecinos. Forzar el paso por ahí hace que la
 * traza siga el anillo en vez de cortar por dentro. Si una de las paradas es
 * el centro (el punto de partida), el tramo es un radio y se deja como está. */


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
        p.latitude, p.longitude, p.species_id as "speciesId", round(${distance}::numeric)::int as distance
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
        null::int as "speciesId", round(${distance}::numeric)::int as distance
      from pois p
      where ${bbox} and ${distance} <= ${searchRadius}::double precision
      order by ${distance} asc limit 300`) : null,
  ].filter((query): query is NonNullable<typeof query> => query !== null)

  const results = await Promise.all(queries)
  const candidates: Candidate[] = []
  for (const result of results) for (const row of result.rows) {
    if (row.kind === 'planta' || row.kind === 'poi') {
      candidates.push({ kind: row.kind as RouteStopKind, id: row.id, name: row.name,
        latitude: row.latitude, longitude: row.longitude,
        speciesId: (row as { speciesId?: number | null }).speciesId ?? null,
        distance: row.distance })
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

/** Descarta las paradas apartadas en un intento anterior. */
function withoutExcluded(candidates: Candidate[], excluded: Set<number>): Candidate[] {
  if (!excluded.size) return candidates
  return candidates.filter((candidate) => !excluded.has(candidate.id))
}

/** Penalización por dejar el anillo cóncavo: si la parada elegida entre la
 * anterior y el hueco siguiente da un giro al revés (el anillo se «corta por
 * dentro»), se le resta calidad. Así el recorrido rodea los puntos por fuera. */
function concavityPenalty(
  candidate: Candidate,
  previous: { stop: RouteStop, angle: number } | undefined,
  nextIdeal: Plane,
  start: { latitude: number, longitude: number },
  ringRadius: number,
): number {
  if (!previous) return 0
  const from = project(start, { latitude: previous.stop.latitude, longitude: previous.stop.longitude })
  const to = project(start, candidate)
  // El anillo se recorre en sentido antihorario: el giro a la izquierda es el
  // que lo mantiene convexo.
  const cross = (to.x - from.x) * (nextIdeal.y - to.y) - (to.y - from.y) * (nextIdeal.x - to.x)
  if (cross >= 0) return 0
  // El giro al revés se mide como un área (m²); se traduce a metros de
  // penalización y se limita para que solo desempate a candidatos cercanos.
  return Math.min(Math.abs(cross) / 1000, 0.2) * ringRadius
}

/** Elige `slotCount` paradas repartidas alrededor del inicio: para cada ángulo
 * ideal (reparto uniforme) toma la parada sin usar más cercana al punto ideal
 * del anillo. El tipo de cada hueco viene de `slotKind` (la mixta alterna por
 * construcción); si ese tipo no tiene candidata cerca del ideal, el hueco se
 * cubre con lo que haya, para que el anillo no quede con agujeros. */
function pickRing(candidates: Candidate[], start: { latitude: number, longitude: number }, ringRadius: number, slotCount: number, content: RouteTheme, excluded: Set<number>): RouteStop[] {
  const used = new Set<Candidate>()
  const pools: Record<RouteStopKind, Candidate[]> = {
    planta: withoutExcluded(candidates.filter((candidate) => candidate.kind === 'planta'), excluded),
    poi: withoutExcluded(candidates.filter((candidate) => candidate.kind === 'poi'), excluded),
  }
  const toStop = (candidate: Candidate): { stop: RouteStop, angle: number } => ({
    stop: { kind: candidate.kind, id: candidate.id, name: candidate.name,
      latitude: candidate.latitude, longitude: candidate.longitude, speciesId: candidate.speciesId },
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
    // Ángulo del siguiente hueco: sirve para preferir paradas que mantengan el
    // anillo convexo (que la ruta rodee los puntos por fuera y no los corte).
    const nextRadians = (((360 / slotCount) * (slot + 1) - 90) * Math.PI) / 180
    const nextIdeal = { x: ringRadius * Math.cos(nextRadians), y: ringRadius * Math.sin(nextRadians) }
    const previous = placed[placed.length - 1]
    const kind = slotKind(slot, content)
    const chosen = pickNearest(pools[kind], used, (candidate) => {
      const score = scoreOf(candidate, ideal)
      if (score === null) return null
      return score + concavityPenalty(candidate, previous, nextIdeal, start, ringRadius)
    })
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
function pickLinear(candidates: Candidate[], start: { latitude: number, longitude: number }, targetDistance: number, content: RouteTheme, excluded: Set<number>): RouteStop[] {
  const projected = withoutExcluded(candidates, excluded).map((candidate) => ({ candidate, point: project(start, candidate) }))
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
  // Ejes del corredor: «axial» es lo avanzado en la dirección de la ruta y
  // «lateral» el desvío de lado. Con ejes (y no con la distancia al inicio) las
  // paradas avanzan de forma monótona y la ruta va recta en vez de zigzag.
  const radians = (center * Math.PI) / 180
  const axis = { x: Math.cos(radians), y: Math.sin(radians) }
  const along = (point: Plane) => point.x * axis.x + point.y * axis.y
  const sideways = (point: Plane) => Math.abs(-point.x * axis.y + point.y * axis.x)

  const extent = targetDistance / WALKING_DETOUR // largo en línea recta de la ruta
  const slotCount = Math.min(20, Math.max(4, Math.round(targetDistance / METERS_PER_STOP)))
  const used = new Set<Candidate>()
  const byCandidate = new Map<Candidate, { candidate: Candidate, point: Plane }>()
  for (const entry of projected) byCandidate.set(entry.candidate, entry)
  const inCorridor = (entry: { candidate: Candidate, point: Plane }, idealDistance: number) => {
    if (Math.abs(angleDiff(center, angleOf(entry.point))) > CORRIDOR_HALF_DEGREES) return null // fuera del corredor
    const axial = along(entry.point)
    if (axial > extent) return null
    // Puntaje: acercarse al ideal a lo largo del corredor y poco desvío lateral.
    return Math.abs(axial - idealDistance) + sideways(entry.point)
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
    const entry = byCandidate.get(chosen)
    stops.push({ stop: { kind: chosen.kind, id: chosen.id, name: chosen.name,
      latitude: chosen.latitude, longitude: chosen.longitude, speciesId: chosen.speciesId },
      distance: entry ? along(entry.point) : chosen.distance })
  }
  // Orden de ida: de la parada más cercana a la más lejana.
  const ordered = stops.sort((a, b) => a.distance - b.distance).map((entry) => entry.stop)
  // Sin corredor (candidatas muy dispersas): las paradas más lejanas, que son
  // las que más se acercan a la longitud objetivo.
  if (ordered.length < 3) {
    return projected
      .sort((a, b) => b.candidate.distance - a.candidate.distance)
      .slice(0, slotCount)
      .map((entry) => ({
        kind: entry.candidate.kind, id: entry.candidate.id, name: entry.candidate.name,
        latitude: entry.candidate.latitude, longitude: entry.candidate.longitude,
        speciesId: entry.candidate.speciesId,
      }))
  }
  return ordered
}

/** Ruta encadenando tramos consecutivos con Valhalla (a pie): con dos puntos por
 * petición no depende del límite de waypoints del servidor. En serie, con pausa
 * entre tramos y un reintento único por tramo (el servidor demo a veces suelta
 * 429/5xx).
 *
 * Los tramos se piden directos entre paradas: así el camino sigue las calles
 * de verdad y la traza sale redonda si las paradas van pegadas al anillo. Se
 * avisa de qué tramo hace «ida y vuelta» por la misma calle (el índice del
 * peor) para poder apartar esa parada y repetir. */
async function routeChain(waypoints: ValhallaPoint[]): Promise<{ distanceMeters: number, durationSeconds: number, path: RoutePoint[], worstLeg: number }> {
  const round = (value: number) => Math.round(value * 1e6) / 1e6
  const path: RoutePoint[] = []
  const legScores: number[] = []
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
    legScores[index] = outAndBackScore(leg.points)
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
    if (index < waypoints.length - 2) await new Promise((resolve) => setTimeout(resolve, 150))
  }
  if (path.length < 2) throw new CatalogError(502, 'El servicio de rutas no devolvió geometría')
  const worstLeg = legScores.reduce((worst, score, index) => (score > 0 && (worst < 0 || score > legScores[worst]!) ? index : worst), -1)
  return { distanceMeters, durationSeconds, path, worstLeg }
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
  // Paradas apartadas por hacer «ida y vuelta»: se prueban otras en su sitio.
  const excluded = new Set<number>()

  let best: GeneratedRoute | undefined
  // Hasta seis intentos: el anillo se prueba con paradas pegadas al círculo,
  // se aparta la parada que provoca un rodeo y, si la longitud se desvía, se
  // reescala el radio con la medición real de Valhalla. Se queda el intento
  // más cercano.
  const wantedShape = options.shape ?? 'circular'
  let scale = 1
  for (let attempt = 0; attempt < 6; attempt++) {
    const ringRadius = baseRingRadius * scale
    // 1) Intento de anillo: paradas pegadas al radio del anillo (banda
    // estrecha: si las paradas se dispersan, los tramos cortan por dentro y la
    // traza deja de ser un círculo).
    const band = candidates.filter((candidate) => {
      const point = project(start, candidate)
      const radial = Math.hypot(point.x, point.y)
      return radial >= ringRadius * 0.6 && radial <= ringRadius * 1.4
    })
    const ringStops = band.length >= minStops ? pickRing(band, start, ringRadius, slotCount, content, excluded) : []
    let shape: RouteShape
    let stops: RouteStop[]
    if (wantedShape === 'lineal') {
      // Ruta recta: va en una dirección, sin cerrar el anillo.
      shape = 'lineal'
      stops = pickLinear(candidates, start, target * scale, content, excluded)
    } else if (ringStops.length >= minStops) {
      shape = 'circular'
      stops = ringStops
    } else {
      shape = 'lineal'
      stops = pickLinear(candidates, start, target * scale, content, excluded)
    }
    // La ruta empieza en una parada real. El `start` pedido es solo el centro
    // desde el que se buscan paradas: puede no ser un punto del mapa y nunca
    // debe ser el primer waypoint. En el anillo se cierra volviendo a esa
    // primera parada.
    const first = stops[0]
    if (!first) throw new CatalogError(500, 'No hay paradas suficientes para empezar la ruta')
    const routeStart: RoutePoint = { latitude: first.latitude, longitude: first.longitude }
    const waypoints: ValhallaPoint[] = [
      ...stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude })),
      ...(shape === 'circular' ? [routeStart] : []),
    ]
    const routed = await routeChain(waypoints)
    // Un tramo que va y vuelve por la misma calle: se aparta la parada que lo
    // provoca y se repite con otra en su sitio (así no se alarga la ruta).
    if (routed.worstLeg >= 0 && excluded.size < 1) {
      const offending = stops[Math.min(routed.worstLeg, stops.length - 1)]
      if (offending) {
        excluded.add(offending.id)
        attempt--
        continue
      }
    }
    const result: GeneratedRoute = { theme: content, shape, start: routeStart, ...routed, stops }
    const deviation = Math.abs(routed.distanceMeters - target) / target
    if (best === undefined || deviation < Math.abs(best.distanceMeters - target) / target) best = result
    if (deviation <= 0.15) return best
    // La corrección sale de la mejor medición (no de la última): un intento
    // fallido no debe descolocar el radio del siguiente.
    scale = Math.min(1.6, Math.max(0.5, (scale * target) / Math.max(best.distanceMeters, 1)))
  }
  if (!best) throw new CatalogError(502, 'No se pudo calcular la ruta con el servicio de rutas')
  return best
}
