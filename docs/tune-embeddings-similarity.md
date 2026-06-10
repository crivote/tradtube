# Tune embeddings y similaridad semántica
**Fecha:** 2026-05-25  
**Estado:** Diseño — pendiente de implementar  
**Proyectos afectados:** tradtube (discovery, sets asistidos), tutor (futuro)

---

## Problema actual

`SameTypeTunes.jsx` muestra 5 tunes aleatorias del mismo tipo. No usa `tune_similarities`.  
`tune_similarities` existe con 73.890 pares pero fue calculada con heurísticas numéricas simples  
(metro, modo, longitud, rango, densidad, motivo de apertura) — sin contorno melódico real.

El resultado: las recomendaciones son razonables a nivel estructural pero no capturan  
el "feeling" musical que un músico usaría para construir un set.

---

## Visión

Dos features concretas en tradtube:

**1. Discovery semántico** — reemplazar el shuffle aleatorio de `SameTypeTunes` por  
"tunes con feeling similar" ordenadas por similitud real, priorizando las que tienen vídeos.

**2. Set builder asistido** — el usuario elige una tune de arranque y el sistema propone  
la siguiente (y la siguiente) con criterios de compatibilidad de set: mismo feeling,  
progresión de energía, compatibilidad de tonalidad para encadenar sin cambio de cuerda/digitación.

---

## Por qué embeddings y no mejorar las heurísticas

El `recommender.py` actual compara valores escalares con umbrales fijos. Para mejorar  
la similitud con heurísticas habría que añadir más features y afinar pesos manualmente  
— un proceso frágil sin ground truth claro.

Los embeddings representan cada tune como un vector en un espacio continuo donde  
la distancia entre vectores refleja similitud musical. Con pgvector en Supabase,  
la búsqueda de los N más similares es una sola query con índice HNSW — sin precalcular  
todos los pares, sin tabla de similitudes que mantener.

Ventaja operativa: cuando entra una tune nueva (corpus de thesession crece),  
calculas su embedding y ya es buscable. Con la tabla actual hay que recalcular  
todos los pares del mismo tipo.

---

## Qué va en el embedding

El embedding es un vector numérico generado desde el ABC de cada tune.  
**No usa LLMs externos** — se construye desde features extraídas del ABC,  
lo que lo hace reproducible, explicable y gratuito.

### Features por categoría

**Contorno melódico normalizado** (componente más importante)  
Secuencia de intervalos relativos entre notas consecutivas, expresada en semitonos,  
normalizada para ser independiente de la tonalidad base.  
Ejemplo: The Kesh en G y The Kesh transpuesta a D producen el mismo vector de contorno.  
Se calcula sobre la primera parte (parte A) como representante del carácter de la tune.  
Representación: histograma de intervalos (unísono, 2ª menor, 2ª mayor... octava)  
→ vector de 13 dimensiones normalizado.

**Perfil rítmico**  
Distribución de valores de nota: qué proporción son corcheas, negras, semicorcheas.  
Densidad (notas por pulso). Presencia de síncopa (notas en tiempos débiles).  
→ vector de 5-6 dimensiones.

**Modo y color armónico**  
Modo extraído de la clave ABC (major, minor, dorian, mixolydian, etc.).  
Codificado como one-hot o embedding de modo (7 dimensiones).  
El modo es determinante para el "color" — un dorian y un mixolydian del mismo  
tempo suenan fundamentalmente distintos aunque compartan contorno.

**Estructura**  
Número de partes (AABB vs AABBCC).  
Longitud normalizada por tipo (un jig corto vs uno largo).  
→ 2-3 dimensiones.

**Features ya calculadas en tune_features** (reutilizar directamente)  
`density`, `note_range`, `num_parts`, `has_gracenotes`, `has_broken_rhythm`.  
→ 5 dimensiones ya disponibles sin parsear ABC de nuevo.

### Dimensión total estimada
~35-50 dimensiones. No es un embedding de alta dimensión — es un vector  
de features musicales densas. Eso es una ventaja: es interpretable  
(puedes saber qué dimensiones pesan más en una similitud concreta)  
y eficiente en pgvector.

---

## Arquitectura técnica

### Pipeline de generación (Python, NUC, offline)

```
thesession.db (settings ABC)
       ↓
parse_abc.py — extrae notas, ritmos, modo por tune
       ↓
build_embedding.py — construye vector por tune
       ↓
upload_embeddings.py — sube a Supabase tabla tune_embeddings
```

El pipeline corre en el NUC, no en el cliente ni en Netlify.  
Tiempo estimado para 5000 tunes: minutos, no horas.  
Se re-ejecuta cuando el corpus de thesession cambia (infrecuente).

### Schema Supabase

```sql
CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE tune_embeddings (
    tune_id     INTEGER PRIMARY KEY,
    embedding   vector(48),        -- dimensión exacta a definir tras prototipo
    computed_at TIMESTAMPTZ DEFAULT now(),
    num_settings INTEGER,          -- cuántos settings ABC se usaron para el embedding
    version     TEXT               -- versión del pipeline, para invalidación
);

-- Índice HNSW para búsqueda aproximada eficiente
CREATE INDEX tune_embeddings_hnsw ON tune_embeddings
    USING hnsw (embedding vector_cosine_ops)
    WITH (m = 16, ef_construction = 64);
```

### Query de similitud (desde el cliente via Supabase)

```sql
-- Top 10 tunes similares a tune_id=55, del mismo tipo, con vídeos
SELECT 
    t.tune_id, t.name, t.type,
    1 - (te.embedding <=> ref.embedding) AS similarity
FROM tune_embeddings te
JOIN tunes t ON te.tune_id = t.tune_id
CROSS JOIN (SELECT embedding FROM tune_embeddings WHERE tune_id = 55) ref
WHERE t.type = 'jig'                    -- mismo tipo
  AND te.tune_id != 55                  -- excluir la tune actual
ORDER BY te.embedding <=> ref.embedding -- distancia coseno ascendente
LIMIT 10;
```

Esta query tarda <10ms con el índice HNSW en un corpus de 5000 tunes.  
Se ejecuta en Supabase, el cliente solo recibe los resultados.

---

## Integración en tradtube

### Fase inmediata — Discovery mejorado

Reemplazar `SameTypeTunes.jsx`:

```javascript
// Actual (aleatorio)
const pool = searchTunesByType(tune.type, 500)
  .filter(t => t.tune_id !== tune.tune_id && counts.has(t.tune_id));
// shuffle → 5 aleatorias

// Nuevo (semántico)
const similar = await getSimilarTunes(tune.tune_id, tune.type, 5);
// query pgvector → top 5 por similitud, filtradas por las que tienen vídeos
```

Nueva función en `src/lib/supabase.js`:

```javascript
export async function getSimilarTunes(tuneId, tuneType, limit = 5) {
  const { data, error } = await supabase.rpc('get_similar_tunes', {
    p_tune_id: tuneId,
    p_type: tuneType,
    p_limit: limit
  });
  if (error) throw error;
  return data; // [{ tune_id, name, similarity }]
}
```

La función RPC en Supabase encapsula la query pgvector — el cliente  
no necesita construir SQL, solo llamar a la función.

### Fase siguiente — Set builder

Nueva vista `/set-builder` o panel lateral en `TuneView`:

1. Usuario está en una tune → botón "Build a set from here"
2. Se propone la siguiente tune con criterios adicionales de set:
   - Similitud semántica alta (mismo feeling)
   - Compatibilidad de tonalidad (G major → D major es natural, G major → Eb minor no)
   - Energía progresiva (densidad ligeramente mayor para el remate del set)
3. Usuario acepta o pide otra propuesta
4. El set se guarda en su repertorio personal (Fase 2 del roadmap)

La compatibilidad de tonalidad es determinística desde el ABC — no necesita ML,  
es una tabla de tonalidades compatibles para encadenar en sesión.

---

## Relación con tune_similarities existente

La tabla `tune_similarities` actual tiene valor como baseline de validación.  
Una vez generados los embeddings, se puede medir cuánto se solapan los top-15  
de pgvector con los top-15 heurísticos. Si hay poca correlación en los extremos  
(similitud muy alta o muy baja), eso indica que uno de los dos métodos falla.

A largo plazo: `tune_similarities` se puede deprecar y eliminar del SQLite,  
reduciendo su tamaño. Las similitudes pasan a calcularse on-demand en Supabase.  
Esto también elimina la limitación de top-15 precalculado — con pgvector  
puedes pedir top-3 o top-50 con igual coste.

---

## Relación con el tutor (futuro)

El embedding de contorno melódico tiene un segundo uso en el tutor:  
cuando el usuario graba audio y el sistema no sabe qué tune está tocando,  
puede extraer el contorno melódico de la grabación y buscarlo contra  
`tune_embeddings` para identificar la tune automáticamente.

Eso elimina la fricción de "selecciona la tune antes de grabar" —  
el sistema la detecta solo si está en el repertorio del usuario  
o incluso en el corpus completo.

---

## Plan de implementación

| Paso | Tarea | Dónde | Estimación |
|------|-------|-------|-----------|
| 1 | Parser ABC robusto en Python (notas + ritmo + modo) | NUC, script offline | 1-2 semanas |
| 2 | Pipeline de embedding: features → vector normalizado | NUC, script offline | 3-5 días |
| 3 | Prototipo con 100 tunes — validación manual de similitudes | NUC | 2-3 días |
| 4 | Ejecución completa (5000 tunes) + upload a Supabase | NUC | 1 día |
| 5 | Función RPC en Supabase + índice HNSW | Supabase SQL editor | 1 día |
| 6 | Reemplazar `SameTypeTunes.jsx` con query semántica | tradtube frontend | 2-3 días |
| 7 | Set builder v0 | tradtube frontend | 1-2 semanas |

Total estimado hasta discovery funcionando: **3-4 semanas**  
Set builder: **2-3 semanas adicionales**

### Prerrequisito crítico: parser ABC

El ABC de thesession tiene ornamentación embebida `{g}`, repeticiones  
con primera/segunda volta `[1 ... :|2 ...`, y variaciones de compás.  
El parser necesita:
- Ignorar ornamentación para el contorno (los grace notes no son la nota principal)
- Expandir repeticiones para calcular la distribución real de notas
- Manejar claves relativas (K:Ador es A dorian, K:Em es E minor)

Librería recomendada: `music21` (Python) — parser ABC maduro con soporte  
de modos modales. Alternativa más ligera: `pyabc` si `music21` resulta  
excesivo para este uso.

---

## Lo que no hace este sistema

**No usa LLMs para generar embeddings.** Modelos como text-embedding-ada-002  
no entienden ABC como notación musical — lo tratan como texto.  
Un embedding de "G2G GAB|A3 ABd" desde un LLM de texto no tiene  
ninguna garantía de capturar similaridad musical.

**No captura estilo regional ni ornamentación.** Dos tunes con el mismo  
contorno pero una es Clare style y otra es Sligo style producirán  
el mismo embedding. Esa capa requeriría grabaciones etiquetadas  
por estilo — fuera del scope de este proyecto en 12 meses.

**No reemplaza el criterio humano para sets.** El set builder propone,  
el músico decide. La compatibilidad de feeling en sesión tiene  
componentes sociales y de contexto que ningún sistema captura.
