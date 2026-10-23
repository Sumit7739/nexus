import { useEffect, useState, type FormEvent } from 'react';
import { ArrowUpRight, ExternalLink, Globe2, Plus, Search, StickyNote } from 'lucide-react';
import type { AppId } from '../window-manager/types';

const SAVED_APPS_KEY = 'nexus.saved-apps.v1';
const NOTES_KEY = 'nexus.scratchpad.v1';
interface SavedApp { id: string; title: string; url: string; mode: 'embed' | 'external' }
const DEFAULT_LINKS: SavedApp[] = [
  { id: 'github', title: 'GitHub', url: 'https://github.com', mode: 'external' },
  { id: 'youtube', title: 'YouTube', url: 'https://www.youtube.com', mode: 'embed' },
  { id: 'reddit', title: 'Reddit', url: 'https://www.reddit.com', mode: 'external' },
];

function readLinks(): SavedApp[] {
  try { const raw = localStorage.getItem(SAVED_APPS_KEY); return raw ? JSON.parse(raw) as SavedApp[] : DEFAULT_LINKS; }
  catch { return DEFAULT_LINKS; }
}

export function AppHost({ appId }: { appId: AppId }) {
  switch (appId) {
    case 'browser': return <BrowserApp />;
    case 'youtube': return <YouTubeApp />;
    case 'notes': return <NotesApp />;
    case 'bookmarks': return <BookmarksApp />;
    case 'settings': return <SettingsApp />;
    default: return <div className="empty-state">This app isn't available yet.</div>;
  }
}

function BrowserApp() {
  const [url, setUrl] = useState('https://example.com');
  const [address, setAddress] = useState('https://example.com');
  const [mode, setMode] = useState<'embed' | 'external'>('embed');
  const [showFallback, setShowFallback] = useState(false);
  const navigate = () => {
    let normalized = address.trim();
    if (!normalized) return;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try { new URL(normalized); } catch { return; }
    setUrl(normalized);
    setShowFallback(false);
    if (mode === 'external') window.open(normalized, '_blank', 'noopener,noreferrer');
  };
  return (
    <div className="web-app">
      <form className="address-bar" onSubmit={(event) => { event.preventDefault(); navigate(); }}>
        <button type="button" className={`mode-pill ${mode}`} onClick={() => setMode(mode === 'embed' ? 'external' : 'embed')} title="Toggle embedded or external mode">{mode === 'embed' ? 'Window' : 'Browser tab'}</button>
        <Search size={15} className="address-search-icon" />
        <input value={address} onChange={(event) => setAddress(event.target.value)} aria-label="Website address" spellCheck={false} />
        <button className="icon-button" type="submit" aria-label="Go to address"><ArrowUpRight size={16} /></button>
      </form>
      {mode === 'external' ? (
        <div className="empty-state"><ExternalLink size={25} /><strong>Open in your browser</strong><span>This mode uses a real browser tab for sites that need full browser capabilities.</span><button className="button-primary" onClick={navigate}>Open website</button></div>
      ) : showFallback ? (
        <div className="empty-state"><Globe2 size={25} /><strong>This site may not allow embedding</strong><span>Some sites block being displayed inside another page. Nexus can't override that browser security rule.</span><button className="button-primary" onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}>Open in browser <ExternalLink size={14} /></button></div>
      ) : (
        <iframe className="web-frame" title="Website preview" src={url} onLoad={() => { /* Cross-origin frame load does not prove the site allowed rendering. */ }} sandbox="allow-forms allow-scripts allow-same-origin allow-popups allow-popups-to-escape-sandbox" referrerPolicy="strict-origin-when-cross-origin" />
      )}
      {mode === 'embed' && <div className="web-app-footer"><span>Embedded websites may restrict features or refuse to load.</span><button onClick={() => setShowFallback(true)}>Can't see the site?</button><button onClick={() => window.open(url, '_blank', 'noopener,noreferrer')}><ExternalLink size={12} /> Open externally</button></div>}
    </div>
  );
}

function YouTubeApp() {
  const [video, setVideo] = useState('jfKfPfyJRdk');
  const [input, setInput] = useState('https://www.youtube.com/watch?v=jfKfPfyJRdk');
  const [error, setError] = useState('');
  const loadVideo = () => {
    const raw = input.trim();
    let id = raw;
    try {
      const parsed = new URL(raw.includes('://') ? raw : `https://${raw}`);
      if (parsed.hostname.includes('youtu.be')) id = parsed.pathname.slice(1);
      else if (parsed.hostname.includes('youtube.com')) id = parsed.searchParams.get('v') || parsed.pathname.split('/').filter(Boolean).pop() || '';
    } catch { /* Treat a bare video ID as valid input. */ }
    if (!/^[a-zA-Z0-9_-]{11}$/.test(id)) { setError('Paste a YouTube video URL or its 11-character video ID.'); return; }
    setVideo(id); setError('');
  };
  return (
    <div className="youtube-app">
      <form className="address-bar" onSubmit={(event) => { event.preventDefault(); loadVideo(); }}>
        <input value={input} onChange={(event) => setInput(event.target.value)} aria-label="YouTube video URL" />
        <button type="submit" className="button-primary">Play</button>
      </form>
      {error && <p className="inline-error">{error}</p>}
      <div className="video-stage"><iframe title="YouTube player" src={`https://www.youtube-nocookie.com/embed/${video}`} allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" referrerPolicy="strict-origin-when-cross-origin" allowFullScreen /></div>
      <div className="web-app-footer"><span>Uses YouTube's official embedded player.</span><button onClick={() => window.open(`https://www.youtube.com/watch?v=${video}`, '_blank', 'noopener,noreferrer')}><ExternalLink size={12} /> Watch on YouTube</button></div>
    </div>
  );
}

function NotesApp() {
  const [note, setNote] = useState(() => { try { return localStorage.getItem(NOTES_KEY) ?? ''; } catch { return ''; } });
  useEffect(() => { try { localStorage.setItem(NOTES_KEY, note); } catch { /* Keep editing usable if storage is unavailable. */ } }, [note]);
  return <div className="notes-app"><div className="notes-heading"><StickyNote size={16} /><span>Scratchpad</span><span className="saved-indicator">Saved locally</span></div><textarea value={note} onChange={(event) => setNote(event.target.value)} placeholder="A thought, a task, a suspiciously ambitious project idea…" aria-label="Scratchpad note" /></div>;
}

function BookmarksApp() {
  const [links, setLinks] = useState<SavedApp[]>(readLinks);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [mode, setMode] = useState<'embed' | 'external'>('external');
  useEffect(() => { try { localStorage.setItem(SAVED_APPS_KEY, JSON.stringify(links)); } catch { /* Optional persistence. */ } }, [links]);
  const addLink = (event: FormEvent) => {
    event.preventDefault();
    let normalized = url.trim();
    if (!normalized || !title.trim()) return;
    if (!/^https?:\/\//i.test(normalized)) normalized = `https://${normalized}`;
    try { new URL(normalized); } catch { return; }
    setLinks((items) => [...items, { id: crypto.randomUUID(), title: title.trim(), url: normalized, mode }]);
    setTitle(''); setUrl('');
  };
  return <div className="bookmarks-app"><div className="app-section-heading"><div><span className="eyebrow">YOUR COLLECTION</span><h3>Saved destinations</h3></div><span className="count-label">{links.length} links</span></div><div className="saved-link-list">{links.map((link) => <div className="saved-link" key={link.id}><div className="link-monogram">{link.title.slice(0, 1).toUpperCase()}</div><div className="saved-link-copy"><strong>{link.title}</strong><span>{link.url}</span></div><button className="icon-button" onClick={() => link.mode === 'external' ? window.open(link.url, '_blank', 'noopener,noreferrer') : window.open(link.url, '_blank', 'noopener,noreferrer')} aria-label={`Open ${link.title}`}><ArrowUpRight size={16} /></button><button className="icon-button muted" onClick={() => setLinks((items) => items.filter((item) => item.id !== link.id))} aria-label={`Remove ${link.title}`}>×</button></div>)}</div><form className="add-link-form" onSubmit={addLink}><input placeholder="Name" value={title} onChange={(event) => setTitle(event.target.value)} aria-label="Bookmark name" required /><input placeholder="https://example.com" value={url} onChange={(event) => setUrl(event.target.value)} aria-label="Bookmark URL" required /><select value={mode} onChange={(event) => setMode(event.target.value as 'embed' | 'external')} aria-label="Opening mode"><option value="external">External tab</option><option value="embed">Try embed</option></select><button className="button-primary" type="submit"><Plus size={14} /> Add</button></form></div>;
}

function SettingsApp() {
  return <div className="settings-app"><span className="eyebrow">WORKSPACE</span><h3>Small things, your way.</h3><p>Nexus is running locally. Your scratchpad, saved links and preferences stay in this browser profile.</p><div className="settings-row"><div><strong>Privacy</strong><span>No account or Nexus server required.</span></div><span className="status-dot-label"><i /> Local</span></div><div className="settings-row"><div><strong>Website windows</strong><span>Some websites block embedding by design.</span></div><span className="settings-tag">Browser rules</span></div><div className="settings-row"><div><strong>Build</strong><span>Early prototype · 0.1.0</span></div><span className="settings-tag">MVP</span></div></div>;
}
