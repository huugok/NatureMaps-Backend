import assert from 'node:assert/strict'
import { once } from 'node:events'
import test from 'node:test'
import { startFixtureDatabase } from './support/pglite.mjs'

// Zonas verdes y contenido editorial (NM-08): import de la capa de espacios
// verdes, cruce con el arbolado, capa del mapa, zona de un punto, ficha de zona
// y artículos. Arnés compartido: PostgreSQL en WASM tras el protocolo de Neon y
// geoportal simulado.

function square(west, south, east, north) {
  return [[[west, south], [east, south], [east, north], [west, north], [west, south]]]
}

function area(id, nombre, tipologia, coordinates, sup = 1000, type = 'Polygon') {
  return {
    type: 'Feature',
    properties: { objectid: Number(id.slice(-4)), id_jardin: id, nombre, barrio: 'EL BOTANIC', tipologia, sup_total: sup },
    geometry: { type, coordinates },
  }
}

// Hespérides (curado, con errata en la fuente), dos tramos del Turia (un grupo),
// una isleta viaria (no destacada) y un jardín con hueco.
const FEATURES = [
  area('99120311', 'JARDIN DE LAS ESPERIDES', 'Parques Urbanos', square(-0.3870, 39.4760, -0.3860, 39.4770), 4341.6),
  area('99122001', 'JARDIN DEL TURIA (TRAMO 1)', 'Parques Urbanos', square(-0.4000, 39.4800, -0.3950, 39.4820), 38000),
  area('99122002', 'JARDIN DEL TURIA (TRAMO 2)', 'Parques Urbanos', square(-0.3950, 39.4800, -0.3900, 39.4820), 82000),
  area('99110324', 'PECHINA PSO - TERUEL C (ISLETA)', 'Acompañamiento Viario', square(-0.3880, 39.4775, -0.3878, 39.4777), 179),
  area('99120611', 'JARDINES DE MONFORTE', 'Parques Urbanos',
    [square(-0.3660, 39.4760, -0.3640, 39.4780)[0], square(-0.3652, 39.4768, -0.3648, 39.4772)[0]], 11962),
  { type: 'Feature', properties: { id_jardin: '99000000', nombre: 'SIN GEOMETRIA' }, geometry: null },
]

async function insertPlant(pg, externalId, scientificName, commonName, latitude, longitude) {
  const species = (await pg.query(
    `insert into species (scientific_name, source) values ($1, 'TEST')
     on conflict (source, scientific_name) do update set scientific_name = excluded.scientific_name returning id`,
    [scientificName])).rows[0].id
  const plant = (await pg.query(
    `insert into plant_locations (species_id, latitude, longitude, source, external_id, source_url)
     values ($1, $2, $3, 'TEST', $4, 'https://example.invalid/tree') returning id`,
    [species, latitude, longitude, externalId])).rows[0].id
  await pg.query(`insert into plant_names (plant_location_id, language, name) values ($1, 'es', $2)`, [plant, commonName])
  return { species, plant }
}

test('zonas verdes y contenido editorial (NM-08)', async (t) => {
  const { pg, restore } = await startFixtureDatabase()
  const originalFetch = globalThis.fetch
  let geoportalCalls = 0

  globalThis.fetch = async (input, init) => {
    const url = new URL(String(input))
    if (url.hostname === '127.0.0.1') return originalFetch(input, init)
    assert.equal(url.hostname, 'geoportal.valencia.es', `Llamada externa inesperada: ${url.hostname}`)
    assert.ok(url.pathname.endsWith('/MedioAmbiente/MapServer/8/query'))
    assert.equal(url.searchParams.get('outSR'), '4326')
    assert.equal(url.searchParams.get('f'), 'geojson')
    geoportalCalls++
    return Response.json({ type: 'FeatureCollection', features: FEATURES, exceededTransferLimit: false })
  }

  let server
  try {
    // Arbolado previo al import: naranjos y una jacaranda en Hespérides, un pino
    // en el Turia, un ejemplar en el hueco de Monforte y otro en plena calle.
    const naranjo1 = await insertPlant(pg, 't1', 'Citrus × aurantium', 'Naranjo amargo', 39.4765, -0.3865)
    await insertPlant(pg, 't2', 'Citrus × aurantium', 'Naranjo amargo', 39.4766, -0.3866)
    const jacaranda = await insertPlant(pg, 't3', 'Jacaranda mimosifolia', 'Jacaranda', 39.4764, -0.3864)
    const pino = await insertPlant(pg, 't4', 'Pinus halepensis', 'Pino carrasco', 39.4810, -0.3975)
    const enHueco = await insertPlant(pg, 't5', 'Citrus × aurantium', 'Naranjo amargo', 39.4770, -0.3650)
    const enCalle = await insertPlant(pg, 't6', 'Jacaranda mimosifolia', 'Jacaranda', 39.4700, -0.3700)
    await pg.query(
      `insert into pois (source, external_id, name, category, latitude, longitude, source_url) values
       ('TEST', 'p1', 'Estatua de Hércules', 'monumento', 39.4765, -0.3865, 'https://example.invalid/poi'),
       ('TEST', 'p2', 'Torres de Quart', 'monumento', 39.4757, -0.3838, 'https://example.invalid/poi'),
       ('TEST', 'p3', 'Mercado Central', 'monumento', 39.4736, -0.3790, 'https://example.invalid/poi')`)

    const { app } = await import('../src/app.ts')
    server = app.listen(0, '127.0.0.1')
    await once(server, 'listening')
    const root = `http://127.0.0.1:${server.address().port}`
    async function request(path, method = 'GET') {
      const response = await fetch(root + path, { method })
      return { status: response.status, body: await response.json() }
    }
    const areaOf = async (plant) => (await pg.query('select green_area_id as id from plant_locations where id = $1', [plant])).rows[0].id
    const idOf = async (externalId) => (await pg.query('select id from green_areas where external_id = $1', [externalId])).rows[0].id

    await t.test('importa los polígonos, cura nombres y registra la fuente', async () => {
      const imported = await request('/green-areas/import', 'POST')
      assert.equal(imported.status, 200)
      assert.equal(imported.body.fetched, 6)
      assert.equal(imported.body.stored, 5)
      assert.equal(imported.body.featured, 4)
      assert.equal(imported.body.invalid, 1, 'un polígono sin geometría no se guarda')
      const hesperides = (await pg.query(`select name, reported_name, group_slug, featured from green_areas where external_id = '99120311'`)).rows[0]
      assert.equal(hesperides.name, 'Jardín de las Hespérides')
      assert.equal(hesperides.reported_name, 'JARDIN DE LAS ESPERIDES', 'el nombre original de la fuente se conserva')
      assert.equal(hesperides.group_slug, 'jardin-de-las-hesperides')
      const turia = (await pg.query(`select name, group_slug from green_areas where external_id like '9912200%' order by external_id`)).rows
      assert.deepEqual(turia.map((row) => row.group_slug), ['jardin-del-turia', 'jardin-del-turia'])
      assert.equal(turia[0].name, 'Jardín del Turia (tramo 1)')
      const isleta = (await pg.query(`select name, group_slug, featured from green_areas where external_id = '99110324'`)).rows[0]
      assert.equal(isleta.featured, false)
      assert.equal(isleta.group_slug, 'zona-99110324')
      assert.equal(isleta.name, 'Pechina Pso - Teruel C (Isleta)')
      const source = (await request('/sources/VALENCIA_ESPACIOS_VERDES')).body
      assert.equal(source.license, 'CC BY 4.0')
      assert.ok(source.attribution.includes('Ajuntament de València'))
    })

    await t.test('asigna cada ejemplar a la zona que lo contiene', async () => {
      assert.equal(await areaOf(naranjo1.plant), await idOf('99120311'))
      assert.equal(await areaOf(jacaranda.plant), await idOf('99120311'))
      assert.equal(await areaOf(pino.plant), await idOf('99122001'))
      assert.equal(await areaOf(enHueco.plant), null, 'un hueco del polígono no es zona verde')
      assert.equal(await areaOf(enCalle.plant), null)
    })

    await t.test('reimportar no duplica zonas ni reescribe ejemplares', async () => {
      const again = await request('/green-areas/import', 'POST')
      assert.equal(again.body.plants.scanned, 6)
      assert.equal(again.body.plants.inside, 4)
      assert.equal(again.body.plants.updated, 0)
      assert.equal((await pg.query('select count(*)::int as count from green_areas')).rows[0].count, 5)
      assert.equal(geoportalCalls, 2)
    })

    await t.test('capa del mapa: solo parques y jardines, con contorno y caja', async () => {
      const layer = await request('/green-areas')
      assert.equal(layer.status, 200)
      assert.equal(layer.body.returned, 4)
      assert.ok(layer.body.areas.every((item) => item.featured))
      const hesperides = layer.body.areas.find((item) => item.groupSlug === 'jardin-de-las-hesperides')
      assert.equal(hesperides.geometry.type, 'Polygon')
      assert.deepEqual(hesperides.bbox, [-0.387, 39.476, -0.386, 39.477])
      assert.ok(Math.abs(hesperides.center.latitude - 39.4765) < 1e-6)
      assert.equal(hesperides.hasArticle, false)
      assert.equal(layer.body.sources[0].code, 'VALENCIA_ESPACIOS_VERDES')
      const turia = layer.body.areas.filter((item) => item.groupSlug === 'jardin-del-turia')
      assert.equal(turia.length, 2)
      assert.equal(turia[0].groupName, 'Jardín del Turia')
      // all=true añade el verde viario; geometry=false aligera; bbox recorta.
      assert.equal((await request('/green-areas?all=true')).body.returned, 5)
      const light = await request('/green-areas?geometry=false')
      assert.equal(light.body.areas[0].geometry, undefined)
      const clipped = await request('/green-areas?bbox=-0.39,39.475,-0.385,39.478')
      assert.deepEqual(clipped.body.areas.map((item) => item.groupSlug), ['jardin-de-las-hesperides'])
    })

    await t.test('zona de un punto: dentro, cerca o ninguna (enlace desde un POI)', async () => {
      const inside = await request('/green-areas/at?lat=39.4765&lon=-0.3865')
      assert.equal(inside.body.relation, 'inside')
      assert.equal(inside.body.distance, 0)
      assert.equal(inside.body.area.name, 'Jardín de las Hespérides')
      assert.equal(inside.body.area.geometry, undefined)
      // A unos 45 m del borde este: cerca, pero fuera.
      const near = await request('/green-areas/at?lat=39.4765&lon=-0.38548')
      assert.equal(near.body.relation, 'near')
      assert.ok(near.body.distance > 30 && near.body.distance < 60, String(near.body.distance))
      assert.equal(near.body.area.groupSlug, 'jardin-de-las-hesperides')
      // Pegado a una isleta: no se ofrece el verde viario como «entorno».
      const isleta = await request('/green-areas/at?lat=39.47785&lon=-0.3879&radius=30')
      assert.equal(isleta.body.area, null)
      const none = await request('/green-areas/at?lat=39.4500&lon=-0.3500')
      assert.equal(none.body.area, null)
      assert.equal(none.body.relation, null)
    })

    await t.test('ficha de zona: flora, POIs de dentro y grupo de tramos', async () => {
      const detail = await request(`/green-areas/${await idOf('99120311')}`)
      assert.equal(detail.status, 200)
      assert.equal(detail.body.name, 'Jardín de las Hespérides')
      assert.equal(detail.body.groupSlug, 'jardin-de-las-hesperides')
      assert.deepEqual(detail.body.plants, { total: 3, species: 2 })
      assert.equal(detail.body.topSpecies[0].scientificName, 'Citrus × aurantium')
      assert.equal(detail.body.topSpecies[0].commonName, 'Naranjo amargo')
      assert.equal(detail.body.topSpecies[0].plants, 2)
      assert.equal(detail.body.topSpecies[0].speciesId, naranjo1.species)
      assert.deepEqual(detail.body.pois.map((poi) => poi.name), ['Estatua de Hércules'])
      assert.equal(detail.body.dataSource.code, 'VALENCIA_ESPACIOS_VERDES')
      assert.equal(detail.body.areas[0].geometry.type, 'Polygon')

      const turia = await request('/green-areas/group/jardin-del-turia')
      assert.equal(turia.body.name, 'Jardín del Turia')
      assert.equal(turia.body.areas.length, 2)
      assert.equal(turia.body.areaM2, 120000)
      assert.deepEqual(turia.body.bbox, [-0.4, 39.48, -0.39, 39.482])
      assert.equal(turia.body.plants.total, 1)
      // Por id de un tramo se llega a la misma ficha de grupo.
      const tramo = await request(`/green-areas/${await idOf('99122002')}`)
      assert.equal(tramo.body.groupSlug, 'jardin-del-turia')
      assert.equal(tramo.body.selectedId, await idOf('99122002'))
    })

    await t.test('la seed editorial es idempotente y exige fuentes y zonas existentes', async () => {
      const { seedEditorial, EDITORIAL_ARTICLES } = await import('../src/db/seedEditorial.ts')
      // La seed real enlaza parques que este fixture no tiene: debe fallar, no enlazar a ciegas.
      await assert.rejects(() => seedEditorial(), /no existe en green_areas/)
      const entries = EDITORIAL_ARTICLES.filter((entry) => entry.greenAreaGroup === null
        || ['jardin-del-turia', 'jardin-de-las-hesperides', 'jardin-de-monforte'].includes(entry.greenAreaGroup))
      const first = await seedEditorial(entries)
      assert.equal(first.upserted, entries.length)
      assert.deepEqual(first.languages, ['ca', 'en', 'es'])
      await seedEditorial(entries)
      const count = (await pg.query('select count(*)::int as count from editorial_articles')).rows[0].count
      assert.equal(count, entries.length, 'ejecutarla dos veces no duplica')
      assert.ok(EDITORIAL_ARTICLES.every((entry) => entry.sources.length > 0 && entry.sources.every((source) => source.url.startsWith('https://'))))
      for (const topic of ['flora', 'parques', 'jardines', 'paisajismo']) {
        assert.ok(EDITORIAL_ARTICLES.some((entry) => entry.topic === topic), `falta la sección ${topic}`)
      }
      // Cada artículo existe en los tres idiomas, con el mismo tema, la misma
      // zona enlazada y las mismas fuentes: una traducción no puede desviarse.
      const bySlug = new Map()
      for (const entry of EDITORIAL_ARTICLES) {
        const group = bySlug.get(entry.slug) ?? new Map()
        group.set(entry.language, entry)
        bySlug.set(entry.slug, group)
      }
      for (const [slug, byLanguage] of bySlug) {
        assert.deepEqual([...byLanguage.keys()].sort(), ['ca', 'en', 'es'], `${slug} no está en los tres idiomas`)
        const es = byLanguage.get('es')
        for (const language of ['ca', 'en']) {
          const other = byLanguage.get(language)
          assert.equal(other.topic, es.topic, `${slug} (${language}): sección distinta`)
          assert.equal(other.greenAreaGroup, es.greenAreaGroup, `${slug} (${language}): zona distinta`)
          assert.equal(other.position, es.position, `${slug} (${language}): orden distinto`)
          assert.deepEqual(other.sources.map((source) => source.url), es.sources.map((source) => source.url),
            `${slug} (${language}): fuentes distintas`)
          // El cuerpo siempre cambia al traducir; el título puede coincidir
          // entre castellano y valenciano («Flora característica de València»).
          assert.notEqual(other.body, es.body, `${slug} (${language}): cuerpo sin traducir`)
          // Mismo número de párrafos: una traducción no se deja nada fuera.
          assert.equal(other.body.split('\n\n').length, es.body.split('\n\n').length,
            `${slug} (${language}): distinto número de párrafos`)
        }
      }
      await assert.rejects(() => seedEditorial([{ ...entries[0], slug: 'sin-fuentes', sources: [] }]), /no declara fuentes/)
    })

    await t.test('secciones temáticas, filtro por zona e idioma con fallback', async () => {
      const all = await request('/editorial')
      assert.equal(all.status, 200)
      assert.equal(all.body.articles[0].slug, 'flora-caracteristica-de-valencia', 'ordenados por sección')
      assert.equal(all.body.articles[0].body, undefined, 'la lista no envía el cuerpo')
      const jardines = await request('/editorial?topic=jardines')
      assert.ok(jardines.body.returned >= 3)
      assert.ok(jardines.body.articles.every((article) => article.topic === 'jardines'))
      const zona = await request('/editorial?group=jardin-de-las-hesperides')
      assert.deepEqual(zona.body.articles.map((article) => article.slug), ['jardin-de-las-hesperides'])

      const ca = await request('/editorial/jardin-de-las-hesperides?lang=ca')
      assert.equal(ca.body.title, 'Jardí de les Hespèrides')
      assert.equal(ca.body.language, 'ca')
      const en = await request('/editorial/jardin-de-las-hesperides?lang=en')
      assert.equal(en.body.language, 'en')
      assert.ok(en.body.body.includes('citrus'))
      assert.ok(en.body.sources.length >= 1)
      // Un idioma sin traducir cae al español, y la respuesta lo dice.
      const fr = await request('/editorial/jardin-de-las-hesperides?lang=fr')
      assert.equal(fr.body.language, 'es')
      assert.ok(fr.body.body.includes('cítricos'))
      assert.equal((await request('/editorial?lang=ca')).body.articles.filter((article) => article.slug === 'jardin-de-las-hesperides').length, 1)
    })

    await t.test('la ficha de zona y la capa enlazan sus artículos', async () => {
      const detail = await request('/green-areas/group/jardin-de-las-hesperides')
      assert.deepEqual(detail.body.articles.map((article) => article.slug), ['jardin-de-las-hesperides'])
      const layer = await request('/green-areas?geometry=false')
      assert.equal(layer.body.areas.find((item) => item.groupSlug === 'jardin-de-las-hesperides').hasArticle, true)
    })

    await t.test('la ficha de especie dice en qué parques encontrarla (PA 3013)', async () => {
      const species = await request(`/species/${naranjo1.species}`)
      assert.equal(species.status, 200)
      assert.deepEqual(species.body.greenAreas, [{
        groupSlug: 'jardin-de-las-hesperides', id: await idOf('99120311'),
        name: 'Jardín de las Hespérides', plants: 2, hasArticle: true,
      }])
      const pine = await request(`/species/${pino.species}`)
      assert.equal(pine.body.greenAreas[0].name, 'Jardín del Turia')
      assert.equal(pine.body.greenAreas[0].groupSlug, 'jardin-del-turia')
      // Una especie que solo está en la calle no enlaza ninguna zona.
      await pg.query('update plant_locations set green_area_id = null where species_id = $1', [jacaranda.species])
      assert.deepEqual((await request(`/species/${jacaranda.species}`)).body.greenAreas, [])
    })

    await t.test('valida parámetros antes de consultar', async () => {
      for (const path of ['/green-areas/at?lat=abc&lon=0', '/green-areas/at?lat=0', '/green-areas/at?lat=0&lon=0&radius=5000',
        '/green-areas?all=si', '/green-areas?bbox=1,2,3', '/green-areas?bbox=5,0,1,2', '/green-areas/abc', '/green-areas/0',
        '/green-areas/group/No_Valido', '/editorial?topic=cocina', '/editorial?group=..%2F', '/editorial/Mal_Slug']) {
        assert.equal((await request(path)).status, 400, path)
      }
      assert.equal((await request('/green-areas/9999')).status, 404)
      assert.equal((await request('/green-areas/group/no-existe')).status, 404)
      assert.equal((await request('/editorial/no-existe')).status, 404)
    })
  } finally {
    globalThis.fetch = originalFetch
    if (server) await new Promise((resolve) => server.close(resolve))
    restore()
    await pg.close()
  }
})
