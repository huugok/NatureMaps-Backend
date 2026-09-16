import type { Request, Response } from 'express'
import { sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { trees } from '../db/schema.js'
import { fetchValenciaTrees } from '../services/valenciaOpenData.js'

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
