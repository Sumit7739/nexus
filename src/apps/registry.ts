import { Bookmark, Code2, Globe2, Headphones, Settings2, StickyNote, Youtube } from 'lucide-react';
import type { AppDefinition } from './app-types';
import {
  extractHostname,
  fromShortcutAppId,
  isYouTubeUrl,
  toShortcutAppId,
  type SavedShortcut,
} from '../data/shortcuts';

export const APP_REGISTRY: AppDefinition[] = [
  { id: 'browser', name: 'Browser', description: 'Search the web & browse in tabs', icon: Globe2, defaultBounds: { x: 105, y: 54, width: 980, height: 650 }, category: 'web' },
  { id: 'youtube', name: 'YouTube', description: 'Search, play & remember videos', icon: Youtube, defaultBounds: { x: 120, y: 62, width: 1040, height: 680 }, category: 'web' },
  { id: 'music', name: 'Music', description: 'Audio-first music from YouTube', icon: Headphones, defaultBounds: { x: 160, y: 82, width: 920, height: 620 }, category: 'web' },
  { id: 'notes', name: 'Scratchpad', description: 'Notes, checklists & Markdown', icon: StickyNote, defaultBounds: { x: 170, y: 82, width: 820, height: 560 }, category: 'utility' },
  { id: 'bookmarks', name: 'Saved links', description: 'Web shortcuts & pinned destinations', icon: Bookmark, defaultBounds: { x: 155, y: 75, width: 780, height: 610 }, category: 'utility' },
  { id: 'settings', name: 'Settings', description: 'Personalize your workspace', icon: Settings2, defaultBounds: { x: 170, y: 80, width: 760, height: 610 }, category: 'system' },
  { id: 'widgets', name: 'Widget Studio', description: 'Design, edit, and manage widgets', icon: Code2, defaultBounds: { x: 90, y: 50, width: 1080, height: 720 }, category: 'system' },
];

export function shortcutToAppDefinition(shortcut: SavedShortcut): AppDefinition {
  const host = extractHostname(shortcut.url) || shortcut.url;
  const modeLabel = shortcut.mode === 'embed' ? 'Workspace window' : 'Browser tab';
  return {
    id: toShortcutAppId(shortcut.id),
    name: shortcut.title,
    description: `${host} · ${modeLabel}`,
    icon: Globe2,
    defaultBounds:
      shortcut.mode === 'embed'
        ? { x: 130, y: 66, width: 940, height: 630 }
        : { x: 240, y: 130, width: 520, height: 360 },
    category: 'shortcut',
    shortcut,
  };
}

export function getAllAppDefinitions(shortcuts: SavedShortcut[] = []): AppDefinition[] {
  return [...APP_REGISTRY, ...shortcuts.filter(shortcut => !isYouTubeUrl(shortcut.url)).map(shortcutToAppDefinition)];
}

export function getAppDefinition(id: string, shortcuts: SavedShortcut[] = []): AppDefinition | undefined {
  const core = APP_REGISTRY.find((app) => app.id === id);
  if (core) return core;
  const shortcutId = fromShortcutAppId(id);
  if (!shortcutId) return undefined;
  const found = shortcuts.find((item) => item.id === shortcutId);
  if (found && isYouTubeUrl(found.url)) return APP_REGISTRY.find(app => app.id === 'youtube');
  return found ? shortcutToAppDefinition(found) : undefined;
}
