import type {
  AppId,
  DesktopWindow,
  SnapZone,
  WindowBounds,
  WindowSnapSide,
  WindowState,
  WindowStatus,
} from './types';

const STORAGE_KEY = 'nexus.desktop.v1';
const DEFAULT_STATE: WindowState = { windows: [], activeWindowId: null, nextId: 1 };

const DOCK_RESERVE_H = 88;
const SNAP_MARGIN = 8;
const SNAP_GAP = 8;
const EDGE_SNAP_X_THRESHOLD = 22;
const EDGE_SNAP_Y_THRESHOLD = 16;

export interface ReadWindowStateOptions {
  restoreSession?: boolean;
  validAppIds?: ReadonlySet<string>;
  viewportWidth?: number;
  viewportHeight?: number;
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

function readSavedState(options?: ReadWindowStateOptions): WindowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    const nextId = Math.max(1, Number(parsed.nextId) || 1);

    if (!options?.restoreSession || !Array.isArray(parsed.windows)) {
      return { ...DEFAULT_STATE, nextId };
    }

    const vw = options.viewportWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 1280);
    const vh = options.viewportHeight ?? (typeof window !== 'undefined' ? window.innerHeight : 800);
    const seenIds = new Set<string>();
    const restoredWindows: DesktopWindow[] = [];

    for (const item of parsed.windows) {
      if (!item || typeof item !== 'object') continue;
      const w = item as Partial<DesktopWindow>;
      if (typeof w.id !== 'string' || !w.id || seenIds.has(w.id)) continue;
      if (typeof w.appId !== 'string' || !w.appId) continue;
      if (options.validAppIds && !options.validAppIds.has(w.appId)) continue;
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

      restoredWindows.push({
        id: w.id,
        appId: w.appId as AppId,
        title: w.title.slice(0, 120) || 'Window',
        bounds,
        status,
        ...(snapZone ? { snapZone } : {}),
        ...(restoreBounds ? { restoreBounds } : {}),
      });
    }

    const activeCandidate =
      typeof parsed.activeWindowId === 'string' &&
      restoredWindows.some((w) => w.id === parsed.activeWindowId && w.status !== 'minimized')
        ? parsed.activeWindowId
        : (restoredWindows.filter((w) => w.status !== 'minimized').at(-1)?.id ?? null);

    return {
      windows: restoredWindows,
      activeWindowId: activeCandidate,
      nextId,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

export function persistWindowCounter(nextId: number): void {
  try {
    const existingRaw = localStorage.getItem(STORAGE_KEY);
    if (existingRaw) {
      const parsed = JSON.parse(existingRaw) as Partial<WindowState>;
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...parsed, nextId }));
      return;
    }
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nextId }));
  } catch {
    // Private browsing or storage restrictions must not break the desktop.
  }
}

export function persistWindowState(state: WindowState, restoreSession: boolean): void {
  try {
    if (!restoreSession) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ nextId: state.nextId }));
      return;
    }
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        nextId: state.nextId,
        activeWindowId: state.activeWindowId,
        windows: state.windows,
      })
    );
  } catch {
    // Ignore quota or private-mode restrictions.
  }
}

export function createInitialWindowState(options?: ReadWindowStateOptions): WindowState {
  return readSavedState(options);
}

export function makeWindow(appId: AppId, id: string, bounds: WindowBounds, title: string): DesktopWindow {
  return { id, appId, title, bounds, status: 'normal' };
}

export function clampBounds(bounds: WindowBounds, viewportWidth: number, viewportHeight: number): WindowBounds {
  const width = Math.min(Math.max(bounds.width, 320), Math.max(320, viewportWidth - 24));
  const height = Math.min(Math.max(bounds.height, 220), Math.max(220, viewportHeight - 100));
  return {
    width,
    height,
    x: Math.min(Math.max(bounds.x, 0), Math.max(0, viewportWidth - width)),
    y: Math.min(Math.max(bounds.y, 0), Math.max(0, viewportHeight - height - 64)),
  };
}

/**
 * Detects whether a pointer near a screen edge should trigger window snapping.
 * Disable left/right split snapping on very narrow mobile viewports (< 660px).
 */
export function detectSnapZone(
  clientX: number,
  clientY: number,
  viewportWidth: number
): SnapZone | null {
  if (clientY <= EDGE_SNAP_Y_THRESHOLD) {
    return 'top';
  }
  if (viewportWidth < 660) {
    return null;
  }
  if (clientX <= EDGE_SNAP_X_THRESHOLD) {
    return 'left';
  }
  if (clientX >= viewportWidth - EDGE_SNAP_X_THRESHOLD) {
    return 'right';
  }
  return null;
}

/**
 * Computes window-layer target bounds for left/right 50% split or top maximize preview.
 */
export function computeSnapBounds(
  zone: SnapZone,
  viewportWidth: number,
  viewportHeight: number
): WindowBounds {
  const layerHeight = Math.max(240, viewportHeight - DOCK_RESERVE_H);
  if (zone === 'top') {
    return {
      x: 0,
      y: 0,
      width: Math.max(320, viewportWidth),
      height: layerHeight,
    };
  }

  const usableWidth = Math.max(640, viewportWidth - SNAP_MARGIN * 2 - SNAP_GAP);
  const leftWidth = Math.max(320, Math.floor(usableWidth / 2));
  const rightWidth = Math.max(320, usableWidth - leftWidth);
  const height = Math.max(220, layerHeight - SNAP_MARGIN * 2);

  if (zone === 'left') {
    return {
      x: SNAP_MARGIN,
      y: SNAP_MARGIN,
      width: leftWidth,
      height,
    };
  }

  return {
    x: SNAP_MARGIN + leftWidth + SNAP_GAP,
    y: SNAP_MARGIN,
    width: rightWidth,
    height,
  };
}

/**
 * Applies a snap zone ('left' | 'right' | 'top') to a DesktopWindow while preserving
 * its original floating `restoreBounds` so unsnapping restores its floating size.
 */
export function applyWindowSnap(
  win: DesktopWindow,
  zone: SnapZone,
  viewportWidth: number,
  viewportHeight: number
): DesktopWindow {
  const savedFloating = win.restoreBounds ?? win.bounds;

  if (zone === 'top') {
    return {
      ...win,
      status: 'maximized',
      snapZone: undefined,
      restoreBounds: savedFloating,
    };
  }

  /* Toggling the same side twice unsnaps back to floating bounds */
  if (win.status === 'normal' && win.snapZone === zone) {
    return {
      ...win,
      status: 'normal',
      snapZone: undefined,
      bounds: clampBounds(savedFloating, viewportWidth, viewportHeight),
      restoreBounds: undefined,
    };
  }

  return {
    ...win,
    status: 'normal',
    snapZone: zone,
    bounds: computeSnapBounds(zone, viewportWidth, viewportHeight),
    restoreBounds: savedFloating,
  };
}

/**
 * Restores a maximized or snapped window back to its pre-snap floating bounds.
 */
export function unsnapWindow(
  win: DesktopWindow,
  viewportWidth: number,
  viewportHeight: number
): DesktopWindow {
  if (win.status !== 'maximized' && !win.snapZone) return win;
  return {
    ...win,
    status: 'normal',
    snapZone: undefined,
    bounds: clampBounds(win.restoreBounds ?? win.bounds, viewportWidth, viewportHeight),
    restoreBounds: undefined,
  };
}
