export const DESKTOP_GRID = {
  originX: 24,
  originY: 48,
  columnWidth: 104,
  rowHeight: 104,
  objectWidth: 92,
  objectHeight: 82,
  edgePadding: 8,
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
