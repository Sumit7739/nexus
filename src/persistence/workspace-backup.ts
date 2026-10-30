import { APP_REGISTRY } from '../apps/registry';
import { DEFAULT_MESSAGES, type DesktopMessage } from '../data/messages';
import { normalizeHttpUrl, toShortcutAppId, type SavedShortcut } from '../data/shortcuts';
import type { DesktopPosition } from '../desktop/layout';
import {
  BROWSER_SEARCH_ENGINES,
  readBrowserHistory,
  readBrowserPrefs,
  saveBrowserHistory,
  saveBrowserPrefs,
  type BrowserHistoryItem,
  type BrowserPrefs,
  type SearchEngineId,
} from '../data/browser';
import type { WidgetDefinition } from '../widgets/types';
import type { AppId } from '../window-manager/types';
import { NEXUS_VERSION } from '../data/version';
import {
  LEGACY_NOTES_KEY,
  NOTES_STORAGE_KEY,
  readStoredNotesStateForBackup,
  sanitizeNotesState,
  saveNotesState,
  type NotesState,
} from '../data/notes';
import {
  MUSIC_HISTORY_KEY,
  readMusicHistory,
  readMusicLiked,
  readMusicPlaylists,
  readYouTubeHistory,
  readYouTubeWatchLater,
  sanitizeMediaTrackList,
  sanitizeMusicPlaylists,
  saveMusicHistory,
  saveMusicLiked,
  saveMusicPlaylists,
  saveYouTubeHistory,
  saveYouTubeWatchLater,
  YOUTUBE_HISTORY_KEY,
  type MediaTrack,
  type MusicPlaylist,
} from '../data/media';
import {
  readSpacesState,
  sanitizeSpacesState,
  saveSpacesState,
  type SpacesState,
} from '../data/spaces';
import {
  readSoundscapePersistedState,
  sanitizeSoundscapePersistedState,
  saveSoundscapePersistedState,
  type SoundscapePersistedState,
} from '../data/soundscape';
import {
  readFocusPersistedState,
  sanitizeFocusPersistedState,
  saveFocusPersistedState,
  type FocusPersistedState,
} from '../data/focus';

export const WORKSPACE_BACKUP_FORMAT = 'nexus.workspace.backup';
export const WORKSPACE_BACKUP_SCHEMA_VERSION = 1;

export interface WorkspacePreferencesSnapshot {
  theme: 'light' | 'dark';
  wallpaper: string;
  showSeconds: boolean;
  showMessages: boolean;
  restoreSession?: boolean;
  menuView: 'list' | 'grid';
  msgRefreshMins: number;
}

export interface NexusWorkspaceBackupV1 {
  format: typeof WORKSPACE_BACKUP_FORMAT;
  schemaVersion: typeof WORKSPACE_BACKUP_SCHEMA_VERSION;
  appVersion: string;
  exportedAt: string;
  preferences: WorkspacePreferencesSnapshot;
  pinnedDesktop: AppId[];
  pinnedDock: AppId[];
  desktopPositions: Record<string, DesktopPosition>;
  messages: DesktopMessage[];
  shortcuts: SavedShortcut[];
  widgets: WidgetDefinition[];
  widgetLocalData: Record<string, Record<string, string>>;
  scratchpad: string;
  notesState?: NotesState;
  browserPrefs: BrowserPrefs;
  browserHistory: BrowserHistoryItem[];
  youtubeHistory?: MediaTrack[];
  youtubeWatchLater?: MediaTrack[];
  musicHistory?: MediaTrack[];
  musicLiked?: MediaTrack[];
  musicPlaylists?: MusicPlaylist[];
  spacesState?: SpacesState;
  soundscapeState?: SoundscapePersistedState;
  focusState?: FocusPersistedState;
}

const VALID_WALLPAPERS = new Set([
  'mist', 'aurora', 'dusk', 'forest', 'ocean', 'ember',
  'lavender', 'midnight', 'rose', 'mono', 'citrus', 'glacier',
]);

const WIDGET_DATA_PREFIX = 'nexus.widget-data.v1.';

export function collectWidgetLocalData(): Record<string, Record<string, string>> {
  const out: Record<string, Record<string, string>> = {};
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith(WIDGET_DATA_PREFIX)) continue;
      const widgetId = key.slice(WIDGET_DATA_PREFIX.length);
      if (!widgetId) continue;
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const parsed: unknown = JSON.parse(raw);
      if (parsed && typeof parsed === 'object' && !Array.isArray(parsed)) {
        const cleanEntries = Object.entries(parsed as Record<string, unknown>).filter(
          ([k, v]) => typeof k === 'string' && typeof v === 'string'
        ) as [string, string][];
        if (cleanEntries.length > 0) {
          out[widgetId] = Object.fromEntries(cleanEntries);
        }
      }
    }
  } catch {
    /* Return whatever could be read safely */
  }
  return out;
}

export function buildWorkspaceBackup(input: {
  preferences: WorkspacePreferencesSnapshot;
  pinnedDesktop: AppId[];
  pinnedDock: AppId[];
  desktopPositions: Record<string, DesktopPosition>;
  messages: DesktopMessage[];
  shortcuts: SavedShortcut[];
  widgets: WidgetDefinition[];
  spacesState?: SpacesState;
}): NexusWorkspaceBackupV1 {
  const notesState = readStoredNotesStateForBackup();
  let scratchpad = '';
  try {
    scratchpad = localStorage.getItem(LEGACY_NOTES_KEY) ?? '';
  } catch {
    scratchpad = '';
  }
  if (!scratchpad && notesState) {
    const active =
      notesState.notes.find((n) => n.id === notesState.activeNoteId) ?? notesState.notes[0];
    if (active) scratchpad = active.content;
  }

  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    appVersion: NEXUS_VERSION,
    exportedAt: new Date().toISOString(),
    preferences: input.preferences,
    pinnedDesktop: input.pinnedDesktop,
    pinnedDock: input.pinnedDock,
    desktopPositions: input.desktopPositions,
    messages: input.messages,
    shortcuts: input.shortcuts,
    widgets: input.widgets,
    widgetLocalData: collectWidgetLocalData(),
    scratchpad,
    ...(notesState ? { notesState } : {}),
    browserPrefs: readBrowserPrefs(),
    browserHistory: readBrowserHistory(),
    youtubeHistory: readYouTubeHistory(),
    youtubeWatchLater: readYouTubeWatchLater(),
    musicHistory: readMusicHistory(),
    musicLiked: readMusicLiked(),
    musicPlaylists: readMusicPlaylists(),
    spacesState: input.spacesState ?? readSpacesState(),
    soundscapeState: readSoundscapePersistedState(),
    focusState: readFocusPersistedState(),
  };
}

export function parseAndValidateWorkspaceBackup(rawText: string): NexusWorkspaceBackupV1 {
  let parsed: unknown;
  try {
    parsed = JSON.parse(rawText);
  } catch {
    throw new Error('Selected file is not valid JSON.');
  }

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Backup root must be a JSON object.');
  }

  const obj = parsed as Record<string, unknown>;
  if (obj.format !== WORKSPACE_BACKUP_FORMAT) {
    throw new Error('This JSON file is not a Nexus workspace backup.');
  }
  if (obj.schemaVersion !== 1) {
    throw new Error(`Unsupported backup schema version (${String(obj.schemaVersion)}).`);
  }

  /* 1. Sanitize shortcuts first so pin references can be validated against them */
  const shortcuts: SavedShortcut[] = [];
  const seenShortcutIds = new Set<string>();
  if (Array.isArray(obj.shortcuts)) {
    for (const item of obj.shortcuts) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Partial<SavedShortcut>;
      if (typeof s.id !== 'string' || !s.id.trim() || seenShortcutIds.has(s.id)) continue;
      if (typeof s.url !== 'string') continue;
      const normalizedUrl = normalizeHttpUrl(s.url);
      if (!normalizedUrl) continue;
      seenShortcutIds.add(s.id);
      shortcuts.push({
        id: s.id,
        title: typeof s.title === 'string' && s.title.trim() ? s.title.trim().slice(0, 120) : normalizedUrl,
        url: normalizedUrl,
        mode: s.mode === 'external' ? 'external' : 'embed',
      });
    }
  }

  const validAppIds = new Set<string>([
    ...APP_REGISTRY.map((a) => a.id),
    ...shortcuts.map((s) => toShortcutAppId(s.id)),
  ]);

  const sanitizePins = (rawPins: unknown): AppId[] => {
    if (!Array.isArray(rawPins)) return [];
    const seen = new Set<string>();
    const result: AppId[] = [];
    for (const id of rawPins) {
      if (typeof id === 'string' && validAppIds.has(id) && !seen.has(id)) {
        seen.add(id);
        result.push(id as AppId);
      }
    }
    return result;
  };

  const pinnedDesktop = sanitizePins(obj.pinnedDesktop);
  const pinnedDock = sanitizePins(obj.pinnedDock);

  /* 2. Preferences */
  const rawPrefs = (obj.preferences && typeof obj.preferences === 'object' ? obj.preferences : {}) as Partial<WorkspacePreferencesSnapshot>;
  const preferences: WorkspacePreferencesSnapshot = {
    theme: rawPrefs.theme === 'dark' ? 'dark' : 'light',
    wallpaper: typeof rawPrefs.wallpaper === 'string' && VALID_WALLPAPERS.has(rawPrefs.wallpaper)
      ? rawPrefs.wallpaper
      : 'mist',
    showSeconds: rawPrefs.showSeconds === true,
    showMessages: rawPrefs.showMessages !== false,
    restoreSession: rawPrefs.restoreSession === true,
    menuView: rawPrefs.menuView === 'grid' ? 'grid' : 'list',
    msgRefreshMins:
      typeof rawPrefs.msgRefreshMins === 'number' &&
      rawPrefs.msgRefreshMins >= 1 &&
      rawPrefs.msgRefreshMins <= 60
        ? Math.round(rawPrefs.msgRefreshMins)
        : 5,
  };

  /* 3. Desktop positions */
  const desktopPositions: Record<string, DesktopPosition> = {};
  if (obj.desktopPositions && typeof obj.desktopPositions === 'object' && !Array.isArray(obj.desktopPositions)) {
    for (const [id, pos] of Object.entries(obj.desktopPositions as Record<string, unknown>)) {
      if (!validAppIds.has(id) || !pos || typeof pos !== 'object') continue;
      const p = pos as Partial<DesktopPosition>;
      if (typeof p.x === 'number' && Number.isFinite(p.x) && typeof p.y === 'number' && Number.isFinite(p.y)) {
        desktopPositions[id] = { x: Math.round(p.x), y: Math.round(p.y) };
      }
    }
  }

  /* 4. Messages */
  let messages: DesktopMessage[] = DEFAULT_MESSAGES;
  if (Array.isArray(obj.messages)) {
    const cleanMessages = obj.messages
      .filter(
        (m): m is DesktopMessage =>
          Boolean(m) &&
          typeof (m as DesktopMessage).id === 'string' &&
          typeof (m as DesktopMessage).text === 'string'
      )
      .map((m) => ({ id: m.id, text: m.text.slice(0, 280) }));
    if (cleanMessages.length > 0) {
      messages = cleanMessages;
    }
  }

  /* 5. Widgets */
  const widgets: WidgetDefinition[] = [];
  const seenWidgetIds = new Set<string>();
  if (Array.isArray(obj.widgets)) {
    for (const item of obj.widgets) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Partial<WidgetDefinition>;
      if (
        w.version === 1 &&
        typeof w.id === 'string' &&
        !seenWidgetIds.has(w.id) &&
        typeof w.name === 'string' &&
        w.source &&
        typeof w.source.html === 'string' &&
        typeof w.source.css === 'string' &&
        typeof w.source.js === 'string' &&
        typeof w.source.json === 'string' &&
        w.bounds &&
        typeof w.bounds.x === 'number' &&
        Number.isFinite(w.bounds.x) &&
        typeof w.bounds.y === 'number' &&
        Number.isFinite(w.bounds.y) &&
        typeof w.bounds.width === 'number' &&
        Number.isFinite(w.bounds.width) &&
        typeof w.bounds.height === 'number' &&
        Number.isFinite(w.bounds.height)
      ) {
        seenWidgetIds.add(w.id);
        widgets.push({
          version: 1,
          id: w.id,
          name: w.name.slice(0, 80) || 'Widget',
          source: {
            html: w.source.html,
            css: w.source.css,
            js: w.source.js,
            json: w.source.json,
          },
          bounds: {
            x: Math.round(w.bounds.x),
            y: Math.round(w.bounds.y),
            width: Math.max(120, Math.round(w.bounds.width)),
            height: Math.max(80, Math.round(w.bounds.height)),
          },
          visible: w.visible !== false,
          updatedAt: typeof w.updatedAt === 'number' && Number.isFinite(w.updatedAt) ? w.updatedAt : Date.now(),
        });
      }
    }
  }

  /* 6. Widget local storage */
  const widgetLocalData: Record<string, Record<string, string>> = {};
  if (obj.widgetLocalData && typeof obj.widgetLocalData === 'object' && !Array.isArray(obj.widgetLocalData)) {
    for (const [widgetId, kv] of Object.entries(obj.widgetLocalData as Record<string, unknown>)) {
      if (!seenWidgetIds.has(widgetId) || !kv || typeof kv !== 'object' || Array.isArray(kv)) continue;
      const cleanKv: Record<string, string> = {};
      for (const [k, v] of Object.entries(kv as Record<string, unknown>)) {
        if (typeof k === 'string' && typeof v === 'string' && v.length <= 16_000) {
          cleanKv[k] = v;
        }
      }
      widgetLocalData[widgetId] = cleanKv;
    }
  }

  /* 7. Scratchpad, NotesState, Browser Prefs & Browser History */
  const scratchpad = typeof obj.scratchpad === 'string' ? obj.scratchpad.slice(0, 200_000) : '';
  const notesState = obj.notesState !== undefined ? sanitizeNotesState(obj.notesState) ?? undefined : undefined;

  const rawBrowserPrefs = (
    obj.browserPrefs && typeof obj.browserPrefs === 'object' ? obj.browserPrefs : {}
  ) as Partial<BrowserPrefs>;
  const browserPrefs: BrowserPrefs = {
    searchEngine: BROWSER_SEARCH_ENGINES.some((e) => e.id === rawBrowserPrefs.searchEngine)
      ? (rawBrowserPrefs.searchEngine as SearchEngineId)
      : 'ai',
    showBookmarksBar: rawBrowserPrefs.showBookmarksBar !== false,
    preferExternalTabs: rawBrowserPrefs.preferExternalTabs === true,
  };

  const browserHistory: BrowserHistoryItem[] = [];
  if (Array.isArray(obj.browserHistory)) {
    for (const entry of obj.browserHistory) {
      if (!entry || typeof entry !== 'object') continue;
      const h = entry as Partial<BrowserHistoryItem>;
      if (
        typeof h.id === 'string' &&
        (h.kind === 'url' || h.kind === 'search') &&
        typeof h.title === 'string' &&
        typeof h.value === 'string' &&
        typeof h.visitedAt === 'number' &&
        Number.isFinite(h.visitedAt)
      ) {
        browserHistory.push({
          id: h.id,
          kind: h.kind,
          title: h.title.slice(0, 120),
          value: h.value.slice(0, 500),
          engine:
            h.engine && BROWSER_SEARCH_ENGINES.some((e) => e.id === h.engine)
              ? h.engine
              : undefined,
          visitedAt: h.visitedAt,
        });
      }
      if (browserHistory.length >= 16) break;
    }
  }

  const youtubeHistory = obj.youtubeHistory !== undefined ? sanitizeMediaTrackList(obj.youtubeHistory, 30) : undefined;
  const youtubeWatchLater = obj.youtubeWatchLater !== undefined ? sanitizeMediaTrackList(obj.youtubeWatchLater, 40) : undefined;
  const musicHistory = obj.musicHistory !== undefined ? sanitizeMediaTrackList(obj.musicHistory, 40) : undefined;
  const musicLiked = obj.musicLiked !== undefined ? sanitizeMediaTrackList(obj.musicLiked, 60) : undefined;
  const musicPlaylists = obj.musicPlaylists !== undefined ? sanitizeMusicPlaylists(obj.musicPlaylists) : undefined;
  const spacesState =
    obj.spacesState !== undefined
      ? sanitizeSpacesState(obj.spacesState, validAppIds) ?? undefined
      : undefined;
  const soundscapeState =
    obj.soundscapeState !== undefined
      ? sanitizeSoundscapePersistedState(obj.soundscapeState) ?? undefined
      : undefined;
  const focusState =
    obj.focusState !== undefined
      ? sanitizeFocusPersistedState(obj.focusState) ?? undefined
      : undefined;

  return {
    format: WORKSPACE_BACKUP_FORMAT,
    schemaVersion: WORKSPACE_BACKUP_SCHEMA_VERSION,
    appVersion: typeof obj.appVersion === 'string' && obj.appVersion.trim() ? obj.appVersion.trim().slice(0, 32) : NEXUS_VERSION,
    exportedAt: typeof obj.exportedAt === 'string' ? obj.exportedAt : new Date().toISOString(),
    preferences,
    pinnedDesktop,
    pinnedDock,
    desktopPositions,
    messages,
    shortcuts,
    widgets,
    widgetLocalData,
    scratchpad,
    ...(notesState ? { notesState } : {}),
    browserPrefs,
    browserHistory,
    ...(youtubeHistory !== undefined ? { youtubeHistory } : {}),
    ...(youtubeWatchLater !== undefined ? { youtubeWatchLater } : {}),
    ...(musicHistory !== undefined ? { musicHistory } : {}),
    ...(musicLiked !== undefined ? { musicLiked } : {}),
    ...(musicPlaylists !== undefined ? { musicPlaylists } : {}),
    ...(spacesState !== undefined ? { spacesState } : {}),
    ...(soundscapeState !== undefined ? { soundscapeState } : {}),
    ...(focusState !== undefined ? { focusState } : {}),
  };
}

export function applyWorkspaceBackupToStorage(backup: NexusWorkspaceBackupV1): void {
  try {
    if (backup.notesState) {
      saveNotesState(backup.notesState);
    } else {
      localStorage.removeItem(NOTES_STORAGE_KEY);
      localStorage.setItem(LEGACY_NOTES_KEY, backup.scratchpad);
    }
    saveBrowserPrefs(backup.browserPrefs);
    saveBrowserHistory(backup.browserHistory);
    if (backup.youtubeHistory !== undefined) saveYouTubeHistory(backup.youtubeHistory);
    if (backup.youtubeWatchLater !== undefined) saveYouTubeWatchLater(backup.youtubeWatchLater);
    if (backup.musicHistory !== undefined) saveMusicHistory(backup.musicHistory);
    if (backup.musicLiked !== undefined) saveMusicLiked(backup.musicLiked);
    if (backup.musicPlaylists !== undefined) saveMusicPlaylists(backup.musicPlaylists);
    if (backup.spacesState !== undefined) saveSpacesState(backup.spacesState);
    if (backup.soundscapeState !== undefined) saveSoundscapePersistedState(backup.soundscapeState);
    if (backup.focusState !== undefined) saveFocusPersistedState(backup.focusState);
    for (const [widgetId, kv] of Object.entries(backup.widgetLocalData)) {
      localStorage.setItem(`${WIDGET_DATA_PREFIX}${widgetId}`, JSON.stringify(kv));
    }
  } catch {
    /* Main React state still updates cleanly even if storage quota is constrained */
  }
}

export function clearAllWorkspaceStorage(): void {
  try {
    const keysToRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (
        k &&
        (k.startsWith('nexus.') || k === YOUTUBE_HISTORY_KEY || k === MUSIC_HISTORY_KEY)
      ) {
        keysToRemove.push(k);
      }
    }
    for (const k of keysToRemove) {
      localStorage.removeItem(k);
    }
  } catch {
    /* Ignore storage access errors */
  }
  try {
    sessionStorage.removeItem('nexus.session-unlocked');
  } catch {
    /* Ignore session storage access errors */
  }
}
