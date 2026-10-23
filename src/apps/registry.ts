import { Bookmark, Globe2, Settings2, StickyNote, Youtube } from 'lucide-react';
import type { AppDefinition } from './app-types';

export const APP_REGISTRY: AppDefinition[] = [
  { id: 'browser', name: 'Web', description: 'Open a website in a workspace window', icon: Globe2, defaultBounds: { x: 120, y: 70, width: 920, height: 620 }, category: 'web' },
  { id: 'youtube', name: 'YouTube', description: 'Play a video in a floating window', icon: Youtube, defaultBounds: { x: 150, y: 82, width: 900, height: 590 }, category: 'web' },
  { id: 'notes', name: 'Scratchpad', description: 'A little space for thoughts', icon: StickyNote, defaultBounds: { x: 210, y: 110, width: 580, height: 500 }, category: 'utility' },
  { id: 'bookmarks', name: 'Saved links', description: 'Your frequently used destinations', icon: Bookmark, defaultBounds: { x: 170, y: 90, width: 700, height: 560 }, category: 'utility' },
  { id: 'settings', name: 'Settings', description: 'Personalize your workspace', icon: Settings2, defaultBounds: { x: 170, y: 80, width: 760, height: 610 }, category: 'system' },
];

export function getAppDefinition(id: string) {
  return APP_REGISTRY.find((app) => app.id === id);
}
