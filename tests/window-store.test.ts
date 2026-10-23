import { afterEach, describe, expect, it } from 'vitest';
import { clampBounds, createInitialWindowState, makeWindow } from '../src/window-manager/window-store';

afterEach(() => localStorage.clear());

describe('window-store utilities', () => {
  it('starts with no open windows', () => {
    expect(createInitialWindowState()).toEqual({ windows: [], activeWindowId: null, nextId: 1 });
  });

  it('clamps windows to the visible viewport', () => {
    expect(clampBounds({ x: 999, y: 999, width: 700, height: 500 }, 1000, 700)).toEqual({ x: 300, y: 136, width: 700, height: 500 });
  });

  it('creates a normal window with the requested app and bounds', () => {
    const bounds = { x: 20, y: 30, width: 500, height: 360 };
    expect(makeWindow('notes', 'window-1', bounds, 'Scratchpad')).toEqual({ id: 'window-1', appId: 'notes', title: 'Scratchpad', bounds, status: 'normal' });
  });
});
