/**
 * lib/supabase.js
 * Cliente Supabase singleton
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';
import { extractYoutubeId } from './utils';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Obtiene las entries para un tune_id.
 * Cada entry incluye los datos del medio padre y el score de votos.
 * Ordenadas por score descendente.
 */
export async function getEntriesForTune(tuneId) {
  const { data: { user } } = await supabase.auth.getUser();

  const { data, error } = await supabase
    .from('tune_media_entries')
    .select(`
      id, tune_id, setting_id, start_sec, end_sec, position, instruments, key,
      tune_media!inner(
        id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, created_at, hidden
      ),
      tune_media_votes ( vote, user_id )
    `)
    .eq('tune_id', tuneId)
    .eq('tune_media.hidden', false)
    .order('position', { ascending: true });

  if (error) { console.error(error); return []; }

  const available = (data || []).filter(e => !e.tune_media?.unavailable);

  return available
    .map(e => ({
      ...e,
      voteScore: (e.tune_media_votes || []).reduce((acc, r) => acc + r.vote, 0),
      userVote: user ? (e.tune_media_votes || []).find(r => r.user_id === user.id)?.vote ?? 0 : 0,
    }))
    .sort((a, b) => b.voteScore - a.voteScore);
}

/**
 * Añade un vídeo de YouTube con sus entries.
 */
export async function addVideoWithEntries({ youtube_id, source_type, title, channel, thesession_recording_id, entries }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to add a video');

  const media_uri = `https://www.youtube.com/watch?v=${youtube_id}`;

  const { data: media, error: mediaError } = await supabase
    .from('tune_media')
    .insert([{
      media_uri, source_type,
      title: title ?? null, channel: channel ?? null,
      thesession_recording_id: thesession_recording_id ?? null,
      added_by: user.id,
      status: 'new',
    }])
    .select()
    .single();

  if (mediaError) throw mediaError;

  const entryRows = entries.map((e, i) => ({
    media_id: media.id,
    tune_id: e.tune_id,
    setting_id: e.setting_id ?? null,
    start_sec: e.start_sec ?? 0,
    end_sec: e.end_sec ?? null,
    position: e.position ?? i,
    instruments: e.instruments?.length > 0 ? e.instruments : null,
    key: e.key ?? null,
  }));

  const { error: entriesError } = await supabase
    .from('tune_media_entries')
    .insert(entryRows);

  if (entriesError) throw entriesError;

  return media;
}

/**
 * Comprueba si un youtube_id ya existe en tune_media.
 */
export async function checkYoutubeIdExists(youtubeId) {
  const mediaUri = `https://www.youtube.com/watch?v=${youtubeId}`;

  const { data, error } = await supabase
    .from('tune_media')
    .select('id, media_uri, title, channel, status, tune_media_entries ( tune_id )')
    .eq('media_uri', mediaUri)
    .maybeSingle();

  if (error || !data) return null;
  const firstTuneId = data.tune_media_entries?.[0]?.tune_id ?? null;
  return { id: data.id, media_uri: data.media_uri, title: data.title, channel: data.channel, status: data.status, tune_id: firstTuneId };
}

/**
 * Registra un voto sobre una entry concreta.
 */
export async function castVote(entryId, vote, isReport = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to vote');

  const { error } = await supabase
    .from('tune_media_votes')
    .upsert(
      { entry_id: entryId, user_id: user.id, vote, is_report: isReport },
      { onConflict: 'entry_id,user_id' }
    );

  if (error) throw error;
}

// ── Admin ────────────────────────────────────────────────────────────────────

export async function getLatestMedia() {
  const { data, error } = await supabase
    .from('tune_media')
    .select(`
      id, media_uri, source_type, status, unavailable, title, channel, added_by, created_at, hidden,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .eq('hidden', false)
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error(error); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_media_entries: [...(v.tune_media_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getPendingVideos() {
  const { data, error } = await supabase
    .from('tune_media')
    .select(`
      id, media_uri, source_type, status, unavailable, title, channel, added_by, created_at,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .eq('status', 'new')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_media_entries: [...(v.tune_media_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getVideosByTune(tuneId) {
  const { data: entryData, error: e1 } = await supabase
    .from('tune_media_entries')
    .select('media_id')
    .eq('tune_id', tuneId);

  if (e1) { console.error(e1); return []; }
  const mediaIds = [...new Set((entryData || []).map(e => e.media_id))];
  if (mediaIds.length === 0) return [];

  const { data, error: e2 } = await supabase
    .from('tune_media')
    .select(`
      id, media_uri, source_type, status, unavailable, title, channel, added_by, created_at,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .in('id', mediaIds)
    .order('created_at', { ascending: false });

  if (e2) { console.error(e2); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_media_entries: [...(v.tune_media_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function reviewVideo(videoId) {
  const { error } = await supabase
    .from('tune_media').update({ status: 'reviewed' }).eq('id', videoId);
  if (error) throw error;
}

export async function deleteVideo(videoId) {
  const { error } = await supabase
    .from('tune_media').delete().eq('id', videoId);
  if (error) throw error;
}

export async function updateVideoWithEntries(videoId, { source_type, title, channel, thesession_recording_id, unavailable, entries }) {
  const { error: ve } = await supabase
    .from('tune_media').update({ source_type, title: title ?? null, channel: channel ?? null, thesession_recording_id: thesession_recording_id ?? null, unavailable: unavailable ?? false }).eq('id', videoId);
  if (ve) throw ve;

  const { error: de } = await supabase
    .from('tune_media_entries').delete().eq('media_id', videoId);
  if (de) throw de;

  if (entries.length === 0) return;
  const { error: ie } = await supabase
    .from('tune_media_entries')
    .insert(entries.map((e, i) => ({
      media_id: videoId,
      tune_id: e.tune_id,
      setting_id: e.setting_id ?? null,
      start_sec: e.start_sec ?? 0,
      end_sec: e.end_sec ?? null,
      position: i,
      instruments: e.instruments?.length > 0 ? e.instruments : null,
      key: e.key ?? null,
    })));
  if (ie) throw ie;
}

export async function getPendingCount() {
  const { count, error } = await supabase
    .from('tune_media')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'new');
  if (error) { console.error(error); return 0; }
  return count || 0;
}

export async function getPendingReportsCount() {
  const { count, error } = await supabase
    .from('tune_media_reports')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) { console.error(error); return 0; }
  return count || 0;
}

/**
 * Devuelve un Map<tune_id, clipCount> para los badges de búsqueda.
 */
export async function getVideoCountsByTune() {
  const { data, error } = await supabase
    .from('tune_media')
    .select('id, media_uri, tune_media_entries(tune_id)')
    .eq('unavailable', false)
    .eq('hidden', false);

  if (error) { console.error(error); return { counts: new Map(), thumbnails: new Map() }; }

  const counts = new Map();
  const thumbnails = new Map();
  for (const media of data || []) {
    for (const entry of media.tune_media_entries || []) {
      counts.set(entry.tune_id, (counts.get(entry.tune_id) || 0) + 1);
      if (!thumbnails.has(entry.tune_id)) {
        const ytId = extractYoutubeId(media.media_uri);
        if (ytId) thumbnails.set(entry.tune_id, ytId);
      }
    }
  }
  return { counts, thumbnails };
}

export async function getTuneIdsByInstrument(instrument) {
  const { data, error } = await supabase
    .from('tune_media_entries')
    .select('tune_id, instruments, tune_media!inner(unavailable, hidden)')
    .contains('instruments', [instrument])
    .eq('tune_media.unavailable', false)
    .eq('tune_media.hidden', false);

  if (error) { console.error(error); return new Set(); }
  return new Set((data || []).map(e => e.tune_id));
}

// ── Auth ─────────────────────────────────────────────────────────────────────

export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.href },
  });
  if (error) throw error;
}

export async function logout() {
  await supabase.auth.signOut();
}

export function onAuthChange(callback) {
  return supabase.auth.onAuthStateChange((_event, session) => {
    callback(session?.user ?? null);
  });
}

export async function getUserRole(userId) {
  const { data, error } = await supabase
    .from('user_roles')
    .select('role')
    .eq('user_id', userId)
    .maybeSingle();

  if (error || !data) return null;
  return data.role;
}

export async function getVideoById(videoId) {
  const { data, error } = await supabase
    .from('tune_media')
    .select(`
      id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, created_at,
      tune_media_entries (
        id, tune_id, setting_id, start_sec, end_sec, position, instruments, key
      )
    `)
    .eq('id', videoId)
    .single();

  if (error) { console.error(error); return null; }
  return data;
}

/**
 * Sube una grabación de usuario a Storage, la inserta en tune_media
 * y crea sus entries. Rollback completo si cualquier paso falla.
 */
export async function addRecordingWithEntries({ blob, performer_name, recording_notes, entries }) {
  await supabase.auth.refreshSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const fileName = `${user.id}/${crypto.randomUUID()}.ogg`;

  const { error: storageError } = await supabase.storage
    .from('user-recordings')
    .upload(fileName, blob, { contentType: 'audio/ogg; codecs=opus', upsert: false });
  if (storageError) throw new Error('Failed to upload recording');

  const { data: urlData } = supabase.storage
    .from('user-recordings').getPublicUrl(fileName);

  const { data: media, error: mediaError } = await supabase
    .from('tune_media')
    .insert({
      source_type: 'user_recording',
      media_uri: urlData.publicUrl,
      status: 'new',
      added_by: user.id,
      performer_name,
      recording_notes: recording_notes || null,
    }).select().single();

  if (mediaError) {
    await supabase.storage.from('user-recordings').remove([fileName]);
    throw new Error('Failed to save recording');
  }

  const { error: entriesError } = await supabase
    .from('tune_media_entries')
    .insert(entries.map((e, i) => ({
      media_id: media.id,
      tune_id: e.tune_id,
      setting_id: e.setting_id ?? null,
      start_sec: e.start_sec ?? 0,
      end_sec: e.end_sec ?? null,
      position: i,
      instruments: e.instruments?.length > 0 ? e.instruments : null,
      key: e.key ?? null,
    })));

  if (entriesError) {
    await supabase.from('tune_media').delete().eq('id', media.id);
    await supabase.storage.from('user-recordings').remove([fileName]);
    throw new Error('Failed to save tune entries');
  }

  return media;
}

// ── User Recordings ──────────────────────────────────────────────────────────

export async function getUserRecordings(userId) {
  const { data, error } = await supabase
    .from('tune_media')
    .select(`id, media_uri, performer_name, recording_notes, status, hidden, created_at,
      tune_media_entries(tune_id, start_sec, end_sec, instruments, key, position)`)
    .eq('source_type', 'user_recording')
    .eq('added_by', userId)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function toggleHidden(mediaId, hidden) {
  const { error } = await supabase
    .from('tune_media')
    .update({ hidden })
    .eq('id', mediaId);

  if (error) throw error;
}

export async function deleteRecording(mediaId) {
  const { data: media, error: fetchError } = await supabase
    .from('tune_media')
    .select('media_uri')
    .eq('id', mediaId)
    .single();

  if (fetchError) throw fetchError;

  const { error: deleteError } = await supabase
    .from('tune_media')
    .delete()
    .eq('id', mediaId);

  if (deleteError) throw deleteError;

  if (media?.media_uri) {
    const url = new URL(media.media_uri);
    const pathParts = url.pathname.split('/');
    const bucketIdx = pathParts.indexOf('user-recordings');
    if (bucketIdx !== -1) {
      const filePath = pathParts.slice(bucketIdx + 1).join('/');
      await supabase.storage.from('user-recordings').remove([filePath]);
    }
  }
}

// ── Reports ──────────────────────────────────────────────────────────────────

export async function createReport({ media_id, tune_id, issue_type, description, email }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('tune_media_reports')
    .insert({
      media_id: media_id ?? null,
      tune_id: tune_id ?? null,
      user_id: user?.id ?? null,
      email: email || null,
      issue_type,
      description: description || null,
    });

  if (error) throw error;
}

export async function getReports(status) {
  let query = supabase
    .from('tune_media_reports')
    .select(`
      id, created_at, media_id, tune_id, user_id, email, issue_type, description, status, admin_comments, closed_at,
      tune_media (id, media_uri, title, source_type, status)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function getMyReports() {
  const { data, error } = await supabase
    .from('tune_media_reports')
    .select(`
      id, created_at, media_id, tune_id, issue_type, description, status, admin_comments, closed_at,
      tune_media (id, media_uri, title, source_type, status)
    `)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return data ?? [];
}

export async function updateReport(reportId, { status, admin_comments }) {
  const updates = {};
  if (status !== undefined) {
    updates.status = status;
    if (status === 'solved' || status === 'discarded') {
      updates.closed_at = new Date().toISOString();
    }
  }
  if (admin_comments !== undefined) updates.admin_comments = admin_comments;

  const { error } = await supabase
    .from('tune_media_reports')
    .update(updates)
    .eq('id', reportId);

  if (error) throw error;
}
