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

// Cultural/encyclopedic enrichment per species (not per tree), fetched from Wikidata + Wikipedia.
// Keyed by the normalized binomial name (genus + species), since trees.scientific_name may include
// cultivar/sex qualifiers that don't map to a Wikipedia article on their own.
export const species = pgTable('species', {
  id: serial('id').primaryKey(),
  scientificName: text('scientific_name').notNull().unique(),
  wikidataId: text('wikidata_id'),
  wikipediaLang: text('wikipedia_lang'),
  wikipediaUrl: text('wikipedia_url'),
  description: text('description'),
  culturalExtract: text('cultural_extract'),
  imageUrl: text('image_url'),
  source: text('source').notNull().default('WIKIPEDIA'),
  fetchedAt: timestamp('fetched_at').defaultNow().notNull(),
})
