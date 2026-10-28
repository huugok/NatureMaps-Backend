// Seed idempotente del contenido editorial de la ficha (UT 918 - F06).
//
// El contenido procede de la demo del frontend (`src/pages/FichaPlanta/constants.ts`,
// trazabilidad por especie en `docs/contenido-especies-demo.md` del repo hermano):
// descripciones y curiosidades de Wikipedia en español (CC BY-SA), familias de
// Wikipedia/Wikidata y recuentos del Inventario de Arbolado del Ajuntament de
// València, consultados el 25/10/2026.
//
// Por qué una seed y no una migración: los textos editoriales cambian a menudo
// (correcciones, nuevos idiomas) y no deben generar migraciones; la estructura
// vive en `drizzle/0001_*.sql`, el contenido vive aquí.
//
// Por qué es idempotente: puede ejecutarse cualquier número de veces (y en
// cualquier entorno) dejando la base idéntica a una sola ejecución:
//   1) La especie se busca por nombre científico; si ya existe (p. ej. traída
//      por el import municipal con `source='VALENCIA_ARBOLADO'`) se le ADJUNTA
//      el perfil en lugar de crear un taxón duplicado; solo se crea la fila
//      `species` (con `source='NATUREMAPS'`) si no existe ninguna con ese nombre.
//   2) El perfil se inserta con upsert sobre su clave natural
//      `(species_id, language)`: la primera vez inserta, las siguientes
//      ACTUALIZAN el texto (así corregir un texto es editar aquí y volver a
//      ejecutar `npm run db:seed`, y añadir `va`/`en` con UT44 no tocará el `es`).
//
// Esta seed solo escribe texto editorial: nunca toca `plant_locations`,
// `plant_names` ni `species_enrichments` (la foto sigue llegando del
// enriquecimiento de Wikipedia, con sus créditos verificados).
import { sql } from 'drizzle-orm'
import { pathToFileURL } from 'node:url'
import { db } from './index.js'

interface EditorialSource { name: string, description: string, url: string }
interface EditorialSpecies {
  scientificName: string
  description: string
  family: string
  flowering: string | null
  curiosity: string
  sources: EditorialSource[]
}

const WIKIPEDIA_SOURCE = (title: string): EditorialSource => ({
  name: 'Wikipedia (es)',
  description: 'Descripción y datos botánicos (CC BY-SA) · Consulta 25/10/2026',
  url: `https://es.wikipedia.org/wiki/${title}`,
})
const AJUNTAMENT_SOURCE = (specimens: string): EditorialSource => ({
  name: 'Ajuntament de València',
  description: `Inventario de arbolado municipal · ${specimens} ejemplares · Consulta 25/10/2026`,
  url: 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151/query',
})

const EDITORIAL_SPECIES: EditorialSpecies[] = [
  {
    scientificName: 'Jacaranda mimosifolia',
    family: 'Bignoniaceae',
    flowering: 'primavera',
    description:
      'Árbol subtropical oriundo de Sudamérica —de forma nativa crece en Argentina, Brasil, Bolivia y Paraguay—, de la familia de las bignonias. El ejemplar adulto alcanza los 12–15 metros (hasta 20 en condiciones favorables) y proyecta una copa irregular, a veces en forma de sombrilla, de 10–12 metros de diámetro y sombra de intensidad media. Se cultiva por sus vistosas flores de color azul violeta, de 4–5 cm, agrupadas en panículas erectas de 20–30 cm, que llenan por completo la copa en primavera antes de que salgan las hojas; en algún ejemplar se repite después una segunda floración, más escasa, en pleno verano.',
    curiosity:
      'su fruto es una cápsula leñosa en forma de castañuela; en guaraní se llama ka-í jepopeté, algo así como «aplauso de mono».',
    sources: [
      WIKIPEDIA_SOURCE('Jacaranda_mimosifolia'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Jacaranda1212.jpg" de Kahuroa · dominio público · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Jacaranda1212.jpg',
      },
      AJUNTAMENT_SOURCE('5.253'),
    ],
  },
  {
    scientificName: 'Citrus × aurantium',
    family: 'Rutaceae',
    flowering: null,
    description:
      'Árbol cítrico perennifolio de la familia de las rutáceas, de 7–8 metros de altura y con espinas axilares agudas. Es un híbrido entre el pomelo (Citrus maxima) y la mandarina (Citrus reticulata) que surgió en el sudeste asiático y, vía India y Persia, se expandió con el mundo árabe desde el año 700, llegando a la península ibérica durante la expansión musulmana. Muchas variedades se usan por su aceite esencial para perfumes, saborizantes y como medicina; de sus flores sale el azahar, y su fruta amarga es la conocida naranja de Sevilla, naranja cajera o naranja cachorreña.',
    curiosity:
      'es el portainjerto preferido de los cítricos comerciales, y su naranja amarga, con más pectina que la dulce, es la de la célebre mermelada de Sevilla que se envía a Inglaterra.',
    sources: [
      WIKIPEDIA_SOURCE('Citrus_%C3%97_aurantium'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Bitter orange - Citrus × aurantium 03.jpg" de Zeynel Cebeci · CC BY-SA 4.0 · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Bitter_orange_-_Citrus_%C3%97_aurantium_03.jpg',
      },
      AJUNTAMENT_SOURCE('12.661'),
    ],
  },
  {
    scientificName: 'Phoenix dactylifera',
    family: 'Arecaceae',
    flowering: null,
    description:
      'Palmera cuyo fruto comestible es el dátil, probablemente oriunda del suroeste de Asia. Es una de las especies más notables del género Phoenix, que cuenta con unas quince especies repartidas desde Canarias, pasando por el norte de África y el sur de Asia, hasta el Extremo Oriente. Se usa comercialmente para el aprovechamiento de sus frutos y también como ornamental en zonas cálidas costeras, como elemento aislado, en hileras o en grupos formando palmerales; en España sus hojas, llamadas palmas, se utilizan en la celebración del Domingo de Ramos, y de sus vainas sale una fibra apreciada para cuerda y tela gruesa.',
    curiosity:
      'sus hojas, llamadas palmas, son las del Domingo de Ramos en España, y en Elche llegó a existir la mayor producción de dátil in vitro del mundo.',
    sources: [
      WIKIPEDIA_SOURCE('Phoenix_dactylifera'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Phoenix dactylifera Daktylowiec właściwy 2023-02-24 09.jpg" de Agnieszka Kwiecień, Nova · CC BY-SA 4.0 · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Phoenix_dactylifera_Daktylowiec_w%C5%82a%C5%9Bciwy_2023-02-24_09.jpg',
      },
      AJUNTAMENT_SOURCE('7.565'),
    ],
  },
  {
    scientificName: 'Ficus microcarpa',
    family: 'Moraceae',
    flowering: null,
    description:
      'Árbol perenne de gran porte y rápido crecimiento que llega a superar los 15 metros de altura, muy ramificado y con copa voluminosa. Emite raíces aéreas que, al tocar el suelo, enraízan, engrosan y terminan uniéndose al tronco. Nativo del sur y sureste de Asia, este ficus —llamado comúnmente laurel de Indias— se utiliza como árbol de sombra en las calles de muchas localidades de climas cálidos y subtropicales; en España se encuentra desde la costa de Cádiz hasta la de Valencia, además de en las Islas Baleares y Canarias, y también se cultiva como planta ornamental de interior y como bonsái.',
    curiosity:
      'enraíza con tanta facilidad que los ejemplares jóvenes pueden llegar a crecer sobre muros, puentes y edificios de hormigón; en muchas regiones se le considera especie invasiva.',
    sources: [
      WIKIPEDIA_SOURCE('Ficus_microcarpa'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Ficus microcarpa - La Gomera 02.jpg" de H. Zell · CC BY-SA 3.0 · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Ficus_microcarpa_-_La_Gomera_02.jpg',
      },
      AJUNTAMENT_SOURCE('3.157'),
    ],
  },
  {
    scientificName: 'Platanus × hispanica',
    family: 'Platanaceae',
    flowering: null,
    description:
      'Árbol de imponente porte —alcanza hasta los 55 metros de alto—, perteneciente a la familia de las platanáceas y de muy larga vida: puede vivir hasta 500 años. Por lo general se considera un híbrido de Platanus orientalis y Platanus occidentalis, aunque hay expertos que opinan que puede tratarse de un cultivar de P. orientalis, y su origen exacto no está claro. Es común en los parques y jardines de todas las ciudades de las zonas templadas del mundo por la agradable sombra que proporciona; antes de la aparición del automóvil se usaba profusamente en las cunetas de las carreteras para dar sombra a carros, carruajes y diligencias durante los duros veranos mediterráneos. A la hora de plantarlo hay que tener en cuenta su problemática alergénica.',
    curiosity:
      'antes del automóvil se plantaba en las cunetas de las carreteras para dar sombra a carros y diligencias durante los duros veranos mediterráneos, y puede llegar a vivir unos 500 años.',
    sources: [
      WIKIPEDIA_SOURCE('Platanus_%C3%97_hispanica'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Platanus.JPG" de Tiago Fioreze · CC BY-SA 3.0 · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Platanus.JPG',
      },
      AJUNTAMENT_SOURCE('9.947'),
    ],
  },
  {
    scientificName: 'Tipuana tipu',
    family: 'Fabaceae',
    flowering: 'jul-ago',
    description:
      'Árbol semicaducifolio de la familia de las leguminosas (Fabaceae), la única especie aceptada del género Tipuana y originaria de Argentina y Bolivia. Resiste la sequía sin llegar a perder las hojas, y en las zonas urbanas es frecuente en calles anchas, avenidas, paseos y jardines por su magnífica floración amarilla y su muy buena sombra; en el hemisferio norte florece alrededor de julio y agosto. Sus raíces, robustas y extensas, hacen que no se aconseje plantarlo cerca de edificaciones, y su madera se ha empleado para fabricar muebles, puertas y escaleras.',
    curiosity:
      'sus raíces son tan robustas y extensas que se desaconseja plantarlo junto a edificaciones; en Argentina las ninfas de un insecto hacen que las tipas «lloren» gotas azucaradas.',
    sources: [
      WIKIPEDIA_SOURCE('Tipuana_tipu'),
      {
        name: 'Wikimedia Commons',
        description: 'Fotografía: "Tipuana tipu kedumim 2.JPG" de Daniel Ventura · CC BY-SA 3.0 · Consulta 25/10/2026',
        url: 'https://commons.wikimedia.org/wiki/File:Tipuana_tipu_kedumim_2.JPG',
      },
      AJUNTAMENT_SOURCE('2.955'),
    ],
  },
]

export interface SeedProfilesResult { total: number, speciesCreated: number, profilesUpserted: number }

async function resolveSpeciesId(scientificName: string): Promise<{ id: number, created: boolean }> {
  const existing = await db.execute<{ id: number }>(
    sql`select id from species where lower(scientific_name) = lower(${scientificName}) order by id limit 1`)
  const found = existing.rows[0]
  if (found !== undefined) return { id: found.id, created: false }
  // Attach to any source's row by name; only create our own row when absent.
  const inserted = await db.execute<{ id: number }>(
    sql`insert into species (scientific_name, source) values (${scientificName}, 'NATUREMAPS')
      on conflict (source, scientific_name) do nothing returning id`)
  const created = inserted.rows[0]
  if (created !== undefined) return { id: created.id, created: true }
  const raced = await db.execute<{ id: number }>(
    sql`select id from species where lower(scientific_name) = lower(${scientificName}) order by id limit 1`)
  const racedRow = raced.rows[0]
  if (racedRow === undefined) throw new Error(`No se pudo resolver la especie ${scientificName}`)
  return { id: racedRow.id, created: false }
}

export async function seedProfiles(): Promise<SeedProfilesResult> {
  let speciesCreated = 0
  for (const entry of EDITORIAL_SPECIES) {
    const species = await resolveSpeciesId(entry.scientificName)
    if (species.created) speciesCreated++
    await db.execute(sql`
      insert into species_profiles (species_id, language, description, family, flowering, curiosity, sources)
      values (${species.id}, 'es', ${entry.description}, ${entry.family}, ${entry.flowering},
        ${entry.curiosity}, ${JSON.stringify(entry.sources)}::jsonb)
      on conflict (species_id, language) do update set
        description = excluded.description,
        family = excluded.family,
        flowering = excluded.flowering,
        curiosity = excluded.curiosity,
        sources = excluded.sources`)
  }
  return { total: EDITORIAL_SPECIES.length, speciesCreated, profilesUpserted: EDITORIAL_SPECIES.length }
}

if (import.meta.url === pathToFileURL(process.argv[1] ?? '').href) {
  seedProfiles()
    .then((result) => {
      console.log(`Seed completada: ${result.total} perfiles es (${result.speciesCreated} especies creadas, `
        + `${result.profilesUpserted} perfiles insertados/actualizados)`)
      process.exit(0)
    })
    .catch((error: unknown) => { console.error('Seed fallida:', error); process.exit(1) })
}
