import { describe, expect, it } from 'vitest';
import { getAllAppDefinitions } from '../src/apps/registry';
import { createScratchpadNote } from '../src/data/notes';
import type { SavedShortcut } from '../src/data/shortcuts';
import {
  buildSpotlightResults,
  evaluateMathExpression,
  scoreQueryMatch,
  type SpotlightContext,
} from '../src/spotlight/spotlight-engine';
import { makeWindow } from '../src/window-manager/window-store';

const TEST_WALLPAPERS = [
  { id: 'mist', name: 'Soft mist' },
  { id: 'aurora', name: 'Aurora' },
  { id: 'midnight', name: 'Midnight' },
  { id: 'glacier', name: 'Glacier' },
] as const;

function makeBaseContext(overrides: Partial<SpotlightContext> = {}): SpotlightContext {
  const shortcuts: SavedShortcut[] = [
    {
      id: 'sc-gh',
      title: 'GitHub',
      url: 'https://github.com/',
      mode: 'external',
    },
  ];
  const apps = getAllAppDefinitions(shortcuts);
  const notes = [
    createScratchpadNote({
      id: 'note-arch',
      title: 'Q4 Architecture Review',
      content: '# Q4 Architecture Review\n- [ ] Benchmark DuckDB local queries\n- [x] Audit CSP headers',
      pinned: true,
      updatedAt: 1_700_000_500_000,
    }),
    createScratchpadNote({
      id: 'note-groceries',
      title: 'Weekend Espresso Beans',
      content: 'Order Ethiopian single-origin beans and oat milk.',
      pinned: false,
      updatedAt: 1_700_000_100_000,
    }),
  ];

  return {
    query: '',
    filter: 'all',
    apps,
    windows: [],
    activeWindowId: null,
    notes,
    theme: 'light',
    wallpaper: 'mist',
    wallpapers: TEST_WALLPAPERS,
    arrangeMode: false,
    showSeconds: false,
    showMessages: true,
    restoreSession: false,
    hasPassword: true,
    versionTag: 'v1.1.0',
    now: 1_700_000_600_000,
    ...overrides,
  };
}

describe('Spotlight safe math & percentage evaluator', () => {
  it('evaluates arithmetic, parentheses, exponents, and floating-point precision cleanly', () => {
    expect(evaluateMathExpression('145 * 12')?.formattedValue).toBe('1,740');
    expect(evaluateMathExpression('(1920 - 240) / 2')?.rawValue).toBe('840');
    expect(evaluateMathExpression('2^10')?.formattedValue).toBe('1,024');
    expect(evaluateMathExpression('0.1 + 0.2')?.rawValue).toBe('0.3');
    expect(evaluateMathExpression('12,500 * 4')?.formattedValue).toBe('50,000');
  });

  it('evaluates percentage phrases ("of" and "off")', () => {
    expect(evaluateMathExpression('24% of 350')?.rawValue).toBe('84');
    expect(evaluateMathExpression('15% off 200')?.rawValue).toBe('170');
  });

  it('rejects plain standalone numbers, invalid expressions, and division by zero', () => {
    expect(evaluateMathExpression('2026')).toBeNull();
    expect(evaluateMathExpression('-42')).toBeNull();
    expect(evaluateMathExpression('100 / 0')).toBeNull();
    expect(evaluateMathExpression('scratchpad notes')).toBeNull();
  });
});

describe('Spotlight search indexing, deep-linking & ranking', () => {
  it('ranks prefix, word-boundary, and subsequence matches sensibly', () => {
    const exactScore = scoreQueryMatch('browser', 'Browser', 'Search the web');
    const prefixScore = scoreQueryMatch('brow', 'Browser', 'Search the web');
    const fuzzyScore = scoreQueryMatch('wstudio', 'Widget Studio', 'Design custom widgets');
    const missScore = scoreQueryMatch('zzzznotfound', 'Browser', 'Search the web');

    expect(exactScore).toBeGreaterThan(prefixScore);
    expect(prefixScore).toBeGreaterThan(fuzzyScore);
    expect(fuzzyScore).toBeGreaterThan(0);
    expect(missScore).toBe(0);
  });

  it('searches Scratchpad notes by both title and Markdown body content', () => {
    const results = buildSpotlightResults(makeBaseContext({ query: 'DuckDB' }));
    const noteHit = results.items.find((item) => item.id === 'note:note-arch');

    expect(noteHit).toBeDefined();
    expect(noteHit?.command).toEqual({ type: 'open-note', noteId: 'note-arch' });
    expect(noteHit?.subtitle).toContain('DuckDB');
  });

  it('surfaces instant math result at index 0 when typing an expression', () => {
    const results = buildSpotlightResults(makeBaseContext({ query: '(1440 - 280) / 2' }));
    expect(results.items[0]?.id).toBe('math:eval');
    expect(results.items[0]?.command).toEqual({
      type: 'copy-math',
      rawValue: '580',
      formattedValue: '580',
    });
  });

  it('offers URL navigation in Nexus Browser when query looks like a domain or URL', () => {
    const results = buildSpotlightResults(
      makeBaseContext({ query: 'news.ycombinator.com' })
    );
    const urlItem = results.items.find((item) => item.id === 'query:browser-url');
    expect(urlItem).toBeDefined();
    expect(urlItem?.command).toEqual({
      type: 'browser-url',
      url: 'https://news.ycombinator.com/',
      title: 'news.ycombinator.com',
    });
  });

  it('indexes open windows, tiling commands, wallpapers, and category filters accurately', () => {
    const browserWin = makeWindow(
      'browser',
      'window-1',
      { x: 100, y: 60, width: 900, height: 600 },
      'Browser'
    );
    const winResults = buildSpotlightResults(
      makeBaseContext({
        filter: 'windows',
        windows: [browserWin],
        activeWindowId: 'window-1',
      })
    );

    expect(winResults.items.some((i) => i.id === 'window:focus:window-1')).toBe(true);
    expect(winResults.items.some((i) => i.id === 'window:snap-left')).toBe(true);
    expect(winResults.items.every((i) => i.filterGroup === 'windows')).toBe(true);

    const wpResults = buildSpotlightResults(makeBaseContext({ query: 'glacier' }));
    expect(wpResults.items[0]?.command).toEqual({
      type: 'set-wallpaper',
      wallpaperId: 'glacier',
    });
  });

  it('supports yt/music search prefixes, YouTube URL handoff, and indexed media items', () => {
    const ytPrefix = buildSpotlightResults(makeBaseContext({ query: 'yt rust async runtime' }));
    expect(ytPrefix.items[0]?.id).toBe('query:youtube-prefix-search');
    expect(ytPrefix.items[0]?.command).toEqual({
      type: 'youtube-search',
      query: 'rust async runtime',
    });

    const musicPrefix = buildSpotlightResults(makeBaseContext({ query: 'music ambient piano' }));
    expect(musicPrefix.items[0]?.id).toBe('query:music-prefix-search');
    expect(musicPrefix.items[0]?.command).toEqual({
      type: 'music-search',
      query: 'ambient piano',
    });

    const ytUrl = buildSpotlightResults(
      makeBaseContext({ query: 'https://youtu.be/jfKfPfyJRdk' })
    );
    expect(ytUrl.items[0]?.id).toBe('query:youtube-url-play');
    expect(ytUrl.items[1]?.id).toBe('query:music-url-play');

    const mediaIndexed = buildSpotlightResults(
      makeBaseContext({
        query: 'KEXP',
        youtubeWatchLater: [
          {
            id: '4xDzrJKXOOY',
            title: 'Khruangbin Live on KEXP',
            channelTitle: 'KEXP',
            description: '',
            publishedAt: '',
            thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg',
            duration: '28:14',
          },
        ],
        musicCurrent: {
          id: 'jfKfPfyJRdk',
          title: 'lofi hip hop radio',
          channelTitle: 'Lofi Girl',
          description: '',
          publishedAt: '',
          thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
        },
        musicIsPlaying: true,
      })
    );
    const watchLaterHit = mediaIndexed.items.find((i) => i.id === 'media:yt:4xDzrJKXOOY');
    expect(watchLaterHit).toBeDefined();
    expect(watchLaterHit?.subtitle).toContain('Watch later');

    const transportResults = buildSpotlightResults(
      makeBaseContext({
        query: 'Pause Music',
        musicCurrent: {
          id: 'jfKfPfyJRdk',
          title: 'lofi hip hop radio',
          channelTitle: 'Lofi Girl',
          description: '',
          publishedAt: '',
          thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
        },
        musicIsPlaying: true,
      })
    );
    expect(transportResults.items[0]?.command).toEqual({ type: 'music-toggle-play' });
  });
});

