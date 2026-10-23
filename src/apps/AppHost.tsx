import { useEffect, useRef, useState, type ChangeEvent, type FormEvent } from 'react';
import { ArrowUpRight, ExternalLink, Globe2, Plus, Search, StickyNote, Pencil, Trash2, Check as CheckIcon, X } from 'lucide-react';
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
  wallpaper:         'mist' | 'aurora' | 'dusk' | 'forest';
  showSeconds:       boolean;
  arrangeMode:       boolean;
  hasPassword:       boolean;
  msgRefreshMins:    number;
  messages:          DesktopMessage[];
  onToggleTheme:     () => void;
  onWallpaperChange: (w: 'mist' | 'aurora' | 'dusk' | 'forest') => void;
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
  useEffect(() => { try { localStorage.setItem(SAVED_APPS_KEY, JSON.stringify(links)); } catch {} }, [links]);
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
  return (
    <div className="settings-app">
      <div className="settings-hero">
        <span className="eyebrow">Nexus</span>
        <h3>Make it yours.</h3>
        <p>Everything stays local — no account, no sync, no tracking.</p>
      </div>

      {/* Appearance */}
      <section className="settings-group">
        <div className="settings-group-heading"><strong>Appearance</strong><span>Canvas and presentation</span></div>
        <div className="settings-row">
          <div><strong>Theme</strong><span>{settings.theme === 'dark' ? 'Dark — warm charcoal' : 'Light — off-white paper'}</span></div>
          <button className="settings-action" onClick={settings.onToggleTheme}>{settings.theme === 'dark' ? 'Use light' : 'Use dark'}</button>
        </div>
        <div className="settings-row">
          <div><strong>Wallpaper</strong><span>Desktop atmosphere</span></div>
          <select value={settings.wallpaper} onChange={e => settings.onWallpaperChange(e.target.value as SettingsProps['wallpaper'])} aria-label="Wallpaper">
            <option value="mist">Soft mist</option>
            <option value="aurora">Aurora</option>
            <option value="dusk">Warm dusk</option>
            <option value="forest">Forest</option>
          </select>
        </div>
      </section>

      <section className="settings-group widget-studio-section">
        <div className="settings-group-heading"><strong>Widget studio</strong><span>Build local widgets from HTML, CSS, JavaScript and JSON</span></div>
        <WidgetStudio widgets={settings.widgets} onChange={settings.onWidgetsChange} onPreview={settings.onPreviewWidget} />
      </section>

      {/* Desktop */}
      <section className="settings-group">
        <div className="settings-group-heading"><strong>Desktop</strong><span>Workspace behaviour</span></div>
        <div className="settings-row">
          <div><strong>Arrange mode</strong><span>Drag desktop icons to reposition</span></div>
          <button className="settings-action" onClick={settings.onToggleArrange}>{settings.arrangeMode ? 'Done' : 'Arrange'}</button>
        </div>
        <div className="settings-row">
          <div><strong>Clock seconds</strong><span>Show seconds in the clock</span></div>
          <button className={`settings-switch ${settings.showSeconds ? 'is-on' : ''}`} onClick={settings.onToggleSeconds} aria-label="Toggle seconds" aria-pressed={settings.showSeconds}><span /></button>
        </div>
      </section>

      {/* Desktop Messages */}
      <section className="settings-group">
        <div className="settings-group-heading"><strong>Desktop messages</strong><span>The text that rotates on your desktop</span></div>
        <div className="settings-row">
          <div><strong>Refresh interval</strong><span>How often the message changes</span></div>
          <select
            value={settings.msgRefreshMins}
            onChange={e => settings.onMsgRefreshChange(Number(e.target.value))}
            aria-label="Message refresh interval"
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
        <MessagesEditor messages={settings.messages} onChange={settings.onMessagesChange} />
      </section>

      {/* Privacy */}
      <section className="settings-group">
        <div className="settings-group-heading"><strong>Privacy</strong><span>Local protection</span></div>
        <div className="settings-row">
          <div><strong>Workspace passcode</strong><span>{settings.hasPassword ? 'Lock screen enabled' : 'No passcode set'}</span></div>
          <button className="settings-action" onClick={settings.onPassword}>{settings.hasPassword ? 'Change' : 'Set up'}</button>
        </div>
        <div className="settings-row">
          <div><strong>Storage</strong><span>No server, no account, no analytics</span></div>
          <span className="status-dot-label"><i />Local only</span>
        </div>
      </section>
    </div>
  );
}

function WidgetStudio({ widgets, onChange, onPreview }: { widgets: WidgetDefinition[]; onChange: (widgets: WidgetDefinition[]) => void; onPreview: (widget: WidgetDefinition) => void }) {
  const [selectedId, setSelectedId] = useState<string | null>(widgets[0]?.id ?? null);
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
    setSelectedId(widget.id);
  };
  const duplicate = () => {
    if (!selected) return;
    const copy = { ...selected, id: `widget-${crypto.randomUUID()}`, name: `${selected.name} copy`, source: { ...selected.source }, updatedAt: Date.now() };
    onChange([...widgets, copy]);
    setSelectedId(copy.id);
  };
  const remove = () => {
    if (!selected) return;
    onChange(widgets.filter((widget) => widget.id !== selected.id));
    setSelectedId(widgets.find((widget) => widget.id !== selected.id)?.id ?? null);
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
        onChange([...widgets, widget]); setSelectedId(widget.id);
      } catch { /* Invalid imports are ignored; the editor remains usable. */ }
    });
    event.target.value = '';
  };
  return <div className="widget-studio">
    <div className="widget-studio-toolbar">
      <select aria-label="Select widget" value={selected?.id ?? ''} onChange={(event) => setSelectedId(event.target.value || null)}>
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
