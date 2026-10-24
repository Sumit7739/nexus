import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowUpRight, Check, Copy, Crosshair, Download, ExternalLink,
  Globe2, Plus, RefreshCw, Search, StickyNote, Trash2, Upload,
} from 'lucide-react';
import type { AppId } from '../window-manager/types';
import type { DesktopMessage } from '../data/messages';
import type { WidgetDefinition, WidgetSource } from '../widgets/types';
import { createWidget } from '../widgets/types';
import { WidgetRuntime } from '../widgets/WidgetRuntime';
import { instantiateTemplate, WIDGET_API_ENTRIES, WIDGET_TEMPLATES } from '../widgets/templates';

const SAVED_APPS_KEY = 'nexus.saved-apps.v1';
const NOTES_KEY = 'nexus.scratchpad.v1';

interface SavedApp { id: string; title: string; url: string; mode: 'embed' | 'external' }
const DEFAULT_LINKS: SavedApp[] = [
  { id: 'github', title: 'GitHub', url: 'https://github.com', mode: 'external' },
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com', mode: 'embed' },
  { id: 'reddit', title: 'Reddit', url: 'https://www.reddit.com', mode: 'external' },
];

function normalizeHttpUrl(value: string): string | null {
  const candidate = value.trim();
  if (!candidate) return null;
  const normalized = /^https?:\/\//i.test(candidate) ? candidate : `https://${candidate}`;
  try {
    const parsed = new URL(normalized);
    return parsed.protocol === 'http:' || parsed.protocol === 'https:' ? parsed.href : null;
  } catch { return null; }
}

function readLinks(): SavedApp[] {
  try {
    const raw = localStorage.getItem(SAVED_APPS_KEY);
    if (!raw) return DEFAULT_LINKS;
    const saved = JSON.parse(raw);
    return Array.isArray(saved) && saved.every(l =>
      l && typeof l.id === 'string' && typeof l.title === 'string' &&
      typeof l.url === 'string' && (l.mode === 'embed' || l.mode === 'external') &&
      normalizeHttpUrl(l.url) !== null
    ) ? saved as SavedApp[] : DEFAULT_LINKS;
  } catch { return DEFAULT_LINKS; }
}

/* ── SettingsProps — aligned with App.tsx ─────────────────────────────────── */
export interface SettingsProps {
  theme: 'light' | 'dark';
  wallpaper: 'mist' | 'aurora' | 'dusk' | 'forest' | 'ocean' | 'ember' | 'lavender' | 'midnight' | 'rose' | 'mono' | 'citrus' | 'glacier';
  showSeconds: boolean;
  arrangeMode: boolean;
  hasPassword: boolean;
  msgRefreshMins: number;
  messages: DesktopMessage[];
  onToggleTheme: () => void;
  onWallpaperChange: (w: SettingsProps['wallpaper']) => void;
  onToggleSeconds: () => void;
  onToggleArrange: () => void;
  onPassword: () => void;
  onMsgRefreshChange: (mins: number) => void;
  onMessagesChange: (msgs: DesktopMessage[]) => void;
  widgets: WidgetDefinition[];
  onWidgetsChange: (widgets: WidgetDefinition[]) => void;
  onPreviewWidget: (widget: WidgetDefinition) => void;
  onOpenApp?: (appId: AppId) => void;
}

export function AppHost({ appId, settings }: { appId: AppId; settings?: SettingsProps }) {
  switch (appId) {
    case 'browser': return <BrowserApp />;
    case 'youtube': return <YouTubeApp />;
    case 'notes': return <NotesApp />;
    case 'bookmarks': return <BookmarksApp />;
    case 'settings': return settings ? <SettingsApp settings={settings} /> : <div className="empty-state"><span>Settings unavailable.</span></div>;
    case 'widgets': return settings ? <WidgetStudioApp settings={settings} /> : <div className="empty-state"><span>Widget Studio unavailable.</span></div>;
    default: return <div className="empty-state"><span>App not found.</span></div>;
  }
}

/* ── Browser ──────────────────────────────────────────────────────────────── */
function BrowserApp() {
  const [url, setUrl] = useState('https://example.com');
  const [address, setAddress] = useState('https://example.com');
  const [mode, setMode] = useState<'embed' | 'external'>('embed');
  const [showFallback, setShowFallback] = useState(false);
  const navigate = () => {
    const n = normalizeHttpUrl(address); if (!n) return;
    setUrl(n); setShowFallback(false);
    if (mode === 'external') window.open(n, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="web-app">
      <form className="address-bar" onSubmit={e => { e.preventDefault(); navigate(); }}>
        <button type="button" className={`mode-pill ${mode === 'external' ? 'external' : ''}`} onClick={() => setMode(m => m === 'embed' ? 'external' : 'embed')}>
          {mode === 'embed' ? 'Window' : 'Browser tab'}
        </button>
        <Search size={14} className="address-search-icon" />
        <input className="address-input" value={address} onChange={e => setAddress(e.target.value)} aria-label="Website address" spellCheck={false} />
        <button className="icon-btn" type="submit" aria-label="Go"><ArrowUpRight size={15} /></button>
      </form>
      {mode === 'external' ? (
        <div className="empty-state"><ExternalLink size={22} /><strong>Open in your browser</strong><span>External mode opens sites in a real tab for full compatibility.</span><button className="primary-btn" onClick={navigate}>Open website</button></div>
      ) : showFallback ? (
        <div className="empty-state"><Globe2 size={22} /><strong>Site blocked embedding</strong><span>Some sites refuse to load inside another page.</span><button className="primary-btn" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Open in browser <ExternalLink size={13} /></button></div>
      ) : (
        <iframe className="web-frame" title="Website preview" src={url} sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" />
      )}
      {mode === 'embed' && (
        <div className="web-app-footer">
          <span>Embedded sites may restrict features.</span>
          <button onClick={() => setShowFallback(true)}>Can't see it?</button>
          <button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={11} /> Open externally</button>
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
      <div className="web-app-footer"><span>Official YouTube embedded player.</span><button onClick={() => window.open(`https://www.youtube.com/watch?v=${video}`, '_blank', 'noopener,noreferrer')}><ExternalLink size={11} /> Watch on YouTube</button></div>
    </div>
  );
}

/* ── Notes ────────────────────────────────────────────────────────────────── */
function NotesApp() {
  const [note, setNote] = useState(() => { try { return localStorage.getItem(NOTES_KEY) ?? ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, note); } catch { } }, [note]);
  return (
    <div className="notes-app">
      <div className="notes-heading"><StickyNote size={14} strokeWidth={1.5} /><span>Scratchpad</span><span className="saved-indicator">Saved locally</span></div>
      <textarea value={note} onChange={e => setNote(e.target.value)} placeholder="A thought, a task, a suspiciously ambitious project idea…" aria-label="Scratchpad note" />
    </div>
  );
}

/* ── Bookmarks ────────────────────────────────────────────────────────────── */
function BookmarksApp() {
  const [links, setLinks] = useState<SavedApp[]>(readLinks);
  const [title, setTitle] = useState(''); const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'embed' | 'external'>('external');
  useEffect(() => { try { localStorage.setItem(SAVED_APPS_KEY, JSON.stringify(links)); window.dispatchEvent(new Event('nexus:saved-links-updated')); } catch { } }, [links]);
  const addLink = (e: FormEvent) => {
    e.preventDefault();
    const n = normalizeHttpUrl(url); if (!n || !title.trim()) return;
    setLinks(items => [...items, { id: crypto.randomUUID(), title: title.trim(), url: n, mode }]);
    setTitle(''); setUrl('');
  };
  return (
    <div className="bookmarks-app">
      <div className="app-section-heading"><div><span className="eyebrow">Your Collection</span><h3>Saved destinations</h3></div><span className="count-label">{links.length} links</span></div>
      <div className="saved-link-list">
        {links.map(link => (
          <div className="saved-link" key={link.id}>
            <div className="link-monogram">{link.title.slice(0, 1).toUpperCase()}</div>
            <div className="saved-link-copy"><strong>{link.title}</strong><span>{link.url}</span></div>
            <button className="icon-btn" onClick={() => window.open(link.url, '_blank', 'noopener,noreferrer')} aria-label={`Open ${link.title}`}><ArrowUpRight size={14} /></button>
            <button className="icon-btn" onClick={() => setLinks(items => items.filter(i => i.id !== link.id))} aria-label={`Remove ${link.title}`} style={{ fontSize: 16, fontWeight: 300 }}>×</button>
          </div>
        ))}
      </div>
      <form className="add-link-form" onSubmit={addLink}>
        <input placeholder="Name" value={title} onChange={e => setTitle(e.target.value)} aria-label="Bookmark name" required />
        <input placeholder="https://example.com" value={url} onChange={e => setUrl(e.target.value)} aria-label="Bookmark URL" required />
        <select value={mode} onChange={e => setMode(e.target.value as 'embed' | 'external')} aria-label="Opening mode">
          <option value="external">External tab</option>
          <option value="embed">Try embed</option>
        </select>
        <button className="primary-btn" type="submit"><Plus size={13} /> Add</button>
      </form>
    </div>
  );
}

/* ── Settings ─────────────────────────────────────────────────────────────── */
function SettingsApp({ settings }: { settings: SettingsProps }) {
  const [section, setSection] = useState<'appearance' | 'desktop' | 'messages' | 'privacy'>('appearance');
  const nav = [
    { id: 'appearance' as const, label: 'Appearance', icon: '◐', detail: 'Theme and wallpaper' },
    { id: 'desktop' as const, label: 'Desktop', icon: '▦', detail: 'Workspace behavior' },
    { id: 'messages' as const, label: 'Desktop messages', icon: '✳', detail: 'Rotating notes' },
    { id: 'privacy' as const, label: 'Privacy', icon: '◇', detail: 'Local protection' },
  ];
  const current = nav.find(item => item.id === section)!;
  return (
    <div className="settings-shell">
      <aside className="settings-sidebar">
        <div className="settings-sidebar-brand"><span className="settings-brand-mark">N</span><div><strong>Settings</strong><span>Customize Nexus</span></div></div>
        <div className="settings-nav-label">PREFERENCES</div>
        <nav className="settings-nav" aria-label="Settings sections">
          {nav.map(item => <button key={item.id} className={`settings-nav-item ${section === item.id ? 'is-active' : ''}`} onClick={() => setSection(item.id)} aria-current={section === item.id ? 'page' : undefined}><span className="settings-nav-icon">{item.icon}</span><span className="settings-nav-copy"><strong>{item.label}</strong><small>{item.detail}</small></span>{section === item.id && <span className="settings-nav-indicator" />}</button>)}
        </nav>
        <div className="settings-sidebar-footer"><span className="settings-sidebar-dot" /> Local workspace</div>
      </aside>
      <main className="settings-content">
        <header className="settings-page-header"><div><span className="eyebrow">NEXUS PREFERENCES</span><h3>{current.label}</h3><p>{current.detail}. Make your workspace feel right.</p></div><span className="settings-page-index">0{nav.findIndex(item => item.id === section) + 1} <i>/ 04</i></span></header>
        {section === 'appearance' && <section className="settings-group settings-panel"><div className="settings-group-heading"><strong>Appearance</strong><span>Canvas and presentation</span></div>
          <div className="settings-row"><div><strong>Color theme</strong><span>{settings.theme === 'dark' ? 'Dark — warm charcoal' : 'Light — soft paper'}</span></div><button className="settings-action" onClick={settings.onToggleTheme}>{settings.theme === 'dark' ? 'Use light theme' : 'Use dark theme'}</button></div>
          <div className="settings-row"><div><strong>Desktop wallpaper</strong><span>Choose the atmosphere behind your workspace</span></div><select value={settings.wallpaper} onChange={e => settings.onWallpaperChange(e.target.value as SettingsProps['wallpaper'])} aria-label="Wallpaper"><option value="mist">Soft mist</option><option value="aurora">Aurora</option><option value="dusk">Warm dusk</option><option value="forest">Forest</option><option value="ocean">Ocean glass</option><option value="ember">Ember</option><option value="lavender">Lavender haze</option><option value="midnight">Midnight</option><option value="rose">Rosewater</option><option value="mono">Monochrome</option><option value="citrus">Citrus</option><option value="glacier">Glacier</option></select></div>
        </section>}
        {section === 'desktop' && <section className="settings-group settings-panel"><div className="settings-group-heading"><strong>Desktop behavior</strong><span>Control how the workspace feels</span></div>
          <div className="settings-row"><div><strong>Arrange mode</strong><span>Move desktop icons to your preferred positions</span></div><button className="settings-action" onClick={settings.onToggleArrange}>{settings.arrangeMode ? 'Finish arranging' : 'Arrange icons'}</button></div>
          <div className="settings-row"><div><strong>Clock seconds</strong><span>Show seconds in the desktop clock</span></div><button className={`settings-switch ${settings.showSeconds ? 'is-on' : ''}`} onClick={settings.onToggleSeconds} aria-label="Toggle seconds" aria-pressed={settings.showSeconds}><span /></button></div>
        </section>}
        {section === 'messages' && <section className="settings-group settings-panel"><div className="settings-group-heading"><strong>Desktop messages</strong><span>Small notes, dev jokes, and reminders that rotate on your desktop</span></div>
          <div className="settings-row"><div><strong>Refresh interval</strong><span>How often the message changes</span></div><select value={settings.msgRefreshMins} onChange={e => settings.onMsgRefreshChange(Number(e.target.value))} aria-label="Message refresh interval"><option value={1}>Every minute</option><option value={2}>Every 2 minutes</option><option value={5}>Every 5 minutes</option><option value={10}>Every 10 minutes</option><option value={15}>Every 15 minutes</option><option value={30}>Every 30 minutes</option><option value={60}>Every hour</option></select></div>
          <MessagesEditor messages={settings.messages} onChange={settings.onMessagesChange} />
        </section>}
        {section === 'privacy' && <section className="settings-group settings-panel"><div className="settings-group-heading"><strong>Privacy and security</strong><span>Local protection and data handling</span></div>
          <div className="settings-row"><div><strong>Workspace passcode</strong><span>{settings.hasPassword ? 'Lock screen enabled' : 'No passcode set'}</span></div><button className="settings-action" onClick={settings.onPassword}>{settings.hasPassword ? 'Change passcode' : 'Set up passcode'}</button></div>
          <div className="settings-row"><div><strong>Storage</strong><span>Your workspace data stays in this browser</span></div><span className="status-dot-label"><i />Local only</span></div>
        </section>}
        <div className="settings-content-footer"><span>Changes save automatically</span><span>NEXUS · 0.7.0</span></div>
      </main>
    </div>
  );
}

function MessagesEditor({ messages, onChange }: { messages: DesktopMessage[]; onChange: (messages: DesktopMessage[]) => void }) {
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
    <div className="messages-editor">
      {messages.map(message => (
        <div className="messages-editor-row" key={message.id}>
          <input
            value={message.text}
            onChange={event => updateMessage(message.id, event.target.value)}
            aria-label="Desktop message"
            placeholder="Write a desktop message"
          />
          <button type="button" className="icon-btn" onClick={() => removeMessage(message.id)} disabled={messages.length <= 1} aria-label="Remove message">
            <Trash2 size={14} />
          </button>
        </div>
      ))}
      <button type="button" className="secondary-btn" onClick={addMessage}>
        <Plus size={13} /> Add message
      </button>
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

const VALID_APP_IDS: AppId[] = ['browser', 'youtube', 'notes', 'bookmarks', 'settings', 'widgets'];

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
                            if (settings.onOpenApp && VALID_APP_IDS.includes(appId as AppId)) {
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