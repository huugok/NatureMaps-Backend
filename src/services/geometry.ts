// Geometría plana mínima para las zonas verdes (NM-08): caja envolvente,
// centro y punto-en-polígono sobre GeoJSON en WGS84. No hay PostGIS (los tests
// corren en PGlite), así que el cruce espacial se resuelve aquí. A escala de
// ciudad tratar lon/lat como plano es suficiente: el error es de centímetros.

export type Position = [number, number]
export type Ring = Position[]
export type PolygonGeometry = { type: 'Polygon', coordinates: Ring[] }
export type MultiPolygonGeometry = { type: 'MultiPolygon', coordinates: Ring[][] }
export type AreaGeometry = PolygonGeometry | MultiPolygonGeometry

export interface BoundingBox {
  minLatitude: number
  maxLatitude: number
  minLongitude: number
  maxLongitude: number
}

function isPosition(value: unknown): value is Position {
  return Array.isArray(value) && value.length >= 2
    && typeof value[0] === 'number' && typeof value[1] === 'number'
    && Number.isFinite(value[0]) && Number.isFinite(value[1])
    && value[0] >= -180 && value[0] <= 180 && value[1] >= -90 && value[1] <= 90
}

function isRing(value: unknown): value is Ring {
  return Array.isArray(value) && value.length >= 4 && value.every(isPosition)
}

function isPolygon(value: unknown): value is Ring[] {
  return Array.isArray(value) && value.length >= 1 && value.every(isRing)
}

/** Valida y devuelve la geometría, o null si no es un (Multi)Polygon utilizable. */
export function parseAreaGeometry(value: unknown): AreaGeometry | null {
  if (value === null || typeof value !== 'object') return null
  const geometry = value as { type?: unknown, coordinates?: unknown }
  if (geometry.type === 'Polygon' && isPolygon(geometry.coordinates)) {
    return { type: 'Polygon', coordinates: geometry.coordinates }
  }
  if (geometry.type === 'MultiPolygon' && Array.isArray(geometry.coordinates)
    && geometry.coordinates.length >= 1 && geometry.coordinates.every(isPolygon)) {
    return { type: 'MultiPolygon', coordinates: geometry.coordinates as Ring[][] }
  }
  return null
}

/** Polígonos de la geometría, cada uno como [anillo exterior, ...huecos]. */
export function polygonsOf(geometry: AreaGeometry): Ring[][] {
  return geometry.type === 'Polygon' ? [geometry.coordinates] : geometry.coordinates
}

/** Une varias geometrías en una sola (los tramos repetidos de un mismo id). */
export function mergeGeometries(geometries: AreaGeometry[]): AreaGeometry {
  const polygons = geometries.flatMap(polygonsOf)
  return polygons.length === 1
    ? { type: 'Polygon', coordinates: polygons[0]! }
    : { type: 'MultiPolygon', coordinates: polygons }
}

export function boundingBox(geometry: AreaGeometry): BoundingBox {
  const box = { minLatitude: 90, maxLatitude: -90, minLongitude: 180, maxLongitude: -180 }
  for (const polygon of polygonsOf(geometry)) {
    for (const [longitude, latitude] of polygon[0]!) {
      if (latitude < box.minLatitude) box.minLatitude = latitude
      if (latitude > box.maxLatitude) box.maxLatitude = latitude
      if (longitude < box.minLongitude) box.minLongitude = longitude
      if (longitude > box.maxLongitude) box.maxLongitude = longitude
    }
  }
  return box
}

function signedRingArea(ring: Ring): number {
  let sum = 0
  for (let index = 0; index < ring.length - 1; index++) {
    const [x1, y1] = ring[index]!
    const [x2, y2] = ring[index + 1]!
    sum += x1 * y2 - x2 * y1
  }
  return sum / 2
}

function pointInRing(longitude: number, latitude: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if ((yi > latitude) !== (yj > latitude)
      && longitude < ((xj - xi) * (latitude - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** true si el punto cae dentro de algún polígono y fuera de sus huecos. */
export function pointInGeometry(longitude: number, latitude: number, geometry: AreaGeometry): boolean {
  for (const polygon of polygonsOf(geometry)) {
    if (!pointInRing(longitude, latitude, polygon[0]!)) continue
    if (!polygon.slice(1).some((hole) => pointInRing(longitude, latitude, hole))) return true
  }
  return false
}

/**
 * Punto representativo para el marcador de la zona: el centroide del polígono
 * mayor si cae dentro de la geometría; si no (formas en L o en arco, como los
 * tramos del Turia), el vértice del contorno más cercano a ese centroide.
 */
export function representativePoint(geometry: AreaGeometry): { latitude: number, longitude: number } {
  let largest = polygonsOf(geometry)[0]![0]!
  let largestArea = Math.abs(signedRingArea(largest))
  for (const polygon of polygonsOf(geometry)) {
    const area = Math.abs(signedRingArea(polygon[0]!))
    if (area > largestArea) { largest = polygon[0]!; largestArea = area }
  }
  const signed = signedRingArea(largest)
  let longitude = 0
  let latitude = 0
  if (signed === 0) {
    for (const [x, y] of largest) { longitude += x; latitude += y }
    longitude /= largest.length
    latitude /= largest.length
  } else {
    for (let index = 0; index < largest.length - 1; index++) {
      const [x1, y1] = largest[index]!
      const [x2, y2] = largest[index + 1]!
      const cross = x1 * y2 - x2 * y1
      longitude += (x1 + x2) * cross
      latitude += (y1 + y2) * cross
    }
    longitude /= 6 * signed
    latitude /= 6 * signed
  }
  if (pointInGeometry(longitude, latitude, geometry)) return { latitude, longitude }
  let best = largest[0]!
  let bestDistance = Infinity
  for (const vertex of largest) {
    const distance = (vertex[0] - longitude) ** 2 + (vertex[1] - latitude) ** 2
    if (distance < bestDistance) { best = vertex; bestDistance = distance }
  }
  return { latitude: best[1], longitude: best[0] }
}

const METERS_PER_DEGREE = 111_320

/** Distancia en metros del punto al contorno más cercano (0 si está dentro). */
export function distanceToGeometry(longitude: number, latitude: number, geometry: AreaGeometry): number {
  if (pointInGeometry(longitude, latitude, geometry)) return 0
  const scaleX = METERS_PER_DEGREE * Math.max(Math.cos((latitude * Math.PI) / 180), 0.01)
  const scaleY = METERS_PER_DEGREE
  let best = Infinity
  for (const polygon of polygonsOf(geometry)) {
    const ring = polygon[0]!
    for (let index = 0; index < ring.length - 1; index++) {
      const ax = (ring[index]![0] - longitude) * scaleX
      const ay = (ring[index]![1] - latitude) * scaleY
      const bx = (ring[index + 1]![0] - longitude) * scaleX
      const by = (ring[index + 1]![1] - latitude) * scaleY
      const dx = bx - ax
      const dy = by - ay
      const length = dx * dx + dy * dy
      const t = length === 0 ? 0 : Math.min(1, Math.max(0, -(ax * dx + ay * dy) / length))
      const distance = Math.hypot(ax + t * dx, ay + t * dy)
      if (distance < best) best = distance
    }
  }
  return best
}
