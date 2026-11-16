import type { Request, Response } from 'express'
import { language, sendError } from './params.js'
import { groupSlug } from './greenAreasController.js'
import { CatalogError } from '../services/catalogError.js'
import { EDITORIAL_TOPICS, getArticle, listArticles } from '../services/editorialCatalog.js'
import type { EditorialTopic } from '../services/editorialCatalog.js'

// Contenido editorial de flora y zonas verdes (NM-08): secciones temáticas y artículo.

function topic(value: unknown): EditorialTopic | null {
  if (value === undefined) return null
  if (typeof value === 'string' && (EDITORIAL_TOPICS as readonly string[]).includes(value)) return value as EditorialTopic
  throw new CatalogError(400, `topic debe ser uno de: ${EDITORIAL_TOPICS.join(', ')}`)
}

export async function articlesList(req: Request, res: Response) {
  try {
    const group = req.query.group === undefined ? null : groupSlug(req.query.group)
    res.json(await listArticles(language(req.query.lang), topic(req.query.topic), group))
  } catch (error) { sendError(res, error) }
}

export async function articleDetail(req: Request, res: Response) {
  try {
    const article = await getArticle(groupSlug(req.params.slug), language(req.query.lang))
    if (!article) { res.status(404).json({ error: 'Artículo no encontrado' }); return }
    res.json(article)
  } catch (error) { sendError(res, error) }
}
