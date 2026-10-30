import { describe, expect, it } from 'vitest';
import {
  clampMenuPosition,
  computeLauncherMenuPlacement,
  tileTopTwoWindows,
} from '../src/desktop/menu-layout';
import { makeWindow } from '../src/window-manager/window-store';
import type { WindowState } from '../src/window-manager/types';

describe('desktop & launcher menu layout helpers', () => {
  it('clamps right-click menu coordinates inside viewport edges', () => {
    const nearBottomRight = clampMenuPosition(1210, 740, 244, 380, 1280, 800, 12);
    expect(nearBottomRight).toEqual({
      x: 1280 - 244 - 12,
      y: 800 - 380 - 12,
    });

    const nearTopLeft = clampMenuPosition(2, -10, 244, 380, 1280, 800, 12);
    expect(nearTopLeft).toEqual({ x: 12, y: 12 });
  });

  it('computes column-aware alignment and row-aware flip in launcher grid view', () => {
    // 8 items in a 3-column grid => 3 rows (0..2, 3..5, 6..7)
    expect(computeLauncherMenuPlacement(0, 8, 'grid', 3)).toEqual({
      align: 'left',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(1, 8, 'grid', 3)).toEqual({
      align: 'center',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(2, 8, 'grid', 3)).toEqual({
      align: 'right',
      flipUp: false,
    });
    // Bottom row flips upward
    expect(computeLauncherMenuPlacement(6, 8, 'grid', 3)).toEqual({
      align: 'left',
      flipUp: true,
    });
    expect(computeLauncherMenuPlacement(7, 8, 'grid', 3)).toEqual({
      align: 'center',
      flipUp: true,
    });
    // Single-row search result never flips upward into top scroll clipping
    expect(computeLauncherMenuPlacement(0, 1, 'grid', 3)).toEqual({
      align: 'left',
      flipUp: false,
    });

    // Default 4-column launcher grid (9 items => rows 0..3, 4..7, 8)
    expect(computeLauncherMenuPlacement(0, 9, 'grid')).toEqual({
      align: 'left',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(1, 9, 'grid')).toEqual({
      align: 'center',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(2, 9, 'grid')).toEqual({
      align: 'center',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(3, 9, 'grid')).toEqual({
      align: 'right',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(8, 9, 'grid')).toEqual({
      align: 'left',
      flipUp: true,
    });
  });

  it('computes safe flip behavior in launcher list view', () => {
    expect(computeLauncherMenuPlacement(0, 1, 'list')).toEqual({
      align: 'right',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(1, 6, 'list')).toEqual({
      align: 'right',
      flipUp: false,
    });
    expect(computeLauncherMenuPlacement(4, 6, 'list')).toEqual({
      align: 'right',
      flipUp: true,
    });
    expect(computeLauncherMenuPlacement(5, 6, 'list')).toEqual({
      align: 'right',
      flipUp: true,
    });
  });

  it('tiles top two visible windows side by side while preserving left-to-right order', () => {
    const browserWin = makeWindow(
      'browser',
      'window-1',
      { x: 80, y: 60, width: 700, height: 500 },
      'Browser'
    );
    const notesWin = makeWindow(
      'notes',
      'window-2',
      { x: 560, y: 80, width: 520, height: 460 },
      'Scratchpad'
    );
    const minimizedSettings = {
      ...makeWindow(
        'settings',
        'window-3',
        { x: 200, y: 120, width: 640, height: 480 },
        'Settings'
      ),
      status: 'minimized' as const,
    };

    const initial: WindowState = {
      windows: [browserWin, notesWin, minimizedSettings],
      activeWindowId: 'window-2',
      nextId: 4,
    };

    const tiled = tileTopTwoWindows(initial, 1440, 900);
    const tiledBrowser = tiled.windows.find((w) => w.id === 'window-1')!;
    const tiledNotes = tiled.windows.find((w) => w.id === 'window-2')!;
    const untouchedMin = tiled.windows.find((w) => w.id === 'window-3')!;

    expect(tiledBrowser.snapZone).toBe('left');
    expect(tiledNotes.snapZone).toBe('right');
    expect(tiledBrowser.bounds.x).toBeLessThan(tiledNotes.bounds.x);
    expect(untouchedMin.status).toBe('minimized');
    expect(tiled.activeWindowId).toBe('window-2');
  });
});
