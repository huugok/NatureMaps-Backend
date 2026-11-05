import { VALENCIA_SOURCE } from './valenciaOpenData.js'

export interface SourceReference {
  name: string
  provider: string | null
  url: string
  date: string | null
  dateType: 'imported' | 'retrieved' | 'consulted' | null
  version: string | null
  scope: 'inventory' | 'editorial' | 'image'
  description: string
}

function record(value: unknown): Record<string, unknown> {
  return value !== null && typeof value === 'object' ? value as Record<string, unknown> : {}
}

function text(value: unknown): string | null {
  return typeof value === 'string' && value.trim() !== '' ? value.trim() : null
}

function httpUrl(value: unknown): URL | null {
  try {
    const url = new URL(text(value) ?? '')
    return url.protocol === 'https:' || url.protocol === 'http:' ? url : null
  } catch { return null }
}

// Accept ISO dates only. Calendar validation prevents JS rolling 31 February into March.
function isoDate(value: unknown): string | null {
  const raw = value instanceof Date ? value.toISOString() : text(value)
  if (!raw || !/^\d{4}-\d{2}-\d{2}(?:T| |$)/.test(raw)) return null
  const date = new Date(raw)
  if (!Number.isFinite(date.getTime())) return null
  const day = raw.slice(0, 10)
  if (new Date(day).toISOString().slice(0, 10) !== day) return null
  return raw.length === 10 ? day : date.toISOString()
}

function providerFor(url: URL): string | null {
  if (url.hostname === 'geoportal.valencia.es' || url.hostname === 'opendata.vlci.valencia.es') return VALENCIA_SOURCE.provider
  if (url.hostname.endsWith('.wikipedia.org') || url.hostname === 'wikipedia.org' || url.hostname === 'commons.wikimedia.org') return 'Wikimedia Foundation'
  return null
}

/** Compatibility for the 18 curated references: only extract dates explicitly recorded in the text. */
export function editorialReference(value: unknown): SourceReference | null {
  const source = record(value)
  const url = httpUrl(source.url)
  if (!url) return null
  const description = text(source.description) ?? ''
  const legacyDate = /\bConsulta\s+(\d{2})\/(\d{2})\/(\d{4})\b/i.exec(description)
  const date = isoDate(source.date) ?? (legacyDate ? isoDate(`${legacyDate[3]}-${legacyDate[2]}-${legacyDate[1]}`) : null)
  const declaredType = source.dateType
  const dateType = date === null ? null
    : declaredType === 'imported' || declaredType === 'retrieved' || declaredType === 'consulted' ? declaredType
    : legacyDate ? 'consulted' : null
  return {
    name: text(source.name) ?? url.hostname,
    provider: text(source.provider) ?? providerFor(url),
    url: url.href,
    date,
    dateType,
    version: text(source.version),
    scope: source.scope === 'image' || url.hostname === 'commons.wikimedia.org' ? 'image' : 'editorial',
    description,
  }
}

/** A specimen uses its own source URL; a species uses the dataset URL and last import of its specimens. */
export function inventoryReference(source: string, url: string, importedAt: unknown, aggregate = false): SourceReference {
  const known = source === VALENCIA_SOURCE.code
  const date = isoDate(importedAt)
  return {
    name: known ? VALENCIA_SOURCE.name : source,
    provider: known ? VALENCIA_SOURCE.provider : null,
    url: known && aggregate ? VALENCIA_SOURCE.url : url,
    date,
    dateType: date ? 'imported' : null,
    version: null,
    scope: 'inventory',
    description: known ? VALENCIA_SOURCE.attribution : '',
  }
}

/** Source metadata is derived from stored facts; reading never updates the shared database. */
export function withSpeciesProvenance(row: Record<string, unknown>) {
  const { inventorySources, ...species } = row
  const profile = record(row.profile)
  const references = (Array.isArray(profile.sources) ? profile.sources : [])
    .map(editorialReference).filter((source): source is SourceReference => source !== null)
  if (Array.isArray(inventorySources)) {
    for (const value of inventorySources) {
      const item = record(value)
      if (typeof item.source === 'string' && typeof item.url === 'string') {
        references.push(inventoryReference(item.source, item.url, item.date, true))
      }
    }
  }
  const enrichment = record(row.enrichment)
  const date = isoDate(row.fetchedAt)
  if (!text(profile.description) && typeof enrichment.url === 'string') {
    const reference = editorialReference({ name: 'Wikipedia', url: enrichment.url,
      date, dateType: 'retrieved', description: text(enrichment.license) ?? '' })
    if (reference) references.push(reference)
  }
  const image = record(row.image)
  if (typeof image.sourceUrl === 'string') {
    const reference = editorialReference({ name: 'Wikimedia Commons', url: image.sourceUrl,
      scope: 'image', date, dateType: 'retrieved', description: text(image.attribution) ?? '' })
    if (reference) references.push(reference)
  }
  // The same URL may document a curated consultation and a later retrieval: retain both dates.
  const unique = new Map(references.map((source) => [JSON.stringify([source.url, source.scope, source.dateType, source.date]), source]))
  return { ...species, provenance: [...unique.values()] }
}
