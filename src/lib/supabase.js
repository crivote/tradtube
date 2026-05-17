/**
 * lib/supabase.js
 * Cliente Supabase singleton
 */

import { createClient } from '@supabase/supabase-js';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../constants';

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

/**
 * Obtiene las entries aprobadas para un tune_id
 * Cada entry incluye los datos del vídeo padre y el score de votos
 * Ordenadas por score descendente
 */
export async function getEntriesForTune(tuneId) {
  const { data: { user } } = await supabase.auth.getUser();
  
  const { data, error } = await supabase
    .from('tune_video_entries')
    .select(`
      id, tune_id, setting_id, start_sec, end_sec, position, instruments, key,
      tune_videos (
        id, youtube_id, source_type, status, unavailable, title, channel, thesession_recording_id, created_at
      ),
      tune_video_votes ( vote, user_id )
    `)
    .eq('tune_id', tuneId)
    .order('position', { ascending: true });

  if (error) { console.error(error); return []; }

  const approved = (data || []).filter(e => e.tune_videos?.status === 'approved' && !e.tune_videos?.unavailable);

  return approved
    .map(e => ({
      ...e,
      voteScore: (e.tune_video_votes || []).reduce((acc, r) => acc + r.vote, 0),
      userVote: user ? (e.tune_video_votes || []).find(r => r.user_id === user.id)?.vote ?? 0 : 0,
    }))
    .sort((a, b) => b.voteScore - a.voteScore);
}

/**
 * Añade un vídeo completo con sus entries (set de tunes)
 * payload = {
 *   youtube_id, source_type,
 *   entries: [{ tune_id, setting_id?, start_sec, end_sec?, position }]
 * }
 * Solo accesible con service_role (fase 1: restringido)
 */
export async function addVideoWithEntries({ youtube_id, source_type, title, channel, thesession_recording_id, entries }) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to add a video');

  // 1. Insertar el vídeo
  const { data: video, error: videoError } = await supabase
    .from('tune_videos')
    .insert([{ youtube_id, source_type, title: title ?? null, channel: channel ?? null, thesession_recording_id: thesession_recording_id ?? null, added_by: user.id }])
    .select()
    .single();

  if (videoError) throw videoError;

  // 2. Insertar las entries con el video_id
  const entryRows = entries.map((e, i) => ({
    video_id: video.id,
    tune_id: e.tune_id,
    setting_id: e.setting_id ?? null,
    start_sec: e.start_sec ?? 0,
    end_sec: e.end_sec ?? null,
    position: e.position ?? i,
    instruments: e.instruments?.length > 0 ? e.instruments : null,
    key: e.key ?? null,
  }));

  const { error: entriesError } = await supabase
    .from('tune_video_entries')
    .insert(entryRows);

  if (entriesError) throw entriesError;

  return video;
}

/**
 * Comprueba si un youtube_id ya existe en tune_videos.
 * Devuelve el vídeo existente (con status y title) o null.
 */
export async function checkYoutubeIdExists(youtubeId) {
  const { data, error } = await supabase
    .from('tune_videos')
    .select('id, youtube_id, title, channel, status, tune_video_entries ( tune_id )')
    .eq('youtube_id', youtubeId)
    .maybeSingle();

  if (error || !data) return null;
  const firstTuneId = data.tune_video_entries?.[0]?.tune_id ?? null;
  return { id: data.id, youtube_id: data.youtube_id, title: data.title, channel: data.channel, status: data.status, tune_id: firstTuneId };
}

/**
 * Registra un voto o report sobre una entry concreta
 */
export async function castVote(entryId, vote, isReport = false) {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Must be logged in to vote');

  const { error } = await supabase
    .from('tune_video_votes')
    .upsert(
      { entry_id: entryId, user_id: user.id, vote, is_report: isReport },
      { onConflict: 'entry_id,user_id' }
    );

  if (error) throw error;
}

/**
 * ── Admin ────────────────────────────────────────────────────────────────────
 */

export async function getLatestApprovedVideos() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, unavailable, title, channel, added_by, created_at,
      tune_video_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .eq('status', 'approved')
    .order('created_at', { ascending: false })
    .limit(20);

  if (error) { console.error(error); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_video_entries: [...(v.tune_video_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getPendingVideos() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, unavailable, title, channel, added_by, created_at,
      tune_video_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .eq('status', 'pending')
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_video_entries: [...(v.tune_video_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getVideosByTune(tuneId) {
  const { data: entryData, error: e1 } = await supabase
    .from('tune_video_entries')
    .select('video_id, tune_videos!inner(status)')
    .eq('tune_id', tuneId)
    .eq('tune_videos.status', 'approved');

  if (e1) { console.error(e1); return []; }
  const videoIds = [...new Set((entryData || []).map(e => e.video_id))];
  if (videoIds.length === 0) return [];

  const { data, error: e2 } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, unavailable, title, channel, added_by, created_at,
      tune_video_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .in('id', videoIds)
    .order('created_at', { ascending: false });

  if (e2) { console.error(e2); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_video_entries: [...(v.tune_video_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function approveVideo(videoId) {
  const { error } = await supabase
    .from('tune_videos').update({ status: 'approved' }).eq('id', videoId);
  if (error) throw error;
}

export async function deleteVideo(videoId) {
  const { error } = await supabase
    .from('tune_videos').delete().eq('id', videoId);
  if (error) throw error;
}

export async function updateVideoWithEntries(videoId, { source_type, title, channel, thesession_recording_id, unavailable, entries }) {
  const { error: ve } = await supabase
    .from('tune_videos').update({ source_type, title: title ?? null, channel: channel ?? null, thesession_recording_id: thesession_recording_id ?? null, unavailable: unavailable ?? false }).eq('id', videoId);
  if (ve) throw ve;

  const { error: de } = await supabase
    .from('tune_video_entries').delete().eq('video_id', videoId);
  if (de) throw de;

  if (entries.length === 0) return;
  const { error: ie } = await supabase
    .from('tune_video_entries')
    .insert(entries.map((e, i) => ({
      video_id: videoId,
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
    .from('tune_videos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) { console.error(error); return 0; }
  return count || 0;
}

/**
 * Devuelve un Map<tune_id, clipCount> para todos los tunes con vídeos aprobados.
 * Se carga una vez al inicio para mostrar badges en los resultados de búsqueda.
 */
export async function getVideoCountsByTune() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select('id, youtube_id, tune_video_entries(tune_id)')
    .eq('status', 'approved')
    .eq('unavailable', false);

  if (error) { console.error(error); return { counts: new Map(), thumbnails: new Map() }; }

  const counts = new Map();
  const thumbnails = new Map();
  for (const video of data || []) {
    for (const entry of video.tune_video_entries || []) {
      counts.set(entry.tune_id, (counts.get(entry.tune_id) || 0) + 1);
      if (!thumbnails.has(entry.tune_id)) {
        thumbnails.set(entry.tune_id, video.youtube_id);
      }
    }
  }
  return { counts, thumbnails };
}

/**
 * Devuelve un Set de tune_ids que tienen entries con el instrumento especificado
 */
export async function getTuneIdsByInstrument(instrument) {
  const { data, error } = await supabase
    .from('tune_video_entries')
    .select('tune_id, instruments, tune_videos!inner(status, unavailable)')
    .contains('instruments', [instrument])
    .eq('tune_videos.status', 'approved')
    .eq('tune_videos.unavailable', false);

  if (error) { console.error(error); return new Set(); }
  return new Set((data || []).map(e => e.tune_id));
}

/**
 * Auth — Google OAuth
 */
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
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, unavailable, title, channel, thesession_recording_id, created_at,
      tune_video_entries (
        id, tune_id, setting_id, start_sec, end_sec, position, instruments, key
      )
    `)
    .eq('id', videoId)
    .single();

  if (error) { console.error(error); return null; }
  return data;
}

// ── Reports ──────────────────────────────────────────────────────────────────

export async function createReport({ video_id, tune_id, issue_type, description, email }) {
  const { data: { user } } = await supabase.auth.getUser();
  const { error } = await supabase
    .from('tune_video_reports')
    .insert({
      video_id: video_id ?? null,
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
    .from('tune_video_reports')
    .select(`
      id, created_at, video_id, tune_id, user_id, email, issue_type, description, status, admin_comments, closed_at,
      tune_videos (id, youtube_id, title, source_type, status)
    `)
    .order('created_at', { ascending: false });

  if (status) query = query.eq('status', status);

  const { data, error } = await query;
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
    .from('tune_video_reports')
    .update(updates)
    .eq('id', reportId);

  if (error) throw error;
}
