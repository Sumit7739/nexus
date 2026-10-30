import { applyWindowSnap } from '../window-manager/window-store';
import type { WindowState } from '../window-manager/types';

export interface MenuCoordinates {
  x: number;
  y: number;
}

export interface LauncherMenuPlacement {
  align: 'left' | 'center' | 'right';
  flipUp: boolean;
}

/**
 * Clamps a floating context menu's top-left coordinates so that the menu
 * never overflows any edge of the viewport.
 */
export function clampMenuPosition(
  x: number,
  y: number,
  menuWidth: number,
  menuHeight: number,
  viewportWidth: number,
  viewportHeight: number,
  margin = 12
): MenuCoordinates {
  const safeMargin = Math.max(4, margin);
  const maxX = Math.max(safeMargin, viewportWidth - Math.max(0, menuWidth) - safeMargin);
  const maxY = Math.max(safeMargin, viewportHeight - Math.max(0, menuHeight) - safeMargin);

  return {
    x: Math.round(Math.min(Math.max(safeMargin, x), maxX)),
    y: Math.round(Math.min(Math.max(safeMargin, y), maxY)),
  };
}

/**
 * Computes horizontal alignment and vertical flip direction for an App Launcher
 * item's action menu so it never clips against `.launcher-list` boundaries or
 * collides with neighboring grid columns.
 */
export function computeLauncherMenuPlacement(
  index: number,
  totalItems: number,
  viewMode: 'list' | 'grid',
  gridColumns = 4
): LauncherMenuPlacement {
  if (viewMode === 'grid') {
    const cols = Math.max(1, gridColumns);
    const colIdx = index % cols;
    const align: LauncherMenuPlacement['align'] =
      colIdx === 0 ? 'left' : colIdx === cols - 1 ? 'right' : 'center';

    const totalRows = Math.ceil(Math.max(1, totalItems) / cols);
    const rowIdx = Math.floor(index / cols);
    const flipUp = rowIdx > 0 && rowIdx >= totalRows - 1;

    return { align, flipUp };
  }

  const flipUp = index >= 2 && index >= totalItems - 2;
  return { align: 'right', flipUp };
}

/**
 * Tiles the two primary visible windows into a 50/50 left-right split while
 * preserving their natural horizontal left-to-right screen order.
 */
export function tileTopTwoWindows(
  state: WindowState,
  viewportWidth: number,
  viewportHeight: number
): WindowState {
  const visible = state.windows.filter((w) => w.status !== 'minimized');
  if (visible.length < 2) return state;

  const active =
    visible.find((w) => w.id === state.activeWindowId) ?? visible[visible.length - 1];
  const partner = [...visible].reverse().find((w) => w.id !== active.id);
  if (!partner) return state;

  const activeCenter = active.bounds.x + active.bounds.width / 2;
  const partnerCenter = partner.bounds.x + partner.bounds.width / 2;

  const [leftWin, rightWin] =
    activeCenter <= partnerCenter ? [active, partner] : [partner, active];

  return {
    ...state,
    activeWindowId: active.id,
    windows: state.windows.map((win) => {
      if (win.id === leftWin.id) {
        return applyWindowSnap(win, 'left', viewportWidth, viewportHeight);
      }
      if (win.id === rightWin.id) {
        return applyWindowSnap(win, 'right', viewportWidth, viewportHeight);
      }
      return win;
    }),
  };
}
