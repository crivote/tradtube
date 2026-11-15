/* Supabase */
export const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
export const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/* SQLite — asset estático en /public */
export const DB_PATH = '/thesession.db';

/* Tipos de fuente de vídeo */
export const SOURCE_TYPES = {
  studio:         'Grabación de estudio',
  album:          'Álbum / disco',
  live_concert:   'Concierto en directo',
  tv_broadcast:   'Emisión TV / radio',
  session:        'Session / pub session',
  tutorial:       'Tutorial',
  casual:         'Vídeo casero',
};

/* Instrumentos principales.
 *
 * Las claves son DATO: van escritas en `tune_media_entries.instruments`
 * (TEXT[]) y no se renombran aunque tengan una errata histórica
 * (`uileann_pipes` se queda así: hay entries usándola). Para añadir uno nuevo
 * basta con su clave aquí y su etiqueta en los cuatro locales — no hay
 * restricción en la base.
 */
export const INSTRUMENTS = {
  // cuerda
  fiddle:           'Fiddle',
  viola:            'Viola',
  cello:            'Cello',
  banjo:            'Banjo',
  mandolin:         'Mandolin',
  mandola:          'Mandola',
  bouzouki:         'Bouzouki',
  guitar:           'Guitar',
  harp:             'Harp',
  // viento madera
  flute:            'Flute',
  whistle:          'Whistle',
  low_whistle:      'Low whistle',
  // gaitas
  uileann_pipes:    'Uilleann pipes',
  highland_pipes:   'Great Highland bagpipe',
  smallpipes:       'Scottish smallpipes',
  border_pipes:     'Border pipes',
  gaita:            'Gaita (Galician/Asturian)',
  biniou:           'Biniou (Breton)',
  // lengüeta libre
  concertina:       'Concertina',
  melodeon:         'Melodeon',
  button_accordion: 'Button accordion',
  piano_accordion:  'Piano accordion',
  harmonica:        'Harmonica',
  // percusión
  bodhran:          'Bodhrán',
  // otros
  piano:            'Piano',
  various:          'Various',
};

export const INSTRUMENT_KEYS = Object.keys(INSTRUMENTS);

/* Agrupación del catálogo para el desplegable del editor. Cada clave de
 * INSTRUMENTS tiene que aparecer en un grupo y sólo en uno (hay test). */
export const INSTRUMENT_GROUPS = [
  { key: 'strings',     keys: ['fiddle', 'viola', 'cello', 'banjo', 'mandolin', 'mandola', 'bouzouki', 'guitar', 'harp'] },
  { key: 'wind',        keys: ['flute', 'whistle', 'low_whistle'] },
  { key: 'pipes',       keys: ['uileann_pipes', 'highland_pipes', 'smallpipes', 'border_pipes', 'gaita', 'biniou'] },
  { key: 'free_reed',   keys: ['concertina', 'melodeon', 'button_accordion', 'piano_accordion', 'harmonica'] },
  { key: 'percussion',  keys: ['bodhran'] },
  { key: 'other',       keys: ['piano', 'various'] },
];

/* Número máximo de resultados de búsqueda de tunes */
export const SEARCH_LIMIT = 25;
