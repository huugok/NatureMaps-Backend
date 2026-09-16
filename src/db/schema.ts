import { doublePrecision, pgTable, serial, text, timestamp } from 'drizzle-orm/pg-core'

export const users = pgTable('users', {
  id: serial('id').primaryKey(),
  name: text('name').notNull(),
  email: text('email').notNull().unique(),
  createdAt: timestamp('created_at').defaultNow().notNull(),
})

// Proof-of-concept table for trees imported from Valencia Open Data (Arbolado).
// See docs/Flower MAP — Data Sources.md for the source and the intended provenance fields.
export const trees = pgTable('trees', {
  id: serial('id').primaryKey(),
  externalId: text('external_id').notNull().unique(), // idarbol field from Valencia Open Data
  scientificName: text('scientific_name'),
  commonNameEs: text('common_name_es'),
  commonNameCa: text('common_name_ca'),
  district: text('district'),
  neighborhood: text('neighborhood'),
  latitude: doublePrecision('latitude').notNull(),
  longitude: doublePrecision('longitude').notNull(),
  source: text('source').notNull().default('VALENCIA_OPEN_DATA'),
  importedAt: timestamp('imported_at').defaultNow().notNull(),
})
