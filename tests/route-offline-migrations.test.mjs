import assert from 'node:assert/strict'
import test from 'node:test'
import { mkdtemp, mkdir, readFile, writeFile, rm } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { PGlite } from '@electric-sql/pglite'
import { drizzle } from 'drizzle-orm/pglite'
import { migrate } from 'drizzle-orm/pglite/migrator'

const directory = fileURLToPath(new URL('../drizzle/', import.meta.url))
const journal = JSON.parse(await readFile(join(directory, 'meta/_journal.json'), 'utf8'))
const legacy = journal.entries.find(entry => entry.tag === '0006_offline_maps')
const cleanup = journal.entries.find(entry => entry.tag === '0011_remove_offline_maps')

async function prepareFixture(folder, entries) {
  await mkdir(join(folder, 'meta'), { recursive: true })
  await writeFile(join(folder, 'meta/_journal.json'), JSON.stringify({ ...journal, entries }))
  for (const entry of entries) {
    let sql = await readFile(join(directory, entry.tag + '.sql'), 'utf8')
    // Estos dos scripts de main agrupan varias sentencias sin separadores.
    // PGlite usa consultas preparadas de una sentencia: solo en la copia de
    // prueba se añaden separadores; no se modifica el SQL aplicado del repo.
    if (['0008_sponsored_routes', '0009_sponsors'].includes(entry.tag)) {
      sql = sql.split(';').map(statement => statement.trim()).filter(Boolean).join(';--> statement-breakpoint\n') + ';'
    }
    await writeFile(join(folder, entry.tag + '.sql'), sql)
  }
}

for (const scenario of ['rama-offline-anterior', 'main']) {
  test(`migraciones incrementales desde ${scenario}: conserva datos y aplica las dos ramas`, async () => {
    assert.ok(legacy && cleanup)
    const temporary = await mkdtemp(join(tmpdir(), 'naturemaps-route-migrations-'))
    const pg = new PGlite()
    try {
      const entries = journal.entries.filter(entry => scenario === 'main'
        ? entry.tag !== legacy.tag && entry.tag !== cleanup.tag
        : entry.when <= legacy.when)
      const initial = join(temporary, 'initial')
      const final = join(temporary, 'final')
      await prepareFixture(initial, entries)
      await prepareFixture(final, journal.entries)
      const db = drizzle(pg)
      await migrate(db, { migrationsFolder: initial })
      await pg.exec("insert into users (name, email) values ('Prueba', 'migration@example.test')")
      if (scenario === 'rama-offline-anterior') {
        await pg.exec(`insert into offline_maps (code, sha256, byte_length, bounds, min_zoom, max_zoom, source_url, archive_base64)
          values ('valencia', repeat('a', 64), 127, '[-0.52,39.36,-0.24,39.62]', 0, 15, 'https://example.test/map', 'test')`)
      }
      await migrate(db, { migrationsFolder: final })
      await migrate(db, { migrationsFolder: final })
      assert.equal((await pg.query('select count(*)::int as n from users')).rows[0].n, 1)
      assert.equal((await pg.query("select to_regclass('public.offline_maps') as name")).rows[0].name, null)
      assert.equal((await pg.query("select to_regclass('public.sponsors') as name")).rows[0].name, 'sponsors')
      assert.equal((await pg.query("select to_regclass('public.species_flowering_periods') as name")).rows[0].name, 'species_flowering_periods')
      const migrationCount = (await pg.query('select count(*)::int as n from drizzle.__drizzle_migrations')).rows[0].n
      assert.equal(migrationCount, journal.entries.length - (scenario === 'main' ? 1 : 0))
    } finally {
      await pg.close()
      assert.ok(temporary.startsWith(join(tmpdir(), 'naturemaps-route-migrations-')))
      await rm(temporary, { recursive: true, force: true })
    }
  })
}
