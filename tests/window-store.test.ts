import { afterEach, describe, expect, it } from 'vitest';
import {
  applyWindowSnap,
  clampBounds,
  computeSnapBounds,
  createInitialWindowState,
  detectSnapZone,
  makeWindow,
  persistWindowState,
  unsnapWindow,
} from '../src/window-manager/window-store';

afterEach(() => localStorage.clear());

describe('window-store utilities', () => {
  it('starts with no open windows by default', () => {
    expect(createInitialWindowState()).toEqual({ windows: [], activeWindowId: null, nextId: 1 });
  });

  it('clamps windows to the visible viewport', () => {
    expect(clampBounds({ x: 999, y: 999, width: 700, height: 500 }, 1000, 700)).toEqual({
      x: 300,
      y: 136,
      width: 700,
      height: 500,
    });
  });

  it('creates a normal window with the requested app and bounds', () => {
    const bounds = { x: 20, y: 30, width: 500, height: 360 };
    expect(makeWindow('notes', 'window-1', bounds, 'Scratchpad')).toEqual({
      id: 'window-1',
      appId: 'notes',
      title: 'Scratchpad',
      bounds,
      status: 'normal',
    });
  });

  it('detects left, right, and top snap zones and disables side-split on narrow viewports', () => {
    expect(detectSnapZone(8, 250, 1440)).toBe('left');
    expect(detectSnapZone(1432, 250, 1440)).toBe('right');
    expect(detectSnapZone(600, 6, 1440)).toBe('top');
    expect(detectSnapZone(500, 300, 1440)).toBeNull();
    expect(detectSnapZone(4, 250, 500)).toBeNull();
  });

  it('snaps windows to 50/50 split bounds and restores original floating bounds on unsnap', () => {
    const originalBounds = { x: 140, y: 90, width: 640, height: 440 };
    const win = makeWindow('browser', 'window-1', originalBounds, 'Browser');

    const snappedLeft = applyWindowSnap(win, 'left', 1440, 900);
    expect(snappedLeft.snapZone).toBe('left');
    expect(snappedLeft.restoreBounds).toEqual(originalBounds);
    expect(snappedLeft.bounds).toEqual(computeSnapBounds('left', 1440, 900));

    /* Snapping right from left preserves the original floating restoreBounds */
    const snappedRight = applyWindowSnap(snappedLeft, 'right', 1440, 900);
    expect(snappedRight.snapZone).toBe('right');
    expect(snappedRight.restoreBounds).toEqual(originalBounds);
    expect(snappedRight.bounds.x).toBeGreaterThan(snappedLeft.bounds.width);

    /* Unsnapping returns to original floating bounds */
    const restored = unsnapWindow(snappedRight, 1440, 900);
    expect(restored.snapZone).toBeUndefined();
    expect(restored.restoreBounds).toBeUndefined();
    expect(restored.bounds).toEqual(originalBounds);
  });

  it('persists and restores open windows only when restoreSession is enabled', () => {
    const w1 = applyWindowSnap(
      makeWindow('notes', 'window-1', { x: 100, y: 80, width: 500, height: 400 }, 'Scratchpad'),
      'left',
      1280,
      800
    );
    persistWindowState(
      {
        windows: [w1],
        activeWindowId: 'window-1',
        nextId: 2,
      },
      true
    );

    /* Without restoreSession enabled, only nextId is restored */
    expect(createInitialWindowState({ restoreSession: false })).toEqual({
      windows: [],
      activeWindowId: null,
      nextId: 2,
    });

    /* With restoreSession enabled, valid windows and snap geometry are restored */
    const restored = createInitialWindowState({
      restoreSession: true,
      validAppIds: new Set(['notes', 'browser']),
      viewportWidth: 1440,
      viewportHeight: 900,
    });
    expect(restored.windows).toHaveLength(1);
    expect(restored.windows[0].snapZone).toBe('left');
    expect(restored.windows[0].bounds).toEqual(computeSnapBounds('left', 1440, 900));
    expect(restored.activeWindowId).toBe('window-1');
    expect(restored.nextId).toBe(2);
  });
});
