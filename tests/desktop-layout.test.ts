import { describe, expect, it } from 'vitest';
import { positionForIndex, snapDesktopPosition } from '../src/desktop/layout';

describe('desktop layout', () => {
  it('places default objects on predictable grid cells', () => {
    expect(positionForIndex(0)).toEqual({ x: 24, y: 48 });
    expect(positionForIndex(6)).toEqual({ x: 24, y: 152 });
  });

  it('snaps dragged positions to the nearest grid cell', () => {
    expect(snapDesktopPosition({ x: 78, y: 110 }, 1200, 800)).toEqual({ x: 128, y: 152 });
  });

  it('keeps snapped objects inside the viewport', () => {
    expect(snapDesktopPosition({ x: 9999, y: 9999 }, 500, 400)).toEqual({ x: 400, y: 178 });
  });
});
