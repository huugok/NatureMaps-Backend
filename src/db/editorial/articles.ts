// Estructura del contenido editorial de flora y zonas verdes (NM-08): qué
// artículos existen, en qué sección van, a qué zona verde se refieren y de qué
// fuentes salen. Los textos están aparte, uno por idioma (`es.ts`, `va.ts`,
// `en.ts`), para que una traducción no pueda cambiar el tema, el enlace a la
// zona ni las fuentes de un artículo: esos datos se declaran aquí una vez.

import type { EditorialTopic } from '../../services/editorialCatalog.js'
import type { SourceDefinition } from './sources.js'
import {
  AJUNTAMENT_GUIA,
  CATALOGO_VIVEROS,
  CVC_GLORIETA,
  CV_HESPERIDES,
  ESPACIOS_VERDES,
  FICUS_MONUMENTALES,
  GUIA_PATRIMONIO_TURIA,
  IAGUA_TURIA,
  INFOCIUDAD_CABECERA,
  INVENTARIO_ARBOLADO,
  PLANOL_MONFORTE,
  SPAIN_INFO_MONFORTE,
  UV_BOTANIC,
  VALENCIA_BONITA_TURIA,
  VIA_CABECERA,
  VIA_HESPERIDES,
  VISIT_MONFORTE,
  VISIT_VIVEROS,
} from './sources.js'

export interface ArticleMeta {
  slug: string
  topic: EditorialTopic
  /** `group_slug` de la zona verde de la que habla, o null si es temático. */
  greenAreaGroup: string | null
  /** Orden dentro de la sección. */
  position: number
  sources: SourceDefinition[]
}

export const ARTICLE_META: ArticleMeta[] = [
  {
    slug: 'flora-caracteristica-de-valencia',
    topic: 'flora',
    greenAreaGroup: null,
    position: 10,
    sources: [INVENTARIO_ARBOLADO, FICUS_MONUMENTALES],
  },
  {
    slug: 'parques-urbanos-de-valencia',
    topic: 'parques',
    greenAreaGroup: null,
    position: 20,
    sources: [AJUNTAMENT_GUIA, ESPACIOS_VERDES],
  },
  {
    slug: 'jardin-del-turia',
    topic: 'parques',
    greenAreaGroup: 'jardin-del-turia',
    position: 21,
    sources: [IAGUA_TURIA, AJUNTAMENT_GUIA, VALENCIA_BONITA_TURIA, GUIA_PATRIMONIO_TURIA],
  },
  {
    slug: 'parque-de-cabecera',
    topic: 'parques',
    greenAreaGroup: 'parque-de-cabecera',
    position: 22,
    sources: [INFOCIUDAD_CABECERA, VIA_CABECERA],
  },
  {
    slug: 'jardines-historicos-de-valencia',
    topic: 'jardines',
    greenAreaGroup: null,
    position: 30,
    sources: [AJUNTAMENT_GUIA, CVC_GLORIETA, UV_BOTANIC],
  },
  {
    slug: 'jardines-del-real-viveros',
    topic: 'jardines',
    greenAreaGroup: 'jardines-del-real',
    position: 31,
    sources: [CATALOGO_VIVEROS, VISIT_VIVEROS],
  },
  {
    slug: 'jardin-de-monforte',
    topic: 'jardines',
    greenAreaGroup: 'jardin-de-monforte',
    position: 32,
    sources: [VISIT_MONFORTE, PLANOL_MONFORTE, SPAIN_INFO_MONFORTE],
  },
  {
    slug: 'jardin-de-las-hesperides',
    topic: 'jardines',
    greenAreaGroup: 'jardin-de-las-hesperides',
    position: 33,
    sources: [VIA_HESPERIDES, CV_HESPERIDES, ESPACIOS_VERDES],
  },
  {
    slug: 'paisajismo-en-valencia',
    topic: 'paisajismo',
    greenAreaGroup: null,
    position: 40,
    sources: [AJUNTAMENT_GUIA, ESPACIOS_VERDES],
  },
]
