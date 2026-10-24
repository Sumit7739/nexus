import { extractHostname, normalizeHttpUrl, suggestTitleFromUrl } from './shortcuts';

export const BROWSER_PREFS_KEY = 'nexus.browser.prefs.v1';
export const BROWSER_HISTORY_KEY = 'nexus.browser.history.v1';

export type SearchEngineId =
  | 'ai'
  | 'web'
  | 'google'
  | 'duckduckgo'
  | 'brave'
  | 'bing'
  | 'wikipedia';

export interface SearchEngineDefinition {
  id: SearchEngineId;
  label: string;
  shortLabel: string;
  description: string;
  /** Native GET form action URL for external browser search engines */
  formAction?: string;
  /** Whether this engine renders directly inside the Nexus Browser tab */
  inTab: boolean;
  buildUrl: (query: string) => string;
}

export const BROWSER_SEARCH_ENGINES: SearchEngineDefinition[] = [
  {
    id: 'ai',
    label: 'Gemini + Web Search',
    shortLabel: 'Gemini AI',
    description: 'Searches the live web and generates a Gemini AI Overview with web results',
    inTab: true,
    buildUrl: query => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'web',
    label: 'Web Search Results',
    shortLabel: 'Web Search',
    description: 'Fast organic web search results directly inside Nexus Browser',
    inTab: true,
    buildUrl: query => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'google',
    label: 'Google Search',
    shortLabel: 'Google',
    description: 'Opens Google Search results in a new browser tab',
    formAction: 'https://www.google.com/search',
    inTab: false,
    buildUrl: query => `https://www.google.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'duckduckgo',
    label: 'DuckDuckGo',
    shortLabel: 'DuckDuckGo',
    description: 'Opens private DuckDuckGo search in a new browser tab',
    formAction: 'https://duckduckgo.com/',
    inTab: false,
    buildUrl: query => `https://duckduckgo.com/?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'brave',
    label: 'Brave Search',
    shortLabel: 'Brave',
    description: 'Opens independent Brave Search in a new browser tab',
    formAction: 'https://search.brave.com/search',
    inTab: false,
    buildUrl: query => `https://search.brave.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'bing',
    label: 'Bing Web',
    shortLabel: 'Bing',
    description: 'Loads Bing search inside the tab or opens in a new browser tab',
    formAction: 'https://www.bing.com/search',
    inTab: true,
    buildUrl: query => `https://www.bing.com/search?q=${encodeURIComponent(query)}`,
  },
  {
    id: 'wikipedia',
    label: 'Wikipedia',
    shortLabel: 'Wikipedia',
    description: 'Searches Wikipedia articles directly inside the browser tab',
    inTab: true,
    buildUrl: query => `https://en.wikipedia.org/w/index.php?search=${encodeURIComponent(query)}`,
  },
];

export function getSearchEngine(id: SearchEngineId): SearchEngineDefinition {
  return BROWSER_SEARCH_ENGINES.find(engine => engine.id === id) ?? BROWSER_SEARCH_ENGINES[0];
}

export type OmniboxIntent =
  | { kind: 'url'; url: string }
  | { kind: 'search'; query: string };

const LOCAL_OR_IP_PATTERN =
  /^(localhost|127\.\d{1,3}\.\d{1,3}\.\d{1,3}|0\.0\.0\.0|192\.168\.\d{1,3}\.\d{1,3}|10\.\d{1,3}\.\d{1,3}\.\d{1,3})(:\d+)?(\/.*)?$/i;

const DOMAIN_LIKE_PATTERN =
  /^[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?(\.[a-z0-9]([a-z0-9-]{0,61}[a-z0-9])?)*\.[a-z]{2,24}(:\d+)?([/?#].*)?$/i;

/**
 * Classifies user input from the browser omnibox into either a navigable URL or a web search query.
 */
export function classifyOmniboxInput(raw: string): OmniboxIntent | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;

  /* Leading '?' forces a web search (standard desktop browser convention) */
  if (trimmed.startsWith('?')) {
    const forcedQuery = trimmed.slice(1).trim();
    return forcedQuery ? { kind: 'search', query: forcedQuery } : null;
  }

  /* Explicit http:// or https:// protocol */
  if (/^https?:\/\//i.test(trimmed)) {
    const normalized = normalizeHttpUrl(trimmed);
    return normalized ? { kind: 'url', url: normalized } : { kind: 'search', query: trimmed };
  }

  /* Any whitespace means a natural-language search query */
  if (/\s/.test(trimmed)) {
    return { kind: 'search', query: trimmed };
  }

  /* Localhost or LAN IP address */
  if (LOCAL_OR_IP_PATTERN.test(trimmed)) {
    const normalized = normalizeHttpUrl(`http://${trimmed}`);
    if (normalized) return { kind: 'url', url: normalized };
  }

  /* Bare domain or domain + path (e.g., github.com, en.wikipedia.org/wiki/Bauhaus) */
  if (DOMAIN_LIKE_PATTERN.test(trimmed)) {
    const normalized = normalizeHttpUrl(trimmed);
    if (normalized) return { kind: 'url', url: normalized };
  }

  return { kind: 'search', query: trimmed };
}

/**
 * Domains that strictly send X-Frame-Options: DENY / SAMEORIGIN or CSP frame-ancestors 'none'.
 * Detecting these upfront lets the browser present a clean New Tab launchpad instead of a broken frame.
 */
const FRAME_RESTRICTED_DOMAINS = [
  'github.com',
  'gist.github.com',
  'google.com',
  'mail.google.com',
  'drive.google.com',
  'docs.google.com',
  'calendar.google.com',
  'youtube.com',
  'music.youtube.com',
  'x.com',
  'twitter.com',
  'reddit.com',
  'news.ycombinator.com',
  'linkedin.com',
  'facebook.com',
  'instagram.com',
  'figma.com',
  'linear.app',
  'notion.so',
  'chatgpt.com',
  'claude.ai',
  'stackoverflow.com',
  'npmjs.com',
  'medium.com',
  'nytimes.com',
  'amazon.com',
  'netflix.com',
  'spotify.com',
  'open.spotify.com',
  'discord.com',
  'duckduckgo.com',
  'search.brave.com',
];

export function isKnownFrameRestricted(url: string): boolean {
  const host = extractHostname(url);
  if (!host) return false;
  return FRAME_RESTRICTED_DOMAINS.some(
    restricted => host === restricted || host.endsWith(`.${restricted}`)
  );
}

export function formatTabTitleForUrl(url: string): string {
  return suggestTitleFromUrl(url) || extractHostname(url) || url;
}

export function formatUrlBreadcrumb(rawUrl: string): string {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.replace(/^www\./i, '');
    const segments = parsed.pathname
      .split('/')
      .filter(Boolean)
      .slice(0, 2)
      .map(seg => decodeURIComponent(seg));
    return segments.length > 0 ? `${host} › ${segments.join(' › ')}` : host;
  } catch {
    return rawUrl;
  }
}

export interface BrowserPrefs {
  searchEngine: SearchEngineId;
  showBookmarksBar: boolean;
  preferExternalTabs: boolean;
}

const DEFAULT_BROWSER_PREFS: BrowserPrefs = {
  searchEngine: 'ai',
  showBookmarksBar: true,
  preferExternalTabs: false,
};

export function readBrowserPrefs(): BrowserPrefs {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_PREFS_KEY) || '{}') as Partial<BrowserPrefs>;
    const validEngine = BROWSER_SEARCH_ENGINES.some(e => e.id === parsed.searchEngine)
      ? (parsed.searchEngine as SearchEngineId)
      : 'ai';
    return {
      searchEngine: validEngine,
      showBookmarksBar: parsed.showBookmarksBar !== false,
      preferExternalTabs: parsed.preferExternalTabs === true,
    };
  } catch {
    return DEFAULT_BROWSER_PREFS;
  }
}

export function saveBrowserPrefs(prefs: BrowserPrefs): void {
  try {
    localStorage.setItem(BROWSER_PREFS_KEY, JSON.stringify(prefs));
  } catch {
    /* Ignore storage errors */
  }
}

export interface BrowserHistoryItem {
  id: string;
  kind: 'url' | 'search';
  title: string;
  value: string;
  engine?: SearchEngineId;
  visitedAt: number;
}

export function readBrowserHistory(): BrowserHistoryItem[] {
  try {
    const parsed = JSON.parse(localStorage.getItem(BROWSER_HISTORY_KEY) || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((item): item is BrowserHistoryItem => {
        if (!item || typeof item !== 'object') return false;
        const candidate = item as Partial<BrowserHistoryItem>;
        return (
          typeof candidate.id === 'string' &&
          (candidate.kind === 'url' || candidate.kind === 'search') &&
          typeof candidate.title === 'string' &&
          typeof candidate.value === 'string' &&
          typeof candidate.visitedAt === 'number'
        );
      })
      .slice(0, 16);
  } catch {
    return [];
  }
}

export function saveBrowserHistory(items: BrowserHistoryItem[]): void {
  try {
    localStorage.setItem(BROWSER_HISTORY_KEY, JSON.stringify(items.slice(0, 16)));
  } catch {
    /* Ignore storage errors */
  }
}

export interface AiSearchSource {
  title: string;
  url: string;
  domain: string;
  snippet?: string;
}

export interface AiSearchResult {
  query: string;
  answer: string;
  sources: AiSearchSource[];
  relatedQueries: string[];
  searchProvider?: string;
  aiNotice?: string;
}

export const BROWSER_NAVIGATE_EVENT = 'nexus:browser-navigate';

export type BrowserNavigationRequest =
  | { kind: 'start' }
  | { kind: 'url'; url: string; title?: string }
  | { kind: 'search'; query: string; engine: SearchEngineId };

const pendingBrowserNavigations: BrowserNavigationRequest[] = [];

export function enqueueBrowserNavigation(request: BrowserNavigationRequest): void {
  pendingBrowserNavigations.push(request);
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(BROWSER_NAVIGATE_EVENT));
  }
}

export function consumePendingBrowserNavigations(): BrowserNavigationRequest[] {
  if (pendingBrowserNavigations.length === 0) return [];
  return pendingBrowserNavigations.splice(0, pendingBrowserNavigations.length);
}

