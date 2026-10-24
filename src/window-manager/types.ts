export type AppId = 'browser' | 'youtube' | 'notes' | 'bookmarks' | 'settings' | 'widgets';
export type WindowStatus = 'normal' | 'minimized' | 'maximized';

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
  restoreBounds?: WindowBounds;
}

export interface WindowState {
  windows: DesktopWindow[];
  activeWindowId: string | null;
  nextId: number;
}
