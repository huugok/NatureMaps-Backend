import type { Request, Response } from 'express'
import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { species, trees } from '../db/schema.js'
import { fetchValenciaTrees } from '../services/valenciaOpenData.js'
import { toBinomialName } from '../services/speciesEnrichment.js'

export async function importTrees(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 200

  const fetched = await fetchValenciaTrees(limit)
  if (fetched.length === 0) {
    res.json({ fetched: 0, stored: 0 })
    return
  }

  const stored = await db
    .insert(trees)
    .values(fetched)
    .onConflictDoNothing({ target: trees.externalId })
    .returning({ id: trees.id })

  res.json({ fetched: fetched.length, stored: stored.length })
}

export async function listTrees(req: Request, res: Response) {
  const limit = Number(req.query.limit) || 200

  const [rows, [{ count }]] = await Promise.all([
    db.select().from(trees).limit(limit),
    db.select({ count: sql<number>`count(*)::int` }).from(trees),
  ])

  res.json({ total: count, returned: rows.length, limit, trees: rows })
}

export async function getTree(req: Request, res: Response) {
  const id = Number(req.params.id)
  if (!Number.isInteger(id)) {
    res.status(400).json({ error: 'Invalid tree id' })
    return
  }

  const [tree] = await db.select().from(trees).where(eq(trees.id, id)).limit(1)
  if (!tree) {
    res.status(404).json({ error: 'Tree not found' })
    return
  }

  let culturalInfo = null
  if (tree.scientificName) {
    const binomial = toBinomialName(tree.scientificName)
    const [speciesRow] = await db
      .select()
      .from(species)
      .where(eq(species.scientificName, binomial))
      .limit(1)
    culturalInfo = speciesRow ?? null
  }

  res.json({ ...tree, species: culturalInfo })
}
