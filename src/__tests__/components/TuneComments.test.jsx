/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import TuneComments from '../../components/TuneComments';

vi.mock('../../lib/supabase', () => ({
  getComments: vi.fn(),
  addComment: vi.fn(),
  updateComment: vi.fn(),
  deleteComment: vi.fn(),
}));

import { getComments } from '../../lib/supabase';

const mockT = (key, params) => {
  const last = key.split('.').pop();
  if (params) {
    let s = last;
    for (const [k, v] of Object.entries(params)) {
      s = s.replace(`{{${k}}}`, String(v));
    }
    return s;
  }
  return last;
};

const mockShowToast = vi.fn();

const renderComments = (overrides = {}) => {
  return render(() => (
    <TuneComments
      tuneId={() => 310}
      authUser={() => null}
      showToast={mockShowToast}
      t={mockT}
      {...overrides}
    />
  ));
};

describe('TuneComments', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getComments.mockResolvedValue([]);
  });

  it('calls getComments exactly once with numeric id on mount', async () => {
    renderComments();

    await waitFor(() => {
      expect(getComments).toHaveBeenCalledTimes(1);
    });

    expect(getComments).toHaveBeenCalledWith(310, { limit: 20, offset: 0 });
  });

  it('shows login prompt when authUser is null', async () => {
    renderComments();

    await waitFor(() => {
      expect(screen.getByText('loginToComment')).toBeDefined();
    });
  });

  it('shows comment form when authenticated', async () => {
    renderComments({ authUser: () => ({ id: 'user-1', isAdmin: false }) });

    await waitFor(() => {
      expect(screen.getByText('publish')).toBeDefined();
    });

    expect(screen.getByText('title')).toBeDefined();
  });

  it('renders loaded comments with user name and body', async () => {
    getComments.mockResolvedValue([
      {
        id: 'c1',
        body: 'Great tune!',
        created_at: '2026-06-14T10:00:00Z',
        edited_at: null,
        user_id: 'user-1',
        profiles: { display_name: 'Alice', avatar_url: null },
      },
    ]);

    renderComments({ authUser: () => ({ id: 'user-2', isAdmin: false }) });

    await waitFor(() => {
      expect(screen.getByText('Great tune!')).toBeDefined();
    });

    expect(screen.getByText('Alice')).toBeDefined();
  });

  it('shows edit and delete buttons for own comment', async () => {
    getComments.mockResolvedValue([
      {
        id: 'c1',
        body: 'My comment',
        created_at: '2026-06-14T10:00:00Z',
        edited_at: null,
        user_id: 'user-1',
        profiles: { display_name: 'Me', avatar_url: null },
      },
    ]);

    renderComments({ authUser: () => ({ id: 'user-1', isAdmin: false }) });

    await waitFor(() => {
      expect(screen.getByText('edit')).toBeDefined();
    });

    expect(screen.getByText('delete')).toBeDefined();
  });

  it('does not show edit/delete for other users comment when not admin', async () => {
    getComments.mockResolvedValue([
      {
        id: 'c1',
        body: 'Other comment',
        created_at: '2026-06-14T10:00:00Z',
        edited_at: null,
        user_id: 'user-1',
        profiles: { display_name: 'Other', avatar_url: null },
      },
    ]);

    renderComments({ authUser: () => ({ id: 'user-2', isAdmin: false }) });

    await waitFor(() => {
      expect(screen.getByText('Other comment')).toBeDefined();
    });

    expect(screen.queryByText('edit')).toBeNull();
    expect(screen.queryByText('delete')).toBeNull();
  });

  it('shows edit/delete buttons to admin for any comment', async () => {
    getComments.mockResolvedValue([
      {
        id: 'c1',
        body: 'User comment',
        created_at: '2026-06-14T10:00:00Z',
        edited_at: null,
        user_id: 'user-1',
        profiles: { display_name: 'User', avatar_url: null },
      },
    ]);

    renderComments({ authUser: () => ({ id: 'admin-1', isAdmin: true }) });

    await waitFor(() => {
      expect(screen.getByText('edit')).toBeDefined();
    });

    expect(screen.getByText('delete')).toBeDefined();
  });

  it('shows edited label when comment has been edited', async () => {
    getComments.mockResolvedValue([
      {
        id: 'c1',
        body: 'Edited text',
        created_at: '2026-06-13T10:00:00Z',
        edited_at: '2026-06-14T10:00:00Z',
        user_id: 'user-1',
        profiles: { display_name: 'Editor', avatar_url: null },
      },
    ]);

    renderComments();

    await waitFor(() => {
      expect(screen.getByText(/editedLabel/)).toBeDefined();
    });
  });

  it('shows no-comments message when list is empty', async () => {
    getComments.mockResolvedValue([]);

    renderComments();

    await waitFor(() => {
      expect(screen.getByText('noComments')).toBeDefined();
    });
  });

  it('does not call getComments when tuneId returns undefined', () => {
    renderComments({ tuneId: () => undefined });

    expect(getComments).not.toHaveBeenCalled();
  });

  it('shows load more button when hasMore is true', async () => {
    const twentyComments = Array.from({ length: 20 }, (_, i) => ({
      id: `c${i}`,
      body: `Comment ${i}`,
      created_at: '2026-06-14T10:00:00Z',
      edited_at: null,
      user_id: 'user-1',
      profiles: { display_name: `User ${i}`, avatar_url: null },
    }));
    getComments.mockResolvedValue(twentyComments);

    renderComments();

    await waitFor(() => {
      expect(screen.getByText('loadMore')).toBeDefined();
    });
  });
});
