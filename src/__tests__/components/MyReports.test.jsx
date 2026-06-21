/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import MyReports from '../../components/MyReports';

vi.mock('../../lib/supabase', () => ({
  getMyReports: vi.fn(),
}));

import { getMyReports } from '../../lib/supabase';

const mockReports = [
  {
    id: 'r1',
    issue_type: 'wrong_tune',
    status: 'pending',
    created_at: '2026-06-14T10:00:00Z',
    closed_at: null,
    admin_comments: null,
    tune_media: { title: 'Video title', media_uri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ' },
  },
  {
    id: 'r2',
    issue_type: 'duplicate',
    status: 'solved',
    created_at: '2026-06-10T10:00:00Z',
    closed_at: '2026-06-12T10:00:00Z',
    admin_comments: 'Thanks for reporting.',
    tune_media: null,
  },
];

const renderMyReports = (overrides = {}) => {
  const props = {
    onClose: vi.fn(),
    ...overrides,
  };
  return render(() => (
    <I18nProvider>
      <MyReports {...props} />
    </I18nProvider>
  ));
};

describe('MyReports', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getMyReports.mockResolvedValue([]);
  });

  it('calls getMyReports on mount', async () => {
    renderMyReports();

    await waitFor(() => {
      expect(getMyReports).toHaveBeenCalledTimes(1);
    });
  });

  it('shows loading state initially', async () => {
    getMyReports.mockImplementation(() => new Promise(() => {}));
    renderMyReports();

    await waitFor(() => {
      expect(screen.getByText('Loading…')).toBeDefined();
    });
  });

  it('shows empty message when there are no reports', async () => {
    getMyReports.mockResolvedValue([]);
    renderMyReports();

    await waitFor(() => {
      expect(screen.getByText(/submitted any reports/)).toBeDefined();
    });
  });

  it('renders reports with issue type and status badges', async () => {
    getMyReports.mockResolvedValue(mockReports);
    renderMyReports();

    await waitFor(() => {
      expect(screen.getByText('Wrong tune')).toBeDefined();
    });

    expect(screen.getByText('Pending')).toBeDefined();
    expect(screen.getByText('Duplicate video')).toBeDefined();
    expect(screen.getByText('Solved')).toBeDefined();
  });

  it('renders video info and link when tune_media is present', async () => {
    getMyReports.mockResolvedValue([mockReports[0]]);
    renderMyReports();

    await waitFor(() => {
      expect(screen.getByText('Video title')).toBeDefined();
    });

    expect(screen.getByText('View video')).toBeDefined();
    expect(screen.getByText('dQw4w9WgXcQ')).toBeDefined();
  });

  it('renders admin comments and closed date for resolved reports', async () => {
    getMyReports.mockResolvedValue([mockReports[1]]);
    renderMyReports();

    await waitFor(() => {
      expect(screen.getByText('Duplicate video')).toBeDefined();
    });

    expect(screen.getByText('Admin comments')).toBeDefined();
    expect(screen.getByText('Thanks for reporting.')).toBeDefined();
    expect(screen.getByText(/Closed:/)).toBeDefined();
  });

  it('calls onClose when clicking the close button', async () => {
    const onClose = vi.fn();
    renderMyReports({ onClose });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onClose).toHaveBeenCalled();
  });
});
