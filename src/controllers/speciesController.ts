import type { Request, Response } from 'express'
import { db } from '../db/index.js'
import { species, trees } from '../db/schema.js'
import { enrichSpecies, toBinomialName } from '../services/speciesEnrichment.js'

export async function enrichSpeciesFromTrees(_req: Request, res: Response) {
  const treeRows = await db.selectDistinct({ scientificName: trees.scientificName }).from(trees)
  const binomials = [
    ...new Set(
      treeRows
        .map((row) => row.scientificName)
        .filter((name): name is string => Boolean(name))
        .map(toBinomialName),
    ),
  ]

  const existing = await db.select({ scientificName: species.scientificName }).from(species)
  const existingNames = new Set(existing.map((row) => row.scientificName))
  const pending = binomials.filter((name) => !existingNames.has(name))

  let enriched = 0
  let notFound = 0
  const failed: string[] = []

  for (const name of pending) {
    try {
      const result = await enrichSpecies(name)
      if (!result) {
        notFound++
        continue
      }
      await db.insert(species).values(result).onConflictDoNothing({ target: species.scientificName })
      enriched++
    } catch {
      failed.push(name)
    }
  }

  res.json({
    totalSpecies: binomials.length,
    alreadyStored: binomials.length - pending.length,
    enriched,
    notFound,
    failed,
  })
}

export async function listSpecies(_req: Request, res: Response) {
  const rows = await db.select().from(species)
  res.json({ total: rows.length, species: rows })
}
