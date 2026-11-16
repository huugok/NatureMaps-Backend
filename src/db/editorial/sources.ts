// Fuentes del contenido editorial de flora y zonas verdes (NM-08).
//
// Una fuente se declara una sola vez, con su nombre y su URL comunes y la
// descripción en los tres idiomas: así una traducción no puede quedarse con
// una URL distinta de la del español, que es el riesgo real cuando cada
// idioma lleva su propia copia de las fuentes (RNF6, trazabilidad).

import type { EditorialSource } from '../../services/editorialCatalog.js'

/** Idiomas en los que existe el contenido editorial. `ca` es el valenciano. */
export const EDITORIAL_LANGUAGES = ['es', 'ca', 'en'] as const
export type EditorialLanguage = typeof EDITORIAL_LANGUAGES[number]

export type Localized = Record<EditorialLanguage, string>

export interface SourceDefinition {
  name: string
  url: string
  description: Localized
}

/** Fecha de consulta de todas las fuentes; se añade al final de cada descripción. */
const CONSULTED: Localized = {
  es: 'Consulta 12/11/2026',
  ca: 'Consulta 12/11/2026',
  en: 'Retrieved 12/11/2026',
}

export function sourceFor(definition: SourceDefinition, language: EditorialLanguage): EditorialSource {
  return {
    name: definition.name,
    description: `${definition.description[language]} · ${CONSULTED[language]}`,
    url: definition.url,
  }
}

export const AJUNTAMENT_GUIA: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://www.valencia.es/documents/20142/180607/guiaPARQUES_02.pdf/950a849f-c161-7e60-7d71-7d71edfca459',
  description: {
    es: 'Guía de jardines históricos y parques urbanos de la ciudad de Valencia',
    ca: 'Guia de jardins històrics i parcs urbans de la ciutat de València',
    en: 'Guide to the historic gardens and urban parks of the city of València',
  },
}

export const ESPACIOS_VERDES: SourceDefinition = {
  name: 'Ajuntament de València – Dades Obertes',
  url: 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/8',
  description: {
    es: 'Capa «Espais Verds / Espacios Verdes» del Geoportal (CC BY 4.0)',
    ca: 'Capa «Espais Verds / Espacios Verdes» del Geoportal (CC BY 4.0)',
    en: '“Espais Verds / Espacios Verdes” layer of the city Geoportal (CC BY 4.0)',
  },
}

export const INVENTARIO_ARBOLADO: SourceDefinition = {
  name: 'Ajuntament de València – Dades Obertes',
  url: 'https://geoportal.valencia.es/server/rest/services/OPENDATA/MedioAmbiente/MapServer/151',
  description: {
    es: 'Inventario de arbolado municipal (CC BY 4.0): total de ejemplares y recuento por especie',
    ca: 'Inventari d’arbratge municipal (CC BY 4.0): total d’exemplars i recompte per espècie',
    en: 'Municipal tree inventory (CC BY 4.0): total specimens and counts by species',
  },
}

export const FICUS_MONUMENTALES: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://www.valencia.es/cas/actualidad/-/content/conservaci%C3%B3n-higueras-australianas',
  description: {
    es: 'Nota sobre la conservación de las higueras australianas monumentales del Parterre, la Glorieta y la Alameda',
    ca: 'Nota sobre la conservació de les figueres australianes monumentals del Parterre, la Glorieta i l’Albereda',
    en: 'Note on the conservation of the monumental Moreton Bay figs of the Parterre, the Glorieta and the Alameda',
  },
}

export const IAGUA_TURIA: SourceDefinition = {
  name: 'iAgua',
  url: 'https://www.iagua.es/noticias/espana/aguas-valencia/15/12/16/plan-sur-y-jardin-turia-protagonistas-hechos-agua-125-anos',
  description: {
    es: '«Plan Sur y Jardín del Turia»: riada de 1957, Solución Sur y aprobación de 1979',
    ca: '«Plan Sur y Jardín del Turia»: riuada de 1957, Solució Sud i aprovació de 1979',
    en: '“Plan Sur y Jardín del Turia”: the 1957 flood, the Southern Plan and the 1979 decision',
  },
}

export const VALENCIA_BONITA_TURIA: SourceDefinition = {
  name: 'Valencia Bonita',
  url: 'https://www.valenciabonita.es/2021/06/14/jardin-del-turia/',
  description: {
    es: '«Jardín del Turia»: los dieciocho puentes del antiguo cauce',
    ca: '«Jardín del Turia»: els díhuit ponts de l’antic llit',
    en: '“Jardín del Turia”: the eighteen bridges over the old riverbed',
  },
}

export const GUIA_PATRIMONIO_TURIA: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://www.valencia.es/es/-/gu%C3%ADa-patrimonio-jard%C3%AD-t%C3%BAria',
  description: {
    es: 'Guía en línea del patrimonio histórico y artístico del Jardín del Turia',
    ca: 'Guia en línia del patrimoni històric i artístic del Jardí del Túria',
    en: 'Online guide to the historic and artistic heritage of the Turia Garden',
  },
}

export const INFOCIUDAD_CABECERA: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://www.valencia.es/es/-/infociudad-parque-de-cabecera',
  description: {
    es: 'Infociudad: Parque de Cabecera (situación, recorridos y vegetación)',
    ca: 'Infociutat: Parc de Capçalera (situació, recorreguts i vegetació)',
    en: 'Infociudad: Cabecera Park (location, trails and vegetation)',
  },
}

export const VIA_CABECERA: SourceDefinition = {
  name: 'Vía Arquitectura',
  url: 'https://via-arquitectura.net/04_prem/04p-064.htm',
  description: {
    es: 'Ficha del proyecto del Parque de Cabecera: transformación en bosque de ribera',
    ca: 'Fitxa del projecte del Parc de Capçalera: transformació en bosc de ribera',
    en: 'Project record for Cabecera Park: its transformation into a riverside woodland',
  },
}

export const CVC_GLORIETA: SourceDefinition = {
  name: 'Consell Valencià de Cultura',
  url: 'https://cvcultura.es/archivos/256.pdf',
  description: {
    es: 'Informe sobre los jardines de la Glorieta y el Parterre (fechas de 1813 y 1850)',
    ca: 'Informe sobre els jardins de la Glorieta i el Parterre (dates de 1813 i 1850)',
    en: 'Report on the Glorieta and Parterre gardens (the 1813 and 1850 dates)',
  },
}

export const UV_BOTANIC: SourceDefinition = {
  name: 'Universitat de València',
  url: 'https://www.uv.es/patrimonio-cultural/es/patrimonio-uv/edificios-singulares/jardin-botanico.html',
  description: {
    es: 'Patrimonio cultural: Jardín Botánico (origen en 1567)',
    ca: 'Patrimoni cultural: Jardí Botànic (origen en 1567)',
    en: 'Cultural heritage: the Botanical Garden (originating in 1567)',
  },
}

export const CATALOGO_VIVEROS: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://inmuebles.edu.gva.es/recursos/planeamientos/4024/20/1/34.pdf',
  description: {
    es: 'Catálogo de bienes y espacios protegidos: Jardines del Real / Viveros',
    ca: 'Catàleg de béns i espais protegits: Jardins del Real / Vivers',
    en: 'Catalogue of protected buildings and spaces: Jardines del Real / Viveros',
  },
}

export const VISIT_VIVEROS: SourceDefinition = {
  name: 'Visit València',
  url: 'https://www.visitvalencia.com/que-hacer-valencia/naturaleza-en-valencia/parques-y-jardines/jardines-real-jardines-viveros',
  description: {
    es: 'Jardines del Real – Jardines de Viveros (restos del Palacio Real)',
    ca: 'Jardins del Real – Jardins de Vivers (restes del Palau Reial)',
    en: 'Jardines del Real – Viveros Gardens (remains of the Royal Palace)',
  },
}

export const VISIT_MONFORTE: SourceDefinition = {
  name: 'Visit València',
  url: 'https://www.visitvalencia.com/que-hacer-valencia/naturaleza-en-valencia/parques-y-jardines/jardin-monforte-lhort-romero',
  description: {
    es: 'Jardín de Monforte: estilo, superficie y elementos destacados',
    ca: 'Jardí de Monforte: estil, superfície i elements destacats',
    en: 'Monforte Garden: style, area and main features',
  },
}

export const PLANOL_MONFORTE: SourceDefinition = {
  name: 'Ajuntament de València',
  url: 'https://cultural.valencia.es/wp-content/uploads/2020/10/Planol_Jardi_de_Monforte-1.pdf',
  description: {
    es: 'Plano «Jardí de Monforte» (propiedad municipal y apertura en 1973)',
    ca: 'Plànol «Jardí de Monforte» (propietat municipal i obertura en 1973)',
    en: '“Jardí de Monforte” map (municipal ownership and 1973 opening)',
  },
}

export const SPAIN_INFO_MONFORTE: SourceDefinition = {
  name: 'Turespaña (spain.info)',
  url: 'https://www.spain.info/es/lugares-interes/jardines-monforte/',
  description: {
    es: 'Jardines de Monforte: origen en huertas transformadas en jardín neoclásico',
    ca: 'Jardins de Monforte: origen en hortes transformades en jardí neoclàssic',
    en: 'Monforte Gardens: originating in orchards turned into a neoclassical garden',
  },
}

export const VIA_HESPERIDES: SourceDefinition = {
  name: 'Vía Arquitectura',
  url: 'https://via-arquitectura.net/02_prem/02p-064.htm',
  description: {
    es: 'Premio COACV: Jardín de las Hespérides (colección de cítricos, mito y esculturas)',
    ca: 'Premi COACV: Jardí de les Hespèrides (col·lecció de cítrics, mite i escultures)',
    en: 'COACV award: Garden of the Hesperides (citrus collection, myth and sculptures)',
  },
}

export const CV_HESPERIDES: SourceDefinition = {
  name: 'Comunitat Valenciana – Turisme',
  url: 'https://www.comunitatvalenciana.com/es/valencia/valencia/espacios-naturales/jardin-de-las-hesperides',
  description: {
    es: 'Jardín de las Hespérides: diseño basado en el mito y muros de ciprés',
    ca: 'Jardí de les Hespèrides: disseny basat en el mite i murs de xiprer',
    en: 'Garden of the Hesperides: a design based on the myth, with cypress walls',
  },
}
