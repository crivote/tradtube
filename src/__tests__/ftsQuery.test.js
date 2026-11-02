/**
 * @vitest-environment node
 *
 * La consulta FTS5 que se manda al catálogo. Antes se envolvía el texto en
 * comillas (`"…"*`), lo que exigía la frase CONTIGUA exacta: «twilight portroe»
 * o el título con su tipo («Twilight In Portroe (reel)») devolvían cero.
 */
import { describe, it, expect } from 'vitest';
import { buildFtsQuery } from '../lib/db';

describe('buildFtsQuery', () => {
  it('emits every word as a prefix, ANDed implicitly', () => {
    expect(buildFtsQuery('twilight portroe')).toBe('twilight* portroe*');
    expect(buildFtsQuery('Twilight in Portroe')).toBe('twilight* in* portroe*');
  });

  it('drops separators so a pasted TheSession title still matches', () => {
    // TheSession titula el tune «Twilight In Portroe (reel)»
    expect(buildFtsQuery('Twilight In Portroe (reel)')).toBe('twilight* in* portroe* reel*');
    expect(buildFtsQuery('Kesh, The')).toBe('kesh* the*');
  });

  it('splits on apostrophes like the unicode61 tokenizer does', () => {
    expect(buildFtsQuery("Martin Riley's")).toBe('martin* riley* s*');
  });

  it('never leaks FTS5 operators from user input', () => {
    expect(buildFtsQuery('name: "foo" OR NOT bar*')).toBe('name* foo* or* not* bar*');
    expect(buildFtsQuery('NEAR(a b)')).toBe('near* a* b*');
  });

  it('returns an empty string when there is nothing searchable', () => {
    expect(buildFtsQuery('')).toBe('');
    expect(buildFtsQuery('   ')).toBe('');
    expect(buildFtsQuery('!!! ---')).toBe('');
    expect(buildFtsQuery(null)).toBe('');
  });
});
