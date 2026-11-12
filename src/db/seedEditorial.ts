// Seed idempotente del contenido editorial de flora y zonas verdes (NM-08).
//
// Los textos son propios del equipo, redactados a partir de las fuentes que
// acompañan a cada artículo (consultadas el 12/11/2026). Solo se afirma lo que
// esas fuentes dicen; cuando dos fuentes dan cifras distintas (la superficie
// del Jardín del Turia, por ejemplo) el texto no da la cifra.
//
// Por qué una seed y no una migración: el contenido cambia a menudo y no debe
// generar migraciones. La estructura vive en `drizzle/0004_*.sql`.
//
// Idempotente: upsert por la clave natural `(slug, language)`. Corregir un
// texto es editarlo aquí y volver a ejecutar `npm run db:seed:editorial`;
// añadir `ca`/`en` es añadir entradas con el mismo slug y no toca el `es`.
//
// Un artículo puede enlazarse a una zona verde por su `group_slug`
// (`greenAreaGroup`). Si las zonas ya están importadas y el grupo no existe, la
// seed falla: un enlace roto debe verse aquí y no en la app. Si aún no se han
// importado (`npm run import:zonas-verdes`), el enlace se guarda igualmente.
import { sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { db } from './index.js'
import type { EditorialSource, EditorialTopic } from '../services/editorialCatalog.js'

interface EditorialEntry {
  slug: string
  language: string
  topic: EditorialTopic
  greenAreaGroup: string | null
  position: number
  title: string
  summary: string
  body: string
  sources: EditorialSource[]
}

const CONSULTED = 'Consulta 12/11/2026'

const AJUNTAMENT_GUIA: EditorialSource = {
  name: 'Ajuntament de València',
  description: `Guía de jardines históricos y parques urbanos de la ciudad de Valencia · ${CONSULTED}`,
  url: 'https://www.valencia.es/documents/20142/180607/guiaPARQUES_02.pdf/950a849f-c161-7e60-7d71-7d71edfca459',
}
const ESPACIOS_VERDES: EditorialSource = {
  name: 'Ajuntament de València – Dades Obertes',
  description: `Capa «Espais Verds / Espacios Verdes» del Geoportal (CC BY 4.0) · ${CONSULTED}`,
  url: 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/8',
}

export const EDITORIAL_ARTICLES: EditorialEntry[] = [
  {
    slug: 'flora-caracteristica-de-valencia',
    language: 'es',
    topic: 'flora',
    greenAreaGroup: null,
    position: 10,
    title: 'Flora característica de València',
    summary: 'Naranjos amargos en las aceras, jacarandas que tiñen de violeta la primavera y ficus centenarios: los árboles que dan carácter a la ciudad.',
    body: [
      'Pasear por València es caminar bajo árboles. El inventario municipal de arbolado, que Nature MAPS utiliza como base del mapa, recoge más de 157.000 ejemplares en calles y jardines. Entre los más repetidos está el naranjo amargo, con más de 12.600 árboles. La jacaranda, de origen sudamericano, suma más de 5.200 ejemplares y cubre su copa de flores azul violeta en primavera.',
      'Los gigantes de la ciudad son las higueras australianas (Ficus macrophylla). El Ayuntamiento cuida como árboles monumentales los ejemplares del Parterre, de la Glorieta y del paseo de la Alameda, reconocibles por el tamaño de su tronco y de su copa.',
      'Palmeras datileras y canarias, pinos, moreras, olivos y magnolios completan un paisaje vegetal en el que conviven especies mediterráneas con otras llegadas de lejos. En cada ficha de planta de la app puedes ver en qué parques y jardines encontrarla.',
    ].join('\n\n'),
    sources: [
      {
        name: 'Ajuntament de València – Dades Obertes',
        description: 'Inventario de arbolado municipal (CC BY 4.0): total de ejemplares y recuento por especie · Consulta 25/10/2026',
        url: 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151',
      },
      {
        name: 'Ajuntament de València',
        description: `Nota sobre la conservación de las higueras australianas monumentales del Parterre, la Glorieta y la Alameda · ${CONSULTED}`,
        url: 'https://www.valencia.es/cas/actualidad/-/content/conservaci%C3%B3n-higueras-australianas',
      },
    ],
  },
  {
    slug: 'parques-urbanos-de-valencia',
    language: 'es',
    topic: 'parques',
    greenAreaGroup: null,
    position: 20,
    title: 'Los parques urbanos de València',
    summary: 'Del antiguo cauce del Turia a los parques de barrio: los grandes espacios verdes que estructuran la ciudad.',
    body: [
      'El gran parque de València nació de una catástrofe. Tras la riada de 1957 se decidió desviar el río, y el cauce que quedó libre acabó convertido en el Jardín del Turia, un parque que atraviesa la ciudad de oeste a este hasta acercarse al mar. En su extremo occidental lo prolonga el Parque de Cabecera.',
      'Alrededor de ese eje, la ciudad ha ido sumando parques de barrio: Benicalap, Orriols, el Parque del Oeste, Nazaret, y más tarde Marxalenes y la Rambleta, proyectados a finales de los años noventa. A esa lista se suma el Parque Central, junto a Russafa.',
      'En el mapa de Nature MAPS puedes activar la capa de zonas verdes para ver el contorno de cada parque y abrir su ficha, con las especies más frecuentes y los puntos de interés que hay dentro.',
    ].join('\n\n'),
    sources: [AJUNTAMENT_GUIA, ESPACIOS_VERDES],
  },
  {
    slug: 'jardin-del-turia',
    language: 'es',
    topic: 'parques',
    greenAreaGroup: 'jardin-del-turia',
    position: 21,
    title: 'Jardín del Turia: el río que se hizo jardín',
    summary: 'El antiguo cauce del Turia, vacío tras desviar el río, es hoy el gran parque lineal que cruza València bajo dieciocho puentes.',
    body: [
      'El 14 de octubre de 1957 el Turia se desbordó e inundó València. Para que no volviera a ocurrir se aprobó la llamada Solución Sur, que llevó el río por un cauce nuevo al sur de la ciudad. El lecho histórico quedó seco, y en 1979 el Ayuntamiento aprobó definitivamente que esos terrenos fueran zona verde y parque público.',
      'El resultado es un jardín lineal de varios kilómetros, dividido en tramos, que se recorre a pie o en bicicleta sin cruzar una sola calle: los dieciocho puentes que antes salvaban el río pasan ahora por encima del parque. A lo largo del recorrido se suceden zonas arboladas, estanques, instalaciones deportivas y áreas de juego.',
      'En Nature MAPS el Jardín del Turia aparece como una sola zona verde formada por todos sus tramos, tal y como los publica el Ayuntamiento.',
    ].join('\n\n'),
    sources: [
      {
        name: 'iAgua',
        description: `«Plan Sur y Jardín del Turia»: riada de 1957, Solución Sur y aprobación de 1979 · ${CONSULTED}`,
        url: 'https://www.iagua.es/noticias/espana/aguas-valencia/15/12/16/plan-sur-y-jardin-turia-protagonistas-hechos-agua-125-anos',
      },
      AJUNTAMENT_GUIA,
      {
        name: 'Valencia Bonita',
        description: `«Jardín del Turia»: los dieciocho puentes del antiguo cauce · ${CONSULTED}`,
        url: 'https://www.valenciabonita.es/2021/06/14/jardin-del-turia/',
      },
      {
        name: 'Ajuntament de València',
        description: `Guía en línea del patrimonio histórico y artístico del Jardín del Turia · ${CONSULTED}`,
        url: 'https://www.valencia.es/es/-/gu%C3%ADa-patrimonio-jard%C3%AD-t%C3%BAria',
      },
    ],
  },
  {
    slug: 'parque-de-cabecera',
    language: 'es',
    topic: 'parques',
    greenAreaGroup: 'parque-de-cabecera',
    position: 22,
    title: 'Parque de Cabecera: un bosque de ribera',
    summary: 'Donde empezaba el río en la ciudad, un lago, un bosque de ribera y una colina mirador recrean el paisaje del Turia.',
    body: [
      'El Parque de Cabecera ocupa el lecho histórico del Turia y prolonga hacia el oeste el Jardín del Turia. El proyecto quiso recuperar el paisaje propio de los ríos mediterráneos: un bosque de ribera en el que se mezclan agua, relieve y vegetación.',
      'Según describe el Ayuntamiento, su vegetación está formada por bosques de ribera, pinares mediterráneos y árboles exóticos. El centro del parque es un lago, y desde la montaña mirador se ve todo el recinto y, a lo lejos, la Sierra Calderona. Dos recorridos principales, la Senda de la Ribera y el paseo del Molí del Sol, rodean el lago por cada orilla.',
    ].join('\n\n'),
    sources: [
      {
        name: 'Ajuntament de València',
        description: `Infociudad: Parque de Cabecera (situación, recorridos y vegetación) · ${CONSULTED}`,
        url: 'https://www.valencia.es/es/-/infociudad-parque-de-cabecera',
      },
      {
        name: 'Vía Arquitectura',
        description: `Ficha del proyecto del Parque de Cabecera: transformación en bosque de ribera · ${CONSULTED}`,
        url: 'https://via-arquitectura.net/04_prem/04p-064.htm',
      },
    ],
  },
  {
    slug: 'jardines-historicos-de-valencia',
    language: 'es',
    topic: 'jardines',
    greenAreaGroup: null,
    position: 30,
    title: 'Jardines históricos de València',
    summary: 'Viveros, Monforte, la Glorieta, el Parterre o el Botánico: jardines con siglos de historia a pocos pasos unos de otros.',
    body: [
      'Los jardines públicos de València se remontan al siglo XIX. La Glorieta surgió de un proyecto de 1813 para convertir una plaza en paseo arbolado, y el Parterre empezó a construirse hacia 1850. Los dos conservan ficus monumentales que hoy son parte de su imagen.',
      'Los Jardines del Real, conocidos como Viveros, ocupan el lugar del desaparecido Palacio Real. El Jardín de Monforte conserva su trazado neoclásico del siglo XIX. Y el Jardín Botánico de la Universitat de València, cuyo origen se remonta a un huerto de plantas medicinales de 1567, tiene pegado a su tapia el Jardín de las Hespérides, dedicado a los cítricos.',
      'Cada uno tiene su artículo en esta sección y su ficha en el mapa.',
    ].join('\n\n'),
    sources: [
      AJUNTAMENT_GUIA,
      {
        name: 'Consell Valencià de Cultura',
        description: `Informe sobre los jardines de la Glorieta y el Parterre (fechas de 1813 y 1850) · ${CONSULTED}`,
        url: 'https://cvcultura.es/archivos/256.pdf',
      },
      {
        name: 'Universitat de València',
        description: `Patrimonio cultural: Jardín Botánico (origen en 1567) · ${CONSULTED}`,
        url: 'https://www.uv.es/patrimonio-cultural/es/patrimonio-uv/edificios-singulares/jardin-botanico.html',
      },
    ],
  },
  {
    slug: 'jardines-del-real-viveros',
    language: 'es',
    topic: 'jardines',
    greenAreaGroup: 'jardines-del-real',
    position: 31,
    title: 'Jardines del Real (Viveros)',
    summary: 'El jardín que rodeaba al Palacio Real de València: del huerto de los reyes al vivero municipal y al parque de hoy.',
    body: [
      'En este lugar se alzaba el Palacio Real de València, derribado en el siglo XIX. Del palacio quedan unas pocas ruinas dentro del jardín; de sus huertos, el nombre.',
      'En 1903 el recinto fue donado al Ayuntamiento para usarlo como vivero de árboles, y de ahí viene el nombre popular de Viveros. A comienzos del siglo XX empezó su transformación en el parque público actual, que fue creciendo por partes.',
      'Hoy es uno de los jardines más extensos de la ciudad, con paseos arbolados, esculturas y portadas de edificios desaparecidos que se trasladaron aquí.',
    ].join('\n\n'),
    sources: [
      {
        name: 'Ajuntament de València',
        description: `Catálogo de bienes y espacios protegidos: Jardines del Real / Viveros · ${CONSULTED}`,
        url: 'https://inmuebles.edu.gva.es/recursos/planeamientos/4024/20/1/34.pdf',
      },
      {
        name: 'Visit València',
        description: `Jardines del Real – Jardines de Viveros (restos del Palacio Real) · ${CONSULTED}`,
        url: 'https://www.visitvalencia.com/que-hacer-valencia/naturaleza-en-valencia/parques-y-jardines/jardines-real-jardines-viveros',
      },
    ],
  },
  {
    slug: 'jardin-de-monforte',
    language: 'es',
    topic: 'jardines',
    greenAreaGroup: 'jardin-de-monforte',
    position: 32,
    title: 'Jardín de Monforte',
    summary: 'Un jardín neoclásico del siglo XIX, con estatuas de mármol, fuentes y estanques, a un paso de la Alameda.',
    body: [
      'El Jardín de Monforte nació en la segunda mitad del siglo XIX, cuando una de las huertas que había fuera de las murallas se transformó en jardín de estilo neoclásico con un palacete.',
      'Ocupa unos 12.000 metros cuadrados, con fuentes ornamentales, estanques y estatuas; entre sus esculturas destacan los leones de José Bellver.',
      'Está protegido como monumento histórico-artístico. Pasó a ser propiedad municipal y, tras su restauración, abrió al público en 1973.',
    ].join('\n\n'),
    sources: [
      {
        name: 'Visit València',
        description: `Jardín de Monforte: estilo, superficie y elementos destacados · ${CONSULTED}`,
        url: 'https://www.visitvalencia.com/que-hacer-valencia/naturaleza-en-valencia/parques-y-jardines/jardin-monforte-lhort-romero',
      },
      {
        name: 'Ajuntament de València',
        description: `Plano «Jardí de Monforte» (propiedad municipal y apertura en 1973) · ${CONSULTED}`,
        url: 'https://cultural.valencia.es/wp-content/uploads/2020/10/Planol_Jardi_de_Monforte-1.pdf',
      },
      {
        name: 'Turespaña (spain.info)',
        description: `Jardines de Monforte: origen en huertas transformadas en jardín neoclásico · ${CONSULTED}`,
        url: 'https://www.spain.info/es/lugares-interes/jardines-monforte/',
      },
    ],
  },
  {
    slug: 'jardin-de-las-hesperides',
    language: 'es',
    topic: 'jardines',
    greenAreaGroup: 'jardin-de-las-hesperides',
    position: 33,
    title: 'Jardín de las Hespérides',
    summary: 'Un jardín de colección dedicado a los cítricos, que cuenta el mito de las manzanas de oro junto a la tapia del Botánico.',
    body: [
      'El Jardín de las Hespérides es un jardín contemporáneo de poco más de cuatro mil metros cuadrados, pegado al Jardín Botánico. Es un jardín de colección: reúne variedades de cítricos y recupera así la tradición valenciana del cultivo ornamental de naranjos y limoneros.',
      'Su hilo conductor es el mito griego de las Hespérides, las ninfas que guardaban un jardín de manzanas de oro. El relato se cuenta con plantas y con tres esculturas: Hércules, la metamorfosis de las ninfas en árbol y Venus. Hileras de cipreses, a modo de muros verdes, dividen el espacio y dirigen la vista hacia la arboleda del Botánico.',
    ].join('\n\n'),
    sources: [
      {
        name: 'Vía Arquitectura',
        description: `Premio COACV: Jardín de las Hespérides (colección de cítricos, mito y esculturas) · ${CONSULTED}`,
        url: 'https://via-arquitectura.net/02_prem/02p-064.htm',
      },
      {
        name: 'Comunitat Valenciana – Turisme',
        description: `Jardín de las Hespérides: diseño basado en el mito y muros de ciprés · ${CONSULTED}`,
        url: 'https://www.comunitatvalenciana.com/es/valencia/valencia/espacios-naturales/jardin-de-las-hesperides',
      },
      ESPACIOS_VERDES,
    ],
  },
  {
    slug: 'paisajismo-en-valencia',
    language: 'es',
    topic: 'paisajismo',
    greenAreaGroup: null,
    position: 40,
    title: 'Paisajismo: cómo se ha dibujado el verde de València',
    summary: 'De la huerta que rodeaba la ciudad a los parques del antiguo cauce: dos siglos de decisiones que explican el paisaje actual.',
    body: [
      'Durante siglos el gran jardín de València fue la Huerta, que la rodeaba como un tapiz de cultivos y acequias. Los jardines públicos llegaron en el siglo XIX, con paseos arbolados como la Glorieta y jardines como el Parterre o Monforte.',
      'La riada de 1957 cambió la escala. Al desviar el río, la ciudad ganó un corredor verde continuo, el Jardín del Turia, y con él una forma nueva de entender sus parques: conectados entre sí y pensados para recorrerlos. El Parque de Cabecera, que recrea un bosque de ribera, y el Jardín de las Hespérides, que reinterpreta el antiguo cultivo ornamental de cítricos, son dos ejemplos recientes de jardines que cuentan algo del lugar donde están.',
      'El contorno de cada zona verde que ves en el mapa procede de los datos abiertos del Ayuntamiento.',
    ].join('\n\n'),
    sources: [AJUNTAMENT_GUIA, ESPACIOS_VERDES],
  },
]

export interface SeedEditorialResult { total: number, upserted: number, linked: number }

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/

export async function seedEditorial(entries: EditorialEntry[] = EDITORIAL_ARTICLES): Promise<SeedEditorialResult> {
  const groups = [...new Set(entries.map((entry) => entry.greenAreaGroup).filter((group) => group !== null))]
  const imported = Number((await db.execute<{ total: number }>(sql`select count(*)::int as total from green_areas`)).rows[0]?.total ?? 0)
  if (imported > 0) {
    for (const group of groups) {
      const found = (await db.execute(sql`select 1 from green_areas where group_slug = ${group} limit 1`)).rows.length
      if (!found) throw new Error(`El artículo enlaza la zona verde «${group}», que no existe en green_areas`)
    }
  }
  for (const entry of entries) {
    if (!SLUG.test(entry.slug)) throw new Error(`Slug no válido: ${entry.slug}`)
    if (entry.sources.length === 0) throw new Error(`El artículo «${entry.slug}» no declara fuentes`)
    await db.execute(sql`
      insert into editorial_articles (slug, language, topic, green_area_group, title, summary, body, sources, position)
      values (${entry.slug}, ${entry.language}, ${entry.topic}, ${entry.greenAreaGroup}, ${entry.title},
        ${entry.summary}, ${entry.body}, ${JSON.stringify(entry.sources)}::jsonb, ${entry.position})
      on conflict (slug, language) do update set
        topic = excluded.topic,
        green_area_group = excluded.green_area_group,
        title = excluded.title,
        summary = excluded.summary,
        body = excluded.body,
        sources = excluded.sources,
        position = excluded.position`)
  }
  return { total: entries.length, upserted: entries.length, linked: entries.filter((entry) => entry.greenAreaGroup).length }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedEditorial()
    .then((result) => {
      console.log(`Seed editorial completada: ${result.upserted} artículos insertados/actualizados `
        + `(${result.linked} enlazados a una zona verde)`)
      process.exit(0)
    })
    .catch((error: unknown) => { console.error('Seed editorial fallida:', error instanceof Error ? error.message : error); process.exit(1) })
}
