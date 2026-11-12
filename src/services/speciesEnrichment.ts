import { isObject } from './valenciaOpenData.js'
import { toBinomialName } from './taxonomyNames.js'
import { fetchImageMetadata, getJson, httpsUrl, text } from './wikimedia.js'
export { toBinomialName } from './taxonomyNames.js'

export type WikipediaLanguage = 'es' | 'en'

export async function enrichSpecies(scientificName: string, requestedLanguage?: WikipediaLanguage) {
  const lookupName = toBinomialName(scientificName)
  if (!lookupName) return null
  // An explicit language fetches only that edition; legacy callers keep es -> en fallback.
  const languages: WikipediaLanguage[] = requestedLanguage ? [requestedLanguage] : ['es', 'en']
  for (const language of languages) {
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
      image: image ? await fetchImageMetadata(image, language, articleUrl) : null,
    }
  }
  return null
}
