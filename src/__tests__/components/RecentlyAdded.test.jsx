/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import RecentlyAdded from '../../components/RecentlyAdded';

vi.mock('@solidjs/router', () => ({
  useNavigate: () => vi.fn(),
}));

vi.mock('../../lib/recentlyAdded', () => ({
  loadRecentlyAdded: vi.fn(),
}));

import { loadRecentlyAdded } from '../../lib/recentlyAdded';

describe('RecentlyAdded', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    loadRecentlyAdded.mockResolvedValue([]);
  });

  it('renders carousel with recent additions', async () => {
    loadRecentlyAdded.mockResolvedValue([
      { tune_id: 1, name: 'New Tune', type: 'reel', youtubeId: 'abc123', created_at: '2026-06-21T10:00:00Z' },
    ]);

    render(() => (
      <I18nProvider>
        <RecentlyAdded />
      </I18nProvider>
    ));

    await waitFor(() => {
      expect(screen.getByText('New additions')).toBeDefined();
    });
    expect(screen.getByText('New Tune')).toBeDefined();
    expect(loadRecentlyAdded).toHaveBeenCalledWith(10);
  });

  it('renders nothing when there are no recent additions', async () => {
    loadRecentlyAdded.mockResolvedValue([]);

    render(() => (
      <I18nProvider>
        <RecentlyAdded />
      </I18nProvider>
    ));

    await waitFor(() => {
      expect(screen.queryByText('New additions')).toBeNull();
    });
  });
});
