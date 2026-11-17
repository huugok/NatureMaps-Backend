import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { startFixtureDatabase } from './support/pglite.mjs'

// Ficha al identificar una planta: el texto sale de Wikipedia en el momento y NO se guarda en la base.
// Wikipedia simulada; base PostgreSQL aislada.

test('POST /species/lookup devuelve la ficha desde Wikipedia sin escribir en la base', async (t) => {
  const { pg, restore } = await startFixtureDatabase()
  const originalFetch = globalThis.fetch
  const summaries = []
  let wikipediaDown = false
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    assert.ok(url.hostname.endsWith('.wikipedia.org'), `Red inesperada: ${url.hostname}`)
    if (wikipediaDown) return Response.json({}, { status: 503 })
    if (url.pathname.endsWith('/bare')) {
      return Response.json({ license: { title: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } })
    }
    const title = decodeURIComponent(url.pathname.split('/').at(-1))
    summaries.push(`${url.hostname.split('.')[0]}:${title}`)
    if (title !== 'Cupressus_sempervirens') return Response.json({}, { status: 404 })
    return Response.json({ type: 'standard', title: 'Cupressus sempervirens', wikibase_item: 'Q164135',
      description: 'especie de conífera', extract: 'El ciprés común es un árbol de la familia de las cupresáceas.' })
  }
  let server
  try {
    const { app } = await import('../src/app.ts')
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const root = `http://127.0.0.1:${server.address().port}`
    const lookup = async (name, query = '') => {
      const response = await fetch(`${root}/species/lookup${query}`, {
        method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ name }),
      })
      return { status: response.status, body: await response.json() }
    }
    const count = async (table) => (await pg.query(`select count(*)::int as n from ${table}`)).rows[0].n

    const snapshot = async () => ({
      species: await count('species'), enrichments: await count('species_enrichments'), profiles: await count('species_profiles'),
    })

    await t.test('una especie que no está en la base se devuelve con su extracto y licencia, sin guardarla', async () => {
      const before = await snapshot()
      const result = await lookup('Cupressus sempervirens L.')
      assert.equal(result.status, 200)
      assert.equal(result.body.persisted, false)
      assert.equal(result.body.id, null)
      assert.equal(result.body.scientificName, 'Cupressus sempervirens')
      assert.match(result.body.content, /ciprés común/)
      assert.equal(result.body.enrichment.source, 'WIKIPEDIA')
      assert.equal(result.body.enrichment.license, 'CC BY-SA 4.0')
      assert.equal(result.body.locations.total, 0)
      assert.deepEqual(await snapshot(), before)
    })

    await t.test('una especie del inventario sin texto conserva sus ubicaciones y no se modifica', async () => {
      const id = (await pg.query(`insert into species (scientific_name, source) values ('Cupressus sempervirens', 'VALENCIA_ARBOLADO') returning id`)).rows[0].id
      await pg.query(`insert into plant_locations (species_id, latitude, longitude, source, external_id, source_url)
        values ($1, 39.47, -0.37, 'VALENCIA_ARBOLADO', 'c1', 'https://example.invalid/c1')`, [id])
      const before = await snapshot()
      const result = await lookup('Cupressus sempervirens')
      assert.equal(result.status, 200)
      assert.equal(result.body.id, id)
      assert.equal(result.body.persisted, false)
      assert.equal(result.body.locations.total, 1)
      assert.match(result.body.content, /ciprés común/)
      assert.deepEqual(await snapshot(), before)
    })

    await t.test('si la base ya tiene texto de la especie no se llama a Wikipedia', async () => {
      const id = (await pg.query(`select id from species where scientific_name = 'Cupressus sempervirens'`)).rows[0].id
      await pg.query(`insert into species_profiles (species_id, language, description) values ($1, 'es', 'Ficha del equipo')`, [id])
      const calls = summaries.length
      const result = await lookup('Cupressus sempervirens')
      assert.equal(result.status, 200)
      assert.equal(result.body.persisted, true)
      assert.equal(result.body.content, 'Ficha del equipo')
      assert.equal(summaries.length, calls)
    })

    await t.test('si Wikipedia no encuentra la especie responde 404 y no escribe nada', async () => {
      const before = await snapshot()
      assert.equal((await lookup('Absentus fictus')).status, 404)
      assert.deepEqual(await snapshot(), before)
    })

    await t.test('si Wikipedia falla responde 502 y no escribe nada', async () => {
      const before = await snapshot()
      wikipediaDown = true
      try { assert.equal((await lookup('Quercus ilex')).status, 502) } finally { wikipediaDown = false }
      assert.deepEqual(await snapshot(), before)
    })

    await t.test('rechaza nombres no válidos antes de consultar nada', async () => {
      const before = summaries.length
      for (const name of ['', 'ciprés', '123 456', 'x'.repeat(200), 'Cupressus']) {
        assert.equal((await lookup(name)).status, 400, name)
      }
      const noText = await fetch(`${root}/species/lookup`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: '{}' })
      assert.equal(noText.status, 400)
      assert.equal(summaries.length, before)
    })

    await t.test('limita las peticiones por IP', async () => {
      let limited = 0
      for (let index = 0; index < 25; index += 1) {
        if ((await lookup('Cupressus sempervirens')).status === 429) limited += 1
      }
      assert.ok(limited > 0, 'debería haber respuestas 429')
    })
  } finally {
    globalThis.fetch = originalFetch
    server?.close()
    restore()
    await pg.close()
  }
})
