import { useCallback, useEffect, useMemo, useState } from 'react';
import { AppWindow, ArrowUpRight, Command, Globe2, Plus, Search, Sparkles } from 'lucide-react';
import { APP_REGISTRY, getAppDefinition } from './apps/registry';
import { AppHost } from './apps/AppHost';
import { WindowFrame } from './window-manager/WindowFrame';
import { clampBounds, createInitialWindowState, makeWindow, persistWindowCounter } from './window-manager/window-store';
import type { AppId, DesktopWindow, WindowBounds, WindowState } from './window-manager/types';

const SETTINGS_KEY = 'nexus.settings.v1';
interface Preferences { greetingName: string; wallpaper: 'paper' | 'dusk' | 'sage'; showSeconds: boolean }
const DEFAULT_PREFERENCES: Preferences = { greetingName: '', wallpaper: 'paper', showSeconds: false };
function readPreferences(): Preferences {
  try { return { ...DEFAULT_PREFERENCES, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Preferences>) }; }
  catch { return DEFAULT_PREFERENCES; }
}

export function App() {
  const [windowState, setWindowState] = useState<WindowState>(createInitialWindowState);
  const [preferences, setPreferences] = useState<Preferences>(readPreferences);
  const [now, setNow] = useState(() => new Date());
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [launcherQuery, setLauncherQuery] = useState('');
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences)); } catch { /* Preferences are a convenience, not a dependency. */ }
  }, [preferences]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setLauncherOpen((open) => !open); setLauncherQuery('');
      }
      if (event.key === 'Escape') { setLauncherOpen(false); setContextMenu(null); }
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, []);

  const openApp = useCallback((appId: AppId) => {
    const definition = getAppDefinition(appId);
    if (!definition) return;
    setWindowState((state) => {
      const existing = state.windows.find((item) => item.appId === appId && item.status !== 'minimized' && appId === 'settings');
      if (existing) return { ...state, activeWindowId: existing.id, windows: state.windows.map((item) => item.id === existing.id ? { ...item, status: 'normal' } : item) };
      const id = `window-${state.nextId}`;
      const offset = (state.nextId % 5) * 24;
      const bounds = clampBounds({ ...definition.defaultBounds, x: definition.defaultBounds.x + offset, y: definition.defaultBounds.y + offset }, window.innerWidth, window.innerHeight);
      const win = makeWindow(appId, id, bounds, definition.name);
      const next = { ...state, windows: [...state.windows, win], activeWindowId: id, nextId: state.nextId + 1 };
      persistWindowCounter(next.nextId);
      return next;
    });
    setLauncherOpen(false); setContextMenu(null);
  }, []);

  const updateWindow = useCallback((id: string, updater: (win: DesktopWindow) => DesktopWindow) => {
    setWindowState((state) => ({ ...state, windows: state.windows.map((win) => win.id === id ? updater(win) : win) }));
  }, []);
  const focusWindow = useCallback((id: string) => setWindowState((state) => ({ ...state, activeWindowId: id, windows: state.windows.map((win) => win.id === id && win.status === 'minimized' ? { ...win, status: 'normal' } : win) })), []);
  const closeWindow = useCallback((id: string) => setWindowState((state) => {
    const windows = state.windows.filter((win) => win.id !== id);
    return { ...state, windows, activeWindowId: state.activeWindowId === id ? (windows.at(-1)?.id ?? null) : state.activeWindowId };
  }), []);
  const minimizeWindow = useCallback((id: string) => setWindowState((state) => {
    const windows = state.windows.map((win) => win.id === id ? { ...win, status: 'minimized' as const } : win);
    const activeWindowId = state.activeWindowId === id ? (windows.filter((win) => win.status !== 'minimized').at(-1)?.id ?? null) : state.activeWindowId;
    return { ...state, windows, activeWindowId };
  }), []);
  const toggleMaximize = useCallback((id: string) => updateWindow(id, (win) => {
    if (win.status === 'maximized') return { ...win, status: 'normal', bounds: win.restoreBounds ?? win.bounds, restoreBounds: undefined };
    return { ...win, status: 'maximized', restoreBounds: win.bounds };
  }), [updateWindow]);
  const moveWindow = useCallback((id: string, bounds: WindowBounds) => updateWindow(id, (win) => ({ ...win, bounds: clampBounds(bounds, window.innerWidth, window.innerHeight) })), [updateWindow]);
  const resizeWindow = useCallback((id: string, bounds: WindowBounds) => updateWindow(id, (win) => ({ ...win, bounds: clampBounds(bounds, window.innerWidth, window.innerHeight) })), [updateWindow]);

  const visibleApps = useMemo(() => APP_REGISTRY.filter((app) => `${app.name} ${app.description}`.toLowerCase().includes(launcherQuery.toLowerCase())), [launcherQuery]);
  const time = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(preferences.showSeconds ? { second: '2-digit' } : {}) });
  const date = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });
  const hour = now.getHours();
  const greeting = hour < 12 ? 'Good morning' : hour < 18 ? 'Good afternoon' : 'Good evening';

  return (
    <main className={`desktop wallpaper-${preferences.wallpaper}`} onClick={() => { if (contextMenu) setContextMenu(null); }} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('.window-frame, .dock, .launcher-panel')) { event.preventDefault(); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 210), y: Math.min(event.clientY, window.innerHeight - 190) }); } }}>
      <div className="desktop-grain" />
      <header className="topbar">
        <div className="brand-lockup"><div className="brand-mark"><Sparkles size={15} strokeWidth={1.8} /></div><span>nexus</span><span className="brand-divider" /><span className="brand-caption">PERSONAL WORKSPACE</span></div>
        <div className="topbar-center"><span className="system-status-dot" /> All systems local</div>
        <div className="topbar-right"><button className="topbar-search" onClick={() => { setLauncherOpen(true); setLauncherQuery(''); }}><Search size={13} /><span>Quick launch</span><kbd>⌘ K</kbd></button><span className="topbar-date">{date}</span><span className="topbar-time">{time}</span></div>
      </header>

      <section className="welcome-block">
        <div className="eyebrow"><span className="eyebrow-line" /> YOUR SPACE, YOUR PACE</div>
        <h1>{greeting}{preferences.greetingName ? `, ${preferences.greetingName}` : '.'}<br /><span>What are we opening today?</span></h1>
        <p>A little room for the things you keep coming back to.</p>
      </section>

      <section className="desktop-shortcuts" aria-label="Desktop applications">
        <button className="desktop-shortcut" onClick={() => openApp('browser')}>
          <span className="shortcut-icon web-icon"><Globe2 size={22} strokeWidth={1.5} /></span><span>Web</span>
        </button>
        <button className="desktop-shortcut" onClick={() => openApp('youtube')}>
          <span className="shortcut-icon youtube-icon"><span className="youtube-play">▶</span></span><span>YouTube</span>
        </button>
        <button className="desktop-shortcut" onClick={() => openApp('notes')}>
          <span className="shortcut-icon note-icon"><span>✳</span></span><span>Scratchpad</span>
        </button>
        <button className="desktop-shortcut" onClick={() => openApp('bookmarks')}>
          <span className="shortcut-icon links-icon"><AppWindow size={21} strokeWidth={1.5} /></span><span>Saved links</span>
        </button>
      </section>

      <div className="desktop-hint"><span className="hint-dot" /> Click an icon to open it <span className="hint-separator">·</span> Right-click for desktop actions</div>

      <div className="window-layer">
        {windowState.windows.map((win, index) => (
          <WindowFrame key={win.id} window={win} active={windowState.activeWindowId === win.id} zIndex={20 + (windowState.activeWindowId === win.id ? windowState.windows.length : index)} onFocus={() => focusWindow(win.id)} onClose={() => closeWindow(win.id)} onMinimize={() => minimizeWindow(win.id)} onToggleMaximize={() => toggleMaximize(win.id)} onMove={(bounds) => moveWindow(win.id, bounds)} onResize={(bounds) => resizeWindow(win.id, bounds)}>
            <AppHost appId={win.appId} />
          </WindowFrame>
        ))}
      </div>

      {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-label">DESKTOP</div>
        <button onClick={() => openApp('browser')}><Globe2 size={15} /> Open web window</button>
        <button onClick={() => openApp('notes')}><Plus size={15} /> New scratchpad</button>
        <button onClick={() => { setPreferences((prefs) => ({ ...prefs, wallpaper: prefs.wallpaper === 'paper' ? 'sage' : prefs.wallpaper === 'sage' ? 'dusk' : 'paper' })); setContextMenu(null); }}><Sparkles size={15} /> Change wallpaper</button>
        <div className="context-divider" />
        <button onClick={() => openApp('settings')}><Command size={15} /> Workspace settings</button>
      </div>}

      {launcherOpen && <div className="launcher-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLauncherOpen(false); }}>
        <section className="launcher-panel" aria-label="Application launcher">
          <div className="launcher-search"><Search size={17} /><input autoFocus value={launcherQuery} onChange={(event) => setLauncherQuery(event.target.value)} placeholder="Find an app…" aria-label="Find an app" /><kbd>ESC</kbd></div>
          <div className="launcher-section-label">APPLICATIONS</div>
          <div className="launcher-results">{visibleApps.map((app) => { const Icon = app.icon; return <button key={app.id} onClick={() => openApp(app.id)}><span className={`launcher-app-icon icon-${app.id}`}><Icon size={18} /></span><span className="launcher-app-copy"><strong>{app.name}</strong><small>{app.description}</small></span><ArrowUpRight size={15} className="launcher-open-icon" /></button>; })}{visibleApps.length === 0 && <div className="launcher-empty">No apps found. Yet.</div>}</div>
          <footer className="launcher-footer"><span><kbd>↵</kbd> Open application</span><span><kbd>↑</kbd><kbd>↓</kbd> Navigate</span></footer>
        </section>
      </div>}

      <nav className="dock" aria-label="Application dock">
        <div className="dock-apps">{APP_REGISTRY.map((app) => { const Icon = app.icon; const isOpen = windowState.windows.some((win) => win.appId === app.id); const isActive = windowState.windows.some((win) => win.appId === app.id && win.id === windowState.activeWindowId); return <button key={app.id} className={`dock-app ${isOpen ? 'is-open' : ''} ${isActive ? 'is-current' : ''} icon-${app.id}`} onClick={() => { const existing = [...windowState.windows].reverse().find((win) => win.appId === app.id); if (existing) focusWindow(existing.id); else openApp(app.id); }} title={app.name} aria-label={app.name}><Icon size={20} strokeWidth={1.65} />{isOpen && <span className="dock-indicator" />}</button>; })}</div>
        <div className="dock-divider" />
        <button className="dock-launcher" onClick={() => { setLauncherOpen(true); setLauncherQuery(''); }} aria-label="Open app launcher"><Command size={18} /></button>
      </nav>

      <div className="desktop-corner-note">NEXUS <span>0.1.0 · LOCAL BUILD</span></div>
    </main>
  );
}
