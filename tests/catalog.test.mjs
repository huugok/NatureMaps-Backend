import assert from 'node:assert/strict'
import { once } from 'node:events'
import { readFile } from 'node:fs/promises'
import test from 'node:test'
import { neonConfig } from '@neondatabase/serverless'
import { PGlite } from '@electric-sql/pglite'

function feature(id, scientificName = 'Citrus aurantium', commonName = 'Naranjo amargo') {
  return {
    type: 'Feature',
    geometry: { type: 'Point', coordinates: [-0.3778, 39.4779] },
    properties: { idarbol: id, nom_botanico: scientificName, nom_comu_c: commonName,
      nom_comu_v: 'Taronger bord', distrito: '1 - CIUTAT VELLA', barrio: '13 - EL CARME' },
  }
}

// Emulate Neon's HTTP wire format while executing the actual SQL in PostgreSQL/WASM.
function wireResult(result, query) {
  const fields = result.fields.map((field) => ({ ...field, format: 'text' }))
  return {
    fields,
    rows: result.rows.map((row) => fields.map(({ name, dataTypeID }) => {
      const value = row[name]
      if (value === null || value === undefined) return null
      if (dataTypeID === 114 || dataTypeID === 3802) return JSON.stringify(value)
      if (typeof value === 'boolean') return value ? 't' : 'f'
      if (value instanceof Date) return value.toISOString()
      return String(value)
    })),
    rowCount: result.affectedRows ?? result.rows.length,
    command: query.trim().split(/\s+/)[0].toUpperCase(),
    rowAsArray: true,
  }
}

test('catalog import and HTTP API with isolated PostgreSQL', async (t) => {
  const pg = new PGlite()
  const journal = JSON.parse(await readFile(new URL('../drizzle/meta/_journal.json', import.meta.url), 'utf8'))
  for (const entry of journal.entries) await pg.exec(await readFile(new URL(`../drizzle/${entry.tag}.sql`, import.meta.url), 'utf8'))
  const originalFetch = globalThis.fetch
  const originalNeonFetch = neonConfig.fetchFunction
  const originalDatabaseUrl = process.env.DATABASE_URL
  process.env.DATABASE_URL = 'postgresql://test:test@ep-test.eu-central-1.aws.neon.tech/test'
  let fixtures = [feature('10050/1'), feature('10050/2'), feature('cultivar', 'Morus sp.', 'Morera')]
  fixtures.push({ ...feature('bad-coordinates'), geometry: { type: 'Point', coordinates: [0, 91] } })
  let upstreamFailure = false
  let upstreamCalls = 0
  let databaseCalls = 0
  let wikipediaCalls = 0
  let failMorus = true
  neonConfig.fetchFunction = async (_url, init) => {
    databaseCalls++
    const body = JSON.parse(init.body)
    async function execute(client, query) {
      return wireResult(await client.query(query.query, query.params), query.query)
    }
    try {
      if (body.queries) {
        const results = await pg.transaction(async (tx) => {
          const rows = []
          for (const query of body.queries) rows.push(await execute(tx, query))
          return rows
        })
        return Response.json({ results })
      }
      return Response.json(await execute(pg, body))
    } catch (error) {
      return Response.json({ message: 'Fixture database error', code: error.code }, { status: 400 })
    }
  }
  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    if (url.hostname.endsWith('.wikipedia.org') || url.hostname === 'commons.wikimedia.org') {
      wikipediaCalls++
      assert.match(init.headers['User-Agent'], /NatureMapsBackend/)
      if (url.pathname === '/w/api.php') {
        if (url.searchParams.get('titles') !== 'File:Citrus.jpg') return Response.json({ query: { pages: { '-1': { missing: true } } } })
        return Response.json({ query: { pages: { '7': { imageinfo: [{
          url: 'https://upload.wikimedia.org/wikipedia/commons/a/ab/Citrus.jpg',
          thumburl: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/Citrus.jpg/640px-Citrus.jpg',
          descriptionurl: 'https://commons.wikimedia.org/wiki/File:Citrus.jpg',
          extmetadata: { Artist: { value: '<a href="https://example.invalid">Botanical photographer</a>' },
            LicenseShortName: { value: 'CC BY-SA 4.0' }, LicenseUrl: { value: 'http://creativecommons.org/licenses/by-sa/4.0/' } },
        }] } } } })
      }
      if (url.pathname.endsWith('/bare')) return Response.json({ license: { title: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } })
      const title = decodeURIComponent(url.pathname.split('/').at(-1))
      if (title === 'Morus_alba' && failMorus) return Response.json({}, { status: 503 })
      if (title === 'Absentus_fictus') return url.hostname === 'es.wikipedia.org'
        ? Response.json({ type: 'disambiguation' }) : Response.json({}, { status: 404 })
      if (title === 'Phoenix_dactylifera' && url.hostname === 'es.wikipedia.org') return Response.json({}, { status: 404 })
      const ids = { Citrus_aurantium: 41, Morus_alba: 42, Phoenix_dactylifera: 43 }
      const filename = title === 'Citrus_aurantium' ? 'Citrus.jpg' : 'Phoenix.jpg'
      return Response.json({ type: 'standard', title: title.replaceAll('_', ' '), pageid: ids[title],
        wikibase_item: `Q${ids[title]}`, description: `Summary ${title}`, extract: `Extract ${title}`,
        thumbnail: title === 'Morus_alba' ? undefined : { source: `https://thumb.wikimedia.org/wikipedia/commons/thumb/a/ab/${filename}/320px-${filename}` } })
    }
    assert.equal(url.hostname, 'geoportal.valencia.es', 'Unexpected external network call')
    upstreamCalls++
    assert.equal(url.searchParams.get('outSR'), '4326')
    assert.equal(url.searchParams.get('orderByFields'), 'objectid ASC')
    if (upstreamFailure) return Response.json({ error: { message: 'Upstream unavailable' } })
    const offset = Number(url.searchParams.get('resultOffset'))
    const limit = Number(url.searchParams.get('resultRecordCount'))
    const features = fixtures.slice(offset, offset + limit)
    return Response.json({ type: 'FeatureCollection', features, exceededTransferLimit: offset + features.length < fixtures.length })
  }
  let server
  try {
    const { app } = await import('../src/app.ts')
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const root = `http://127.0.0.1:${server.address().port}`
    async function request(path, method = 'GET') {
      const response = await fetch(root + path, { method })
      return { status: response.status, body: await response.json() }
    }
    const count = async (table) => (await pg.query(`select count(*)::int as count from ${table}`)).rows[0].count

    await t.test('health and existing PlantNet routes remain available', async () => {
      assert.deepEqual(await request('/health'), { status: 200, body: { status: 'ok' } })
      assert.equal((await request('/plants/identify', 'POST')).status, 415)
      assert.equal((await fetch(root + '/probar')).status, 200)
    })

    await t.test('reject invalid parameters before contacting database or upstream', async () => {
      const before = { databaseCalls, upstreamCalls }
      for (const path of ['/trees/import?limit=0', '/trees/import?limit=201', '/trees/import?offset=-1', '/species/enrich?limit=201']) {
        assert.equal((await request(path, 'POST')).status, 400)
      }
      for (const path of ['/trees?lang=!!!', '/trees?limit=-1', '/trees/abc', '/trees/0', '/species?lang=!!!']) {
        assert.equal((await request(path)).status, 400)
      }
      assert.deepEqual({ databaseCalls, upstreamCalls }, before)
    })

    await t.test('import shares species, keeps unknown names and rejects bad coordinates', async () => {
      const response = await request('/trees/import?limit=20', 'POST')
      assert.equal(response.status, 200)
      assert.equal(response.body.fetched, 4)
      assert.equal(response.body.stored, 3)
      assert.equal(response.body.failed, 1)
      assert.equal(response.body.status, 'failed')
      assert.equal(response.body.runId, undefined)
      assert.equal(await count('plant_locations'), 3)
      assert.equal(await count('species'), 1)
      assert.equal(await count('plant_names'), 6)
      const unknown = (await pg.query("select * from plant_locations where external_id = 'cultivar'")).rows[0]
      assert.equal(unknown.species_id, null)
      assert.equal(unknown.reported_scientific_name, 'Morus sp.')
      assert.equal(unknown.source, 'VALENCIA_ARBOLADO')
      assert.match(unknown.source_url, /geoportal\.valencia\.es/)
    })

    await t.test('repeat and concurrent imports do not duplicate plants or names', async () => {
      const repeated = await request('/trees/import', 'POST')
      assert.equal(repeated.body.stored, 0)
      assert.equal(repeated.body.skipped, 3)
      const original = fixtures
      fixtures = [feature('concurrent')]
      const results = await Promise.all([request('/trees/import', 'POST'), request('/trees/import', 'POST')])
      assert.equal(results.reduce((sum, result) => sum + result.body.stored, 0), 1)
      assert.equal(await count('species'), 1)
      assert.equal(await count('plant_locations'), 4)
      fixtures = original
    })

    await t.test('list is compact, paginated and localized; detail keeps provenance', async () => {
      const result = await request('/trees?limit=1&lang=ca-ES')
      assert.equal(result.body.total, 4)
      assert.equal(result.body.nextOffset, 1)
      const tree = result.body.trees[0]
      assert.equal(tree.commonName, 'Taronger bord')
      assert.equal(tree.commonNameLanguage, 'ca')
      assert.equal(tree.descriptions, undefined)
      assert.equal(tree.sources, undefined)
      assert.equal(tree.sourceUrl, undefined)
      assert.equal(tree.source, 'VALENCIA_ARBOLADO')
      const detail = (await request(`/trees/${tree.id}`)).body
      assert.equal(detail.commonName, 'Naranjo amargo')
      assert.match(detail.sourceUrl, /geoportal\.valencia\.es/)
      assert.equal(detail.names.length, 2)
      assert.equal(detail.species.wikipediaUrl, null)
      assert.equal((await request('/trees/2147483647')).status, 404)
      assert.equal((await request('/trees?offset=999')).body.nextOffset, null)
    })

    await t.test('database constraints reject invalid coordinates and orphaned names', async () => {
      await assert.rejects(pg.query("update plant_locations set latitude = 91 where external_id = '10050/1'"))
      await assert.rejects(pg.query("insert into plant_names (plant_location_id, language, name) values (999999, 'es', 'Orphan')"))
      await assert.rejects(pg.query("insert into plant_names (plant_location_id, language, name) select id, 'es', 'Duplicate' from plant_locations limit 1"))
    })

    await t.test('name insertion failure rolls back the entire import', async () => {
      const before = { plants: await count('plant_locations'), species: await count('species') }
      await pg.exec(`create function reject_test_name() returns trigger language plpgsql as $$
        begin if new.name = 'REJECT' then raise exception 'fixture rejection'; end if; return new; end $$;
        create trigger reject_name before insert on plant_names for each row execute function reject_test_name();`)
      const original = fixtures
      fixtures = [feature('rollback', 'Pinus pinea', 'REJECT')]
      try {
        const response = await request('/trees/import', 'POST')
        assert.equal(response.status, 500)
        assert.equal(JSON.stringify(response.body).includes('fixture rejection'), false)
        assert.deepEqual({ plants: await count('plant_locations'), species: await count('species') }, before)
      } finally {
        fixtures = original
        await pg.exec('drop trigger reject_name on plant_names; drop function reject_test_name();')
      }
    })

    await t.test('upstream failure returns 502 without changing the catalog', async () => {
      const before = await count('plant_locations')
      upstreamFailure = true
      try { assert.equal((await request('/trees/import', 'POST')).status, 502) }
      finally { upstreamFailure = false }
      assert.equal(await count('plant_locations'), before)
    })

    await t.test('Falta positions are excluded, while genuinely unidentified plants remain', async () => {
      const before = await count('plant_locations')
      const removed = feature('removed', 'Pinus pinea')
      removed.properties.estado_gral = 'Falta'
      const unnamed = feature('no-common', 'Citrus aurantium', 'Falta')
      unnamed.properties.nom_comu_v = 'Falta'
      fixtures = [feature('absent', 'Falta', 'Falta'), removed, unnamed, feature('no-species', null, null)]
      const response = await request('/trees/import', 'POST')
      assert.equal(response.body.stored, 2)
      assert.equal(response.body.excluded, 2)
      assert.equal(response.body.failed, 0)
      assert.equal(response.body.skipped, 0)
      assert.equal(await count('plant_locations'), before + 2)
      assert.equal((await pg.query("select * from plant_locations where external_id in ('absent', 'removed')")).rows.length, 0)
      const trees = (await request('/trees?limit=200')).body.trees
      assert.equal(trees.find((tree) => tree.externalId === 'no-common').displayName, 'Citrus aurantium')
      assert.equal(trees.find((tree) => tree.externalId === 'no-species').speciesId, null)
    })

    await t.test('cultivars share species and male/female common names stay on the right plant', async () => {
      fixtures = [feature('morus', "Morus alba 'Fruitless'", 'Morera'),
        feature('female', 'Phoenix dactylifera hembra', 'Palmera hembra'),
        feature('male', 'Phoenix dactylifera macho', 'Palmera macho')]
      assert.equal((await request('/trees/import', 'POST')).body.stored, 3)
      assert.equal(await count('species'), 3)
      const trees = (await request('/trees?limit=200')).body.trees
      const female = trees.find((tree) => tree.externalId === 'female')
      const male = trees.find((tree) => tree.externalId === 'male')
      assert.equal(female.speciesId, male.speciesId)
      assert.equal(female.commonName, 'Palmera hembra')
      assert.equal(male.commonName, 'Palmera macho')
      assert.equal(trees.find((tree) => tree.externalId === 'morus').scientificName, 'Morus alba')
      assert.equal(male.reportedScientificName, 'Phoenix dactylifera macho')
    })

    await t.test('Wikipedia enrichment preserves text, Wikidata, image credits and fallback language', async () => {
      const response = await request('/species/enrich', 'POST')
      assert.equal(response.body.totalSpecies, 3)
      assert.equal(response.body.enriched, 2)
      assert.deepEqual(response.body.failed, ['Morus alba'])
      assert.equal(await count('species_enrichments'), 2)
      const species = (await request('/species?lang=es')).body.species
      const citrus = species.find((row) => row.scientificName === 'Citrus aurantium')
      assert.equal(citrus.description, 'Summary Citrus_aurantium')
      assert.equal(citrus.culturalExtract, 'Extract Citrus_aurantium')
      assert.equal(citrus.wikidataId, 'Q41')
      assert.equal(citrus.enrichment.content, 'Extract Citrus_aurantium')
      assert.match(citrus.enrichment.licenseUrl, /creativecommons\.org/)
      assert.equal(citrus.image.author, 'Botanical photographer')
      assert.equal(citrus.image.url, citrus.imageUrl)
      assert.equal(citrus.names.length, 2)
      const phoenix = species.find((row) => row.scientificName === 'Phoenix dactylifera')
      assert.equal(phoenix.wikipediaLang, 'en')
      assert.equal(phoenix.imageUrl, null)
      assert.equal(phoenix.image, null)
      const tree = (await request('/trees?limit=1')).body.trees[0]
      assert.equal((await request(`/trees/${tree.id}`)).body.species.wikipediaUrl, citrus.wikipediaUrl)
      const existingCalls = wikipediaCalls
      failMorus = false
      const retry = await request('/species/enrich', 'POST')
      assert.equal(retry.body.alreadyStored, 2)
      assert.equal(retry.body.enriched, 1)
      assert.ok(wikipediaCalls > existingCalls)
      const afterRetry = wikipediaCalls
      assert.equal((await request('/species/enrich', 'POST')).body.enriched, 0)
      assert.equal(wikipediaCalls, afterRetry)
      assert.equal(await count('species_enrichments'), 3)
    })

    await t.test('not-found Wikipedia articles leave the plant and species intact', async () => {
      fixtures = [feature('not-found', 'Absentus fictus')]
      assert.equal((await request('/trees/import', 'POST')).body.stored, 1)
      const response = await request('/species/enrich?limit=1', 'POST')
      assert.equal(response.body.notFound, 1)
      assert.equal(response.body.enriched, 0)
      assert.ok(response.body.nextAfterId > 0)
      const following = await request(`/species/enrich?afterId=${response.body.nextAfterId}`, 'POST')
      assert.equal(following.body.nextAfterId, null)
      assert.equal(await count('species'), 4)
    })
  } finally {
    if (server) await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()))
    globalThis.fetch = originalFetch
    neonConfig.fetchFunction = originalNeonFetch
    if (originalDatabaseUrl === undefined) delete process.env.DATABASE_URL
    else process.env.DATABASE_URL = originalDatabaseUrl
    await pg.close()
  }
})
