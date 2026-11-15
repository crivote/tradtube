/**
 * @vitest-environment jsdom
 *
 * Invariante: el borrado desde la pantalla de edición exige DOS pasos — marcar
 * el vídeo como no disponible y sólo entonces borrar — y persiste el flag
 * antes de eliminar la fila.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@solidjs/testing-library';
import { I18nProvider } from '../../i18n';
import AddVideoForm from '../../components/AddVideoForm';

vi.mock('../../store/appStore', () => ({
  useAppStore: vi.fn(),
}));

vi.mock('../../lib/db', () => ({
  searchTunes: vi.fn(),
  getTuneById: vi.fn(),
  getSettings: vi.fn(),
  findMatchingTunes: vi.fn(),
  initDB: vi.fn(),
  searchTunesByType: vi.fn(),
  getRandomTunes: vi.fn(),
  getCountsByType: vi.fn(),
  getSimilarTunes: vi.fn(),
}));

vi.mock('../../lib/supabase', () => ({
  addVideoWithEntries: vi.fn(),
  updateVideoWithEntries: vi.fn(),
  checkYoutubeIdExists: vi.fn(),
  upsertAlbum: vi.fn(),
  deleteVideo: vi.fn(),
  setMediaUnavailable: vi.fn(),
}));

vi.mock('../../lib/thesession', () => ({
  resolveTrackTunes: vi.fn(),
}));

import { useAppStore } from '../../store/appStore';
import { searchTunes, getTuneById, findMatchingTunes } from '../../lib/db';
import { deleteVideo, setMediaUnavailable } from '../../lib/supabase';

const editVideo = (overrides = {}) => ({
  id: 'media-1',
  media_uri: 'https://www.youtube.com/watch?v=dQw4w9WgXcQ',
  title: 'Some set',
  channel: 'Someone',
  source_type: 'session',
  unavailable: false,
  tune_media_entries: [],
  ...overrides,
});

const renderForm = (props = {}) => {
  const onClose = vi.fn();
  const utils = render(() => (
    <I18nProvider>
      <AddVideoForm onClose={onClose} {...props} />
    </I18nProvider>
  ));
  return { ...utils, onClose };
};

describe('AddVideoForm — borrado con salvaguarda', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    useAppStore.mockReturnValue({ showToast: vi.fn(), loadVideoData: vi.fn() });
    searchTunes.mockReturnValue([]);
    getTuneById.mockReturnValue(null);
    findMatchingTunes.mockReturnValue([]);
    setMediaUnavailable.mockResolvedValue();
    deleteVideo.mockResolvedValue(1);
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('no ofrece borrar al añadir un vídeo nuevo', async () => {
    renderForm();

    await waitFor(() => {
      expect(screen.getByText('Add a video')).toBeDefined();
    });
    expect(screen.queryByText('Danger zone')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Delete video' })).toBeNull();
  });

  it('mantiene el borrado deshabilitado hasta marcar el vídeo como no disponible', async () => {
    renderForm({ editVideo: editVideo() });

    const button = await screen.findByRole('button', { name: 'Delete video' });
    expect(button.disabled).toBe(true);
    expect(screen.getByText('To delete this video, mark it as unavailable first.')).toBeDefined();

    fireEvent.click(screen.getByRole('switch'));

    await waitFor(() => expect(button.disabled).toBe(false));
    expect(screen.getByText('The video is marked as unavailable. You can delete it now.')).toBeDefined();
  });

  it('permite borrar de entrada si el vídeo ya venía marcado como no disponible', async () => {
    renderForm({ editVideo: editVideo({ unavailable: true }) });

    const button = await screen.findByRole('button', { name: 'Delete video' });
    await waitFor(() => expect(button.disabled).toBe(false));
  });

  it('persiste el flag y después borra, en ese orden, y cierra el formulario', async () => {
    const order = [];
    setMediaUnavailable.mockImplementation(async () => { order.push('mark'); });
    deleteVideo.mockImplementation(async () => { order.push('delete'); return 1; });

    const { onClose } = renderForm({ editVideo: editVideo() });
    fireEvent.click(await screen.findByRole('switch'));

    const button = screen.getByRole('button', { name: 'Delete video' });
    await waitFor(() => expect(button.disabled).toBe(false));
    fireEvent.click(button);

    await waitFor(() => expect(deleteVideo).toHaveBeenCalled());
    expect(order).toEqual(['mark', 'delete']);
    expect(setMediaUnavailable).toHaveBeenCalledWith('media-1', true);
    expect(deleteVideo).toHaveBeenCalledWith('media-1', { requireUnavailable: true });
    expect(onClose).toHaveBeenCalled();
  });

  it('no borra nada si el administrador cancela la confirmación', async () => {
    vi.stubGlobal('confirm', vi.fn(() => false));

    renderForm({ editVideo: editVideo({ unavailable: true }) });
    const button = await screen.findByRole('button', { name: 'Delete video' });
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);

    expect(setMediaUnavailable).not.toHaveBeenCalled();
    expect(deleteVideo).not.toHaveBeenCalled();
  });

  it('muestra el error cuando el borrado no afecta a ninguna fila', async () => {
    deleteVideo.mockRejectedValue(new Error('no se borró ninguna fila'));

    renderForm({ editVideo: editVideo({ unavailable: true }) });
    const button = await screen.findByRole('button', { name: 'Delete video' });
    await waitFor(() => expect(button.disabled).toBe(false));

    fireEvent.click(button);

    // El detalle técnico va a la consola; en pantalla, mensaje en el idioma de la UI.
    await waitFor(() => {
      expect(screen.getByText('Could not delete the video')).toBeDefined();
    });
  });
});
