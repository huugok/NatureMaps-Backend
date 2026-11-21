import { CatalogError } from './catalogError.js'

// Cliente del motor de rutas Valhalla (grafo OSM). Las peticiones son efímeras:
// Valhalla no guarda nada, así que el resultado se consume en el momento (el
// generador de rutas predefinidas lo persiste; nadie más necesita llamarlo).
// `VALHALLA_URL` apunta al servidor demo FOSSGIS o a un despliegue Docker propio;
// el código es idéntico en ambos casos.

export type ValhallaPoint = { latitude: number, longitude: number }

export type ValhallaLeg = {
  distanceMeters: number
  durationSeconds: number
  points: ValhallaPoint[]
}

const DEFAULT_TIMEOUT_MS = 30_000
const USER_AGENT = 'NatureMapsBackend/1.0 (Nature MAPS; catalogo de rutas predefinidas)'

function valhallaUrl() {
  const base = process.env.VALHALLA_URL
  if (!base) throw new CatalogError(500, 'VALHALLA_URL no está definida en el entorno')
  return base.replace(/\/+$/, '')
}

/** Decodifica la polilínea codificada que devuelve Valhalla (precision 6). */
export function decodePolyline(encoded: string, precision = 6): ValhallaPoint[] {
  const factor = 10 ** precision
  const points: ValhallaPoint[] = []
  let index = 0
  let lat = 0
  let lon = 0
  while (index < encoded.length) {
    for (const which of [0, 1] as const) {
      let shift = 0
      let result = 0
      let byte: number
      do {
        byte = encoded.charCodeAt(index++) - 63
        result |= (byte & 0x1f) << shift
        shift += 5
      } while (byte >= 0x20)
      const value = (result & 1) === 1 ? ~(result >> 1) : result >> 1
      if (which === 0) lat += value
      else lon += value
    }
    points.push({ latitude: lat / factor, longitude: lon / factor })
  }
  return points
}

type ValhallaRouteResponse = {
  trip?: {
    status?: number
    status_message?: string
    summary?: { length?: number, time?: number }
    legs?: Array<{ shape?: string, summary?: { length?: number, time?: number } }>
  }
}

/** Ruta a pie entre puntos consecutivos (los intermedios van como waypoints).
 * Devuelve la geometría decodificada y las métricas del tramo. */
export async function valhallaRoute(points: ValhallaPoint[]): Promise<ValhallaLeg[]> {
  if (points.length < 2) throw new CatalogError(500, 'Se necesitan al menos dos puntos para calcular una ruta')
  const body = {
    locations: points.map((point) => ({ lat: point.latitude, lon: point.longitude })),
    costing: 'pedestrian',
    directions_options: { units: 'kilometers' },
  }
  let response: Response
  try {
    response = await fetch(`${valhallaUrl()}/route`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'user-agent': USER_AGENT },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(DEFAULT_TIMEOUT_MS),
    })
  } catch (error) {
    if (error instanceof CatalogError) throw error
    throw new CatalogError(502, 'El servicio de rutas no responde')
  }
  if (!response.ok) throw new CatalogError(502, `El servicio de rutas devolvió ${response.status}`)
  let payload: ValhallaRouteResponse
  try {
    payload = await response.json() as ValhallaRouteResponse
  } catch {
    throw new CatalogError(502, 'El servicio de rutas devolvió una respuesta inválida')
  }
  if (payload.trip?.status && payload.trip.status !== 0) {
    throw new CatalogError(502, `El servicio de rutas no pudo calcular el tramo: ${payload.trip.status_message ?? 'sin detalle'}`)
  }
  const legs = payload.trip?.legs ?? []
  if (!legs.length || payload.trip?.summary?.length == null) {
    throw new CatalogError(502, 'El servicio de rutas devolvió una respuesta sin tramos')
  }
  return legs.map((leg) => {
    if (!leg.shape) throw new CatalogError(502, 'El servicio de rutas devolvió un tramo sin geometría')
    return {
      // `length` va en kilometers (units pedidas) y `time` en segundos.
      distanceMeters: Math.round((leg.summary?.length ?? 0) * 1000),
      durationSeconds: Math.round(leg.summary?.time ?? 0),
      points: decodePolyline(leg.shape),
    }
  })
}
