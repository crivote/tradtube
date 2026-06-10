# Especificación de patrones rítmicos por tipo de tune
**Fecha:** 2026-05-25  
**Estado:** Pendiente — borrador a desarrollar en sesión colaborativa  
**Dependencia:** Infraestructura parser ABC (ver tune-embeddings-similarity.md)

---

## Propósito

Especificación técnica de patrones de acento métrico por tipo de tune en Irish Trad,
para uso en el parser ABC híbrido (Python + IA) descrito en tune-embeddings-similarity.md.

El parser necesita saber, para cada tipo de tune, cuáles son los tiempos fuertes reales
— no los que dicta el metro ABC declarado, sino los que un músico de trad siente
en una interpretación real.

---

## Por qué existe este documento

El metro declarado en el ABC (M:6/8, M:4/4, etc.) es condición necesaria pero no
suficiente para determinar los tiempos fuertes. Ejemplos conocidos donde el metro
no refleja el acento real:

- **Hornpipe** (4/4): el 3 también es fuerte, el swing es más desigual que un reel
- **Mazurka** (3/4): el acento está en la 2ª negra, no en la 1ª
- **Reel vs Hornpipe**: mismo metro, feeling completamente distinto

Sin esta especificación, el parser aplica "tiempo fuerte = primer pulso del compás"
— una simplificación de solfeo básico que produce alineaciones incorrectas.

---

## Fuentes para el borrador

- *Companion to Irish Traditional Music* (Fintan Vallely) — enciclopedia académica
  de referencia, definiciones técnicas por tipo de tune
- Literatura MIR (Music Information Retrieval) sobre análisis rítmico de trad irlandés
- Conocimiento de corpus de entrenamiento de Claude sobre teoría rítmica de trad
- **Validación auditiva por Victor** — músico de trad con conocimiento tácito del
  feeling de cada tipo, sin formación teórica formal. Puede confirmar si una
  descripción técnica coincide con lo que siente al tocar o escuchar cada ritmo.

---

## Metodología de la sesión colaborativa

1. Claude redacta borrador de cada tipo: descripción formal de grupos métricos,
   tiempos fuertes/débiles, casos especiales, ejemplos de tunes representativas
2. Victor valida desde conocimiento auditivo: "esto suena correcto / esto no"
3. Se refina hasta que la descripción técnica y la intuición auditiva coinciden
4. El resultado es la especificación que alimenta el parser

Esta colaboración entre conocimiento explícito (Claude) y conocimiento tácito
(músico de trad) es el método correcto para este dominio — ni la teoría sola
ni el oído solo son suficientes.

---

## Tipos a especificar

Por orden de prevalencia en el corpus de thesession:

| Tipo | Metro ABC | Casos especiales conocidos |
|------|-----------|---------------------------|
| Reel | 4/4 o 2/2 | swing implícito no notado |
| Double jig | 6/8 | patrón de 3 notas por grupo |
| Hornpipe | 4/4 | tiempo 3 fuerte, swing más desigual que reel |
| Polka | 2/4 | swing específico del género |
| Slip jig | 9/8 | patrón 3+3+3 |
| Slide | 12/8 | relacionado con jig pero distinto feeling |
| Single jig | 6/8 | diferente del double jig |
| Mazurka | 3/4 | acento en 2ª negra, no en 1ª |
| Strathspey | 4/4 | ritmo escocés con snap característico |
| Barndance | 4/4 | diferente del hornpipe aunque mismo metro |
| Waltz | 3/4 | acento en 1ª negra (opuesto a mazurka) |
| March | variable | depende del subtipo |

---

## Relación con irishtune.info

El sitio de Chris Haigh (irishtune.info) contiene el marco conceptual más preciso
disponible públicamente para estos patrones, desarrollado desde grabaciones reales.
El robots.txt bloquea explícitamente el scraping para bulk training de IA.

Por eso esta especificación se construye desde fuentes académicas citables +
validación auditiva propia, sin usar el contenido de irishtune.info como corpus
de entrenamiento. El marco conceptual del autor (performance-oriented, not
notation-oriented) sí informa el enfoque general.

Contacto previo: Victor se ofreció a ayudarle con una API moderna, el autor
declinó educadamente. No hay colaboración activa ni prevista.

---

## Output esperado

Documento técnico con, para cada tipo de tune:

```
Tipo: Hornpipe
Metro ABC declarado: 4/4 (o 2/2)
Grupos métricos: 2 grupos de 4 notas por compás
Tiempos fuertes: 1, 3 (ambos con peso comparable)
Tiempos débiles: 2, 4
Swing: desigual — heavy-light pairs más pronunciados que en reel
Tempo típico: más lento que reel
Casos especiales: triplets frecuentes sustituyendo heavy-light pairs
Tunes de referencia en thesession.db: [IDs de hornpipes conocidos]
Notas para el parser: si el tipo es hornpipe y el metro es 4/4,
  no asumir que 3 es débil — tratarlo como ancla métrica secundaria
```

Este output alimenta directamente la tabla de patrones del parser Python
y el contexto RAG para la capa de reconciliación con IA.
