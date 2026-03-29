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

/* Instrumentos principales */
export const INSTRUMENTS = {
  fiddle:        'Fiddle',
  flute:         'Flute',
  uileann_pipes: 'Uilleann pipes',
  whistle:       'Whistle',
  banjo:         'Banjo',
  concertina:    'Concertina',
  melodeon:      'Melodeon',
  mandolin:      'Mandolin',
  mandola:       'Mandola',
  various:       'Various',
};

/* Número máximo de resultados de búsqueda de tunes */
export const SEARCH_LIMIT = 10;
