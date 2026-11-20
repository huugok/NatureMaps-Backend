import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { startFixtureDatabase } from './support/pglite.mjs'

function fixtureMap() {
  const bytes = Buffer.alloc(127)
  bytes.write('PMTiles'); bytes[7] = 3; bytes[99] = 1; bytes[101] = 15
  ;[-0.52, 39.36, -0.24, 39.62].forEach((value, index) => bytes.writeInt32LE(Math.round(value * 1e7), 102 + index * 4))
  return bytes
}

test('paquete offline de rutas: datos reales, créditos, idioma y validación HTTP', async () => {
  const { pg, restore } = await startFixtureDatabase()
  let server
  try {
    const { id: speciesId } = (await pg.query(`insert into species (scientific_name, source)
      values ('Citrus aurantium', 'TEST') returning id`)).rows[0]
    const { id: plantId } = (await pg.query(`insert into plant_locations (species_id, latitude, longitude, source, external_id, source_url)
      values ($1, 39.47, -0.38, 'TEST', '1', 'https://example.test/tree') returning id`, [speciesId])).rows[0]
    await pg.query(`insert into species_profiles (species_id, language, description, sources) values
      ($1, 'es', 'Naranjo', '[]'), ($1, 'ca', 'Taronger', '[]')`, [speciesId])
    await pg.query(`insert into species_enrichments (species_id, source, language, source_url, description,
      image_url, image_source_url, image_author, image_license, image_license_url, image_attribution)
      values ($1, 'WIKIPEDIA', 'es', 'https://example.test/wiki', 'Texto Wikipedia', 'https://example.test/photo.png',
      'https://example.test/commons', 'Autor', 'CC BY 4.0', 'https://example.test/license', 'Autor CC BY 4.0')`, [speciesId])
    const { id: poiId } = (await pg.query(`insert into pois (name, category, latitude, longitude, source, external_id, source_url)
      values ('Torre', 'monumento', 39.471, -0.381, 'TEST', '1', 'https://example.test/poi') returning id`)).rows[0]
    const stops = [{ kind: 'planta', id: plantId, speciesId, name: 'Naranjo', latitude: 39.47, longitude: -0.38 },
      { kind: 'poi', id: poiId, speciesId: null, name: 'Torre', latitude: 39.471, longitude: -0.381 },
      { kind: 'planta', id: plantId, speciesId, name: 'Naranjo', latitude: 39.47, longitude: -0.38 }]
    const { id } = (await pg.query(`insert into routes (name, theme, shape, length_category, distance_meters,
      duration_seconds, start_latitude, start_longitude, description, stops, path)
      values ('Ruta', 'mixta', 'circular', 'corta', 2000, 1800, 39.47, -0.38, 'Prueba', $1, $2) returning id`,
    [JSON.stringify(stops), JSON.stringify(stops.map(({ latitude, longitude }) => ({ latitude, longitude })))])).rows[0]
    const { app } = await import('../src/app.ts')
    const { storeMapArchive } = await import('../src/services/offlineMaps.ts')
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const root = `http://127.0.0.1:${server.address().port}`
    assert.equal((await fetch(`${root}/routes/${id}/offline`)).status, 503)
    const mapBytes = fixtureMap()
    const map = await storeMapArchive(mapBytes, 'https://build.protomaps.com/20261118.pmtiles')
    await storeMapArchive(mapBytes, 'https://build.protomaps.com/20261118.pmtiles')
    assert.equal((await pg.query('select count(*)::int as total from offline_maps')).rows[0].total, 1)
    const metadata = await (await fetch(`${root}/offline-maps/valencia`)).json()
    assert.equal(metadata.archiveBase64, undefined)
    assert.equal(metadata.sha256, map.sha256)
    const archive = await fetch(root + metadata.url)
    assert.deepEqual(Buffer.from(await archive.arrayBuffer()), mapBytes)
    const range = await fetch(root + metadata.url, { headers: { Range: 'bytes=0-9' } })
    assert.equal(range.status, 206)
    assert.equal(range.headers.get('content-range'), 'bytes 0-9/127')
    assert.deepEqual(Buffer.from(await range.arrayBuffer()), mapBytes.subarray(0, 10))
    assert.equal((await fetch(root + metadata.url, { headers: { Range: 'bytes=999-' } })).status, 416)
    assert.equal((await fetch(`${root}/offline-maps/valencia/${'0'.repeat(64)}.pmtiles`)).status, 404)
    const response = await fetch(`${root}/routes/${id}/offline?lang=va`)
    assert.equal(response.status, 200)
    const packet = await response.json()
    assert.equal(packet.language, 'ca')
    assert.equal(packet.schemaVersion, 2)
    assert.equal(packet.map.sha256, map.sha256)
    assert.equal(packet.map.bytes, 127)
    assert.equal(packet.route.path.length, 3)
    assert.deepEqual(packet.stops.map((s) => s.kind), ['planta', 'poi', 'planta'])
    assert.equal(packet.species.length, 1)
    assert.equal(packet.species[0].profile.description, 'Taronger')
    assert.equal(packet.stops[1].poi.sourceUrl, 'https://example.test/poi')
    assert.equal(packet.images.length, 1)
    assert.equal(packet.images[0].attribution, 'Autor CC BY 4.0')
    assert.match(packet.revision, /^[a-f0-9]{64}$/)
    assert.equal((await (await fetch(`${root}/routes/${id}/offline?lang=va`)).json()).revision, packet.revision)
    assert.equal((await fetch(`${root}/routes/abc/offline`)).status, 400)
    assert.equal((await fetch(`${root}/routes/999/offline`)).status, 404)
    assert.equal((await fetch(`${root}/routes/${id}/offline?lang=bad!`)).status, 400)
    await pg.query('update routes set start_latitude = 0 where id = $1', [id])
    assert.equal((await fetch(`${root}/routes/${id}/offline`)).status, 409)
    await pg.query('update routes set start_latitude = 39.47 where id = $1', [id])
    await pg.query('delete from pois where id = $1', [poiId])
    assert.equal((await fetch(`${root}/routes/${id}/offline`)).status, 409)
  } finally {
    if (server) await new Promise((resolve) => server.close(resolve))
    restore()
    await pg.close()
  }
})
