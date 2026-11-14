// Textos del contenido editorial en castellano (NM-08). Redactados por el
// equipo a partir de las fuentes que declara `articles.ts`; solo se afirma lo
// que esas fuentes dicen. La estructura (sección, zona verde, fuentes) vive
// allí: aquí solo título, entradilla y cuerpo.

import type { ArticleText } from './text.js'

export const ES: Record<string, ArticleText> = {
  'flora-caracteristica-de-valencia': {
    title: 'Flora característica de València',
    summary: 'Naranjos amargos en las aceras, jacarandas que tiñen de violeta la primavera y ficus centenarios: los árboles que dan carácter a la ciudad.',
    body: [
      'Pasear por València es caminar bajo árboles. El inventario municipal de arbolado, que Nature MAPS utiliza como base del mapa, recoge más de 157.000 ejemplares en calles y jardines. Entre los más repetidos está el naranjo amargo, con más de 12.600 árboles. La jacaranda, de origen sudamericano, suma más de 5.200 ejemplares y cubre su copa de flores azul violeta en primavera.',
      'Los gigantes de la ciudad son las higueras australianas (Ficus macrophylla). El Ayuntamiento cuida como árboles monumentales los ejemplares del Parterre, de la Glorieta y del paseo de la Alameda, reconocibles por el tamaño de su tronco y de su copa.',
      'Palmeras datileras y canarias, pinos, moreras, olivos y magnolios completan un paisaje vegetal en el que conviven especies mediterráneas con otras llegadas de lejos. En cada ficha de planta de la app puedes ver en qué parques y jardines encontrarla.',
    ].join('\n\n'),
  },
  'parques-urbanos-de-valencia': {
    title: 'Los parques urbanos de València',
    summary: 'Del antiguo cauce del Turia a los parques de barrio: los grandes espacios verdes que estructuran la ciudad.',
    body: [
      'El gran parque de València nació de una catástrofe. Tras la riada de 1957 se decidió desviar el río, y el cauce que quedó libre acabó convertido en el Jardín del Turia, un parque que atraviesa la ciudad de oeste a este hasta acercarse al mar. En su extremo occidental lo prolonga el Parque de Cabecera.',
      'Alrededor de ese eje, la ciudad ha ido sumando parques de barrio: Benicalap, Orriols, el Parque del Oeste, Nazaret, y más tarde Marxalenes y la Rambleta, proyectados a finales de los años noventa. A esa lista se suma el Parque Central, junto a Russafa.',
      'En el mapa de Nature MAPS puedes activar la capa de zonas verdes para ver el contorno de cada parque y abrir su ficha, con las especies más frecuentes y los puntos de interés que hay dentro.',
    ].join('\n\n'),
  },
  'jardin-del-turia': {
    title: 'Jardín del Turia: el río que se hizo jardín',
    summary: 'El antiguo cauce del Turia, vacío tras desviar el río, es hoy el gran parque lineal que cruza València bajo dieciocho puentes.',
    body: [
      'El 14 de octubre de 1957 el Turia se desbordó e inundó València. Para que no volviera a ocurrir se aprobó la llamada Solución Sur, que llevó el río por un cauce nuevo al sur de la ciudad. El lecho histórico quedó seco, y en 1979 el Ayuntamiento aprobó definitivamente que esos terrenos fueran zona verde y parque público.',
      'El resultado es un jardín lineal de varios kilómetros, dividido en tramos, que se recorre a pie o en bicicleta sin cruzar una sola calle: los dieciocho puentes que antes salvaban el río pasan ahora por encima del parque. A lo largo del recorrido se suceden zonas arboladas, estanques, instalaciones deportivas y áreas de juego.',
      'En Nature MAPS el Jardín del Turia aparece como una sola zona verde formada por todos sus tramos, tal y como los publica el Ayuntamiento.',
    ].join('\n\n'),
  },
  'parque-de-cabecera': {
    title: 'Parque de Cabecera: un bosque de ribera',
    summary: 'Donde empezaba el río en la ciudad, un lago, un bosque de ribera y una colina mirador recrean el paisaje del Turia.',
    body: [
      'El Parque de Cabecera ocupa el lecho histórico del Turia y prolonga hacia el oeste el Jardín del Turia. El proyecto quiso recuperar el paisaje propio de los ríos mediterráneos: un bosque de ribera en el que se mezclan agua, relieve y vegetación.',
      'Según describe el Ayuntamiento, su vegetación está formada por bosques de ribera, pinares mediterráneos y árboles exóticos. El centro del parque es un lago, y desde la montaña mirador se ve todo el recinto y, a lo lejos, la Sierra Calderona. Dos recorridos principales, la Senda de la Ribera y el paseo del Molí del Sol, rodean el lago por cada orilla.',
    ].join('\n\n'),
  },
  'jardines-historicos-de-valencia': {
    title: 'Jardines históricos de València',
    summary: 'Viveros, Monforte, la Glorieta, el Parterre o el Botánico: jardines con siglos de historia a pocos pasos unos de otros.',
    body: [
      'Los jardines públicos de València se remontan al siglo XIX. La Glorieta surgió de un proyecto de 1813 para convertir una plaza en paseo arbolado, y el Parterre empezó a construirse hacia 1850. Los dos conservan ficus monumentales que hoy son parte de su imagen.',
      'Los Jardines del Real, conocidos como Viveros, ocupan el lugar del desaparecido Palacio Real. El Jardín de Monforte conserva su trazado neoclásico del siglo XIX. Y el Jardín Botánico de la Universitat de València, cuyo origen se remonta a un huerto de plantas medicinales de 1567, tiene pegado a su tapia el Jardín de las Hespérides, dedicado a los cítricos.',
      'Cada uno tiene su artículo en esta sección y su ficha en el mapa.',
    ].join('\n\n'),
  },
  'jardines-del-real-viveros': {
    title: 'Jardines del Real (Viveros)',
    summary: 'El jardín que rodeaba al Palacio Real de València: del huerto de los reyes al vivero municipal y al parque de hoy.',
    body: [
      'En este lugar se alzaba el Palacio Real de València, derribado en el siglo XIX. Del palacio quedan unas pocas ruinas dentro del jardín; de sus huertos, el nombre.',
      'En 1903 el recinto fue donado al Ayuntamiento para usarlo como vivero de árboles, y de ahí viene el nombre popular de Viveros. A comienzos del siglo XX empezó su transformación en el parque público actual, que fue creciendo por partes.',
      'Hoy es uno de los jardines más extensos de la ciudad, con paseos arbolados, esculturas y portadas de edificios desaparecidos que se trasladaron aquí.',
    ].join('\n\n'),
  },
  'jardin-de-monforte': {
    title: 'Jardín de Monforte',
    summary: 'Un jardín neoclásico del siglo XIX, con estatuas de mármol, fuentes y estanques, a un paso de la Alameda.',
    body: [
      'El Jardín de Monforte nació en la segunda mitad del siglo XIX, cuando una de las huertas que había fuera de las murallas se transformó en jardín de estilo neoclásico con un palacete.',
      'Ocupa unos 12.000 metros cuadrados, con fuentes ornamentales, estanques y estatuas; entre sus esculturas destacan los leones de José Bellver.',
      'Está protegido como monumento histórico-artístico. Pasó a ser propiedad municipal y, tras su restauración, abrió al público en 1973.',
    ].join('\n\n'),
  },
  'jardin-de-las-hesperides': {
    title: 'Jardín de las Hespérides',
    summary: 'Un jardín de colección dedicado a los cítricos, que cuenta el mito de las manzanas de oro junto a la tapia del Botánico.',
    body: [
      'El Jardín de las Hespérides es un jardín contemporáneo de poco más de cuatro mil metros cuadrados, pegado al Jardín Botánico. Es un jardín de colección: reúne variedades de cítricos y recupera así la tradición valenciana del cultivo ornamental de naranjos y limoneros.',
      'Su hilo conductor es el mito griego de las Hespérides, las ninfas que guardaban un jardín de manzanas de oro. El relato se cuenta con plantas y con tres esculturas: Hércules, la metamorfosis de las ninfas en árbol y Venus. Hileras de cipreses, a modo de muros verdes, dividen el espacio y dirigen la vista hacia la arboleda del Botánico.',
    ].join('\n\n'),
  },
  'paisajismo-en-valencia': {
    title: 'Paisajismo: cómo se ha dibujado el verde de València',
    summary: 'De la huerta que rodeaba la ciudad a los parques del antiguo cauce: dos siglos de decisiones que explican el paisaje actual.',
    body: [
      'Durante siglos el gran jardín de València fue la Huerta, que la rodeaba como un tapiz de cultivos y acequias. Los jardines públicos llegaron en el siglo XIX, con paseos arbolados como la Glorieta y jardines como el Parterre o Monforte.',
      'La riada de 1957 cambió la escala. Al desviar el río, la ciudad ganó un corredor verde continuo, el Jardín del Turia, y con él una forma nueva de entender sus parques: conectados entre sí y pensados para recorrerlos. El Parque de Cabecera, que recrea un bosque de ribera, y el Jardín de las Hespérides, que reinterpreta el antiguo cultivo ornamental de cítricos, son dos ejemplos recientes de jardines que cuentan algo del lugar donde están.',
      'El contorno de cada zona verde que ves en el mapa procede de los datos abiertos del Ayuntamiento.',
    ].join('\n\n'),
  },
}
