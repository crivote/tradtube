import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createMockSupabaseClient, createMockQueryBuilder } from './mocks/supabase';

// Mock @supabase/supabase-js before supabase.js is imported
const mockClient = createMockSupabaseClient();
vi.mock('@supabase/supabase-js', () => ({
  createClient: vi.fn(() => mockClient),
}));

// The supabase module will use our mocked client
// Re-import to get fresh module with mocked client
const supabaseModule = await import('../lib/supabase');

describe('Phase 0A — Moderation refactor', () => {
  let mockFrom;

  beforeEach(() => {
    // Reset all mocks
    vi.clearAllMocks();
    mockFrom = mockClient.from;
  });

  describe('getEntriesForTune — no status filter', () => {
    it('does not filter by status in JS filter', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([
          { id: 1, tune_media: { status: 'new', unavailable: false }, tune_media_votes: [] },
          { id: 2, tune_media: { status: 'reviewed', unavailable: false }, tune_media_votes: [] },
        ]);
      mockFrom.mockReturnValue(mockQB);

      const entries = await supabaseModule.getEntriesForTune(123);

      // Both 'new' and 'reviewed' entries should be included
      expect(entries).toHaveLength(2);
    });

    it('still filters out unavailable entries', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([
          { id: 1, tune_media: { status: 'reviewed', unavailable: false }, tune_media_votes: [] },
          { id: 2, tune_media: { status: 'new', unavailable: true }, tune_media_votes: [] },
        ]);
      mockFrom.mockReturnValue(mockQB);

      const entries = await supabaseModule.getEntriesForTune(123);

      expect(entries).toHaveLength(1);
      expect(entries[0].id).toBe(1);
    });
  });

  describe('getVideoCountsByTune — no status filter', () => {
    it('does not call .eq with status', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getVideoCountsByTune();

      // Check that eq was never called with 'status' as first argument
      const eqCalls = mockQB.eq.mock.calls;
      const statusFilter = eqCalls.find(call => call[0] === 'status');
      expect(statusFilter).toBeUndefined();
    });
  });

  describe('getTuneIdsByInstrument — no status filter', () => {
    it('does not filter by tune_media.status', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getTuneIdsByInstrument('fiddle');

      // Check that eq never filters on tune_media.status
      const eqCalls = mockQB.eq.mock.calls;
      const statusFilter = eqCalls.find(
        call => call[0] === 'tune_media.status' || (call[0] && call[0].includes && call[0].includes('status'))
      );
      expect(statusFilter).toBeUndefined();
    });
  });

  describe('reviewVideo — uses status reviewed', () => {
    it('updates status to reviewed', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult(null);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.reviewVideo(42);

      expect(mockQB.update).toHaveBeenCalledWith({ status: 'reviewed' });
      expect(mockQB.eq).toHaveBeenCalledWith('id', 42);
    });
  });

  describe('getPendingCount — uses status new and llm_guess', () => {
    it('counts by status in [new, llm_guess]', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult(null, null, 5);
      mockFrom.mockReturnValue(mockQB);

      const count = await supabaseModule.getPendingCount();

      // Verify in was called with 'status', ['new', 'llm_guess']
      const inCalls = mockQB.in.mock.calls;
      const statusCall = inCalls.find(call => call[0] === 'status');
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual(['new', 'llm_guess']);
    });
  });

  describe('getPendingVideos — uses status new and llm_guess', () => {
    it('filters by status in [new, llm_guess]', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getPendingVideos();

      const inCalls = mockQB.in.mock.calls;
      const statusCall = inCalls.find(call => call[0] === 'status');
      expect(statusCall).toBeDefined();
      expect(statusCall[1]).toEqual(['new', 'llm_guess']);
    });
  });

  describe('getLatestMedia — no status filter', () => {
    it('does not filter by status', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getLatestMedia();

      const eqCalls = mockQB.eq.mock.calls;
      const statusFilter = eqCalls.find(call => call[0] === 'status');
      expect(statusFilter).toBeUndefined();
    });
  });

  describe('getVideosByTune — no status filter', () => {
    it('does not filter by tune_media.status', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([{ media_id: 1 }]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getVideosByTune(123);

      const eqCalls = mockQB.eq.mock.calls;
      const statusFilter = eqCalls.find(
        call => call[0] === 'tune_media.status' || (call[0] && call[0].includes && call[0].includes('status'))
      );
      expect(statusFilter).toBeUndefined();
    });
  });
});

describe('Phase 0B — Schema migration tune_media + media_uri', () => {
  let mockFrom;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = mockClient.from;
  });

  describe('checkYoutubeIdExists — searches by media_uri', () => {
    it('uses .eq with media_uri containing canonical YouTube URL', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult(null, { code: 'PGRST116' }); // not found
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.checkYoutubeIdExists('dQw4w9WgXcQ');

      const eqCalls = mockQB.eq.mock.calls;
      const mediaUriCall = eqCalls.find(call => call[0] === 'media_uri');
      expect(mediaUriCall).toBeDefined();
      expect(mediaUriCall[1]).toBe('https://www.youtube.com/watch?v=dQw4w9WgXcQ');
    });
  });

  describe('getEntriesForTune — uses tune_media in join', () => {
    it('references tune_media in select', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getEntriesForTune(123);

      expect(mockFrom).toHaveBeenCalledWith('tune_media_entries');
    });
  });

  describe('castVote — uses tune_media_votes', () => {
    it('upserts into tune_media_votes', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult(null);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.castVote(42, 1);

      expect(mockFrom).toHaveBeenCalledWith('tune_media_votes');
    });
  });

  describe('createReport — uses tune_media_reports with media_id', () => {
    it('inserts with media_id column', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult(null);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.createReport({ media_id: 'abc-123', tune_id: 5, issue_type: 'other', description: 'test' });

      expect(mockFrom).toHaveBeenCalledWith('tune_media_reports');
    });
  });

  describe('getVideoCountsByTune — uses tune_media and extracts youtube from media_uri', () => {
    it('fetches from tune_media with media_uri', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([
          {
            id: 1,
            media_uri: 'https://www.youtube.com/watch?v=abc123def45',
            tune_media_entries: [{ tune_id: 100 }],
          },
        ]);
      mockFrom.mockReturnValue(mockQB);

      const { counts, thumbnails } = await supabaseModule.getVideoCountsByTune();

      expect(mockFrom).toHaveBeenCalledWith('tune_media');
      expect(counts.get(100)).toBe(1);
      expect(thumbnails.get(100)).toBe('abc123def45');
    });

    it('skips thumbnail for non-YouTube media_uri', async () => {
      const mockQB = createMockQueryBuilder()
        .setResult([
          {
            id: 2,
            media_uri: 'https://example.com/audio.ogg',
            tune_media_entries: [{ tune_id: 200 }],
          },
        ]);
      mockFrom.mockReturnValue(mockQB);

      const { thumbnails } = await supabaseModule.getVideoCountsByTune();

      expect(thumbnails.has(200)).toBe(false);
    });
  });
});

describe('Phase 2 — addRecordingWithEntries', () => {
  let mockFrom, mockStorageFrom;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = mockClient.from;
    mockStorageFrom = mockClient.storage.from;
  });

  it('uploads blob to user-recordings/{userId}/{uuid}.ogg', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    const mockQB = createMockQueryBuilder().setResult({ id: 'media-1' });
    mockFrom.mockReturnValue(mockQB);

    await supabaseModule.addRecordingWithEntries({
      blob: new Blob(['test']),
      performer_name: 'Test',
      recording_notes: null,
      entries: [{ tune_id: 5 }],
    });

    expect(mockStorageFrom).toHaveBeenCalledWith('user-recordings');
    expect(mockStorage.upload.mock.calls[0][0]).toMatch(/^test-user-id\/[a-f0-9-]+\.ogg$/);
    expect(mockStorage.upload.mock.calls[0][1]).toBeInstanceOf(Blob);
  });

  it('inserts into tune_media with source_type user_recording', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    const mockQB = createMockQueryBuilder().setResult({ id: 'media-1' });
    mockFrom.mockReturnValue(mockQB);

    await supabaseModule.addRecordingWithEntries({
      blob: new Blob(['test']),
      performer_name: 'Test Player',
      recording_notes: 'Some notes',
      entries: [{ tune_id: 5 }],
    });

    // Check tune_media insert
    const insertCalls = mockQB.insert.mock.calls;
    expect(insertCalls.length).toBeGreaterThanOrEqual(1);
    const mediaInsert = insertCalls[0][0];
    expect(mediaInsert.source_type).toBe('user_recording');
    expect(mediaInsert.performer_name).toBe('Test Player');
    expect(mediaInsert.recording_notes).toBe('Some notes');
    expect(mediaInsert.status).toBe('new');
  });

  it('inserts entries with media_id', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    // First from() call: tune_media insert (.select().single())
    const mockQB1 = createMockQueryBuilder().setResult({ id: 'media-xx' });
    // Second from() call: tune_media_entries insert
    const mockQB2 = createMockQueryBuilder().setResult(null);
    mockFrom
      .mockReturnValueOnce(mockQB1)
      .mockReturnValueOnce(mockQB2);

    await supabaseModule.addRecordingWithEntries({
      blob: new Blob(['test']),
      performer_name: 'Test',
      recording_notes: null,
      entries: [
        { tune_id: 10, start_sec: 30, end_sec: 60, instruments: ['fiddle'], key: 'D' },
      ],
    });

    // Check entries insert
    const entriesInsertArgs = mockQB2.insert.mock.calls[0][0];
    expect(entriesInsertArgs.length).toBe(1);
    expect(entriesInsertArgs[0].media_id).toBe('media-xx');
    expect(entriesInsertArgs[0].tune_id).toBe(10);
    expect(entriesInsertArgs[0].start_sec).toBe(30);
    expect(entriesInsertArgs[0].end_sec).toBe(60);
    expect(entriesInsertArgs[0].instruments).toEqual(['fiddle']);
    expect(entriesInsertArgs[0].key).toBe('D');
  });

  it('rolls back storage if tune_media insert fails', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    const mockQB = createMockQueryBuilder().setResult(null, { message: 'DB error' });
    mockFrom.mockReturnValue(mockQB);

    await expect(
      supabaseModule.addRecordingWithEntries({
        blob: new Blob(['test']),
        performer_name: 'Test',
        recording_notes: null,
        entries: [{ tune_id: 5 }],
      })
    ).rejects.toThrow('Failed to save recording');

    expect(mockStorage.remove).toHaveBeenCalled();
  });

  it('rolls back storage and tune_media if entries insert fails', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    const mockQB1 = createMockQueryBuilder().setResult({ id: 'media-1' });
    const mockQB2 = createMockQueryBuilder().setResult(null, { message: 'Entries error' });
    mockFrom
      .mockReturnValueOnce(mockQB1)
      .mockReturnValueOnce(mockQB2);

    await expect(
      supabaseModule.addRecordingWithEntries({
        blob: new Blob(['test']),
        performer_name: 'Test',
        recording_notes: null,
        entries: [{ tune_id: 5 }],
      })
    ).rejects.toThrow('Failed to save tune entries');

    expect(mockStorage.remove).toHaveBeenCalled();
  });

  it('refreshes session before upload', async () => {
    const mockStorage = { upload: vi.fn().mockResolvedValue({ data: {}, error: null }), getPublicUrl: vi.fn(() => ({ data: { publicUrl: 'https://x.supabase.co/rec.ogg' } })), remove: vi.fn().mockResolvedValue({}) };
    mockStorageFrom.mockReturnValue(mockStorage);

    const mockQB = createMockQueryBuilder().setResult({ id: 'media-1' });
    mockFrom.mockReturnValue(mockQB);

    await supabaseModule.addRecordingWithEntries({
      blob: new Blob(['test']),
      performer_name: 'Test',
      recording_notes: null,
      entries: [{ tune_id: 5 }],
    });

    expect(mockClient.auth.refreshSession).toHaveBeenCalled();
  });
});

describe('Phase 3 — Tune comments', () => {
  let mockFrom;

  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom = mockClient.from;
  });

  describe('getComments', () => {
    it('selects from tune_comments with profiles join, ordered by created_at', async () => {
      const mockQB = createMockQueryBuilder().setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getComments(123, { limit: 20, offset: 0 });

      expect(mockFrom).toHaveBeenCalledWith('tune_comments');
      expect(mockQB.select).toHaveBeenCalledWith('id, body, created_at, edited_at, user_id, profiles!inner(display_name, avatar_url)');
      expect(mockQB.eq).toHaveBeenCalledWith('tune_ref', 123);
      expect(mockQB.order).toHaveBeenCalledWith('created_at', { ascending: true });
      expect(mockQB.range).toHaveBeenCalledWith(0, 19);
    });

    it('uses custom limit and offset for pagination', async () => {
      const mockQB = createMockQueryBuilder().setResult([]);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.getComments(456, { limit: 10, offset: 30 });

      expect(mockQB.range).toHaveBeenCalledWith(30, 39);
    });

    it('returns data array on success', async () => {
      const comments = [
        { id: 'c1', body: 'Great tune!', user_id: 'u1' },
      ];
      const mockQB = createMockQueryBuilder().setResult(comments);
      mockFrom.mockReturnValue(mockQB);

      const result = await supabaseModule.getComments(123);

      expect(result).toEqual(comments);
    });

    it('returns empty array when data is null', async () => {
      const mockQB = createMockQueryBuilder().setResult(null);
      mockFrom.mockReturnValue(mockQB);

      const result = await supabaseModule.getComments(123);

      expect(result).toEqual([]);
    });

    it('throws on error', async () => {
      const mockQB = createMockQueryBuilder().setResult(null, { message: 'DB error' });
      mockFrom.mockReturnValue(mockQB);

      await expect(supabaseModule.getComments(123)).rejects.toThrow();
    });
  });

  describe('addComment', () => {
    it('inserts into tune_comments with user_id from auth', async () => {
      const inserted = { id: 'c-new', tune_ref: 123, body: 'Hello', user_id: 'test-user-id' };
      const mockQB = createMockQueryBuilder().setResult(inserted);
      mockFrom.mockReturnValue(mockQB);

      const result = await supabaseModule.addComment(123, 'Hello');

      expect(mockFrom).toHaveBeenCalledWith('tune_comments');
      expect(mockQB.insert).toHaveBeenCalledWith({ tune_ref: 123, user_id: 'test-user-id', body: 'Hello' });
      expect(mockQB.select).toHaveBeenCalled();
      expect(mockQB.single).toHaveBeenCalled();
      expect(result).toEqual(inserted);
    });

    it('throws if user is not logged in', async () => {
      mockClient.auth.getUser.mockResolvedValueOnce({ data: { user: null }, error: null });

      await expect(supabaseModule.addComment(123, 'Hello')).rejects.toThrow('Must be logged in');
    });

    it('throws on insert error', async () => {
      const mockQB = createMockQueryBuilder().setResult(null, { message: 'Insert failed' });
      mockFrom.mockReturnValue(mockQB);

      await expect(supabaseModule.addComment(123, 'Hello')).rejects.toThrow();
    });
  });

  describe('updateComment', () => {
    it('updates body and edited_at for given comment id', async () => {
      const mockQB = createMockQueryBuilder().setResult(null);
      mockFrom.mockReturnValue(mockQB);

      const before = Date.now();
      await supabaseModule.updateComment('comment-1', 'Updated body');
      const after = Date.now();

      expect(mockFrom).toHaveBeenCalledWith('tune_comments');
      const updateArg = mockQB.update.mock.calls[0][0];
      expect(updateArg.body).toBe('Updated body');
      expect(new Date(updateArg.edited_at).getTime()).toBeGreaterThanOrEqual(before);
      expect(new Date(updateArg.edited_at).getTime()).toBeLessThanOrEqual(after);
      expect(mockQB.eq).toHaveBeenCalledWith('id', 'comment-1');
    });

    it('throws on error', async () => {
      const mockQB = createMockQueryBuilder().setResult(null, { message: 'Update failed' });
      mockFrom.mockReturnValue(mockQB);

      await expect(supabaseModule.updateComment('comment-1', 'New')).rejects.toThrow();
    });
  });

  describe('deleteComment', () => {
    it('deletes from tune_comments by id', async () => {
      const mockQB = createMockQueryBuilder().setResult(null);
      mockFrom.mockReturnValue(mockQB);

      await supabaseModule.deleteComment('comment-1');

      expect(mockFrom).toHaveBeenCalledWith('tune_comments');
      expect(mockQB.delete).toHaveBeenCalled();
      expect(mockQB.eq).toHaveBeenCalledWith('id', 'comment-1');
    });

    it('throws on error', async () => {
      const mockQB = createMockQueryBuilder().setResult(null, { message: 'Delete failed' });
      mockFrom.mockReturnValue(mockQB);

      await expect(supabaseModule.deleteComment('comment-1')).rejects.toThrow();
    });
  });
});
