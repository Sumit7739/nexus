import { describe, expect, it } from 'vitest';
import {
  extractHostname,
  fromShortcutAppId,
  getFaviconCandidates,
  isShortcutAppId,
  normalizeHttpUrl,
  suggestTitleFromUrl,
  toShortcutAppId,
  type SavedShortcut,
} from '../src/data/shortcuts';
import { getAllAppDefinitions, getAppDefinition } from '../src/apps/registry';

describe('shortcuts helpers & app registry integration', () => {
  it('normalizes bare domains and rejects non-http protocols', () => {
    expect(normalizeHttpUrl('linear.app')).toBe('https://linear.app/');
    expect(normalizeHttpUrl('https://github.com/features')).toBe('https://github.com/features');
    expect(normalizeHttpUrl('http://localhost:3000')).toBe('http://localhost:3000/');
    expect(normalizeHttpUrl('javascript:alert(1)')).toBeNull();
    expect(normalizeHttpUrl('')).toBeNull();
  });

  it('extracts hostnames and suggests clean brand titles from URLs', () => {
    expect(extractHostname('https://www.github.com/torvalds')).toBe('github.com');
    expect(suggestTitleFromUrl('github.com')).toBe('GitHub');
    expect(suggestTitleFromUrl('https://developer.mozilla.org/en-US/')).toBe('MDN Web Docs');
    expect(suggestTitleFromUrl('https://my-design-studio.io')).toBe('My Design Studio');
  });

  it('returns multi-source favicon candidates for public domains and direct ico for localhost', () => {
    const publicCandidates = getFaviconCandidates('https://figma.com');
    expect(publicCandidates).toHaveLength(3);
    expect(publicCandidates[0]).toContain('google.com/s2/favicons');
    expect(publicCandidates[1]).toContain('icons.duckduckgo.com/ip3/figma.com.ico');
    expect(publicCandidates[2]).toBe('https://figma.com/favicon.ico');

    expect(getFaviconCandidates('http://localhost:5173')).toEqual(['http://localhost:5173/favicon.ico']);
  });

  it('round-trips shortcut AppIds and maps shortcuts into first-class AppDefinitions', () => {
    const appId = toShortcutAppId('figma-1');
    expect(isShortcutAppId(appId)).toBe(true);
    expect(isShortcutAppId('bookmarks')).toBe(false);
    expect(fromShortcutAppId(appId)).toBe('figma-1');

    const shortcuts: SavedShortcut[] = [
      { id: 'figma-1', title: 'Figma', url: 'https://figma.com', mode: 'external' },
    ];
    const resolved = getAppDefinition(appId, shortcuts);
    expect(resolved?.name).toBe('Figma');
    expect(resolved?.category).toBe('shortcut');
    expect(resolved?.shortcut?.url).toBe('https://figma.com');

    const all = getAllAppDefinitions(shortcuts);
    expect(all.some(app => app.id === 'bookmarks')).toBe(true);
    expect(all.some(app => app.id === appId)).toBe(true);
  });
});
