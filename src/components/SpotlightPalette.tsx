import {
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  AppWindow,
  Calculator,
  Check,
  CheckSquare,
  Clock,
  CloudRain,
  Columns2,
  CornerDownLeft,
  Download,
  ExternalLink,
  FilePlus2,
  Globe2,
  Headphones,
  History,
  Image,
  Layers,
  LayoutGrid,
  Lock,
  Maximize2,
  MessageSquareQuote,
  Minimize2,
  Moon,
  Move,
  PanelLeft,
  PanelRight,
  Pause,
  Play,
  RotateCcw,
  Search,
  SkipBack,
  SkipForward,
  Sparkles,
  StickyNote,
  Sun,
  Timer,
  Volume2,
  X,
  Zap,
} from 'lucide-react';
import type { AppDefinition } from '../apps/app-types';
import { AppIconGraphic } from './ShortcutFavicon';
import {
  getMusicState,
  readYouTubeHistory,
  readYouTubeWatchLater,
  subscribeMusicState,
  type MediaTrack,
} from '../data/media';
import { readNotesState, type ScratchpadNote } from '../data/notes';
import {
  buildSpotlightResults,
  type SpotlightCommandPayload,
  type SpotlightFilter,
  type SpotlightIconKind,
  type SpotlightItem,
} from '../spotlight/spotlight-engine';
import type { DesktopSpace } from '../data/spaces';
import {
  describeActiveSoundscape,
  getAllSoundscapePresets,
  getSoundscapeState,
  isSoundscapeAudiblyPlaying,
  subscribeSoundscapeState,
} from '../data/soundscape';
import { getFocusState, subscribeFocusState } from '../data/focus';
import type { DesktopWindow } from '../window-manager/types';

export interface SpotlightPaletteProps {
  apps: AppDefinition[];
  windows: DesktopWindow[];
  activeWindowId: string | null;
  theme: 'light' | 'dark';
  wallpaper: string;
  wallpapers: readonly { id: string; name: string }[];
  arrangeMode: boolean;
  showSeconds: boolean;
  showMessages: boolean;
  restoreSession: boolean;
  hasPassword: boolean;
  versionTag: string;
  spaces?: DesktopSpace[];
  activeSpaceId?: string;
  onExecute: (command: SpotlightCommandPayload) => void;
  onClose: () => void;
}

const FILTER_TABS: Array<{ id: SpotlightFilter; label: string }> = [
  { id: 'all', label: 'All' },
  { id: 'apps', label: 'Apps' },
  { id: 'notes', label: 'Notes' },
  { id: 'windows', label: 'Windows' },
  { id: 'actions', label: 'Commands' },
];

function SpotlightRowIcon({
  item,
  theme,
}: {
  item: SpotlightItem;
  theme: 'light' | 'dark';
}) {
  if (item.iconKind === 'app' && item.app) {
    const toneClass = item.app.shortcut ? 'icon-shortcut' : `icon-${item.app.id}`;
    return (
      <span className={`sp-cmd-icon is-app ${toneClass}`}>
        <AppIconGraphic app={item.app} size={18} />
      </span>
    );
  }

  if (item.iconKind === 'wallpaper' && item.wallpaperSwatchId) {
    return (
      <span className="sp-cmd-icon is-swatch">
        <span className={`wallpaper-swatch swatch-${item.wallpaperSwatchId}`} />
      </span>
    );
  }

  const renderGlyph = (kind: SpotlightIconKind) => {
    switch (kind) {
      case 'window':
        return <AppWindow size={15} strokeWidth={1.6} />;
      case 'note':
        return <StickyNote size={15} strokeWidth={1.6} />;
      case 'note-new':
        return <FilePlus2 size={15} strokeWidth={1.6} />;
      case 'checklist':
        return <CheckSquare size={15} strokeWidth={1.6} />;
      case 'calculator':
        return <Calculator size={15} strokeWidth={1.6} />;
      case 'sparkles':
        return <Sparkles size={15} strokeWidth={1.6} />;
      case 'globe':
        return <Globe2 size={15} strokeWidth={1.6} />;
      case 'external':
        return <ExternalLink size={15} strokeWidth={1.6} />;
      case 'youtube':
      case 'play':
        return <Play size={15} strokeWidth={1.6} />;
      case 'music':
        return <Headphones size={15} strokeWidth={1.6} />;
      case 'pause':
        return <Pause size={15} strokeWidth={1.6} />;
      case 'skip-next':
        return <SkipForward size={15} strokeWidth={1.6} />;
      case 'skip-prev':
        return <SkipBack size={15} strokeWidth={1.6} />;
      case 'volume':
        return <Volume2 size={15} strokeWidth={1.6} />;
      case 'tile-left':
        return <PanelLeft size={15} strokeWidth={1.6} />;
      case 'tile-right':
        return <PanelRight size={15} strokeWidth={1.6} />;
      case 'maximize':
        return <Maximize2 size={15} strokeWidth={1.6} />;
      case 'restore':
        return <Columns2 size={15} strokeWidth={1.6} />;
      case 'minimize':
        return <Minimize2 size={15} strokeWidth={1.6} />;
      case 'close':
        return <X size={15} strokeWidth={1.6} />;
      case 'theme':
        return theme === 'dark' ? (
          <Sun size={15} strokeWidth={1.6} />
        ) : (
          <Moon size={15} strokeWidth={1.6} />
        );
      case 'wallpaper':
        return <Image size={15} strokeWidth={1.6} />;
      case 'arrange':
        return <Move size={15} strokeWidth={1.6} />;
      case 'clock':
        return <Clock size={15} strokeWidth={1.6} />;
      case 'message':
        return <MessageSquareQuote size={15} strokeWidth={1.6} />;
      case 'session':
        return <RotateCcw size={15} strokeWidth={1.6} />;
      case 'download':
        return <Download size={15} strokeWidth={1.6} />;
      case 'changelog':
        return <History size={15} strokeWidth={1.6} />;
      case 'lock':
        return <Lock size={15} strokeWidth={1.6} />;
      case 'launcher':
        return <LayoutGrid size={15} strokeWidth={1.6} />;
      case 'spaces':
        return <Layers size={15} strokeWidth={1.6} />;
      case 'soundscape':
        return <CloudRain size={15} strokeWidth={1.6} />;
      case 'focus':
        return <Timer size={15} strokeWidth={1.6} />;
      case 'stash':
        return <Zap size={15} strokeWidth={1.6} />;
      default:
        return <Search size={15} strokeWidth={1.6} />;
    }
  };

  return (
    <span className={`sp-cmd-icon is-glyph kind-${item.iconKind}`}>
      {renderGlyph(item.iconKind)}
    </span>
  );
}

export function SpotlightPalette({
  apps,
  windows,
  activeWindowId,
  theme,
  wallpaper,
  wallpapers,
  arrangeMode,
  showSeconds,
  showMessages,
  restoreSession,
  hasPassword,
  versionTag,
  spaces,
  activeSpaceId,
  onExecute,
  onClose,
}: SpotlightPaletteProps) {
  const music = useSyncExternalStore(subscribeMusicState, getMusicState);
  const soundscape = useSyncExternalStore(subscribeSoundscapeState, getSoundscapeState);
  const focus = useSyncExternalStore(subscribeFocusState, getFocusState);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<SpotlightFilter>('all');
  const [activeIdx, setActiveIdx] = useState(0);
  const [notes, setNotes] = useState<ScratchpadNote[]>(() => readNotesState().notes);
  const [youtubeHistory, setYoutubeHistory] = useState<MediaTrack[]>(readYouTubeHistory);
  const [youtubeWatchLater, setYoutubeWatchLater] = useState<MediaTrack[]>(readYouTubeWatchLater);
  const [copiedMathValue, setCopiedMathValue] = useState<string | null>(null);

  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const syncStorage = () => {
      setNotes(readNotesState().notes);
      setYoutubeHistory(readYouTubeHistory());
      setYoutubeWatchLater(readYouTubeWatchLater());
    };
    window.addEventListener('storage', syncStorage);
    return () => window.removeEventListener('storage', syncStorage);
  }, []);

  const results = useMemo(
    () =>
      buildSpotlightResults({
        query,
        filter,
        apps,
        windows,
        activeWindowId,
        notes,
        theme,
        wallpaper,
        wallpapers,
        arrangeMode,
        showSeconds,
        showMessages,
        restoreSession,
        hasPassword,
        versionTag,
        youtubeHistory,
        youtubeWatchLater,
        musicHistory: music.history,
        musicLiked: music.liked,
        musicCurrent: music.current,
        musicIsPlaying: music.isPlaying,
        musicIsMuted: music.isMuted,
        spaces,
        activeSpaceId,
        soundscapeIsPlaying: isSoundscapeAudiblyPlaying(soundscape),
        soundscapeSummary: describeActiveSoundscape(soundscape),
        soundscapePresets: getAllSoundscapePresets(soundscape),
        focusState: focus,
      }),
    [
      activeSpaceId,
      activeWindowId,
      apps,
      arrangeMode,
      filter,
      focus,
      hasPassword,
      music.current,
      music.history,
      music.isMuted,
      music.isPlaying,
      music.liked,
      notes,
      query,
      restoreSession,
      showMessages,
      showSeconds,
      soundscape,
      spaces,
      theme,
      versionTag,
      wallpaper,
      wallpapers,
      windows,
      youtubeHistory,
      youtubeWatchLater,
    ]
  );

  const clampedIdx =
    results.items.length > 0 ? Math.min(activeIdx, results.items.length - 1) : -1;

  useEffect(() => {
    if (clampedIdx < 0 || !listRef.current) return;
    const el = listRef.current.querySelector<HTMLElement>(
      `[data-spotlight-idx="${clampedIdx}"]`
    );
    el?.scrollIntoView({ block: 'nearest' });
  }, [clampedIdx]);

  const triggerItem = (item: SpotlightItem) => {
    if (item.command.type === 'copy-math') {
      const formatted = item.command.formattedValue;
      navigator.clipboard?.writeText(item.command.rawValue).catch(() => {});
      setCopiedMathValue(formatted);
      window.setTimeout(() => {
        setCopiedMathValue((prev) => (prev === formatted ? null : prev));
      }, 1500);
      return;
    }
    onExecute(item.command);
  };

  const handleKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      const idx = FILTER_TABS.findIndex((t) => t.id === filter);
      const nextIdx = e.shiftKey
        ? (idx - 1 + FILTER_TABS.length) % FILTER_TABS.length
        : (idx + 1) % FILTER_TABS.length;
      setFilter(FILTER_TABS[nextIdx].id);
      setActiveIdx(0);
      inputRef.current?.focus();
      return;
    }

    if (results.items.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveIdx((i) => (Math.min(i, results.items.length - 1) + 1) % results.items.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveIdx((i) =>
        (Math.min(i, results.items.length - 1) - 1 + results.items.length) %
        results.items.length
      );
    } else if (e.key === 'Home') {
      e.preventDefault();
      setActiveIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setActiveIdx(results.items.length - 1);
    } else if (e.key === 'Enter') {
      const chosen = results.items[clampedIdx];
      if (chosen) {
        e.preventDefault();
        triggerItem(chosen);
      }
    }
  };

  /* Build fast lookup from item id -> flat index for keyboard highlight */
  const flatIndexMap = useMemo(() => {
    const map = new Map<string, number>();
    results.items.forEach((item, index) => {
      map.set(item.id, index);
    });
    return map;
  }, [results.items]);

  const activeItemId =
    clampedIdx >= 0 && results.items[clampedIdx]
      ? `spotlight-opt-${results.items[clampedIdx].id}`
      : undefined;

  return (
    <div
      className="spotlight-scrim"
      role="presentation"
      onMouseDown={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
      onClick={(e) => e.stopPropagation()}
    >
      <section
        className="spotlight-modal"
        role="dialog"
        aria-modal="true"
        aria-label="Spotlight command palette"
        onKeyDown={handleKeyDown}
      >
        {/* Search Input Header */}
        <div className="spotlight-input-row">
          <Search size={17} strokeWidth={1.7} className="spotlight-search-glyph" />
          <input
            ref={inputRef}
            type="text"
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="spotlight-results-listbox"
            aria-activedescendant={activeItemId}
            aria-autocomplete="list"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIdx(0);
              setCopiedMathValue(null);
            }}
            placeholder="Search apps, notes, media (yt / music …), windows, or calculate…"
            aria-label="Search workspace commands, apps, media, and notes"
          />
          {query && (
            <button
              type="button"
              className="spotlight-clear-btn"
              onClick={() => {
                setQuery('');
                setActiveIdx(0);
                inputRef.current?.focus();
              }}
              aria-label="Clear search query"
            >
              <X size={12} />
            </button>
          )}
          <button
            type="button"
            className="spotlight-esc-btn"
            onClick={onClose}
            aria-label="Close command palette"
          >
            <kbd>Esc</kbd>
          </button>
        </div>

        {/* Interactive Category Filter Tabs */}
        <div className="spotlight-filter-bar">
          <div className="spotlight-tabs" role="tablist" aria-label="Result categories">
            {FILTER_TABS.map((tab) => {
              const count = results.counts[tab.id];
              const isSelected = filter === tab.id;
              return (
                <button
                  key={tab.id}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  className={isSelected ? 'is-active' : ''}
                  onClick={() => {
                    setFilter(tab.id);
                    setActiveIdx(0);
                    inputRef.current?.focus();
                  }}
                >
                  <span>{tab.label}</span>
                  <span className="spotlight-tab-count">{count}</span>
                </button>
              );
            })}
          </div>
          <span className="spotlight-tab-hint">
            <kbd>Tab</kbd> to switch filter
          </span>
        </div>

        {/* Grouped Results List */}
        <div
          id="spotlight-results-listbox"
          ref={listRef}
          className="spotlight-list"
          role="listbox"
          aria-label="Command palette results"
        >
          {results.sections.map((section) => (
            <div className="spotlight-section" key={section.id}>
              <div className="spotlight-section-heading">{section.label}</div>
              {section.items.map((item) => {
                const idx = flatIndexMap.get(item.id) ?? 0;
                const isSelected = idx === clampedIdx;
                const isMathCopied =
                  item.command.type === 'copy-math' &&
                  copiedMathValue === item.command.formattedValue;

                return (
                  <button
                    key={item.id}
                    id={`spotlight-opt-${item.id}`}
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    data-spotlight-idx={idx}
                    className={`spotlight-row ${isSelected ? 'is-active' : ''} ${
                      item.section === 'math' ? 'is-math-row' : ''
                    }`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => triggerItem(item)}
                  >
                    <SpotlightRowIcon item={item} theme={theme} />
                    <span className="spotlight-row-copy">
                      <span className="spotlight-row-title">{item.title}</span>
                      <span className="spotlight-row-sub">{item.subtitle}</span>
                    </span>
                    <span className="spotlight-row-meta">
                      {item.shortcutKeys && item.shortcutKeys.length > 0 && (
                        <span className="spotlight-keys" aria-hidden="true">
                          {item.shortcutKeys.map((k, kIdx) => (
                            <kbd key={kIdx}>{k}</kbd>
                          ))}
                        </span>
                      )}
                      <span
                        className={`spotlight-action-hint ${
                          isMathCopied ? 'is-copied' : ''
                        }`}
                      >
                        {isMathCopied ? (
                          <>
                            <Check size={11} /> Copied
                          </>
                        ) : (
                          item.actionLabel
                        )}
                      </span>
                    </span>
                  </button>
                );
              })}
            </div>
          ))}

          {results.items.length === 0 && (
            <div className="spotlight-empty">
              <strong>No matching results in {FILTER_TABS.find((t) => t.id === filter)?.label}</strong>
              <span>
                {filter !== 'all'
                  ? 'Switch back to All results or try another keyword.'
                  : 'Try searching for an app, Scratchpad note, wallpaper, or math expression.'}
              </span>
              {filter !== 'all' && (
                <button
                  type="button"
                  className="spotlight-empty-reset"
                  onClick={() => {
                    setFilter('all');
                    setActiveIdx(0);
                    inputRef.current?.focus();
                  }}
                >
                  Show all categories
                </button>
              )}
            </div>
          )}
        </div>

        {/* Quiet Editorial Footer */}
        <footer className="spotlight-footer">
          <div className="spotlight-footer-shortcuts">
            <span>
              <kbd>↑</kbd>
              <kbd>↓</kbd> Navigate
            </span>
            <span>
              <kbd>
                <CornerDownLeft size={10} />
              </kbd>{' '}
              Select
            </span>
            <span>
              <kbd>Esc</kbd> Dismiss
            </span>
          </div>
          <span className="spotlight-footer-meta">Spotlight · {versionTag}</span>
        </footer>
      </section>
    </div>
  );
}
