import { CatalogError } from './catalogError.js'
import { isObject } from './valenciaOpenData.js'

// Acceso a Wikimedia (Wikipedia, Wikimedia Commons) compartido por las fichas de
// especie (species_enrichments) y por las de POI (poi_profiles + imagen del POI).
// Todo lo que se guarda en la base lleva su licencia verificada: si no se puede
// comprobar la licencia de una imagen, la imagen no se guarda.

export const USER_AGENT = 'NatureMapsBackend/1.0 (https://github.com/huugok/NatureMaps-Backend)'

export function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

export function plainText(value: unknown): string | null {
  return text(value)?.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim() || null
}

export function httpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value).startsWith('//') ? `https:${String(value)}` : String(value))
    if (url.protocol === 'http:' && url.hostname === 'creativecommons.org') url.protocol = 'https:'
    return url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}

export async function getJson(url: string): Promise<Record<string, unknown> | null> {
  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT }, signal: AbortSignal.timeout(20_000) })
  if (response.status === 404) return null
  if (!response.ok) throw new CatalogError(502, 'Wikipedia no está disponible')
  const data: unknown = await response.json()
  if (!isObject(data) || data.error) throw new CatalogError(502, 'Respuesta inesperada de Wikipedia')
  return data
}

export type EnrichmentImage = {
  url: string; sourceUrl: string; author: string | null; license: string | null
  licenseUrl: string | null; attribution: string | null; licenseVerified: boolean
}

function safeUrl(value: string): URL | null {
  try { return new URL(value) } catch { return null }
}

/**
 * Créditos a partir del `imageinfo` de la API de MediaWiki. Solo cuenta como
 * verificada si la licencia es reutilizable (Creative Commons / dominio público),
 * hay autor y hay atribución: el resto se descarta antes de guardar.
 */
export function parseImageCredits(info: unknown, fallbackUrl: string, articleUrl: string): EnrichmentImage | null {
  if (!isObject(info) || !isObject(info.extmetadata)) return null
  const meta = info.extmetadata
  const value = (key: string) => isObject(meta[key]) ? plainText(meta[key].value) : null
  const result: EnrichmentImage = {
    url: httpsUrl(info.thumburl) ?? httpsUrl(info.url) ?? fallbackUrl,
    sourceUrl: httpsUrl(info.descriptionurl) ?? articleUrl,
    author: value('Artist') ?? value('Credit'),
    license: value('LicenseShortName'),
    licenseUrl: httpsUrl(value('LicenseUrl')),
    attribution: null,
    licenseVerified: false,
  }
  if (!result.licenseUrl && value('Copyrighted')?.toLowerCase() === 'false'
    && result.license?.toLowerCase() === 'public domain') {
    result.licenseUrl = 'https://creativecommons.org/publicdomain/mark/1.0/'
  }
  result.attribution = value('Attribution') ?? ([result.author, result.license].filter(Boolean).join(' — ') || null)
  const rightsUrl = result.licenseUrl ? safeUrl(result.licenseUrl) : null
  // Acepta también las versiones portadas por jurisdicción (`…/3.0/es/`) y las URLs
  // con `deed.en`, que son la misma licencia: la imagen de la Llotja está en
  // `by-nc` y sigue fuera.
  const reusable = rightsUrl?.hostname === 'creativecommons.org'
    && /^\/(?:licenses\/by(?:-sa)?\/[1-4]\.[0-9](?:\/[a-z]{2}(?:-[a-z]{2})?)?|publicdomain\/(?:zero|mark)\/1\.0)(?:\/deed\.[a-z]{2,3})?\/?$/.test(rightsUrl.pathname)
  result.licenseVerified = !!(reusable && result.author && result.license && result.attribution)
  return result
}

/** Créditos de una imagen de Wikipedia/Commons a partir de su URL de fichero. */
export async function fetchImageMetadata(url: string, language: string, articleUrl: string): Promise<EnrichmentImage> {
  const empty: EnrichmentImage = {
    url, sourceUrl: articleUrl, author: null, license: null,
    licenseUrl: null, attribution: null, licenseVerified: false,
  }
  try {
    const imageUrl = new URL(url)
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(imageUrl.hostname)) return empty
    const segments = imageUrl.pathname.split('/')
    const filename = segments.includes('thumb') ? segments.at(-2) : segments.at(-1)
    if (!filename) return empty
    const host = segments.includes('commons') ? 'commons.wikimedia.org' : `${language}.wikipedia.org`
    const api = new URL(`https://${host}/w/api.php`)
    for (const [key, value] of Object.entries({ action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '640', titles: `File:${decodeURIComponent(filename)}` })) api.searchParams.set(key, value)
    const data = await getJson(api.toString())
    if (!data || !isObject(data.query) || !isObject(data.query.pages)) return empty
    for (const page of Object.values(data.query.pages)) {
      if (!isObject(page) || !Array.isArray(page.imageinfo)) continue
      return parseImageCredits(page.imageinfo[0], url, articleUrl) ?? empty
    }
  } catch { /* Se conserva la referencia sin créditos verificados. */ }
  return empty
}

/**
 * Imagen de un fichero de Commons por título (`File:Nombre.jpg`) o por su URL de
 * página de fichero. Es el camino para las fotos de `poi_profiles`, cuyos títulos
 * se eligen a mano en la seed.
 */
export async function commonsImage(file: string, articleUrl: string): Promise<EnrichmentImage | null> {
  const title = file.startsWith('File:') ? file : `File:${file}`
  const api = new URL('https://commons.wikimedia.org/w/api.php')
  for (const [key, value] of Object.entries({ action: 'query', format: 'json', prop: 'imageinfo',
    iiprop: 'url|extmetadata', iiurlwidth: '1024', titles: title })) api.searchParams.set(key, value)
  try {
    const data = await getJson(api.toString())
    if (!data || !isObject(data.query) || !isObject(data.query.pages)) return null
    for (const page of Object.values(data.query.pages)) {
      if (!isObject(page) || !Array.isArray(page.imageinfo)) continue
      return parseImageCredits(page.imageinfo[0], articleUrl, articleUrl)
    }
  } catch { return null }
  return null
}

export interface WikipediaArticle {
  language: string
  title: string
  url: string
  extract: string
  license: string
  licenseUrl: string
  image: EnrichmentImage | null
}

/** Extracto de un artículo de Wikipedia con su licencia y, si la hay, su imagen. */
export async function wikipediaArticle(language: string, pageTitle: string): Promise<WikipediaArticle | null> {
  const slug = encodeURIComponent(pageTitle.replace(/ /g, '_'))
  const summary = await getJson(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${slug}`)
  if (!summary || summary.type === 'disambiguation') return null
  const extract = text(summary.extract)
  if (!extract) return null
  const title = text(summary.title) ?? pageTitle
  const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
  let license = 'CC BY-SA 4.0'
  let licenseUrl = 'https://creativecommons.org/licenses/by-sa/4.0/'
  try {
    const page = await getJson(`https://${language}.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title.replace(/ /g, '_'))}/bare`)
    if (page && isObject(page.license)) {
      license = text(page.license.title) ?? license
      licenseUrl = httpsUrl(page.license.url) ?? licenseUrl
    }
  } catch { /* Se usan los términos por defecto del sitio. */ }
  const thumbnail = isObject(summary.thumbnail) ? httpsUrl(summary.thumbnail.source) : null
  return {
    language, title, url: articleUrl, extract, license, licenseUrl,
    image: thumbnail ? await fetchImageMetadata(thumbnail, language, articleUrl) : null,
  }
}

/** Títulos del mismo artículo en otros idiomas (`ca`, `en`) mediante langlinks. */
export async function wikipediaLanglinks(language: string, pageTitle: string, targets: string[]) {
  const api = new URL(`https://${language}.wikipedia.org/w/api.php`)
  // `lllang` no admite varios idiomas: se piden todos (lllimit=max) y se filtran.
  for (const [key, value] of Object.entries({ action: 'query', format: 'json', prop: 'langlinks',
    lllimit: 'max', titles: pageTitle })) api.searchParams.set(key, value)
  const titles: Record<string, string> = {}
  try {
    const data = await getJson(api.toString())
    if (!data || !isObject(data.query) || !isObject(data.query.pages)) return titles
    for (const page of Object.values(data.query.pages)) {
      if (!isObject(page) || !Array.isArray(page.langlinks)) continue
      for (const link of page.langlinks) {
        if (isObject(link) && typeof link.lang === 'string' && typeof link['*'] === 'string'
          && targets.includes(link.lang)) {
          titles[link.lang] = link['*']
        }
      }
    }
  } catch { /* Sin langlinks se usan solo los idiomas pedidos con título explícito. */ }
  return titles
}
