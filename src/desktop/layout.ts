import type { WindowBounds } from '../window-manager/types';

export const DESKTOP_GRID = {
  originX: 24,
  originY: 48,
  columnWidth: 104,
  rowHeight: 104,
  objectWidth: 92,
  objectHeight: 82,
  edgePadding: 8,
} as const;

export const WIDGET_LAYOUT = {
  snapStep: 12,
  minWidth: 160,
  minHeight: 100,
  edgePadding: 14,
  bottomReserve: 96,
} as const;

export interface DesktopPosition {
  x: number;
  y: number;
}

export function positionForIndex(index: number): DesktopPosition {
  return {
    x: DESKTOP_GRID.originX + (index % 6) * DESKTOP_GRID.columnWidth,
    y: DESKTOP_GRID.originY + Math.floor(index / 6) * DESKTOP_GRID.rowHeight,
  };
}

export function snapDesktopPosition(position: DesktopPosition, viewportWidth: number, viewportHeight: number): DesktopPosition {
  const maxX = Math.max(DESKTOP_GRID.edgePadding, viewportWidth - DESKTOP_GRID.objectWidth - DESKTOP_GRID.edgePadding);
  const maxY = Math.max(DESKTOP_GRID.edgePadding, viewportHeight - DESKTOP_GRID.objectHeight - 140);
  const column = Math.round((position.x - DESKTOP_GRID.originX) / DESKTOP_GRID.columnWidth);
  const row = Math.round((position.y - DESKTOP_GRID.originY) / DESKTOP_GRID.rowHeight);
  return {
    x: Math.min(maxX, Math.max(DESKTOP_GRID.edgePadding, DESKTOP_GRID.originX + column * DESKTOP_GRID.columnWidth)),
    y: Math.min(maxY, Math.max(DESKTOP_GRID.edgePadding, DESKTOP_GRID.originY + row * DESKTOP_GRID.rowHeight)),
  };
}

export function clampDesktopPosition(position: DesktopPosition, viewportWidth: number, viewportHeight: number): DesktopPosition {
  const maxX = Math.max(DESKTOP_GRID.edgePadding, viewportWidth - DESKTOP_GRID.objectWidth - DESKTOP_GRID.edgePadding);
  const maxY = Math.max(DESKTOP_GRID.edgePadding, viewportHeight - DESKTOP_GRID.objectHeight - 140);
  return {
    x: Math.min(maxX, Math.max(DESKTOP_GRID.edgePadding, Math.round(position.x))),
    y: Math.min(maxY, Math.max(DESKTOP_GRID.edgePadding, Math.round(position.y))),
  };
}

export function clampWidgetBounds(
  bounds: WindowBounds,
  viewportWidth: number,
  viewportHeight: number,
  snap = false
): WindowBounds {
  const maxWidth = Math.max(WIDGET_LAYOUT.minWidth, viewportWidth - WIDGET_LAYOUT.edgePadding * 2);
  const maxHeight = Math.max(
    WIDGET_LAYOUT.minHeight,
    viewportHeight - WIDGET_LAYOUT.bottomReserve - WIDGET_LAYOUT.edgePadding
  );

  const rawWidth = Math.min(maxWidth, Math.max(WIDGET_LAYOUT.minWidth, bounds.width));
  const rawHeight = Math.min(maxHeight, Math.max(WIDGET_LAYOUT.minHeight, bounds.height));

  const step = WIDGET_LAYOUT.snapStep;
  const width = snap ? Math.min(maxWidth, Math.max(WIDGET_LAYOUT.minWidth, Math.round(rawWidth / step) * step)) : Math.round(rawWidth);
  const height = snap ? Math.min(maxHeight, Math.max(WIDGET_LAYOUT.minHeight, Math.round(rawHeight / step) * step)) : Math.round(rawHeight);

  const maxX = Math.max(WIDGET_LAYOUT.edgePadding, viewportWidth - width - WIDGET_LAYOUT.edgePadding);
  const maxY = Math.max(WIDGET_LAYOUT.edgePadding, viewportHeight - height - WIDGET_LAYOUT.bottomReserve);

  const rawX = snap ? Math.round(bounds.x / step) * step : Math.round(bounds.x);
  const rawY = snap ? Math.round(bounds.y / step) * step : Math.round(bounds.y);

  return {
    x: Math.min(maxX, Math.max(WIDGET_LAYOUT.edgePadding, rawX)),
    y: Math.min(maxY, Math.max(WIDGET_LAYOUT.edgePadding, rawY)),
    width,
    height,
  };
}

