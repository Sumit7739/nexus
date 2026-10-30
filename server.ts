import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import express, { type Request, type Response } from 'express';
import { GoogleGenAI, Type } from '@google/genai';

interface SearchTurn {
  query: string;
  answer: string;
}

interface SearchRequestBody {
  query?: unknown;
  mode?: unknown;
  history?: unknown;
}

interface WebSearchSource {
  title: string;
  url: string;
  domain: string;
  snippet: string;
}

interface YouTubeSearchItem {
  id: string;
  title: string;
  channelTitle: string;
  description: string;
  publishedAt: string;
  thumbnail: string;
  duration?: string;
  durationSeconds?: number;
  viewCount?: string;
}

const PORT = Number(process.env.PORT ?? 3000);
const __dirname = path.dirname(fileURLToPath(import.meta.url));

function parseIsoDurationToSeconds(iso: string): number {
  const match = iso.match(/^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/i);
  if (!match) return 0;
  const hours = Number(match[1] ?? 0);
  const minutes = Number(match[2] ?? 0);
  const seconds = Number(match[3] ?? 0);
  return hours * 3600 + minutes * 60 + seconds;
}

function formatDurationClock(totalSeconds: number): string {
  if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) return '';
  const safe = Math.floor(totalSeconds);
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
  }
  return `${minutes}:${String(seconds).padStart(2, '0')}`;
}

function formatCompactViewCount(raw?: string): string {
  if (!raw) return '';
  const count = Number(raw);
  if (!Number.isFinite(count) || count <= 0) return '';
  if (count >= 1_000_000_000) return `${(count / 1_000_000_000).toFixed(1).replace(/\.0$/, '')}B views`;
  if (count >= 1_000_000) return `${(count / 1_000_000).toFixed(1).replace(/\.0$/, '')}M views`;
  if (count >= 1_000) return `${(count / 1_000).toFixed(1).replace(/\.0$/, '')}K views`;
  return `${Math.round(count)} views`;
}

function extractYouTubeIdFromUrl(rawUrl: string): string | null {
  try {
    const parsed = new URL(rawUrl);
    const host = parsed.hostname.toLowerCase().replace(/^www\./, '');
    let candidate = '';
    if (host === 'youtu.be') {
      candidate = parsed.pathname.split('/').filter(Boolean)[0] ?? '';
    } else if (host === 'youtube.com' || host.endsWith('.youtube.com')) {
      const vParam = parsed.searchParams.get('v');
      if (vParam) {
        candidate = vParam;
      } else {
        const parts = parsed.pathname.split('/').filter(Boolean);
        if ((parts[0] === 'shorts' || parts[0] === 'embed' || parts[0] === 'live') && parts[1]) {
          candidate = parts[1];
        }
      }
    }
    return /^[a-zA-Z0-9_-]{11}$/.test(candidate) ? candidate : null;
  } catch {
    return null;
  }
}

async function searchYouTubeViaLiveWebFallback(
  query: string,
  isMusic: boolean
): Promise<YouTubeSearchItem[]> {
  const targetedQuery = `site:youtube.com/watch ${isMusic ? `${query} music` : query}`;
  const { sources } = await retrieveLiveWebSources(targetedQuery);
  const candidates = new Map<string, WebSearchSource>();

  for (const src of sources) {
    const id = extractYouTubeIdFromUrl(src.url);
    if (id && !candidates.has(id)) {
      candidates.set(id, src);
    }
  }

  if (candidates.size < 4) {
    try {
      const broader = await searchViaLiveWebIndex(
        `youtube.com/watch ${isMusic ? `${query} official audio` : query}`
      );
      for (const src of broader) {
        const id = extractYouTubeIdFromUrl(src.url);
        if (id && !candidates.has(id)) {
          candidates.set(id, src);
        }
        if (candidates.size >= 10) break;
      }
    } catch {
      /* Ignore secondary web index errors */
    }
  }

  const entries = [...candidates.entries()].slice(0, 10);
  if (entries.length === 0) return [];

  const enriched = await Promise.all(
    entries.map(async ([id, src]): Promise<YouTubeSearchItem> => {
      const cleanedFallbackTitle = src.title
        .replace(/\s*[-|]\s*YouTube\s*$/i, '')
        .trim();
      try {
        const oembedUrl = `https://www.youtube.com/oembed?url=${encodeURIComponent(
          `https://www.youtube.com/watch?v=${id}`
        )}&format=json`;
        const res = await fetch(oembedUrl, { signal: AbortSignal.timeout(4000) });
        if (res.ok) {
          const meta = (await res.json()) as {
            title?: string;
            author_name?: string;
            thumbnail_url?: string;
          };
          return {
            id,
            title: meta.title?.trim() || cleanedFallbackTitle || `YouTube video ${id}`,
            channelTitle: meta.author_name?.trim() || 'YouTube',
            description: src.snippet || '',
            publishedAt: '',
            thumbnail: meta.thumbnail_url || `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          };
        }
      } catch {
        /* Fall back to live search metadata + standard ytimg thumbnail */
      }
      return {
        id,
        title: cleanedFallbackTitle || `YouTube video ${id}`,
        channelTitle: 'YouTube',
        description: src.snippet || '',
        publishedAt: '',
        thumbnail: `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
      };
    })
  );

  return enriched;
}

function getDomain(rawUrl: string): string {
  try {
    return new URL(rawUrl).hostname.replace(/^www\./i, '').toLowerCase();
  } catch {
    return rawUrl;
  }
}

function decodeHtmlEntities(input: string): string {
  return input
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_m, dec) => String.fromCharCode(Number(dec)))
    .replace(/&#x([0-9a-f]+);/gi, (_m, hex) => String.fromCharCode(parseInt(hex, 16)));
}

function stripTags(html: string): string {
  return decodeHtmlEntities(html.replace(/<[^>]+>/g, ' '))
    .replace(/\s+/g, ' ')
    .trim();
}

function getGenAIClient(): GoogleGenAI | null {
  const apiKey = process.env.GEMINI_API_KEY?.trim();
  if (!apiKey) return null;
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
      timeout: 15_000,
    },
  });
}

/**
 * Tier 1: Google Custom Search JSON API (when GOOGLE_SEARCH_API_KEY and GOOGLE_SEARCH_CX are provided).
 */
async function searchViaGoogleCustomSearch(query: string): Promise<WebSearchSource[]> {
  const apiKey = process.env.GOOGLE_SEARCH_API_KEY?.trim();
  const cx = process.env.GOOGLE_SEARCH_CX?.trim();
  if (!apiKey || !cx) return [];

  const endpoint = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(
    apiKey
  )}&cx=${encodeURIComponent(cx)}&q=${encodeURIComponent(query)}&num=8`;

  const response = await fetch(endpoint, { signal: AbortSignal.timeout(6500) });
  if (!response.ok) return [];

  const data = (await response.json()) as {
    items?: Array<{ title?: string; link?: string; snippet?: string }>;
  };

  const results: WebSearchSource[] = [];
  for (const item of data.items ?? []) {
    const url = item.link?.trim();
    if (!url || !/^https?:\/\//i.test(url)) continue;
    results.push({
      title: item.title?.trim() || getDomain(url),
      url,
      domain: getDomain(url),
      snippet: item.snippet?.replace(/\s+/g, ' ').trim() || '',
    });
  }
  return results;
}

/**
 * Tier 2: Live organic web search index retrieval.
 */
async function searchViaLiveWebIndex(query: string): Promise<WebSearchSource[]> {
  const endpoint = `https://html.duckduckgo.com/html/?q=${encodeURIComponent(query)}`;
  const response = await fetch(endpoint, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36',
      'Accept-Language': 'en-US,en;q=0.9',
    },
    signal: AbortSignal.timeout(6500),
  });

  if (!response.ok) return [];
  const html = await response.text();
  const blocks = html.split(/class="result\s+results_links/).slice(1);

  const seen = new Set<string>();
  const results: WebSearchSource[] = [];

  for (const block of blocks) {
    if (block.slice(0, 90).includes('result--ad') || block.includes('badge--ad')) continue;
    const anchorMatch = block.match(/class="result__a"[^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/);
    if (!anchorMatch) continue;

    let rawHref = decodeHtmlEntities(anchorMatch[1]);
    const uddgMatch = rawHref.match(/[?&]uddg=([^&]+)/);
    if (uddgMatch) {
      try {
        rawHref = decodeURIComponent(uddgMatch[1]);
      } catch {
        /* Keep rawHref */
      }
    }

    if (
      !/^https?:\/\//i.test(rawHref) ||
      rawHref.includes('duckduckgo.com/y.js') ||
      seen.has(rawHref)
    ) {
      continue;
    }

    const title = stripTags(anchorMatch[2]);
    if (!title) continue;

    const snippetMatch = block.match(/class="result__snippet"[^>]*>([\s\S]*?)<\/(?:a|div)>/);
    const snippet = snippetMatch ? stripTags(snippetMatch[1]) : '';

    seen.add(rawHref);
    results.push({
      title,
      url: rawHref,
      domain: getDomain(rawHref),
      snippet,
    });

    if (results.length >= 8) break;
  }

  return results;
}

/**
 * Tier 3: Public knowledge & tech search fallback (Wikipedia + Hacker News Algolia).
 */
async function searchViaPublicKnowledgeApis(query: string): Promise<WebSearchSource[]> {
  const wikiUrl = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(
    query
  )}&utf8=1&format=json&srlimit=5`;
  const hnUrl = `https://hn.algolia.com/api/v1/search?query=${encodeURIComponent(
    query
  )}&tags=story&hitsPerPage=4`;

  const [wikiRes, hnRes] = await Promise.allSettled([
    fetch(wikiUrl, { signal: AbortSignal.timeout(5000) }),
    fetch(hnUrl, { signal: AbortSignal.timeout(5000) }),
  ]);

  const seen = new Set<string>();
  const results: WebSearchSource[] = [];

  if (wikiRes.status === 'fulfilled' && wikiRes.value.ok) {
    const wikiJson = (await wikiRes.value.json()) as {
      query?: { search?: Array<{ title: string; snippet: string }> };
    };
    for (const item of wikiJson.query?.search ?? []) {
      const url = `https://en.wikipedia.org/wiki/${encodeURIComponent(
        item.title.replace(/ /g, '_')
      )}`;
      if (seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: `${item.title} — Wikipedia`,
        url,
        domain: 'en.wikipedia.org',
        snippet: stripTags(item.snippet),
      });
    }
  }

  if (hnRes.status === 'fulfilled' && hnRes.value.ok) {
    const hnJson = (await hnRes.value.json()) as {
      hits?: Array<{ title?: string; url?: string; objectID?: string }>;
    };
    for (const hit of hnJson.hits ?? []) {
      const url =
        hit.url && /^https?:\/\//i.test(hit.url)
          ? hit.url
          : hit.objectID
            ? `https://news.ycombinator.com/item?id=${hit.objectID}`
            : '';
      if (!url || !hit.title || seen.has(url)) continue;
      seen.add(url);
      results.push({
        title: hit.title,
        url,
        domain: getDomain(url),
        snippet: 'Discussion and link indexed on Hacker News.',
      });
    }
  }

  return results.slice(0, 8);
}

const WEB_SOURCE_CACHE_TTL_MS = 2 * 60 * 1000;
const webSourceCache = new Map<
  string,
  { expiresAt: number; sources: WebSearchSource[]; provider: string }
>();

async function retrieveLiveWebSources(
  query: string
): Promise<{ sources: WebSearchSource[]; provider: string }> {
  const key = query.trim().toLowerCase();
  const cached = webSourceCache.get(key);
  if (cached && cached.expiresAt > Date.now() && cached.sources.length > 0) {
    return { sources: cached.sources, provider: cached.provider };
  }

  const storeAndReturn = (sources: WebSearchSource[], provider: string) => {
    if (sources.length > 0) {
      if (webSourceCache.size > 100) {
        const oldestKey = webSourceCache.keys().next().value;
        if (oldestKey) webSourceCache.delete(oldestKey);
      }
      webSourceCache.set(key, {
        expiresAt: Date.now() + WEB_SOURCE_CACHE_TTL_MS,
        sources,
        provider,
      });
    }
    return { sources, provider };
  };

  try {
    const googleItems = await searchViaGoogleCustomSearch(query);
    if (googleItems.length > 0) {
      return storeAndReturn(googleItems, 'Google Search API');
    }
  } catch {
    /* Fall through to live web index */
  }

  try {
    const webItems = await searchViaLiveWebIndex(query);
    if (webItems.length > 0) {
      return storeAndReturn(webItems, 'Live Web Index');
    }
  } catch {
    /* Fall through to public knowledge APIs */
  }

  try {
    const fallbackItems = await searchViaPublicKnowledgeApis(query);
    return storeAndReturn(fallbackItems, 'Public Web APIs');
  } catch {
    return { sources: [], provider: 'Web' };
  }
}

async function generateGeminiOverview(
  ai: GoogleGenAI,
  query: string,
  sources: WebSearchSource[],
  history: SearchTurn[]
): Promise<{ answer: string; relatedQueries: string[]; groundedSources: WebSearchSource[] }> {
  const webContext =
    sources.length > 0
      ? sources
          .map(
            (s, idx) =>
              `[${idx + 1}] ${s.title} (${s.domain} — ${s.url})\nSnippet: ${
                s.snippet || 'No snippet'
              }`
          )
          .join('\n\n')
      : 'No external snippets retrieved; rely on verified knowledge.';

  const priorContext =
    history.length > 0
      ? 'Previous conversation context:\n' +
        history.map(t => `Q: ${t.query}\nA: ${t.answer.slice(0, 350)}`).join('\n---\n') +
        '\n\n'
      : '';

  const prompt =
    `${priorContext}User search query: "${query}"\n\n` +
    `Live web search results:\n${webContext}\n\n` +
    `Synthesize a helpful, accurate, well-structured answer in Markdown (short paragraphs or bullet points, using **bold** for key terms; no filler preambles). ` +
    `Also suggest 4 concise follow-up web search queries.`;

  /* Try fast free-tier friendly gemini-3.1-flash-lite first, then fallback to gemini-3.8-flash */
  const candidateModels = ['gemini-3.1-flash-lite', 'gemini-3.8-flash'];
  let lastError: unknown = null;

  for (const model of candidateModels) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents: prompt,
        config: {
          systemInstruction:
            'You are the Gemini AI Search overview engine inside Nexus Browser. ' +
            'Ground your answer in the provided live web search results and verified factual knowledge. ' +
            'Keep answers clear, scannable, and direct.',
          responseMimeType: 'application/json',
          responseSchema: {
            type: Type.OBJECT,
            properties: {
              answer: {
                type: Type.STRING,
                description: 'Clear Markdown synthesis answering the search query.',
              },
              relatedQueries: {
                type: Type.ARRAY,
                items: { type: Type.STRING },
                description: '3 to 4 concise related search queries.',
              },
            },
            required: ['answer', 'relatedQueries'],
          },
        },
      });

      const rawText = response.text?.trim() ?? '';
      if (!rawText) continue;

      const parsed = JSON.parse(rawText) as {
        answer?: string;
        relatedQueries?: string[];
      };

      const answer = parsed.answer?.trim() || '';
      const relatedQueries = Array.isArray(parsed.relatedQueries)
        ? parsed.relatedQueries
            .map(q => String(q).trim())
            .filter(q => q.length > 0 && q.toLowerCase() !== query.toLowerCase())
            .slice(0, 5)
        : [];

      if (answer) {
        return { answer, relatedQueries, groundedSources: [] };
      }
    } catch (err: unknown) {
      lastError = err;
    }
  }

  throw lastError ?? new Error('Gemini synthesis unavailable');
}

async function createApp() {
  const app = express();
  app.use(express.json({ limit: '256kb' }));

  app.get('/api/youtube/search', async (req: Request, res: Response) => {
    const query = typeof req.query.q === 'string' ? req.query.q.trim() : '';
    const isMusic = req.query.category === 'music';
    const category = isMusic ? '10' : '';

    if (query.length < 2 || query.length > 120) {
      res.status(400).json({ error: 'Enter a search with between 2 and 120 characters.' });
      return;
    }

    const apiKey = process.env.YOUTUBE_API_KEY?.trim();
    if (!apiKey) {
      try {
        const fallbackItems = await searchYouTubeViaLiveWebFallback(query, isMusic);
        if (fallbackItems.length > 0) {
          res.json({ items: fallbackItems, provider: 'web-oembed' });
          return;
        }
      } catch {
        /* Fall through to configuration message */
      }
      res.status(503).json({
        error: 'YouTube search could not reach live results. Set YOUTUBE_API_KEY in Settings > Secrets or play directly from a YouTube URL.',
      });
      return;
    }

    try {
      const endpoint = new URL('https://www.googleapis.com/youtube/v3/search');
      endpoint.search = new URLSearchParams({
        key: apiKey,
        part: 'snippet',
        q: query,
        type: 'video',
        maxResults: '12',
        safeSearch: 'moderate',
        ...(category ? { videoCategoryId: category } : {}),
      }).toString();
      const response = await fetch(endpoint, { signal: AbortSignal.timeout(8000) });
      const data = (await response.json()) as {
        error?: { message?: string };
        items?: Array<{
          id?: { videoId?: string };
          snippet?: {
            title?: string;
            channelTitle?: string;
            description?: string;
            publishedAt?: string;
            liveBroadcastContent?: string;
            thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
          };
        }>;
      };
      if (!response.ok) {
        /* If quota exceeded or invalid key, attempt live web + oEmbed fallback before failing */
        const fallbackItems = await searchYouTubeViaLiveWebFallback(query, isMusic).catch(() => []);
        if (fallbackItems.length > 0) {
          res.json({ items: fallbackItems, provider: 'web-oembed' });
          return;
        }
        res.status(502).json({ error: data.error?.message || 'YouTube search failed.' });
        return;
      }

      const rawItems: YouTubeSearchItem[] = (data.items ?? []).flatMap<YouTubeSearchItem>(item => {
        const id = item.id?.videoId;
        const snippet = item.snippet;
        if (!id || !snippet?.title) return [];
        const isLive = snippet.liveBroadcastContent === 'live';
        return [{
          id,
          title: decodeHtmlEntities(snippet.title),
          channelTitle: decodeHtmlEntities(snippet.channelTitle ?? 'YouTube'),
          description: decodeHtmlEntities(snippet.description ?? ''),
          publishedAt: snippet.publishedAt ?? '',
          thumbnail: snippet.thumbnails?.medium?.url ?? snippet.thumbnails?.default?.url ?? `https://i.ytimg.com/vi/${id}/mqdefault.jpg`,
          ...(isLive ? { duration: 'LIVE', durationSeconds: 0 } : {}),
        }];
      });

      /* Batch-fetch rich video durations & view counts via videos.list */
      if (rawItems.length > 0) {
        try {
          const detailsUrl = new URL('https://www.googleapis.com/youtube/v3/videos');
          detailsUrl.search = new URLSearchParams({
            key: apiKey,
            part: 'contentDetails,statistics',
            id: rawItems.map(i => i.id).join(','),
          }).toString();
          const detailsRes = await fetch(detailsUrl, { signal: AbortSignal.timeout(5000) });
          if (detailsRes.ok) {
            const detailsData = (await detailsRes.json()) as {
              items?: Array<{
                id?: string;
                contentDetails?: { duration?: string };
                statistics?: { viewCount?: string };
              }>;
            };
            const metaById = new Map(
              (detailsData.items ?? [])
                .filter((d): d is { id: string; contentDetails?: { duration?: string }; statistics?: { viewCount?: string } } => Boolean(d.id))
                .map(d => [d.id, d])
            );
            for (const item of rawItems) {
              const meta = metaById.get(item.id);
              if (!meta) continue;
              const iso = meta.contentDetails?.duration ?? '';
              if (iso === 'P0D' || item.duration === 'LIVE') {
                item.duration = 'LIVE';
                item.durationSeconds = 0;
              } else if (iso) {
                const secs = parseIsoDurationToSeconds(iso);
                if (secs > 0) {
                  item.durationSeconds = secs;
                  item.duration = formatDurationClock(secs);
                }
              }
              const formattedViews = formatCompactViewCount(meta.statistics?.viewCount);
              if (formattedViews) {
                item.viewCount = formattedViews;
              }
            }
          }
        } catch {
          /* Keep snippet results if secondary details call times out */
        }
      }

      res.json({ items: rawItems, provider: 'youtube-v3' });
    } catch (error: unknown) {
      const message = error instanceof Error ? error.message : 'YouTube search failed.';
      res.status(502).json({ error: message });
    }
  });

  app.post('/api/search', async (req: Request, res: Response) => {
    const body = (req.body ?? {}) as SearchRequestBody;
    const query = typeof body.query === 'string' ? body.query.trim() : '';
    const mode = body.mode === 'web' ? 'web' : 'ai';

    if (!query) {
      res.status(400).json({ error: 'Enter a search query to search the web.' });
      return;
    }

    if (query.length > 600) {
      res.status(400).json({ error: 'Search query is too long (maximum 600 characters).' });
      return;
    }

    const rawHistory = Array.isArray(body.history) ? body.history : [];
    const safeHistory: SearchTurn[] = rawHistory
      .filter((item): item is SearchTurn => {
        if (!item || typeof item !== 'object') return false;
        const turn = item as Partial<SearchTurn>;
        return typeof turn.query === 'string' && typeof turn.answer === 'string';
      })
      .slice(-3);

    /* 1. Always retrieve real live web search results first */
    const { sources, provider } = await retrieveLiveWebSources(query);

    /* If user requested pure Web Results mode, return immediately */
    if (mode === 'web') {
      res.json({
        query,
        answer: '',
        sources,
        relatedQueries: [],
        searchProvider: provider,
      });
      return;
    }

    /* 2. Generate Gemini AI Overview grounded on live web results */
    const ai = getGenAIClient();
    if (!ai) {
      if (sources.length > 0) {
        res.json({
          query,
          answer: '',
          sources,
          relatedQueries: [],
          searchProvider: provider,
          aiNotice:
            'Showing live web results. Add a Gemini API key in Settings > Secrets to enable AI Overviews.',
        });
        return;
      }
      res.status(403).json({
        error:
          'Configure a Gemini API key in Settings > Secrets, or switch to a browser search engine in the address bar.',
      });
      return;
    }

    try {
      const { answer, relatedQueries } = await generateGeminiOverview(
        ai,
        query,
        sources,
        safeHistory
      );

      res.json({
        query,
        answer,
        sources,
        relatedQueries,
        searchProvider: `${provider} + Gemini`,
      });
    } catch (err: unknown) {
      /* Even if Gemini hits a quota or transient error, still return the live web search results! */
      if (sources.length > 0) {
        res.json({
          query,
          answer: '',
          sources,
          relatedQueries: [],
          searchProvider: provider,
          aiNotice:
            'AI Overview is temporarily unavailable; showing live web search results below.',
        });
        return;
      }

      const message = err instanceof Error ? err.message : String(err);
      res.status(502).json({
        error: message.includes('429')
          ? 'Gemini API rate limit reached. Try again in a moment or open Google Search in a new tab.'
          : 'Could not complete search right now. Try again or use a browser search engine.',
      });
    }
  });

  if (process.env.NODE_ENV !== 'production') {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(__dirname, 'dist');
    app.use(express.static(distPath));
    app.use((_req: Request, res: Response) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  return app;
}

createApp()
  .then(app => {
    app.listen(PORT, '0.0.0.0', () => {
      console.log(`Nexus server listening on http://0.0.0.0:${PORT}`);
    });
  })
  .catch((err: unknown) => {
    console.error('Failed to start Nexus server:', err);
    process.exit(1);
  });
