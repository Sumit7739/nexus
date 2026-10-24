export type CoreAppId = 'browser' | 'youtube' | 'music' | 'notes' | 'bookmarks' | 'settings' | 'widgets';
export type ShortcutAppId = `shortcut:${string}`;
export type AppId = CoreAppId | ShortcutAppId;
export type WindowStatus = 'normal' | 'minimized' | 'maximized';
export type WindowSnapSide = 'left' | 'right';
export type SnapZone = WindowSnapSide | 'top';

export interface WindowBounds {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface DesktopWindow {
  id: string;
  appId: AppId;
  title: string;
  bounds: WindowBounds;
  status: WindowStatus;
  snapZone?: WindowSnapSide;
  restoreBounds?: WindowBounds;
}

export interface WindowState {
  windows: DesktopWindow[];
  activeWindowId: string | null;
  nextId: number;
}
