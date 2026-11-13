// Textos del contenido editorial en valencià (NM-08). Traducció dels textos
// de `es.ts`, amb les mateixes fonts i les mateixes dades: si una xifra canvia
// en castellà, ha de canviar ací. L'estructura (secció, zona verda, fonts)
// viu en `articles.ts`.

import type { ArticleText } from './text.js'

export const VA: Record<string, ArticleText> = {
  'flora-caracteristica-de-valencia': {
    title: 'Flora característica de València',
    summary: 'Tarongers amargs a les voreres, xicrandes que tenyixen de violeta la primavera i ficus centenaris: els arbres que donen caràcter a la ciutat.',
    body: [
      'Passejar per València és caminar davall dels arbres. L’inventari municipal d’arbratge, que Nature MAPS utilitza com a base del mapa, recull més de 157.000 exemplars en carrers i jardins. Entre els més repetits hi ha el taronger amarg, amb més de 12.600 arbres. La xicrandra, d’origen sud-americà, en suma més de 5.200 i cobrix la seua copa de flors blau violeta a la primavera.',
      'Els gegants de la ciutat són les figueres australianes (Ficus macrophylla). L’Ajuntament cuida com a arbres monumentals els exemplars del Parterre, de la Glorieta i del passeig de l’Albereda, reconeixibles per la grandària del seu tronc i de la seua copa.',
      'Palmeres datileres i canàries, pins, moreres, oliveres i magnòlies completen un paisatge vegetal on conviuen espècies mediterrànies amb altres arribades de lluny. En cada fitxa de planta de l’aplicació pots veure en quins parcs i jardins trobar-la.',
    ].join('\n\n'),
  },
  'parques-urbanos-de-valencia': {
    title: 'Els parcs urbans de València',
    summary: 'De l’antic llit del Túria als parcs de barri: els grans espais verds que estructuren la ciutat.',
    body: [
      'El gran parc de València va nàixer d’una catàstrofe. Després de la riuada de 1957 es va decidir desviar el riu, i el llit que va quedar lliure va acabar convertit en el Jardí del Túria, un parc que travessa la ciutat d’oest a est fins a acostar-se al mar. En el seu extrem occidental el prolonga el Parc de Capçalera.',
      'Al voltant d’eixe eix, la ciutat ha anat sumant parcs de barri: Benicalap, Orriols, el Parc de l’Oest, Natzaret, i més tard Marxalenes i la Rambleta, projectats a finals dels anys noranta. A eixa llista s’afig el Parc Central, al costat de Russafa.',
      'En el mapa de Nature MAPS pots activar la capa de zones verdes per a veure el contorn de cada parc i obrir la seua fitxa, amb les espècies més freqüents i els punts d’interés que hi ha dins.',
    ].join('\n\n'),
  },
  'jardin-del-turia': {
    title: 'Jardí del Túria: el riu que es va fer jardí',
    summary: 'L’antic llit del Túria, buit després de desviar el riu, és hui el gran parc lineal que creua València davall de díhuit ponts.',
    body: [
      'El 14 d’octubre de 1957 el Túria es va desbordar i va inundar València. Perquè no tornara a passar es va aprovar l’anomenada Solució Sud, que va portar el riu per un llit nou al sud de la ciutat. El llit històric va quedar sec i, en 1979, l’Ajuntament va aprovar definitivament que eixos terrenys foren zona verda i parc públic.',
      'El resultat és un jardí lineal de diversos quilòmetres, dividit en trams, que es recorre a peu o en bicicleta sense creuar cap carrer: els díhuit ponts que abans salvaven el riu passen ara per damunt del parc. Al llarg del recorregut se succeïxen zones arbrades, estanys, instal·lacions esportives i àrees de joc.',
      'En Nature MAPS el Jardí del Túria apareix com una sola zona verda formada per tots els seus trams, tal com els publica l’Ajuntament.',
    ].join('\n\n'),
  },
  'parque-de-cabecera': {
    title: 'Parc de Capçalera: un bosc de ribera',
    summary: 'On començava el riu en la ciutat, un llac, un bosc de ribera i un tossal mirador recreen el paisatge del Túria.',
    body: [
      'El Parc de Capçalera ocupa el llit històric del Túria i prolonga cap a l’oest el Jardí del Túria. El projecte va voler recuperar el paisatge propi dels rius mediterranis: un bosc de ribera on es barregen aigua, relleu i vegetació.',
      'Segons descriu l’Ajuntament, la seua vegetació està formada per boscos de ribera, pinedes mediterrànies i arbres exòtics. El centre del parc és un llac, i des de la muntanya mirador es veu tot el recinte i, de lluny, la Serra Calderona. Dos recorreguts principals, la Senda de la Ribera i el passeig del Molí del Sol, envolten el llac per cada vora.',
    ].join('\n\n'),
  },
  'jardines-historicos-de-valencia': {
    title: 'Jardins històrics de València',
    summary: 'Vivers, Monforte, la Glorieta, el Parterre o el Botànic: jardins amb segles d’història a pocs passos els uns dels altres.',
    body: [
      'Els jardins públics de València es remunten al segle XIX. La Glorieta va sorgir d’un projecte de 1813 per a convertir una plaça en passeig arbrat, i el Parterre va començar a construir-se cap a 1850. Tots dos conserven ficus monumentals que hui són part de la seua imatge.',
      'Els Jardins del Real, coneguts com a Vivers, ocupen el lloc del desaparegut Palau Reial. El Jardí de Monforte conserva el seu traçat neoclàssic del segle XIX. I el Jardí Botànic de la Universitat de València, l’origen del qual es remunta a un hort de plantes medicinals de 1567, té apegat a la seua tàpia el Jardí de les Hespèrides, dedicat als cítrics.',
      'Cadascun té el seu article en esta secció i la seua fitxa en el mapa.',
    ].join('\n\n'),
  },
  'jardines-del-real-viveros': {
    title: 'Jardins del Real (Vivers)',
    summary: 'El jardí que envoltava el Palau Reial de València: de l’hort dels reis al viver municipal i al parc de hui.',
    body: [
      'En este lloc s’alçava el Palau Reial de València, derrocat al segle XIX. Del palau queden unes poques ruïnes dins del jardí; dels seus horts, el nom.',
      'En 1903 el recinte va ser donat a l’Ajuntament per a usar-lo com a viver d’arbres, i d’ací ve el nom popular de Vivers. A començaments del segle XX va començar la seua transformació en el parc públic actual, que va anar creixent per parts.',
      'Hui és un dels jardins més extensos de la ciutat, amb passejos arbrats, escultures i portades d’edificis desapareguts que es van traslladar ací.',
    ].join('\n\n'),
  },
  'jardin-de-monforte': {
    title: 'Jardí de Monforte',
    summary: 'Un jardí neoclàssic del segle XIX, amb estàtues de marbre, fonts i estanys, a un pas de l’Albereda.',
    body: [
      'El Jardí de Monforte va nàixer en la segona meitat del segle XIX, quan una de les hortes que hi havia fora de les muralles es va transformar en jardí d’estil neoclàssic amb un palauet.',
      'Ocupa uns 12.000 metres quadrats, amb fonts ornamentals, estanys i estàtues; entre les seues escultures destaquen els lleons de José Bellver.',
      'Està protegit com a monument historicoartístic. Va passar a ser propietat municipal i, després de la seua restauració, va obrir al públic en 1973.',
    ].join('\n\n'),
  },
  'jardin-de-las-hesperides': {
    title: 'Jardí de les Hespèrides',
    summary: 'Un jardí de col·lecció dedicat als cítrics, que conta el mite de les pomes d’or al costat de la tàpia del Botànic.',
    body: [
      'El Jardí de les Hespèrides és un jardí contemporani de poc més de quatre mil metres quadrats, apegat al Jardí Botànic. És un jardí de col·lecció: reunix varietats de cítrics i recupera així la tradició valenciana del cultiu ornamental de tarongers i llimeres.',
      'El seu fil conductor és el mite grec de les Hespèrides, les nimfes que guardaven un jardí de pomes d’or. El relat es conta amb plantes i amb tres escultures: Hèrcules, la metamorfosi de les nimfes en arbre i Venus. Fileres de xiprers, a manera de murs verds, dividixen l’espai i dirigixen la vista cap a l’arbreda del Botànic.',
    ].join('\n\n'),
  },
  'paisajismo-en-valencia': {
    title: 'Paisatgisme: com s’ha dibuixat el verd de València',
    summary: 'De l’horta que envoltava la ciutat als parcs de l’antic llit: dos segles de decisions que expliquen el paisatge actual.',
    body: [
      'Durant segles el gran jardí de València va ser l’Horta, que l’envoltava com un tapís de cultius i séquies. Els jardins públics van arribar al segle XIX, amb passejos arbrats com la Glorieta i jardins com el Parterre o Monforte.',
      'La riuada de 1957 va canviar l’escala. En desviar el riu, la ciutat va guanyar un corredor verd continu, el Jardí del Túria, i amb ell una manera nova d’entendre els seus parcs: connectats entre si i pensats per a recórrer-los. El Parc de Capçalera, que recrea un bosc de ribera, i el Jardí de les Hespèrides, que reinterpreta l’antic cultiu ornamental de cítrics, són dos exemples recents de jardins que conten alguna cosa del lloc on estan.',
      'El contorn de cada zona verda que veus en el mapa procedix de les dades obertes de l’Ajuntament.',
    ].join('\n\n'),
  },
}
