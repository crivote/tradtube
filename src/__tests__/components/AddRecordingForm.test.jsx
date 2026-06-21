/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import AddRecordingForm from '../../components/AddRecordingForm';

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}));

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

import { useAppStore } from '../../store/appStore';
import { searchTunes, getSettings } from '../../lib/db';

const initialTune = {
  tune_id: 310,
  name: 'The Wind',
  type: 'reel',
  meter: '4/4',
};

const renderForm = (overrides = {}) => {
  const props = {
    blob: null,
    durationSeconds: 120,
    initialTune: null,
    onSubmit: vi.fn(),
    onCancel: vi.fn(),
    ...overrides,
  };
  return render(() => (
    <I18nProvider>
      <AddRecordingForm {...props} />
    </I18nProvider>
  ));
};

describe('AddRecordingForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.mockReturnValue({ authUser: () => null });
    searchTunes.mockReturnValue([]);
    getSettings.mockReturnValue([]);
  });

  it('renders header and metadata fields', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('New Recording')).toBeDefined();
    });

    expect(screen.getByPlaceholderText('Your name')).toBeDefined();
    expect(screen.getByPlaceholderText('Location, date, context...')).toBeDefined();
  });

  it('shows initial tune name in subtitle when provided', async () => {
    renderForm({ initialTune });

    await waitFor(() => {
      expect(screen.getByText(/Recording for "The Wind"/)).toBeDefined();
    });
  });

  it('does not render audio preview when blob is null', async () => {
    renderForm({ durationSeconds: 120 });

    await waitFor(() => {
      expect(screen.getByText('New Recording')).toBeDefined();
    });

    expect(screen.queryByLabelText('Preview')).toBeNull();
    expect(screen.queryByRole('audio')).toBeNull();
  });

  it('disables save when there are no entries', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Save Recording')).toBeDefined();
    });

    const saveButton = screen.getByText('Save Recording').closest('button');
    expect(saveButton.disabled).toBe(true);
  });

  it('calls onCancel when clicking cancel', async () => {
    const onCancel = vi.fn();
    renderForm({ onCancel });

    await waitFor(() => {
      expect(screen.getByText('Cancel')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Cancel'));
    expect(onCancel).toHaveBeenCalled();
  });

  it('submits the recording with initial tune and metadata', async () => {
    const onSubmit = vi.fn();
    renderForm({ initialTune, onSubmit });

    await waitFor(() => {
      expect(screen.getByText('The Wind')).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'Jane Doe' } });
    fireEvent.input(screen.getByPlaceholderText('Location, date, context...'), { target: { value: 'Kitchen session' } });
    fireEvent.click(screen.getByText('Save Recording'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        blob: null,
        performer_name: 'Jane Doe',
        recording_notes: 'Kitchen session',
        entries: expect.arrayContaining([
          expect.objectContaining({
            tune_id: 310,
            start_sec: 0,
            end_sec: null,
            position: 0,
          }),
        ]),
      }));
    });
  });

  it('can add a tune via search and submit the form', async () => {
    const newTune = { tune_id: 2, name: 'Silver Spear', type: 'reel', meter: '4/4' };
    searchTunes.mockReturnValue([newTune]);
    const onSubmit = vi.fn();

    renderForm({ onSubmit });

    await waitFor(() => {
      expect(screen.getByText('New Recording')).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText('Search tune name…'), { target: { value: 'silver' } });

    await waitFor(() => {
      expect(screen.getByText('Silver Spear')).toBeDefined();
    });

    fireEvent.click(screen.getByText('Silver Spear'));

    await waitFor(() => {
      expect(screen.getByText('Silver Spear')).toBeDefined();
    });

    fireEvent.input(screen.getByPlaceholderText('Your name'), { target: { value: 'John' } });
    fireEvent.click(screen.getByText('Save Recording'));

    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({
        performer_name: 'John',
        entries: expect.arrayContaining([
          expect.objectContaining({ tune_id: 2, position: 0 }),
        ]),
      }));
    });
  });
});
