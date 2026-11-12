import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
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

// El driver puede entregar jsonb como valor ya parseado o como texto según el
// formato del wire; normalizar aquí mantiene el servicio honesto con ambos.
function jsonColumn<T>(value: unknown): T | null {
  if (value == null) return null
  if (typeof value === 'string') { try { return JSON.parse(value) as T } catch { return null } }
  return value as T
}

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
    stops: jsonColumn<RouteStop[]>(row.stops) ?? [],
    path: jsonColumn<RoutePoint[]>(row.path) ?? [],
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
