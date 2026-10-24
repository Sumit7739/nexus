import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Globe2, Youtube, StickyNote, Bookmark, Settings2,
  LayoutGrid, Search, X, ChevronRight,
  Lock, Shield, Check, Plus, Pin,
  MoreHorizontal, List, Grid2X2, Layers,
  Sun, Moon, LogOut, RefreshCw, ChevronLeft, ChevronRight as ChevronR,
  History, Sparkles, CheckCircle2, Wrench, Trash2, Image, ExternalLink, Code2,
} from 'lucide-react';
import { APP_REGISTRY, getAppDefinition } from './apps/registry';
import { AppHost } from './apps/AppHost';
import { WindowFrame } from './window-manager/WindowFrame';
import { clampBounds, createInitialWindowState, makeWindow, persistWindowCounter } from './window-manager/window-store';
import type { AppId, DesktopWindow, WindowBounds, WindowState } from './window-manager/types';
import { readMessages, saveMessages } from './data/messages';
import type { DesktopMessage } from './data/messages';
import { positionForIndex, snapDesktopPosition, type DesktopPosition } from './desktop/layout';
import { readWidgets, saveWidgets } from './widgets/types';
import type { WidgetDefinition } from './widgets/types';
import { WidgetRuntime } from './widgets/WidgetRuntime';

/* ─── Constants ───────────────────────────────────────────────────────────── */
const SETTINGS_KEY       = 'nexus.settings.v1';
const PINNED_DESKTOP_KEY = 'nexus.pinned-desktop.v1';
const PINNED_DOCK_KEY    = 'nexus.pinned-dock.v1';
const DESKTOP_POS_KEY    = 'nexus.desktop-positions.v1';
const PASSWORD_KEY       = 'nexus.local-password.v1';
const SESSION_UNLOCKED   = 'nexus.session-unlocked';
const SPLASH_MS          = 1600;

type EntryScreen = 'splash' | 'lock' | 'desktop';
type Wallpaper = 'mist' | 'aurora' | 'dusk' | 'forest' | 'ocean' | 'ember' | 'lavender' | 'midnight' | 'rose' | 'mono' | 'citrus' | 'glacier';
const WALLPAPERS: { id: Wallpaper; name: string }[] = [
  { id: 'mist', name: 'Soft mist' }, { id: 'aurora', name: 'Aurora' }, { id: 'dusk', name: 'Warm dusk' }, { id: 'forest', name: 'Forest' },
  { id: 'ocean', name: 'Ocean glass' }, { id: 'ember', name: 'Ember' }, { id: 'lavender', name: 'Lavender haze' }, { id: 'midnight', name: 'Midnight' },
  { id: 'rose', name: 'Rosewater' }, { id: 'mono', name: 'Monochrome' }, { id: 'citrus', name: 'Citrus' }, { id: 'glacier', name: 'Glacier' },
];
type MenuView    = 'list' | 'grid';
type Theme       = 'light' | 'dark';

interface Preferences {
  theme:           Theme;
  wallpaper:       Wallpaper;
  showSeconds:     boolean;
  menuView:        MenuView;
  msgRefreshMins:  number; // minutes between message rotation, 1-60
}

const DEFAULT_PREFS: Preferences = {
  theme: 'light', wallpaper: 'mist',
  showSeconds: false, menuView: 'list', msgRefreshMins: 5,
};

function readPrefs(): Preferences {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Preferences>;
    const wallpapers = WALLPAPERS.map(w => w.id);
    return {
      theme:          s.theme === 'dark' ? 'dark' : 'light',
      wallpaper:      wallpapers.includes(s.wallpaper as Wallpaper) ? s.wallpaper as Wallpaper : 'mist',
      showSeconds:    s.showSeconds === true,
      menuView:       s.menuView === 'grid' ? 'grid' : 'list',
      msgRefreshMins: (typeof s.msgRefreshMins === 'number' && s.msgRefreshMins >= 1 && s.msgRefreshMins <= 60)
                        ? s.msgRefreshMins : 5,
    };
  } catch { return DEFAULT_PREFS; }
}

function readPinned(key: string): AppId[] {
  try {
    const s = JSON.parse(localStorage.getItem(key) || '[]');
    return Array.isArray(s) ? s.filter((id): id is AppId => APP_REGISTRY.some(a => a.id === id)) : [];
  } catch { return []; }
}

function readDesktopPositions(): Record<string, DesktopPosition> {
  try {
    const s = JSON.parse(localStorage.getItem(DESKTOP_POS_KEY) || '{}') as Record<string, Partial<DesktopPosition>>;
    return Object.fromEntries(
      Object.entries(s)
        .filter(([, p]) => Number.isFinite(p?.x) && Number.isFinite(p?.y))
        .map(([id, p]) => [id, { x: p.x as number, y: p.y as number }])
    );
  } catch { return {}; }
}

function toHex(b: ArrayBuffer) {
  return Array.from(new Uint8Array(b), n => n.toString(16).padStart(2, '0')).join('');
}
async function hashPw(password: string, saltHex: string): Promise<string> {
  const salt = new Uint8Array(saltHex.match(/.{1,2}/g)!.map(h => parseInt(h, 16)));
  const mat  = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveBits']);
  return toHex(await crypto.subtle.deriveBits({ name: 'PBKDF2', salt, iterations: 180_000, hash: 'SHA-256' }, mat, 256));
}
function makeSalt() {
  return Array.from(crypto.getRandomValues(new Uint8Array(16)), b => b.toString(16).padStart(2, '0')).join('');
}
function appIcon(id: AppId) {
  switch (id) {
    case 'browser':   return Globe2;
    case 'youtube':   return Youtube;
    case 'notes':     return StickyNote;
    case 'bookmarks': return Bookmark;
    case 'widgets':   return Code2;
    default:          return Settings2;
  }
}

/* ════════════════════════════════════════════════════════════════════════════
   SPLASH
   ════════════════════════════════════════════════════════════════════════════ */
function SplashScreen() {
  return (
    <div className="splash">
      <div className="splash-logo"><Layers size={28} strokeWidth={1.5} /></div>
      <div className="splash-name">nexus</div>
      <div className="splash-bar"><div className="splash-bar-fill" /></div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   LOCK SCREEN
   ════════════════════════════════════════════════════════════════════════════ */
interface LockProps {
  now: Date; wallpaper: Wallpaper; theme: Theme;
  passwordRecord: { salt: string; hash: string } | null;
  onUnlock: () => void;
}
function LockScreen({ now, wallpaper, theme, passwordRecord, onUnlock }: LockProps) {
  const [input, setInput]     = useState('');
  const [error, setError]     = useState('');
  const [busy, setBusy]       = useState(false);
  const [focused, setFocused] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const dateStr = now.toLocaleDateString([], { weekday: 'long', month: 'long', day: 'numeric' });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!passwordRecord) { onUnlock(); return; }
    setBusy(true); setError('');
    try {
      if (await hashPw(input, passwordRecord.salt) === passwordRecord.hash) { setInput(''); onUnlock(); }
      else { setError('Incorrect password'); setInput(''); inputRef.current?.focus(); }
    } catch { setError('Verification failed.'); }
    finally { setBusy(false); }
  };

  return (
    <div className={`lock theme-${theme} wallpaper-${wallpaper}`} onClick={() => inputRef.current?.focus()}>
      <div className="lock-bar">
        <div className="lock-bar-left"><Layers size={14} strokeWidth={1.5} /><span>Nexus</span></div>
        <div className="lock-bar-right">
          <span className="lock-bar-time">{now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
        </div>
      </div>
      <div className="lock-clock">
        <div className="lock-time">{timeStr}</div>
        <div className="lock-date">{dateStr}</div>
      </div>
      <div className="lock-panel">
        <div className="lock-avatar-wrap">
          <div className="lock-avatar">N</div>
          <div className="lock-avatar-name">Nexus User</div>
        </div>
        <form className="lock-form" onSubmit={submit}>
          <div className={`lock-input-row ${focused ? 'is-focused' : ''} ${error ? 'has-error' : ''}`}>
            <input
              ref={inputRef} type="password" autoFocus autoComplete="current-password"
              placeholder={passwordRecord ? 'Enter password…' : 'Press Enter to unlock'}
              value={input} onChange={e => setInput(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              aria-label="Password"
            />
            <button type="submit" className={`lock-go ${(input || !passwordRecord) ? 'is-ready' : ''}`} disabled={busy} aria-label="Unlock">
              <ChevronRight size={16} />
            </button>
          </div>
          {error && <p className="lock-error" role="alert">{error}</p>}
        </form>
        <p className="lock-footnote"><Lock size={10} />Stored locally · No account</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PASSWORD SETUP
   ════════════════════════════════════════════════════════════════════════════ */
interface SetupProps { onSave: (r: { salt: string; hash: string }) => void; onCancel: () => void; }
function PasswordSetup({ onSave, onCancel }: SetupProps) {
  const [pw, setPw] = useState(''); const [confirm, setConfirm] = useState('');
  const [error, setError] = useState(''); const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setError('');
    if (pw.length < 4) { setError('Use at least 4 characters.'); return; }
    if (pw !== confirm) { setError('Passwords do not match.'); return; }
    setBusy(true);
    try {
      const salt = makeSalt(); const hash = await hashPw(pw, salt);
      const record = { salt, hash };
      localStorage.setItem(PASSWORD_KEY, JSON.stringify(record));
      onSave(record);
    } catch { setError('Could not save password.'); }
    finally { setBusy(false); }
  };
  return (
    <div className="overlay-scrim">
      <div className="setup-card">
        <div className="setup-icon"><Shield size={20} strokeWidth={1.5} /></div>
        <h2>Set passcode</h2>
        <p>Protects this workspace on this device. Nothing leaves your browser.</p>
        <form onSubmit={submit}>
          <label htmlFor="sp1">Password</label>
          <input id="sp1" type="password" autoFocus value={pw} onChange={e => setPw(e.target.value)} placeholder="Min 4 characters" required minLength={4} autoComplete="new-password" />
          <label htmlFor="sp2">Confirm</label>
          <input id="sp2" type="password" value={confirm} onChange={e => setConfirm(e.target.value)} placeholder="Repeat password" required minLength={4} autoComplete="new-password" />
          {error && <p className="form-error">{error}</p>}
          <div className="setup-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Set passcode'}</button>
          </div>
        </form>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   DESKTOP CONTEXT MENU
   ════════════════════════════════════════════════════════════════════════════ */
interface CtxProps {
  x: number; y: number; onClose: () => void;
  onOpenLauncher: () => void; onToggleArrange: () => void; arrangeMode: boolean;
  wallpaper: Wallpaper; onWallpaperChange: (wallpaper: Wallpaper) => void;
}
function DesktopCtxMenu({ x, y, onClose, onOpenLauncher, onToggleArrange, arrangeMode, wallpaper, onWallpaperChange }: CtxProps) {
  return (
    <>
      <div className="ctx-scrim" onClick={onClose} />
      <div className="ctx-menu" style={{ left: x, top: y }} role="menu">
        <button onClick={() => { onOpenLauncher(); onClose(); }}><LayoutGrid size={13} /><span>Open launcher</span></button>
        <button onClick={() => { onToggleArrange(); onClose(); }}><RefreshCw size={13} /><span>{arrangeMode ? 'Done arranging' : 'Arrange icons'}</span></button>
        <button onClick={() => onWallpaperChange(WALLPAPERS[(WALLPAPERS.findIndex(w => w.id === wallpaper) + 1) % WALLPAPERS.length].id)}><Image size={13} /><span>Next wallpaper</span><ChevronRight size={12} /></button>
        <div className="ctx-wallpaper-options">{WALLPAPERS.map(w => <button key={w.id} className={wallpaper === w.id ? 'is-current' : ''} title={w.name} aria-label={w.name} onClick={() => { onWallpaperChange(w.id); onClose(); }}><span className={`wallpaper-swatch swatch-${w.id}`} /></button>)}</div>
        <div className="ctx-sep" />
        <button onClick={onClose}><span className="ctx-dismiss">Dismiss</span></button>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   MINI CALENDAR (used inside tray menu)
   ════════════════════════════════════════════════════════════════════════════ */
function MiniCalendar({ today }: { today: Date }) {
  const [view, setView] = useState(() => new Date(today.getFullYear(), today.getMonth(), 1));
  const year = view.getFullYear(); const month = view.getMonth();
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthName = view.toLocaleString('default', { month: 'long', year: 'numeric' });
  const cells: (number | null)[] = [...Array(firstDay).fill(null), ...Array.from({ length: daysInMonth }, (_, i) => i + 1)];
  while (cells.length % 7 !== 0) cells.push(null);
  const isToday = (d: number | null) => d !== null && d === today.getDate() && month === today.getMonth() && year === today.getFullYear();
  return (
    <div className="mini-cal">
      <div className="mini-cal-header">
        <button onClick={() => setView(new Date(year, month - 1, 1))} aria-label="Previous month"><ChevronLeft size={13} /></button>
        <span>{monthName}</span>
        <button onClick={() => setView(new Date(year, month + 1, 1))} aria-label="Next month"><ChevronR size={13} /></button>
      </div>
      <div className="mini-cal-grid">
        {['Su','Mo','Tu','We','Th','Fr','Sa'].map(d => <span key={d} className="mini-cal-dow">{d}</span>)}
        {cells.map((d, i) => (
          <span key={i} className={`mini-cal-day ${d === null ? 'empty' : ''} ${isToday(d) ? 'today' : ''}`}>
            {d ?? ''}
          </span>
        ))}
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   TRAY MENU (opened by clicking bottom-right time/date widget)
   ════════════════════════════════════════════════════════════════════════════ */
interface TrayMenuProps {
  now: Date; theme: Theme; hasPassword: boolean;
  onToggleTheme: () => void; onLock: () => void;
  onSetupPassword: () => void; onClose: () => void;
  wallpaper: Wallpaper; onWallpaperChange: (wallpaper: Wallpaper) => void;
}
function TrayMenu({ now, theme, hasPassword, onToggleTheme, onLock, onSetupPassword, onClose, wallpaper, onWallpaperChange }: TrayMenuProps) {
  return (
    <>
      <div className="ctx-scrim" onClick={onClose} />
      <div className="tray-menu" role="dialog" aria-label="System tray">
        {/* Calendar */}
        <MiniCalendar today={now} />
        <div className="tray-sep" />
        {/* Controls */}
        <div className="tray-actions">
          <button className="tray-action" onClick={() => { onToggleTheme(); onClose(); }}>
            {theme === 'dark' ? <Sun size={14} /> : <Moon size={14} />}
            <span>{theme === 'dark' ? 'Light mode' : 'Dark mode'}</span>
          </button>
          <button className="tray-action" onClick={() => onWallpaperChange(WALLPAPERS[(WALLPAPERS.findIndex(w => w.id === wallpaper) + 1) % WALLPAPERS.length].id)}>
            <Image size={14} /><span>Next wallpaper · {WALLPAPERS.find(w => w.id === wallpaper)?.name}</span>
          </button>
          <div className="tray-wallpaper-options">{WALLPAPERS.map(w => <button key={w.id} className={wallpaper === w.id ? 'is-current' : ''} title={w.name} aria-label={w.name} onClick={() => onWallpaperChange(w.id)}><span className={`wallpaper-swatch swatch-${w.id}`} /></button>)}</div>
          <button className="tray-action" onClick={() => { onSetupPassword(); onClose(); }}>
            <Shield size={14} />
            <span>{hasPassword ? 'Change passcode' : 'Set passcode'}</span>
          </button>
          <button className="tray-action" onClick={() => { onLock(); onClose(); }} disabled={!hasPassword} title={!hasPassword ? 'Set a passcode first' : ''}>
            <LogOut size={14} />
            <span>Lock screen</span>
          </button>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   ROOT APP
   ════════════════════════════════════════════════════════════════════════════ */
export function App() {
  const [windowState, setWindowState]   = useState<WindowState>(createInitialWindowState);
  const [screen, setScreen]             = useState<EntryScreen>('splash');
  const [passwordRecord, setPasswordRecord] = useState<{ salt: string; hash: string } | null>(() => {
    try { return JSON.parse(localStorage.getItem(PASSWORD_KEY) || 'null'); } catch { return null; }
  });
  const [prefs, setPrefs]               = useState<Preferences>(readPrefs);
  const [now, setNow]                   = useState(() => new Date());
  const [menuOpen, setMenuOpen]         = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  /* Separate action menu state for launcher vs desktop icon to prevent double menus */
  const [launcherActionMenu, setLauncherActionMenu] = useState<AppId | null>(null);
  const [iconActionMenu, setIconActionMenu]         = useState<AppId | null>(null);
  const [pinnedDesktop, setPinnedDesktop] = useState<AppId[]>(() => readPinned(PINNED_DESKTOP_KEY));
  const [pinnedDock, setPinnedDock]     = useState<AppId[]>(() => readPinned(PINNED_DOCK_KEY));
  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);
  const [arrangeMode, setArrangeMode]   = useState(false);
  const [desktopPos, setDesktopPos]     = useState<Record<string, DesktopPosition>>(readDesktopPositions);
  const [showSetup, setShowSetup]       = useState(false);
  const [ctxMenu, setCtxMenu]           = useState<{ x: number; y: number } | null>(null);
  const [trayOpen, setTrayOpen]         = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [messages, setMessages]         = useState<DesktopMessage[]>(readMessages);
  const [widgets, setWidgets]           = useState<WidgetDefinition[]>(readWidgets);
  const [previewWidget, setPreviewWidget] = useState<WidgetDefinition | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [savedLinks, setSavedLinks] = useState<{id:string;title:string;url:string;mode?:string}[]>(() => { try { const v = JSON.parse(localStorage.getItem('nexus.saved-apps.v1') || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } });

  useEffect(() => {
    const handleWidgetTheme = (event: Event) => { const requested = (event as CustomEvent).detail; if (requested === 'light' || requested === 'dark') setPrefs(p => ({ ...p, theme: requested })); };
    window.addEventListener('nexus:widget-theme-request', handleWidgetTheme);
    return () => window.removeEventListener('nexus:widget-theme-request', handleWidgetTheme);
  }, []);

  useEffect(() => {
    const refreshLinks = () => { try { const v = JSON.parse(localStorage.getItem('nexus.saved-apps.v1') || '[]'); setSavedLinks(Array.isArray(v) ? v.filter((l:any) => l && typeof l.title === 'string' && typeof l.url === 'string') : []); } catch { setSavedLinks([]); } };
    window.addEventListener('nexus:saved-links-updated', refreshLinks);
    window.addEventListener('storage', refreshLinks);
    return () => { window.removeEventListener('nexus:saved-links-updated', refreshLinks); window.removeEventListener('storage', refreshLinks); };
  }, []);

  /* ── Splash → screen ────────────────────────────────────────────────── */
  useEffect(() => {
    const t = setTimeout(() => {
      let unlocked = false;
      try { unlocked = sessionStorage.getItem(SESSION_UNLOCKED) === '1'; } catch { /* Continue to the lock screen when session storage is unavailable. */ }
      setScreen(!passwordRecord || unlocked ? 'desktop' : 'lock');
    }, SPLASH_MS);
    return () => clearTimeout(t);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleUnlock = () => { try { sessionStorage.setItem(SESSION_UNLOCKED, '1'); } catch { /* Session persistence is optional. */ } setScreen('desktop'); };

  /* ── Clock ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), prefs.showSeconds ? 1000 : 15_000);
    return () => clearInterval(iv);
  }, [prefs.showSeconds]);

  /* ── Persist ─────────────────────────────────────────────────────────── */
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch {} }, [prefs]);
  useEffect(() => { try { localStorage.setItem(PINNED_DESKTOP_KEY, JSON.stringify(pinnedDesktop)); } catch {} }, [pinnedDesktop]);
  useEffect(() => { try { localStorage.setItem(PINNED_DOCK_KEY, JSON.stringify(pinnedDock)); } catch {} }, [pinnedDock]);
  useEffect(() => { try { localStorage.setItem(DESKTOP_POS_KEY, JSON.stringify(desktopPos)); } catch {} }, [desktopPos]);
  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => {
    if (!messages.length) { setMessageIndex(0); return; }
    setMessageIndex(i => i % messages.length);
    const timer = window.setInterval(() => setMessageIndex(i => (i + 1) % Math.max(messages.length, 1)), Math.max(1, prefs.msgRefreshMins) * 60_000);
    return () => window.clearInterval(timer);
  }, [messages.length, prefs.msgRefreshMins]);
  useEffect(() => { saveWidgets(widgets); }, [widgets]);

  /* Keep floating windows reachable when the browser viewport changes. */
  useEffect(() => {
    const handleViewportResize = () => {
      setWindowState(state => {
        let changed = false;
        const windows = state.windows.map(win => {
          if (win.status === 'maximized') {
            if (!win.restoreBounds) return win;
            const restoreBounds = clampBounds(win.restoreBounds, window.innerWidth, window.innerHeight);
            if (restoreBounds.x === win.restoreBounds.x && restoreBounds.y === win.restoreBounds.y && restoreBounds.width === win.restoreBounds.width && restoreBounds.height === win.restoreBounds.height) return win;
            changed = true;
            return { ...win, restoreBounds };
          }
          const bounds = clampBounds(win.bounds, window.innerWidth, window.innerHeight);
          if (bounds.x === win.bounds.x && bounds.y === win.bounds.y && bounds.width === win.bounds.width && bounds.height === win.bounds.height) return win;
          changed = true;
          return { ...win, bounds };
        });
        return changed ? { ...state, windows } : state;
      });
    };
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  /* ── Keyboard ────────────────────────────────────────────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') { e.preventDefault(); setMenuOpen(o => !o); setSearchQuery(''); }
      if (e.key === 'Escape') {
        setMenuOpen(false); setLauncherActionMenu(null); setIconActionMenu(null);
        setSelectedIcon(null); setCtxMenu(null); setTrayOpen(false); setChangelogOpen(false);
      }
      if (e.key === 'F2') setArrangeMode(v => !v);
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, []);

  /* ── Window ops ──────────────────────────────────────────────────────── */
  const openApp = useCallback((appId: AppId) => {
    const def = getAppDefinition(appId); if (!def) return;
    setWindowState(s => {
      const single = s.windows.find(w => w.appId === appId && w.status !== 'minimized' && appId === 'settings');
      if (single) return { ...s, activeWindowId: single.id, windows: s.windows.map(w => w.id === single.id ? { ...w, status: 'normal' } : w) };
      const id = `window-${s.nextId}`;
      const offset = (s.nextId % 5) * 22;
      const bounds = clampBounds({ ...def.defaultBounds, x: def.defaultBounds.x + offset, y: def.defaultBounds.y + offset }, window.innerWidth, window.innerHeight);
      const win = makeWindow(appId, id, bounds, def.name);
      const next = { ...s, windows: [...s.windows, win], activeWindowId: id, nextId: s.nextId + 1 };
      persistWindowCounter(next.nextId);
      return next;
    });
    setMenuOpen(false); setLauncherActionMenu(null);
  }, []);

  const updateWindow  = useCallback((id: string, fn: (w: DesktopWindow) => DesktopWindow) =>
    setWindowState(s => ({ ...s, windows: s.windows.map(w => w.id === id ? fn(w) : w) })), []);
  const focusWindow   = useCallback((id: string) =>
    setWindowState(s => ({ ...s, activeWindowId: id, windows: s.windows.map(w => w.id === id && w.status === 'minimized' ? { ...w, status: 'normal' } : w) })), []);
  const closeWindow   = useCallback((id: string) =>
    setWindowState(s => { const wins = s.windows.filter(w => w.id !== id); return { ...s, windows: wins, activeWindowId: s.activeWindowId === id ? (wins.filter(w => w.status !== 'minimized').at(-1)?.id ?? null) : s.activeWindowId }; }), []);
  const minimizeWindow = useCallback((id: string) =>
    setWindowState(s => { const wins = s.windows.map(w => w.id === id ? { ...w, status: 'minimized' as const } : w); return { ...s, windows: wins, activeWindowId: s.activeWindowId === id ? (wins.filter(w => w.status !== 'minimized').at(-1)?.id ?? null) : s.activeWindowId }; }), []);
  const toggleMaximize = useCallback((id: string) =>
    updateWindow(id, w => w.status === 'maximized'
      ? { ...w, status: 'normal', bounds: w.restoreBounds ?? w.bounds, restoreBounds: undefined }
      : { ...w, status: 'maximized', restoreBounds: w.bounds }), [updateWindow]);
  const moveWindow   = useCallback((id: string, b: WindowBounds) => updateWindow(id, w => ({ ...w, bounds: clampBounds(b, window.innerWidth, window.innerHeight) })), [updateWindow]);
  const resizeWindow = useCallback((id: string, b: WindowBounds) => updateWindow(id, w => ({ ...w, bounds: clampBounds(b, window.innerWidth, window.innerHeight) })), [updateWindow]);

  /* ── Desktop icon drag ───────────────────────────────────────────────── */
  const handleIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>, appId: AppId) => {
    if (!arrangeMode || e.button !== 0) return;
    const sx = e.clientX, sy = e.clientY;
    const idx = pinnedDesktop.indexOf(appId);
    const start = { ...(desktopPos[appId] ?? positionForIndex(idx)) };
    const onMove = (me: PointerEvent) => setDesktopPos(p => ({
      ...p, [appId]: snapDesktopPosition(
        { x: start.x + me.clientX - sx, y: start.y + me.clientY - sy },
        window.innerWidth,
        window.innerHeight,
      ),
    }));
    const onUp = () => { window.removeEventListener('pointermove', onMove); window.removeEventListener('pointerup', onUp); };
    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const togglePin = (appId: AppId, dest: 'desktop' | 'dock') => {
    (dest === 'desktop' ? setPinnedDesktop : setPinnedDock)(items =>
      items.includes(appId) ? items.filter(id => id !== appId) : [...items, appId]);
  };

  const visibleApps = useMemo(
    () => APP_REGISTRY.filter(a => `${a.name} ${a.description}`.toLowerCase().includes(searchQuery.toLowerCase())),
    [searchQuery]
  );

  /* Deduplicated list of all open app IDs for the dock */
  const openAppIds = useMemo(() => {
    const seen = new Set<AppId>();
    return windowState.windows
      .map(w => w.appId)
      .filter(id => { if (seen.has(id)) return false; seen.add(id); return true; });
  }, [windowState.windows]);

  /* All AppIds that should appear in dock: pinned union open-but-unpinned */
  const dockAppIds = useMemo(() => {
    const ids = [...pinnedDock];
    for (const id of openAppIds) {
      if (!ids.includes(id)) ids.push(id);
    }
    return ids;
  }, [pinnedDock, openAppIds]);

  const settingsProps = {
    theme:             prefs.theme,
    wallpaper:         prefs.wallpaper,
    showSeconds:       prefs.showSeconds,
    arrangeMode,
    hasPassword:       Boolean(passwordRecord),
    msgRefreshMins:    prefs.msgRefreshMins,
    messages,
    onToggleTheme:     () => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' })),
    onWallpaperChange: (w: Wallpaper) => setPrefs(p => ({ ...p, wallpaper: w })),
    onToggleSeconds:   () => setPrefs(p => ({ ...p, showSeconds: !p.showSeconds })),
    onToggleArrange:   () => setArrangeMode(v => !v),
    onPassword:        () => setShowSetup(true),
    onMsgRefreshChange:(mins: number) => setPrefs(p => ({ ...p, msgRefreshMins: mins })),
    onMessagesChange:  (msgs: DesktopMessage[]) => setMessages(msgs),
    widgets,
    onWidgetsChange:   (next: WidgetDefinition[]) => setWidgets(next),
    onPreviewWidget:   (widget: WidgetDefinition) => setPreviewWidget(widget),
    onOpenApp:         (id: AppId) => openApp(id),
  };

  const closeAll = () => {
    setMenuOpen(false); setLauncherActionMenu(null); setIconActionMenu(null);
    setSelectedIcon(null); setCtxMenu(null); setTrayOpen(false);
  };

  /* ── Screens ─────────────────────────────────────────────────────────── */
  if (screen === 'splash') return <SplashScreen />;
  if (screen === 'lock')   return <LockScreen now={now} wallpaper={prefs.wallpaper} theme={prefs.theme} passwordRecord={passwordRecord} onUnlock={handleUnlock} />;

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(prefs.showSeconds ? { second: '2-digit' } : {}) });

  /* ── Render desktop ──────────────────────────────────────────────────── */
  return (
    <div className={`desktop theme-${prefs.theme} wallpaper-${prefs.wallpaper}`} onClick={closeAll}>
      {/* Wallpaper blobs */}
      <div key={prefs.wallpaper} className="desktop-wallpaper wallpaper-transition" aria-hidden>
        <div className="wp-blob wp-blob-1" />
        <div className="wp-blob wp-blob-2" />
        <div className="wp-blob wp-blob-3" />
      </div>

      {messages.length > 0 && <div className="desktop-message" key={messages[messageIndex % messages.length]?.id || messageIndex} aria-live="polite"><span>{messages[messageIndex % messages.length]?.text}</span></div>}

      {/* ── Desktop canvas ── */}
      <section
        className={`desktop-canvas ${arrangeMode ? 'is-arranging' : ''}`}
        aria-label="Desktop"
        onClick={() => setSelectedIcon(null)}
        onContextMenu={e => {
          if ((e.target as HTMLElement).closest('.desktop-icon,.wf,.app-launcher,.ctx-menu,.tray-menu')) return;
          e.preventDefault();
          setCtxMenu({ x: Math.min(e.clientX, window.innerWidth - 200), y: Math.min(e.clientY, window.innerHeight - 140) });
          setMenuOpen(false);
        }}
      >
        {/* Pinned desktop icons */}
        {pinnedDesktop.map((id, index) => {
          const app = getAppDefinition(id); if (!app) return null;
          const Icon = appIcon(id);
          const pos = desktopPos[id] ?? positionForIndex(index);
          return (
            <button
              key={id}
              className={`desktop-icon icon-${id} ${selectedIcon === id ? 'is-selected' : ''} ${arrangeMode ? 'is-drag' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={e => { e.stopPropagation(); setSelectedIcon(id); handleIconPointerDown(e, id); }}
              onDoubleClick={() => openApp(id)}
              onClick={e => { e.stopPropagation(); if (!arrangeMode) setSelectedIcon(id); }}
              onContextMenu={e => { e.preventDefault(); e.stopPropagation(); setSelectedIcon(id); setIconActionMenu(id); setLauncherActionMenu(null); }}
              title={arrangeMode ? 'Drag to move' : `Open ${app.name}`}
            >
              <span className="di-img"><Icon size={24} strokeWidth={1.4} /></span>
              <span className="di-label">{app.name}</span>
            </button>
          );
        })}

        {/* Desktop right-click menu */}
        {ctxMenu && (
          <DesktopCtxMenu
            x={ctxMenu.x} y={ctxMenu.y}
            onClose={() => setCtxMenu(null)}
            onOpenLauncher={() => setMenuOpen(true)}
            onToggleArrange={() => setArrangeMode(v => !v)}
            arrangeMode={arrangeMode}
            wallpaper={prefs.wallpaper}
            onWallpaperChange={wallpaper => setPrefs(p => ({ ...p, wallpaper }))}
          />
        )}

        {/* Icon right-click pin menu — only from desktop icons, not launcher */}
        {iconActionMenu && (
          <>
            <div className="ctx-scrim" onClick={() => setIconActionMenu(null)} />
            <div className="ctx-menu" style={{ left: Math.min((desktopPos[iconActionMenu]?.x ?? 24) + 60, window.innerWidth - 210), top: Math.min((desktopPos[iconActionMenu]?.y ?? 48) + 60, window.innerHeight - 120) }}>
              <button onClick={() => { togglePin(iconActionMenu, 'desktop'); setIconActionMenu(null); }}>
                {pinnedDesktop.includes(iconActionMenu) ? <Check size={13} /> : <Plus size={13} />}
                <span>{pinnedDesktop.includes(iconActionMenu) ? 'Remove from desktop' : 'Pin to desktop'}</span>
              </button>
              <button onClick={() => { togglePin(iconActionMenu, 'dock'); setIconActionMenu(null); }}>
                {pinnedDock.includes(iconActionMenu) ? <Check size={13} /> : <Plus size={13} />}
                <span>{pinnedDock.includes(iconActionMenu) ? 'Remove from dock' : 'Pin to dock'}</span>
              </button>
            </div>
          </>
        )}
      </section>

      {/* ── Window layer ── */}
      <div className="window-layer">
        {windowState.windows.map((win, idx) => (
          <WindowFrame
            key={win.id} window={win}
            active={windowState.activeWindowId === win.id}
            zIndex={20 + (windowState.activeWindowId === win.id ? windowState.windows.length : idx)}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onToggleMaximize={() => toggleMaximize(win.id)}
            onMove={b => moveWindow(win.id, b)}
            onResize={b => resizeWindow(win.id, b)}
          >
            <AppHost appId={win.appId} settings={settingsProps} />
          </WindowFrame>
        ))}
      </div>

      {widgets.filter((widget) => widget.visible && widget.id !== previewWidget?.id).map((widget) => (
        <section key={widget.id} className="desktop-widget" style={{ left: widget.bounds.x, top: widget.bounds.y, width: widget.bounds.width, height: widget.bounds.height }}>
          <WidgetRuntime widget={widget} theme={prefs.theme} onOpenApp={(id) => { if (APP_REGISTRY.some((app) => app.id === id)) openApp(id as AppId); }} onOpenUrl={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
        </section>
      ))}
      {previewWidget && (
        <section className="desktop-widget widget-preview" style={{ left: previewWidget.bounds.x, top: previewWidget.bounds.y, width: previewWidget.bounds.width, height: previewWidget.bounds.height }}>
          <WidgetRuntime widget={previewWidget} theme={prefs.theme} onOpenApp={(id) => { if (APP_REGISTRY.some((app) => app.id === id)) openApp(id as AppId); }} onOpenUrl={(url) => window.open(url, '_blank', 'noopener,noreferrer')} />
          <button className="widget-preview-close" onClick={() => setPreviewWidget(null)}>Close preview</button>
        </section>
      )}

      {/* ── App launcher — centered above dock ── */}
      {menuOpen && (
        <>
          <button className="launcher-scrim" aria-label="Close launcher" onClick={() => { setMenuOpen(false); setLauncherActionMenu(null); }} />
          <section className="app-launcher" aria-label="Launcher" onClick={e => e.stopPropagation()}>
            <div className="launcher-header">
              <div className="launcher-brand"><Layers size={16} strokeWidth={1.5} /><span>Nexus</span></div>
              <button className="launcher-close" onClick={() => setMenuOpen(false)} aria-label="Close"><X size={14} /></button>
            </div>
            <label className="launcher-search">
              <Search size={14} />
              <input autoFocus value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="Search apps…" aria-label="Search" />
              {searchQuery && <button className="search-clear" onClick={() => setSearchQuery('')}><X size={11} /></button>}
            </label>
            {savedLinks.length > 0 && <div className="launcher-saved-links"><div className="launcher-saved-heading"><span>Saved links</span><span>{savedLinks.length}</span></div><div className="launcher-saved-list">{savedLinks.slice(0, 6).map(link => <button key={link.id} title={link.url} onClick={() => { try { const u = new URL(link.url); if (u.protocol === 'https:' || u.protocol === 'http:') window.open(u.href, '_blank', 'noopener,noreferrer'); } catch {} setMenuOpen(false); }}><span className="saved-link-favicon">{link.title.slice(0,1).toUpperCase()}</span><span>{link.title}</span><ExternalLink size={11} /></button>)}</div></div>}
            <div className="launcher-bar">
              <span>Applications</span>
              <div className="view-toggle">
                <button className={prefs.menuView === 'list' ? 'is-active' : ''} onClick={() => setPrefs(p => ({ ...p, menuView: 'list' }))} aria-label="List"><List size={12} /></button>
                <button className={prefs.menuView === 'grid' ? 'is-active' : ''} onClick={() => setPrefs(p => ({ ...p, menuView: 'grid' }))} aria-label="Grid"><Grid2X2 size={12} /></button>
              </div>
            </div>
            <div className={`launcher-list ${prefs.menuView === 'grid' ? 'is-grid' : ''}`}>
              {visibleApps.map(app => {
                const Icon = app.icon;
                const dp = pinnedDesktop.includes(app.id);
                const dk = pinnedDock.includes(app.id);
                const isOpen = launcherActionMenu === app.id;
                return (
                  <div className={`l-row ${isOpen ? 'is-open' : ''}`} key={app.id}>
                    <button className="l-app" onClick={() => openApp(app.id)}>
                      <span className={`l-icon icon-${app.id}`}><Icon size={18} strokeWidth={1.4} /></span>
                      <span className="l-info"><strong>{app.name}</strong><small>{app.description}</small></span>
                      {(dp || dk) && <Pin size={10} className="l-pin" />}
                    </button>
                    <button className="l-more" onClick={e => { e.stopPropagation(); setLauncherActionMenu(a => a === app.id ? null : app.id); setIconActionMenu(null); }} aria-label="Options">
                      <MoreHorizontal size={14} />
                    </button>
                    {isOpen && (
                      <div className="l-pin-menu">
                        <button onClick={() => { togglePin(app.id, 'desktop'); setLauncherActionMenu(null); }}>{dp ? <Check size={12} /> : <Plus size={12} />}<span>{dp ? 'Remove from desktop' : 'Pin to desktop'}</span></button>
                        <button onClick={() => { togglePin(app.id, 'dock'); setLauncherActionMenu(null); }}>{dk ? <Check size={12} /> : <Plus size={12} />}<span>{dk ? 'Remove from dock' : 'Pin to dock'}</span></button>
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleApps.length === 0 && <div className="l-empty">No apps found.</div>}
            </div>
            <div className="launcher-footer">
              <span className="launcher-footer-spacer" />
              <button className="changelog-trigger" onClick={() => { setChangelogOpen(true); setMenuOpen(false); }}>
                <History size={13} /><span>Changelog</span><span className="version-pill">v0.7.0</span>
              </button>
            </div>
          </section>
        </>
      )}

      {/* ── Dock — shows pinned + all currently open (unpinned) apps ── */}
      <nav className="dock" aria-label="Dock">
        {dockAppIds.map(id => {
          const app = getAppDefinition(id); if (!app) return null;
          const Icon = appIcon(id);
          const openWins = windowState.windows.filter(w => w.appId === id);
          const isActive = openWins.some(w => w.id === windowState.activeWindowId);
          const isPinned = pinnedDock.includes(id);
          const existingWin = [...windowState.windows].reverse().find(w => w.appId === id);
          return (
            <button
              key={id}
              className={`dock-item icon-${id} ${openWins.length > 0 ? 'has-win' : ''} ${isActive ? 'is-active' : ''} ${!isPinned ? 'is-transient' : ''}`}
              onClick={() => existingWin ? focusWindow(existingWin.id) : openApp(id)}
              title={app.name} aria-label={app.name}
            >
              <span className="dock-icon"><Icon size={20} strokeWidth={1.4} /></span>
              <span className="dock-label">{app.name}</span>
              {openWins.length > 0 && <span className="dock-dot" />}
            </button>
          );
        })}
        {dockAppIds.length > 0 && <div className="dock-sep" />}
        <button
          className={`dock-item dock-all ${menuOpen ? 'is-active' : ''}`}
          onClick={e => { e.stopPropagation(); setMenuOpen(o => !o); setSearchQuery(''); setLauncherActionMenu(null); }}
          aria-label="All apps" title="All apps"
        >
          <span className="dock-icon"><LayoutGrid size={18} strokeWidth={1.4} /></span>
          <span className="dock-label">Apps</span>
        </button>
      </nav>

      {/* ── Bottom-right tray widget ── */}
      <button
        className={`desktop-tray ${trayOpen ? 'is-open' : ''}`}
        onClick={e => { e.stopPropagation(); setTrayOpen(o => !o); setMenuOpen(false); }}
        aria-label="System tray — date and time"
      >
        <span className="tray-date">{now.toLocaleDateString([], { weekday: 'short', month: 'short', day: 'numeric' })}</span>
        <span className="tray-time">{timeStr}</span>
      </button>

      {/* Tray menu */}
      {trayOpen && (
        <TrayMenu
          now={now} theme={prefs.theme} hasPassword={Boolean(passwordRecord)}
          onToggleTheme={() => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}
          onLock={() => { try { sessionStorage.removeItem(SESSION_UNLOCKED); } catch { /* Locking the current view still works. */ } setScreen('lock'); }}
          onSetupPassword={() => setShowSetup(true)}
          onClose={() => setTrayOpen(false)}
          wallpaper={prefs.wallpaper}
          onWallpaperChange={wallpaper => setPrefs(p => ({ ...p, wallpaper }))}
        />
      )}

      {/* ── Changelog modal ── */}
      {changelogOpen && (
        <div className="changelog-scrim" role="presentation" onMouseDown={e => { if (e.target === e.currentTarget) setChangelogOpen(false); }}>
          <section className="changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
            <header className="changelog-hero">
              <div className="changelog-hero-top">
                <span className="changelog-mark"><History size={19} /></span>
                <button className="changelog-close" onClick={() => setChangelogOpen(false)} aria-label="Close changelog"><X size={15} /></button>
              </div>
              <div className="changelog-kicker">PRODUCT NOTES · RELEASE HISTORY</div>
              <div className="changelog-title-row">
                <h2 id="changelog-title">Changelog</h2>
                <span className="changelog-version">v0.7.0</span>
              </div>
              <p>Widget Studio gets its own workspace, with a clearer widget API for theme and local data.</p>
            </header>
            <div className="changelog-body">
              <div className="changelog-release-line"><span className="changelog-release-dot" /><div><strong>Current release · v0.7.0</strong><span>October 24, 2026 · Widget Studio</span></div></div>
              <section className="changelog-group"><h3><span className="change-icon added"><Sparkles size={14} /></span>v0.7.0 · Added</h3><ul><li>Widget Studio is now a standalone Nexus app with its own workspace and widget library sidebar.</li><li>Widget API for reading the active theme and requesting light/dark theme changes.</li><li>Namespaced local storage API with read, list, write, and remove operations.</li></ul></section>
              <section className="changelog-group"><h3><span className="change-icon updated"><Wrench size={14} /></span>v0.7.0 · Updated</h3><ul><li>Settings no longer includes the widget editor; widget creation and management live in Widget Studio.</li><li>Dropdown controls have consistent styling, focus states, and theme-aware colors.</li></ul></section>
              <section className="changelog-group"><h3><span className="change-icon fixed"><CheckCircle2 size={14} /></span>v0.7.0 · Fixed</h3><ul><li>Widget local values are initialized from host storage and refreshed in the iframe after successful writes or removals.</li><li>Widget local storage falls back safely when stored data is invalid or unavailable.</li></ul></section>
              <section className="changelog-group"><h3><span className="change-icon removed"><Trash2 size={14} /></span>v0.7.0 · Removed</h3><ul><li>Removed Widget Studio from the Settings sidebar; the feature itself remains available as a dedicated app.</li></ul></section>
              <div className="changelog-version-divider"><span>PREVIOUS RELEASES</span></div>
              <section className="changelog-group"><h3><span className="change-icon added"><Sparkles size={14} /></span>v0.6.0 · Settings and desktop polish</h3><ul><li>Added categorized Settings navigation for Appearance, Desktop, Desktop Messages, and Privacy.</li><li>Restored rotating desktop messages with editable defaults and a configurable refresh interval.</li><li>Added smooth wallpaper transitions and reduced-motion handling.</li></ul><p><strong>Removed:</strong> Nothing intentionally removed.</p></section>
              <section className="changelog-group"><h3><span className="change-icon updated"><Wrench size={14} /></span>v0.5.0 · Desktop experience</h3><ul><li>Added wallpaper controls to desktop and calendar menus, plus additional wallpaper palettes.</li><li>Improved launcher quick access for saved links and added foundations for host-mediated widget theme/storage APIs.</li><li>Improved minimized-window and dock restoration behavior.</li></ul><p><strong>Removed:</strong> The “Local workspace · No account” footer message.</p></section>
              <section className="changelog-group"><h3><span className="change-icon fixed"><CheckCircle2 size={14} /></span>v0.4.0 · Desktop UI polish</h3><ul><li>Added the Changelog launcher entry and release-notes modal.</li><li>Improved viewport-aware window handling, widget state foundations, URL validation, and lock-screen storage resilience.</li></ul><p><strong>Removed:</strong> Nothing intentionally removed.</p></section>
              <section className="changelog-group"><h3><span className="change-icon added"><Sparkles size={14} /></span>v0.3.x and earlier · Initial foundation</h3><ul><li>Introduced the OS-like new-tab workspace, launcher, dock, floating windows, desktop shortcuts, themes, wallpapers, clock, Settings, Saved links, Scratchpad, and early Widget Studio.</li></ul></section>
            </div>
            <footer className="changelog-footer"><span><span className="l-dot" /> Made for your workspace</span><button onClick={() => setChangelogOpen(false)}>Back to Nexus <ChevronR size={13} /></button></footer>
          </section>
        </div>
      )}

      {/* ── Password setup overlay ── */}
      {showSetup && (
        <PasswordSetup
          onSave={record => { setPasswordRecord(record); setShowSetup(false); }}
          onCancel={() => setShowSetup(false)}
        />
      )}
    </div>
  );
}
