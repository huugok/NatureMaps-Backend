import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { routeChain } from './routeGenerator.js'
import type { RoutePoint, RouteStop } from '../db/schema.js'

// Lectura del catálogo de rutas predefinidas. El listado es ligero (sin la
// geometría, que puede pesar cientos de KB) y el detalle la trae entera para
// que la ficha pinte el recorrido sin segunda petición.

type RouteRow = {
  id: number
  name: string
  theme: string
  shape: string
  lengthCategory: string
  distanceMeters: number
  durationSeconds: number
  startLatitude: number
  startLongitude: number
  description: string
  stops: RouteStop[]
  path: RoutePoint[] | null
  stopsCount: number
  userId: number
  origin: string
}

// El driver entrega el jsonb ya parseado, así que se usa tal cual.

function routeSummary(row: RouteRow) {
  return {
    id: row.id,
    name: row.name,
    theme: row.theme,
    shape: row.shape,
    lengthCategory: row.lengthCategory,
    distanceMeters: row.distanceMeters,
    durationSeconds: row.durationSeconds,
    start: { latitude: row.startLatitude, longitude: row.startLongitude },
    description: row.description,
    stopsCount: row.stopsCount,
    userId: row.userId,
    origin: row.origin,
  }
}

function routeDetail(row: RouteRow) {
  return {
    ...routeSummary(row),
    stops: row.stops,
    path: row.path ?? [],
  }
}

export async function listRoutes() {
  const result = await db.execute<RouteRow>(sql`
    select id, name, theme, shape, length_category as "lengthCategory",
      distance_meters as "distanceMeters", duration_seconds as "durationSeconds",
      start_latitude as "startLatitude", start_longitude as "startLongitude",
      description, stops, null::jsonb as path,
      jsonb_array_length(stops)::int as "stopsCount",
      user_id as "userId", origen as origin
    from routes order by distance_meters asc
  `)
  return { total: result.rows.length, routes: result.rows.map(routeSummary) }
}

export async function getRoute(id: number) {
  const row = (await db.execute<RouteRow>(sql`
    select id, name, theme, shape, length_category as "lengthCategory",
      distance_meters as "distanceMeters", duration_seconds as "durationSeconds",
      start_latitude as "startLatitude", start_longitude as "startLongitude",
      description, stops, path,
      jsonb_array_length(stops)::int as "stopsCount",
      user_id as "userId", origen as origin
    from routes where id = ${id} limit 1
  `)).rows[0]
  return row ? routeDetail(row) : null
}

/** Tipos aceptados para modificar una ruta propia. La forma no se edita. */
export type RouteUpdate = {
  name: string
  theme: string
  description?: string
  stops: RouteStop[]
}

function categoryFor(meters: number): string {
  if (meters < 4000) return 'corta'
  if (meters < 8000) return 'media'
  return 'larga'
}

/** Guarda los cambios de una ruta: nombre, tema y paradas. El recorrido se
 *  recalcula con Valhalla para que el mapa refleje exactamente lo editable. */
export async function updateRoute(id: number, changes: RouteUpdate) {
  const first = changes.stops[0]
  if (!first || changes.stops.length < 2) throw new Error('La ruta necesita al menos dos paradas')
  const existing = (await db.execute<{ id: number }>(sql`select id from routes where id = ${id} limit 1`)).rows[0]
  if (!existing) return null
  const routed = await routeChain([
    ...changes.stops.map((stop) => ({ latitude: stop.latitude, longitude: stop.longitude })),
    { latitude: first.latitude, longitude: first.longitude },
  ])
  await db.execute(sql`
    update routes set
      name = ${changes.name}, theme = ${changes.theme},
      description = ${changes.description ?? ''},
      stops = ${JSON.stringify(changes.stops)}::jsonb,
      path = ${JSON.stringify(routed.path)}::jsonb,
      distance_meters = ${routed.distanceMeters}, duration_seconds = ${routed.durationSeconds},
      start_latitude = ${first.latitude}, start_longitude = ${first.longitude},
      length_category = ${categoryFor(routed.distanceMeters)}, generated_at = now()
    where id = ${id}
  `)
  return getRoute(id)
}

/** Borrado permanente de una ruta. */
export async function deleteRoute(id: number): Promise<boolean> {
  const result = await db.execute<{ id: number }>(sql`delete from routes where id = ${id} returning id`)
  return result.rows.length > 0
}
