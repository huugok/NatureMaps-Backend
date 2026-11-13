// Seed idempotente del contenido editorial de flora y zonas verdes (NM-08).
//
// El contenido vive en `src/db/editorial/`: `articles.ts` declara qué artículos
// hay (sección, zona verde enlazada, orden y fuentes) y `es.ts`, `va.ts` y
// `en.ts` llevan los textos de cada idioma. Aquí solo se combinan y se cargan.
//
// Los textos son propios del equipo, redactados a partir de las fuentes que
// acompañan a cada artículo (consultadas el 12/11/2026). Solo se afirma lo que
// esas fuentes dicen; cuando dos fuentes dan cifras distintas (la superficie
// del Jardín del Turia, por ejemplo) el texto no da la cifra.
//
// Por qué una seed y no una migración: el contenido cambia a menudo y no debe
// generar migraciones. La estructura vive en `drizzle/0004_*.sql`.
//
// Idempotente: upsert por la clave natural `(slug, language)`. Corregir un
// texto es editarlo en su fichero de idioma y volver a ejecutar
// `npm run db:seed:editorial`; falta un idioma y la lectura cae a `es`.
//
// Un artículo puede enlazarse a una zona verde por su `group_slug`. Si las
// zonas ya están importadas y el grupo no existe, la seed falla: un enlace
// roto debe verse aquí y no en la app.
import { sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { db } from './index.js'
import { ARTICLE_META } from './editorial/articles.js'
import { EN } from './editorial/en.js'
import { ES } from './editorial/es.js'
import { VA } from './editorial/va.js'
import { EDITORIAL_LANGUAGES, sourceFor } from './editorial/sources.js'
import type { EditorialLanguage } from './editorial/sources.js'
import type { ArticleText } from './editorial/text.js'
import type { EditorialSource, EditorialTopic } from '../services/editorialCatalog.js'

interface EditorialEntry {
  slug: string
  language: string
  topic: EditorialTopic
  greenAreaGroup: string | null
  position: number
  title: string
  summary: string
  body: string
  sources: EditorialSource[]
}

const TEXTS: Record<EditorialLanguage, Record<string, ArticleText>> = { es: ES, ca: VA, en: EN }

/**
 * Una entrada por artículo e idioma. Un artículo sin traducir en algún idioma
 * simplemente no genera fila: la lectura cae a `es` y la pantalla lo avisa.
 */
function buildArticles(): EditorialEntry[] {
  const entries: EditorialEntry[] = []
  for (const meta of ARTICLE_META) {
    for (const language of EDITORIAL_LANGUAGES) {
      const text = TEXTS[language][meta.slug]
      if (!text) continue
      entries.push({
        slug: meta.slug,
        language,
        topic: meta.topic,
        greenAreaGroup: meta.greenAreaGroup,
        position: meta.position,
        title: text.title,
        summary: text.summary,
        body: text.body,
        sources: meta.sources.map((source) => sourceFor(source, language)),
      })
    }
  }
  return entries
}

export const EDITORIAL_ARTICLES: EditorialEntry[] = buildArticles()

export interface SeedEditorialResult { total: number, upserted: number, linked: number, languages: string[] }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export async function seedEditorial(entries: EditorialEntry[] = EDITORIAL_ARTICLES): Promise<SeedEditorialResult> {
  const groups = [...new Set(entries.map((entry) => entry.greenAreaGroup).filter((group) => group !== null))]
  const imported = Number((await db.execute<{ total: number }>(sql`select count(*)::int as total from green_areas`)).rows[0]?.total ?? 0)
  if (imported > 0) {
    for (const group of groups) {
      const found = (await db.execute(sql`select 1 from green_areas where group_slug = ${group} limit 1`)).rows.length
      if (!found) throw new Error(`El artículo enlaza la zona verde «${group}», que no existe en green_areas`)
    }
  }
  for (const entry of entries) {
    if (!SLUG.test(entry.slug)) throw new Error(`Slug no válido: ${entry.slug}`)
    if (entry.sources.length === 0) throw new Error(`El artículo «${entry.slug}» no declara fuentes`)
    await db.execute(sql`
      insert into editorial_articles (slug, language, topic, green_area_group, title, summary, body, sources, position)
      values (${entry.slug}, ${entry.language}, ${entry.topic}, ${entry.greenAreaGroup}, ${entry.title},
        ${entry.summary}, ${entry.body}, ${JSON.stringify(entry.sources)}::jsonb, ${entry.position})
      on conflict (slug, language) do update set
        topic = excluded.topic,
        green_area_group = excluded.green_area_group,
        title = excluded.title,
        summary = excluded.summary,
        body = excluded.body,
        sources = excluded.sources,
        position = excluded.position`)
  }
  return {
    total: entries.length,
    upserted: entries.length,
    linked: entries.filter((entry) => entry.greenAreaGroup).length,
    languages: [...new Set(entries.map((entry) => entry.language))].sort(),
  }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedEditorial()
    .then((result) => {
      console.log(`Seed editorial completada: ${result.upserted} artículos insertados/actualizados `
        + `en ${result.languages.join(', ')} (${result.linked} enlazados a una zona verde)`)
      process.exit(0)
    })
    .catch((error: unknown) => { console.error('Seed editorial fallida:', error instanceof Error ? error.message : error); process.exit(1) })
}
