import { useEffect, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, ExternalLink, Globe2, Plus, Search, StickyNote, Trash2 } from 'lucide-react';
import type { AppId } from '../window-manager/types';
import type { DesktopMessage } from '../data/messages';
import type { WidgetDefinition } from '../widgets/types';
import { createWidget } from '../widgets/types';

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

function WidgetStudioApp({ settings }: { settings: SettingsProps }) {
  const [page, setPage] = useState<'collection' | 'editor' | 'api' | 'guides'>('collection');
  const [editingId, setEditingId] = useState<string | null>(
    settings.widgets[0]?.id ?? null
  );

  useEffect(() => {
    if (!editingId || !settings.widgets.some(w => w.id === editingId)) {
      setEditingId(settings.widgets[0]?.id ?? null);
    }
  }, [settings.widgets, editingId]);

  const createAndEdit = () => {
    const widget = createWidget(`Widget ${settings.widgets.length + 1}`);
    settings.onWidgetsChange([...settings.widgets, widget]);
    setEditingId(widget.id);
    setPage('editor');
  };

  const nav = [
    { id: 'collection' as const, icon: '▦', title: 'My widgets', subtitle: 'Your collection' },
    { id: 'editor' as const, icon: '</>', title: 'Editor', subtitle: 'HTML · CSS · JS · JSON' },
    { id: 'api' as const, icon: '⌘', title: 'Widget API', subtitle: 'Host capabilities' },
    { id: 'guides' as const, icon: '▤', title: 'Guides', subtitle: 'Patterns and examples' }
  ];

  return (
    <div className="widget-studio-app">
      <header className="widget-studio-app-header">
        <div>
          <span className="eyebrow">NEXUS DEVELOPER TOOLS</span>
          <h2>Widget Studio</h2>
          <p>Build, inspect, and manage the small apps that make your desktop yours.</p>
        </div>
        <div className="widget-studio-app-meta">
          <span className="studio-status-dot" />
          Local widget library
          <strong>{settings.widgets.length}</strong>
        </div>
      </header>

      <div className="widget-studio-app-body">
        <aside className="widget-studio-sidebar">
          <div className="studio-side-label">WORKSPACE</div>

          {nav.map(item => (
            <button
              key={item.id}
              type="button"
              className={`studio-side-item ${page === item.id ? 'active' : ''}`}
              onClick={() => setPage(item.id)}
              aria-current={page === item.id ? 'page' : undefined}
            >
              <span className="studio-side-icon">{item.icon}</span>
              <div>
                <strong>{item.title}</strong>
                <small>{item.subtitle}</small>
              </div>
              {item.id === 'collection' && <b>{settings.widgets.length}</b>}
            </button>
          ))}

          <div className="studio-side-note">
            <strong>Sandboxed by design</strong>
            <p>
              Widgets run in isolated iframes. Host capabilities are available
              through the documented <code>window.NEXUS</code> API.
            </p>
          </div>
        </aside>

        <main className="widget-studio-main">
          {page === 'collection' && (
            <WidgetCollection
              widgets={settings.widgets}
              onChange={settings.onWidgetsChange}
              onCreate={createAndEdit}
              onEdit={id => {
                setEditingId(id);
                setPage('editor');
              }}
            />
          )}

          {page === 'editor' && (
            <WidgetStudio
              widgets={settings.widgets}
              onChange={settings.onWidgetsChange}
              onPreview={settings.onPreviewWidget}
              editingId={editingId}
              onEditingIdChange={setEditingId}
            />
          )}

          {page === 'api' && (
            <div className="studio-info-page">
              <span className="eyebrow">REFERENCE</span>
              <h2>Widget API</h2>
              <p>Use the host bridge to interact with Nexus.</p>

              <div className="studio-info-grid">
                <article>
                  <h3>Read theme</h3>
                  <code>await window.NEXUS.getTheme()</code>
                  <p>Read the current workspace theme.</p>
                </article>
                <article>
                  <h3>Change theme</h3>
                  <code>await window.NEXUS.setTheme('dark')</code>
                  <p>Request a workspace theme change. Use only if the runtime implements this method.</p>
                </article>
                <article>
                  <h3>Local storage</h3>
                  <code>await window.NEXUS.getLocal('key')</code>
                  <p>Use getLocal, setLocal, getAllLocal, and removeLocal for widget-scoped storage.</p>
                </article>
                <article>
                  <h3>Events</h3>
                  <code>nexus:ready · nexus:theme · nexus:local</code>
                  <p>Listen for initialization and host updates.</p>
                </article>
                <article>
                  <h3>Navigation</h3>
                  <code>window.NEXUS.openUrl(url)</code>
                  <p>Ask the host to open a trusted HTTP or HTTPS destination.</p>
                </article>
              </div>
            </div>
          )}

          {page === 'guides' && (
            <div className="studio-info-page">
              <span className="eyebrow">DOCUMENTATION</span>
              <h2>Widget guides</h2>
              <p>Build small, resilient widgets that fit naturally into the Nexus desktop.</p>

              <div className="studio-guide-list">
                <article>
                  <h3>01 — Structure</h3>
                  <p>Keep markup, styling, behavior, and metadata in their respective files.</p>
                </article>
                <article>
                  <h3>02 — Initialization</h3>
                  <p>Listen for the ready event and avoid registering duplicate listeners.</p>
                </article>
                <article>
                  <h3>03 — Persistence</h3>
                  <p>Use the host-backed storage API and handle failed requests gracefully.</p>
                </article>
                <article>
                  <h3>04 — Theme support</h3>
                  <p>Read the current theme on startup and respond to theme updates.</p>
                </article>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
}

function WidgetCollection({
  widgets,
  onChange,
  onCreate,
  onEdit
}: {
  widgets: WidgetDefinition[];
  onChange: (widgets: WidgetDefinition[]) => void;
  onCreate: () => void;
  onEdit: (id: string) => void;
}) {
  const toggleWidget = (id: string, visible: boolean) => {
    onChange(
      widgets.map(widget =>
        widget.id === id
          ? { ...widget, visible, updatedAt: Date.now() }
          : widget
      )
    );
  };

  return (
    <section className="studio-collection-page">
      <div className="studio-page-heading">
        <div>
          <span className="eyebrow">YOUR LIBRARY</span>
          <h2>My widgets</h2>
          <p>Manage your widgets and control which ones appear on the desktop.</p>
        </div>

        <button className="primary-btn" onClick={onCreate}>
          <Plus size={15} /> New widget
        </button>
      </div>

      {widgets.length === 0 ? (
        <div className="studio-collection-empty">
          <h3>Your widget library is empty</h3>
          <p>Create a widget to start building your own desktop tools.</p>
          <button className="primary-btn" onClick={onCreate}>
            <Plus size={15} /> Create widget
          </button>
        </div>
      ) : (
        <div className="studio-widget-cards">
          {widgets.map(widget => (
            <article className="studio-widget-card" key={widget.id}>
              <div className="studio-widget-card-icon">▦</div>

              <div className="studio-widget-card-content">
                <h3>{widget.name}</h3>
                <p>
                  {widget.bounds.width} × {widget.bounds.height} px
                  {' · '}
                  Updated {new Date(widget.updatedAt).toLocaleDateString()}
                </p>

                <span
                  className={`studio-visibility-state ${widget.visible ? 'is-visible' : 'is-hidden'
                    }`}
                >
                  <i />
                  {widget.visible ? 'Visible on desktop' : 'Hidden from desktop'}
                </span>
              </div>

              <label className="studio-visibility-toggle">
                <input
                  type="checkbox"
                  checked={widget.visible}
                  onChange={event =>
                    toggleWidget(widget.id, event.target.checked)
                  }
                  aria-label={`${widget.visible ? 'Disable' : 'Enable'} ${widget.name}`}
                />
                <span className="studio-toggle-track" />
                <span>{widget.visible ? 'Enabled' : 'Disabled'}</span>
              </label>

              <button
                className="settings-action"
                onClick={() => onEdit(widget.id)}
              >
                Edit widget
              </button>
            </article>
          ))}
        </div>
      )}
    </section>
  );
}

function WidgetStudio({
  widgets,
  onChange,
  onPreview,
  editingId,
  onEditingIdChange
}: {
  widgets: WidgetDefinition[];
  onChange: (widgets: WidgetDefinition[]) => void;
  onPreview: (widget: WidgetDefinition) => void;
  editingId: string | null;
  onEditingIdChange: (id: string | null) => void;
}) {
  const [activeFile, setActiveFile] =
    useState<keyof WidgetDefinition['source']>('html');

  const selected =
    widgets.find(widget => widget.id === editingId) ?? null;

  const files: {
    key: keyof WidgetDefinition['source'];
    label: string;
    icon: string;
    description: string;
  }[] = [
      { key: 'html', label: 'index.html', icon: '◇', description: 'Markup and structure' },
      { key: 'css', label: 'style.css', icon: '◈', description: 'Visual styling' },
      { key: 'js', label: 'script.js', icon: '⌘', description: 'Interactions and logic' },
      { key: 'json', label: 'widget.json', icon: '{}', description: 'Metadata and settings' }
    ];

  const update = (patch: Partial<WidgetDefinition>) => {
    if (!selected) return;

    onChange(
      widgets.map(widget =>
        widget.id === selected.id
          ? { ...widget, ...patch, updatedAt: Date.now() }
          : widget
      )
    );
  };

  const updateSource = (
    key: keyof WidgetDefinition['source'],
    value: string
  ) => {
    if (!selected) return;
    update({ source: { ...selected.source, [key]: value } });
  };

  const updateBound = (
    key: keyof WidgetDefinition['bounds'],
    value: number
  ) => {
    if (!selected || !Number.isFinite(value)) return;

    const minimum = key === 'width' ? 160 : key === 'height' ? 100 : 0;

    update({
      bounds: {
        ...selected.bounds,
        [key]: Math.max(minimum, Math.round(value))
      }
    });
  };

  const adjustBound = (
    key: keyof WidgetDefinition['bounds'],
    amount: number
  ) => {
    if (selected) updateBound(key, selected.bounds[key] + amount);
  };

  const add = () => {
    const widget = createWidget(`Widget ${widgets.length + 1}`);
    onChange([...widgets, widget]);
    onEditingIdChange(widget.id);
    setActiveFile('html');
  };

  const duplicate = () => {
    if (!selected) return;

    const copy: WidgetDefinition = {
      ...selected,
      id: `widget-${crypto.randomUUID()}`,
      name: `${selected.name} copy`,
      source: { ...selected.source },
      updatedAt: Date.now()
    };

    onChange([...widgets, copy]);
    onEditingIdChange(copy.id);
  };

  const remove = () => {
    if (!selected || !window.confirm(`Delete ${selected.name}?`)) return;

    const remaining = widgets.filter(widget => widget.id !== selected.id);
    onChange(remaining);
    onEditingIdChange(remaining[0]?.id ?? null);
  };

  const exportWidget = () => {
    if (!selected) return;

    const blob = new Blob(
      [JSON.stringify(selected, null, 2)],
      { type: 'application/json' }
    );

    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${selected.name.replace(/\s+/g, '-').toLowerCase()}.json`;
    link.click();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const importWidget = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
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
        updatedAt: Date.now()
      };

      onChange([...widgets, widget]);
      onEditingIdChange(widget.id);
      setActiveFile('html');
    } catch {
      window.alert('Could not import this widget. Check the JSON file format.');
    } finally {
      event.target.value = '';
    }
  };

  return (
    <div className="widget-studio-editor-page">
      <div className="studio-editor-heading">
        <div>
          <span className="eyebrow">SOURCE WORKSPACE</span>
          <h2>Editor</h2>
          <p>Edit each source file independently.</p>
        </div>

        <div className="studio-editor-actions">
          <button className="settings-action" onClick={add}>
            <Plus size={14} /> New
          </button>
          <button className="settings-action" onClick={duplicate} disabled={!selected}>
            Duplicate
          </button>
          <button className="settings-action" onClick={exportWidget} disabled={!selected}>
            Export
          </button>
          <label className="settings-action widget-import">
            Import
            <input type="file" accept="application/json,.json" onChange={importWidget} />
          </label>
          <button className="settings-action danger" onClick={remove} disabled={!selected}>
            Delete
          </button>
        </div>
      </div>

      {!selected ? (
        <div className="studio-collection-empty">
          <h3>No widget selected</h3>
          <p>Create or import a widget to start editing.</p>
          <button className="primary-btn" onClick={add}>
            <Plus size={15} /> New widget
          </button>
        </div>
      ) : (
        <>
          <div className="studio-editor-toolbar">
            <select
              aria-label="Select widget"
              value={selected.id}
              onChange={event => onEditingIdChange(event.target.value || null)}
            >
              {widgets.map(widget => (
                <option key={widget.id} value={widget.id}>{widget.name}</option>
              ))}
            </select>

            <input
              className="widget-name-input"
              value={selected.name}
              onChange={event => update({ name: event.target.value })}
              aria-label="Widget name"
            />

            <button
              className="settings-action"
              onClick={() => update({ visible: !selected.visible })}
            >
              {selected.visible ? 'Disable on desktop' : 'Enable on desktop'}
            </button>
          </div>

          <div className="studio-code-workspace">
            <aside className="studio-file-tree">
              <div className="studio-file-tree-heading">
                EXPLORER <span>{selected.name}</span>
              </div>

              <div className="studio-file-tree-folder">▾ <strong>WIDGET</strong></div>

              {files.map(file => (
                <button
                  type="button"
                  key={file.key}
                  className={`studio-file-tree-item ${activeFile === file.key ? 'active' : ''
                    }`}
                  onClick={() => setActiveFile(file.key)}
                >
                  <span className={`studio-file-icon file-${file.key}`}>
                    {file.icon}
                  </span>
                  <span>{file.label}</span>
                </button>
              ))}

              <div className="studio-file-tree-hint">
                {files.find(file => file.key === activeFile)?.description}
              </div>
            </aside>

            <section className="studio-file-editor">
              <div className="studio-file-tab">
                <span className={`studio-file-icon file-${activeFile}`}>
                  {files.find(file => file.key === activeFile)?.icon}
                </span>
                {files.find(file => file.key === activeFile)?.label}
                <span className="studio-file-tab-status">Saved automatically</span>
              </div>

              <div className="studio-file-editor-content">
                <div className="studio-file-editor-toolbar">
                  <span>{activeFile.toUpperCase()}</span>
                  <span>{files.find(file => file.key === activeFile)?.description}</span>
                </div>

                <textarea
                  className="studio-code-textarea"
                  aria-label={`${activeFile} source`}
                  value={selected.source[activeFile]}
                  onChange={event => updateSource(activeFile, event.target.value)}
                  spellCheck={false}
                  autoCapitalize="off"
                  autoCorrect="off"
                />
              </div>
            </section>
          </div>

          <div className="studio-layout-panel">
            <div className="studio-layout-panel-heading">
              <strong>Desktop placement</strong>
              <span>Size and position in pixels</span>
            </div>

            <div className="widget-layout-grid">
              {([
                ['width', 'Width', 20],
                ['height', 'Height', 20],
                ['x', 'Position X', 24],
                ['y', 'Position Y', 24]
              ] as const).map(([key, label, step]) => (
                <label key={key} className="widget-layout-field">
                  <span>{label}</span>
                  <div className="widget-stepper">
                    <button type="button" onClick={() => adjustBound(key, -step)}>−</button>
                    <input
                      type="number"
                      min={key === 'width' ? 160 : key === 'height' ? 100 : 0}
                      step={step}
                      value={selected.bounds[key]}
                      onChange={event => updateBound(key, Number(event.target.value))}
                      aria-label={label}
                    />
                    <button type="button" onClick={() => adjustBound(key, step)}>+</button>
                  </div>
                </label>
              ))}
            </div>
          </div>

          <div className="studio-preview-bar">
            <span>Changes save automatically to the local widget library.</span>
            <button className="primary-btn" onClick={() => onPreview(selected)}>
              Preview on desktop <ArrowUpRight size={14} />
            </button>
          </div>
        </>
      )}
    </div>
  );
}