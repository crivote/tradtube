# Roadmap draft — Ecosistema Irish Trad
**Fecha:** 2026-05-25  
**Horizonte:** 12 meses  
**Estado:** Draft — sujeto a revisión

---

## Visión general

Dos productos con una plataforma de datos compartida:

```
┌─────────────────────────────────────────────────────────┐
│                  thesession.db (local)                  │
│            Supabase (tune_media, grabaciones)           │
│                  CAPA DE DATOS COMÚN                    │
└───────────────────┬─────────────────┬───────────────────┘
                    │                 │
         ┌──────────▼──────┐ ┌───────▼──────────┐
         │    tradtube     │ │   tutor (futuro)  │
         │ plataforma      │ │   app separada    │
         │ vídeos+audio    │ │   análisis notas  │
         └─────────────────┘ └──────────────────┘
```

tradtube es infraestructura: construye el corpus de referencia (vídeos, grabaciones curadas, consenso ABC) que el tutor consume. El tutor no puede existir sin tradtube maduro.

---

## Estado actual (punto de partida)

- [x] Búsqueda FTS5 contra SQLite local (~5000 tunes)
- [x] Vinculación vídeos YouTube con timestamps por tune
- [x] Votos y moderación
- [x] Auth Google
- [x] Schema tune_media (grabaciones de usuario)
- [x] AudioRecorder implementado — pendiente fix ffmpeg-wasm (doc: `ffmpeg-wasm-fix.md`)
- [ ] Fix ffmpeg-wasm → grabaciones funcionando end-to-end
- [ ] Fases 2-4 del plan de grabaciones (persistencia, vista usuario, tabs)

---

## Fase 1 — Cerrar grabaciones de audio
**Duración estimada:** 4-6 semanas  
**Objetivo:** Que las grabaciones funcionen de extremo a extremo y sean útiles para la comunidad.

### Hitos técnicos
- Fix ffmpeg-wasm (`ffmpeg-wasm-fix.md`)
- Fase 2: persistencia en Supabase Storage
- Fase 3: vista de grabaciones propias del usuario
- Fase 4: tabs vídeos / grabaciones en TuneView

### Criterio de éxito
Un usuario autenticado puede grabar una tune, recortarla, anotarla con tune_id y timestamps, subirla, y verla reproducirse en la vista del tune junto a los vídeos de YouTube.

### Por qué es prioritario
Cada grabación que entra en el corpus lleva tune_id, instrumento potencial, y timestamps. Es el dataset etiquetado que el tutor necesitará. Construirlo antes de que haya usuarios activos significa empezar con cero datos. Construirlo mientras la comunidad usa tradtube significa que crece solo.

---

## Fase 2 — Repertorio personal y práctica
**Duración estimada:** 6-10 semanas  
**Objetivo:** Que tradtube sea útil en el día a día de práctica, no solo como buscador.

### Funcionalidades

**Mi repertorio**
- Marcar tunes como "en mi repertorio"
- Estado por tune: aprendiendo / en repertorio / descuidado (drift detectado manualmente)
- Notas privadas por tune (variante que toco, dificultades, referencias)

**Listas de reproducción de práctica**
- Construir una sesión de práctica: seleccionar tunes, orden, repeticiones
- Modo loop por tune: reproduce el vídeo/grabación de referencia N veces antes de pasar al siguiente
- Modo sesión continua: reproduce el set completo sin parar
- Guardar sesiones de práctica para reutilizar

**Historial de ensayos**
- Marcar una sesión de práctica como completada
- Registro de fechas de práctica por tune
- Visualización simple: "última vez que practiqué The Kesh: hace 12 días"

### Por qué viene antes que el tutor
El repertorio personal es el nodo que conecta todo. Sin saber qué tunes toca el usuario, el tutor no sabe contra qué comparar una grabación entrante. El historial de ensayos añade la dimensión temporal que convierte el análisis puntual en seguimiento de progreso.

### Consideraciones técnicas
- Todo en Supabase: tabla `user_repertoire` (user_id, tune_id, status, notes, added_at)
- Tabla `practice_sessions` (user_id, name, entries ordenadas)
- Tabla `practice_log` (user_id, session_id, completed_at)
- Sin backend nuevo — Supabase RLS es suficiente
- UI: nueva sección "My Practice" en el menú de usuario

---

## Fase 3 — Crecimiento de comunidad y corpus
**Duración estimada:** paralela a Fase 2, continua  
**Objetivo:** Que el corpus de grabaciones crezca con calidad suficiente para ser útil como referencia.

### Acciones

**Apertura controlada**
- Compartir tradtube con la comunidad cercana (músicos conocidos, foros Irish Trad)
- No publicidad masiva — calidad del corpus antes que cantidad de usuarios
- Recoger feedback sobre UX del grabador y del reproductor

**Incentivos para contribuir grabaciones**
- Perfil público del contribuidor con sus grabaciones
- Badge o indicador de "grabaciones verificadas" (votadas positivamente por otros músicos)
- Posibilidad de enlazar a Archive.org (ver Anexo A del plan de grabaciones) para permanencia

**Filtrado de calidad**
- El sistema de votos ya existe — activarlo para grabaciones además de vídeos
- Umbral mínimo de votos para que una grabación sea usable como referencia del tutor
- Moderación ligera: ocultar grabaciones con votos negativos

### Métricas de corpus útil para el tutor
El tutor necesita, por tune popular:
- Mínimo 3 grabaciones con votos positivos
- Al menos una por instrumento principal (fiddle, flute, tin whistle, uilleann pipes)
- Tunes con menos de 3 grabaciones: caen back al consenso ABC como referencia

---

## Fase 4 — Consenso ABC (infraestructura del tutor)
**Duración estimada:** 3-4 semanas de trabajo técnico  
**Puede hacerse en paralelo con Fase 3**

### Qué es
Para cada tune en `thesession.db`, calcular la distribución estadística de notas posición a posición a partir de todos los settings ABC disponibles. Resultado: para cada posición en la tune, qué notas aparecen y con qué frecuencia.

```
The Kesh Jig — Compás 5, tiempo 2:
  F# → 89% de versiones   ← NOTA SÓLIDA
  E  →  8% de versiones   ← variación legítima
  G  →  3% de versiones   ← exótica / error de transcripción
```

### Por qué aquí y no antes
Requiere parsear ABC con cierta fiabilidad. La librería `abcjs` ya está como dependencia del frontend — pero el cálculo de consenso es un script Python offline, no lógica de cliente. Necesita un entorno de procesamiento separado (puede ser el NUC).

### Output
- Nueva tabla en SQLite o Supabase: `tune_note_consensus` (tune_id, part, measure, beat, note, frequency)
- Script Python reproducible para regenerar cuando cambia el corpus de thesession
- Este dataset es la referencia primaria del tutor para detección de drift

### Valor por sí mismo
Antes de que exista el tutor, este dataset es útil directamente en tradtube: mostrar al usuario la partitura de una tune con notas coloreadas por solidez. Las notas que siempre están en verde, las variantes en amarillo. Eso tiene valor pedagógico inmediato sin necesidad de análisis de audio.

---

## Fase 5 — Tutor v0 (MVP separado)
**Horizonte:** mes 10-12  
**Plataforma:** app separada (web progresiva, mismo stack SolidJS o React según conveniencia)  
**Prerequisitos obligatorios:** Fases 1, 2 y 4 completas; corpus con grabaciones de referencia para las tunes más populares

### Alcance del MVP

**Lo que hace:**
- El usuario selecciona una tune de su repertorio
- Graba ~40 segundos tocando esa tune (mismo flujo que en tradtube)
- El sistema extrae pitch frame a frame (CREPE via servidor, no WASM)
- Compara contra el consenso ABC de esa tune
- Devuelve: lista de posiciones donde la nota tocada diverge de la nota sólida, con frecuencia de ocurrencia ("tocas E en el compás 5 tiempo 2 en 6 de 8 pasadas — la nota sólida es F#")

**Lo que NO hace en v0:**
- Análisis de ornamentación (rolls, cuts) — demasiado complejo sin dataset etiquetado
- Feedback en tiempo real — asíncrono únicamente
- Comparación contra grabaciones de audio de referencia — solo contra consenso ABC
- Monetización — v0 es para ti y tu comunidad cercana

### Arquitectura mínima
- Backend: servidor Python simple (FastAPI) corriendo en el NUC
- CREPE para extracción de pitch (mejor que librosa para instrumentos de viento y cuerda)
- Cuantización de pitch a escala de la tune (conocida del ABC)
- Alineación DTW contra secuencia de notas del consenso
- Respuesta JSON con lista de divergencias → renderizado en frontend

### Por qué en el NUC y no en Netlify
CREPE no corre en WASM ni en Netlify Functions (timeout demasiado corto, dependencias de ML demasiado pesadas). El NUC tiene capacidad suficiente para el volumen de un MVP con comunidad pequeña. Cuando haya tracción real y usuarios pagando, se migra a infraestructura cloud.

---

## Lo que no está en este roadmap (conscientemente)

**Monetización:** No se aborda hasta tener v0 del tutor funcionando y validado con usuarios reales. El modelo freemium (N análisis gratis, suscripción para continuar) tiene sentido solo cuando el análisis impresiona lo suficiente para justificar el pago. Con un MVP que solo detecta notas incorrectas (sin ornamentación, sin timing), la propuesta de valor no es suficientemente fuerte para monetizar.

**App móvil nativa:** La web progresiva cubre el caso de uso de grabar desde el móvil sin coste de distribución. App nativa solo si la PWA tiene limitaciones técnicas insalvables (acceso al micrófono, latencia de audio).

**Detección de ornamentación:** Requiere un dataset etiquetado de ornamentación en Irish Trad que no existe públicamente. Construirlo requeriría músicos expertos anotando grabaciones. Es un proyecto en sí mismo, no una feature de un roadmap de 12 meses.

**Integración con IA generativa para feedback verbal:** El LLM como "tutor que explica" tiene valor real pero solo cuando la capa de análisis cuantitativo es suficientemente precisa. Un LLM explicando datos incorrectos es peor que no tener tutor. Primero los datos, luego la capa de lenguaje natural.

---

## Resumen de fases

| Fase | Contenido | Cuándo | Prerequisito |
|------|-----------|--------|--------------|
| 1 | Grabaciones audio end-to-end | Ahora → mes 2 | fix ffmpeg-wasm |
| 2 | Repertorio + práctica | Mes 2-4 | Fase 1 |
| 3 | Comunidad + corpus | Mes 2-8, continua | Fase 1 |
| 4 | Consenso ABC | Mes 3-4 | — |
| 5 | Tutor v0 | Mes 10-12 | Fases 1, 2, 4 + corpus |

---

## Riesgos principales

**Corpus insuficiente:** Si la comunidad no contribuye grabaciones de calidad, el tutor tendrá que funcionar solo con consenso ABC. Eso limita el análisis a notas (no a ornamentación ni estilo). Aceptable para v0 pero limita el valor percibido.

**Precisión del pitch tracking en fiddle:** El fiddle con vibrato y ornamentación densa genera artefactos en la extracción de f0. CREPE es el mejor modelo disponible públicamente pero no es perfecto. Habrá falsos positivos (notas correctas marcadas como incorrectas). Necesita calibración con grabaciones reales tuyas antes de abrir a otros usuarios.

**Scope creep:** El ecosistema es grande y cada fase abre ideas nuevas. El riesgo real es no terminar ninguna fase por empezar la siguiente demasiado pronto. El criterio de completitud de cada fase (definido en los planes de implementación existentes) es el freno necesario.
