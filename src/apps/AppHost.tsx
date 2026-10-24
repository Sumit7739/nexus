import { useEffect, useRef, useState, type ChangeEvent, type FormEvent, type ReactNode } from 'react';
import { ArrowUpRight, ExternalLink, Globe2, Plus, Search, StickyNote, Pencil, Trash2, Check as CheckIcon, X, Layers, Code2, BookOpen, FileJson, ChevronRight, Sparkles, Database, Palette, Clock3, Bell, ShieldCheck, ExternalLink as ExternalLinkIcon } from 'lucide-react';
import type { AppId } from '../window-manager/types';
import type { DesktopMessage } from '../data/messages';
import { DEFAULT_MESSAGES } from '../data/messages';
import type { WidgetDefinition } from '../widgets/types';
import { createWidget } from '../widgets/types';

const SAVED_APPS_KEY = 'nexus.saved-apps.v1';
const NOTES_KEY      = 'nexus.scratchpad.v1';

interface SavedApp { id: string; title: string; url: string; mode: 'embed' | 'external' }
const DEFAULT_LINKS: SavedApp[] = [
  { id: 'github',  title: 'GitHub',  url: 'https://github.com',     mode: 'external' },
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com', mode: 'embed'    },
  { id: 'reddit',  title: 'Reddit',  url: 'https://www.reddit.com',  mode: 'external' },
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
  theme:             'light' | 'dark';
  wallpaper:         'mist' | 'aurora' | 'dusk' | 'forest' | 'ocean' | 'ember' | 'lavender' | 'midnight' | 'rose' | 'mono' | 'citrus' | 'glacier';
  showSeconds:       boolean;
  arrangeMode:       boolean;
  hasPassword:       boolean;
  msgRefreshMins:    number;
  messages:          DesktopMessage[];
  onToggleTheme:     () => void;
  onWallpaperChange: (w: SettingsProps['wallpaper']) => void;
  onToggleSeconds:   () => void;
  onToggleArrange:   () => void;
  onPassword:        () => void;
  onMsgRefreshChange:(mins: number) => void;
  onMessagesChange:  (msgs: DesktopMessage[]) => void;
  widgets: WidgetDefinition[];
  onWidgetsChange: (widgets: WidgetDefinition[]) => void;
  onPreviewWidget: (widget: WidgetDefinition) => void;
}

export function AppHost({ appId, settings }: { appId: AppId; settings?: SettingsProps }) {
  switch (appId) {
    case 'browser':   return <BrowserApp />;
    case 'youtube':   return <YouTubeApp />;
    case 'notes':     return <NotesApp />;
    case 'bookmarks': return <BookmarksApp />;
    case 'settings':  return settings ? <SettingsApp settings={settings} /> : <div className="empty-state"><span>Settings unavailable.</span></div>;
    case 'widgets':   return settings ? <WidgetStudioApp settings={settings} /> : <div className="empty-state"><span>Widget Studio unavailable.</span></div>;
    default:          return <div className="empty-state"><span>App not found.</span></div>;
  }
}

/* ── Browser ──────────────────────────────────────────────────────────────── */
function BrowserApp() {
  const [url, setUrl]           = useState('https://example.com');
  const [address, setAddress]   = useState('https://example.com');
  const [mode, setMode]         = useState<'embed' | 'external'>('embed');
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
    } catch {}
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
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, note); } catch {} }, [note]);
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
  const [mode, setMode]   = useState<'embed' | 'external'>('external');
  useEffect(() => { try { localStorage.setItem(SAVED_APPS_KEY, JSON.stringify(links)); window.dispatchEvent(new Event('nexus:saved-links-updated')); } catch {} }, [links]);
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

function WidgetStudioApp({ settings }: { settings: SettingsProps }) {
  type StudioPage = 'library' | 'editor' | 'api' | 'guide';
  const [page, setPage] = useState<StudioPage>('library');
  const [selectedId, setSelectedId] = useState<string | null>(settings.widgets[0]?.id ?? null);
  const selected = settings.widgets.find(widget => widget.id === selectedId) ?? null;

  useEffect(() => {
    if (!settings.widgets.some(widget => widget.id === selectedId)) {
      setSelectedId(settings.widgets[0]?.id ?? null);
    }
  }, [settings.widgets, selectedId]);

  const createNewWidget = () => {
    const widget = createWidget(`Widget ${settings.widgets.length + 1}`);
    settings.onWidgetsChange([...settings.widgets, widget]);
    setSelectedId(widget.id);
    setPage('editor');
  };

  const navItems: { id: StudioPage; label: string; description: string; icon: ReactNode }[] = [
    { id: 'library', label: 'My widgets', description: 'Your collection', icon: <Layers size={16} /> },
    { id: 'editor', label: 'Editor', description: 'Build and preview', icon: <Code2 size={16} /> },
    { id: 'api', label: 'Widget API', description: 'Host capabilities', icon: <BookOpen size={16} /> },
    { id: 'guide', label: 'Guides', description: 'Patterns and examples', icon: <FileJson size={16} /> },
  ];

  return <div className="widget-studio-app">
    <header className="widget-studio-app-header">
      <div><span className="eyebrow">NEXUS DEVELOPER TOOLS</span><h2>Widget Studio</h2><p>Build, inspect, and manage the small apps that make your desktop yours.</p></div>
      <div className="widget-studio-app-meta"><span className="studio-status-dot" /> Local widget library <strong>{settings.widgets.length}</strong></div>
    </header>
    <div className="widget-studio-app-body">
      <aside className="widget-studio-sidebar">
        <div className="studio-side-label">WORKSPACE</div>
        {navItems.map(item => <button key={item.id} type="button" className={`studio-side-item ${page === item.id ? 'active' : ''}`} onClick={() => setPage(item.id)}>
          <span>{item.icon}</span><div><strong>{item.label}</strong><small>{item.description}</small></div>{page === item.id && <ChevronRight size={14} className="studio-side-chevron" />}
        </button>)}
        <div className="studio-side-note"><strong>Sandboxed by design</strong><p>Widgets run in an isolated iframe. Host capabilities are available only through the documented <code>window.NEXUS</code> API.</p></div>
      </aside>
      <main className="widget-studio-main">
        {page === 'library' && <section className="studio-page studio-library-page">
          <div className="studio-page-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h3>My widgets</h3><p>Manage your local widgets and jump back into an unfinished build.</p></div><button className="primary-btn" onClick={createNewWidget}><Plus size={14} /> New widget</button></div>
          {settings.widgets.length ? <div className="studio-widget-list">{settings.widgets.map(widget => <article className="studio-widget-card" key={widget.id}>
            <div className="studio-widget-card-icon"><Code2 size={19} /></div><div className="studio-widget-card-copy"><strong>{widget.name}</strong><span>{widget.bounds.width} × {widget.bounds.height} px · Updated {new Date(widget.updatedAt).toLocaleDateString()}</span><small>{widget.source.html.length + widget.source.css.length + widget.source.js.length + widget.source.json.length} characters of source</small></div>
            <button className="settings-action" onClick={() => { setSelectedId(widget.id); setPage('editor'); }}>Open editor <ChevronRight size={13} /></button>
          </article>)}</div> : <div className="studio-empty-library"><div><Layers size={24} /></div><h4>Your widget shelf is empty</h4><p>Create your first widget or import an existing JSON widget from the Editor page.</p><button className="primary-btn" onClick={createNewWidget}><Plus size={14} /> Create a widget</button></div>}
          <div className="studio-library-footnote"><Sparkles size={14} /><span>Widgets are stored locally in this browser profile.</span></div>
        </section>}
        {page === 'editor' && <section className="studio-page studio-editor-page">
          <div className="studio-page-heading compact"><div><span className="eyebrow">SOURCE WORKSPACE</span><h3>Editor</h3><p>Edit widget markup, styling, behavior, and metadata.</p></div></div>
          <WidgetStudio widgets={settings.widgets} onChange={settings.onWidgetsChange} onPreview={settings.onPreviewWidget} selectedId={selectedId} onSelectedIdChange={setSelectedId} />
        </section>}
        {page === 'api' && <section className="studio-page studio-api-page">
          <div className="studio-page-heading"><div><span className="eyebrow">HOST BRIDGE</span><h3>Widget API</h3><p>Widgets run in a sandbox. Use the host bridge for approved workspace capabilities.</p></div><span className="studio-api-badge"><ShieldCheck size={13} /> Sandboxed</span></div>
          <div className="studio-api-notice"><ShieldCheck size={17} /><div><strong>Least privilege by default</strong><p>Widget code does not receive direct extension access. Only the methods explicitly exposed by the host are available.</p></div></div>
          <div className="studio-api-grid">
            <article className="studio-api-card"><div className="studio-api-card-icon purple"><Palette size={17} /></div><h4>Theme</h4><p>Read the current workspace theme and request a theme change when the host permits it.</p><code>NEXUS.getTheme()</code><code>NEXUS.setTheme('dark')</code><code>window.addEventListener('nexus:theme', handler)</code></article>
            <article className="studio-api-card"><div className="studio-api-card-icon green"><Database size={17} /></div><h4>Local storage</h4><p>Persist widget-owned values in a namespace isolated from other widgets.</p><code>NEXUS.getLocal(key)</code><code>NEXUS.setLocal(key, value)</code><code>NEXUS.removeLocal(key)</code></article>
            <article className="studio-api-card"><div className="studio-api-card-icon blue"><Clock3 size={17} /></div><h4>Time and readiness</h4><p>Wait until the host bridge is ready before calling its methods. Listen for supported time updates.</p><code>window.addEventListener('nexus:ready', handler)</code><code>window.addEventListener('nexus:time', handler)</code></article>
            <article className="studio-api-card"><div className="studio-api-card-icon amber"><Bell size={17} /></div><h4>Events and navigation</h4><p>Use only the event and navigation methods implemented by the current host runtime. Validate external URLs before opening them.</p><code>window.addEventListener('nexus:local', handler)</code><code>NEXUS.openUrl(url)</code></article>
          </div>
          <p className="studio-api-footnote">API methods are runtime-dependent. If a method returns a promise, await it; handle failures and missing capabilities gracefully.</p>
        </section>}
        {page === 'guide' && <section className="studio-page studio-guide-page">
          <div className="studio-page-heading"><div><span className="eyebrow">BUILDING BLOCKS</span><h3>Guides & examples</h3><p>A practical starting point for building widgets that behave well inside Nexus.</p></div></div>
          <div className="studio-guide-list">
            <article><span className="studio-guide-number">01</span><div><h4>Keep widgets self-contained</h4><p>Bundle your HTML, CSS, JavaScript, and JSON configuration in the widget definition. Avoid depending on global styles or the parent desktop DOM.</p></div></article>
            <article><span className="studio-guide-number">02</span><div><h4>Initialize after the host is ready</h4><p>Listen for <code>nexus:ready</code> before using host capabilities, and make initialization safe to run only once.</p><pre>{`window.addEventListener('nexus:ready', () => {
  // Initialize your widget here.
}, { once: true });`}</pre></div></article>
            <article><span className="studio-guide-number">03</span><div><h4>React to theme changes</h4><p>Use the theme event to update your widget's own styles. Don't assume the host's CSS automatically crosses the iframe boundary.</p><pre>{`window.addEventListener('nexus:theme', (event) => {
  const theme = event.detail?.theme;
  document.documentElement.dataset.theme = theme;
});`}</pre></div></article>
            <article><span className="studio-guide-number">04</span><div><h4>Make storage resilient</h4><p>Handle unavailable storage and failed requests. Keep values small, JSON-serializable, and specific to the widget's purpose.</p></div></article>
          </div>
          <div className="studio-guide-footer"><ShieldCheck size={15} /><span>Never treat widget source, imported JSON, or external URLs as trusted input.</span></div>
        </section>}
      </main>
    </div>
  </div>;
}

function WidgetStudio({ widgets, onChange, onPreview, selectedId, onSelectedIdChange }: { widgets: WidgetDefinition[]; onChange: (widgets: WidgetDefinition[]) => void; onPreview: (widget: WidgetDefinition) => void; selectedId: string | null; onSelectedIdChange: (id: string | null) => void }) {
  const selected = widgets.find((widget) => widget.id === selectedId) ?? null;
  const update = (patch: Partial<WidgetDefinition>) => {
    if (!selected) return;
    onChange(widgets.map((widget) => widget.id === selected.id ? { ...widget, ...patch, updatedAt: Date.now() } : widget));
  };
  const updateSource = (key: keyof WidgetDefinition['source'], value: string) => {
    if (!selected) return;
    update({ source: { ...selected.source, [key]: value } });
  };
  const updateBound = (key: keyof WidgetDefinition['bounds'], value: number) => {
    if (!selected || !Number.isFinite(value)) return;
    const minimum = key === 'width' ? 160 : key === 'height' ? 100 : 0;
    update({ bounds: { ...selected.bounds, [key]: Math.max(minimum, Math.round(value)) } });
  };
  const adjustBound = (key: keyof WidgetDefinition['bounds'], amount: number) => {
    if (!selected) return;
    updateBound(key, selected.bounds[key] + amount);
  };
  const add = () => {
    const widget = createWidget(`Widget ${widgets.length + 1}`);
    onChange([...widgets, widget]);
    onSelectedIdChange(widget.id);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: `widget-${crypto.randomUUID()}`, name: `${selected.name} copy`, source: { ...selected.source }, updatedAt: Date.now() };
    onChange([...widgets, copy]);
    onSelectedIdChange(copy.id);
  };
  const remove = () => {
    if (!selected) return;
    onChange(widgets.filter((widget) => widget.id !== selected.id));
    onSelectedIdChange(widgets.find((widget) => widget.id !== selected.id)?.id ?? null);
  };
  const exportWidget = () => {
    if (!selected) return;
    const blob = new Blob([JSON.stringify(selected, null, 2)], { type: 'application/json' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob); link.download = `${selected.name.replace(/\s+/g, '-').toLowerCase()}.json`; link.click();
    URL.revokeObjectURL(link.href);
  };
  const importWidget = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]; if (!file) return;
    file.text().then((text) => {
      try {
        const imported = JSON.parse(text) as WidgetDefinition;
        if (imported.version !== 1 || !imported.source) throw new Error('Unsupported widget');
        const widget = { ...imported, id: `widget-${crypto.randomUUID()}`, updatedAt: Date.now() };
        onChange([...widgets, widget]); onSelectedIdChange(widget.id);
      } catch { /* Invalid imports are ignored; the editor remains usable. */ }
    });
    event.target.value = '';
  };
  return <div className="widget-studio">
    <div className="widget-studio-toolbar">
      <select aria-label="Select widget" value={selected?.id ?? ''} onChange={(event) => onSelectedIdChange(event.target.value || null)}>
        <option value="">Choose a widget</option>
        {widgets.map((widget) => <option key={widget.id} value={widget.id}>{widget.name}</option>)}
      </select>
      <button className="settings-action" onClick={add}>New</button>
      <button className="settings-action" onClick={duplicate} disabled={!selected}>Duplicate</button>
      <button className="settings-action" onClick={exportWidget} disabled={!selected}>Export</button>
      <label className="settings-action widget-import">Import<input type="file" accept="application/json" onChange={importWidget} /></label>
      <button className="settings-action danger" onClick={remove} disabled={!selected}>Delete</button>
    </div>
    {selected ? <div className="widget-editor">
      <input className="widget-name-input" value={selected.name} onChange={(event) => update({ name: event.target.value })} aria-label="Widget name" />
      <div className="widget-layout-panel">
        <div className="widget-layout-heading">
          <strong>Layout</strong>
          <span>Set the widget size and desktop position</span>
        </div>
        <div className="widget-layout-grid">
          {([
            ['width', 'Width', 20],
            ['height', 'Height', 20],
            ['x', 'Position X', 24],
            ['y', 'Position Y', 24],
          ] as const).map(([key, label, step]) => (
            <label key={key} className="widget-layout-field">
              <span>{label}</span>
              <div className="widget-stepper">
                <button type="button" onClick={() => adjustBound(key, -step)} aria-label={`Decrease ${label}`}>−</button>
                <input
                  type="number"
                  min={key === 'width' ? 160 : key === 'height' ? 100 : 0}
                  step={step}
                  value={selected.bounds[key]}
                  onChange={(event) => updateBound(key, Number(event.target.value))}
                  aria-label={label}
                />
                <button type="button" onClick={() => adjustBound(key, step)} aria-label={`Increase ${label}`}>+</button>
              </div>
            </label>
          ))}
        </div>
      </div>
      <div className="widget-source-grid">
        {(['html', 'css', 'js', 'json'] as const).map((key) => <label key={key}>{key.toUpperCase()}<textarea value={selected.source[key]} onChange={(event) => updateSource(key, event.target.value)} spellCheck={false} /></label>)}
      </div>
      <div className="widget-editor-actions"><button className="primary-btn" onClick={() => onPreview(selected)}>Preview on desktop</button><span>Sandboxed iframe · no extension access</span></div>
    </div> : <p className="widget-empty">Create or import a widget to start building.</p>}
  </div>;
}

/* ── Messages editor ─────────────────────────────────────────────────────── */
function MessagesEditor({ messages, onChange }: { messages: DesktopMessage[]; onChange: (m: DesktopMessage[]) => void }) {
  const [draft, setDraft]       = useState('');
  const [editId, setEditId]     = useState<string | null>(null);
  const [editText, setEditText] = useState('');
  const editRef = useRef<HTMLInputElement>(null);

  const add = (e: FormEvent) => {
    e.preventDefault();
    const text = draft.trim(); if (!text) return;
    onChange([...messages, { id: `um-${Date.now()}`, text }]);
    setDraft('');
  };

  const startEdit = (msg: DesktopMessage) => {
    setEditId(msg.id); setEditText(msg.text);
    setTimeout(() => editRef.current?.focus(), 30);
  };

  const saveEdit = (id: string) => {
    const text = editText.trim(); if (!text) { setEditId(null); return; }
    onChange(messages.map(m => m.id === id ? { ...m, text } : m));
    setEditId(null);
  };

  const remove = (id: string) => onChange(messages.filter(m => m.id !== id));

  const reset = () => { if (window.confirm('Reset to default messages?')) onChange(DEFAULT_MESSAGES); };

  return (
    <div className="msg-editor">
      <div className="msg-list">
        {messages.map(msg => (
          <div key={msg.id} className={`msg-row ${editId === msg.id ? 'is-editing' : ''}`}>
            {editId === msg.id ? (
              <>
                <input
                  ref={editRef} className="msg-edit-input" value={editText}
                  onChange={e => setEditText(e.target.value)}
                  onKeyDown={e => { if (e.key === 'Enter') saveEdit(msg.id); if (e.key === 'Escape') setEditId(null); }}
                  aria-label="Edit message"
                />
                <button className="msg-icon-btn" onClick={() => saveEdit(msg.id)} aria-label="Save"><CheckIcon size={13} /></button>
                <button className="msg-icon-btn" onClick={() => setEditId(null)} aria-label="Cancel"><X size={13} /></button>
              </>
            ) : (
              <>
                <span className="msg-text">{msg.text}</span>
                <button className="msg-icon-btn" onClick={() => startEdit(msg)} aria-label="Edit"><Pencil size={12} /></button>
                <button className="msg-icon-btn msg-del" onClick={() => remove(msg.id)} aria-label="Delete"><Trash2 size={12} /></button>
              </>
            )}
          </div>
        ))}
        {messages.length === 0 && <p className="msg-empty">No messages. Add one below or reset to defaults.</p>}
      </div>
      <form className="msg-add-form" onSubmit={add}>
        <input value={draft} onChange={e => setDraft(e.target.value)} placeholder="Add a new message…" aria-label="New message text" />
        <button type="submit" className="primary-btn" disabled={!draft.trim()}><Plus size={13} /> Add</button>
      </form>
      <button className="msg-reset-btn" onClick={reset}>Reset to defaults</button>
    </div>
  );
}
