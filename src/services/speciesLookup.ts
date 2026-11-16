import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { CatalogError } from './catalogError.js'
import { getSpeciesDetail } from './speciesCatalog.js'
import { enrichSpecies } from './speciesEnrichment.js'

// Ficha al identificar una planta: si la especie no está en el catálogo, o está sin texto,
// se pide a Wikipedia en el momento y se DEVUELVE sin guardar nada. La base compartida solo
// guarda lo que cura el equipo y el inventario de València: lo que identifica cada usuario
// (Pl@ntNet reconoce plantas de todo el mundo) se queda en su dispositivo.

/** Dos primeras palabras de un nombre científico («Cupressus sempervirens L.» → «Cupressus sempervirens»). */
export function binomialOf(raw: string): string | null {
  return raw.trim().replace(/\s+/g, ' ').match(/^([A-Z][a-z]+ [a-z][a-z-]+)(?:\s|$)/u)?.[1] ?? null
}

function emptyDetail(scientificName: string) {
  return {
    id: null as number | null,
    scientificName,
    names: [] as unknown[],
    content: null as string | null,
    profile: null as unknown,
    enrichment: null as unknown,
    image: null as unknown,
    greenAreas: [] as unknown[],
    locations: { total: 0, returned: 0, nextAfterId: null, items: [] as unknown[] },
  }
}

export async function lookupSpeciesSheet(rawName: string, language: string) {
  const name = binomialOf(rawName)
  if (!name) throw new CatalogError(400, 'Nombre científico no válido')

  const found = await db.execute<{ id: number; hasText: boolean }>(sql`
    select s.id,
      (exists (select 1 from species_profiles p where p.species_id = s.id)
        or exists (select 1 from species_enrichments e where e.species_id = s.id and e.source = 'WIKIPEDIA')) as "hasText"
    from species s where s.scientific_name = ${name}
    order by (s.source = 'VALENCIA_ARBOLADO') desc, s.id limit 1`)
  const existing = found.rows[0]

  // Ya tiene ficha en la base: se devuelve tal cual, sin llamar a Wikipedia.
  if (existing?.hasText) {
    const detail = await getSpeciesDetail(existing.id, language, 20, 0)
    if (detail) return { ...detail, persisted: true }
  }

  const data = await enrichSpecies(name)
  if (!data) throw new CatalogError(404, 'No se ha encontrado esta especie en Wikipedia')
  const base = existing ? await getSpeciesDetail(existing.id, language, 20, 0) : null
  const content = data.extract ?? data.description
  const image = data.image?.licenseVerified ? data.image : null
  return {
    ...(base ?? emptyDetail(name)),
    content,
    enrichment: {
      language: data.language, content, source: 'WIKIPEDIA', url: data.articleUrl,
      license: data.license, licenseUrl: data.licenseUrl,
    },
    image: image
      ? { url: image.url, sourceUrl: image.sourceUrl, author: image.author, license: image.license,
        licenseUrl: image.licenseUrl, attribution: image.attribution }
      : ((base as Record<string, unknown> | null)?.image ?? null),
    persisted: false,
  }
}
