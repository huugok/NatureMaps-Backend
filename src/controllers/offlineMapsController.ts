import type { Request, Response } from 'express'
import { sendError } from './params.js'
import { getOfflineMap, getOfflineMapBytes } from '../services/offlineMaps.js'

export async function offlineMapMetadata(req: Request, res: Response) {
  try {
    const map = typeof req.params.code === 'string' ? await getOfflineMap(req.params.code) : null
    if (!map) { res.status(404).json({ error: 'Mapa no disponible' }); return }
    res.json(map)
  } catch (error) { sendError(res, error) }
}

export async function offlineMapArchive(req: Request, res: Response) {
  try {
    const code = req.params.code
    const hash = req.params.hash
    if (typeof code !== 'string' || typeof hash !== 'string' || !/^[a-f0-9]{64}$/.test(hash)) {
      res.status(400).json({ error: 'Identificador de mapa inválido' }); return
    }
    const bytes = await getOfflineMapBytes(code, hash)
    if (!bytes) { res.status(404).json({ error: 'Mapa no disponible' }); return }
    res.set({ 'Content-Type': 'application/vnd.pmtiles', 'Accept-Ranges': 'bytes',
      'Cache-Control': 'public, max-age=31536000, immutable', ETag: `"${hash}"`,
      'X-Content-Type-Options': 'nosniff', 'Access-Control-Expose-Headers': 'Content-Length, Content-Range, ETag' })
    if (req.headers.range) {
      const match = /^bytes=(\d+)-(\d*)$/.exec(req.headers.range)
      const start = match ? Number(match[1]) : -1
      const end = match?.[2] ? Math.min(Number(match[2]), bytes.length - 1) : bytes.length - 1
      if (start < 0 || !Number.isSafeInteger(start) || start >= bytes.length || end < start || !Number.isSafeInteger(end)) {
        res.status(416).set('Content-Range', `bytes */${bytes.length}`).end(); return
      }
      res.status(206).set('Content-Range', `bytes ${start}-${end}/${bytes.length}`).send(bytes.subarray(start, end + 1))
    } else res.send(bytes)
  } catch (error) { sendError(res, error) }
}
