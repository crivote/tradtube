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
  const { data, error } = await supabase
    .from('tune_video_entries')
    .select(`
      id, tune_id, setting_id, start_sec, end_sec, position,
      tune_videos (
        id, youtube_id, source_type, status, title, created_at
      ),
      tune_video_votes ( vote )
    `)
    .eq('tune_id', tuneId)
    .order('position', { ascending: true });

  if (error) { console.error(error); return []; }

  // Filtrar solo las que pertenecen a vídeos aprobados (RLS lo controla,
  // pero filtramos en cliente también por seguridad)
  const approved = (data || []).filter(e => e.tune_videos?.status === 'approved');

  // Calcular score de votos y ordenar
  return approved
    .map(e => ({
      ...e,
      voteScore: (e.tune_video_votes || []).reduce((acc, r) => acc + r.vote, 0),
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
export async function addVideoWithEntries({ youtube_id, source_type, title, entries }) {
  // 1. Insertar el vídeo
  const { data: video, error: videoError } = await supabase
    .from('tune_videos')
    .insert([{ youtube_id, source_type, title: title ?? null }])
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
  }));

  const { error: entriesError } = await supabase
    .from('tune_video_entries')
    .insert(entryRows);

  if (entriesError) throw entriesError;

  return video;
}

/**
 * Registra un voto o report sobre una entry concreta
 */
export async function castVote(entryId, vote, isReport = false) {
  const { error } = await supabase
    .from('tune_video_votes')
    .upsert(
      { entry_id: entryId, vote, is_report: isReport },
      { onConflict: 'entry_id,user_id' }
    );

  if (error) throw error;
}

/**
 * ── Admin ────────────────────────────────────────────────────────────────────
 */

export async function getAllVideos() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, title, added_by, created_at,
      tune_video_entries ( id, tune_id, setting_id, start_sec, end_sec, position )
    `)
    .order('created_at', { ascending: false });

  if (error) { console.error(error); return []; }
  return (data || []).map(v => ({
    ...v,
    tune_video_entries: [...(v.tune_video_entries || [])].sort((a, b) => a.position - b.position),
  }));
}

export async function getLatestApprovedVideos() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, title, added_by, created_at,
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

export async function getPendingCount() {
  const { count, error } = await supabase
    .from('tune_videos')
    .select('id', { count: 'exact', head: true })
    .eq('status', 'pending');
  if (error) { console.error(error); return 0; }
  return count || 0;
}

/** Returns array of tune_ids that appear in at least one approved video */
export async function getTunesWithVideos() {
  const { data, error } = await supabase
    .from('tune_video_entries')
    .select('tune_id, tune_videos!inner(status)')
    .eq('tune_videos.status', 'approved');

  if (error) { console.error(error); return []; }
  return [...new Set((data || []).map(e => e.tune_id))];
}

export async function getVideosByTune(tuneId) {
  // Step 1: find video IDs that have an approved entry for this tune
  const { data: entryData, error: e1 } = await supabase
    .from('tune_video_entries')
    .select('video_id, tune_videos!inner(status)')
    .eq('tune_id', tuneId)
    .eq('tune_videos.status', 'approved');

  if (e1) { console.error(e1); return []; }
  const videoIds = [...new Set((entryData || []).map(e => e.video_id))];
  if (videoIds.length === 0) return [];

  // Step 2: fetch full video data with all entries
  const { data, error: e2 } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, title, added_by, created_at,
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

export async function getPendingVideos() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select(`
      id, youtube_id, source_type, status, title, added_by, created_at,
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

export async function updateVideoWithEntries(videoId, { source_type, title, entries }) {
  const { error: ve } = await supabase
    .from('tune_videos').update({ source_type, title: title ?? null }).eq('id', videoId);
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
    })));
  if (ie) throw ie;
}

/**
 * Devuelve un Map<tune_id, clipCount> para todos los tunes con vídeos aprobados.
 * Se carga una vez al inicio para mostrar badges en los resultados de búsqueda.
 */
export async function getVideoCountsByTune() {
  const { data, error } = await supabase
    .from('tune_videos')
    .select('tune_video_entries(tune_id)')
    .eq('status', 'approved');

  if (error) { console.error(error); return new Map(); }

  const counts = new Map();
  for (const video of data || []) {
    for (const entry of video.tune_video_entries || []) {
      counts.set(entry.tune_id, (counts.get(entry.tune_id) || 0) + 1);
    }
  }
  return counts;
}

/**
 * Auth — Google OAuth
 */
export async function loginWithGoogle() {
  const { error } = await supabase.auth.signInWithOAuth({
    provider: 'google',
    options: { redirectTo: window.location.origin },
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
