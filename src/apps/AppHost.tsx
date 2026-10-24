import { useEffect, useMemo, useRef, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowUpRight, Check, Copy, Crosshair, Download, ExternalLink,
  Globe2, HardDriveDownload, MessageSquareQuote, Monitor, Palette, Pencil, Pin, Plus, RefreshCw, RotateCcw, Search, Shield, Trash2, Upload, X,
} from 'lucide-react';
import type { AppId, CoreAppId } from '../window-manager/types';
import type { DesktopMessage } from '../data/messages';
import type { WidgetDefinition, WidgetSource } from '../widgets/types';
import { createWidget } from '../widgets/types';
import { WidgetRuntime } from '../widgets/WidgetRuntime';
import { instantiateTemplate, WIDGET_API_ENTRIES, WIDGET_TEMPLATES } from '../widgets/templates';
import {
  extractHostname,
  fromShortcutAppId,
  isShortcutAppId,
  normalizeHttpUrl,
  readShortcuts,
  saveShortcuts,
  suggestTitleFromUrl,
  toShortcutAppId,
  type SavedShortcut,
  type ShortcutLaunchMode,
} from '../data/shortcuts';
import { ShortcutFavicon } from '../components/ShortcutFavicon';
import { BrowserApp } from './BrowserApp';
import { ScratchpadApp } from './ScratchpadApp';
import { NEXUS_VERSION } from '../data/version';

/* ── SettingsProps — aligned with App.tsx ─────────────────────────────────── */
export interface SettingsProps {
  theme: 'light' | 'dark';
  wallpaper: 'mist' | 'aurora' | 'dusk' | 'forest' | 'ocean' | 'ember' | 'lavender' | 'midnight' | 'rose' | 'mono' | 'citrus' | 'glacier';
  showSeconds: boolean;
  showMessages: boolean;
  restoreSession: boolean;
  arrangeMode: boolean;
  hasPassword: boolean;
  msgRefreshMins: number;
  messages: DesktopMessage[];
  onToggleTheme: () => void;
  onWallpaperChange: (w: SettingsProps['wallpaper']) => void;
  onToggleSeconds: () => void;
  onToggleMessages: () => void;
  onToggleRestoreSession: () => void;
  onResetMessages: () => void;
  onToggleArrange: () => void;
  onPassword: () => void;
  onRemovePassword: () => void;
  onExportWorkspace: () => void;
  onImportWorkspace: (rawJson: string) => { ok: true; summary: string } | { ok: false; error: string };
  onResetWorkspace: () => void;
  onMsgRefreshChange: (mins: number) => void;
  onMessagesChange: (msgs: DesktopMessage[]) => void;
  widgets: WidgetDefinition[];
  onWidgetsChange: (widgets: WidgetDefinition[]) => void;
  onPreviewWidget: (widget: WidgetDefinition) => void;
  onOpenApp?: (appId: AppId) => void;
  shortcuts: SavedShortcut[];
  onShortcutsChange: (shortcuts: SavedShortcut[]) => void;
  onRemoveShortcut: (shortcutId: string) => void;
  pinnedDesktop: AppId[];
  pinnedDock: AppId[];
  onTogglePin: (appId: AppId, dest: 'desktop' | 'dock') => void;
}

export function AppHost({ appId, settings }: { appId: AppId; settings?: SettingsProps }) {
  if (isShortcutAppId(appId)) {
    const shortcutId = fromShortcutAppId(appId);
    const list = settings?.shortcuts ?? readShortcuts();
    const shortcut = list.find(item => item.id === shortcutId);
    if (!shortcut) {
      return (
        <div className="empty-state">
          <Globe2 size={22} />
          <strong>Shortcut removed</strong>
          <span>This web shortcut is no longer in your Saved links collection.</span>
        </div>
      );
    }
    return (
      <ShortcutWebApp
        shortcut={shortcut}
        onModeChange={mode => {
          if (!settings) return;
          settings.onShortcutsChange(
            settings.shortcuts.map(item => (item.id === shortcut.id ? { ...item, mode } : item))
          );
        }}
      />
    );
  }

  switch (appId) {
    case 'browser': return <BrowserApp settings={settings} />;
    case 'youtube': return <YouTubeApp />;
    case 'notes': return <ScratchpadApp />;
    case 'bookmarks': return <BookmarksApp settings={settings} />;
    case 'settings': return settings ? <SettingsApp settings={settings} /> : <div className="empty-state"><span>Settings unavailable.</span></div>;
    case 'widgets': return settings ? <WidgetStudioApp settings={settings} /> : <div className="empty-state"><span>Widget Studio unavailable.</span></div>;
    default: return <div className="empty-state"><span>App not found.</span></div>;
  }
}

/* ── Shortcut Web App Window ──────────────────────────────────────────────── */
function ShortcutWebApp({
  shortcut,
  onModeChange,
}: {
  shortcut: SavedShortcut;
  onModeChange: (mode: ShortcutLaunchMode) => void;
}) {
  const [reloadNonce, setReloadNonce] = useState(0);
  const [showBlockedHelp, setShowBlockedHelp] = useState(false);
  const hostname = extractHostname(shortcut.url) || shortcut.url;

  return (
    <div className="web-app shortcut-web-app">
      <div className="address-bar shortcut-app-bar">
        <span className="swa-favicon-chip">
          <ShortcutFavicon url={shortcut.url} title={shortcut.title} size={16} />
        </span>
        <div className="swa-url-meta" title={shortcut.url}>
          <strong>{shortcut.title}</strong>
          <span>{hostname}</span>
        </div>

        <div className="swa-bar-actions">
          <div className="ws-seg" role="group" aria-label="Launch mode">
            <button
              type="button"
              className={shortcut.mode === 'embed' ? 'is-active' : ''}
              onClick={() => { setShowBlockedHelp(false); onModeChange('embed'); }}
            >
              Window
            </button>
            <button
              type="button"
              className={shortcut.mode === 'external' ? 'is-active' : ''}
              onClick={() => onModeChange('external')}
            >
              Browser tab
            </button>
          </div>

          {shortcut.mode === 'embed' && (
            <button
              type="button"
              className="icon-btn"
              onClick={() => { setShowBlockedHelp(false); setReloadNonce(n => n + 1); }}
              title="Reload page"
              aria-label="Reload page"
            >
              <RefreshCw size={13} />
            </button>
          )}

          <a
            href={shortcut.url}
            target="_blank"
            rel="noopener noreferrer"
            className="secondary-btn swa-ext-link"
          >
            Open tab <ExternalLink size={12} />
          </a>
        </div>
      </div>

      {shortcut.mode === 'external' ? (
        <div className="empty-state swa-launch-stage">
          <div className="swa-hero-tile">
            <ShortcutFavicon url={shortcut.url} title={shortcut.title} size={34} />
          </div>
          <strong>{shortcut.title}</strong>
          <span>
            Configured to open in a full browser tab ({hostname}) so sign-ins and cookies work without iframe restrictions.
          </span>
          <div className="swa-stage-actions">
            <a
              href={shortcut.url}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-btn swa-ext-link"
            >
              Launch {shortcut.title} <ArrowUpRight size={13} />
            </a>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => onModeChange('embed')}
            >
              Try in window
            </button>
          </div>
        </div>
      ) : showBlockedHelp ? (
        <div className="empty-state swa-launch-stage">
          <div className="swa-hero-tile">
            <ShortcutFavicon url={shortcut.url} title={shortcut.title} size={34} />
          </div>
          <strong>Site restricts window embedding</strong>
          <span>
            Many sites block loading inside frames via security headers. Switch this shortcut to Browser tab mode or open it directly below.
          </span>
          <div className="swa-stage-actions">
            <a
              href={shortcut.url}
              target="_blank"
              rel="noopener noreferrer"
              className="primary-btn swa-ext-link"
            >
              Open in browser tab <ExternalLink size={13} />
            </a>
            <button
              type="button"
              className="secondary-btn"
              onClick={() => { onModeChange('external'); setShowBlockedHelp(false); }}
            >
              Save as Browser tab mode
            </button>
          </div>
        </div>
      ) : (
        <iframe
          key={`${shortcut.url}-${reloadNonce}`}
          className="web-frame"
          title={shortcut.title}
          src={shortcut.url}
          sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox"
          referrerPolicy="strict-origin-when-cross-origin"
        />
      )}

      {shortcut.mode === 'embed' && !showBlockedHelp && (
        <div className="web-app-footer">
          <span>Blank frame or refused connection?</span>
          <button type="button" onClick={() => setShowBlockedHelp(true)}>
            Site blocked embedding?
          </button>
          <a href={shortcut.url} target="_blank" rel="noopener noreferrer">
            <ExternalLink size={11} /> Open externally
          </a>
        </div>
      )}
    </div>
  );
}

/* ── YouTube ──────────────────────────────────────────────────────────────── */
function YouTubeApp() {
  const [video, setVideo] = useState('jfKfPfyJRdk');
  const [input, setInput] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [error, setError] = useState('');
  const load = () => {
    const raw = input.trim(); let id = raw;
    try {
      const p = new URL(raw.includes('://') ? raw : `https://${raw}`);
      if (p.hostname.includes('youtu.be')) id = p.pathname.slice(1);
      else if (p.hostname.includes('youtube.com')) id = p.searchParams.get('v') || p.pathname.split('/').filter(Boolean).pop() || '';
    } catch { }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) { setError('Paste a YouTube URL or 11-character video ID.'); return; }
    setVideo(id); setError('');
  };
  return (
    <div className="youtube-app">
      <form className="address-bar" onSubmit={e => { e.preventDefault(); load(); }}>
        <input className="address-input" value={input} onChange={e => setInput(e.target.value)} aria-label="YouTube video URL" />
        <button type="submit" className="primary-btn">Play</button>
      </form>
      {error && <p className="inline-error">{error}</p>}
      <div className="video-stage">
        <iframe title="YouTube player" src={`https://www.youtube-nocookie.com/embed/${video}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen />
      </div>
      <div className="web-app-footer"><span>Official YouTube embedded player.</span><a href={`https://www.youtube.com/watch?v=${video}`} target="_blank" rel="noopener noreferrer"><ExternalLink size={11} /> Watch on YouTube</a></div>
    </div>
  );
}



/* ── Saved Links / Web Shortcuts Manager ──────────────────────────────────── */
function BookmarksApp({ settings }: { settings?: SettingsProps }) {
  const [fallbackLinks, setFallbackLinks] = useState<SavedShortcut[]>(readShortcuts);
  const links = settings ? settings.shortcuts : fallbackLinks;

  const updateLinks = (next: SavedShortcut[]) => {
    if (settings) {
      settings.onShortcutsChange(next);
    } else {
      setFallbackLinks(next);
      saveShortcuts(next);
    }
  };

  const [composerOpen, setComposerOpen] = useState<boolean>(() => links.length === 0);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [url, setUrl] = useState('');
  const [title, setTitle] = useState('');
  const [titleTouched, setTitleTouched] = useState(false);
  const [mode, setMode] = useState<ShortcutLaunchMode>('embed');
  const [pinDockOnCreate, setPinDockOnCreate] = useState(false);
  const [pinDesktopOnCreate, setPinDesktopOnCreate] = useState(false);
  const [formError, setFormError] = useState('');

  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<'all' | 'pinned' | 'embed' | 'external'>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  /* Debounced URL for live favicon preview while typing in composer */
  const [previewUrl, setPreviewUrl] = useState('');
  useEffect(() => {
    const normalized = normalizeHttpUrl(url);
    if (!normalized) {
      setPreviewUrl('');
      return;
    }
    const timer = window.setTimeout(() => setPreviewUrl(normalized), 260);
    return () => window.clearTimeout(timer);
  }, [url]);

  const handleUrlChange = (nextUrl: string) => {
    setUrl(nextUrl);
    if (formError) setFormError('');
    if (!titleTouched) {
      const suggested = suggestTitleFromUrl(nextUrl);
      if (suggested) setTitle(suggested);
    }
  };

  const resetComposer = () => {
    setEditingId(null);
    setUrl('');
    setTitle('');
    setTitleTouched(false);
    setMode('embed');
    setPinDockOnCreate(false);
    setPinDesktopOnCreate(false);
    setFormError('');
  };

  const startEdit = (item: SavedShortcut) => {
    setEditingId(item.id);
    setUrl(item.url);
    setTitle(item.title);
    setTitleTouched(true);
    setMode(item.mode);
    setFormError('');
    setComposerOpen(true);
  };

  const submitShortcut = (e: FormEvent) => {
    e.preventDefault();
    const normalized = normalizeHttpUrl(url);
    if (!normalized) {
      setFormError('Enter a valid website address (for example, linear.app or https://github.com).');
      return;
    }
    const finalTitle = title.trim() || suggestTitleFromUrl(normalized) || extractHostname(normalized) || 'Shortcut';

    if (editingId) {
      updateLinks(
        links.map(item =>
          item.id === editingId ? { ...item, title: finalTitle, url: normalized, mode } : item
        )
      );
      resetComposer();
      setComposerOpen(false);
      return;
    }

    const id = crypto.randomUUID();
    const created: SavedShortcut = { id, title: finalTitle, url: normalized, mode };
    updateLinks([created, ...links]);

    if (settings) {
      const appId = toShortcutAppId(id);
      if (pinDockOnCreate && !settings.pinnedDock.includes(appId)) {
        settings.onTogglePin(appId, 'dock');
      }
      if (pinDesktopOnCreate && !settings.pinnedDesktop.includes(appId)) {
        settings.onTogglePin(appId, 'desktop');
      }
    }

    resetComposer();
    setComposerOpen(false);
  };

  const handleDelete = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    if (settings) {
      settings.onRemoveShortcut(id);
    } else {
      updateLinks(links.filter(item => item.id !== id));
    }
    if (editingId === id) resetComposer();
    setConfirmDeleteId(null);
  };

  const isPinned = (id: string) => {
    if (!settings) return false;
    const appId = toShortcutAppId(id);
    return settings.pinnedDock.includes(appId) || settings.pinnedDesktop.includes(appId);
  };

  const pinnedCount = useMemo(
    () => links.filter(item => isPinned(item.id)).length,
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [links, settings?.pinnedDock, settings?.pinnedDesktop]
  );

  const filteredLinks = useMemo(() => {
    const q = query.trim().toLowerCase();
    return links.filter(item => {
      if (filter === 'pinned' && !isPinned(item.id)) return false;
      if (filter === 'embed' && item.mode !== 'embed') return false;
      if (filter === 'external' && item.mode !== 'external') return false;
      if (!q) return true;
      return `${item.title} ${item.url}`.toLowerCase().includes(q);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [links, query, filter, settings?.pinnedDock, settings?.pinnedDesktop]);

  return (
    <div className="bookmarks-app">
      {/* Header */}
      <header className="sl-header">
        <div>
          <span className="eyebrow">Web Shortcuts</span>
          <h3>Saved links & apps</h3>
          <p>Every shortcut appears in the App Menu and can be pinned to your Dock or Desktop.</p>
        </div>
        <button
          type="button"
          className={composerOpen ? 'secondary-btn' : 'primary-btn'}
          onClick={() => {
            if (composerOpen) {
              resetComposer();
              setComposerOpen(false);
            } else {
              setComposerOpen(true);
            }
          }}
        >
          {composerOpen ? <><X size={13} /> Close</> : <><Plus size={13} /> New shortcut</>}
        </button>
      </header>

      {/* Collapsible Add / Edit Shortcut Composer */}
      {composerOpen && (
        <form className="sl-composer" onSubmit={submitShortcut}>
          <div className="sl-composer-main">
            <div className="sl-preview-box" title="Live favicon preview">
              <ShortcutFavicon url={previewUrl} title={title} size={24} />
            </div>

            <div className="sl-composer-inputs">
              <label className="sl-field">
                <span>Website URL</span>
                <input
                  placeholder="https://linear.app or figma.com"
                  value={url}
                  onChange={e => handleUrlChange(e.target.value)}
                  aria-label="Website URL"
                  autoFocus
                  spellCheck={false}
                />
              </label>

              <label className="sl-field">
                <span>App name</span>
                <input
                  placeholder="Auto-filled from domain"
                  value={title}
                  onChange={e => {
                    setTitle(e.target.value);
                    setTitleTouched(e.target.value.trim().length > 0);
                  }}
                  aria-label="Shortcut name"
                />
              </label>
            </div>
          </div>

          {formError && <p className="sl-form-error" role="alert">{formError}</p>}

          <div className="sl-composer-footer">
            <div className="sl-composer-opts">
              <div className="ws-seg" role="group" aria-label="Default opening mode">
                <button
                  type="button"
                  className={mode === 'embed' ? 'is-active' : ''}
                  onClick={() => setMode('embed')}
                >
                  Workspace window
                </button>
                <button
                  type="button"
                  className={mode === 'external' ? 'is-active' : ''}
                  onClick={() => setMode('external')}
                >
                  Browser tab
                </button>
              </div>

              {!editingId && settings && (
                <div className="sl-pin-checks">
                  <button
                    type="button"
                    className={`sl-check-btn ${pinDockOnCreate ? 'is-checked' : ''}`}
                    onClick={() => setPinDockOnCreate(v => !v)}
                    aria-pressed={pinDockOnCreate}
                  >
                    {pinDockOnCreate ? <Check size={11} /> : <Pin size={11} />}
                    Pin to dock
                  </button>
                  <button
                    type="button"
                    className={`sl-check-btn ${pinDesktopOnCreate ? 'is-checked' : ''}`}
                    onClick={() => setPinDesktopOnCreate(v => !v)}
                    aria-pressed={pinDesktopOnCreate}
                  >
                    {pinDesktopOnCreate ? <Check size={11} /> : <Monitor size={11} />}
                    Pin to desktop
                  </button>
                </div>
              )}
            </div>

            <div className="sl-composer-btns">
              {editingId && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => { resetComposer(); setComposerOpen(false); }}
                >
                  Cancel
                </button>
              )}
              <button type="submit" className="primary-btn">
                {editingId ? <><Check size={13} /> Save changes</> : <><Plus size={13} /> Add app shortcut</>}
              </button>
            </div>
          </div>
        </form>
      )}

      {/* Search & Interactive Filter Bar */}
      <div className="sl-toolbar">
        <label className="sl-search">
          <Search size={13} />
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            placeholder="Search shortcuts by name or domain…"
            aria-label="Search shortcuts"
          />
          {query && (
            <button type="button" className="sl-search-clear" onClick={() => setQuery('')} aria-label="Clear search">
              <X size={11} />
            </button>
          )}
        </label>

        <div className="ws-seg sl-filters" role="group" aria-label="Filter shortcuts">
          <button type="button" className={filter === 'all' ? 'is-active' : ''} onClick={() => setFilter('all')}>
            All · {links.length}
          </button>
          <button type="button" className={filter === 'pinned' ? 'is-active' : ''} onClick={() => setFilter('pinned')}>
            Pinned · {pinnedCount}
          </button>
          <button type="button" className={filter === 'embed' ? 'is-active' : ''} onClick={() => setFilter('embed')}>
            Window
          </button>
          <button type="button" className={filter === 'external' ? 'is-active' : ''} onClick={() => setFilter('external')}>
            Tab
          </button>
        </div>
      </div>

      {/* Shortcuts List */}
      <div className="saved-link-list">
        {filteredLinks.length === 0 ? (
          <div className="sl-empty">
            <strong>{links.length === 0 ? 'No shortcuts yet' : 'No matching shortcuts'}</strong>
            <span>
              {links.length === 0
                ? 'Add any website to launch it from your App Menu, Dock, or Desktop with its site icon.'
                : 'Try clearing your search query or switching filters.'}
            </span>
            {links.length === 0 && !composerOpen && (
              <button type="button" className="primary-btn" onClick={() => setComposerOpen(true)}>
                <Plus size={13} /> Add your first shortcut
              </button>
            )}
          </div>
        ) : (
          filteredLinks.map(link => {
            const appId = toShortcutAppId(link.id);
            const onDock = settings ? settings.pinnedDock.includes(appId) : false;
            const onDesktop = settings ? settings.pinnedDesktop.includes(appId) : false;
            const host = extractHostname(link.url) || link.url;
            const pinSummary =
              onDock && onDesktop
                ? 'Pinned to dock & desktop'
                : onDock
                  ? 'Pinned to dock'
                  : onDesktop
                    ? 'Pinned to desktop'
                    : null;

            return (
              <div className="saved-link" key={link.id}>
                <button
                  type="button"
                  className="sl-icon-tile"
                  onClick={() => settings?.onOpenApp?.(appId)}
                  title={`Launch ${link.title}`}
                >
                  <ShortcutFavicon url={link.url} title={link.title} size={22} />
                </button>

                <div className="saved-link-copy">
                  <strong>{link.title}</strong>
                  <div className="sl-meta">
                    <span>{host}</span>
                    <span aria-hidden="true">·</span>
                    <span>{link.mode === 'embed' ? 'Workspace window' : 'Browser tab'}</span>
                    {pinSummary && (
                      <>
                        <span aria-hidden="true">·</span>
                        <span className="sl-meta-pin">{pinSummary}</span>
                      </>
                    )}
                  </div>
                </div>

                <div className="sl-actions">
                  {settings?.onOpenApp && (
                    <button
                      type="button"
                      className="secondary-btn sl-launch-btn"
                      onClick={() => settings.onOpenApp?.(appId)}
                    >
                      Launch
                    </button>
                  )}

                  <a
                    href={link.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="icon-btn"
                    title="Open in new browser tab"
                    aria-label={`Open ${link.title} in browser tab`}
                  >
                    <ExternalLink size={13} />
                  </a>

                  {settings && (
                    <>
                      <button
                        type="button"
                        className={`icon-btn ${onDock ? 'is-pinned' : ''}`}
                        onClick={() => settings.onTogglePin(appId, 'dock')}
                        title={onDock ? 'Remove from dock' : 'Pin to dock'}
                        aria-label={onDock ? `Unpin ${link.title} from dock` : `Pin ${link.title} to dock`}
                        aria-pressed={onDock}
                      >
                        <Pin size={13} />
                      </button>

                      <button
                        type="button"
                        className={`icon-btn ${onDesktop ? 'is-pinned' : ''}`}
                        onClick={() => settings.onTogglePin(appId, 'desktop')}
                        title={onDesktop ? 'Remove from desktop' : 'Pin to desktop'}
                        aria-label={onDesktop ? `Remove ${link.title} from desktop` : `Pin ${link.title} to desktop`}
                        aria-pressed={onDesktop}
                      >
                        <Monitor size={13} />
                      </button>
                    </>
                  )}

                  <button
                    type="button"
                    className="icon-btn"
                    onClick={() => startEdit(link)}
                    title="Edit shortcut"
                    aria-label={`Edit ${link.title}`}
                  >
                    <Pencil size={13} />
                  </button>

                  <button
                    type="button"
                    className={`settings-action danger sl-del-btn ${confirmDeleteId === link.id ? 'is-confirming' : ''}`}
                    onClick={() => handleDelete(link.id)}
                    aria-label={`Delete ${link.title}`}
                    title="Remove shortcut"
                  >
                    {confirmDeleteId === link.id ? 'Confirm?' : <Trash2 size={13} />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

/* ── Settings ─────────────────────────────────────────────────────────────── */
function SettingsApp({ settings }: { settings: SettingsProps }) {
  const [section, setSection] = useState<'appearance' | 'desktop' | 'messages' | 'privacy' | 'backup'>('appearance');
  const [backupNotice, setBackupNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const importInputRef = useRef<HTMLInputElement>(null);

  const nav = [
    { id: 'appearance' as const, label: 'Appearance', Icon: Palette, detail: 'Theme and wallpaper' },
    { id: 'desktop' as const, label: 'Desktop', Icon: Monitor, detail: 'Canvas and clock' },
    { id: 'messages' as const, label: 'Desktop messages', Icon: MessageSquareQuote, detail: 'Ambient notes' },
    { id: 'privacy' as const, label: 'Privacy', Icon: Shield, detail: 'Passcode protection' },
    { id: 'backup' as const, label: 'Backup & reset', Icon: HardDriveDownload, detail: 'Export and recovery' },
  ];
  const current = nav.find(item => item.id === section)!;

  const handleImportFile = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    try {
      const rawText = await file.text();
      const result = settings.onImportWorkspace(rawText);
      if (result.ok) {
        setBackupNotice({ kind: 'success', text: result.summary });
      } else {
        setBackupNotice({ kind: 'error', text: result.error });
      }
    } catch {
      setBackupNotice({ kind: 'error', text: 'Could not read the selected backup file.' });
    }
  };

  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-brand">
          <span className="settings-brand-mark">N</span>
          <div>
            <strong>Settings</strong>
            <span>Customize Nexus</span>
          </div>
        </div>
        <div className="settings-nav-label">PREFERENCES</div>
        <nav className="settings-nav" aria-label="Settings sections">
          {nav.map(item => {
            const Icon = item.Icon;
            return (
              <button
                key={item.id}
                type="button"
                className={`settings-nav-item ${section === item.id ? 'is-active' : ''}`}
                onClick={() => { setSection(item.id); setBackupNotice(null); setConfirmFactoryReset(false); }}
                aria-current={section === item.id ? 'page' : undefined}
              >
                <span className="settings-nav-icon"><Icon size={14} strokeWidth={1.65} /></span>
                <span className="settings-nav-copy">
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
                {section === item.id && <span className="settings-nav-indicator" />}
              </button>
            );
          })}
        </nav>
        <div className="settings-sidebar-footer">Local-first workspace</div>
      </aside>

      <main className="settings-content">
        <header className="settings-page-header">
          <div>
            <span className="eyebrow">NEXUS PREFERENCES</span>
            <h3>{current.label}</h3>
            <p>{current.detail}. Make your workspace feel right.</p>
          </div>
          <span className="settings-page-index">
            0{nav.findIndex(item => item.id === section) + 1} <i>/ 0{nav.length}</i>
          </span>
        </header>

        {section === 'appearance' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading">
              <strong>Appearance</strong>
              <span>Canvas and presentation</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Color theme</strong>
                <span>{settings.theme === 'dark' ? 'Dark — warm charcoal' : 'Light — soft paper'}</span>
              </div>
              <button type="button" className="settings-action" onClick={settings.onToggleTheme}>
                {settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Desktop wallpaper</strong>
                <span>Choose the atmosphere behind your workspace</span>
              </div>
              <select
                value={settings.wallpaper}
                onChange={e => settings.onWallpaperChange(e.target.value as SettingsProps['wallpaper'])}
                aria-label="Wallpaper"
              >
                <option value="mist">Soft mist</option>
                <option value="aurora">Aurora</option>
                <option value="dusk">Warm dusk</option>
                <option value="forest">Forest</option>
                <option value="ocean">Ocean glass</option>
                <option value="ember">Ember</option>
                <option value="lavender">Lavender haze</option>
                <option value="midnight">Midnight</option>
                <option value="rose">Rosewater</option>
                <option value="mono">Monochrome</option>
                <option value="citrus">Citrus</option>
                <option value="glacier">Glacier</option>
              </select>
            </div>
          </section>
        )}

        {section === 'desktop' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading">
              <strong>Desktop behavior</strong>
              <span>Control how objects behave on the canvas</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Arrange mode</strong>
                <span>Drag desktop icons and reposition or resize desktop widgets (F2)</span>
              </div>
              <button type="button" className="settings-action" onClick={settings.onToggleArrange}>
                {settings.arrangeMode ? 'Finish arranging' : 'Arrange desktop'}
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Restore open windows on startup</strong>
                <span>Reopen your active windows, split-screen tiles, and positions when opening a new tab</span>
              </div>
              <button
                type="button"
                className={`settings-switch ${settings.restoreSession ? 'is-on' : ''}`}
                onClick={settings.onToggleRestoreSession}
                aria-label="Toggle restore open windows on startup"
                aria-pressed={settings.restoreSession}
              >
                <span />
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Window snapping &amp; split tiling</strong>
                <span>Drag any title bar to the left, right, or top screen edge, or use keyboard shortcuts</span>
              </div>
              <span className="settings-meta-note">Alt + [ · Alt + ] · Alt + ↑</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Clock seconds</strong>
                <span>Show seconds in the bottom-right desktop clock</span>
              </div>
              <button
                type="button"
                className={`settings-switch ${settings.showSeconds ? 'is-on' : ''}`}
                onClick={settings.onToggleSeconds}
                aria-label="Toggle seconds"
                aria-pressed={settings.showSeconds}
              >
                <span />
              </button>
            </div>
          </section>
        )}

        {section === 'messages' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading">
              <strong>Desktop messages</strong>
              <span>Small notes, dev jokes, and reminders that rotate quietly on your desktop</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Show desktop messages</strong>
                <span>Display an ambient rotating note in the bottom-left corner</span>
              </div>
              <button
                type="button"
                className={`settings-switch ${settings.showMessages ? 'is-on' : ''}`}
                onClick={settings.onToggleMessages}
                aria-label="Toggle desktop messages"
                aria-pressed={settings.showMessages}
              >
                <span />
              </button>
            </div>
            <div className="settings-row">
              <div>
                <strong>Refresh interval</strong>
                <span>How often the desktop message rotates</span>
              </div>
              <select
                value={settings.msgRefreshMins}
                onChange={e => settings.onMsgRefreshChange(Number(e.target.value))}
                aria-label="Message refresh interval"
                disabled={!settings.showMessages}
              >
                <option value={1}>Every minute</option>
                <option value={2}>Every 2 minutes</option>
                <option value={5}>Every 5 minutes</option>
                <option value={10}>Every 10 minutes</option>
                <option value={15}>Every 15 minutes</option>
                <option value={30}>Every 30 minutes</option>
                <option value={60}>Every hour</option>
              </select>
            </div>
            <MessagesEditor
              messages={settings.messages}
              onChange={settings.onMessagesChange}
              onResetDefaults={settings.onResetMessages}
              disabled={!settings.showMessages}
            />
          </section>
        )}

        {section === 'privacy' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading">
              <strong>Privacy and local lock</strong>
              <span>Local privacy protection and transparent browser threat model</span>
            </div>
            <div className="settings-row">
              <div>
                <strong>Workspace passcode</strong>
                <span>{settings.hasPassword ? 'Lock screen active on new browser sessions' : 'Disabled — opens directly to desktop'}</span>
              </div>
              <div className="settings-row-actions">
                <button type="button" className="settings-action" onClick={settings.onPassword}>
                  {settings.hasPassword ? 'Change passcode' : 'Set up passcode'}
                </button>
                {settings.hasPassword && (
                  <button type="button" className="settings-action danger" onClick={settings.onRemovePassword}>
                    Remove passcode
                  </button>
                )}
              </div>
            </div>
            <div className="settings-row">
              <div>
                <strong>Local threat model</strong>
                <span>
                  Passcodes are derived locally with PBKDF2-SHA256 (never stored in plaintext) as a privacy barrier on shared screens. Anyone with access to your OS account or browser developer tools can clear local profile storage.
                </span>
              </div>
              <span className="settings-meta-note">PBKDF2 · Local</span>
            </div>
          </section>
        )}

        {section === 'backup' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading">
              <strong>Workspace backup &amp; recovery</strong>
              <span>Export or restore your local preferences, pins, notes, shortcuts, and widgets</span>
            </div>

            {backupNotice && (
              <div className={`settings-inline-banner ${backupNotice.kind === 'error' ? 'is-error' : 'is-success'}`} role="status">
                <span>{backupNotice.text}</span>
                <button type="button" onClick={() => setBackupNotice(null)} aria-label="Dismiss notice">
                  <X size={12} />
                </button>
              </div>
            )}

            <div className="settings-row">
              <div>
                <strong>Export workspace JSON</strong>
                <span>Download a versioned snapshot of your layout, shortcuts, notes, bookmarks, and widgets (passcodes are excluded)</span>
              </div>
              <button
                type="button"
                className="settings-action"
                onClick={() => {
                  settings.onExportWorkspace();
                  setBackupNotice({ kind: 'success', text: 'Workspace backup downloaded.' });
                }}
              >
                <Download size={12} /> Export JSON
              </button>
            </div>

            <div className="settings-row">
              <div>
                <strong>Import workspace JSON</strong>
                <span>Validate and restore a previously exported Nexus backup file</span>
              </div>
              <div>
                <input
                  ref={importInputRef}
                  type="file"
                  accept=".json,application/json"
                  className="sr-only-input"
                  onChange={handleImportFile}
                />
                <button
                  type="button"
                  className="settings-action"
                  onClick={() => importInputRef.current?.click()}
                >
                  <Upload size={12} /> Import JSON…
                </button>
              </div>
            </div>

            <div className="settings-row">
              <div>
                <strong>Reset workspace to defaults</strong>
                <span>Clear all saved pins, custom shortcuts, widgets, notes, and local passcode to return to a clean install</span>
              </div>
              {confirmFactoryReset ? (
                <div className="settings-row-actions">
                  <button
                    type="button"
                    className="settings-action"
                    onClick={() => setConfirmFactoryReset(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="settings-action danger"
                    onClick={() => {
                      settings.onResetWorkspace();
                      setConfirmFactoryReset(false);
                      setBackupNotice({ kind: 'success', text: 'Workspace reset to clean defaults.' });
                    }}
                  >
                    Confirm full reset
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  className="settings-action danger"
                  onClick={() => setConfirmFactoryReset(true)}
                >
                  <RotateCcw size={12} /> Reset workspace
                </button>
              )}
            </div>
          </section>
        )}

        <div className="settings-content-footer">
          <span>Changes save automatically</span>
          <span>NEXUS · {NEXUS_VERSION}</span>
        </div>
      </main>
    </div>
  );
}

function MessagesEditor({
  messages,
  onChange,
  onResetDefaults,
  disabled,
}: {
  messages: DesktopMessage[];
  onChange: (messages: DesktopMessage[]) => void;
  onResetDefaults: () => void;
  disabled?: boolean;
}) {
  const updateMessage = (id: string, text: string) => {
    onChange(messages.map(message => message.id === id ? { ...message, text } : message));
  };

  const removeMessage = (id: string) => {
    if (messages.length <= 1) return;
    onChange(messages.filter(message => message.id !== id));
  };

  const addMessage = () => {
    onChange([...messages, { id: `dm-${Date.now()}`, text: '' }]);
  };

  return (
    <div className={`messages-editor ${disabled ? 'is-disabled' : ''}`}>
      <div className="messages-editor-toolbar">
        <span className="count-label">{messages.length} rotating notes</span>
        <div className="settings-row-actions">
          <button type="button" className="secondary-btn" onClick={onResetDefaults} disabled={disabled}>
            <RotateCcw size={12} /> Restore defaults
          </button>
          <button type="button" className="secondary-btn" onClick={addMessage} disabled={disabled}>
            <Plus size={13} /> Add message
          </button>
        </div>
      </div>
      <div className="messages-editor-list">
        {messages.map(message => (
          <div className="messages-editor-row" key={message.id}>
            <input
              value={message.text}
              onChange={event => updateMessage(message.id, event.target.value)}
              aria-label="Desktop message"
              placeholder="Write a desktop message"
              disabled={disabled}
            />
            <button
              type="button"
              className="icon-btn"
              onClick={() => removeMessage(message.id)}
              disabled={disabled || messages.length <= 1}
              aria-label="Remove message"
            >
              <Trash2 size={14} />
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ── Widget Studio ────────────────────────────────────────────────────────── */
const SOURCE_FILES: { key: keyof WidgetSource; label: string; hint: string }[] = [
  { key: 'html', label: 'index.html', hint: 'Markup' },
  { key: 'css',  label: 'style.css',  hint: 'Styles' },
  { key: 'js',   label: 'script.js',  hint: 'Logic' },
  { key: 'json', label: 'widget.json', hint: 'Config' },
];

const VALID_CORE_APP_IDS: CoreAppId[] = ['browser', 'youtube', 'notes', 'bookmarks', 'settings', 'widgets'];

function WidgetStudioApp({ settings }: { settings: SettingsProps }) {
  const [tab, setTab] = useState<'workbench' | 'library' | 'api'>(() =>
    settings.widgets.length > 0 ? 'workbench' : 'library'
  );
  const [editingId, setEditingId] = useState<string | null>(settings.widgets[0]?.id ?? null);
  const [activeFile, setActiveFile] = useState<keyof WidgetSource>('html');
  const [previewMode, setPreviewMode] = useState<'auto' | 'light' | 'dark'>('auto');
  const [reloadNonce, setReloadNonce] = useState(0);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [importError, setImportError] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  useEffect(() => {
    if (!editingId || !settings.widgets.some(w => w.id === editingId)) {
      setEditingId(settings.widgets[0]?.id ?? null);
    }
  }, [settings.widgets, editingId]);

  useEffect(() => {
    setConfirmDeleteId(null);
  }, [editingId, tab]);

  const selected = useMemo(
    () => settings.widgets.find(w => w.id === editingId) ?? null,
    [settings.widgets, editingId]
  );

  /* Debounce live preview updates while typing in the code editor */
  const [debouncedWidget, setDebouncedWidget] = useState<WidgetDefinition | null>(selected);
  useEffect(() => {
    if (!selected) {
      setDebouncedWidget(null);
      return;
    }
    const timer = window.setTimeout(() => setDebouncedWidget(selected), 220);
    return () => window.clearTimeout(timer);
  }, [selected]);

  const effectivePreviewTheme: 'light' | 'dark' =
    previewMode === 'auto' ? settings.theme : previewMode;

  const jsonValid = useMemo(() => {
    if (!selected) return true;
    try {
      const parsed: unknown = JSON.parse(selected.source.json);
      return Boolean(parsed && typeof parsed === 'object' && !Array.isArray(parsed));
    } catch {
      return false;
    }
  }, [selected]);

  const updateSelected = (patch: Partial<WidgetDefinition>) => {
    if (!selected) return;
    settings.onWidgetsChange(
      settings.widgets.map(w => (w.id === selected.id ? { ...w, ...patch, updatedAt: Date.now() } : w))
    );
  };

  const updateSource = (key: keyof WidgetSource, value: string) => {
    if (!selected) return;
    updateSelected({ source: { ...selected.source, [key]: value } });
  };

  const updateBound = (key: keyof WidgetDefinition['bounds'], value: number) => {
    if (!selected || !Number.isFinite(value)) return;
    const min = key === 'width' ? 160 : key === 'height' ? 100 : 0;
    updateSelected({
      bounds: { ...selected.bounds, [key]: Math.max(min, Math.round(value)) },
    });
  };

  const centerOnDesktop = () => {
    if (!selected) return;
    const x = Math.max(24, Math.round((window.innerWidth - selected.bounds.width) / 2));
    const y = Math.max(24, Math.round((window.innerHeight - 88 - selected.bounds.height) / 2));
    updateSelected({ bounds: { ...selected.bounds, x, y } });
  };

  const createBlank = () => {
    const widget = createWidget(`Widget ${settings.widgets.length + 1}`);
    settings.onWidgetsChange([...settings.widgets, widget]);
    setEditingId(widget.id);
    setActiveFile('html');
    setTab('workbench');
  };

  const addFromTemplate = (templateId: string) => {
    const tpl = WIDGET_TEMPLATES.find(t => t.id === templateId);
    if (!tpl) return;
    const widget = instantiateTemplate(tpl, settings.widgets.length);
    settings.onWidgetsChange([...settings.widgets, widget]);
    setEditingId(widget.id);
    setActiveFile('html');
    setTab('workbench');
  };

  const duplicateWidget = (target: WidgetDefinition) => {
    const copy: WidgetDefinition = {
      ...target,
      id: `widget-${crypto.randomUUID()}`,
      name: `${target.name} copy`,
      source: { ...target.source },
      bounds: { ...target.bounds, x: target.bounds.x + 24, y: target.bounds.y + 24 },
      updatedAt: Date.now(),
    };
    settings.onWidgetsChange([...settings.widgets, copy]);
    setEditingId(copy.id);
    setTab('workbench');
  };

  const deleteWidget = (id: string) => {
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    const remaining = settings.widgets.filter(w => w.id !== id);
    settings.onWidgetsChange(remaining);
    if (editingId === id) {
      setEditingId(remaining[0]?.id ?? null);
    }
    setConfirmDeleteId(null);
  };

  const toggleVisible = (id: string) => {
    settings.onWidgetsChange(
      settings.widgets.map(w => (w.id === id ? { ...w, visible: !w.visible, updatedAt: Date.now() } : w))
    );
  };

  const exportWidget = (target: WidgetDefinition) => {
    const blob = new Blob([JSON.stringify(target, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${target.name.replace(/\s+/g, '-').toLowerCase() || 'widget'}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importWidget = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    try {
      setImportError('');
      const imported = JSON.parse(await file.text()) as WidgetDefinition;
      if (
        imported.version !== 1 ||
        !imported.source ||
        typeof imported.source.html !== 'string' ||
        typeof imported.source.css !== 'string' ||
        typeof imported.source.js !== 'string' ||
        typeof imported.source.json !== 'string'
      ) {
        throw new Error('Unsupported widget format');
      }
      const widget: WidgetDefinition = {
        ...imported,
        id: `widget-${crypto.randomUUID()}`,
        bounds: {
          x: Number.isFinite(imported.bounds?.x) ? imported.bounds.x : 420,
          y: Number.isFinite(imported.bounds?.y) ? imported.bounds.y : 110,
          width: Math.max(160, Number(imported.bounds?.width) || 260),
          height: Math.max(100, Number(imported.bounds?.height) || 150),
        },
        visible: imported.visible !== false,
        updatedAt: Date.now(),
      };
      settings.onWidgetsChange([...settings.widgets, widget]);
      setEditingId(widget.id);
      setActiveFile('html');
      setTab('workbench');
    } catch {
      setImportError('Could not import JSON. Verify it is an exported Nexus widget file.');
    } finally {
      event.target.value = '';
    }
  };

  const handleEditorKeyDown = (event: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Tab' && selected) {
      event.preventDefault();
      const target = event.currentTarget;
      const start = target.selectionStart;
      const end = target.selectionEnd;
      const current = selected.source[activeFile];
      const next = `${current.slice(0, start)}  ${current.slice(end)}`;
      updateSource(activeFile, next);
      requestAnimationFrame(() => {
        target.selectionStart = start + 2;
        target.selectionEnd = start + 2;
      });
    }
  };

  const formatJson = () => {
    if (!selected) return;
    try {
      const pretty = JSON.stringify(JSON.parse(selected.source.json), null, 2);
      updateSource('json', pretty);
    } catch {
      /* Leave source untouched when JSON is invalid */
    }
  };

  const copySnippet = async (id: string, snippet: string) => {
    try {
      await navigator.clipboard.writeText(snippet);
      setCopiedId(id);
      window.setTimeout(() => setCopiedId(curr => (curr === id ? null : curr)), 1600);
    } catch {
      /* Clipboard may be restricted in some contexts */
    }
  };

  const appendSnippetToWidget = (snippet: string) => {
    if (!selected) return;
    const prefix = selected.source.js.trim() ? `${selected.source.js.trimEnd()}\n\n` : '';
    updateSource('js', `${prefix}${snippet}\n`);
    setActiveFile('js');
    setTab('workbench');
  };

  /* Compute preview scale so oversized widgets fit cleanly inside the inspector stage */
  const previewScale = useMemo(() => {
    if (!selected) return 1;
    const maxW = 340;
    const maxH = 220;
    return Math.min(1, maxW / selected.bounds.width, maxH / selected.bounds.height);
  }, [selected]);

  const lineCount = selected ? selected.source[activeFile].split('\n').length : 0;

  return (
    <div className="ws-shell">
      {/* ── Top Bar ── */}
      <header className="ws-topbar">
        <nav className="ws-nav" aria-label="Widget Studio views">
          <button
            type="button"
            className={`ws-nav-tab ${tab === 'workbench' ? 'is-active' : ''}`}
            onClick={() => setTab('workbench')}
          >
            Workbench
          </button>
          <button
            type="button"
            className={`ws-nav-tab ${tab === 'library' ? 'is-active' : ''}`}
            onClick={() => setTab('library')}
          >
            Library · {settings.widgets.length}
          </button>
          <button
            type="button"
            className={`ws-nav-tab ${tab === 'api' ? 'is-active' : ''}`}
            onClick={() => setTab('api')}
          >
            API Reference
          </button>
        </nav>

        {tab === 'workbench' && selected && (
          <div className="ws-active-widget">
            {settings.widgets.length > 1 && (
              <select
                aria-label="Select widget"
                value={selected.id}
                onChange={e => setEditingId(e.target.value)}
              >
                {settings.widgets.map(w => (
                  <option key={w.id} value={w.id}>{w.name}</option>
                ))}
              </select>
            )}
            <input
              className="ws-title-input"
              value={selected.name}
              onChange={e => updateSelected({ name: e.target.value })}
              aria-label="Widget name"
              placeholder="Widget name"
            />
          </div>
        )}

        <div className="ws-topbar-actions">
          <label className="secondary-btn widget-import">
            <Upload size={13} /> Import
            <input type="file" accept="application/json,.json" onChange={importWidget} />
          </label>
          <button type="button" className="primary-btn" onClick={createBlank}>
            <Plus size={13} /> New widget
          </button>
        </div>
      </header>

      {importError && <p className="inline-error">{importError}</p>}

      {/* ── VIEW 1: WORKBENCH ── */}
      {tab === 'workbench' && (
        !selected ? (
          <div className="ws-empty-state">
            <span className="eyebrow">No Widget Selected</span>
            <h3>Start building a desktop widget</h3>
            <p>Pick a ready-made template from the library or open a clean HTML/CSS/JS workspace.</p>
            <div className="ws-empty-actions">
              <button type="button" className="primary-btn" onClick={createBlank}>
                <Plus size={13} /> Blank widget
              </button>
              <button type="button" className="secondary-btn" onClick={() => setTab('library')}>
                Browse templates
              </button>
            </div>
          </div>
        ) : (
          <div className="ws-workbench">
            {/* Left Pane: Code Editor */}
            <section className="ws-editor-pane" aria-label="Source code editor">
              <div className="ws-file-tabs" role="tablist" aria-label="Widget files">
                {SOURCE_FILES.map(file => (
                  <button
                    key={file.key}
                    type="button"
                    role="tab"
                    aria-selected={activeFile === file.key}
                    className={`ws-file-tab ${activeFile === file.key ? 'is-active' : ''}`}
                    onClick={() => setActiveFile(file.key)}
                  >
                    {file.label}
                  </button>
                ))}

                <div className="ws-editor-meta">
                  {activeFile === 'json' && (
                    <>
                      <span className={jsonValid ? 'ws-json-ok' : 'ws-json-err'}>
                        {jsonValid ? 'Valid JSON' : 'Invalid JSON'}
                      </span>
                      {jsonValid && (
                        <button type="button" className="ws-text-btn" onClick={formatJson}>
                          Format
                        </button>
                      )}
                      <span aria-hidden="true">·</span>
                    </>
                  )}
                  <span>{lineCount} {lineCount === 1 ? 'line' : 'lines'}</span>
                </div>
              </div>

              <textarea
                className="ws-code-area"
                aria-label={`${activeFile} source`}
                value={selected.source[activeFile]}
                onChange={e => updateSource(activeFile, e.target.value)}
                onKeyDown={handleEditorKeyDown}
                spellCheck={false}
                autoCapitalize="off"
                autoCorrect="off"
              />
            </section>

            {/* Right Pane: Live Sandbox + Placement Inspector */}
            <aside className="ws-inspector-pane" aria-label="Widget preview and placement">
              <div className="ws-preview-section">
                <div className="ws-pane-bar">
                  <span className="ws-pane-label">
                    Live preview · {selected.bounds.width} × {selected.bounds.height}
                  </span>
                  <div className="ws-preview-controls">
                    <div className="ws-seg" role="group" aria-label="Preview theme">
                      {(['auto', 'light', 'dark'] as const).map(mode => (
                        <button
                          key={mode}
                          type="button"
                          className={previewMode === mode ? 'is-active' : ''}
                          onClick={() => setPreviewMode(mode)}
                        >
                          {mode === 'auto' ? 'Sync' : mode === 'light' ? 'Light' : 'Dark'}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => setReloadNonce(n => n + 1)}
                      title="Reload widget iframe"
                      aria-label="Reload preview"
                    >
                      <RefreshCw size={13} />
                    </button>
                  </div>
                </div>

                <div className={`ws-stage ws-stage--${effectivePreviewTheme}`}>
                  {debouncedWidget && (
                    <div
                      className="ws-stage-scale"
                      style={{
                        width: Math.round(debouncedWidget.bounds.width * previewScale),
                        height: Math.round(debouncedWidget.bounds.height * previewScale),
                      }}
                    >
                      <div
                        className="ws-stage-frame"
                        style={{
                          width: debouncedWidget.bounds.width,
                          height: debouncedWidget.bounds.height,
                          transform: `scale(${previewScale})`,
                        }}
                      >
                        <WidgetRuntime
                          key={`${debouncedWidget.id}-${reloadNonce}`}
                          widget={debouncedWidget}
                          theme={effectivePreviewTheme}
                          onOpenApp={appId => {
                            if (
                              settings.onOpenApp &&
                              (VALID_CORE_APP_IDS.includes(appId as CoreAppId) || isShortcutAppId(appId))
                            ) {
                              settings.onOpenApp(appId as AppId);
                            }
                          }}
                          onOpenUrl={url => window.open(url, '_blank', 'noopener,noreferrer')}
                        />
                      </div>
                    </div>
                  )}
                </div>
              </div>

              <div className="ws-controls-section">
                <div className="ws-control-row">
                  <div>
                    <strong>Show on desktop</strong>
                    <span>{selected.visible ? 'Pinned to workspace canvas' : 'Hidden from canvas'}</span>
                  </div>
                  <button
                    type="button"
                    className={`settings-switch ${selected.visible ? 'is-on' : ''}`}
                    onClick={() => updateSelected({ visible: !selected.visible })}
                    aria-label="Toggle widget visibility on desktop"
                    aria-pressed={selected.visible}
                  >
                    <span />
                  </button>
                </div>

                <div className="ws-placement-header">
                  <span>Desktop placement (px)</span>
                  <button type="button" className="ws-text-btn" onClick={centerOnDesktop}>
                    <Crosshair size={11} /> Center
                  </button>
                </div>

                <div className="ws-bounds-grid">
                  {([
                    ['width', 'Width', 20],
                    ['height', 'Height', 20],
                    ['x', 'Pos X', 24],
                    ['y', 'Pos Y', 24],
                  ] as const).map(([key, label, step]) => (
                    <label key={key} className="ws-bound-field">
                      <span>{label}</span>
                      <div className="widget-stepper">
                        <button type="button" onClick={() => updateBound(key, selected.bounds[key] - step)}>−</button>
                        <input
                          type="number"
                          min={key === 'width' ? 160 : key === 'height' ? 100 : 0}
                          step={step}
                          value={selected.bounds[key]}
                          onChange={e => updateBound(key, Number(e.target.value))}
                          aria-label={label}
                        />
                        <button type="button" onClick={() => updateBound(key, selected.bounds[key] + step)}>+</button>
                      </div>
                    </label>
                  ))}
                </div>

                <div className="ws-inspector-actions">
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => settings.onPreviewWidget(selected)}
                  >
                    Preview on desktop <ArrowUpRight size={13} />
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => duplicateWidget(selected)}>
                    <Copy size={12} /> Duplicate
                  </button>
                  <button type="button" className="secondary-btn" onClick={() => exportWidget(selected)}>
                    <Download size={12} /> Export
                  </button>
                  <button
                    type="button"
                    className="settings-action danger"
                    onClick={() => deleteWidget(selected.id)}
                  >
                    <Trash2 size={12} />
                    {confirmDeleteId === selected.id ? 'Confirm delete' : 'Delete'}
                  </button>
                </div>
              </div>
            </aside>
          </div>
        )
      )}

      {/* ── VIEW 2: LIBRARY & STARTER TEMPLATES ── */}
      {tab === 'library' && (
        <div className="ws-scroll-page">
          <section className="ws-section">
            <div className="ws-section-head">
              <div>
                <span className="eyebrow">Installed</span>
                <h3>Your widgets</h3>
              </div>
              <span className="count-label">{settings.widgets.length} total</span>
            </div>

            {settings.widgets.length === 0 ? (
              <div className="ws-inline-empty">
                <p>No widgets installed yet. Start from a template below or create a blank widget.</p>
                <button type="button" className="secondary-btn" onClick={createBlank}>
                  <Plus size={13} /> Create blank widget
                </button>
              </div>
            ) : (
              <div className="ws-library-list">
                {settings.widgets.map(widget => (
                  <div className="ws-library-row" key={widget.id}>
                    <div className="ws-library-info">
                      <strong>{widget.name}</strong>
                      <span>
                        {widget.bounds.width} × {widget.bounds.height} px
                        {' · '}
                        X {widget.bounds.x}, Y {widget.bounds.y}
                        {' · '}
                        Updated {new Date(widget.updatedAt).toLocaleDateString()}
                      </span>
                    </div>

                    <div className="ws-library-actions">
                      <label className="ws-toggle-inline">
                        <span>{widget.visible ? 'On desktop' : 'Hidden'}</span>
                        <button
                          type="button"
                          className={`settings-switch ${widget.visible ? 'is-on' : ''}`}
                          onClick={() => toggleVisible(widget.id)}
                          aria-label={`${widget.visible ? 'Hide' : 'Show'} ${widget.name}`}
                          aria-pressed={widget.visible}
                        >
                          <span />
                        </button>
                      </label>

                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => {
                          setEditingId(widget.id);
                          setTab('workbench');
                        }}
                      >
                        Edit
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => duplicateWidget(widget)}
                        title="Duplicate widget"
                        aria-label={`Duplicate ${widget.name}`}
                      >
                        <Copy size={13} />
                      </button>
                      <button
                        type="button"
                        className="icon-btn"
                        onClick={() => exportWidget(widget)}
                        title="Export JSON"
                        aria-label={`Export ${widget.name}`}
                      >
                        <Download size={13} />
                      </button>
                      <button
                        type="button"
                        className={`settings-action danger ${confirmDeleteId === widget.id ? 'is-confirming' : ''}`}
                        onClick={() => deleteWidget(widget.id)}
                        aria-label={`Delete ${widget.name}`}
                      >
                        {confirmDeleteId === widget.id ? 'Confirm?' : <Trash2 size={13} />}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="ws-section">
            <div className="ws-section-head">
              <div>
                <span className="eyebrow">Starter Kit</span>
                <h3>Templates</h3>
              </div>
              <span className="count-label">Ready to customize</span>
            </div>

            <div className="ws-template-grid">
              {WIDGET_TEMPLATES.map(tpl => (
                <article className="ws-template-card" key={tpl.id}>
                  <div className="ws-template-body">
                    <div className="ws-template-top">
                      <strong>{tpl.name}</strong>
                      <span>{tpl.bounds.width} × {tpl.bounds.height} px</span>
                    </div>
                    <p>{tpl.summary}</p>
                  </div>
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => addFromTemplate(tpl.id)}
                  >
                    <Plus size={13} /> Use template
                  </button>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}

      {/* ── VIEW 3: API REFERENCE ── */}
      {tab === 'api' && (
        <div className="ws-scroll-page">
          <section className="ws-section">
            <div className="ws-section-head">
              <div>
                <span className="eyebrow">Host Bridge · window.NEXUS</span>
                <h3>Widget API Reference</h3>
              </div>
              <span className="count-label">Sandboxed iframe runtime</span>
            </div>

            <p className="ws-lead">
              Every widget runs inside an isolated iframe with <code>window.NEXUS</code> pre-injected.
              Configuration from <code>widget.json</code> is available synchronously on <code>NEXUS.data</code>.
            </p>

            <div className="ws-api-list">
              {WIDGET_API_ENTRIES.map(entry => (
                <article className="ws-api-item" key={entry.id}>
                  <div className="ws-api-head">
                    <div>
                      <span className="ws-api-cat">{entry.category}</span>
                      <h4>{entry.title}</h4>
                    </div>
                    <div className="ws-api-btns">
                      <button
                        type="button"
                        className="secondary-btn"
                        onClick={() => copySnippet(entry.id, entry.snippet)}
                      >
                        {copiedId === entry.id ? <Check size={12} /> : <Copy size={12} />}
                        {copiedId === entry.id ? 'Copied' : 'Copy'}
                      </button>
                      {selected && (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => appendSnippetToWidget(entry.snippet)}
                        >
                          Insert in {selected.name}
                        </button>
                      )}
                    </div>
                  </div>
                  <code className="ws-api-sig">{entry.signature}</code>
                  <p>{entry.description}</p>
                  <pre className="ws-api-pre"><code>{entry.snippet}</code></pre>
                </article>
              ))}
            </div>
          </section>
        </div>
      )}
    </div>
  );
}