import type { NextFunction, Request, Response } from 'express'

// Límite sencillo por IP, en memoria, para las rutas que escriben en la base desde una
// petición de usuario. No sustituye a un límite del proxy, pero evita que una sola IP
// dispare consultas a Wikipedia sin freno. Ventana fija: `max` peticiones cada `windowMs`.
export function rateLimit(options: { max: number; windowMs: number }) {
  const hits = new Map<string, { count: number; resetAt: number }>()
  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now()
    if (hits.size > 10_000) for (const [key, hit] of hits) if (hit.resetAt <= now) hits.delete(key)
    const key = req.ip ?? 'desconocida'
    const current = hits.get(key)
    if (!current || current.resetAt <= now) {
      hits.set(key, { count: 1, resetAt: now + options.windowMs })
      next()
      return
    }
    current.count += 1
    if (current.count > options.max) {
      res.setHeader('Retry-After', String(Math.ceil((current.resetAt - now) / 1000)))
      res.status(429).json({ error: 'Demasiadas peticiones, inténtalo de nuevo en un momento' })
      return
    }
    next()
  }
}
