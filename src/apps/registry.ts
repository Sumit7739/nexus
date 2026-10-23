import { Bookmark, Globe2, Settings2, StickyNote, Youtube } from 'lucide-react';
import type { AppDefinition } from './app-types';

export const APP_REGISTRY: AppDefinition[] = [
  { id: 'browser', name: 'Web', description: 'Open a website in a workspace window', icon: Globe2, defaultBounds: { x: 170, y: 92, width: 760, height: 520 }, category: 'web' },
  { id: 'youtube', name: 'YouTube', description: 'Play a video in a floating window', icon: Youtube, defaultBounds: { x: 250, y: 112, width: 720, height: 470 }, category: 'web' },
  { id: 'notes', name: 'Scratchpad', description: 'A little space for thoughts', icon: StickyNote, defaultBounds: { x: 280, y: 130, width: 440, height: 400 }, category: 'utility' },
  { id: 'bookmarks', name: 'Saved links', description: 'Your frequently used destinations', icon: Bookmark, defaultBounds: { x: 220, y: 100, width: 520, height: 440 }, category: 'utility' },
  { id: 'settings', name: 'Settings', description: 'Personalize your workspace', icon: Settings2, defaultBounds: { x: 300, y: 140, width: 480, height: 390 }, category: 'system' },
];

export function getAppDefinition(id: string) {
  return APP_REGISTRY.find((app) => app.id === id);
}
