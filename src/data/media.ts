import { requestOpenApp } from './context-actions';
import { createScratchpadNote, readNotesState, saveNotesState } from './notes';
import {
  applySoundscapePreset,
  clearSoundscapeLevels,
  describeActiveSoundscape,
  getActiveSoundscapeLayersCount,
  getAllSoundscapePresets,
  getSoundscapeState,
  setSoundscapeLayerLevel,
  setSoundscapeMasterVolume,
  setSoundscapePlaying,
  toggleSoundscapePlaying,
  VALID_SOUNDSCAPE_LAYER_IDS,
  type SoundscapeLayerId,
  type SoundscapeLevels,
} from './soundscape';

/* ── Shared Media Types & Storage Keys ────────────────────────────────────── */

export interface MediaTrack {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: string;
}

export interface MusicPlaylist {
  id: string;
  name: string;
  tracks: MediaTrack[];
  createdAt: number;
}

export type RepeatMode = 'off' | 'all' | 'one';
export type YouTubeSection = 'home' | 'watch-later' | 'history' | 'url';
export type MusicTab = 'discover' | 'soundscapes' | 'queue' | 'liked' | 'playlists' | 'history';

export const YOUTUBE_HISTORY_KEY = 'nexus-youtube-history-v1';
export const YOUTUBE_WATCH_LATER_KEY = 'nexus.youtube-watch-later.v1';
export const MUSIC_HISTORY_KEY = 'nexus-music-history-v1';
export const MUSIC_LIKED_KEY = 'nexus.music-liked.v1';
export const MUSIC_PLAYLISTS_KEY = 'nexus.music-playlists.v1';

/* ── Curated Zero-Search Starter Focus Streams ────────────────────────────── */

export const STARTER_MUSIC_STREAMS: readonly MediaTrack[] = [
  {
    id: 'jfKfPfyJRdk',
    title: 'lofi hip hop radio — beats to relax/study to',
    channelTitle: 'Lofi Girl',
    description: '24/7 mellow lofi hip hop beats for deep work, reading, and calm focus.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
  {
    id: '4xDzrJKXOOY',
    title: 'synthwave radio — beats to chill/game to',
    channelTitle: 'Lofi Girl',
    description: 'Warm analog synthwave and retro electronic instrumentals.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
  {
    id: 'S_MOd40zlYU',
    title: 'dark ambient radio — music to escape/dream to',
    channelTitle: 'Lofi Girl',
    description: 'Atmospheric ambient textures for distraction-free coding and writing.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/S_MOd40zlYU/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
  {
    id: 'Dx5qFachd3A',
    title: 'Relaxing Jazz Piano Radio — Slow Jazz Music',
    channelTitle: 'Cafe Music BGM channel',
    description: 'Quiet acoustic jazz trio and soft piano melodies.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/Dx5qFachd3A/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
  {
    id: '5yx6BWlEVcY',
    title: 'Chillhop Radio — jazzy & lofi hip hop beats',
    channelTitle: 'Chillhop Music',
    description: 'Instrumental jazzy hip hop grooves for steady daytime momentum.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/5yx6BWlEVcY/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
  {
    id: 'DWcJFNfaw9c',
    title: 'lofi hip hop radio — beats to sleep/chill to',
    channelTitle: 'Lofi Girl',
    description: 'Softer downtempo beats for late-night sessions and winding down.',
    publishedAt: '',
    thumbnail: 'https://i.ytimg.com/vi/DWcJFNfaw9c/mqdefault.jpg',
    duration: 'LIVE',
    durationSeconds: 0,
  },
];

/* ── Pure Parsing & Formatting Utilities ──────────────────────────────────── */

export function extractYouTubeVideoId(rawInput: string): string | null {
  const trimmed = rawInput.trim();
  if (!trimmed) return null;
  if (/^[a-zA-Z0-9_-]{11}$/.test(trimmed)) return trimmed;

  try {
    const parsed = new URL(trimmed.includes('://') ? trimmed : `https://${trimmed}`);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') {
      candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (
      host === 'youtube.com' ||
      host.endsWith('.youtube.com') ||
      host === 'youtube-nocookie.com' ||
      host.endsWith('.youtube-nocookie.com')
    ) {
      const vParam = parsed.searchParams.get('v');
      if (vParam) {
        candidate = vParam;
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if (
          (parts[0] === 'shorts' ||
            parts[0] === 'embed' ||
            parts[0] === 'live' ||
            parts[0] === 'v') &&
          parts[1]
        ) {
          candidate = parts[1];
        }
      }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

export function parseIsoDurationSeconds(iso: string): number {
  const match = iso.trim().match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  const h = Number(match[1] ?? 0);
  const m = Number(match[2] ?? 0);
  const s = Number(match[3] ?? 0);
  return h * 3600 + m * 60 + s;
}

export function formatMediaSeconds(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '00:00';
  const total = Math.floor(seconds);
  const hrs = Math.floor(total / 3600);
  const mins = Math.floor((total % 3600) / 60);
  const secs = total % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function parseTimestampInputSeconds(raw: string): number | null {
  const cleaned = raw.trim().replace(/^\[|\]$/g, '');
  if (!cleaned) return null;
  if (/^\d+$/.test(cleaned)) {
    const val = Number(cleaned);
    return Number.isFinite(val) && val >= 0 ? Math.floor(val) : null;
  }
  const parts = cleaned.split(':').map(p => p.trim());
  if (parts.length < 2 || parts.length > 3 || parts.some(p => !/^\d+$/.test(p))) {
    return null;
  }
  const nums = parts.map(Number);
  if (nums.length === 2) {
    return nums[0] * 60 + nums[1];
  }
  return nums[0] * 3600 + nums[1] * 60 + nums[2];
}

export function formatCompactViews(rawCount: string | number): string {
  const count = typeof rawCount === 'number' ? rawCount : Number(rawCount);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${Math.round(count)} views`;
}

export function buildTrackFromVideoId(id: string, title?: string, channelTitle?: string): MediaTrack {
  const cleanTitle = title?.replace(/\s*[-|]\s*YouTube\s*$/i, '').trim();
  return {
    id,
    title: cleanTitle || `YouTube video ${id}`,
    channelTitle: channelTitle?.trim() || 'YouTube',
    description: '',
    publishedAt: '',
    thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
  };
}

/* ── Storage Readers, Sanitizers & Writers ────────────────────────────────── */

export function sanitizeMediaTrackList(raw: unknown, maxItems = 40): MediaTrack[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: MediaTrack[] = [];
  for (const entry of raw) {
    if (!entry || typeof entry !== 'object') continue;
    const t = entry as Partial<MediaTrack>;
    if (typeof t.id !== 'string' || !/^[a-zA-Z0-9_-]{11}$/.test(t.id) || seen.has(t.id)) continue;
    if (typeof t.title !== 'string' || !t.title.trim()) continue;
    seen.add(t.id);
    out.push({
      id: t.id,
      title: t.title.trim().slice(0, 180),
      channelTitle: typeof t.channelTitle === 'string' && t.channelTitle.trim() ? t.channelTitle.trim().slice(0, 100) : 'YouTube',
      description: typeof t.description === 'string' ? t.description.slice(0, 600) : '',
      publishedAt: typeof t.publishedAt === 'string' ? t.publishedAt.slice(0, 40) : '',
      thumbnail:
        typeof t.thumbnail === 'string' && /^https?:\/\//i.test(t.thumbnail)
          ? t.thumbnail.slice(0, 300)
          : `https://i.ytimg.com/vi/${t.id}/mqdefault.jpg`,
      ...(typeof t.duration === 'string' && t.duration.trim() ? { duration: t.duration.trim().slice(0, 16) } : {}),
      ...(typeof t.durationSeconds === 'number' && Number.isFinite(t.durationSeconds) && t.durationSeconds >= 0
        ? { durationSeconds: Math.floor(t.durationSeconds) }
        : {}),
      ...(typeof t.viewCount === 'string' && t.viewCount.trim() ? { viewCount: t.viewCount.trim().slice(0, 32) } : {}),
    });
    if (out.length >= maxItems) break;
  }
  return out;
}

export function sanitizeMusicPlaylists(raw: unknown): MusicPlaylist[] {
  if (!Array.isArray(raw)) return [];
  const seen = new Set<string>();
  const out: MusicPlaylist[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const p = item as Partial<MusicPlaylist>;
    if (typeof p.id !== 'string' || !p.id.trim() || seen.has(p.id)) continue;
    if (typeof p.name !== 'string' || !p.name.trim()) continue;
    seen.add(p.id);
    out.push({
      id: p.id,
      name: p.name.trim().slice(0, 60),
      tracks: sanitizeMediaTrackList(p.tracks, 60),
      createdAt: typeof p.createdAt === 'number' && Number.isFinite(p.createdAt) ? p.createdAt : Date.now(),
    });
    if (out.length >= 24) break;
  }
  return out;
}

function readTrackStorage(key: string, maxItems: number): MediaTrack[] {
  try {
    const raw = localStorage.getItem(key);
    return raw ? sanitizeMediaTrackList(JSON.parse(raw), maxItems) : [];
  } catch {
    return [];
  }
}

function writeTrackStorage(key: string, items: MediaTrack[], maxItems: number): void {
  try {
    localStorage.setItem(key, JSON.stringify(items.slice(0, maxItems)));
  } catch {
    /* Ignore quota errors */
  }
}

export const readYouTubeHistory = (): MediaTrack[] => readTrackStorage(YOUTUBE_HISTORY_KEY, 30);
export const saveYouTubeHistory = (items: MediaTrack[]): void => writeTrackStorage(YOUTUBE_HISTORY_KEY, items, 30);

export const readYouTubeWatchLater = (): MediaTrack[] => readTrackStorage(YOUTUBE_WATCH_LATER_KEY, 40);
export const saveYouTubeWatchLater = (items: MediaTrack[]): void => writeTrackStorage(YOUTUBE_WATCH_LATER_KEY, items, 40);

export const readMusicHistory = (): MediaTrack[] => readTrackStorage(MUSIC_HISTORY_KEY, 40);
export const saveMusicHistory = (items: MediaTrack[]): void => writeTrackStorage(MUSIC_HISTORY_KEY, items, 40);

export const readMusicLiked = (): MediaTrack[] => readTrackStorage(MUSIC_LIKED_KEY, 60);
export const saveMusicLiked = (items: MediaTrack[]): void => writeTrackStorage(MUSIC_LIKED_KEY, items, 60);

export function readMusicPlaylists(): MusicPlaylist[] {
  try {
    const raw = localStorage.getItem(MUSIC_PLAYLISTS_KEY);
    return raw ? sanitizeMusicPlaylists(JSON.parse(raw)) : [];
  } catch {
    return [];
  }
}

export function saveMusicPlaylists(playlists: MusicPlaylist[]): void {
  try {
    localStorage.setItem(MUSIC_PLAYLISTS_KEY, JSON.stringify(playlists.slice(0, 24)));
  } catch {
    /* Ignore quota errors */
  }
}

/* ── Timestamp Note Capture to Scratchpad ─────────────────────────────────── */

export function captureVideoTimestampNote(opts: {
  video: MediaTrack;
  seconds: number;
  noteText?: string;
  openScratchpad?: boolean;
}): { noteId: string; formattedTimestamp: string; urlWithTime: string } {
  const safeSeconds = Math.max(0, Math.floor(Number.isFinite(opts.seconds) ? opts.seconds : 0));
  const formattedTimestamp = formatMediaSeconds(safeSeconds);
  const urlWithTime =
    safeSeconds > 0
      ? `https://www.youtube.com/watch?v=${opts.video.id}&t=${safeSeconds}s`
      : `https://www.youtube.com/watch?v=${opts.video.id}`;
  const cleanNote = opts.noteText?.trim();
  const line = cleanNote
    ? `- **[${formattedTimestamp}](${urlWithTime})** — ${cleanNote} (*${opts.video.title}*)`
    : `- **[${formattedTimestamp}](${urlWithTime})** — ${opts.video.title} (*${opts.video.channelTitle}*)`;

  const state = readNotesState();
  const active =
    state.notes.find(n => n.id === state.activeNoteId) ?? state.notes[0];

  if (!active) {
    const created = createScratchpadNote({
      title: 'Video Notes',
      content: `# Video Notes\n\n${line}\n`,
    });
    saveNotesState({ notes: [created], activeNoteId: created.id });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
      if (opts.openScratchpad) {
        requestOpenApp('notes', { preferExisting: true });
      }
    }
    return { noteId: created.id, formattedTimestamp, urlWithTime };
  }

  const trimmedExisting = active.content.trimEnd();
  const updatedContent = trimmedExisting ? `${trimmedExisting}\n${line}\n` : `${line}\n`;
  const updatedNote = {
    ...active,
    content: updatedContent,
    updatedAt: Date.now(),
  };
  saveNotesState({
    notes: [updatedNote, ...state.notes.filter(n => n.id !== active.id)],
    activeNoteId: updatedNote.id,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
    if (opts.openScratchpad) {
      requestOpenApp('notes', { preferExisting: true });
    }
  }

  return { noteId: updatedNote.id, formattedTimestamp, urlWithTime };
}

/* ── Persistent Desktop Music Store (Survives Minimizing / Closing Music) ─── */

export interface PlayerBridgeCommand {
  nonce: number;
  func: 'playVideo' | 'pauseVideo' | 'mute' | 'unMute' | 'setVolume' | 'seekTo';
  args: unknown[];
}

export interface MusicStoreState {
  current: MediaTrack | null;
  queue: MediaTrack[];
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTime: number;
  duration: number;
  history: MediaTrack[];
  liked: MediaTrack[];
  playlists: MusicPlaylist[];
  pendingCommand: PlayerBridgeCommand | null;
}

let commandNonce = 1;

function createInitialMusicState(): MusicStoreState {
  return {
    current: null,
    queue: [...STARTER_MUSIC_STREAMS],
    isPlaying: false,
    isMuted: false,
    volume: 80,
    shuffle: false,
    repeat: 'off',
    currentTime: 0,
    duration: 0,
    history: readMusicHistory(),
    liked: readMusicLiked(),
    playlists: readMusicPlaylists(),
    pendingCommand: null,
  };
}

let musicState: MusicStoreState = createInitialMusicState();
const musicListeners = new Set<() => void>();

function emitMusicChange(): void {
  for (const listener of musicListeners) {
    listener();
  }
}

function updateMusicState(updater: (prev: MusicStoreState) => MusicStoreState): void {
  musicState = updater(musicState);
  emitMusicChange();
}

function nextBridgeCommand(
  func: PlayerBridgeCommand['func'],
  args: unknown[] = []
): PlayerBridgeCommand {
  return { nonce: commandNonce++, func, args };
}

export function getMusicState(): MusicStoreState {
  return musicState;
}

export function subscribeMusicState(listener: () => void): () => void {
  musicListeners.add(listener);
  return () => {
    musicListeners.delete(listener);
  };
}

export function reloadMusicLibraryFromStorage(): void {
  updateMusicState(prev => ({
    ...prev,
    history: readMusicHistory(),
    liked: readMusicLiked(),
    playlists: readMusicPlaylists(),
  }));
}

export function resetMusicStoreForTests(): void {
  musicState = createInitialMusicState();
  emitMusicChange();
}

export function playMusicTrack(track: MediaTrack, queueContext?: readonly MediaTrack[]): void {
  updateMusicState(prev => {
    const nextHistory = [track, ...prev.history.filter(item => item.id !== track.id)].slice(0, 40);
    saveMusicHistory(nextHistory);

    let nextQueue = queueContext && queueContext.length > 0 ? [...queueContext] : [...prev.queue];
    if (!nextQueue.some(item => item.id === track.id)) {
      nextQueue = [track, ...nextQueue];
    }

    const isSameTrack = prev.current?.id === track.id;
    return {
      ...prev,
      current: track,
      queue: nextQueue,
      isPlaying: true,
      currentTime: isSameTrack ? prev.currentTime : 0,
      duration: isSameTrack ? prev.duration : (track.durationSeconds ?? 0),
      history: nextHistory,
      pendingCommand: isSameTrack ? nextBridgeCommand('playVideo') : null,
    };
  });
}

export function playStarterMusicStream(index = 0): void {
  const chosen = STARTER_MUSIC_STREAMS[index % STARTER_MUSIC_STREAMS.length] ?? STARTER_MUSIC_STREAMS[0];
  if (chosen) {
    playMusicTrack(chosen, STARTER_MUSIC_STREAMS);
  }
}

export function toggleMusicPlayback(): void {
  if (!musicState.current) {
    const first = musicState.history[0] ?? STARTER_MUSIC_STREAMS[0];
    if (first) {
      playMusicTrack(first, musicState.queue.length ? musicState.queue : STARTER_MUSIC_STREAMS);
    }
    return;
  }
  updateMusicState(prev => {
    const nextPlaying = !prev.isPlaying;
    return {
      ...prev,
      isPlaying: nextPlaying,
      pendingCommand: nextBridgeCommand(nextPlaying ? 'playVideo' : 'pauseVideo'),
    };
  });
}

export function stepMusicTrack(
  direction: -1 | 1,
  reason: 'manual' | 'ended' = 'manual',
  randomFn: () => number = Math.random
): void {
  const snap = musicState;
  if (!snap.current || snap.queue.length === 0) return;

  if (reason === 'ended' && snap.repeat === 'one') {
    updateMusicState(prev => ({
      ...prev,
      isPlaying: true,
      currentTime: 0,
      pendingCommand: nextBridgeCommand('seekTo', [0, true]),
    }));
    return;
  }

  const currentIdx = snap.queue.findIndex(item => item.id === snap.current?.id);

  if (snap.shuffle && snap.queue.length > 1 && direction === 1) {
    const pool = snap.queue.filter(item => item.id !== snap.current?.id);
    const chosen = pool[Math.floor(randomFn() * pool.length)] ?? pool[0];
    if (chosen) {
      playMusicTrack(chosen, snap.queue);
    }
    return;
  }

  const rawTargetIdx = (currentIdx >= 0 ? currentIdx : 0) + direction;

  if (rawTargetIdx >= 0 && rawTargetIdx < snap.queue.length) {
    playMusicTrack(snap.queue[rawTargetIdx], snap.queue);
    return;
  }

  if (snap.repeat === 'all' && snap.queue.length > 0) {
    const wrappedIdx =
      ((rawTargetIdx % snap.queue.length) + snap.queue.length) % snap.queue.length;
    playMusicTrack(snap.queue[wrappedIdx], snap.queue);
    return;
  }

  if (reason === 'ended') {
    updateMusicState(prev => ({
      ...prev,
      isPlaying: false,
      currentTime: 0,
    }));
  }
}

export function seekMusicTo(seconds: number): void {
  const safe = Math.max(0, Math.floor(Number.isFinite(seconds) ? seconds : 0));
  updateMusicState(prev => ({
    ...prev,
    currentTime: safe,
    pendingCommand: nextBridgeCommand('seekTo', [safe, true]),
  }));
}

export function setMusicVolume(volume: number): void {
  const clamped = Math.max(0, Math.min(100, Math.round(volume)));
  updateMusicState(prev => ({
    ...prev,
    volume: clamped,
    isMuted: clamped === 0 ? true : false,
    pendingCommand: nextBridgeCommand('setVolume', [clamped]),
  }));
}

export function toggleMusicMute(): void {
  updateMusicState(prev => {
    const nextMuted = !prev.isMuted;
    return {
      ...prev,
      isMuted: nextMuted,
      pendingCommand: nextBridgeCommand(nextMuted ? 'mute' : 'unMute'),
    };
  });
}

export function toggleMusicShuffle(): void {
  updateMusicState(prev => ({ ...prev, shuffle: !prev.shuffle }));
}

export function cycleMusicRepeat(): void {
  updateMusicState(prev => {
    const nextRepeat: RepeatMode =
      prev.repeat === 'off' ? 'all' : prev.repeat === 'all' ? 'one' : 'off';
    return { ...prev, repeat: nextRepeat };
  });
}

export function stopMusic(): void {
  updateMusicState(prev => ({
    ...prev,
    current: null,
    isPlaying: false,
    currentTime: 0,
    duration: 0,
    pendingCommand: null,
  }));
}

export function enqueueTrackNext(track: MediaTrack): void {
  updateMusicState(prev => {
    const withoutTrack = prev.queue.filter(item => item.id !== track.id);
    if (!prev.current) {
      return { ...prev, queue: [track, ...withoutTrack] };
    }
    const idx = withoutTrack.findIndex(item => item.id === prev.current?.id);
    if (idx === -1) {
      return { ...prev, queue: [prev.current, track, ...withoutTrack] };
    }
    const nextQueue = [
      ...withoutTrack.slice(0, idx + 1),
      track,
      ...withoutTrack.slice(idx + 1),
    ];
    return { ...prev, queue: nextQueue };
  });
}

export function moveQueueTrack(index: number, delta: -1 | 1): void {
  updateMusicState(prev => {
    const target = index + delta;
    if (index < 0 || index >= prev.queue.length || target < 0 || target >= prev.queue.length) {
      return prev;
    }
    const copy = [...prev.queue];
    const [picked] = copy.splice(index, 1);
    copy.splice(target, 0, picked);
    return { ...prev, queue: copy };
  });
}

export function removeQueueTrack(trackId: string): void {
  updateMusicState(prev => ({
    ...prev,
    queue: prev.queue.filter(item => item.id !== trackId),
  }));
}

export function toggleMusicTrackLiked(track: MediaTrack): boolean {
  let isNowLiked = false;
  updateMusicState(prev => {
    const exists = prev.liked.some(item => item.id === track.id);
    isNowLiked = !exists;
    const nextLiked = exists
      ? prev.liked.filter(item => item.id !== track.id)
      : [track, ...prev.liked].slice(0, 60);
    saveMusicLiked(nextLiked);
    return { ...prev, liked: nextLiked };
  });
  return isNowLiked;
}

export function createMusicPlaylist(name: string, initialTrack?: MediaTrack): MusicPlaylist | null {
  const cleanName = name.trim().slice(0, 60);
  if (!cleanName) return null;
  const created: MusicPlaylist = {
    id: crypto.randomUUID(),
    name: cleanName,
    tracks: initialTrack ? [initialTrack] : [],
    createdAt: Date.now(),
  };
  updateMusicState(prev => {
    const next = [created, ...prev.playlists].slice(0, 24);
    saveMusicPlaylists(next);
    return { ...prev, playlists: next };
  });
  return created;
}

export function deleteMusicPlaylist(playlistId: string): void {
  updateMusicState(prev => {
    const next = prev.playlists.filter(p => p.id !== playlistId);
    saveMusicPlaylists(next);
    return { ...prev, playlists: next };
  });
}

export function addTrackToMusicPlaylist(playlistId: string, track: MediaTrack): void {
  updateMusicState(prev => {
    const next = prev.playlists.map(p => {
      if (p.id !== playlistId) return p;
      if (p.tracks.some(t => t.id === track.id)) return p;
      return { ...p, tracks: [...p.tracks, track].slice(0, 60) };
    });
    saveMusicPlaylists(next);
    return { ...prev, playlists: next };
  });
}

export function removeTrackFromMusicPlaylist(playlistId: string, trackId: string): void {
  updateMusicState(prev => {
    const next = prev.playlists.map(p =>
      p.id === playlistId ? { ...p, tracks: p.tracks.filter(t => t.id !== trackId) } : p
    );
    saveMusicPlaylists(next);
    return { ...prev, playlists: next };
  });
}

export function playMusicPlaylist(playlistId: string): void {
  const found = musicState.playlists.find(p => p.id === playlistId);
  if (!found || found.tracks.length === 0) return;
  playMusicTrack(found.tracks[0], found.tracks);
}

export function clearMusicHistory(): void {
  saveMusicHistory([]);
  try {
    localStorage.removeItem(MUSIC_HISTORY_KEY);
  } catch {
    /* ignore */
  }
  updateMusicState(prev => ({ ...prev, history: [] }));
}

export function reportAudioTelemetry(patch: {
  currentTime?: number;
  duration?: number;
  playerState?: number;
}): void {
  if (patch.playerState === 0) {
    stepMusicTrack(1, 'ended');
    return;
  }
  updateMusicState(prev => {
    let changed = false;
    let nextPlaying = prev.isPlaying;
    let nextTime = prev.currentTime;
    let nextDuration = prev.duration;

    if (patch.playerState === 1 && !prev.isPlaying) {
      nextPlaying = true;
      changed = true;
    } else if (patch.playerState === 2 && prev.isPlaying) {
      nextPlaying = false;
      changed = true;
    }

    if (typeof patch.currentTime === 'number' && Number.isFinite(patch.currentTime)) {
      const rounded = Math.floor(patch.currentTime);
      if (Math.abs(rounded - prev.currentTime) >= 1) {
        nextTime = rounded;
        changed = true;
      }
    }

    if (typeof patch.duration === 'number' && Number.isFinite(patch.duration) && patch.duration >= 0) {
      const roundedDur = Math.floor(patch.duration);
      if (roundedDur !== prev.duration) {
        nextDuration = roundedDur;
        changed = true;
      }
    }

    if (!changed) return prev;
    return {
      ...prev,
      isPlaying: nextPlaying,
      currentTime: nextTime,
      duration: nextDuration,
    };
  });
}

/* ── Cross-App Action Queues (Spotlight / Browser / Menus → Tube & Music) ── */

export type YouTubeNavigationAction =
  | { kind: 'search'; query: string }
  | { kind: 'play'; video: MediaTrack }
  | { kind: 'play-url'; url: string; title?: string }
  | { kind: 'section'; section: YouTubeSection };

export type MusicNavigationAction =
  | { kind: 'search'; query: string }
  | { kind: 'tab'; tab: MusicTab };

export const YOUTUBE_ACTION_EVENT = 'nexus:youtube-action';
export const MUSIC_ACTION_EVENT = 'nexus:music-action';

const pendingYouTubeActions: YouTubeNavigationAction[] = [];
const pendingMusicActions: MusicNavigationAction[] = [];

export function enqueueYouTubeAction(action: YouTubeNavigationAction): void {
  pendingYouTubeActions.push(action);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(YOUTUBE_ACTION_EVENT));
  }
}

export function consumeYouTubeActions(): YouTubeNavigationAction[] {
  if (pendingYouTubeActions.length === 0) return [];
  return pendingYouTubeActions.splice(0, pendingYouTubeActions.length);
}

export function enqueueMusicAction(action: MusicNavigationAction): void {
  pendingMusicActions.push(action);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(MUSIC_ACTION_EVENT));
  }
}

export function consumeMusicActions(): MusicNavigationAction[] {
  if (pendingMusicActions.length === 0) return [];
  return pendingMusicActions.splice(0, pendingMusicActions.length);
}

/* ── Widget Sandbox Music Bridge (window.NEXUS.music) ─────────────────────── */

export interface WidgetSoundscapeSnapshot {
  isPlaying: boolean;
  masterVolume: number;
  activeCount: number;
  summary: string;
  activePresetId: string | null;
  levels: SoundscapeLevels;
  presets: Array<{ id: string; name: string; isBuiltIn: boolean }>;
}

export interface WidgetMusicSnapshot {
  current: MediaTrack | null;
  isPlaying: boolean;
  isMuted: boolean;
  volume: number;
  shuffle: boolean;
  repeat: RepeatMode;
  currentTime: number;
  duration: number;
  isLiked: boolean;
  queue: MediaTrack[];
  likedCount: number;
  playlists: Array<{ id: string; name: string; trackCount: number }>;
  streams: MediaTrack[];
  soundscape: WidgetSoundscapeSnapshot;
}

export function getWidgetMusicSnapshot(): WidgetMusicSnapshot {
  const s = musicState;
  const sc = getSoundscapeState();
  const currentId = s.current?.id;
  return {
    current: s.current ? { ...s.current } : null,
    isPlaying: s.isPlaying,
    isMuted: s.isMuted,
    volume: s.volume,
    shuffle: s.shuffle,
    repeat: s.repeat,
    currentTime: s.currentTime,
    duration: s.duration,
    isLiked: Boolean(currentId && s.liked.some(item => item.id === currentId)),
    queue: s.queue.map(item => ({ ...item })),
    likedCount: s.liked.length,
    playlists: s.playlists.map(p => ({
      id: p.id,
      name: p.name,
      trackCount: p.tracks.length,
    })),
    streams: STARTER_MUSIC_STREAMS.map(item => ({ ...item })),
    soundscape: {
      isPlaying: sc.isPlaying,
      masterVolume: sc.masterVolume,
      activeCount: getActiveSoundscapeLayersCount(sc.levels),
      summary: describeActiveSoundscape(sc),
      activePresetId: sc.activePresetId,
      levels: { ...sc.levels },
      presets: getAllSoundscapePresets(sc).map(p => ({
        id: p.id,
        name: p.name,
        isBuiltIn: Boolean(p.isBuiltIn),
      })),
    },
  };
}

export function resumeMusicPlayback(): void {
  if (!musicState.current) {
    const first = musicState.history[0] ?? STARTER_MUSIC_STREAMS[0];
    if (first) {
      playMusicTrack(first, musicState.queue.length ? musicState.queue : STARTER_MUSIC_STREAMS);
    }
    return;
  }
  if (musicState.isPlaying) return;
  updateMusicState(prev => ({
    ...prev,
    isPlaying: true,
    pendingCommand: nextBridgeCommand('playVideo'),
  }));
}

export function pauseMusicPlayback(): void {
  if (!musicState.current || !musicState.isPlaying) return;
  updateMusicState(prev => ({
    ...prev,
    isPlaying: false,
    pendingCommand: nextBridgeCommand('pauseVideo'),
  }));
}

function findKnownMediaTrackById(id: string): MediaTrack | undefined {
  return (
    STARTER_MUSIC_STREAMS.find(t => t.id === id) ??
    musicState.queue.find(t => t.id === id) ??
    musicState.liked.find(t => t.id === id) ??
    musicState.history.find(t => t.id === id)
  );
}

export function resolveWidgetTrackInput(raw: unknown, fallbackTitle?: string): MediaTrack | null {
  if (typeof raw === 'string') {
    const id = extractYouTubeVideoId(raw);
    if (!id) return null;
    const known = findKnownMediaTrackById(id);
    if (known && !fallbackTitle) return { ...known };
    return buildTrackFromVideoId(id, fallbackTitle ?? known?.title, known?.channelTitle);
  }
  if (raw && typeof raw === 'object' && !Array.isArray(raw)) {
    const sanitized = sanitizeMediaTrackList([raw], 1)[0];
    if (sanitized) return sanitized;
    const obj = raw as Record<string, unknown>;
    const rawTarget =
      typeof obj.target === 'string'
        ? obj.target
        : typeof obj.url === 'string'
          ? obj.url
          : typeof obj.id === 'string'
            ? obj.id
            : '';
    const id = extractYouTubeVideoId(rawTarget);
    if (!id) return null;
    const known = findKnownMediaTrackById(id);
    const title =
      typeof obj.title === 'string' && obj.title.trim()
        ? obj.title.trim()
        : fallbackTitle ?? known?.title;
    const channelTitle =
      typeof obj.channelTitle === 'string' && obj.channelTitle.trim()
        ? obj.channelTitle.trim()
        : known?.channelTitle;
    return buildTrackFromVideoId(id, title, channelTitle);
  }
  return null;
}

const VALID_MUSIC_TABS: readonly MusicTab[] = [
  'discover',
  'soundscapes',
  'queue',
  'liked',
  'playlists',
  'history',
];

export function dispatchWidgetMusicCommand(
  action: string,
  payload?: unknown,
  openMusicApp?: () => void
): boolean {
  const triggerOpenMusic = () => {
    if (openMusicApp) {
      openMusicApp();
    } else {
      requestOpenApp('music', { preferExisting: true });
    }
  };

  switch (action) {
    case 'toggle':
      toggleMusicPlayback();
      return true;
    case 'play': {
      if (payload === undefined || payload === null || payload === '') {
        resumeMusicPlayback();
        return true;
      }
      const resolved = resolveWidgetTrackInput(payload);
      if (!resolved) return false;
      playMusicTrack(resolved);
      return true;
    }
    case 'pause':
      pauseMusicPlayback();
      return true;
    case 'stop':
      stopMusic();
      return true;
    case 'next':
      if (musicState.current) stepMusicTrack(1, 'manual');
      else playStarterMusicStream(0);
      return true;
    case 'prev':
      if (musicState.current) stepMusicTrack(-1, 'manual');
      else playStarterMusicStream(0);
      return true;
    case 'seek':
      if (typeof payload === 'number' && Number.isFinite(payload)) {
        seekMusicTo(payload);
        return true;
      }
      return false;
    case 'set-volume':
      if (typeof payload === 'number' && Number.isFinite(payload)) {
        setMusicVolume(payload);
        return true;
      }
      return false;
    case 'toggle-mute':
      toggleMusicMute();
      return true;
    case 'toggle-shuffle':
      toggleMusicShuffle();
      return true;
    case 'cycle-repeat':
      cycleMusicRepeat();
      return true;
    case 'toggle-like': {
      const target =
        payload !== undefined && payload !== null
          ? resolveWidgetTrackInput(payload)
          : musicState.current;
      if (!target) return false;
      toggleMusicTrackLiked(target);
      return true;
    }
    case 'play-stream': {
      if (typeof payload === 'number' && Number.isFinite(payload) && STARTER_MUSIC_STREAMS.length > 0) {
        const len = STARTER_MUSIC_STREAMS.length;
        const idx = ((Math.floor(payload) % len) + len) % len;
        playStarterMusicStream(idx);
        return true;
      }
      if (typeof payload === 'string' && payload.trim()) {
        const needle = payload.trim().toLowerCase();
        const found =
          STARTER_MUSIC_STREAMS.find(s => s.id.toLowerCase() === needle) ??
          STARTER_MUSIC_STREAMS.find(s => s.title.toLowerCase().includes(needle));
        if (found) {
          playMusicTrack(found, STARTER_MUSIC_STREAMS);
          return true;
        }
      }
      playStarterMusicStream(0);
      return true;
    }
    case 'play-playlist': {
      if (typeof payload !== 'string' || !payload.trim()) return false;
      const needle = payload.trim();
      const byId = musicState.playlists.find(p => p.id === needle);
      const target =
        byId ??
        musicState.playlists.find(p => p.name.toLowerCase() === needle.toLowerCase());
      if (!target || target.tracks.length === 0) return false;
      playMusicPlaylist(target.id);
      return true;
    }
    case 'enqueue': {
      const resolved = resolveWidgetTrackInput(payload);
      if (!resolved) return false;
      enqueueTrackNext(resolved);
      return true;
    }
    case 'search': {
      if (typeof payload !== 'string' || !payload.trim()) return false;
      enqueueMusicAction({ kind: 'search', query: payload.trim().slice(0, 160) });
      triggerOpenMusic();
      return true;
    }
    case 'open': {
      if (typeof payload === 'string' && VALID_MUSIC_TABS.includes(payload as MusicTab)) {
        enqueueMusicAction({ kind: 'tab', tab: payload as MusicTab });
      }
      triggerOpenMusic();
      return true;
    }
    case 'set-soundscape': {
      if (!payload || typeof payload !== 'object' || Array.isArray(payload)) return false;
      const obj = payload as Record<string, unknown>;
      const layer = typeof obj.layer === 'string' ? (obj.layer as SoundscapeLayerId) : null;
      const level = Number(obj.level);
      if (!layer || !VALID_SOUNDSCAPE_LAYER_IDS.has(layer) || !Number.isFinite(level)) {
        return false;
      }
      setSoundscapeLayerLevel(layer, level);
      return true;
    }
    case 'toggle-soundscape': {
      if (typeof payload === 'boolean') {
        setSoundscapePlaying(payload);
      } else {
        toggleSoundscapePlaying();
      }
      return true;
    }
    case 'set-soundscape-volume': {
      const vol = Number(payload);
      if (!Number.isFinite(vol)) return false;
      setSoundscapeMasterVolume(vol);
      return true;
    }
    case 'apply-soundscape-preset': {
      if (typeof payload !== 'string' || !payload.trim()) return false;
      return applySoundscapePreset(payload);
    }
    case 'clear-soundscape': {
      clearSoundscapeLevels();
      return true;
    }
    default:
      return false;
  }
}

