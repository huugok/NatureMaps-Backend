// Fetches free-form cultural/encyclopedic context for a plant species from Wikipedia's REST
// summary API. That endpoint also returns the linked Wikidata id, so a separate Wikidata call
// isn't needed for this proof of concept. Grounded in real encyclopedia text rather than
// generated from scratch, to avoid inventing "cultural" facts about a species.
const WIKIPEDIA_LANGS = ['es', 'en'] as const

const USER_AGENT = 'NatureMapsBackend-POC/1.0 (https://github.com/huugok/NatureMaps-Backend)'

export interface SpeciesEnrichment {
  scientificName: string
  wikidataId: string | null
  wikipediaLang: string
  wikipediaUrl: string | null
  description: string | null
  culturalExtract: string | null
  imageUrl: string | null
}

interface WikipediaSummary {
  type?: string
  wikibase_item?: string
  extract?: string
  description?: string
  thumbnail?: { source: string }
  content_urls?: { desktop?: { page?: string } }
}

// Valencia's tree inventory names include cultivar/sex qualifiers (e.g. "Morus alba 'Fruitless'",
// "Phoenix dactylifera hembra") that don't correspond to their own Wikipedia article. Species-level
// articles use the plain binomial name (genus + species).
export function toBinomialName(scientificName: string): string {
  return scientificName.trim().split(/\s+/).slice(0, 2).join(' ')
}

async function fetchWikipediaSummary(lang: string, title: string): Promise<WikipediaSummary | null> {
  const url = `https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(
    title.replace(/ /g, '_'),
  )}`

  const response = await fetch(url, { headers: { 'User-Agent': USER_AGENT } })
  if (response.status === 404) {
    return null
  }
  if (!response.ok) {
    throw new Error(`Wikipedia request failed (${lang}): ${response.status} ${response.statusText}`)
  }

  const data = (await response.json()) as WikipediaSummary
  if (data.type === 'disambiguation') {
    return null
  }
  return data
}

export async function enrichSpecies(scientificName: string): Promise<SpeciesEnrichment | null> {
  const binomial = toBinomialName(scientificName)

  for (const lang of WIKIPEDIA_LANGS) {
    const summary = await fetchWikipediaSummary(lang, binomial)
    if (!summary) continue

    return {
      scientificName: binomial,
      wikidataId: summary.wikibase_item ?? null,
      wikipediaLang: lang,
      wikipediaUrl: summary.content_urls?.desktop?.page ?? null,
      description: summary.description ?? null,
      culturalExtract: summary.extract ?? null,
      imageUrl: summary.thumbnail?.source ?? null,
    }
  }

  return null
}
