import {
  getMusicState,
  pauseMusicPlayback,
  playMusicPlaylist,
  playMusicTrack,
  resumeMusicPlayback,
  STARTER_MUSIC_STREAMS,
  type MusicPlaylist,
} from './media';
import type { WidgetDefinition } from '../widgets/types';
import { clampBounds, computeSnapBounds } from '../window-manager/window-store';
import type {
  AppId,
  DesktopWindow,
  WindowBounds,
  WindowSnapSide,
  WindowState,
  WindowStatus,
} from '../window-manager/types';

export const SPACES_STORAGE_KEY = 'nexus.spaces.v1';
export const MAX_SPACES = 6;

export type SpaceWallpaperId =
  | 'mist'
  | 'aurora'
  | 'dusk'
  | 'forest'
  | 'ocean'
  | 'ember'
  | 'lavender'
  | 'midnight'
  | 'rose'
  | 'mono'
  | 'citrus'
  | 'glacier';

export const VALID_SPACE_WALLPAPERS = new Set<SpaceWallpaperId>([
  'mist',
  'aurora',
  'dusk',
  'forest',
  'ocean',
  'ember',
  'lavender',
  'midnight',
  'rose',
  'mono',
  'citrus',
  'glacier',
]);

export type SpaceAudioRule =
  | { kind: 'keep' }
  | { kind: 'pause' }
  | { kind: 'stream'; streamId: string }
  | { kind: 'playlist'; playlistId: string };

export interface DesktopSpace {
  id: string;
  name: string;
  description: string;
  wallpaper: SpaceWallpaperId;
  windows: DesktopWindow[];
  activeWindowId: string | null;
  widgetVisibility: Record<string, boolean>;
  audioRule: SpaceAudioRule;
  updatedAt: number;
}

export interface SpacesState {
  version: 1;
  activeSpaceId: string;
  spaces: DesktopSpace[];
}

export interface CreateDefaultSpacesOptions {
  initialWallpaper?: SpaceWallpaperId;
  initialWindows?: DesktopWindow[];
  initialActiveWindowId?: string | null;
  viewportWidth?: number;
  viewportHeight?: number;
  now?: number;
}

function isFiniteBounds(raw: unknown): raw is WindowBounds {
  if (!raw || typeof raw !== 'object') return false;
  const b = raw as Partial<WindowBounds>;
  return (
    typeof b.x === 'number' &&
    Number.isFinite(b.x) &&
    typeof b.y === 'number' &&
    Number.isFinite(b.y) &&
    typeof b.width === 'number' &&
    Number.isFinite(b.width) &&
    typeof b.height === 'number' &&
    Number.isFinite(b.height)
  );
}

export function cloneWindowsList(windows: readonly DesktopWindow[]): DesktopWindow[] {
  return windows.map((win) => ({
    ...win,
    bounds: { ...win.bounds },
    ...(win.restoreBounds ? { restoreBounds: { ...win.restoreBounds } } : {}),
  }));
}

export function extractMaxWindowSequence(windows: readonly DesktopWindow[]): number {
  let maxSeq = 0;
  for (const win of windows) {
    const match = /^window-(\d+)$/.exec(win.id);
    if (match) {
      const parsed = Number(match[1]);
      if (Number.isFinite(parsed) && parsed > maxSeq) {
        maxSeq = parsed;
      }
    }
  }
  return maxSeq;
}

export function sanitizeSpaceAudioRule(raw: unknown): SpaceAudioRule {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) {
    return { kind: 'keep' };
  }
  const obj = raw as Record<string, unknown>;
  if (obj.kind === 'pause') return { kind: 'pause' };
  if (obj.kind === 'stream' && typeof obj.streamId === 'string' && obj.streamId.trim()) {
    const cleanId = obj.streamId.trim().slice(0, 32);
    if (STARTER_MUSIC_STREAMS.some((s) => s.id === cleanId)) {
      return { kind: 'stream', streamId: cleanId };
    }
    return { kind: 'stream', streamId: STARTER_MUSIC_STREAMS[0].id };
  }
  if (obj.kind === 'playlist' && typeof obj.playlistId === 'string' && obj.playlistId.trim()) {
    return { kind: 'playlist', playlistId: obj.playlistId.trim().slice(0, 80) };
  }
  return { kind: 'keep' };
}

function sanitizeSpaceWindows(
  rawWindows: unknown,
  validAppIds: ReadonlySet<string> | undefined,
  vw: number,
  vh: number
): DesktopWindow[] {
  if (!Array.isArray(rawWindows)) return [];
  const seenIds = new Set<string>();
  const result: DesktopWindow[] = [];

  for (const item of rawWindows) {
    if (!item || typeof item !== 'object') continue;
    const w = item as Partial<DesktopWindow>;
    if (typeof w.id !== 'string' || !w.id.trim() || seenIds.has(w.id)) continue;
    if (typeof w.appId !== 'string' || !w.appId.trim()) continue;
    if (validAppIds && !validAppIds.has(w.appId)) continue;
    if (typeof w.title !== 'string' || !isFiniteBounds(w.bounds)) continue;

    seenIds.add(w.id);
    const status: WindowStatus =
      w.status === 'minimized' || w.status === 'maximized' ? w.status : 'normal';
    const snapZone: WindowSnapSide | undefined =
      status === 'normal' && (w.snapZone === 'left' || w.snapZone === 'right')
        ? w.snapZone
        : undefined;
    const bounds = snapZone
      ? computeSnapBounds(snapZone, vw, vh)
      : clampBounds(w.bounds, vw, vh);
    const restoreBounds = isFiniteBounds(w.restoreBounds)
      ? clampBounds(w.restoreBounds, vw, vh)
      : undefined;

    result.push({
      id: w.id,
      appId: w.appId as AppId,
      title: w.title.slice(0, 120) || 'Window',
      bounds,
      status,
      ...(snapZone ? { snapZone } : {}),
      ...(restoreBounds ? { restoreBounds } : {}),
    });
  }

  return result;
}

export function createDefaultSpacesState(options: CreateDefaultSpacesOptions = {}): SpacesState {
  const vw = options.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const vh = options.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
  const ts = options.now ?? Date.now();
  const baseWallpaper: SpaceWallpaperId =
    options.initialWallpaper && VALID_SPACE_WALLPAPERS.has(options.initialWallpaper)
      ? options.initialWallpaper
      : 'mist';

  const initialWins = options.initialWindows ? cloneWindowsList(options.initialWindows) : [];
  const baseSeq = Math.max(20, extractMaxWindowSequence(initialWins) + 1);

  const leftResearchBounds = computeSnapBounds('left', vw, vh);
  const rightResearchBounds = computeSnapBounds('right', vw, vh);

  const musicBounds = clampBounds({ x: 96, y: 58, width: 820, height: 540 }, vw, vh);
  const tubeBounds = clampBounds({ x: 220, y: 92, width: 860, height: 550 }, vw, vh);

  const spaces: DesktopSpace[] = [
    {
      id: 'space-deep-work',
      name: 'Deep Work',
      description: 'Distraction-free focus canvas',
      wallpaper: baseWallpaper,
      windows: initialWins,
      activeWindowId: options.initialActiveWindowId ?? (initialWins.at(-1)?.id ?? null),
      widgetVisibility: {},
      audioRule: { kind: 'keep' },
      updatedAt: ts,
    },
    {
      id: 'space-research',
      name: 'Research',
      description: 'Browser & Scratchpad 50/50 split',
      wallpaper: 'glacier',
      windows: [
        {
          id: `window-${baseSeq}`,
          appId: 'browser',
          title: 'Browser',
          bounds: leftResearchBounds,
          status: 'normal',
          snapZone: 'left',
          restoreBounds: clampBounds({ x: 92, y: 56, width: 920, height: 590 }, vw, vh),
        },
        {
          id: `window-${baseSeq + 1}`,
          appId: 'notes',
          title: 'Scratchpad',
          bounds: rightResearchBounds,
          status: 'normal',
          snapZone: 'right',
          restoreBounds: clampBounds({ x: 210, y: 74, width: 760, height: 540 }, vw, vh),
        },
      ],
      activeWindowId: `window-${baseSeq}`,
      widgetVisibility: {},
      audioRule: { kind: 'keep' },
      updatedAt: ts,
    },
    {
      id: 'space-unwind',
      name: 'Unwind',
      description: 'Music & Nexus Tube lounge',
      wallpaper: 'dusk',
      windows: [
        {
          id: `window-${baseSeq + 2}`,
          appId: 'youtube',
          title: 'Nexus Tube',
          bounds: tubeBounds,
          status: 'normal',
        },
        {
          id: `window-${baseSeq + 3}`,
          appId: 'music',
          title: 'Music',
          bounds: musicBounds,
          status: 'normal',
        },
      ],
      activeWindowId: `window-${baseSeq + 3}`,
      widgetVisibility: {},
      audioRule: { kind: 'stream', streamId: '5yx6BWlEVcY' },
      updatedAt: ts,
    },
  ];

  return {
    version: 1,
    activeSpaceId: spaces[0].id,
    spaces,
  };
}

export function sanitizeSpacesState(
  raw: unknown,
  validAppIds?: ReadonlySet<string>,
  viewportWidth?: number,
  viewportHeight?: number
): SpacesState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.spaces) || obj.spaces.length === 0) return null;

  const vw = viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
  const vh = viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800);

  const seenIds = new Set<string>();
  const spaces: DesktopSpace[] = [];

  for (const entry of obj.spaces) {
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const sp = entry as Record<string, unknown>;
    if (typeof sp.id !== 'string' || !sp.id.trim() || seenIds.has(sp.id)) continue;
    if (typeof sp.name !== 'string' || !sp.name.trim()) continue;

    const id = sp.id.trim().slice(0, 64);
    seenIds.add(id);

    const wallpaper: SpaceWallpaperId =
      typeof sp.wallpaper === 'string' && VALID_SPACE_WALLPAPERS.has(sp.wallpaper as SpaceWallpaperId)
        ? (sp.wallpaper as SpaceWallpaperId)
        : 'mist';

    const windows = sanitizeSpaceWindows(sp.windows, validAppIds, vw, vh);
    const activeCandidate =
      typeof sp.activeWindowId === 'string' &&
      windows.some((w) => w.id === sp.activeWindowId && w.status !== 'minimized')
        ? sp.activeWindowId
        : (windows.filter((w) => w.status !== 'minimized').at(-1)?.id ?? null);

    const widgetVisibility: Record<string, boolean> = {};
    if (
      sp.widgetVisibility &&
      typeof sp.widgetVisibility === 'object' &&
      !Array.isArray(sp.widgetVisibility)
    ) {
      for (const [wId, vis] of Object.entries(sp.widgetVisibility as Record<string, unknown>)) {
        if (typeof wId === 'string' && wId && typeof vis === 'boolean') {
          widgetVisibility[wId] = vis;
        }
      }
    }

    spaces.push({
      id,
      name: sp.name.trim().slice(0, 40),
      description:
        typeof sp.description === 'string' ? sp.description.trim().slice(0, 90) : '',
      wallpaper,
      windows,
      activeWindowId: activeCandidate,
      widgetVisibility,
      audioRule: sanitizeSpaceAudioRule(sp.audioRule),
      updatedAt:
        typeof sp.updatedAt === 'number' && Number.isFinite(sp.updatedAt)
          ? sp.updatedAt
          : Date.now(),
    });

    if (spaces.length >= MAX_SPACES) break;
  }

  if (spaces.length === 0) return null;

  const activeSpaceId =
    typeof obj.activeSpaceId === 'string' && spaces.some((s) => s.id === obj.activeSpaceId)
      ? obj.activeSpaceId
      : spaces[0].id;

  return {
    version: 1,
    activeSpaceId,
    spaces,
  };
}

export function readSpacesState(options: CreateDefaultSpacesOptions & { validAppIds?: ReadonlySet<string> } = {}): SpacesState {
  try {
    const raw = localStorage.getItem(SPACES_STORAGE_KEY);
    if (raw) {
      const parsed: unknown = JSON.parse(raw);
      const sanitized = sanitizeSpacesState(
        parsed,
        options.validAppIds,
        options.viewportWidth,
        options.viewportHeight
      );
      if (sanitized) return sanitized;
    }
  } catch {
    /* Fall through to clean defaults */
  }
  return createDefaultSpacesState(options);
}

export function saveSpacesState(state: SpacesState): void {
  try {
    localStorage.setItem(SPACES_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Ignore storage quota or private-mode errors */
  }
}

export function syncLiveDesktopIntoActiveSpace(
  state: SpacesState,
  live: {
    windows: DesktopWindow[];
    activeWindowId: string | null;
    wallpaper: SpaceWallpaperId;
  }
): SpacesState {
  const idx = state.spaces.findIndex((s) => s.id === state.activeSpaceId);
  if (idx === -1) return state;

  const current = state.spaces[idx];
  const sameWallpaper = current.wallpaper === live.wallpaper;
  const sameActive = current.activeWindowId === live.activeWindowId;
  const sameWindows =
    current.windows.length === live.windows.length &&
    current.windows.every((w, i) => {
      const lw = live.windows[i];
      return (
        lw &&
        w.id === lw.id &&
        w.appId === lw.appId &&
        w.title === lw.title &&
        w.status === lw.status &&
        w.snapZone === lw.snapZone &&
        w.bounds.x === lw.bounds.x &&
        w.bounds.y === lw.bounds.y &&
        w.bounds.width === lw.bounds.width &&
        w.bounds.height === lw.bounds.height
      );
    });

  if (sameWallpaper && sameActive && sameWindows) {
    return state;
  }

  const updatedSpace: DesktopSpace = {
    ...current,
    wallpaper: live.wallpaper,
    windows: cloneWindowsList(live.windows),
    activeWindowId: live.activeWindowId,
    updatedAt: Date.now(),
  };

  const nextSpaces = [...state.spaces];
  nextSpaces[idx] = updatedSpace;
  return {
    ...state,
    spaces: nextSpaces,
  };
}

export function materializeSpaceWindows(
  space: DesktopSpace,
  currentNextId: number,
  validAppIds: ReadonlySet<string>,
  viewportWidth: number,
  viewportHeight: number
): WindowState {
  const windows = sanitizeSpaceWindows(space.windows, validAppIds, viewportWidth, viewportHeight);
  const activeWindowId =
    space.activeWindowId &&
    windows.some((w) => w.id === space.activeWindowId && w.status !== 'minimized')
      ? space.activeWindowId
      : (windows.filter((w) => w.status !== 'minimized').at(-1)?.id ?? null);

  const highestSeq = extractMaxWindowSequence(windows);
  const nextId = Math.max(currentNextId, highestSeq + 1, 1);

  return {
    windows,
    activeWindowId,
    nextId,
  };
}

export function isWidgetVisibleInSpace(
  widget: WidgetDefinition,
  space: DesktopSpace | undefined
): boolean {
  if (!space) return widget.visible;
  if (Object.prototype.hasOwnProperty.call(space.widgetVisibility, widget.id)) {
    return Boolean(space.widgetVisibility[widget.id]);
  }
  return widget.visible;
}

export function setSpaceWidgetVisibility(
  state: SpacesState,
  spaceId: string,
  widgetId: string,
  visible: boolean
): SpacesState {
  return {
    ...state,
    spaces: state.spaces.map((sp) =>
      sp.id === spaceId
        ? {
            ...sp,
            widgetVisibility: {
              ...sp.widgetVisibility,
              [widgetId]: visible,
            },
            updatedAt: Date.now(),
          }
        : sp
    ),
  };
}

export function createSpaceFromCurrentDesktop(
  state: SpacesState,
  input: {
    name?: string;
    description?: string;
    wallpaper: SpaceWallpaperId;
    windows: DesktopWindow[];
    activeWindowId: string | null;
    widgets: WidgetDefinition[];
    audioRule?: SpaceAudioRule;
  }
): { state: SpacesState; created: DesktopSpace } | null {
  if (state.spaces.length >= MAX_SPACES) return null;

  const activeSpace = state.spaces.find((s) => s.id === state.activeSpaceId);
  const widgetVisibility: Record<string, boolean> = {};
  for (const w of input.widgets) {
    widgetVisibility[w.id] = isWidgetVisibleInSpace(w, activeSpace);
  }

  const indexNum = state.spaces.length + 1;
  const cleanName = (input.name?.trim() || `Space ${indexNum}`).slice(0, 40);
  const created: DesktopSpace = {
    id: `space-${crypto.randomUUID()}`,
    name: cleanName,
    description: (input.description?.trim() || 'Custom workspace context').slice(0, 90),
    wallpaper: input.wallpaper,
    windows: cloneWindowsList(input.windows),
    activeWindowId: input.activeWindowId,
    widgetVisibility,
    audioRule: input.audioRule ?? { kind: 'keep' },
    updatedAt: Date.now(),
  };

  const syncedCurrent = syncLiveDesktopIntoActiveSpace(state, {
    windows: input.windows,
    activeWindowId: input.activeWindowId,
    wallpaper: input.wallpaper,
  });

  return {
    created,
    state: {
      ...syncedCurrent,
      activeSpaceId: created.id,
      spaces: [...syncedCurrent.spaces, created],
    },
  };
}

export function moveWindowToSpace(
  spacesState: SpacesState,
  currentWindowState: WindowState,
  windowId: string,
  targetSpaceId: string,
  viewportWidth: number,
  viewportHeight: number
): { spacesState: SpacesState; windowState: WindowState } | null {
  if (targetSpaceId === spacesState.activeSpaceId) return null;
  const targetSpace = spacesState.spaces.find((s) => s.id === targetSpaceId);
  const movingWin = currentWindowState.windows.find((w) => w.id === windowId);
  if (!targetSpace || !movingWin) return null;

  const remainingWindows = currentWindowState.windows.filter((w) => w.id !== windowId);
  const nextActiveWindowId =
    currentWindowState.activeWindowId === windowId
      ? (remainingWindows.filter((w) => w.status !== 'minimized').at(-1)?.id ?? null)
      : currentWindowState.activeWindowId;

  const nextWindowState: WindowState = {
    ...currentWindowState,
    windows: remainingWindows,
    activeWindowId: nextActiveWindowId,
  };

  /* Deduplicate single-instance apps if the same appId already exists in target space */
  const isSingleInstance =
    movingWin.appId === 'settings' ||
    movingWin.appId === 'bookmarks' ||
    movingWin.appId === 'music' ||
    movingWin.appId === 'youtube' ||
    movingWin.appId === 'widgets' ||
    movingWin.appId.startsWith('shortcut:');

  const filteredTargetWins = isSingleInstance
    ? targetSpace.windows.filter((w) => w.appId !== movingWin.appId)
    : targetSpace.windows;

  const normalizedMoved: DesktopWindow = {
    ...movingWin,
    bounds: movingWin.snapZone
      ? computeSnapBounds(movingWin.snapZone, viewportWidth, viewportHeight)
      : clampBounds(movingWin.bounds, viewportWidth, viewportHeight),
    status: movingWin.status === 'minimized' ? 'normal' : movingWin.status,
  };

  const nextSpaces = spacesState.spaces.map((sp) => {
    if (sp.id === spacesState.activeSpaceId) {
      return {
        ...sp,
        windows: cloneWindowsList(remainingWindows),
        activeWindowId: nextActiveWindowId,
        updatedAt: Date.now(),
      };
    }
    if (sp.id === targetSpaceId) {
      const updatedWins = [...cloneWindowsList(filteredTargetWins), normalizedMoved];
      return {
        ...sp,
        windows: updatedWins,
        activeWindowId: normalizedMoved.id,
        updatedAt: Date.now(),
      };
    }
    return sp;
  });

  return {
    spacesState: {
      ...spacesState,
      spaces: nextSpaces,
    },
    windowState: nextWindowState,
  };
}

export function describeSpaceAudioRule(
  rule: SpaceAudioRule,
  playlists: readonly MusicPlaylist[] = []
): string {
  if (rule.kind === 'pause') return 'Pause audio';
  if (rule.kind === 'stream') {
    const stream = STARTER_MUSIC_STREAMS.find((s) => s.id === rule.streamId);
    if (!stream) return 'Focus radio';
    const shortTitle = stream.title.split('—')[0].trim();
    return shortTitle.length > 22 ? `${shortTitle.slice(0, 21).trimEnd()}…` : shortTitle;
  }
  if (rule.kind === 'playlist') {
    const pl = playlists.find((p) => p.id === rule.playlistId);
    return pl ? `Playlist: ${pl.name}` : 'Saved playlist';
  }
  return 'Keep audio';
}

export function describeSpaceSummary(
  space: DesktopSpace,
  wallpaperName: string,
  playlists: readonly MusicPlaylist[] = []
): string {
  const winCount = space.windows.length;
  const hasSplit =
    space.windows.some((w) => w.snapZone === 'left') &&
    space.windows.some((w) => w.snapZone === 'right');

  const winText =
    winCount === 0
      ? 'Clean canvas'
      : hasSplit
        ? `${winCount} windows · Split`
        : `${winCount} ${winCount === 1 ? 'window' : 'windows'}`;

  const audioText = describeSpaceAudioRule(space.audioRule, playlists);
  return `${winText} · ${wallpaperName} · ${audioText}`;
}

export function applySpaceAudioRule(rule: SpaceAudioRule): void {
  if (rule.kind === 'keep') return;
  if (rule.kind === 'pause') {
    pauseMusicPlayback();
    return;
  }
  if (rule.kind === 'stream') {
    const stream =
      STARTER_MUSIC_STREAMS.find((s) => s.id === rule.streamId) ?? STARTER_MUSIC_STREAMS[0];
    if (!stream) return;
    const current = getMusicState();
    if (current.current?.id === stream.id) {
      if (!current.isPlaying) resumeMusicPlayback();
      return;
    }
    playMusicTrack(stream, STARTER_MUSIC_STREAMS);
    return;
  }
  if (rule.kind === 'playlist') {
    const current = getMusicState();
    const pl = current.playlists.find((p) => p.id === rule.playlistId);
    if (pl && pl.tracks.length > 0) {
      playMusicPlaylist(pl.id);
    }
  }
}

export function serializeAudioRuleValue(rule: SpaceAudioRule): string {
  if (rule.kind === 'pause') return 'pause';
  if (rule.kind === 'stream') return `stream:${rule.streamId}`;
  if (rule.kind === 'playlist') return `playlist:${rule.playlistId}`;
  return 'keep';
}

export function parseAudioRuleValue(value: string): SpaceAudioRule {
  if (value === 'pause') return { kind: 'pause' };
  if (value.startsWith('stream:')) {
    const streamId = value.slice('stream:'.length);
    return sanitizeSpaceAudioRule({ kind: 'stream', streamId });
  }
  if (value.startsWith('playlist:')) {
    const playlistId = value.slice('playlist:'.length);
    return sanitizeSpaceAudioRule({ kind: 'playlist', playlistId });
  }
  return { kind: 'keep' };
}
