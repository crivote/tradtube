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
      id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure,
      tune_media!inner(
        id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, created_at, hidden, bpm
      ),
      tune_media_votes ( vote, user_id )
    `)
    .eq('tune_id', tuneId)
    .eq('tune_media.hidden', false)
    .neq('tune_media.status', 'llm_guess')
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
export async function addVideoWithEntries({ youtube_id, source_type, title, channel, thesession_recording_id, bpm, entries }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to add a video');

  const media_uri = `https://www.youtube.com/watch?v=${youtube_id}`;

  const { data: media, error: mediaError } = await supabase
    .from('tune_media')
    .insert([{
      media_uri, source_type,
      title: title ?? null, channel: channel ?? null,
      thesession_recording_id: thesession_recording_id ?? null,
      bpm: bpm ?? null,
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
    structure: e.structure ?? null,
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
      id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, added_by, created_at, hidden, bpm,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure )
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
      id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, added_by, created_at, bpm,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure )
    `)
    .in('status', ['new', 'llm_guess'])
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
      id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, added_by, created_at, bpm,
      tune_media_entries ( id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure )
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

export async function updateVideoWithEntries(videoId, { source_type, title, channel, thesession_recording_id, unavailable, bpm, entries }) {
  // NOTE: delete+insert is not transactional — if inserts fail the video
  // is left without entries. A Postgres RPC would fix this properly.
  const { error: ve } = await supabase
    .from('tune_media').update({ source_type, title: title ?? null, channel: channel ?? null, thesession_recording_id: thesession_recording_id ?? null, bpm: bpm ?? null, unavailable: unavailable ?? false }).eq('id', videoId);
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
      structure: e.structure ?? null,
    })));
  if (ie) throw ie;
}

export async function getPendingCount() {
  const { count, error } = await supabase
    .from('tune_media')
    .select('id', { count: 'exact', head: true })
    .in('status', ['new', 'llm_guess']);
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
 * Excluye vídeos con status 'llm_guess' (no visibles para público).
 */
export async function getVideoCountsByTune() {
  const { data, error } = await supabase
    .from('tune_media')
    .select('id, media_uri, tune_media_entries(tune_id)')
    .eq('unavailable', false)
    .eq('hidden', false)
    .neq('status', 'llm_guess');

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
    .eq('tune_media.hidden', false)
    .neq('tune_media.status', 'llm_guess');

  if (error) { console.error(error); return new Set(); }
  return new Set((data || []).map(e => e.tune_id));
}

/**
 * Devuelve las adiciones recientes visibles (tune_media + entries).
 * Si se pasa `since` (ISO string), filtra los creados desde esa fecha.
 * Devuelve un array de { tune_id, youtubeId, created_at } sin duplicados
 * de tune_id, ordenados de más reciente a más antiguo.
 */
export async function getRecentlyAddedTunes(since = null, limit = 20) {
  let query = supabase
    .from('tune_media')
    .select('id, media_uri, created_at, tune_media_entries(tune_id)')
    .eq('unavailable', false)
    .eq('hidden', false)
    .neq('status', 'llm_guess')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (since) {
    query = query.gte('created_at', since);
  }

  const { data, error } = await query;
  if (error) { console.error(error); return []; }

  const seen = new Set();
  const results = [];
  for (const media of data || []) {
    const youtubeId = extractYoutubeId(media.media_uri);
    for (const entry of media.tune_media_entries || []) {
      const tuneId = entry.tune_id;
      if (seen.has(tuneId)) continue;
      seen.add(tuneId);
      results.push({ tune_id: tuneId, youtubeId, created_at: media.created_at });
    }
  }
  return results;
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
      id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, created_at, bpm,
      tune_media_entries (
        id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure
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
export async function addRecordingWithEntries({ blob, ext = 'ogg', performer_name, recording_notes, entries }) {
  await supabase.auth.refreshSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const fileName = `${user.id}/${crypto.randomUUID()}.${ext}`;

  const contentTypeMap = { ogg: 'audio/ogg; codecs=opus', m4a: 'audio/mp4', webm: 'audio/webm;codecs=opus' };
  const contentType = contentTypeMap[ext] ?? 'audio/ogg; codecs=opus';

  const { error: storageError } = await supabase.storage
    .from('user-recordings')
    .upload(fileName, blob, { contentType, upsert: false });
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
    const r = await supabase.storage.from('user-recordings').remove([fileName]);
    if (r.error) console.error('Rollback: failed to remove storage file after media insert error', r.error);
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
      structure: e.structure ?? null,
    })));

  if (entriesError) {
    const r1 = await supabase.from('tune_media').delete().eq('id', media.id);
    if (r1.error) console.error('Rollback: failed to delete tune_media', r1.error);
    const r2 = await supabase.storage.from('user-recordings').remove([fileName]);
    if (r2.error) console.error('Rollback: failed to remove storage file', r2.error);
    throw new Error('Failed to save tune entries');
  }

  return media;
}

// ── User Recordings ──────────────────────────────────────────────────────────

export async function getUserRecordings(userId) {
  const { data, error } = await supabase
    .from('tune_media')
    .select(`id, media_uri, performer_name, recording_notes, status, hidden, created_at,
      tune_media_entries(tune_id, start_sec, end_sec, instruments, key, structure, position)`)
    .eq('source_type', 'user_recording')
    .eq('added_by', userId)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return data ?? [];
}

/**
 * Obtiene todos los vídeos enviados por el usuario autenticado (YouTube + grabaciones).
 * Incluye status, entries asociadas, ordenado por created_at desc.
 */
export async function getMySubmissions() {
  await supabase.auth.refreshSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tune_media')
    .select(`id, media_uri, source_type, status, title, channel, performer_name, created_at,
      tune_media_entries(tune_id, setting_id, start_sec, end_sec, position)`)
    .eq('added_by', user.id)
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
      const { error: removeError } = await supabase.storage.from('user-recordings').remove([filePath]);
      if (removeError) console.error('Failed to remove recording file from storage:', removeError);
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
  await supabase.auth.refreshSession();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('tune_media_reports')
    .select(`
      id, created_at, media_id, tune_id, issue_type, description, status, admin_comments, closed_at,
      tune_media (id, media_uri, title, source_type, status)
    `)
    .eq('user_id', user.id)
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

// ── Comments ──────────────────────────────────────────────────────────────────

export async function getComments(tuneRef, { limit = 20, offset = 0 } = {}) {
  const { data, error } = await supabase
    .from('tune_comments')
    .select('id, body, created_at, edited_at, user_id')
    .eq('tune_ref', tuneRef)
    .order('created_at', { ascending: true })
    .range(offset, offset + limit - 1);
  if (error) throw error;

  const comments = data ?? [];
  if (comments.length === 0) return comments;

  const userIds = [...new Set(comments.map(c => c.user_id))];
  const { data: profiles, error: profileError } = await supabase
    .from('profiles')
    .select('id, display_name, avatar_url')
    .in('id', userIds);

  const profileMap = new Map();
  if (!profileError && profiles) {
    for (const p of profiles) profileMap.set(p.id, p);
  }

  return comments.map(c => ({
    ...c,
    profiles: profileMap.get(c.user_id) || null,
  }));
}

export async function addComment(tuneRef, body) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');
  const { data, error } = await supabase
    .from('tune_comments')
    .insert({ tune_ref: tuneRef, user_id: user.id, body })
    .select()
    .single();
  if (error) throw error;
  return data;
}

export async function updateComment(commentId, body) {
  const { error } = await supabase
    .from('tune_comments')
    .update({ body, edited_at: new Date().toISOString() })
    .eq('id', commentId);
  if (error) throw error;
}

export async function deleteComment(commentId) {
  const { error } = await supabase
    .from('tune_comments')
    .delete()
    .eq('id', commentId);
  if (error) throw error;
}

// ── Favorites ──────────────────────────────────────────────────────────────────

/**
 * Toggle favorito para un tune. Upsert si no existe, delete si existe.
 * Devuelve el nuevo estado (true = favorited, false = unfavorited).
 */
export async function toggleFavorite(tuneId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  // Check current state
  const { data: existing } = await supabase
    .from('user_favorites')
    .select('tune_id')
    .eq('user_id', user.id)
    .eq('tune_id', tuneId)
    .maybeSingle();

  if (existing) {
    // Unfavorite: delete
    const { error } = await supabase
      .from('user_favorites')
      .delete()
      .eq('user_id', user.id)
      .eq('tune_id', tuneId);
    if (error) throw error;
    return false;
  } else {
    // Favorite: insert
    const { error } = await supabase
      .from('user_favorites')
      .insert({ user_id: user.id, tune_id: tuneId });
    if (error) throw error;
    return true;
  }
}

/**
 * Obtiene todos los tune_ids favoritos del usuario autenticado.
 */
export async function getFavorites() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_favorites')
    .select('tune_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return data ?? [];
}

/**
 * Comprueba si un tune es favorito del usuario autenticado.
 */
export async function isFavorite(tuneId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from('user_favorites')
    .select('tune_id', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('tune_id', tuneId);

  if (error) { console.error(error); return false; }
  return (count ?? 0) > 0;
}

// ── Playlists ─────────────────────────────────────────────────────────────────

/**
 * Crea una playlist y devuelve la fila creada.
 */
export async function createPlaylist({ name, is_public = false }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const { data, error } = await supabase
    .from('user_playlists')
    .insert({ user_id: user.id, name, is_public })
    .select()
    .single();

  if (error) throw error;
  return data;
}

/**
 * Obtiene todas las playlists del usuario autenticado.
 */
export async function getMyPlaylists() {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_playlists')
    .select('id, name, is_public, created_at, updated_at, user_playlist_items(count)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return (data || []).map(p => ({
    ...p,
    item_count: p.user_playlist_items?.[0]?.count ?? 0,
  }));
}

/**
 * Obtiene una playlist con sus items resueltos (join tune_media_entries → tune_media).
 */
export async function getPlaylist(playlistId) {
  const { data: playlist, error: plError } = await supabase
    .from('user_playlists')
    .select('id, name, is_public, created_at, updated_at, user_id')
    .eq('id', playlistId)
    .single();

  if (plError) throw plError;
  if (!playlist) throw new Error('Playlist not found');

  const { data: items, error: itemsError } = await supabase
    .from('user_playlist_items')
    .select(`
      id, position, added_at,
      tune_media_entries!inner(
        id, tune_id, setting_id, start_sec, end_sec, position, instruments, key, structure,
        tune_media!inner(
          id, media_uri, source_type, status, unavailable, title, channel, thesession_recording_id, created_at, hidden, bpm,
          performer_name, recording_notes
        )
      )
    `)
    .eq('playlist_id', playlistId)
    .order('position', { ascending: true });

  if (itemsError) { console.error(itemsError); return { ...playlist, items: [] }; }

  const resolvedItems = (items || []).map(i => ({
    id: i.id,
    position: i.position,
    added_at: i.added_at,
    ...i.tune_media_entries,
    tune_media: i.tune_media_entries?.tune_media,
  }));

  return { ...playlist, items: resolvedItems };
}

/**
 * Actualiza nombre o visibilidad de una playlist.
 */
export async function updatePlaylist(playlistId, { name, is_public }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const updates = {};
  if (name !== undefined) updates.name = name;
  if (is_public !== undefined) updates.is_public = is_public;
  updates.updated_at = new Date().toISOString();

  const { error } = await supabase
    .from('user_playlists')
    .update(updates)
    .eq('id', playlistId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Elimina una playlist (cascade borra sus items).
 */
export async function deletePlaylist(playlistId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const { error } = await supabase
    .from('user_playlists')
    .delete()
    .eq('id', playlistId)
    .eq('user_id', user.id);

  if (error) throw error;
}

/**
 * Añade un entry a una playlist al final (position = max+1).
 */
export async function addToPlaylist(playlistId, entryId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  // Verificar propiedad
  const { data: pl, error: plError } = await supabase
    .from('user_playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', user.id)
    .single();

  if (plError || !pl) throw new Error('Playlist not found or not yours');

  // Obtener posición máxima actual
  const { data: maxItems, error: maxError } = await supabase
    .from('user_playlist_items')
    .select('position')
    .eq('playlist_id', playlistId)
    .order('position', { ascending: false })
    .limit(1);

  const maxPos = maxError ? 0 : (maxItems?.[0]?.position ?? -1);

  const { error } = await supabase
    .from('user_playlist_items')
    .insert({ playlist_id: playlistId, entry_id: entryId, position: maxPos + 1 });

  if (error) {
    if (error.code === '23505') return; // duplicate, silently ignore
    throw error;
  }

  // Actualizar updated_at de la playlist
  await supabase
    .from('user_playlists')
    .update({ updated_at: new Date().toISOString() })
    .eq('id', playlistId);
}

/**
 * Elimina un entry de una playlist.
 */
export async function removeFromPlaylist(playlistId, entryId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  const { error } = await supabase
    .from('user_playlist_items')
    .delete()
    .eq('playlist_id', playlistId)
    .eq('entry_id', entryId);

  if (error) throw error;
}

/**
 * Reordena los items de una playlist (recibe array ordenado de entry_ids).
 */
export async function reorderPlaylist(playlistId, entryIds) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in');

  // Verificar propiedad
  const { data: pl, error: plError } = await supabase
    .from('user_playlists')
    .select('id')
    .eq('id', playlistId)
    .eq('user_id', user.id)
    .single();

  if (plError || !pl) throw new Error('Playlist not found or not yours');

  // Update positions in bulk — one update per entry
  const updates = entryIds.map((entryId, idx) =>
    supabase
      .from('user_playlist_items')
      .update({ position: idx })
      .eq('playlist_id', playlistId)
      .eq('entry_id', entryId)
  );

  await Promise.all(updates);
}

/**
 * Obtiene playlists públicas para explorar.
 */
export async function getPublicPlaylists(limit = 20) {
  const { data, error } = await supabase
    .from('user_playlists')
    .select('id, name, user_id, created_at, updated_at, user_playlist_items(count)')
    .eq('is_public', true)
    .order('updated_at', { ascending: false })
    .limit(limit);

  if (error) { console.error(error); return []; }
  return (data || []).map(p => ({
    ...p,
    item_count: p.user_playlist_items?.[0]?.count ?? 0,
  }));
}

/**
 * Verifica si un entry ya está en una playlist.
 */
export async function isEntryInPlaylist(playlistId, entryId) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return false;

  const { count, error } = await supabase
    .from('user_playlist_items')
    .select('id', { count: 'exact', head: true })
    .eq('playlist_id', playlistId)
    .eq('entry_id', entryId);

  if (error) { console.error(error); return false; }
  return (count ?? 0) > 0;
}