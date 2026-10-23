import type { AppId, DesktopWindow, WindowBounds, WindowState } from './types';

const STORAGE_KEY = 'nexus.desktop.v1';
const DEFAULT_STATE: WindowState = { windows: [], activeWindowId: null, nextId: 1 };

function readSavedState(): WindowState {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<WindowState>;
    // Window positions are transient; only restore the ID counter. A stale window
    // should never re-open an authenticated site unexpectedly on a new tab.
    return { ...DEFAULT_STATE, nextId: Math.max(1, Number(parsed.nextId) || 1) };
  } catch {
    return DEFAULT_STATE;
  }
}

export function persistWindowCounter(nextId: number) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ nextId }));
  } catch {
    // Private browsing or storage restrictions must not break the desktop.
  }
}

export function createInitialWindowState(): WindowState {
  return readSavedState();
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
