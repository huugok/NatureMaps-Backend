export const ORGANS = ['auto', 'leaf', 'flower', 'fruit', 'bark'] as const
export type Organ = (typeof ORGANS)[number]

const DEFAULT_API_URL = 'https://my-api.plantnet.org/v2/identify'
const REQUEST_TIMEOUT_MS = 30_000

export class PlantNetError extends Error {
  readonly status: number

  constructor(status: number, message: string) {
    super(message)
    this.name = 'PlantNetError'
    this.status = status
  }
}

export interface PlantImage {
  data: Blob
  filename: string
  organ: Organ
}

export interface IdentifyOptions {
  lang: string
  nbResults: number
}

export interface PlantMatch {
  score: number
  scientificName: string
  author: string | null
  family: string | null
  genus: string | null
  commonNames: string[]
  gbifId: string | null
}

export interface PlantIdentification {
  bestMatch: string | null
  remainingIdentificationRequests: number | null
  results: PlantMatch[]
}

interface PlantNetTaxon {
  scientificNameWithoutAuthor?: string
}

interface PlantNetResponse {
  bestMatch?: string
  remainingIdentificationRequests?: number
  results?: Array<{
    score: number
    species: {
      scientificNameWithoutAuthor: string
      scientificNameAuthorship?: string
      genus?: PlantNetTaxon
      family?: PlantNetTaxon
      commonNames?: string[]
    }
    gbif?: { id?: string | number }
  }>
}

function toPlantNetError(status: number): PlantNetError {
  if (status === 404) {
    return new PlantNetError(404, 'No se ha podido identificar ninguna especie con esa imagen')
  }
  if (status === 429) {
    return new PlantNetError(429, 'Se ha superado el límite de identificaciones de Pl@ntNet, inténtalo más tarde')
  }
  if (status === 400 || status === 413 || status === 414) {
    return new PlantNetError(400, 'Pl@ntNet ha rechazado la petición (imagen u parámetros no válidos)')
  }
  if (status === 401 || status === 403) {
    return new PlantNetError(502, 'La clave de Pl@ntNet del servidor no es válida o no tiene permiso')
  }
  return new PlantNetError(502, 'Pl@ntNet no ha podido procesar la petición')
}

export async function identifyPlant(
  images: PlantImage[],
  options: IdentifyOptions,
): Promise<PlantIdentification> {
  const apiKey = process.env.PLANTNET_API_KEY
  if (!apiKey) {
    throw new PlantNetError(500, 'PLANTNET_API_KEY no está configurada en el servidor')
  }

  const baseUrl = (process.env.PLANTNET_API_URL ?? DEFAULT_API_URL).replace(/\/+$/, '')
  const project = process.env.PLANTNET_PROJECT ?? 'all'

  const url = new URL(`${baseUrl}/${encodeURIComponent(project)}`)
  url.searchParams.set('api-key', apiKey)
  url.searchParams.set('lang', options.lang)
  url.searchParams.set('nb-results', String(options.nbResults))

  const form = new FormData()
  for (const image of images) {
    form.append('images', image.data, image.filename)
  }
  for (const image of images) {
    form.append('organs', image.organ)
  }

  let response: Response
  try {
    response = await fetch(url, {
      method: 'POST',
      body: form,
      signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
    })
  } catch {
    // No se registra el error original: su mensaje podría incluir la URL con la clave.
    throw new PlantNetError(504, 'No se ha podido contactar con Pl@ntNet')
  }

  if (!response.ok) {
    console.error(`Pl@ntNet respondió con estado ${response.status}`)
    throw toPlantNetError(response.status)
  }

  const raw = (await response.json()) as PlantNetResponse

  return {
    bestMatch: raw.bestMatch ?? null,
    remainingIdentificationRequests: raw.remainingIdentificationRequests ?? null,
    results: (raw.results ?? []).map((item) => ({
      score: item.score,
      scientificName: item.species.scientificNameWithoutAuthor,
      author: item.species.scientificNameAuthorship ?? null,
      family: item.species.family?.scientificNameWithoutAuthor ?? null,
      genus: item.species.genus?.scientificNameWithoutAuthor ?? null,
      commonNames: item.species.commonNames ?? [],
      gbifId: item.gbif?.id !== undefined ? String(item.gbif.id) : null,
    })),
  }
}
