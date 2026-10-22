import { Readable } from 'node:stream'
import type { ReadableStream as WebReadableStream } from 'node:stream/web'
import type { Request, Response } from 'express'
import { ORGANS, PlantNetError, identifyPlant } from '../services/plantnet.js'
import type { Organ, PlantImage } from '../services/plantnet.js'

const MAX_IMAGES = 5
const MAX_IMAGE_BYTES = 10 * 1024 * 1024
const ALLOWED_TYPES = ['image/jpeg', 'image/png']
const DEFAULT_LANG = 'es'
const DEFAULT_RESULTS = 5

function isOrgan(value: string): value is Organ {
  return (ORGANS as readonly string[]).includes(value)
}

// Lee el multipart con la API web de Node (Request.formData), sin depender de multer.
async function readForm(req: Request): Promise<FormData> {
  const headers = new Headers()
  const contentType = req.headers['content-type']
  if (contentType) headers.set('content-type', contentType)

  const webRequest = new Request('http://localhost/', {
    method: 'POST',
    headers,
    body: Readable.toWeb(req) as WebReadableStream<Uint8Array>,
    duplex: 'half',
  })
  return webRequest.formData()
}

function queryString(value: unknown): string | undefined {
  return typeof value === 'string' ? value : undefined
}

export async function identify(req: Request, res: Response): Promise<void> {
  if (!req.is('multipart/form-data')) {
    res.status(415).json({ error: 'Envía la imagen como multipart/form-data (campo "images")' })
    return
  }

  const lang = queryString(req.query.lang) ?? DEFAULT_LANG
  if (!/^[a-z]{2}(-[A-Za-z]{2})?$/.test(lang)) {
    res.status(400).json({ error: 'El parámetro lang no es válido (ejemplo: es, en, ca)' })
    return
  }

  const requested = Number(queryString(req.query['nb-results']) ?? DEFAULT_RESULTS)
  const nbResults = Number.isInteger(requested) ? Math.min(Math.max(requested, 1), 10) : DEFAULT_RESULTS

  let form: FormData
  try {
    form = await readForm(req)
  } catch {
    res.status(400).json({ error: 'No se ha podido leer el formulario enviado' })
    return
  }

  const files = form.getAll('images').filter((value): value is File => value instanceof File)
  if (files.length === 0) {
    res.status(400).json({ error: 'Falta al menos una imagen en el campo "images"' })
    return
  }
  if (files.length > MAX_IMAGES) {
    res.status(400).json({ error: `Máximo ${MAX_IMAGES} imágenes por petición` })
    return
  }

  const organValues = form.getAll('organs').filter((value): value is string => typeof value === 'string')
  if (organValues.length > 0 && organValues.length !== files.length) {
    res.status(400).json({ error: 'Debe haber un valor en "organs" por cada imagen' })
    return
  }

  const images: PlantImage[] = []
  for (const [index, file] of files.entries()) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      res.status(400).json({ error: 'Solo se admiten imágenes JPG o PNG' })
      return
    }
    if (file.size === 0 || file.size > MAX_IMAGE_BYTES) {
      res.status(400).json({ error: 'Cada imagen debe pesar entre 1 byte y 10 MB' })
      return
    }
    const organ = organValues[index] ?? 'auto'
    if (!isOrgan(organ)) {
      res.status(400).json({ error: `organs debe ser uno de: ${ORGANS.join(', ')}` })
      return
    }
    images.push({ data: file, filename: file.name || `imagen-${index + 1}`, organ })
  }

  try {
    const identification = await identifyPlant(images, { lang, nbResults })
    res.json(identification)
  } catch (error) {
    if (error instanceof PlantNetError) {
      res.status(error.status).json({ error: error.message })
      return
    }
    console.error('Error inesperado al identificar la planta')
    res.status(500).json({ error: 'Error interno al identificar la planta' })
  }
}
