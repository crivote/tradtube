import { vi } from 'vitest';

/**
 * Creates a mock Supabase query builder chain.
 * Each method returns `this` so chains like .from().select().eq().order() work.
 * The builder is thenable — awaiting it resolves { data, error, count }.
 */
export function createMockQueryBuilder() {
  const builder = {
    data: null,
    error: null,
    _count: null,

    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    not: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    single: vi.fn().mockReturnThis(),
    maybeSingle: vi.fn().mockReturnThis(),
    contains: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    head: vi.fn().mockReturnThis(),

    then(resolve) {
      const result = { data: this.data, error: this.error };
      if (this._count !== null) result.count = this._count;
      return Promise.resolve(result).then(resolve);
    },

    /** Set what { data, error } the builder resolves with */
    setResult(data, error = null, count = null) {
      this.data = data;
      this.error = error;
      this._count = count;
      return this;
    },
  };
  return builder;
}

/**
 * Creates a full mock Supabase client that can be passed to `createClient`.
 * Use with `vi.mock('@supabase/supabase-js', () => ({ createClient: vi.fn(() => mock) }))`.
 */
export function createMockSupabaseClient(overrides = {}) {
  const from = overrides.from ?? vi.fn(() => createMockQueryBuilder());

  const storageFrom = overrides.storageFrom ?? vi.fn(() => ({
    upload: vi.fn().mockResolvedValue({ data: { path: 'test.ogg' }, error: null }),
    getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://example.supabase.co/storage/v1/object/public/user-recordings/test.ogg' } })),
    remove: vi.fn().mockResolvedValue({ data: {}, error: null }),
  }));

  return {
    from,
    auth: {
      getUser: vi.fn().mockResolvedValue({ data: { user: { id: 'test-user-id', user_metadata: { full_name: 'Test User' } } }, error: null }),
      getSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null }),
      refreshSession: vi.fn().mockResolvedValue({ data: { session: { user: { id: 'test-user-id' } } }, error: null }),
      signInWithOAuth: vi.fn().mockResolvedValue({ error: null }),
      signOut: vi.fn().mockResolvedValue({ error: null }),
      onAuthStateChange: vi.fn().mockReturnValue({ data: { subscription: { unsubscribe: vi.fn() } } }),
      ...overrides.auth,
    },
    storage: {
      from: storageFrom,
    },
    ...overrides,
  };
}
