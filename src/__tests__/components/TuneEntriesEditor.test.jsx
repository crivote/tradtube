/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import TuneEntriesEditor from '../../components/TuneEntriesEditor';

vi.mock('../../lib/db', () => ({
  searchTunes: vi.fn(),
  getSettings: vi.fn(),
  getTuneById: vi.fn(),
  initDB: vi.fn(),
  searchTunesByType: vi.fn(),
  getRandomTunes: vi.fn(),
  getCountsByType: vi.fn(),
  getSimilarTunes: vi.fn(),
}));

import { searchTunes, getSettings } from '../../lib/db';

const tuneA = {
  tune_id: 1,
  name: 'The Wind',
  type: 'reel',
  meter: '4/4',
};

const entryA = {
  tune: tuneA,
  startSec: '',
  endSec: '',
  instruments: [],
  key: null,
  structure: null,
};

const renderEditor = (overrides = {}) => {
  const props = {
    entries: [],
    onAdd: vi.fn(),
    onRemove: vi.fn(),
    onUpdate: vi.fn(),
    onReorder: vi.fn(),
    audioDuration: 120,
    readOnly: false,
    ...overrides,
  };
  return render(() => (
    <I18nProvider>
      <TuneEntriesEditor {...props} />
    </I18nProvider>
  ));
};

describe('TuneEntriesEditor', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    searchTunes.mockReturnValue([]);
    getSettings.mockReturnValue([]);
  });

  it('shows empty message when there are no entries', async () => {
    renderEditor();

    await waitFor(() => {
      expect(screen.getByText('Search and add the tunes that appear in this video, in order.')).toBeDefined();
    });
  });

  it('renders entries with tune names and metadata', async () => {
    renderEditor({ entries: [entryA] });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });
    expect(screen.getByText('reel · 4/4')).toBeDefined();
  });

  it('searches tunes and adds one when clicked', async () => {
    const tuneB = { tune_id: 2, name: 'Silver Spear', type: 'reel', meter: '4/4' };
    searchTunes.mockReturnValue([tuneB]);
    const onAdd = vi.fn();

    renderEditor({ onAdd });

    const input = screen.getByPlaceholderText('Search tune name…');
    fireEvent.input(input, { target: { value: 'silver' } });

    await waitFor(() => {
      expect(screen.getByText('Silver Spear')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Silver Spear'));
    expect(onAdd).toHaveBeenCalledWith(expect.objectContaining({ tune_id: 2, name: 'Silver Spear' }));
  });

  it('removes an entry when clicking the remove button', async () => {
    const onRemove = vi.fn();
    renderEditor({ entries: [entryA], onRemove });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    fireEvent.click(screen.getByText('✕'));
    expect(onRemove).toHaveBeenCalledWith(0);
  });

  it('reorders entries with arrow buttons', async () => {
    const entries = [
      { ...entryA, tune: { ...tuneA, tune_id: 1, name: 'First' } },
      { ...entryA, tune: { ...tuneA, tune_id: 2, name: 'Second' } },
    ];
    const onReorder = vi.fn();
    renderEditor({ entries, onReorder });

    await waitFor(() => {
      expect(screen.getByText('Second')).toBeDefined();
    });

    fireEvent.click(screen.getAllByText('▼')[0]);
    expect(onReorder).toHaveBeenCalledWith(0, 1);
  });

  it('updates start timestamp on input', async () => {
    const onUpdate = vi.fn();
    renderEditor({ entries: [entryA], onUpdate });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText('0:00'), { target: { value: '1:23' } });
    expect(onUpdate).toHaveBeenCalledWith(0, 'startSec', '1:23');
  });

  it('updates structure on input', async () => {
    const onUpdate = vi.fn();
    renderEditor({ entries: [entryA], onUpdate });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText('AABB'), { target: { value: 'ABAB' } });
    expect(onUpdate).toHaveBeenCalledWith(0, 'structure', 'ABAB');
  });

  it('shows key selector when settings are available', async () => {
    getSettings.mockReturnValue([{ id: 1, key: 'D' }, { id: 2, key: 'G' }]);
    renderEditor({ entries: [entryA] });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    expect(screen.getByText('D')).toBeDefined();
    expect(screen.getByText('G')).toBeDefined();
  });

  it('does not show search or edit controls in readOnly mode', async () => {
    renderEditor({ readOnly: true, entries: [entryA] });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    expect(screen.queryByPlaceholderText('Search tune name…')).toBeNull();
    expect(screen.queryByText('✕')).toBeNull();
    expect(screen.queryByPlaceholderText('0:00')).toBeNull();
  });
});
