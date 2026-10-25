import { CatalogError } from './catalogError.js'
import { isObject } from './valenciaOpenData.js'
import { toBinomialName } from './taxonomyNames.js'
export { toBinomialName } from './taxonomyNames.js'

const USER_AGENT = 'NatureMapsBackend/1.0 (https://github.com/huugok/NatureMaps-Backend)'

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() ? value.trim() : null
}

function plainText(value: unknown): string | null {
  return text(value)?.replace(/<[^>]*>/g, '').replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&').trim() || null
}

function httpsUrl(value: unknown): string | null {
  try {
    const url = new URL(String(value).startsWith('//') ? `https:${String(value)}` : String(value))
    if (url.protocol === 'http:' && url.hostname === 'creativecommons.org') url.protocol = 'https:'
    return url.protocol === 'https:' ? url.toString() : null
  } catch { return null }
}

async function getJson(url: string): Promise<Record<string, unknown> | null> {
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

async function imageMetadata(url: string, language: string, articleUrl: string): Promise<EnrichmentImage> {
  const result: EnrichmentImage = { url, sourceUrl: articleUrl, author: null, license: null,
    licenseUrl: null, attribution: null, licenseVerified: false }
  try {
    const imageUrl = new URL(url)
    if (!['upload.wikimedia.org', 'thumb.wikimedia.org'].includes(imageUrl.hostname)) return result
    const segments = imageUrl.pathname.split('/')
    const filename = segments.includes('thumb') ? segments.at(-2) : segments.at(-1)
    if (!filename) return result
    const host = segments.includes('commons') ? 'commons.wikimedia.org' : `${language}.wikipedia.org`
    const api = new URL(`https://${host}/w/api.php`)
    for (const [key, value] of Object.entries({ action: 'query', format: 'json', prop: 'imageinfo',
      iiprop: 'url|extmetadata', iiurlwidth: '640', titles: `File:${decodeURIComponent(filename)}` })) api.searchParams.set(key, value)
    const data = await getJson(api.toString())
    if (!data || !isObject(data.query) || !isObject(data.query.pages)) return result
    for (const page of Object.values(data.query.pages)) {
      if (!isObject(page) || !Array.isArray(page.imageinfo)) continue
      const info: unknown = page.imageinfo[0]
      if (!isObject(info) || !isObject(info.extmetadata)) continue
      const meta = info.extmetadata
      const value = (key: string) => isObject(meta[key]) ? plainText(meta[key].value) : null
      result.url = httpsUrl(info.thumburl) ?? httpsUrl(info.url) ?? url
      result.sourceUrl = httpsUrl(info.descriptionurl) ?? articleUrl
      result.author = value('Artist') ?? value('Credit')
      result.license = value('LicenseShortName')
      result.licenseUrl = httpsUrl(value('LicenseUrl'))
      if (!result.licenseUrl && value('Copyrighted')?.toLowerCase() === 'false'
        && result.license?.toLowerCase() === 'public domain') {
        result.licenseUrl = 'https://creativecommons.org/publicdomain/mark/1.0/'
      }
      result.attribution = value('Attribution') ?? ([result.author, result.license].filter(Boolean).join(' — ') || null)
      const rightsUrl = result.licenseUrl ? new URL(result.licenseUrl) : null
      const reusable = rightsUrl?.hostname === 'creativecommons.org'
        && /^\/(?:licenses\/by(?:-sa)?\/[1-4]\.[0-9]|publicdomain\/(?:zero|mark)\/1\.0)\/?$/.test(rightsUrl.pathname)
      result.licenseVerified = !!(reusable && result.author && result.license && result.attribution)
      break
    }
  } catch { /* Keep image reference pending without discarding usable text. */ }
  return result
}

export async function enrichSpecies(scientificName: string) {
  const lookupName = toBinomialName(scientificName)
  if (!lookupName) return null
  for (const language of ['es', 'en']) {
    const summary = await getJson(`https://${language}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(lookupName.replace(/ /g, '_'))}`)
    if (!summary || summary.type === 'disambiguation') continue
    const extract = text(summary.extract)
    const description = text(summary.description)
    if (!extract && !description) continue
    const title = text(summary.title) ?? lookupName
    const articleUrl = `https://${language}.wikipedia.org/wiki/${encodeURIComponent(title.replace(/ /g, '_'))}`
    let page: Record<string, unknown> | null = null
    try { page = await getJson(`https://${language}.wikipedia.org/w/rest.php/v1/page/${encodeURIComponent(title.replace(/ /g, '_'))}/bare`) } catch { /* Use site terms as fallback. */ }
    const rights = page && isObject(page.license) ? page.license : {}
    const image = isObject(summary.thumbnail) ? httpsUrl(summary.thumbnail.source) : null
    return {
      language, title, articleUrl,
      wikidataId: typeof summary.wikibase_item === 'string' && /^Q[0-9]+$/.test(summary.wikibase_item) ? summary.wikibase_item : null,
      description, extract,
      license: text(rights.title) ?? 'CC BY-SA 4.0',
      licenseUrl: httpsUrl(rights.url) ?? 'https://creativecommons.org/licenses/by-sa/4.0/',
      image: image ? await imageMetadata(image, language, articleUrl) : null,
    }
  }
  return null
}
