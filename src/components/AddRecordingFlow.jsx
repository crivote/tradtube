/**
 * AddRecordingFlow.jsx
 * Orquesta AudioRecorder → AddRecordingForm → addRecordingWithEntries.
 *
 * Props:
 *   initialTune: object?   — tune para pre-poblar el primer entry
 *   onClose(): void        — cerrar el modal
 */

import { createSignal, Show } from 'solid-js';
import { useNavigate } from '@solidjs/router';
import AudioRecorder from './AudioRecorder';
import AddRecordingForm from './AddRecordingForm';
import { addRecordingWithEntries } from '../lib/supabase';
import { useAppStore } from '../store/appStore';

export default function AddRecordingFlow(props) {
  const [blob, setBlob] = createSignal(null);
  const [duration, setDuration] = createSignal(0);
  const [submitting, setSubmitting] = createSignal(false);
  const { showToast, loadVideoData } = useAppStore();
  const navigate = useNavigate();

  const handleAudioReady = (b, d) => {
    setBlob(b);
    setDuration(d);
  };

  const handleSubmit = async (payload) => {
    setSubmitting(true);
    try {
      await addRecordingWithEntries(payload);
      showToast('Recording published!', 'success');
      loadVideoData();
      const firstTuneId = payload.entries[0]?.tune_id;
      if (firstTuneId) {
        navigate(`/tune/${firstTuneId}`);
      }
      props.onClose();
    } catch (err) {
      showToast(err.message || 'Failed to publish recording', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div class="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 bg-black/60 overflow-y-auto">
      <div class="bg-[var(--color-surface)] rounded-2xl p-6 max-w-2xl w-full shadow-2xl border border-[var(--color-border)]">
        <Show
          when={blob()}
          fallback={
            <AudioRecorder onAudioReady={handleAudioReady} onCancel={props.onClose} />
          }
        >
          <AddRecordingForm
            blob={blob()}
            durationSeconds={duration()}
            initialTune={props.initialTune}
            onSubmit={handleSubmit}
            onCancel={props.onClose}
          />
        </Show>
      </div>
    </div>
  );
}
