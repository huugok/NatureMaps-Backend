import { sql } from 'drizzle-orm'
import type { SQL } from 'drizzle-orm'
import { db } from '../db/index.js'

// Contenido editorial de flora y zonas verdes (NM-08). Cada artículo existe una
// vez por idioma; la lectura elige el idioma pedido y, si falta, es → ca → en,
// y devuelve en `language` el idioma real para que la pantalla pueda avisarlo.

export const EDITORIAL_TOPICS = ['flora', 'parques', 'jardines', 'paisajismo'] as const
export type EditorialTopic = typeof EDITORIAL_TOPICS[number]

export interface EditorialSource { name: string, description: string, url: string }

export type ArticleSummary = {
  slug: string
  topic: EditorialTopic
  greenAreaGroup: string | null
  title: string
  summary: string
  language: string
  position: number
}

export type Article = ArticleSummary & {
  body: string
  sources: EditorialSource[]
}

function languageOrder(language: string) {
  const languages = [...new Set([language, language.split('-')[0] ?? language, 'es', 'ca', 'en'])]
  return sql`array[${sql.join(languages.map((lang) => sql`${lang}::text`), sql`, `)}]`
}

const SUMMARY_FIELDS = sql`a.slug, a.topic, a.green_area_group as "greenAreaGroup", a.title, a.summary,
  a.language, a.position`

/** Un artículo por slug, en el mejor idioma disponible, ordenados por sección. */
async function selectSummaries(language: string, condition: SQL) {
  const order = languageOrder(language)
  const result = await db.execute<ArticleSummary>(sql`
    select * from (
      select distinct on (a.slug) ${SUMMARY_FIELDS}
      from editorial_articles a
      where a.language = any(${order}) and ${condition}
      order by a.slug, array_position(${order}, a.language)
    ) articles
    order by position, title
  `)
  return result.rows.map((row) => ({ ...row, position: Number(row.position) }))
}

export async function listArticles(language: string, topic: EditorialTopic | null, group: string | null) {
  const conditions: SQL[] = [sql`true`]
  if (topic) conditions.push(sql`a.topic = ${topic}`)
  if (group) conditions.push(sql`a.green_area_group = ${group}`)
  const articles = await selectSummaries(language, sql.join(conditions, sql` and `))
  return { language, topic, group, returned: articles.length, articles }
}

export function articlesForGroups(language: string, groups: string[]) {
  if (groups.length === 0) return Promise.resolve([] as ArticleSummary[])
  const list = sql`array[${sql.join(groups.map((group) => sql`${group}::text`), sql`, `)}]`
  return selectSummaries(language, sql`a.green_area_group = any(${list})`)
}

export async function getArticle(slug: string, language: string): Promise<Article | null> {
  const order = languageOrder(language)
  const result = await db.execute<ArticleSummary & { body: string, sources: unknown }>(sql`
    select ${SUMMARY_FIELDS}, a.body, a.sources
    from editorial_articles a
    where a.slug = ${slug} and a.language = any(${order})
    order by array_position(${order}, a.language) limit 1
  `)
  const row = result.rows[0]
  if (!row) return null
  const sources = typeof row.sources === 'string' ? JSON.parse(row.sources) : row.sources
  return { ...row, position: Number(row.position), sources: Array.isArray(sources) ? sources : [] }
}
