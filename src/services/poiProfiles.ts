import { eq, sql } from 'drizzle-orm'
import { db } from '../db/index.js'
import { poiProfiles, pois } from '../db/schema.js'
import { commonsImage, wikipediaArticle, wikipediaLanglinks } from './wikimedia.js'

// Contenido de la ficha del POI (NM-06): descripción por idioma e imagen con
// créditos. Los títulos de Wikipedia se eligen a mano en CURATED_POIS y se
// emparejan con el nombre exacto del geoportal; nunca se busca por parecido,
// porque una descripción de otro monumento es peor que no tener descripción.
// NM-09 sustituirá estos textos por contenido editorial propio.

export interface CuratedPoi {
  /** Nombre tal y como lo publica el geoportal (se compara sin mayúsculas). */
  sourceName: string
  /**
   * Artículo de Wikipedia, `idioma:Título` (por defecto `es`). Los demás idiomas
   * salen de los langlinks del artículo base; se usa otro idioma cuando el
   * artículo español es una desambiguación o no existe (p. ej. la Almoina).
   */
  wikipedia?: string
  /**
   * Fichero de Commons (`File:…`) para POIs sin artículo enciclopédico: se
   * guarda solo la foto con sus créditos, sin descripción. La licencia se
   * verifica igual que en el resto; si no es reutilizable, no se guarda nada.
   */
  image?: string
}

export const CURATED_POIS: CuratedPoi[] = [
  { sourceName: 'TORRES DELS SERRANS', wikipedia: 'Torres de Serranos' },
  { sourceName: 'LLOTJA', wikipedia: 'Lonja de la Seda' },
  { sourceName: 'MERCAT CENTRAL', wikipedia: 'Mercado Central de Valencia' },
  { sourceName: 'CATEDRAL', wikipedia: 'Catedral de Valencia' },
  { sourceName: 'MICALET', wikipedia: 'Miguelete' },
  { sourceName: 'PALAU DE LA GENERALITAT', wikipedia: 'Palacio de la Generalidad Valenciana' },
  { sourceName: 'ESTACIÓ DEL NORD', wikipedia: 'Estación del Norte (Valencia)' },
  { sourceName: 'MERCAT DE COLOM', wikipedia: 'Mercado de Colón' },
  { sourceName: "L'ALMOINA. CENTRE ARQUEOLÒGIC", wikipedia: "ca:Centre Arqueològic de l'Almoina" },
  { sourceName: 'TORRES DE QUART', wikipedia: 'Torres de Quart' },
  { sourceName: "PALAU MUNICIPAL DE L'EXPOSICIÓ", wikipedia: 'Palacio de la Exposición' },
  { sourceName: 'ESGLÉSIA PARROQUIAL DEL PATRIARCA SANT JOSEP', wikipedia: 'Real Colegio Seminario del Corpus Christi' },
  { sourceName: 'ESGLÉSIA DE SANT JOAN DEL MERCAT', wikipedia: 'Iglesia de los Santos Juanes (Valencia)' },
  // Fotos para POIs sin artículo: fichero de Commons con licencia verificada.
  // Propuestas con artículo de Wikipedia verificado por distancia (<80 m) y
  // título; las dudosas quedan en `plans/009-fotos-poi.md` para revisión manual.
  { sourceName: 'Basílica', wikipedia: 'Basílica de la Virgen de los Desamparados' },
  { sourceName: 'Beneficència', wikipedia: 'Centro Cultural La Beneficencia' },
  { sourceName: 'Bioparc', wikipedia: 'Bioparc Valencia' },
  { sourceName: 'Carrer dels Cavallers', wikipedia: 'ca:Carrer dels Cavallers' },
  { sourceName: 'Casa Ordeig', wikipedia: 'Casa Ordeig' },
  { sourceName: 'Casa de les Roques', wikipedia: 'ca:Casa de les Roques' },
  { sourceName: 'Centre Cultural Fundació Bancaixa', wikipedia: 'ca:Centre Cultural Bancaixa' },
  { sourceName: "Convent de L'encarnació", wikipedia: "ca:Convent de l'Encarnació de València" },
  { sourceName: 'Correos', wikipedia: 'Edificio de Correos (Valencia)' },
  { sourceName: 'Església Parroquial de Sant Martí', wikipedia: 'ca:Església de Sant Martí (València)' },
  { sourceName: 'Església Parroquial dels Sants Abdó i Senent', wikipedia: 'ca:Església de Sant Abdó i Sant Senent (València)' },
  { sourceName: 'Església de Sant Tomàs i Sant Felip Neri', wikipedia: 'ca:Església de Sant Tomàs i Sant Felip Neri' },
  { sourceName: 'Finca Roja', wikipedia: 'ca:Finca Roja' },
  { sourceName: 'Ivam', wikipedia: 'IVAM' },
  { sourceName: 'Museu Benlliure', wikipedia: 'ca:Casa Museu Benlliure' },
  { sourceName: "Museu del Col·legi de L'art Major de la Seda", wikipedia: "ca:Col·legi de l'Art Major de la Seda (València)" },
  { sourceName: 'Palau de Cervelló', wikipedia: 'ca:Palau de Cervelló' },
  { sourceName: 'Palau de Congressos', wikipedia: 'ca:Palau de Congressos de València' },
  { sourceName: "Palau de L'almirall", wikipedia: "ca:Palau de l'Almirall" },
  { sourceName: 'Palau de Pineda', wikipedia: 'ca:Palau Pineda' },
  { sourceName: 'Palau del Marqués de Campo', wikipedia: 'ca:Palau del Marqués de Campo' },
  { sourceName: 'Palau del Marqués de Dosaigües', wikipedia: 'ca:Palau del Marqués de Dosaigües' },
  { sourceName: 'Palau del Marqués de la Scala', wikipedia: 'ca:Palau del Marqués de la Scala' },
  { sourceName: "Palau dels Boïl D'arenós", wikipedia: "ca:Palau dels Boïl d'Arenós" },
  { sourceName: 'Plaça de Bous', wikipedia: 'ca:Plaça de Bous de València' },
  { sourceName: 'Plaça del Mercat', wikipedia: 'ca:Plaça del Mercat (València)' },
  { sourceName: 'Pont de la Mar', wikipedia: 'ca:Pont de la Mar' },
  { sourceName: 'Pont de la Trinitat', wikipedia: 'ca:Pont de la Trinitat' },
  { sourceName: 'Pont dels Serrans', wikipedia: 'ca:Pont dels Serrans' },
  { sourceName: 'Portal de la Valldigna', wikipedia: 'ca:Portal de la Valldigna' },
  { sourceName: '10-parroquia de Nuestra Señora del Sagrado Corazón', wikipedia: 'Iglesia de Nuestra Señora del Sagrado Corazón (Valencia)' },
  { sourceName: '11-estadio Ciudad de València', wikipedia: 'Estadio Ciudad de Valencia' },
  { sourceName: '12-parque de Orriols', wikipedia: 'Parque Municipal de Orriols' },
  { sourceName: '3-alquería Fonda', wikipedia: 'ca:Alqueria Fonda' },
  { sourceName: '7-parque Gulliver', wikipedia: 'Parque Gulliver' },
  // Revisión de la cola de `plans/009-fotos-poi.md` (NM-06): el geoportal repite
  // nombres y no todos los candidatos automáticos eran el mismo bien; aquí solo
  // entran los que retratan el POI. Los descartes y dudas están en el plan.
  // El emparejamiento sigue siendo por nombre exacto, nunca por parecido.
  { sourceName: '1-barraca la Genuina/edificios Históricos de Pinedo', image: 'Barraca Genuina, Pinedo 04.jpg' },
  { sourceName: '1-casa Museo Blasco Ibáñez', wikipedia: 'es:Casa-Museo de Blasco Ibáñez' },
  { sourceName: '1-oceanogràfic', image: "L'Oceanografic - panoramio.jpg" },
  { sourceName: '10-iglesia Nuestra Señora de Los Ángeles', image: 'Hermandades en la parroquia de Ntra Sra de los Ángeles, Valencia.jpg' },
  { sourceName: '10-parroquia Nuestra Señora de Los Ángeles', image: 'Hermandades en la parroquia de Ntra Sra de los Ángeles, Valencia.jpg' },
  { sourceName: '11-jardín Botánico', wikipedia: 'es:Jardín botánico de la Universidad de Valencia' },
  { sourceName: '13-naturia', image: 'Edificio Naturia en el cauce viejo del Turia 05.jpg' },
  { sourceName: '16-bioparc', image: 'Eingang Bioparc Valencia.jpg' },
  { sourceName: '2-monumento a Joaquín Sorolla', image: 'Monumento a Sorolla.jpg' },
  { sourceName: '2-ágora', image: '20151122 034 Valencia - Agora (23265326982).jpg' },
  { sourceName: '3-museo Semana Santa Marinera', image: 'Fachada Museo Semana Santa Marinera.jpg' },
  { sourceName: '4-alquería de Brosquil', image: 'Alquería del Brosquil 04.jpg' },
  { sourceName: '4-calle San Juan Bosco', image: 'Calle San Juan Bosco 01.jpg' },
  { sourceName: "4-l'umbracle", image: "Landscape Walk \"L'Umbracle\" - 2013.07 - panoramio.jpg" },
  { sourceName: '4-lenguas de Ferrús-borbotó', image: 'Lenguas de Ferrús-Borbotó 03.jpg' },
  { sourceName: '4-museo del Arroz', image: 'Fachada museo del arroz del ayuntamiento.jpg' },
  { sourceName: '5-hemisfèric', image: "L'Hemisfèric - panoramio.jpg" },
  { sourceName: '6-hospital de la Malva-rosa', image: 'Hospital Malva-Rosa, ciutat de València, Land of Valencia.JPG' },
  { sourceName: '6-iglesia Nuestra Señora del Rosario', wikipedia: 'es:Iglesia de Nuestra Señora del Rosario de El Cabañal' },
  { sourceName: '6-monasterio de San Miguel de Los Reyes', image: 'Interior de la cúpula de la iglesia del monasterio de San Miguel de los Reyes 01.jpg' },
  { sourceName: '6-palau de les Arts', wikipedia: 'ca:Palau de les Arts Reina Sofia' },
  { sourceName: '7-mercado del Cabanyal', image: 'Mercado municipl del Cabanyal.jpg' },
  { sourceName: '8-alquería de Albors-centro Municipal de Juventud', image: "Alquería d'Albors, Valencia 02.jpg" },
  { sourceName: '8-asilo San Juan de Dios', wikipedia: 'es:Asilo Hospital de San Juan de Dios (Valencia)' },
  { sourceName: '8-palau de la Música', wikipedia: 'ca:Palau de la Música de València' },
  { sourceName: 'Antic Monestir de Sant Miquel dels Reis', wikipedia: 'ca:Monestir de Sant Miquel dels Reis' },
  { sourceName: 'Asil de Lactància', image: 'Exterior del antiguo Asilo de Lactancia, actual Balneario de la Alameda 03.jpg' },
  { sourceName: 'Casa dels Dracs', wikipedia: 'ca:Edifici dels Dracs' },
  { sourceName: 'Casa Museu Concha Piquer', image: 'Casa-Museu Concha Piquer 03.jpg' },
  { sourceName: 'Cripta de la Presó de Sant Vicent', wikipedia: 'ca:Presó de Sant Vicent' },
  { sourceName: 'Drassanes', wikipedia: 'ca:Drassanes del Grau' },
  { sourceName: 'Edifici Alonso', wikipedia: 'ca:Edifici Alonso' },
  { sourceName: 'Edifici del Punt de Ganxo', image: 'Casa del Punt de Ganxo, València, Espanya - panoramio.jpg' },
  { sourceName: 'Edifici del Rellotge (port)', wikipedia: 'ca:Edifici del Rellotge' },
  { sourceName: 'Ermita de Santa Llúcia', image: 'Ermita de Santa Llúcia.jpg' },
  { sourceName: 'Església de la Mare de Déu del Carme (pares Carmelites)', image: 'Esglesia de la Mare de Déu del Carme.jpg' },
  { sourceName: "Església de les Escoles de L'ave Maria (benimàmet)", image: "Benimàmet, església de l'Ave Maria i sant Josep.JPG" },
  { sourceName: "Església de Sant Joan de L'hospital", wikipedia: "ca:Església de Sant Joan de l'Hospital" },
  { sourceName: 'Església de Sant Joan de la Creu', wikipedia: 'ca:Església de Sant Joan de la Creu (València)' },
  { sourceName: 'Església de Santa Caterina', image: '046 Església de Santa Caterina (València), pl. Lope de Vega.JPG' },
  { sourceName: 'Església del Sagrat Cor de Jesús (patraix)', image: 'Sacred Heart of Jesus Parish in Valencia Patraix.jpg' },
  { sourceName: 'Església Parroquial de la Mare de Déu de la Misericòrdia (campanar)', wikipedia: 'ca:Església de la Nostra Senyora de la Misericòrdia (Campanar)' },
  { sourceName: 'Església Parroquial de Sant Agustí', wikipedia: 'ca:Església de Sant Agustí (València)' },
  { sourceName: 'Església Parroquial de Sant Antoni Abad', image: 'Iglesia Parroquial de San Antonio Abad.JPG' },
  { sourceName: 'Església Parroquial de Sant Bernat Màrtir (poble Nou)', image: 'Poble Nou. Església de Sant Bernat. Porta.jpg' },
  { sourceName: 'Església Parroquial de Sant Esteve', wikipedia: 'ca:Església de Sant Esteve (València)' },
  { sourceName: 'Església Parroquial de Sant Roc de Benicalap', image: "Campanar de l'església de sant Roc, Benicalap.JPG" },
  { sourceName: 'Església Parroquial de Santa Anna (borbotó)', image: 'Borbotó. Església. Imatge.JPG' },
  { sourceName: 'Fàbrica de Tabac', image: 'Fabrica de Tabacos - panoramio.jpg' },
  { sourceName: 'Galeria del Tossal', image: 'Валенсия. Площадь на холме (Plaza del Tossal) - panoramio.jpg' },
  { sourceName: 'Jardí Botànic', wikipedia: 'ca:Jardí Botànic de València' },
  { sourceName: "L'almodí", wikipedia: 'ca:Almodí de València' },
  { sourceName: "Mercat D'abastos", image: 'Valencia - Mercado de Abastos 2026-09-13.jpg' },
  { sourceName: "Monument a L'arquebisbe Olaechea", image: 'Monument a Marcelino Olaechea.jpg' },
  { sourceName: 'Museu Faller', image: 'Ninot indultat en el Museu faller.jpg' },
  { sourceName: 'Museu Sant Pius V', wikipedia: 'ca:Col·legi de Sant Pius V' },
  { sourceName: 'Palau de Benicarló', image: '035 Palau dels Borja o de Benicarló, seu de les Corts, pl. Sant Llorenç 4 (València).jpg' },
  { sourceName: 'Palau de la Marquesa de Colomina', image: 'Palacio de Colomina (Universidad CEU) - panoramio.jpg' },
  { sourceName: 'Palau de la Música', wikipedia: 'ca:Palau de la Música de València' },
  { sourceName: 'Palau dels Pescara', image: 'Palacio de los Pescara 04.JPG' },
  { sourceName: 'Palau i Església del Temple', image: 'Església i Palau del Temple.jpg' },
  { sourceName: 'Plaça Redona', wikipedia: 'ca:Plaça Redona' },
  { sourceName: "Pont de L'exposició", image: "Puente de calatrava, Pont de l'Exposició.jpg" },
  { sourceName: "Port Copa de L'amèrica", image: "Port America's Cup (4346109631).jpg" },
  { sourceName: 'Porta dels Jueus', image: 'Portal dels Jueus, València, 04 2025.jpg' },
  { sourceName: 'Presó de Sant Vicent Màrtir', wikipedia: 'ca:Presó de Sant Vicent' },
  { sourceName: 'Reial Col·legi del Corpus Christi (patriarca)', wikipedia: 'ca:Reial Col·legi Seminari de Corpus Christi' },
  { sourceName: 'Reial Convent de Sant Doménec', wikipedia: 'ca:Convent de Sant Doménec (València)' },
  { sourceName: 'Reial Monestir de la Trinitat', wikipedia: 'ca:Monestir de la Trinitat' },
  { sourceName: 'Teatre Principal', image: 'Teatre Principal (Valencia), 04 2025 2.jpg' },
  { sourceName: 'Universitat de València', wikipedia: 'ca:La Nau (Universitat de València)' },
  // Tercer lote (2026-11-10): artículos con título equivalente al del geoportal y
  // coordenadas del artículo a menos de 150 m del POI. Ver `plans/009-fotos-poi.md`.
  { sourceName: 'Palau dels Martínez de Raga', wikipedia: 'ca:Palau de Raga' },
  {
    sourceName: 'Casa Natalícia de Sant Vicent Ferrer - el Pouet',
    wikipedia: 'ca:Casa natal de Sant Vicent Ferrer',
  },
  { sourceName: 'Port de València', wikipedia: 'ca:Port de València' },
  {
    sourceName: 'Reial Església del Santíssim Crist del Salvador o Església del Salvador',
    wikipedia: 'ca:Església del Salvador (València)',
  },
  { sourceName: 'Torre de la Posada de L\'àngel o Torre de L\'àngel', wikipedia: 'Torre del Ángel (Valencia)' },
  { sourceName: 'Palau de la Batlia o Palau dels Jàudenes', wikipedia: 'ca:Palau de la Batlia' },
  { sourceName: 'Palau del Marqués de Castellfort', wikipedia: 'ca:Palau de Castellfort' },
  {
    sourceName: 'Monestir de Santa Clara - Clarisses Caputxines',
    wikipedia: 'ca:Convent de Santa Clara (València)',
  },
  { sourceName: 'Museu de la Setmana Santa Marinera', wikipedia: 'ca:Museu de la Setmana Santa Marinera' },
  { sourceName: 'Palau Arquebisbal', wikipedia: 'ca:Palau Arquebisbal de València' },
  { sourceName: 'Edifici D\'habitatges - Casa Ferrer', wikipedia: 'ca:Edifici Ferrer' },
  {
    sourceName: 'Monuments de la Plaça de la Mare de Déu dels Desemparats',
    wikipedia: 'ca:Plaça de la Mare de Déu',
  },
  {
    sourceName: 'Església de Sant Vicent de la Roqueta (actual Església Parroquial de Crist Rei)',
    wikipedia: 'ca:Església de Sant Vicent de la Roqueta',
  },
  { sourceName: 'Convent de Santa Úrsula', wikipedia: 'Convento de Santa Úrsula (Valencia)' },
  { sourceName: 'Casa Consistorial i Entorn Urbanístic - i', wikipedia: 'Casa consistorial de Valencia' },
  { sourceName: 'Casa Consistorial i Entorn Urbanístic - Ii', wikipedia: 'ca:Palau consistorial de València' },
  { sourceName: 'Estació del Trenet - Estació del Pont de Fusta', wikipedia: 'ca:Estació del Pont de Fusta' },
  { sourceName: 'Asil de Sant Joan de Déu', wikipedia: 'ca:Asil Hospital Sant Joan de Déu' },
  {
    sourceName: 'Rectorat de la Universitat de València (antiga Facultat de Ciències)',
    wikipedia: 'ca:Edifici del Rectorat (València)',
  },
  { sourceName: 'Parc de Capçalera', wikipedia: 'ca:Parc de Capçalera' },
  { sourceName: 'Casa Museu Blasco Ibáñez', wikipedia: 'Casa-Museo de Blasco Ibáñez' },
  { sourceName: 'Palau de Justícia', wikipedia: 'Palacio de Justicia (Valencia)' },
  { sourceName: 'Antic Hospital General', wikipedia: 'ca:Antic Hospital de València' },
  { sourceName: 'Església Parroquial de Sant Nicolau', wikipedia: 'ca:Església de Sant Nicolau (València)' },
  { sourceName: 'Col·legi de les Escoles Pies', wikipedia: 'ca:Església de les Escoles Pies de València' },
  { sourceName: 'Saló de Racionistes', wikipedia: 'ca:Saló de Racionistes' },
  { sourceName: 'Museu D\'història de València', wikipedia: 'Museo de historia de Valencia' },
  { sourceName: 'Ciutat de les Arts i les Ciències', wikipedia: 'ca:Ciutat de les Arts i les Ciències' },
  { sourceName: '13-palacio de Congresos', wikipedia: 'Palacio de Congresos de Valencia' },
  { sourceName: '2-ermita Mare de Déu del Pilar', wikipedia: 'ca:Ermita del Pilar de les Cases de Bàrcena' },
  { sourceName: '3-museo de Las Ciencias', wikipedia: 'Museo de las Ciencias Príncipe Felipe' },
  { sourceName: '10-museo de Bellas Artes', wikipedia: 'Museo de Bellas Artes de Valencia' },
  { sourceName: '7-velódromo Lluís Puig', wikipedia: 'Palacio Velódromo Luis Puig' },
]

/** Idiomas del contenido curado: los de la app (`va` se sirve como `ca`). */
export const PROFILE_LANGUAGES = ['es', 'ca', 'en']

export interface PoiProfileSeedSummary {
  total: number
  matched: number
  profiles: number
  images: number
  missing: string[]
  failed: string[]
}

/**
 * Ids con ese nombre exacto. El geoportal repite 8 denominaciones con
 * `externalId` distinto (dos bienes reales con el mismo nombre), así que se
 * devuelven todos: sembrar solo el primero dejaría al otro sin ficha ni foto.
 */
async function poiIdsBySourceName(sourceName: string): Promise<number[]> {
  const result = await db.execute<{ id: number }>(sql`
    select id from pois where lower(trim(name)) = lower(trim(${sourceName})) order by id`)
  return result.rows.map((row) => row.id)
}

/** Página de Commons del fichero, para que los créditos tengan a dónde apuntar. */
function imagePageUrl(file: string): string {
  const name = file.startsWith('File:') ? file.slice('File:'.length) : file
  return `https://commons.wikimedia.org/wiki/File:${encodeURIComponent(name.replace(/ /g, '_'))}`
}

export interface DryRunRow {
  sourceName: string
  /** Si el nombre exacto existe ya en `pois` (nunca se empareja por parecido). */
  found: boolean
  /** Artículo de Wikipedia propuesto, o `—` si la entrada es solo fotografía. */
  wikipedia: string
  /** Idiomas que ya tienen perfil sembrado para ese POI. */
  languages: string[]
}

/** Fila del informe de `--dry-run`; pura para poder probarla sin base ni red. */
export function formatDryRun(rows: DryRunRow[]): string {
  const header = ['sourceName', '¿encontrado?', 'wikipedia', 'idiomas ya sembrados']
  const cells = rows.map((row) => [
    row.sourceName,
    row.found ? 'sí' : 'no',
    row.wikipedia,
    row.languages.length > 0 ? row.languages.join(', ') : '—',
  ])
  const widths = header.map((title, column) => Math.max(title.length, ...cells.map((row) => (row[column] ?? '').length)))
  const line = (values: string[]) => values.map((value, column) => value.padEnd(widths[column] ?? 0)).join(' | ')
  const found = rows.filter((row) => row.found).length
  return [line(header), widths.map((width) => '-'.repeat(width)).join('-+-'), ...cells.map(line),
    '', `Encontrados: ${found}/${rows.length}`].join('\n')
}

/**
 * Comprobación de la lista curada sin descargar nada ni escribir: solo mira qué
 * nombres emparejan con el catálogo y qué idiomas tienen ya perfil.
 */
export async function dryRunCuratedPois(curated: CuratedPoi[] = CURATED_POIS): Promise<DryRunRow[]> {
  const rows: DryRunRow[] = []
  for (const entry of curated) {
    const poiIds = await poiIdsBySourceName(entry.sourceName)
    const languages = new Set<string>()
    for (const poiId of poiIds) {
      const seeded = await db.execute<{ language: string }>(sql`
        select language from poi_profiles where poi_id = ${poiId} order by language`)
      for (const row of seeded.rows) languages.add(row.language)
    }
    rows.push({
      sourceName: entry.sourceName, found: poiIds.length > 0, wikipedia: entry.wikipedia ?? '—',
      languages: [...languages].sort(),
    })
  }
  return rows
}

async function storeProfile(poiId: number, article: NonNullable<Awaited<ReturnType<typeof wikipediaArticle>>>) {
  const values = {
    poiId,
    language: article.language,
    description: article.extract,
    source: 'WIKIPEDIA',
    sourceUrl: article.url,
    license: article.license,
    licenseUrl: article.licenseUrl,
  }
  await db.insert(poiProfiles).values(values).onConflictDoUpdate({
    target: [poiProfiles.poiId, poiProfiles.language],
    set: {
      description: values.description,
      sourceUrl: values.sourceUrl,
      license: values.license,
      licenseUrl: values.licenseUrl,
    },
  })
}

/**
 * Siembra idempotente: busca el POI importado, descarga el artículo en `es` y sus
 * versiones `ca`/`en`, guarda un perfil por idioma y, si la licencia de la imagen
 * se puede verificar, la deja como foto del POI con sus créditos.
 */
export async function seedPoiProfiles(curated: CuratedPoi[] = CURATED_POIS): Promise<PoiProfileSeedSummary> {
  const summary: PoiProfileSeedSummary = {
    total: curated.length, matched: 0, profiles: 0, images: 0, missing: [], failed: [],
  }
  for (const entry of curated) {
    const poiIds = await poiIdsBySourceName(entry.sourceName)
    if (poiIds.length === 0) {
      summary.missing.push(entry.sourceName)
      continue
    }
    summary.matched++
    if (!entry.wikipedia) {
      // Sin artículo: la foto de Commons es todo el contenido curado del POI.
      if (!entry.image) {
        summary.failed.push(entry.sourceName)
        continue
      }
      try {
        const image = await commonsImage(entry.image, imagePageUrl(entry.image))
        if (!image?.licenseVerified) {
          summary.failed.push(entry.sourceName)
          continue
        }
        for (const poiId of poiIds) {
          await db.update(pois).set({
            imageUrl: image.url,
            imageSourceUrl: image.sourceUrl,
            imageAuthor: image.author,
            imageLicense: image.license,
            imageLicenseUrl: image.licenseUrl,
            imageAttribution: image.attribution,
            enrichedAt: new Date(),
          }).where(eq(pois.id, poiId))
          summary.images++
        }
      } catch {
        summary.failed.push(entry.sourceName)
      }
      continue
    }
    try {
      const separator = entry.wikipedia.indexOf(':')
      const baseLanguage = separator === -1 ? 'es' : entry.wikipedia.slice(0, separator)
      const baseTitle = separator === -1 ? entry.wikipedia : entry.wikipedia.slice(separator + 1)
      const main = await wikipediaArticle(baseLanguage, baseTitle)
      if (!main) {
        summary.missing.push(entry.wikipedia)
        continue
      }
      const otherLanguages = PROFILE_LANGUAGES.filter((language) => language !== baseLanguage)
      const langlinks = await wikipediaLanglinks(baseLanguage, baseTitle, otherLanguages)
      const articles = [main]
      for (const language of otherLanguages) {
        const title = langlinks[language]
        if (!title) continue
        const article = await wikipediaArticle(language, title)
        if (article) articles.push(article)
      }
      const image = articles.map((article) => article.image).find((candidate) => candidate?.licenseVerified)
      for (const poiId of poiIds) {
        for (const article of articles) {
          await storeProfile(poiId, article)
          summary.profiles++
        }
        if (image) {
          await db.update(pois).set({
            imageUrl: image.url,
            imageSourceUrl: image.sourceUrl,
            imageAuthor: image.author,
            imageLicense: image.license,
            imageLicenseUrl: image.licenseUrl,
            imageAttribution: image.attribution,
            wikipediaUrl: main.url,
            enrichedAt: new Date(),
          }).where(eq(pois.id, poiId))
          summary.images++
        } else {
          await db.update(pois).set({ wikipediaUrl: main.url, enrichedAt: new Date() })
            .where(eq(pois.id, poiId))
        }
      }
    } catch {
      summary.failed.push(entry.sourceName)
    }
  }
  return summary
}
