export const SAVED_SHORTCUTS_KEY = 'nexus.saved-apps.v1';

export type ShortcutLaunchMode = 'embed' | 'external';
export type ShortcutAppId = `shortcut:${string}`;

export interface SavedShortcut {
  id: string;
  title: string;
  url: string;
  mode: ShortcutLaunchMode;
}

export const DEFAULT_SHORTCUTS: SavedShortcut[] = [
  { id: 'wikipedia', title: 'Wikipedia', url: 'https://en.wikipedia.org', mode: 'embed' },
  { id: 'github', title: 'GitHub', url: 'https://github.com', mode: 'external' },
  { id: 'mdn', title: 'MDN Web Docs', url: 'https://developer.mozilla.org', mode: 'external' },
  { id: 'hackernews', title: 'Hacker News', url: 'https://news.ycombinator.com', mode: 'external' },
];

export function toShortcutAppId(shortcutId: string): ShortcutAppId {
  return `shortcut:${shortcutId}`;
}

export function isShortcutAppId(appId: string): appId is ShortcutAppId {
  return appId.startsWith('shortcut:') && appId.length > 'shortcut:'.length;
}

export function fromShortcutAppId(appId: string): string | null {
  return isShortcutAppId(appId) ? appId.slice('shortcut:'.length) : null;
}

export function normalizeHttpUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(normalized);
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') return null;
    if (!parsed.hostname || (!parsed.hostname.includes('.') && parsed.hostname !== 'localhost')) {
      return null;
    }

    return parsed.href;
  } catch {
    return null;
  }
}

export function isYouTubeUrl(value: string): boolean {
  const normalized = normalizeHttpUrl(value);
  if (!normalized) return false;
  try {
    const hostname = new URL(normalized).hostname.toLowerCase().replace(/^www\./, '');
    return hostname === 'youtube.com' || hostname.endsWith('.youtube.com') || hostname === 'youtu.be';
  } catch {
    return false;
  }
}

export function extractHostname(url: string): string {
  const normalized = normalizeHttpUrl(url);
  if (!normalized) return '';
  try {
    return new URL(normalized).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return '';
  }
}

const KNOWN_BRAND_TITLES: Record<string, string> = {
  'github.com': 'GitHub',
  'gist.github.com': 'GitHub Gist',
  'youtube.com': 'YouTube',
  'music.youtube.com': 'YouTube Music',
  'reddit.com': 'Reddit',
  'wikipedia.org': 'Wikipedia',
  'en.wikipedia.org': 'Wikipedia',
  'developer.mozilla.org': 'MDN Web Docs',
  'news.ycombinator.com': 'Hacker News',
  'figma.com': 'Figma',
  'linear.app': 'Linear',
  'notion.so': 'Notion',
  'vercel.com': 'Vercel',
  'chatgpt.com': 'ChatGPT',
  'claude.ai': 'Claude',
  'x.com': 'X',
  'twitter.com': 'X',
  'linkedin.com': 'LinkedIn',
  'mail.google.com': 'Gmail',
  'calendar.google.com': 'Google Calendar',
  'drive.google.com': 'Google Drive',
  'docs.google.com': 'Google Docs',
  'open.spotify.com': 'Spotify',
  'spotify.com': 'Spotify',
  'stackoverflow.com': 'Stack Overflow',
  'npmjs.com': 'npm',
};

export function suggestTitleFromUrl(rawUrl: string): string {
  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) return '';
  try {
    const parsed = new URL(normalized);
    const fullHost = parsed.hostname.replace(/^www\./i, '').toLowerCase();
    if (KNOWN_BRAND_TITLES[fullHost]) return KNOWN_BRAND_TITLES[fullHost];

    const parts = fullHost.split('.');
    const core = parts.length >= 2 ? parts[parts.length - 2] : parts[0];
    if (!core) return '';
    return core
      .split(/[-_]+/)
      .filter(Boolean)
      .map(word => word.charAt(0).toUpperCase() + word.slice(1))
      .join(' ');
  } catch {
    return '';
  }
}

function isLocalOrIpHost(hostname: string): boolean {
  return (
    hostname === 'localhost' ||
    hostname.endsWith('.local') ||
    /^\d{1,3}(\.\d{1,3}){3}$/.test(hostname) ||
    hostname.includes(':')
  );
}

/**
 * Ordered list of favicon URLs to attempt for a given website URL.
 * Uses high-DPI CDN favicon resolvers first, then falls back to direct /favicon.ico.
 */
export function getFaviconCandidates(rawUrl: string): string[] {
  const normalized = normalizeHttpUrl(rawUrl);
  if (!normalized) return [];
  try {
    const parsed = new URL(normalized);
    const host = parsed.hostname.toLowerCase();
    if (!host) return [];
    if (isLocalOrIpHost(host)) {
      return [`${parsed.origin}/favicon.ico`];
    }
    return [
      `https://www.google.com/s2/favicons?domain=${encodeURIComponent(host)}&sz=128`,
      `https://icons.duckduckgo.com/ip3/${encodeURIComponent(host)}.ico`,
      `${parsed.origin}/favicon.ico`,
    ];
  } catch {
    return [];
  }
}

export function getMonogramToneIndex(seed: string): number {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) >>> 0;
  }
  return hash % 6;
}

export function readShortcuts(): SavedShortcut[] {
  try {
    const raw = localStorage.getItem(SAVED_SHORTCUTS_KEY);
    if (!raw) return DEFAULT_SHORTCUTS;
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return DEFAULT_SHORTCUTS;
    const valid = parsed.filter((item): item is SavedShortcut => {
      if (!item || typeof item !== 'object') return false;
      const candidate = item as Partial<SavedShortcut>;
      return (
        typeof candidate.id === 'string' &&
        candidate.id.trim().length > 0 &&
        typeof candidate.title === 'string' &&
        candidate.title.trim().length > 0 &&
        typeof candidate.url === 'string' &&
        normalizeHttpUrl(candidate.url) !== null &&
        (candidate.mode === 'embed' || candidate.mode === 'external')
      );
    });
    return valid.map(item => ({
      id: item.id,
      title: item.title.trim(),
      url: normalizeHttpUrl(item.url) ?? item.url,
      mode: item.mode,
    }));
  } catch {
    return DEFAULT_SHORTCUTS;
  }
}

export function saveShortcuts(shortcuts: SavedShortcut[]): void {
  try {
    localStorage.setItem(SAVED_SHORTCUTS_KEY, JSON.stringify(shortcuts));
    window.dispatchEvent(new Event('nexus:saved-links-updated'));
  } catch {
    /* Ignore storage quota or private mode restrictions */
  }
}
