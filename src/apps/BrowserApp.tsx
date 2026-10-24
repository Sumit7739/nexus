import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type FormEvent,
  type MouseEvent as ReactMouseEvent,
  type ReactNode,
} from 'react';
import {
  ArrowRight,
  ArrowUpRight,
  Bookmark,
  Check,
  CheckSquare,
  ChevronLeft,
  ChevronRight,
  Compass,
  Copy,
  ExternalLink,
  Globe2,
  Lock,
  Plus,
  RotateCw,
  Search,
  Sparkles,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
import { ShortcutFavicon } from '../components/ShortcutFavicon';
import { SelectionActionBar } from '../components/SelectionActionBar';
import {
  BROWSER_NAVIGATE_EVENT,
  BROWSER_SEARCH_ENGINES,
  classifyOmniboxInput,
  consumePendingBrowserNavigations,
  formatTabTitleForUrl,
  formatUrlBreadcrumb,
  getSearchEngine,
  isKnownFrameRestricted,
  readBrowserHistory,
  readBrowserPrefs,
  saveBrowserHistory,
  saveBrowserPrefs,
  type AiSearchResult,
  type AiSearchSource,
  type BrowserHistoryItem,
  type BrowserNavigationRequest,
  type BrowserPrefs,
  type SearchEngineId,
} from '../data/browser';
import {
  extractHostname,
  readShortcuts,
  saveShortcuts,
  type SavedShortcut,
} from '../data/shortcuts';
import {
  computeFloatingBarPosition,
  normalizeResearchQuery,
  requestOpenApp,
  sendSelectionToScratchpad,
  type BrowserSelectionSource,
} from '../data/context-actions';
import type { SettingsProps } from './AppHost';

/* ── Types ────────────────────────────────────────────────────────────────── */

type TabLocation =
  | { kind: 'start' }
  | { kind: 'url'; url: string; title: string }
  | { kind: 'search'; query: string; engine: SearchEngineId };

interface SearchTurn {
  query: string;
  answer: string;
}

interface TabSearchState {
  status: 'idle' | 'loading' | 'ready' | 'error';
  mode: 'ai' | 'web';
  query: string;
  answer: string;
  sources: AiSearchSource[];
  relatedQueries: string[];
  aiNotice: string;
  errorMessage: string;
  turns: SearchTurn[];
}

interface BrowserTab {
  id: string;
  history: TabLocation[];
  historyIndex: number;
  omniboxDraft: string;
  reloadNonce: number;
  searchState: TabSearchState;
}

const STARTER_QUERIES = [
  'Latest breakthroughs in space exploration',
  'Compare SQLite vs DuckDB for local analytics',
  'Dieter Rams ten principles of good design',
  'How WebAssembly garbage collection works',
];

function createEmptySearchState(): TabSearchState {
  return {
    status: 'idle',
    mode: 'ai',
    query: '',
    answer: '',
    sources: [],
    relatedQueries: [],
    aiNotice: '',
    errorMessage: '',
    turns: [],
  };
}

function getOmniboxTextForLocation(loc: TabLocation): string {
  if (loc.kind === 'url') return loc.url;
  if (loc.kind === 'search') return loc.query;
  return '';
}

function getTabTitle(loc: TabLocation): string {
  if (loc.kind === 'start') return 'New Tab';
  if (loc.kind === 'url') return loc.title || formatTabTitleForUrl(loc.url);
  return `${loc.query} — Search`;
}

function makeTab(initial: TabLocation = { kind: 'start' }): BrowserTab {
  return {
    id: crypto.randomUUID(),
    history: [initial],
    historyIndex: 0,
    omniboxDraft: getOmniboxTextForLocation(initial),
    reloadNonce: 0,
    searchState: createEmptySearchState(),
  };
}

function isServerSearchEngine(engine: SearchEngineId): engine is 'ai' | 'web' {
  return engine === 'ai' || engine === 'web';
}

/* ── Safe Lightweight Markdown Renderer for Gemini AI Overviews ───────────── */

function renderInlineMarkdown(text: string): ReactNode[] {
  const tokens = text.split(/(\*\*[^*]+\*\*|`[^`]+`|\[[^\]]+\]\(https?:\/\/[^)\s]+\))/g);
  return tokens.map((token, idx) => {
    if (token.startsWith('**') && token.endsWith('**') && token.length > 4) {
      return <strong key={idx}>{token.slice(2, -2)}</strong>;
    }
    if (token.startsWith('`') && token.endsWith('`') && token.length > 2) {
      return <code key={idx} className="nxb-md-inline-code">{token.slice(1, -1)}</code>;
    }
    const linkMatch = token.match(/^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/);
    if (linkMatch) {
      return (
        <a
          key={idx}
          href={linkMatch[2]}
          target="_blank"
          rel="noopener noreferrer"
          className="nxb-md-link"
        >
          {linkMatch[1]}
        </a>
      );
    }
    return token;
  });
}

function SearchMarkdown({ markdown }: { markdown: string }) {
  const lines = markdown.replace(/\r\n/g, '\n').split('\n');
  const blocks: ReactNode[] = [];
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];
    const trimmed = line.trim();

    if (!trimmed) {
      i++;
      continue;
    }

    if (trimmed.startsWith('```')) {
      const codeLines: string[] = [];
      i++;
      while (i < lines.length && !lines[i].trim().startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      if (i < lines.length) i++;
      blocks.push(
        <pre key={`code-${i}`} className="nxb-md-pre">
          <code>{codeLines.join('\n')}</code>
        </pre>
      );
      continue;
    }

    const headingMatch = trimmed.match(/^(#{1,4})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const content = renderInlineMarkdown(headingMatch[2]);
      blocks.push(
        level <= 2 ? (
          <h4 key={`h-${i}`} className="nxb-md-h4">{content}</h4>
        ) : (
          <h5 key={`h-${i}`} className="nxb-md-h5">{content}</h5>
        )
      );
      i++;
      continue;
    }

    if (/^[-*•]\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^[-*•]\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^[-*•]\s+/, '');
        items.push(<li key={`ul-li-${i}`}>{renderInlineMarkdown(itemText)}</li>);
        i++;
      }
      blocks.push(<ul key={`ul-${i}`} className="nxb-md-list">{items}</ul>);
      continue;
    }

    if (/^\d+\.\s+/.test(trimmed)) {
      const items: ReactNode[] = [];
      while (i < lines.length && /^\d+\.\s+/.test(lines[i].trim())) {
        const itemText = lines[i].trim().replace(/^\d+\.\s+/, '');
        items.push(<li key={`ol-li-${i}`}>{renderInlineMarkdown(itemText)}</li>);
        i++;
      }
      blocks.push(<ol key={`ol-${i}`} className="nxb-md-list nxb-md-olist">{items}</ol>);
      continue;
    }

    const paraLines: string[] = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].trim().startsWith('```') &&
      !/^(#{1,4})\s+/.test(lines[i].trim()) &&
      !/^[-*•]\s+/.test(lines[i].trim()) &&
      !/^\d+\.\s+/.test(lines[i].trim())
    ) {
      paraLines.push(lines[i].trim());
      i++;
    }
    blocks.push(
      <p key={`p-${i}`} className="nxb-md-p">
        {renderInlineMarkdown(paraLines.join(' '))}
      </p>
    );
  }

  return <div className="nxb-md-body">{blocks}</div>;
}

/* ── Main Nexus Browser Component ─────────────────────────────────────────── */

export function BrowserApp({ settings }: { settings?: SettingsProps }) {
  const [fallbackShortcuts, setFallbackShortcuts] = useState<SavedShortcut[]>(readShortcuts);
  const shortcuts = settings ? settings.shortcuts : fallbackShortcuts;

  const updateShortcuts = useCallback(
    (next: SavedShortcut[]) => {
      if (settings) {
        settings.onShortcutsChange(next);
      } else {
        setFallbackShortcuts(next);
        saveShortcuts(next);
      }
    },
    [settings]
  );

  const [prefs, setPrefs] = useState<BrowserPrefs>(readBrowserPrefs);
  const [recentHistory, setRecentHistory] = useState<BrowserHistoryItem[]>(readBrowserHistory);

  const [tabs, setTabs] = useState<BrowserTab[]>(() => [makeTab({ kind: 'start' })]);
  const [activeTabId, setActiveTabId] = useState<string>(() => tabs[0].id);

  /* Per-URL overrides inside this browser session for frame-restricted sites */
  const [forceEmbedUrls, setForceEmbedUrls] = useState<Record<string, boolean>>({});
  const [forceExternalCardUrls, setForceExternalCardUrls] = useState<Record<string, boolean>>({});
  const [copiedUrl, setCopiedUrl] = useState<string | null>(null);
  const [followUpInput, setFollowUpInput] = useState('');

  const omniboxInputRef = useRef<HTMLInputElement>(null);
  const startSearchInputRef = useRef<HTMLInputElement>(null);
  const searchAbortControllers = useRef<Map<string, AbortController>>(new Map());

  useEffect(() => {
    saveBrowserPrefs(prefs);
  }, [prefs]);

  useEffect(() => {
    saveBrowserHistory(recentHistory);
  }, [recentHistory]);

  useEffect(() => {
    const controllers = searchAbortControllers.current;
    return () => {
      controllers.forEach(controller => controller.abort());
      controllers.clear();
    };
  }, []);

  const activeTab = useMemo(
    () => tabs.find(t => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const currentLoc = activeTab.history[activeTab.historyIndex] ?? { kind: 'start' };
  const canGoBack = activeTab.historyIndex > 0;
  const canGoForward = activeTab.historyIndex < activeTab.history.length - 1;

  const recordHistoryItem = useCallback(
    (entry: Omit<BrowserHistoryItem, 'id' | 'visitedAt'>) => {
      setRecentHistory(prev => {
        const filtered = prev.filter(
          item => !(item.kind === entry.kind && item.value.toLowerCase() === entry.value.toLowerCase())
        );
        return [
          {
            ...entry,
            id: crypto.randomUUID(),
            visitedAt: Date.now(),
          },
          ...filtered,
        ].slice(0, 16);
      });
    },
    []
  );

  const executeServerSearch = useCallback(
    async (
      tabId: string,
      query: string,
      mode: 'ai' | 'web',
      priorTurns: SearchTurn[] = []
    ) => {
      const prevController = searchAbortControllers.current.get(tabId);
      if (prevController) prevController.abort();

      const controller = new AbortController();
      searchAbortControllers.current.set(tabId, controller);

      setTabs(prev =>
        prev.map(tab =>
          tab.id === tabId
            ? {
                ...tab,
                searchState: {
                  ...tab.searchState,
                  status: 'loading',
                  mode,
                  query,
                  aiNotice: '',
                  errorMessage: '',
                },
              }
            : tab
        )
      );

      try {
        const response = await fetch('/api/search', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query, mode, history: priorTurns }),
          signal: controller.signal,
        });

        const payload = (await response.json().catch(() => ({}))) as Partial<AiSearchResult> & {
          error?: string;
        };

        if (!response.ok) {
          throw new Error(
            payload.error || 'Unable to complete web search right now. Try switching search engines.'
          );
        }

        const answer = payload.answer ?? '';
        const sources = Array.isArray(payload.sources) ? payload.sources : [];
        const relatedQueries = Array.isArray(payload.relatedQueries) ? payload.relatedQueries : [];
        const aiNotice = payload.aiNotice ?? '';

        setTabs(prev =>
          prev.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  searchState: {
                    status: 'ready',
                    mode,
                    query,
                    answer,
                    sources,
                    relatedQueries,
                    aiNotice,
                    errorMessage: '',
                    turns: answer
                      ? [...priorTurns, { query, answer }].slice(-4)
                      : priorTurns,
                  },
                }
              : tab
          )
        );
      } catch (err: unknown) {
        if (err instanceof DOMException && err.name === 'AbortError') return;
        const message =
          err instanceof Error
            ? err.message
            : 'Web search failed. Try again or open your query in a browser search engine.';

        setTabs(prev =>
          prev.map(tab =>
            tab.id === tabId
              ? {
                  ...tab,
                  searchState: {
                    ...tab.searchState,
                    status: 'error',
                    mode,
                    query,
                    errorMessage: message,
                  },
                }
              : tab
          )
        );
      } finally {
        if (searchAbortControllers.current.get(tabId) === controller) {
          searchAbortControllers.current.delete(tabId);
        }
      }
    },
    []
  );

  const navigateTab = useCallback(
    (tabId: string, destination: TabLocation, carryTurns: SearchTurn[] = []) => {
      setTabs(prev =>
        prev.map(tab => {
          if (tab.id !== tabId) return tab;
          const nextHistory = [...tab.history.slice(0, tab.historyIndex + 1), destination];
          return {
            ...tab,
            history: nextHistory,
            historyIndex: nextHistory.length - 1,
            omniboxDraft: getOmniboxTextForLocation(destination),
            reloadNonce: tab.reloadNonce + 1,
            searchState:
              destination.kind === 'search' && isServerSearchEngine(destination.engine)
                ? tab.searchState
                : createEmptySearchState(),
          };
        })
      );

      if (destination.kind === 'url') {
        recordHistoryItem({
          kind: 'url',
          title: destination.title,
          value: destination.url,
        });
      } else if (destination.kind === 'search') {
        recordHistoryItem({
          kind: 'search',
          title: destination.query,
          value: destination.query,
          engine: destination.engine,
        });
        if (isServerSearchEngine(destination.engine)) {
          void executeServerSearch(tabId, destination.query, destination.engine, carryTurns);
        }
      }
    },
    [executeServerSearch, recordHistoryItem]
  );

  const openNewTab = useCallback(
    (initial: TabLocation = { kind: 'start' }, activate = true) => {
      const created = makeTab(initial);
      setTabs(prev => [...prev, created]);
      if (activate) {
        setActiveTabId(created.id);
      }
      if (initial.kind === 'url') {
        recordHistoryItem({ kind: 'url', title: initial.title, value: initial.url });
      } else if (initial.kind === 'search') {
        recordHistoryItem({
          kind: 'search',
          title: initial.query,
          value: initial.query,
          engine: initial.engine,
        });
        if (isServerSearchEngine(initial.engine)) {
          void executeServerSearch(created.id, initial.query, initial.engine);
        }
      } else if (activate) {
        window.setTimeout(() => startSearchInputRef.current?.focus(), 30);
      }
    },
    [executeServerSearch, recordHistoryItem]
  );

  const activeTabRef = useRef(activeTab);
  activeTabRef.current = activeTab;

  const handleExternalNavigation = useCallback(
    (req: BrowserNavigationRequest) => {
      const currentTab = activeTabRef.current;
      const loc = currentTab.history[currentTab.historyIndex] ?? { kind: 'start' };

      if (req.kind === 'start') {
        if (loc.kind === 'start') {
          window.setTimeout(() => startSearchInputRef.current?.focus(), 30);
        } else {
          openNewTab({ kind: 'start' }, true);
        }
        return;
      }

      const destination: TabLocation =
        req.kind === 'url'
          ? {
              kind: 'url',
              url: req.url,
              title: req.title || formatTabTitleForUrl(req.url),
            }
          : {
              kind: 'search',
              query: req.query,
              engine: req.engine,
            };

      if (loc.kind === 'start') {
        navigateTab(currentTab.id, destination);
      } else {
        openNewTab(destination, true);
      }
    },
    [navigateTab, openNewTab]
  );

  useEffect(() => {
    const flushPending = () => {
      const pending = consumePendingBrowserNavigations();
      if (pending.length === 0) return;
      for (const req of pending) {
        handleExternalNavigation(req);
      }
    };
    const initialTimer = window.setTimeout(flushPending, 0);
    window.addEventListener(BROWSER_NAVIGATE_EVENT, flushPending);
    return () => {
      window.clearTimeout(initialTimer);
      window.removeEventListener(BROWSER_NAVIGATE_EVENT, flushPending);
    };
  }, [handleExternalNavigation]);

  const closeTab = useCallback(
    (tabId: string) => {
      const controller = searchAbortControllers.current.get(tabId);
      if (controller) {
        controller.abort();
        searchAbortControllers.current.delete(tabId);
      }

      setTabs(prev => {
        if (prev.length <= 1) {
          const fresh = makeTab({ kind: 'start' });
          setActiveTabId(fresh.id);
          return [fresh];
        }
        const idx = prev.findIndex(t => t.id === tabId);
        const remaining = prev.filter(t => t.id !== tabId);
        if (tabId === activeTabId) {
          const fallback = remaining[Math.max(0, idx - 1)] ?? remaining[0];
          setActiveTabId(fallback.id);
        }
        return remaining;
      });
    },
    [activeTabId]
  );

  const stepHistory = (delta: -1 | 1) => {
    const nextIndex = activeTab.historyIndex + delta;
    if (nextIndex < 0 || nextIndex >= activeTab.history.length) return;
    const target = activeTab.history[nextIndex];
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTab.id
          ? {
              ...tab,
              historyIndex: nextIndex,
              omniboxDraft: getOmniboxTextForLocation(target),
            }
          : tab
      )
    );
    if (
      target.kind === 'search' &&
      isServerSearchEngine(target.engine) &&
      (activeTab.searchState.query !== target.query ||
        activeTab.searchState.mode !== target.engine)
    ) {
      void executeServerSearch(activeTab.id, target.query, target.engine);
    }
  };

  const reloadCurrentTab = () => {
    if (currentLoc.kind === 'search' && isServerSearchEngine(currentLoc.engine)) {
      void executeServerSearch(activeTab.id, currentLoc.query, currentLoc.engine);
      return;
    }
    setTabs(prev =>
      prev.map(tab =>
        tab.id === activeTab.id ? { ...tab, reloadNonce: tab.reloadNonce + 1 } : tab
      )
    );
  };

  const setOmniboxDraft = (draft: string) => {
    setTabs(prev =>
      prev.map(tab => (tab.id === activeTab.id ? { ...tab, omniboxDraft: draft } : tab))
    );
  };

  const activeEngine = getSearchEngine(prefs.searchEngine);
  const omniboxIntent = classifyOmniboxInput(activeTab.omniboxDraft);
  const shouldUseNativeExternalSearchForm =
    omniboxIntent?.kind === 'search' &&
    !activeEngine.inTab &&
    Boolean(activeEngine.formAction) &&
    !activeTab.omniboxDraft.trim().startsWith('?');

  const handleOmniboxSubmit = (e: FormEvent<HTMLFormElement>) => {
    const intent = classifyOmniboxInput(activeTab.omniboxDraft);
    if (!intent) {
      e.preventDefault();
      return;
    }

    if (shouldUseNativeExternalSearchForm && intent.kind === 'search') {
      const q = intent.query;
      const chosenEngine = prefs.searchEngine;
      window.setTimeout(() => {
        navigateTab(activeTab.id, { kind: 'search', query: q, engine: chosenEngine });
      }, 0);
      return;
    }

    e.preventDefault();
    if (intent.kind === 'url') {
      navigateTab(activeTab.id, {
        kind: 'url',
        url: intent.url,
        title: formatTabTitleForUrl(intent.url),
      });
    } else {
      navigateTab(activeTab.id, {
        kind: 'search',
        query: intent.query,
        engine: prefs.searchEngine,
      });
    }
  };

  const bookmarkedItem = useMemo(() => {
    if (currentLoc.kind !== 'url') return undefined;
    return shortcuts.find(s => s.url === currentLoc.url);
  }, [currentLoc, shortcuts]);

  const toggleBookmarkCurrentUrl = () => {
    if (currentLoc.kind !== 'url') return;
    if (bookmarkedItem) {
      if (settings) {
        settings.onRemoveShortcut(bookmarkedItem.id);
      } else {
        updateShortcuts(shortcuts.filter(s => s.id !== bookmarkedItem.id));
      }
      return;
    }
    const created: SavedShortcut = {
      id: crypto.randomUUID(),
      title: currentLoc.title || formatTabTitleForUrl(currentLoc.url),
      url: currentLoc.url,
      mode: isKnownFrameRestricted(currentLoc.url) ? 'external' : 'embed',
    };
    updateShortcuts([created, ...shortcuts]);
  };

  const activeExternalUrl = useMemo(() => {
    if (currentLoc.kind === 'url') return currentLoc.url;
    if (currentLoc.kind === 'search') {
      const engine = isServerSearchEngine(currentLoc.engine)
        ? getSearchEngine('google')
        : getSearchEngine(currentLoc.engine);
      return engine.buildUrl(currentLoc.query);
    }
    return null;
  }, [currentLoc]);

  const handleUrlNavigationClick = (
    e: ReactMouseEvent<HTMLElement>,
    url: string,
    title?: string
  ) => {
    const cleanTitle = title || formatTabTitleForUrl(url);
    if (e.button === 1 || e.metaKey || e.ctrlKey) {
      e.preventDefault();
      openNewTab({ kind: 'url', url, title: cleanTitle }, false);
      return;
    }
    e.preventDefault();
    navigateTab(activeTab.id, { kind: 'url', url, title: cleanTitle });
  };

  const copyToClipboard = (text: string) => {
    void navigator.clipboard?.writeText(text);
    setCopiedUrl(text);
    window.setTimeout(() => setCopiedUrl(curr => (curr === text ? null : curr)), 1600);
  };

  const [startDraft, setStartDraft] = useState('');
  const startIntent = classifyOmniboxInput(startDraft);
  const startShouldNativeSubmit =
    startIntent?.kind === 'search' &&
    !activeEngine.inTab &&
    Boolean(activeEngine.formAction) &&
    !startDraft.trim().startsWith('?');

  const handleStartFormSubmit = (e: FormEvent<HTMLFormElement>) => {
    const intent = classifyOmniboxInput(startDraft);
    if (!intent) {
      e.preventDefault();
      return;
    }
    if (startShouldNativeSubmit && intent.kind === 'search') {
      const q = intent.query;
      const chosenEngine = prefs.searchEngine;
      window.setTimeout(() => {
        setStartDraft('');
        navigateTab(activeTab.id, { kind: 'search', query: q, engine: chosenEngine });
      }, 0);
      return;
    }
    e.preventDefault();
    setStartDraft('');
    if (intent.kind === 'url') {
      navigateTab(activeTab.id, {
        kind: 'url',
        url: intent.url,
        title: formatTabTitleForUrl(intent.url),
      });
    } else {
      navigateTab(activeTab.id, {
        kind: 'search',
        query: intent.query,
        engine: prefs.searchEngine,
      });
    }
  };

  /* ── Context-Aware Text Selection Actions (Browser → Scratchpad / Task / Research) ── */
  const viewportRef = useRef<HTMLDivElement | null>(null);
  const clipTimerRef = useRef<number | null>(null);
  const [browserSelection, setBrowserSelection] = useState<{
    text: string;
    x: number;
    y: number;
    placement: 'above' | 'below';
    source?: BrowserSelectionSource;
  } | null>(null);
  const [clipFeedback, setClipFeedback] = useState<string | null>(null);

  const showClipFeedback = useCallback((message: string) => {
    setClipFeedback(message);
    if (clipTimerRef.current !== null) {
      window.clearTimeout(clipTimerRef.current);
    }
    clipTimerRef.current = window.setTimeout(() => {
      setClipFeedback(null);
      clipTimerRef.current = null;
    }, 2800);
  }, []);

  useEffect(() => {
    return () => {
      if (clipTimerRef.current !== null) {
        window.clearTimeout(clipTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    setBrowserSelection(null);
  }, [activeTab.id, activeTab.historyIndex]);

  const clearDomSelection = () => {
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
    setBrowserSelection(null);
  };

  const evaluateBrowserSelection = useCallback(() => {
    const container = viewportRef.current;
    if (!container) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setBrowserSelection(null);
      return;
    }

    const rawText = sel.toString().trim();
    if (rawText.length < 2) {
      setBrowserSelection(null);
      return;
    }

    const range = sel.getRangeAt(0);
    const commonNode = range.commonAncestorContainer;
    if (!container.contains(commonNode)) {
      setBrowserSelection(null);
      return;
    }

    const anchorElement =
      commonNode.nodeType === Node.ELEMENT_NODE
        ? (commonNode as HTMLElement)
        : commonNode.parentElement;

    if (
      anchorElement?.closest('input, textarea, button, select, .sel-action-bar, .ctx-action-toast')
    ) {
      return;
    }

    let source: BrowserSelectionSource | undefined;
    const serpCard = anchorElement?.closest<HTMLElement>('[data-source-url]');
    if (serpCard) {
      source = {
        url: serpCard.dataset.sourceUrl,
        title: serpCard.dataset.sourceTitle,
        query: currentLoc.kind === 'search' ? currentLoc.query : undefined,
      };
    } else if (currentLoc.kind === 'search') {
      source = {
        query: currentLoc.query,
        title: `Browser research: ${currentLoc.query}`,
      };
    } else if (currentLoc.kind === 'url') {
      source = {
        url: currentLoc.url,
        title: currentLoc.title,
      };
    }

    const rangeRect = range.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();
    const anchorRect =
      rangeRect.width === 0 && rangeRect.height === 0
        ? {
            left: containerRect.left + containerRect.width / 2 - 20,
            top: containerRect.top + 48,
            bottom: containerRect.top + 68,
            width: 40,
          }
        : {
            left: rangeRect.left,
            top: rangeRect.top,
            bottom: rangeRect.bottom,
            width: rangeRect.width,
          };

    const pos = computeFloatingBarPosition(anchorRect, containerRect, {
      width: 430,
      height: 38,
    });

    setBrowserSelection({
      text: rawText,
      x: pos.x,
      y: pos.y,
      placement: pos.placement,
      source,
    });
  }, [currentLoc]);

  return (
    <div className="nx-browser">
      {/* ── 1. BROWSER TAB STRIP ── */}
      <div className="nxb-tabstrip" role="tablist" aria-label="Browser tabs">
        <div className="nxb-tabs-scroll">
          {tabs.map(tab => {
            const loc = tab.history[tab.historyIndex] ?? { kind: 'start' };
            const isActive = tab.id === activeTab.id;
            const isLoading = tab.searchState.status === 'loading';
            const title = getTabTitle(loc);

            return (
              <div
                key={tab.id}
                role="tab"
                aria-selected={isActive}
                className={`nxb-tab ${isActive ? 'is-active' : ''}`}
                onClick={() => setActiveTabId(tab.id)}
                onAuxClick={e => {
                  if (e.button === 1) {
                    e.preventDefault();
                    closeTab(tab.id);
                  }
                }}
                title={title}
              >
                <span className="nxb-tab-icon">
                  {isLoading ? (
                    <RotateCw size={12} className="nxb-spin" />
                  ) : loc.kind === 'url' ? (
                    <ShortcutFavicon url={loc.url} title={loc.title} size={14} />
                  ) : loc.kind === 'search' ? (
                    <Search size={12} />
                  ) : (
                    <Compass size={13} />
                  )}
                </span>
                <span className="nxb-tab-title">{title}</span>
                <button
                  type="button"
                  className="nxb-tab-close"
                  aria-label={`Close ${title}`}
                  onClick={e => {
                    e.stopPropagation();
                    closeTab(tab.id);
                  }}
                >
                  <X size={11} />
                </button>
              </div>
            );
          })}

          <button
            type="button"
            className="nxb-new-tab-btn"
            onClick={() => openNewTab({ kind: 'start' }, true)}
            title="Open new browser tab"
            aria-label="New tab"
          >
            <Plus size={14} />
          </button>
        </div>

        <div className="nxb-strip-tools">
          <button
            type="button"
            className={`nxb-strip-toggle ${prefs.preferExternalTabs ? 'is-on' : ''}`}
            onClick={() => setPrefs(p => ({ ...p, preferExternalTabs: !p.preferExternalTabs }))}
            title="When enabled, clicking bookmarks and links opens them directly in a real external browser tab"
          >
            <ExternalLink size={11} />
            <span>External tabs</span>
          </button>

          <button
            type="button"
            className={`nxb-strip-icon-btn ${prefs.showBookmarksBar ? 'is-on' : ''}`}
            onClick={() => setPrefs(p => ({ ...p, showBookmarksBar: !p.showBookmarksBar }))}
            title={prefs.showBookmarksBar ? 'Hide bookmarks bar' : 'Show bookmarks bar'}
            aria-label="Toggle bookmarks bar"
          >
            <Bookmark size={13} />
          </button>
        </div>
      </div>

      {/* ── 2. NAVIGATION & SMART OMNIBOX BAR ── */}
      <div className="nxb-navbar">
        <div className="nxb-nav-btns">
          <button
            type="button"
            className="nxb-nav-btn"
            disabled={!canGoBack}
            onClick={() => stepHistory(-1)}
            title="Back"
            aria-label="Back"
          >
            <ChevronLeft size={15} />
          </button>
          <button
            type="button"
            className="nxb-nav-btn"
            disabled={!canGoForward}
            onClick={() => stepHistory(1)}
            title="Forward"
            aria-label="Forward"
          >
            <ChevronRight size={15} />
          </button>
          <button
            type="button"
            className="nxb-nav-btn"
            disabled={currentLoc.kind === 'start'}
            onClick={reloadCurrentTab}
            title="Reload"
            aria-label="Reload"
          >
            <RotateCw
              size={13.5}
              className={activeTab.searchState.status === 'loading' ? 'nxb-spin' : ''}
            />
          </button>
          <button
            type="button"
            className="nxb-nav-btn"
            disabled={currentLoc.kind === 'start'}
            onClick={() => navigateTab(activeTab.id, { kind: 'start' })}
            title="Start page"
            aria-label="Start page"
          >
            <Compass size={14} />
          </button>
        </div>

        <form
          className="nxb-omnibox"
          action={shouldUseNativeExternalSearchForm ? activeEngine.formAction : undefined}
          method={shouldUseNativeExternalSearchForm ? 'GET' : undefined}
          target={shouldUseNativeExternalSearchForm ? '_blank' : undefined}
          onSubmit={handleOmniboxSubmit}
        >
          <div className="nxb-omni-prefix">
            {currentLoc.kind === 'url' &&
            activeTab.omniboxDraft === currentLoc.url &&
            currentLoc.url.startsWith('https://') ? (
              <span className="nxb-https-badge" title="Encrypted HTTPS connection">
                <Lock size={11} />
              </span>
            ) : null}

            <select
              className="nxb-engine-select"
              value={prefs.searchEngine}
              onChange={e =>
                setPrefs(p => ({ ...p, searchEngine: e.target.value as SearchEngineId }))
              }
              aria-label="Search engine"
              title="Choose search engine for queries"
            >
              {BROWSER_SEARCH_ENGINES.map(engine => (
                <option key={engine.id} value={engine.id}>
                  {engine.shortLabel}
                </option>
              ))}
            </select>
          </div>

          <input
            ref={omniboxInputRef}
            className="nxb-omni-input"
            name={shouldUseNativeExternalSearchForm ? 'q' : undefined}
            value={activeTab.omniboxDraft}
            onChange={e => setOmniboxDraft(e.target.value)}
            onFocus={e => e.currentTarget.select()}
            placeholder={`Search with ${activeEngine.shortLabel} or enter website URL…`}
            aria-label="Search the web or enter website address"
            spellCheck={false}
            autoComplete="off"
          />

          <div className="nxb-omni-suffix">
            {activeTab.omniboxDraft && (
              <button
                type="button"
                className="nxb-omni-icon-btn"
                onClick={() => {
                  setOmniboxDraft('');
                  omniboxInputRef.current?.focus();
                }}
                aria-label="Clear address bar"
                title="Clear"
              >
                <X size={12} />
              </button>
            )}

            {currentLoc.kind === 'url' && (
              <button
                type="button"
                className={`nxb-omni-icon-btn ${bookmarkedItem ? 'is-bookmarked' : ''}`}
                onClick={toggleBookmarkCurrentUrl}
                aria-label={bookmarkedItem ? 'Remove from Saved links' : 'Save to Saved links'}
                title={bookmarkedItem ? 'Saved in Saved links (click to remove)' : 'Bookmark this site'}
              >
                <Bookmark size={13} fill={bookmarkedItem ? 'currentColor' : 'none'} />
              </button>
            )}

            <button
              type="submit"
              className="nxb-omni-go"
              aria-label="Navigate or search"
              title={
                omniboxIntent?.kind === 'url'
                  ? `Open ${omniboxIntent.url}`
                  : `Search with ${activeEngine.shortLabel}`
              }
            >
              {shouldUseNativeExternalSearchForm ? (
                <ArrowUpRight size={13.5} />
              ) : (
                <ArrowRight size={13.5} />
              )}
            </button>
          </div>
        </form>

        {activeExternalUrl && (
          <a
            href={activeExternalUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="nxb-open-ext-btn"
            title="Open current page or search in a real browser tab"
          >
            <span>New Tab</span>
            <ExternalLink size={12} />
          </a>
        )}
      </div>

      {/* ── 3. BOOKMARKS BAR ── */}
      {prefs.showBookmarksBar && (
        <div className="nxb-bookmarks-bar" role="navigation" aria-label="Saved bookmarks">
          <div className="nxb-bookmarks-list">
            {shortcuts.map(item =>
              prefs.preferExternalTabs ? (
                <a
                  key={item.id}
                  href={item.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="nxb-bm-item"
                  title={`${item.title} (${item.url}) — Opens in new browser tab`}
                >
                  <span className="nxb-bm-favicon">
                    <ShortcutFavicon url={item.url} title={item.title} size={13} />
                  </span>
                  <span className="nxb-bm-label">{item.title}</span>
                  <ArrowUpRight size={10} className="nxb-bm-ext-mark" />
                </a>
              ) : (
                <button
                  key={item.id}
                  type="button"
                  className={`nxb-bm-item ${
                    currentLoc.kind === 'url' && currentLoc.url === item.url ? 'is-current' : ''
                  }`}
                  onClick={e => handleUrlNavigationClick(e, item.url, item.title)}
                  onAuxClick={e => {
                    if (e.button === 1) handleUrlNavigationClick(e, item.url, item.title);
                  }}
                  title={`${item.title} (${item.url}) — Ctrl/Cmd+Click for new tab`}
                >
                  <span className="nxb-bm-favicon">
                    <ShortcutFavicon url={item.url} title={item.title} size={13} />
                  </span>
                  <span className="nxb-bm-label">{item.title}</span>
                </button>
              )
            )}
          </div>

          {settings?.onOpenApp && (
            <button
              type="button"
              className="nxb-bm-manage"
              onClick={() => settings.onOpenApp?.('bookmarks')}
              title="Manage Saved links & shortcuts"
            >
              Manage
            </button>
          )}
        </div>
      )}

      {/* ── 4. BROWSER VIEWPORT ── */}
      <div
        ref={viewportRef}
        className="nxb-viewport"
        onMouseUp={() => window.requestAnimationFrame(evaluateBrowserSelection)}
        onKeyUp={() => window.requestAnimationFrame(evaluateBrowserSelection)}
        onMouseDown={(e) => {
          if (!(e.target as HTMLElement).closest('.sel-action-bar')) {
            setBrowserSelection(null);
          }
        }}
        onScrollCapture={() => {
          if (browserSelection) setBrowserSelection(null);
        }}
      >
        {browserSelection && (
          <SelectionActionBar
            x={browserSelection.x}
            y={browserSelection.y}
            placement={browserSelection.placement}
            ariaLabel="Browser selection actions"
            onDismiss={() => setBrowserSelection(null)}
            actions={[
              {
                id: 'send-scratchpad',
                label: 'Send to Scratchpad',
                icon: <StickyNote size={12} />,
                primary: true,
                title: 'Append selected text with source attribution to active Scratchpad note',
                onSelect: () => {
                  const res = sendSelectionToScratchpad({
                    text: browserSelection.text,
                    mode: 'append-note',
                    source: browserSelection.source,
                    openScratchpad: true,
                  });
                  clearDomSelection();
                  if (res) {
                    showClipFeedback('Sent selection to Scratchpad');
                  }
                },
              },
              {
                id: 'add-task',
                label: 'Add as Task',
                icon: <CheckSquare size={12} />,
                title: 'Turn selected text into a checklist item in Scratchpad',
                onSelect: () => {
                  const res = sendSelectionToScratchpad({
                    text: browserSelection.text,
                    mode: 'append-task',
                    source: browserSelection.source,
                    openScratchpad: true,
                  });
                  clearDomSelection();
                  if (res) {
                    showClipFeedback(
                      res.addedTasks > 1
                        ? `Added ${res.addedTasks} tasks to Scratchpad`
                        : 'Added checklist task to Scratchpad'
                    );
                  }
                },
              },
              {
                id: 'new-note',
                label: 'New Note',
                icon: <Plus size={12} />,
                title: 'Create a new Scratchpad note from selection',
                onSelect: () => {
                  const res = sendSelectionToScratchpad({
                    text: browserSelection.text,
                    mode: 'new-note',
                    source: browserSelection.source,
                    openScratchpad: true,
                  });
                  clearDomSelection();
                  if (res) {
                    showClipFeedback('Created new note in Scratchpad');
                  }
                },
              },
              {
                id: 'research-selection',
                label: 'Research',
                icon: <Sparkles size={12} />,
                title: 'Research selected text in a new Browser tab',
                onSelect: () => {
                  const nextQuery = normalizeResearchQuery(browserSelection.text);
                  clearDomSelection();
                  if (nextQuery) {
                    openNewTab({ kind: 'search', query: nextQuery, engine: 'ai' }, true);
                  }
                },
              },
              {
                id: 'copy-selection',
                label: 'Copy',
                icon: <Copy size={12} />,
                title: 'Copy selected text',
                onSelect: () => {
                  navigator.clipboard?.writeText(browserSelection.text).catch(() => {});
                  clearDomSelection();
                  showClipFeedback('Copied selection');
                },
              },
            ]}
          />
        )}

        {clipFeedback && (
          <div className="ctx-action-toast" role="status" aria-live="polite">
            <Check size={12} />
            <span>{clipFeedback}</span>
            <button
              type="button"
              className="ctx-action-toast-link"
              onClick={() => {
                setClipFeedback(null);
                requestOpenApp('notes', { preferExisting: true });
              }}
            >
              Scratchpad
            </button>
          </div>
        )}
        {/* ══ VIEWPORT A: START PAGE ("NEW TAB") ══ */}
        {currentLoc.kind === 'start' && (
          <div className="nxb-start">
            <div className="nxb-start-inner">
              <header className="nxb-start-hero">
                <span className="eyebrow">Nexus Browser</span>
                <h2>Where would you like to explore?</h2>
              </header>

              {/* Central Search & Address Box */}
              <div className="nxb-start-search-card">
                <form
                  className="nxb-start-form"
                  action={startShouldNativeSubmit ? activeEngine.formAction : undefined}
                  method={startShouldNativeSubmit ? 'GET' : undefined}
                  target={startShouldNativeSubmit ? '_blank' : undefined}
                  onSubmit={handleStartFormSubmit}
                >
                  <Search size={16} className="nxb-start-search-icon" />
                  <input
                    ref={startSearchInputRef}
                    name={startShouldNativeSubmit ? 'q' : undefined}
                    value={startDraft}
                    onChange={e => setStartDraft(e.target.value)}
                    placeholder={
                      prefs.searchEngine === 'ai'
                        ? 'Search the web with Gemini AI or type a URL…'
                        : `Search ${activeEngine.label} or enter a URL…`
                    }
                    aria-label="Search the web or enter a URL"
                    spellCheck={false}
                    autoComplete="off"
                  />
                  <button type="submit" className="primary-btn nxb-start-submit">
                    {startIntent?.kind === 'url' ? (
                      <>
                        Open URL <ArrowRight size={13} />
                      </>
                    ) : startShouldNativeSubmit ? (
                      <>
                        Search {activeEngine.shortLabel} <ArrowUpRight size={13} />
                      </>
                    ) : (
                      <>
                        Search <ArrowRight size={13} />
                      </>
                    )}
                  </button>
                </form>

                {/* Interactive Search Engine Selector Strip */}
                <div className="nxb-engine-pills" role="group" aria-label="Search engine mode">
                  {BROWSER_SEARCH_ENGINES.map(engine => (
                    <button
                      key={engine.id}
                      type="button"
                      className={`nxb-engine-tab ${prefs.searchEngine === engine.id ? 'is-active' : ''}`}
                      onClick={() => setPrefs(p => ({ ...p, searchEngine: engine.id }))}
                    >
                      {engine.id === 'ai' && <Sparkles size={11} />}
                      <span>{engine.shortLabel}</span>
                      {!engine.inTab && <ArrowUpRight size={10} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* Quick Starter Queries */}
              <div className="nxb-starter-queries">
                {STARTER_QUERIES.map(q => (
                  <button
                    key={q}
                    type="button"
                    className="nxb-query-suggestion"
                    onClick={() =>
                      navigateTab(activeTab.id, {
                        kind: 'search',
                        query: q,
                        engine: isServerSearchEngine(prefs.searchEngine) ? prefs.searchEngine : 'ai',
                      })
                    }
                  >
                    <Search size={11} />
                    <span>{q}</span>
                  </button>
                ))}
              </div>

              {/* Speed Dial — Pinned / Saved Links */}
              <section className="nxb-start-section">
                <div className="nxb-section-bar">
                  <strong>Favorites & quick launch</strong>
                  {settings?.onOpenApp && (
                    <button
                      type="button"
                      className="nxb-text-action"
                      onClick={() => settings.onOpenApp?.('bookmarks')}
                    >
                      Edit shortcuts
                    </button>
                  )}
                </div>

                <div className="nxb-speed-dial">
                  {shortcuts.slice(0, 8).map(item => {
                    const host = extractHostname(item.url) || item.url;
                    return (
                      <div key={item.id} className="nxb-dial-tile">
                        {prefs.preferExternalTabs ? (
                          <a
                            href={item.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="nxb-dial-main"
                          >
                            <span className="nxb-dial-icon">
                              <ShortcutFavicon url={item.url} title={item.title} size={22} />
                            </span>
                            <span className="nxb-dial-copy">
                              <strong>{item.title}</strong>
                              <small>{host}</small>
                            </span>
                          </a>
                        ) : (
                          <button
                            type="button"
                            className="nxb-dial-main"
                            onClick={e => handleUrlNavigationClick(e, item.url, item.title)}
                            onAuxClick={e => {
                              if (e.button === 1) handleUrlNavigationClick(e, item.url, item.title);
                            }}
                          >
                            <span className="nxb-dial-icon">
                              <ShortcutFavicon url={item.url} title={item.title} size={22} />
                            </span>
                            <span className="nxb-dial-copy">
                              <strong>{item.title}</strong>
                              <small>{host}</small>
                            </span>
                          </button>
                        )}

                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="nxb-dial-ext"
                          title={`Open ${item.title} in a real browser tab`}
                          aria-label={`Open ${item.title} in new browser tab`}
                        >
                          <ArrowUpRight size={12} />
                        </a>
                      </div>
                    );
                  })}
                </div>
              </section>

              {/* Recent Searches & Visited Sites */}
              {recentHistory.length > 0 && (
                <section className="nxb-start-section">
                  <div className="nxb-section-bar">
                    <strong>Recent activity</strong>
                    <button
                      type="button"
                      className="nxb-text-action"
                      onClick={() => setRecentHistory([])}
                    >
                      <Trash2 size={11} /> Clear
                    </button>
                  </div>

                  <div className="nxb-recent-list">
                    {recentHistory.slice(0, 6).map(entry => {
                      const extHref =
                        entry.kind === 'url'
                          ? entry.value
                          : getSearchEngine(
                              entry.engine && !isServerSearchEngine(entry.engine)
                                ? entry.engine
                                : 'google'
                            ).buildUrl(entry.value);
                      return (
                        <div key={entry.id} className="nxb-recent-row">
                          <button
                            type="button"
                            className="nxb-recent-open"
                            onClick={() => {
                              if (entry.kind === 'url') {
                                navigateTab(activeTab.id, {
                                  kind: 'url',
                                  url: entry.value,
                                  title: entry.title,
                                });
                              } else {
                                navigateTab(activeTab.id, {
                                  kind: 'search',
                                  query: entry.value,
                                  engine: entry.engine ?? prefs.searchEngine,
                                });
                              }
                            }}
                          >
                            <span className="nxb-recent-icon">
                              {entry.kind === 'url' ? (
                                <ShortcutFavicon
                                  url={entry.value}
                                  title={entry.title}
                                  size={14}
                                />
                              ) : (
                                <Search size={13} />
                              )}
                            </span>
                            <span className="nxb-recent-title">{entry.title}</span>
                            <span className="nxb-recent-meta">
                              {entry.kind === 'url'
                                ? extractHostname(entry.value)
                                : `Search · ${getSearchEngine(entry.engine ?? 'ai').shortLabel}`}
                            </span>
                          </button>

                          <div className="nxb-recent-actions">
                            <button
                              type="button"
                              className="nxb-mini-btn"
                              onClick={() => {
                                if (entry.kind === 'url') {
                                  openNewTab(
                                    { kind: 'url', url: entry.value, title: entry.title },
                                    true
                                  );
                                } else {
                                  openNewTab(
                                    {
                                      kind: 'search',
                                      query: entry.value,
                                      engine: entry.engine ?? prefs.searchEngine,
                                    },
                                    true
                                  );
                                }
                              }}
                              title="Open in new workspace tab"
                            >
                              <Plus size={11} /> Tab
                            </button>
                            <a
                              href={extHref}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="nxb-mini-btn"
                              title="Open in real browser tab"
                            >
                              <ExternalLink size={11} />
                            </a>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </section>
              )}
            </div>
          </div>
        )}

        {/* ══ VIEWPORT B: SEARCH RESULTS VIEW ══ */}
        {currentLoc.kind === 'search' && (
          <div className="nxb-search-view">
            {/* Search Mode & Cross-Engine Switcher Subbar */}
            <div className="nxb-search-subbar">
              <div className="nxb-search-modes" role="group" aria-label="Search view mode">
                <button
                  type="button"
                  className={`nxb-smode-btn ${currentLoc.engine === 'ai' ? 'is-active' : ''}`}
                  onClick={() => {
                    if (currentLoc.engine !== 'ai') {
                      navigateTab(activeTab.id, {
                        kind: 'search',
                        query: currentLoc.query,
                        engine: 'ai',
                      });
                    }
                  }}
                >
                  <Sparkles size={11} /> Gemini + Web
                </button>
                <button
                  type="button"
                  className={`nxb-smode-btn ${currentLoc.engine === 'web' ? 'is-active' : ''}`}
                  onClick={() => {
                    if (currentLoc.engine !== 'web') {
                      navigateTab(activeTab.id, {
                        kind: 'search',
                        query: currentLoc.query,
                        engine: 'web',
                      });
                    }
                  }}
                >
                  Web Results
                </button>
                <button
                  type="button"
                  className={`nxb-smode-btn ${currentLoc.engine === 'bing' ? 'is-active' : ''}`}
                  onClick={() =>
                    navigateTab(activeTab.id, {
                      kind: 'search',
                      query: currentLoc.query,
                      engine: 'bing',
                    })
                  }
                >
                  Bing
                </button>
                <button
                  type="button"
                  className={`nxb-smode-btn ${currentLoc.engine === 'wikipedia' ? 'is-active' : ''}`}
                  onClick={() =>
                    navigateTab(activeTab.id, {
                      kind: 'search',
                      query: currentLoc.query,
                      engine: 'wikipedia',
                    })
                  }
                >
                  Wikipedia
                </button>
              </div>

              <div className="nxb-ext-engines">
                <span>Open in tab:</span>
                {(['google', 'duckduckgo', 'brave'] as const).map(engId => {
                  const eng = getSearchEngine(engId);
                  return (
                    <a
                      key={engId}
                      href={eng.buildUrl(currentLoc.query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="nxb-ext-engine-link"
                    >
                      {eng.shortLabel} <ArrowUpRight size={10} />
                    </a>
                  );
                })}
              </div>
            </div>

            {/* In-tab embedded search engines (Wikipedia / Bing) */}
            {(currentLoc.engine === 'wikipedia' || currentLoc.engine === 'bing') && (
              <div className="nxb-frame-wrap">
                <iframe
                  key={`${currentLoc.engine}-${currentLoc.query}-${activeTab.reloadNonce}`}
                  className="web-frame"
                  title={`${getSearchEngine(currentLoc.engine).label}: ${currentLoc.query}`}
                  src={getSearchEngine(currentLoc.engine).buildUrl(currentLoc.query)}
                  sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                  referrerPolicy="strict-origin-when-cross-origin"
                />
                <div className="web-app-footer">
                  <span>
                    Showing {getSearchEngine(currentLoc.engine).label} results for “{currentLoc.query}”
                  </span>
                  <a
                    href={getSearchEngine(currentLoc.engine).buildUrl(currentLoc.query)}
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <ExternalLink size={11} /> Open in browser tab
                  </a>
                </div>
              </div>
            )}

            {/* External Browser Search Engine Launchpad (Google / DuckDuckGo / Brave) */}
            {!getSearchEngine(currentLoc.engine).inTab && (
              <div className="nxb-engine-launchpad">
                <div className="nxb-launchpad-inner">
                  <span className="eyebrow">
                    {getSearchEngine(currentLoc.engine).label}
                  </span>
                  <h3>“{currentLoc.query}”</h3>
                  <p>
                    {getSearchEngine(currentLoc.engine).shortLabel} opens in a full browser tab so
                    all search filters, maps, and account preferences work without frame restrictions.
                  </p>

                  <div className="nxb-launchpad-actions">
                    <a
                      href={getSearchEngine(currentLoc.engine).buildUrl(currentLoc.query)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn swa-ext-link"
                    >
                      Open {getSearchEngine(currentLoc.engine).shortLabel} results{' '}
                      <ArrowUpRight size={13} />
                    </a>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() =>
                        navigateTab(activeTab.id, {
                          kind: 'search',
                          query: currentLoc.query,
                          engine: 'ai',
                        })
                      }
                    >
                      <Sparkles size={12} /> Search here with Gemini + Web
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Gemini + Live Web Search SERP View */}
            {isServerSearchEngine(currentLoc.engine) && (
              <div className="nxb-ai-results-scroll">
                <div className="nxb-ai-container">
                  <div className="nxb-ai-query-head">
                    <span className="eyebrow">
                      {currentLoc.engine === 'ai' ? 'Gemini AI + Live Web Search' : 'Live Web Search'}
                    </span>
                    <h3>{currentLoc.query}</h3>
                  </div>

                  {/* Loading Skeleton */}
                  {activeTab.searchState.status === 'loading' && (
                    <div className="nxb-ai-skeleton" aria-live="polite">
                      <div className="nxb-skel-line nxb-skel-w90" />
                      <div className="nxb-skel-line nxb-skel-w100" />
                      <div className="nxb-skel-line nxb-skel-w78" />
                      <div className="nxb-skel-gap" />
                      <div className="nxb-skel-line nxb-skel-w94" />
                      <div className="nxb-skel-line nxb-skel-w65" />
                    </div>
                  )}

                  {/* Error State */}
                  {activeTab.searchState.status === 'error' && (
                    <div className="nxb-ai-error" role="alert">
                      <strong>Couldn’t complete search</strong>
                      <p>{activeTab.searchState.errorMessage}</p>
                      <div className="nxb-ai-error-actions">
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() =>
                            void executeServerSearch(
                              activeTab.id,
                              currentLoc.query,
                              currentLoc.engine === 'web' ? 'web' : 'ai'
                            )
                          }
                        >
                          <RotateCw size={12} /> Try again
                        </button>
                        <a
                          href={getSearchEngine('google').buildUrl(currentLoc.query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="primary-btn swa-ext-link"
                        >
                          Search on Google <ArrowUpRight size={12} />
                        </a>
                        <a
                          href={getSearchEngine('duckduckgo').buildUrl(currentLoc.query)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="secondary-btn swa-ext-link"
                        >
                          DuckDuckGo <ArrowUpRight size={12} />
                        </a>
                      </div>
                    </div>
                  )}

                  {/* Populated Search Results */}
                  {activeTab.searchState.status === 'ready' && (
                    <>
                      {activeTab.searchState.aiNotice && (
                        <p className="nxb-ai-notice">{activeTab.searchState.aiNotice}</p>
                      )}

                      {/* Gemini AI Overview Block */}
                      {currentLoc.engine === 'ai' && activeTab.searchState.answer && (
                        <section className="nxb-ai-overview-card">
                          <div className="nxb-overview-head">
                            <Sparkles size={13} />
                            <strong>AI Overview</strong>
                            <span>Synthesized with Gemini from live web results</span>
                            <button
                              type="button"
                              className="nxb-mini-btn nxb-overview-clip-btn"
                              onClick={() => {
                                const res = sendSelectionToScratchpad({
                                  text: activeTab.searchState.answer,
                                  mode: 'append-note',
                                  source: {
                                    query: currentLoc.query,
                                    title: `AI Overview: ${currentLoc.query}`,
                                  },
                                  openScratchpad: true,
                                });
                                if (res) {
                                  showClipFeedback('Saved AI Overview to Scratchpad');
                                }
                              }}
                              title="Send full AI Overview to Scratchpad"
                            >
                              <StickyNote size={11} /> Save to Scratchpad
                            </button>
                          </div>
                          <SearchMarkdown markdown={activeTab.searchState.answer} />
                        </section>
                      )}

                      {/* Organic Web Search Results List (SERP) */}
                      {activeTab.searchState.sources.length > 0 && (
                        <section className="nxb-sources-section">
                          <div className="nxb-section-bar">
                            <strong>
                              Web results · {activeTab.searchState.sources.length}
                            </strong>
                            <span className="nxb-muted-note">
                              Select any text for Scratchpad or task actions
                            </span>
                          </div>

                          <div className="nxb-serp-list">
                            {activeTab.searchState.sources.map(src => (
                              <article
                                key={src.url}
                                className="nxb-serp-item"
                                data-source-url={src.url}
                                data-source-title={src.title}
                              >
                                <div className="nxb-serp-top">
                                  <div className="nxb-serp-site">
                                    <span className="nxb-source-favicon">
                                      <ShortcutFavicon
                                        url={src.url}
                                        title={src.title}
                                        size={15}
                                      />
                                    </span>
                                    <div className="nxb-serp-site-meta">
                                      <strong>{src.domain}</strong>
                                      <span>{formatUrlBreadcrumb(src.url)}</span>
                                    </div>
                                  </div>

                                  <div className="nxb-source-actions">
                                    <button
                                      type="button"
                                      className="nxb-mini-btn"
                                      onClick={() =>
                                        openNewTab(
                                          { kind: 'url', url: src.url, title: src.title },
                                          true
                                        )
                                      }
                                      title="Open in a new Nexus Browser tab"
                                    >
                                      <Plus size={11} /> Tab
                                    </button>
                                    <a
                                      href={src.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="nxb-mini-btn nxb-mini-btn--primary"
                                      title="Open in a real external browser tab"
                                    >
                                      New tab <ExternalLink size={11} />
                                    </a>
                                  </div>
                                </div>

                                <a
                                  href={src.url}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="nxb-serp-title"
                                >
                                  {src.title}
                                </a>

                                {src.snippet && (
                                  <p className="nxb-serp-snippet">{src.snippet}</p>
                                )}
                              </article>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Related Search Queries */}
                      {activeTab.searchState.relatedQueries.length > 0 && (
                        <section className="nxb-related-section">
                          <div className="nxb-section-bar">
                            <strong>Related searches</strong>
                          </div>
                          <div className="nxb-related-list">
                            {activeTab.searchState.relatedQueries.map(rq => (
                              <button
                                key={rq}
                                type="button"
                                className="nxb-query-suggestion"
                                onClick={() =>
                                  navigateTab(
                                    activeTab.id,
                                    { kind: 'search', query: rq, engine: currentLoc.engine },
                                    activeTab.searchState.turns
                                  )
                                }
                              >
                                <Search size={11} />
                                <span>{rq}</span>
                              </button>
                            ))}
                          </div>
                        </section>
                      )}

                      {/* Follow-up Search Bar */}
                      <form
                        className="nxb-followup-form"
                        onSubmit={e => {
                          e.preventDefault();
                          const nextQ = followUpInput.trim();
                          if (!nextQ) return;
                          setFollowUpInput('');
                          navigateTab(
                            activeTab.id,
                            { kind: 'search', query: nextQ, engine: currentLoc.engine },
                            activeTab.searchState.turns
                          );
                        }}
                      >
                        <input
                          value={followUpInput}
                          onChange={e => setFollowUpInput(e.target.value)}
                          placeholder="Ask a follow-up question or search another topic…"
                          aria-label="Follow-up search query"
                        />
                        <button
                          type="submit"
                          className="secondary-btn"
                          disabled={!followUpInput.trim()}
                        >
                          Search <ArrowRight size={12} />
                        </button>
                      </form>
                    </>
                  )}
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══ VIEWPORT C: WEB URL VIEW ══ */}
        {currentLoc.kind === 'url' && (() => {
          const host = extractHostname(currentLoc.url) || currentLoc.url;
          const restrictedByDefault = isKnownFrameRestricted(currentLoc.url);
          const showExternalCard =
            forceExternalCardUrls[currentLoc.url] ||
            (prefs.preferExternalTabs && !forceEmbedUrls[currentLoc.url]) ||
            (restrictedByDefault && !forceEmbedUrls[currentLoc.url]);

          if (showExternalCard) {
            return (
              <div className="nxb-url-launchpad">
                <div className="nxb-url-card">
                  <div className="swa-hero-tile">
                    <ShortcutFavicon
                      url={currentLoc.url}
                      title={currentLoc.title}
                      size={34}
                    />
                  </div>
                  <h3>{currentLoc.title}</h3>
                  <p className="nxb-url-display">{currentLoc.url}</p>
                  <p className="nxb-url-desc">
                    {restrictedByDefault
                      ? `${host} restricts embedded frames for security and sign-in protection. Open it in a full browser tab for complete functionality.`
                      : 'Ready to launch in a full browser tab, or preview directly inside this window.'}
                  </p>

                  <div className="nxb-launchpad-actions">
                    <a
                      href={currentLoc.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="primary-btn swa-ext-link"
                    >
                      Open in new browser tab <ExternalLink size={13} />
                    </a>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => copyToClipboard(currentLoc.url)}
                    >
                      {copiedUrl === currentLoc.url ? (
                        <>
                          <Check size={12} /> Copied URL
                        </>
                      ) : (
                        <>
                          <Copy size={12} /> Copy URL
                        </>
                      )}
                    </button>

                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => {
                        setForceExternalCardUrls(prev => ({
                          ...prev,
                          [currentLoc.url]: false,
                        }));
                        setForceEmbedUrls(prev => ({
                          ...prev,
                          [currentLoc.url]: true,
                        }));
                      }}
                    >
                      <Globe2 size={12} /> Load inside window
                    </button>
                  </div>
                </div>
              </div>
            );
          }

          return (
            <div className="nxb-frame-wrap">
              <iframe
                key={`${currentLoc.url}-${activeTab.reloadNonce}`}
                className="web-frame"
                title={currentLoc.title}
                src={currentLoc.url}
                sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
                referrerPolicy="strict-origin-when-cross-origin"
              />
              <div className="web-app-footer">
                <span>{host}</span>
                <button
                  type="button"
                  onClick={() =>
                    openNewTab(
                      { kind: 'url', url: currentLoc.url, title: currentLoc.title },
                      true
                    )
                  }
                >
                  Duplicate tab
                </button>
                <button
                  type="button"
                  onClick={() =>
                    setForceExternalCardUrls(prev => ({ ...prev, [currentLoc.url]: true }))
                  }
                >
                  Page refused to connect?
                </button>
                <a href={currentLoc.url} target="_blank" rel="noopener noreferrer">
                  <ExternalLink size={11} /> Open in browser tab
                </a>
              </div>
            </div>
          );
        })()}
      </div>
    </div>
  );
}
