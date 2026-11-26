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
      jsonb_array_length(stops)::int as "stopsCount"
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
      jsonb_array_length(stops)::int as "stopsCount"
    from routes where id = ${id} limit 1
  `)).rows[0]
  return row ? routeDetail(row) : null
}

/** Tramo de acceso desde la ubicación actual hasta el inicio de la ruta.
 *  No modifica el recorrido guardado: solo devuelve la polilínea de entrada. */
export async function routeAccess(id: number, from: { latitude: number, longitude: number }) {
  const route = await getRoute(id)
  if (!route || route.stops.length === 0) return null
  const first = route.stops[0]
  if (!first) return null
  const routed = await routeChain([
    { latitude: from.latitude, longitude: from.longitude },
    { latitude: first.latitude, longitude: first.longitude },
  ])
  return {
    path: routed.path,
    distanceMeters: routed.distanceMeters,
    durationSeconds: routed.durationSeconds,
    start: { latitude: first.latitude, longitude: first.longitude },
  }
}
