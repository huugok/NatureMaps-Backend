import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { startFixtureDatabase } from './support/pglite.mjs'

// POIs histórico-culturales (NM-06): import desde el geoportal, contenido curado
// de la ficha y endpoints del mapa. Usa el arnés compartido de tests/support:
// PostgreSQL en WASM detrás del protocolo HTTP de Neon y respuestas externas
// simuladas.
function monument(gid, nombre, x, y) {
  return { attributes: { gid, nombre }, geometry: { x, y } }
}

const MONUMENTOS = [
  monument(1, 'TORRES DELS SERRANS', -0.3762, 39.4792),
  monument(2, 'LLOTJA', -0.3785, 39.4742),
  monument(3, 'PLAÇA DE LA VIRGEN', -0.3752, 39.4742),
]

const RECURSOS = [
  { attributes: { objectid: 10, nombre: '10-MUSEO DE BELLAS ARTES', descripcion: null,
    informacion_recurso: 'https://www.valencia.es/ficha/10.pdf' }, geometry: { x: -0.3705, y: 39.4788 } },
  { attributes: { objectid: 11, nombre: '11-JARDÍN BOTÁNICO', descripcion: 'Jardín histórico de la Universitat.',
    informacion_recurso: null }, geometry: { x: -0.3862, y: 39.4765 } },
]

test('POIs histórico-culturales: import, contenido curado y API (NM-06)', async (t) => {
  const { pg, restore } = await startFixtureDatabase()

  const originalFetch = globalThis.fetch
  let geoportalCalls = 0
  let wikipediaCalls = 0

  // Imagen con licencia verificable (se guarda) y sin licencia reutilizable (se descarta).
  const imageInfo = (file, reusable) => ({ query: { pages: { '7': { imageinfo: [{
    url: `https://upload.wikimedia.org/wikipedia/commons/a/ab/${file}`,
    thumburl: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${file}/1024px-${file}`,
    descriptionurl: `https://commons.wikimedia.org/wiki/File:${file}`,
    extmetadata: {
      Artist: { value: '<a href="https://example.invalid">Fotógrafo</a>' },
      LicenseShortName: { value: reusable ? 'CC BY-SA 4.0' : 'CC BY-NC 4.0' },
      LicenseUrl: { value: reusable ? 'https://creativecommons.org/licenses/by-sa/4.0/' : 'https://creativecommons.org/licenses/by-nc/4.0/' },
      ...(reusable ? {} : { Attribution: { value: 'Prohibido el uso comercial' } }),
    },
  }] } } } })

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    if (url.hostname.endsWith('.wikipedia.org') || url.hostname === 'commons.wikimedia.org') {
      wikipediaCalls++
      assert.match(init.headers['User-Agent'], /NatureMapsBackend/)
      if (url.pathname === '/w/api.php') {
        const titles = url.searchParams.get('titles') ?? ''
        if (titles === 'File:Torres.jpg') return Response.json(imageInfo('Torres.jpg', true))
        if (titles === 'File:Llotja.jpg') return Response.json(imageInfo('Llotja.jpg', false))
        // langlinks de es -> ca/en
        if (titles === 'Torres de Serranos') {
          return Response.json({ query: { pages: { '1': { langlinks: [
            { lang: 'ca', '*': 'Torres de Serrans' }, { lang: 'en', '*': 'Serranos Towers' }] } } } })
        }
        if (titles === 'Lonja de la Seda') {
          return Response.json({ query: { pages: { '2': { langlinks: [{ lang: 'ca', '*': 'Llotja de la Seda' }] } } } })
        }
        return Response.json({ query: { pages: { '-1': { missing: true } } } })
      }
      if (url.pathname.endsWith('/bare')) {
        return Response.json({ license: { title: 'CC BY-SA 4.0', url: 'https://creativecommons.org/licenses/by-sa/4.0/' } })
      }
      const title = decodeURIComponent(url.pathname.split('/').at(-1))
      const extracts = {
        'Torres_de_Serranos': 'Torres de la muralla medieval de València.',
        'Torres_de_Serrans': 'Torres de la muralla medieval de València en valencià.',
        'Serranos_Towers': 'Medieval city gate towers in Valencia.',
        'Lonja_de_la_Seda': 'Mercado de contratación de la seda.',
        'Llotja_de_la_Seda': "Mercat de contractació de la seda en valencià.",
      }
      if (!extracts[title]) return Response.json({}, { status: 404 })
      return Response.json({
        type: 'standard', title: title.replaceAll('_', ' '), extract: extracts[title],
        thumbnail: { source: `https://upload.wikimedia.org/wikipedia/commons/thumb/a/ab/${title === 'Lonja_de_la_Seda' || title === 'Llotja_de_la_Seda' ? 'Llotja.jpg' : 'Torres.jpg'}/320px-file.jpg` },
      })
    }
    assert.equal(url.hostname, 'geoportal.valencia.es', `Llamada externa inesperada: ${url.hostname}`)
    geoportalCalls++
    assert.equal(url.searchParams.get('outSR'), '4326')
    assert.equal(url.searchParams.get('f'), 'json')
    const layer = url.pathname.includes('/202/') ? 202 : 226
    const fixtures = layer === 202 ? MONUMENTOS : RECURSOS
    return Response.json({ type: 'FeatureCollection', features: fixtures, exceededTransferLimit: false })
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

    await t.test('importa ambas capas del geoportal con su fuente y licencia', async () => {
      const imported = await request('/pois/import', 'POST')
      assert.equal(imported.status, 200)
      assert.equal(imported.body.fetched, 5)
      assert.equal(imported.body.stored, 5)
      const sources = await request('/sources')
      const codes = sources.body.sources.map((source) => source.code)
      assert.ok(codes.includes('VALENCIA_MONUMENTOS'))
      assert.ok(codes.includes('VALENCIA_RECURSOS'))
      const monumentos = sources.body.sources.find((source) => source.code === 'VALENCIA_MONUMENTOS')
      assert.equal(monumentos.license, 'CC BY 4.0')
      assert.ok(monumentos.attribution.includes('Ajuntament de València'))
      // Los nombres del geoportal llegan en mayúsculas; la ficha los pinta legibles.
      const detail = await request('/pois/1')
      assert.equal(detail.body.name, 'Torres dels Serrans')
      assert.equal(detail.body.category, 'monumento')
      assert.equal(detail.body.dataSource.code, 'VALENCIA_MONUMENTOS')
    })

    await t.test('reimportar no duplica POIs', async () => {
      await request('/pois/import', 'POST')
      const count = (await pg.query('select count(*)::int as count from pois')).rows[0].count
      assert.equal(count, 5)
    })

    await t.test('separa recursos turísticos y conserva la descripción de la fuente', async () => {
      const detail = await request('/pois/4')
      assert.equal(detail.body.category, 'recurso-turistico')
      assert.equal(detail.body.infoUrl, 'https://www.valencia.es/ficha/10.pdf')
      // El geoportal no trae descripción para los monumentos: no se inventa.
      assert.equal((await request('/pois/1')).body.description, undefined)
    })

    await t.test('la seed cura descripción por idioma e imagen con créditos', async () => {
      const { seedPoiProfiles } = await import('../src/services/poiProfiles.ts')
      const summary = await seedPoiProfiles([
        { sourceName: 'TORRES DELS SERRANS', wikipedia: 'Torres de Serranos' },
        { sourceName: 'LLOTJA', wikipedia: 'Lonja de la Seda' },
      ])
      assert.equal(summary.matched, 2)
      assert.equal(summary.images, 1, 'la imagen sin licencia reutilizable no se guarda')

      const es = await request('/pois/1?lang=es')
      assert.equal(es.body.profile.description, 'Torres de la muralla medieval de València.')
      assert.equal(es.body.profile.language, 'es')
      assert.equal(es.body.profile.license, 'CC BY-SA 4.0')
      assert.ok(es.body.image.url.includes('Torres.jpg'))
      assert.equal(es.body.image.license, 'CC BY-SA 4.0')
      assert.ok(es.body.image.attribution.includes('Fotógrafo'))

      const ca = await request('/pois/1?lang=ca')
      assert.equal(ca.body.profile.language, 'ca')

      const en = await request('/pois/1?lang=en')
      assert.equal(en.body.profile.language, 'en')

      const sinFoto = await request('/pois/2')
      assert.equal(sinFoto.body.image, null)
      assert.ok(sinFoto.body.profile.description.includes('seda'))
    })

    await t.test('cercanos: distancia, fuente y ficha en la misma respuesta', async () => {
      const nearby = await request('/pois/nearby?lat=39.4742&lon=-0.3785&radius=1000&limit=10')
      assert.equal(nearby.status, 200)
      assert.equal(nearby.body.returned, 5)
      assert.equal(nearby.body.pois[0].name, 'Llotja')
      assert.equal(nearby.body.pois[0].distance, 0)
      assert.equal(nearby.body.pois[0].profile.description, 'Mercado de contratación de la seda.')
      assert.equal(nearby.body.sources.VALENCIA_MONUMENTOS.code, 'VALENCIA_MONUMENTOS')
      const distances = nearby.body.pois.map((poi) => poi.distance)
      assert.deepEqual(distances, [...distances].sort((a, b) => a - b))
      // El radio recorta: con 200 m solo quedan los del centro.
      const close = await request('/pois/nearby?lat=39.4742&lon=-0.3785&radius=200')
      assert.ok(close.body.returned < nearby.body.returned)
    })

    await t.test('valida los parámetros del mapa antes de consultar', async () => {
      for (const path of ['/pois/nearby?lat=abc&lon=0', '/pois/nearby?lat=91&lon=0', '/pois/nearby?lat=0&lon=0&radius=10',
        '/pois/abc', '/pois/0', '/pois/nearby?lat=0&lon=0&lang=!!!']) {
        assert.equal((await request(path)).status, 400, path)
      }
      assert.equal((await request('/pois/9999')).status, 404)
    })

    await t.test('una entrada solo-foto guarda la imagen de Commons sin descripción', async () => {
      const { seedPoiProfiles } = await import('../src/services/poiProfiles.ts')
      const summary = await seedPoiProfiles([{ sourceName: 'PLAÇA DE LA VIRGEN', image: 'File:Torres.jpg' }])
      assert.equal(summary.matched, 1)
      assert.equal(summary.images, 1)
      assert.equal(summary.profiles, 0)
      const detail = await request('/pois/3')
      assert.ok(detail.body.image.url.includes('Torres.jpg'))
      assert.equal(detail.body.image.license, 'CC BY-SA 4.0')
      assert.ok(detail.body.image.attribution.includes('Fotógrafo'))
      assert.equal(detail.body.profile, null, 'sin artículo no se inventa descripción')
    })

    await t.test('detail=lite sirve solo lo que pinta el mapa', async () => {
      const lite = await request('/pois/nearby?lat=39.4742&lon=-0.3785&radius=1000&limit=10&detail=lite')
      assert.equal(lite.status, 200)
      assert.equal(lite.body.returned, 5)
      const first = lite.body.pois[0]
      assert.equal(typeof first.summary, 'string')
      assert.equal(first.hasProfile, true)
      assert.equal(typeof first.hasProfile, 'boolean')
      const conFoto = lite.body.pois.find((poi) => poi.name === 'Torres dels Serrans')
      assert.ok(conFoto.imageUrl.includes('Torres.jpg'))
      assert.equal(first.imageUrl, null, 'la Llotja se quedó sin foto por licencia')
      for (const field of ['profile', 'sourceUrl', 'infoUrl', 'image', 'externalId', 'address', 'wikidataId']) {
        assert.equal(first[field], undefined, `detail=lite no debe traer ${field}`)
      }
      assert.ok(lite.body.sources.VALENCIA_MONUMENTOS, 'las fuentes siguen viajando')

      for (const path of ['/pois/nearby?lat=39.4742&lon=-0.3785&radius=1000&limit=10',
        '/pois/nearby?lat=39.4742&lon=-0.3785&radius=1000&limit=10&detail=full']) {
        const full = await request(path)
        assert.ok(full.body.pois[0].profile, path)
        assert.ok(full.body.pois.find((poi) => poi.name === 'Torres dels Serrans').image, path)
      }

      assert.equal((await request('/pois/nearby?lat=0&lon=0&detail=medium')).status, 400)
    })

    await t.test('sin base accesible responde 500 sin filtrar detalles', async () => {
      await pg.close()
      const response = await request('/pois/nearby?lat=39.4742&lon=-0.3785&radius=500')
      assert.equal(response.status, 500)
      assert.deepEqual(response.body, { error: 'No se pudo consultar o guardar el catálogo' })
      assert.ok(geoportalCalls > 0 && wikipediaCalls > 0)
    })
  } finally {
    globalThis.fetch = originalFetch
    restore()
    server?.close()
  }
})
