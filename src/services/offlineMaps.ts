import { createHash } from 'node:crypto'
import { and, eq } from 'drizzle-orm'
import { db } from '../db/index.js'
import { offlineMaps } from '../db/schema.js'
import { CatalogError } from './catalogError.js'

export const MAP_CODE = 'valencia'
export const MAP_ATTRIBUTION = '© OpenStreetMap contributors · Protomaps'
export const MAP_LICENSE_URL = 'https://www.openstreetmap.org/copyright'
export const MAX_MAP_BYTES = 32 * 1024 * 1024
let cachedArchive: { code: string, hash: string, bytes: Buffer, expiresAt: number } | null = null

export function inspectMapArchive(bytes: Buffer) {
  if (bytes.length < 127 || bytes.length > MAX_MAP_BYTES || bytes.subarray(0, 7).toString() !== 'PMTiles'
    || bytes[7] !== 3 || bytes[99] !== 1) throw new CatalogError(400, 'El archivo debe ser PMTiles v3 vectorial de hasta 32 MiB')
  const bounds: [number, number, number, number] = [102, 106, 110, 114].map((offset) => bytes.readInt32LE(offset) / 1e7) as [number, number, number, number]
  const minZoom = bytes[100]!
  const maxZoom = bytes[101]!
  if (bounds[0] < -180 || bounds[2] > 180 || bounds[1] < -90 || bounds[3] > 90
    || bounds[0] >= bounds[2] || bounds[1] >= bounds[3] || maxZoom > 22 || minZoom > maxZoom) {
    throw new CatalogError(400, 'La cobertura del archivo no es válida')
  }
  return { sha256: createHash('sha256').update(bytes).digest('hex'), byteLength: bytes.length, bounds, minZoom, maxZoom }
}

/** Importación explícita e idempotente; no se ejecuta al visitar una ruta. */
export async function storeMapArchive(bytes: Buffer, sourceUrl: string) {
  const parsed = new URL(sourceUrl)
  if (parsed.protocol !== 'https:' || parsed.hostname !== 'build.protomaps.com' || !parsed.pathname.endsWith('.pmtiles')) {
    throw new CatalogError(400, 'La procedencia debe ser un archivo oficial de Protomaps')
  }
  const values = { code: MAP_CODE, ...inspectMapArchive(bytes), sourceUrl, archiveBase64: bytes.toString('base64'), importedAt: new Date() }
  await db.insert(offlineMaps).values(values).onConflictDoUpdate({ target: offlineMaps.code, set: values })
  cachedArchive = null
  return { code: values.code, sha256: values.sha256, bytes: values.byteLength, bounds: values.bounds }
}

export async function getOfflineMap(code = MAP_CODE) {
  const [map] = await db.select({ code: offlineMaps.code, sha256: offlineMaps.sha256, bytes: offlineMaps.byteLength,
    bounds: offlineMaps.bounds, minZoom: offlineMaps.minZoom, maxZoom: offlineMaps.maxZoom, sourceUrl: offlineMaps.sourceUrl })
    .from(offlineMaps).where(eq(offlineMaps.code, code)).limit(1)
  if (!map) return null
  return { ...map, attribution: MAP_ATTRIBUTION, licenseUrl: MAP_LICENSE_URL,
    url: `/offline-maps/${map.code}/${map.sha256}.pmtiles` }
}

export async function getOfflineMapBytes(code: string, sha256: string) {
  if (cachedArchive?.code === code && cachedArchive.hash === sha256 && cachedArchive.expiresAt > Date.now()) return cachedArchive.bytes
  // No se consulta ni publica la cadena base64 al pedir solo los metadatos.
  const [map] = await db.select({ sha256: offlineMaps.sha256, archive: offlineMaps.archiveBase64 })
    .from(offlineMaps).where(and(eq(offlineMaps.code, code), eq(offlineMaps.sha256, sha256))).limit(1)
  if (!map || map.sha256 !== sha256) return null
  const bytes = Buffer.from(map.archive, 'base64')
  if (createHash('sha256').update(bytes).digest('hex') !== sha256) throw new Error('Map integrity error')
  cachedArchive = { code, hash: sha256, bytes, expiresAt: Date.now() + 300_000 }
  return bytes
}

export function mapCovers(bounds: [number, number, number, number], points: Array<{ latitude: number, longitude: number }>) {
  return points.every((point) => point.longitude >= bounds[0] && point.longitude <= bounds[2]
    && point.latitude >= bounds[1] && point.latitude <= bounds[3])
}
