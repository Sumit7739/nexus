import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArrowUpRight, Command, Globe2, Plus, Search, Sparkles, Folder, FileText, Youtube, Settings2, LayoutGrid, ChevronDown, SlidersHorizontal, Monitor, MoreHorizontal } from 'lucide-react';
import { APP_REGISTRY, getAppDefinition } from './apps/registry';
import { AppHost } from './apps/AppHost';
import { WindowFrame } from './window-manager/WindowFrame';
import { clampBounds, createInitialWindowState, makeWindow, persistWindowCounter } from './window-manager/window-store';
import type { AppId, DesktopWindow, WindowBounds, WindowState } from './window-manager/types';

const SETTINGS_KEY = 'nexus.settings.v1';
interface Preferences { greetingName: string; wallpaper: 'paper' | 'dusk' | 'sage'; showSeconds: boolean }
const DEFAULT_PREFERENCES: Preferences = { greetingName: '', wallpaper: 'paper', showSeconds: false };
const DESKTOP_LAYOUT_KEY = 'nexus.desktop-layout.v1';
type DesktopItem = { id: AppId; label: string; col: number; row: number };
const DEFAULT_DESKTOP_ITEMS: DesktopItem[] = [
  { id: 'browser', label: 'Web', col: 0, row: 0 },
  { id: 'youtube', label: 'YouTube', col: 1, row: 0 },
  { id: 'notes', label: 'Scratchpad', col: 0, row: 1 },
  { id: 'bookmarks', label: 'Saved links', col: 1, row: 1 },
];
function readDesktopItems(): DesktopItem[] {
  try { const saved = JSON.parse(localStorage.getItem(DESKTOP_LAYOUT_KEY) || 'null'); return Array.isArray(saved) ? saved : DEFAULT_DESKTOP_ITEMS; }
  catch { return DEFAULT_DESKTOP_ITEMS; }
}
function iconForApp(id: AppId) {
  switch (id) { case 'browser': return Globe2; case 'youtube': return Youtube; case 'notes': return FileText; case 'bookmarks': return Folder; default: return Settings2; }
}
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
  const [systemMenuOpen, setSystemMenuOpen] = useState(false);
  const [desktopItems, setDesktopItems] = useState<DesktopItem[]>(readDesktopItems);
  const [selectedItem, setSelectedItem] = useState<AppId | null>(null);
  const [arrangeMode, setArrangeMode] = useState(false);

  useEffect(() => {
    const timer = window.setInterval(() => setNow(new Date()), 30_000);
    return () => window.clearInterval(timer);
  }, []);
  useEffect(() => {
    try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(preferences)); } catch { /* Preferences are a convenience, not a dependency. */ }
  }, [preferences]);
  useEffect(() => {
    try { localStorage.setItem(DESKTOP_LAYOUT_KEY, JSON.stringify(desktopItems)); } catch { /* Layout persistence is best-effort. */ }
  }, [desktopItems]);
  useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault(); setLauncherOpen((open) => !open); setLauncherQuery('');
      }
      if (event.key === 'Escape') { setLauncherOpen(false); setContextMenu(null); setSystemMenuOpen(false); setSelectedItem(null); }
      if (event.key === 'F2' && selectedItem) setArrangeMode((value) => !value);
    };
    window.addEventListener('keydown', handleKey);
    return () => window.removeEventListener('keydown', handleKey);
  }, [selectedItem]);

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

  const moveDesktopItem = (id: AppId, col: number, row: number) => {
    setDesktopItems((items) => items.map((item) => item.id === id ? { ...item, col: Math.max(0, Math.min(7, col)), row: Math.max(0, Math.min(5, row)) } : item));
  };
  const onDesktopItemPointerDown = (event: import("react").PointerEvent<HTMLButtonElement>, item: DesktopItem) => {
    if (event.button !== 0) return;
    const startX = event.clientX; const startY = event.clientY;
    const canvas = event.currentTarget.closest('.desktop-canvas') as HTMLElement | null;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const cellW = 96; const cellH = 96;
    let moved = false;
    const onMove = (moveEvent: PointerEvent) => {
      if (Math.abs(moveEvent.clientX - startX) + Math.abs(moveEvent.clientY - startY) > 5) moved = true;
      if (!moved) return;
      const col = Math.round((moveEvent.clientX - rect.left - 42) / cellW);
      const row = Math.round((moveEvent.clientY - rect.top - 40) / cellH);
      moveDesktopItem(item.id, col, row);
    };
    const onUp = () => {
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      if (!moved) openApp(item.id);
    };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  return (
    <main className={`desktop wallpaper-${preferences.wallpaper}`} onClick={() => { if (contextMenu) setContextMenu(null); if (systemMenuOpen) setSystemMenuOpen(false); }} onContextMenu={(event) => { if (!(event.target as HTMLElement).closest('.window-frame, .dock, .launcher-panel, .system-menu, .desktop-object')) { event.preventDefault(); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 220) }); } }}>
      <div className="desktop-grain" />
      <header className="system-panel">
        <div className="panel-left">
          <button className={`nexus-menu-trigger ${systemMenuOpen ? 'is-open' : ''}`} onClick={(event) => { event.stopPropagation(); setSystemMenuOpen((value) => !value); }} aria-label="Open Nexus menu" aria-expanded={systemMenuOpen}>
            <span className="brand-mark"><Sparkles size={15} strokeWidth={1.8} /></span><span className="panel-brand">nexus</span><ChevronDown size={13} className="panel-chevron" />
          </button>
          <span className="panel-separator" />
          <span className="panel-context">{windowState.activeWindowId ? getAppDefinition(windowState.windows.find((win) => win.id === windowState.activeWindowId)?.appId ?? 'browser')?.name ?? 'Workspace' : 'Workspace'}</span>
        </div>
        <div className="panel-center"><span className="system-status-dot" /> LOCAL SESSION</div>
        <div className="panel-right">
          <button className="panel-icon-button" onClick={() => { setLauncherOpen(true); setLauncherQuery(''); }} aria-label="Open application launcher" title="Quick launch"><Search size={15} /><kbd>⌘ K</kbd></button>
          <span className="panel-date">{date}</span><span className="panel-time">{time}</span>
          <button className="panel-icon-button panel-more" onClick={(event) => { event.stopPropagation(); setContextMenu({ x: window.innerWidth - 230, y: 50 }); }} aria-label="System actions"><MoreHorizontal size={17} /></button>
        </div>
      </header>

      {systemMenuOpen && <section className="system-menu" onClick={(event) => event.stopPropagation()}>
        <div className="system-menu-heading"><span className="brand-mark"><Sparkles size={15} /></span><div><strong>Nexus</strong><small>Personal workspace</small></div><span className="system-version">0.2.0</span></div>
        <button onClick={() => { setLauncherOpen(true); setLauncherQuery(''); setSystemMenuOpen(false); }}><LayoutGrid size={16} /><span>Applications</span><kbd>⌘ K</kbd></button>
        <button onClick={() => { setArrangeMode((value) => !value); setSystemMenuOpen(false); }}><SlidersHorizontal size={16} /><span>{arrangeMode ? 'Finish arranging desktop' : 'Arrange desktop icons'}</span><kbd>F2</kbd></button>
        <button onClick={() => { setPreferences((prefs) => ({ ...prefs, wallpaper: prefs.wallpaper === 'paper' ? 'sage' : prefs.wallpaper === 'sage' ? 'dusk' : 'paper' })); setSystemMenuOpen(false); }}><Monitor size={16} /><span>Cycle appearance</span></button>
        <div className="system-menu-rule" />
        <button onClick={() => { openApp('settings'); setSystemMenuOpen(false); }}><Settings2 size={16} /><span>Workspace settings</span></button>
      </section>}

      <section className={`desktop-canvas ${arrangeMode ? 'is-arranging' : ''}`} aria-label="Desktop workspace" onClick={() => { setSelectedItem(null); }}>
        <div className="canvas-grid" aria-hidden="true" />
        <div className="desktop-section-label"><span className="section-label-mark" /> DESKTOP <span className="section-label-divider">/</span> {arrangeMode ? 'ARRANGE MODE' : 'PERSONAL SPACE'}</div>
        {desktopItems.map((item) => {
          const Icon = iconForApp(item.id);
          return <button key={item.id} className={`desktop-object app-object app-object-${item.id} ${selectedItem === item.id ? 'is-selected' : ''} ${arrangeMode ? 'is-arrangeable' : ''}`} style={{ left: `calc(28px + ${item.col} * 96px)`, top: `calc(54px + ${item.row} * 96px)` }} onPointerDown={(event) => { event.stopPropagation(); setSelectedItem(item.id); onDesktopItemPointerDown(event, item); }} onContextMenu={(event) => { event.preventDefault(); event.stopPropagation(); setSelectedItem(item.id); setContextMenu({ x: Math.min(event.clientX, window.innerWidth - 220), y: Math.min(event.clientY, window.innerHeight - 190) }); }} aria-label={`Open ${item.label}`} title={arrangeMode ? `${item.label} · drag to arrange` : item.label}>
            <span className="desktop-object-icon"><Icon size={23} strokeWidth={1.65} /></span><span className="desktop-object-label">{item.label}</span>
          </button>;
        })}
        <div className="desktop-canvas-footer"><span className="canvas-status-dot" /> {arrangeMode ? 'Drag icons to arrange · press F2 to finish' : 'Click an icon to open · right-click for options'}</div>
      </section>

      <div className="window-layer">
        {windowState.windows.map((win, index) => (
          <WindowFrame key={win.id} window={win} active={windowState.activeWindowId === win.id} zIndex={20 + (windowState.activeWindowId === win.id ? windowState.windows.length : index)} onFocus={() => focusWindow(win.id)} onClose={() => closeWindow(win.id)} onMinimize={() => minimizeWindow(win.id)} onToggleMaximize={() => toggleMaximize(win.id)} onMove={(bounds) => moveWindow(win.id, bounds)} onResize={(bounds) => resizeWindow(win.id, bounds)}>
            <AppHost appId={win.appId} />
          </WindowFrame>
        ))}
      </div>

      {contextMenu && <div className="context-menu" style={{ left: contextMenu.x, top: contextMenu.y }} onClick={(event) => event.stopPropagation()}>
        <div className="context-menu-label">WORKSPACE</div>
        <button onClick={() => openApp('browser')}><Globe2 size={15} /> Open web window</button>
        <button onClick={() => openApp('notes')}><Plus size={15} /> New scratchpad</button>
        <button onClick={() => { setArrangeMode((value) => !value); setContextMenu(null); }}><SlidersHorizontal size={15} /> {arrangeMode ? 'Finish arranging' : 'Arrange desktop'}</button>
        <button onClick={() => { setPreferences((prefs) => ({ ...prefs, wallpaper: prefs.wallpaper === 'paper' ? 'sage' : prefs.wallpaper === 'sage' ? 'dusk' : 'paper' })); setContextMenu(null); }}><Sparkles size={15} /> Change appearance</button>
        <div className="context-divider" />
        <button onClick={() => openApp('settings')}><Command size={15} /> Workspace settings</button>
      </div>}

      {launcherOpen && <div className="launcher-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setLauncherOpen(false); }}>
        <section className="launcher-panel" aria-label="Application launcher">
          <div className="launcher-search"><Search size={17} /><input autoFocus value={launcherQuery} onChange={(event) => setLauncherQuery(event.target.value)} placeholder="Find an application…" aria-label="Find an application" /><kbd>ESC</kbd></div>
          <div className="launcher-section-label">APPLICATIONS</div>
          <div className="launcher-results">{visibleApps.map((app) => { const Icon = app.icon; return <button key={app.id} onClick={() => openApp(app.id)}><span className={`launcher-app-icon icon-${app.id}`}><Icon size={18} /></span><span className="launcher-app-copy"><strong>{app.name}</strong><small>{app.description}</small></span><ArrowUpRight size={15} className="launcher-open-icon" /></button>; })}{visibleApps.length === 0 && <div className="launcher-empty">No applications found.</div>}</div>
          <footer className="launcher-footer"><span><kbd>↵</kbd> Open application</span><span><kbd>ESC</kbd> Close</span></footer>
        </section>
      </div>}

      <nav className="dock" aria-label="Application dock">
        <div className="dock-apps">{APP_REGISTRY.map((app) => { const Icon = app.icon; const isOpen = windowState.windows.some((win) => win.appId === app.id); const isActive = windowState.windows.some((win) => win.appId === app.id && win.id === windowState.activeWindowId); return <button key={app.id} className={`dock-app ${isOpen ? 'is-open' : ''} ${isActive ? 'is-current' : ''} icon-${app.id}`} onClick={() => { const existing = [...windowState.windows].reverse().find((win) => win.appId === app.id); if (existing) focusWindow(existing.id); else openApp(app.id); }} title={app.name} aria-label={app.name}><Icon size={20} strokeWidth={1.65} />{isOpen && <span className="dock-indicator" />}</button>; })}</div>
        <div className="dock-divider" />
        <button className="dock-launcher" onClick={() => { setLauncherOpen(true); setLauncherQuery(''); }} aria-label="Open application launcher"><LayoutGrid size={18} /></button>
      </nav>
    </main>
  );
}
