import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type KeyboardEvent as ReactKeyboardEvent,
} from 'react';
import {
  Bookmark,
  CheckSquare,
  Columns2,
  Compass,
  LayoutGrid, Search, X, ChevronRight,
  Lock, Shield, Check, Plus, Pin,
  Minimize2,
  MoreHorizontal, List, Grid2X2, Layers,
  Settings as SettingsIcon,
  StickyNote,
  Sun, Moon, LogOut, RefreshCw, ChevronLeft, ChevronRight as ChevronR,
  History, Sparkles, CheckCircle2, Wrench, MinusCircle, Image, ExternalLink,
  Move, EyeOff, Code2,
} from 'lucide-react';
import {
  CURRENT_RELEASE,
  NEXUS_VERSION_TAG,
  PREVIOUS_RELEASES,
  type ChangelogCategory,
} from './data/version';
import { APP_REGISTRY, getAllAppDefinitions, getAppDefinition } from './apps/registry';
import { AppHost } from './apps/AppHost';
import { WindowFrame } from './window-manager/WindowFrame';
import {
  applyWindowSnap,
  clampBounds,
  computeSnapBounds,
  createInitialWindowState,
  makeWindow,
  persistWindowCounter,
  persistWindowState,
  unsnapWindow,
} from './window-manager/window-store';
import type { AppId, DesktopWindow, SnapZone, WindowBounds, WindowState } from './window-manager/types';
import { DEFAULT_MESSAGES, readMessages, saveMessages } from './data/messages';
import type { DesktopMessage } from './data/messages';
import {
  clampDesktopPosition,
  clampWidgetBounds,
  positionForIndex,
  snapDesktopPosition,
  type DesktopPosition,
} from './desktop/layout';
import { readWidgets, saveWidgets } from './widgets/types';
import type { WidgetDefinition } from './widgets/types';
import { WidgetRuntime } from './widgets/WidgetRuntime';
import {
  isShortcutAppId,
  normalizeHttpUrl,
  readShortcuts,
  saveShortcuts,
  toShortcutAppId,
  type SavedShortcut,
} from './data/shortcuts';
import { AppIconGraphic } from './components/ShortcutFavicon';
import {
  clearPasscodeRecord,
  computeSplashDurationMs,
  createPasscodeRecord,
  readPasscodeRecord,
  savePasscodeRecord,
  SESSION_SPLASH_SHOWN,
  SESSION_UNLOCKED,
  verifyPasscode,
  type PasscodeRecord,
} from './security/passcode';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  clearAllWorkspaceStorage,
  parseAndValidateWorkspaceBackup,
} from './persistence/workspace-backup';
import { enqueueBrowserNavigation } from './data/browser';
import {
  createScratchpadNote,
  readNotesState,
  SAMPLE_CHECKLIST_TEMPLATE,
  saveNotesState,
} from './data/notes';
import { SpotlightPalette } from './components/SpotlightPalette';
import type { SpotlightCommandPayload } from './spotlight/spotlight-engine';
import { NEXUS_OPEN_APP_EVENT, type OpenAppEventDetail } from './data/context-actions';
import {
  clampMenuPosition,
  computeLauncherMenuPlacement,
  tileTopTwoWindows,
} from './desktop/menu-layout';

/* ─── Constants ───────────────────────────────────────────────────────────── */
const SETTINGS_KEY       = 'nexus.settings.v1';
const PINNED_DESKTOP_KEY = 'nexus.pinned-desktop.v1';
const PINNED_DOCK_KEY    = 'nexus.pinned-dock.v1';
const DESKTOP_POS_KEY    = 'nexus.desktop-positions.v1';

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
  showMessages:    boolean;
  restoreSession:  boolean;
  menuView:        MenuView;
  msgRefreshMins:  number; // minutes between message rotation, 1-60
}

const DEFAULT_PREFS: Preferences = {
  theme: 'light',
  wallpaper: 'mist',
  showSeconds: false,
  showMessages: true,
  restoreSession: false,
  menuView: 'list',
  msgRefreshMins: 5,
};

function readPrefs(): Preferences {
  try {
    const s = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}') as Partial<Preferences>;
    const wallpapers = WALLPAPERS.map(w => w.id);
    return {
      theme:          s.theme === 'dark' ? 'dark' : 'light',
      wallpaper:      wallpapers.includes(s.wallpaper as Wallpaper) ? s.wallpaper as Wallpaper : 'mist',
      showSeconds:    s.showSeconds === true,
      showMessages:   s.showMessages !== false,
      restoreSession: s.restoreSession === true,
      menuView:       s.menuView === 'grid' ? 'grid' : 'list',
      msgRefreshMins: (typeof s.msgRefreshMins === 'number' && s.msgRefreshMins >= 1 && s.msgRefreshMins <= 60)
                        ? s.msgRefreshMins : 5,
    };
  } catch { return DEFAULT_PREFS; }
}

function readPinned(key: string, shortcuts: SavedShortcut[]): AppId[] {
  try {
    const s: unknown = JSON.parse(localStorage.getItem(key) || '[]');
    if (!Array.isArray(s)) return [];
    const shortcutIds = new Set(shortcuts.map(item => toShortcutAppId(item.id)));
    return s.filter(
      (id): id is AppId =>
        typeof id === 'string' &&
        (APP_REGISTRY.some(a => a.id === id) || shortcutIds.has(id as `shortcut:${string}`))
    );
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

function resolvePostSplashScreen(passwordRecord: PasscodeRecord | null): 'lock' | 'desktop' {
  let unlocked = false;
  try {
    unlocked = sessionStorage.getItem(SESSION_UNLOCKED) === '1';
  } catch {
    /* Fall back to lock screen when sessionStorage is unavailable */
  }
  return !passwordRecord || unlocked ? 'desktop' : 'lock';
}

function getInitialSplashDelayMs(): number {
  let prefersReducedMotion = false;
  try {
    prefersReducedMotion =
      typeof window !== 'undefined' &&
      typeof window.matchMedia === 'function' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  } catch {
    prefersReducedMotion = false;
  }
  let alreadyShownInSession = false;
  try {
    alreadyShownInSession = sessionStorage.getItem(SESSION_SPLASH_SHOWN) === '1';
  } catch {
    alreadyShownInSession = false;
  }
  return computeSplashDurationMs({ prefersReducedMotion, alreadyShownInSession });
}

function openExternalUrlSafely(rawUrl: string) {
  const safe = normalizeHttpUrl(rawUrl);
  if (!safe) return;
  const anchor = document.createElement('a');
  anchor.href = safe;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
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
  passwordRecord: PasscodeRecord | null;
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
      if (await verifyPasscode(input, passwordRecord)) {
        setInput('');
        onUnlock();
      } else {
        setError('Incorrect passcode');
        setInput('');
        inputRef.current?.focus();
      }
    } catch {
      setError('Verification failed.');
    } finally {
      setBusy(false);
    }
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
              placeholder={passwordRecord ? 'Enter passcode…' : 'Press Enter to unlock'}
              value={input} onChange={e => setInput(e.target.value)}
              onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}
              aria-label="Passcode"
            />
            <button type="submit" className={`lock-go ${(input || !passwordRecord) ? 'is-ready' : ''}`} disabled={busy} aria-label="Unlock">
              <ChevronRight size={16} />
            </button>
          </div>
          {error && <p className="lock-error" role="alert">{error}</p>}
        </form>
        <p className="lock-footnote"><Lock size={10} />Local privacy lock · Stored in browser</p>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════
   PASSWORD SETUP, VERIFICATION & REMOVAL MODAL
   ════════════════════════════════════════════════════════════════════════════ */
interface SetupProps {
  existingRecord: PasscodeRecord | null;
  initialIntent: 'setup' | 'remove';
  onSave: (record: PasscodeRecord) => void;
  onRemove: () => void;
  onCancel: () => void;
}
function PasswordSetup({ existingRecord, initialIntent, onSave, onRemove, onCancel }: SetupProps) {
  const [tab, setTab]         = useState<'change' | 'remove'>(
    existingRecord && initialIntent === 'remove' ? 'remove' : 'change'
  );
  const [currentPw, setCurrentPw] = useState('');
  const [pw, setPw]               = useState('');
  const [confirm, setConfirm]     = useState('');
  const [error, setError]         = useState('');
  const [busy, setBusy]           = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (existingRecord) {
      if (!currentPw) {
        setError('Enter your current passcode first.');
        return;
      }
      setBusy(true);
      try {
        const valid = await verifyPasscode(currentPw, existingRecord);
        if (!valid) {
          setError('Current passcode is incorrect.');
          setBusy(false);
          return;
        }
        if (tab === 'remove') {
          clearPasscodeRecord();
          onRemove();
          return;
        }
      } catch {
        setError('Could not verify current passcode.');
        setBusy(false);
        return;
      }
    }

    if (pw.length < 4) {
      setBusy(false);
      setError('Use at least 4 characters.');
      return;
    }
    if (pw !== confirm) {
      setBusy(false);
      setError('Passcodes do not match.');
      return;
    }

    setBusy(true);
    try {
      const record = await createPasscodeRecord(pw);
      savePasscodeRecord(record);
      onSave(record);
    } catch {
      setError('Could not save passcode.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="overlay-scrim"
      role="presentation"
      onMouseDown={e => { if (e.target === e.currentTarget) onCancel(); }}
    >
      <div className="setup-card" role="dialog" aria-modal="true" aria-labelledby="passcode-modal-title">
        <div className="setup-card-head">
          <div className="setup-icon"><Shield size={20} strokeWidth={1.5} /></div>
          {existingRecord && (
            <div className="ws-seg setup-mode-tabs" role="tablist" aria-label="Passcode action">
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'change'}
                className={tab === 'change' ? 'is-active' : ''}
                onClick={() => { setTab('change'); setError(''); }}
              >
                Change
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={tab === 'remove'}
                className={tab === 'remove' ? 'is-active' : ''}
                onClick={() => { setTab('remove'); setError(''); }}
              >
                Remove
              </button>
            </div>
          )}
        </div>

        <h2 id="passcode-modal-title">
          {!existingRecord
            ? 'Set workspace passcode'
            : tab === 'remove'
              ? 'Remove passcode'
              : 'Change passcode'}
        </h2>
        <p>
          {tab === 'remove' && existingRecord
            ? 'Confirm your current passcode to turn off the lock screen for future tabs.'
            : 'Adds a local privacy screen on this browser. Derived with PBKDF2-SHA256; never sent to a server.'}
        </p>

        <form onSubmit={submit}>
          {existingRecord && (
            <>
              <label htmlFor="sp-current">Current passcode</label>
              <input
                id="sp-current"
                type="password"
                autoFocus
                value={currentPw}
                onChange={e => setCurrentPw(e.target.value)}
                placeholder="Enter current passcode"
                required
                autoComplete="current-password"
              />
            </>
          )}

          {(!existingRecord || tab === 'change') && (
            <>
              <label htmlFor="sp1">{existingRecord ? 'New passcode' : 'Passcode'}</label>
              <input
                id="sp1"
                type="password"
                autoFocus={!existingRecord}
                value={pw}
                onChange={e => setPw(e.target.value)}
                placeholder="Min 4 characters"
                required
                minLength={4}
                autoComplete="new-password"
              />
              <label htmlFor="sp2">Confirm {existingRecord ? 'new passcode' : 'passcode'}</label>
              <input
                id="sp2"
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Repeat passcode"
                required
                minLength={4}
                autoComplete="new-password"
              />
            </>
          )}

          <p className="setup-threat-note">
            Note: Local passcodes deter casual access on shared screens, but someone with access to browser storage can reset local data.
          </p>

          {error && <p className="form-error" role="alert">{error}</p>}

          <div className="setup-actions">
            <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
            <button
              type="submit"
              className={`btn-primary ${tab === 'remove' && existingRecord ? 'is-danger' : ''}`}
              disabled={busy}
            >
              {busy
                ? 'Working…'
                : !existingRecord
                  ? 'Set passcode'
                  : tab === 'remove'
                    ? 'Remove passcode'
                    : 'Update passcode'}
            </button>
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
  x: number;
  y: number;
  onClose: () => void;
  onCreateNote: () => void;
  onCreateChecklist: () => void;
  onOpenNewBrowserTab: () => void;
  onOpenBookmarks: () => void;
  onOpenSpotlight: () => void;
  onOpenLauncher: () => void;
  visibleWindowCount: number;
  minimizedWindowCount: number;
  onTileWindows: () => void;
  onMinimizeAllWindows: () => void;
  onRestoreWindows: () => void;
  onToggleArrange: () => void;
  arrangeMode: boolean;
  onOpenWidgets: () => void;
  theme: Theme;
  onToggleTheme: () => void;
  canRotateQuote: boolean;
  onNextQuote: () => void;
  wallpaper: Wallpaper;
  onWallpaperChange: (wallpaper: Wallpaper) => void;
  onOpenSettings: () => void;
  hasPassword: boolean;
  onLock: () => void;
}
function DesktopCtxMenu({
  x,
  y,
  onClose,
  onCreateNote,
  onCreateChecklist,
  onOpenNewBrowserTab,
  onOpenBookmarks,
  onOpenSpotlight,
  onOpenLauncher,
  visibleWindowCount,
  minimizedWindowCount,
  onTileWindows,
  onMinimizeAllWindows,
  onRestoreWindows,
  onToggleArrange,
  arrangeMode,
  onOpenWidgets,
  theme,
  onToggleTheme,
  canRotateQuote,
  onNextQuote,
  wallpaper,
  onWallpaperChange,
  onOpenSettings,
  hasPassword,
  onLock,
}: CtxProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [coords, setCoords] = useState(() =>
    clampMenuPosition(x, y, 248, 420, window.innerWidth, window.innerHeight, 12)
  );

  useLayoutEffect(() => {
    const updatePosition = () => {
      const el = menuRef.current;
      if (!el) return;
      const rect = el.getBoundingClientRect();
      setCoords(
        clampMenuPosition(x, y, rect.width, rect.height, window.innerWidth, window.innerHeight, 12)
      );
    };
    updatePosition();
    window.addEventListener('resize', updatePosition);
    return () => window.removeEventListener('resize', updatePosition);
  }, [x, y, visibleWindowCount, minimizedWindowCount, canRotateQuote, hasPassword]);

  const currentWallpaperName = WALLPAPERS.find((w) => w.id === wallpaper)?.name ?? 'Soft mist';

  return (
    <>
      <div className="ctx-scrim" onClick={onClose} onContextMenu={(e) => { e.preventDefault(); onClose(); }} />
      <div
        ref={menuRef}
        className="ctx-menu desktop-ctx-menu"
        style={{ left: coords.x, top: coords.y }}
        role="menu"
        aria-label="Desktop actions"
        onClick={(e) => e.stopPropagation()}
      >
        <button type="button" role="menuitem" onClick={() => { onCreateNote(); onClose(); }}>
          <StickyNote size={13} />
          <span>New note</span>
        </button>
        <button type="button" role="menuitem" onClick={() => { onCreateChecklist(); onClose(); }}>
          <CheckSquare size={13} />
          <span>New checklist</span>
        </button>
        <button type="button" role="menuitem" onClick={() => { onOpenNewBrowserTab(); onClose(); }}>
          <Compass size={13} />
          <span>New browser tab</span>
        </button>
        <button type="button" role="menuitem" onClick={() => { onOpenBookmarks(); onClose(); }}>
          <Bookmark size={13} />
          <span>Add web shortcut</span>
        </button>

        <div className="ctx-sep" role="separator" />

        <button type="button" role="menuitem" onClick={() => { onOpenSpotlight(); onClose(); }}>
          <Search size={13} />
          <span>Command palette</span>
          <kbd className="ctx-kbd">⌘K</kbd>
        </button>
        <button type="button" role="menuitem" onClick={() => { onOpenLauncher(); onClose(); }}>
          <LayoutGrid size={13} />
          <span>Open app launcher</span>
        </button>
        {visibleWindowCount >= 2 && (
          <button type="button" role="menuitem" onClick={() => { onTileWindows(); onClose(); }}>
            <Columns2 size={13} />
            <span>Tile windows side by side</span>
          </button>
        )}
        {visibleWindowCount >= 1 && (
          <button type="button" role="menuitem" onClick={() => { onMinimizeAllWindows(); onClose(); }}>
            <Minimize2 size={13} />
            <span>Show desktop</span>
          </button>
        )}
        {visibleWindowCount === 0 && minimizedWindowCount >= 1 && (
          <button type="button" role="menuitem" onClick={() => { onRestoreWindows(); onClose(); }}>
            <Layers size={13} />
            <span>Restore {minimizedWindowCount === 1 ? 'window' : `${minimizedWindowCount} windows`}</span>
          </button>
        )}

        <div className="ctx-sep" role="separator" />

        <button type="button" role="menuitem" onClick={() => { onToggleArrange(); onClose(); }}>
          <Move size={13} />
          <span>{arrangeMode ? 'Done arranging' : 'Arrange desktop'}</span>
          <kbd className="ctx-kbd">F2</kbd>
        </button>
        <button type="button" role="menuitem" onClick={() => { onOpenWidgets(); onClose(); }}>
          <Code2 size={13} />
          <span>Manage widgets</span>
        </button>
        <button type="button" role="menuitem" onClick={() => { onToggleTheme(); onClose(); }}>
          {theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
          <span>{theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}</span>
        </button>
        {canRotateQuote && (
          <button type="button" role="menuitem" onClick={() => { onNextQuote(); onClose(); }}>
            <RefreshCw size={13} />
            <span>Next desktop quote</span>
          </button>
        )}
        <button
          type="button"
          role="menuitem"
          onClick={() =>
            onWallpaperChange(
              WALLPAPERS[(WALLPAPERS.findIndex((w) => w.id === wallpaper) + 1) % WALLPAPERS.length].id
            )
          }
        >
          <Image size={13} />
          <span>Next wallpaper</span>
          <span className="ctx-meta">{currentWallpaperName}</span>
        </button>
        <div className="ctx-wallpaper-options" role="group" aria-label="Choose wallpaper">
          {WALLPAPERS.map((w) => (
            <button
              type="button"
              key={w.id}
              className={wallpaper === w.id ? 'is-current' : ''}
              title={w.name}
              aria-label={w.name}
              onClick={() => onWallpaperChange(w.id)}
            >
              <span className={`wallpaper-swatch swatch-${w.id}`} />
            </button>
          ))}
        </div>

        <div className="ctx-sep" role="separator" />

        <button type="button" role="menuitem" onClick={() => { onOpenSettings(); onClose(); }}>
          <SettingsIcon size={13} />
          <span>Workspace settings</span>
        </button>
        {hasPassword && (
          <button type="button" role="menuitem" onClick={() => { onLock(); onClose(); }}>
            <Lock size={13} />
            <span>Lock workspace</span>
          </button>
        )}
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
  onSetupPassword: () => void; onRemovePassword: () => void; onClose: () => void;
  wallpaper: Wallpaper; onWallpaperChange: (wallpaper: Wallpaper) => void;
}
function TrayMenu({ now, theme, hasPassword, onToggleTheme, onLock, onSetupPassword, onRemovePassword, onClose, wallpaper, onWallpaperChange }: TrayMenuProps) {
  return (
    <>
      <div className="ctx-scrim" onClick={onClose} />
      <div className="tray-menu" role="dialog" aria-label="System tray">
        <MiniCalendar today={now} />
        <div className="tray-sep" />
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
          {hasPassword && (
            <button className="tray-action" onClick={() => { onRemovePassword(); onClose(); }}>
              <X size={14} />
              <span>Remove passcode</span>
            </button>
          )}
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
  const [passwordRecord, setPasswordRecord] = useState<PasscodeRecord | null>(readPasscodeRecord);
  const [initialSplashMs] = useState<number>(getInitialSplashDelayMs);
  const [screen, setScreen] = useState<EntryScreen>(() =>
    initialSplashMs > 0 ? 'splash' : resolvePostSplashScreen(readPasscodeRecord())
  );
  const [prefs, setPrefs]               = useState<Preferences>(readPrefs);
  const [shortcuts, setShortcuts]       = useState<SavedShortcut[]>(readShortcuts);
  const [windowState, setWindowState]   = useState<WindowState>(() => {
    const initialPrefs = readPrefs();
    const initialShortcuts = readShortcuts();
    const validAppIds = new Set<string>([
      ...APP_REGISTRY.map(a => a.id),
      ...initialShortcuts.map(s => toShortcutAppId(s.id)),
    ]);
    return createInitialWindowState({
      restoreSession: initialPrefs.restoreSession,
      validAppIds,
      viewportWidth: typeof window !== 'undefined' ? window.innerWidth : 1280,
      viewportHeight: typeof window !== 'undefined' ? window.innerHeight : 800,
    });
  });
  const [snapPreviewZone, setSnapPreviewZone] = useState<SnapZone | null>(null);
  const [now, setNow]                   = useState(() => new Date());
  const [menuOpen, setMenuOpen]         = useState(false);
  const [searchQuery, setSearchQuery]   = useState('');
  const [launcherFilter, setLauncherFilter] = useState<'all' | 'core' | 'shortcut'>('all');
  const [launcherActiveIdx, setLauncherActiveIdx] = useState(0);

  /* Separate action menu state for launcher, desktop icon, and dock to prevent double menus */
  const [launcherActionMenu, setLauncherActionMenu] = useState<AppId | null>(null);
  const [iconActionMenu, setIconActionMenu]         = useState<{ id: AppId; x: number; y: number } | null>(null);
  const [dockActionMenu, setDockActionMenu]         = useState<{ id: AppId; x: number } | null>(null);
  const [pinnedDesktop, setPinnedDesktop] = useState<AppId[]>(() => readPinned(PINNED_DESKTOP_KEY, readShortcuts()));
  const [pinnedDock, setPinnedDock]     = useState<AppId[]>(() => readPinned(PINNED_DOCK_KEY, readShortcuts()));
  const [selectedIcon, setSelectedIcon] = useState<AppId | null>(null);
  const [arrangeMode, setArrangeMode]   = useState(false);
  const [desktopPos, setDesktopPos]     = useState<Record<string, DesktopPosition>>(readDesktopPositions);
  const [setupIntent, setSetupIntent]   = useState<'setup' | 'remove' | null>(null);
  const [ctxMenu, setCtxMenu]           = useState<{ x: number; y: number } | null>(null);
  const [trayOpen, setTrayOpen]         = useState(false);
  const [messageIndex, setMessageIndex] = useState(0);
  const [messages, setMessages]         = useState<DesktopMessage[]>(readMessages);
  const [widgets, setWidgets]           = useState<WidgetDefinition[]>(readWidgets);
  const [previewWidget, setPreviewWidget] = useState<WidgetDefinition | null>(null);
  const [changelogOpen, setChangelogOpen] = useState(false);
  const [spotlightOpen, setSpotlightOpen] = useState(false);

  /* Focus restoration for modals and launcher (FR-11) */
  const restoreFocusRef = useRef<HTMLElement | null>(null);
  const launcherListRef = useRef<HTMLDivElement | null>(null);
  const isDraggingRef   = useRef(false);

  const captureFocusOrigin = useCallback(() => {
    if (document.activeElement instanceof HTMLElement) {
      restoreFocusRef.current = document.activeElement;
    }
  }, []);

  const restoreFocusOrigin = useCallback(() => {
    const target = restoreFocusRef.current;
    restoreFocusRef.current = null;
    if (target && document.contains(target)) {
      window.requestAnimationFrame(() => target.focus());
    }
  }, []);

  const openSpotlight = useCallback(() => {
    captureFocusOrigin();
    setMenuOpen(false);
    setLauncherActionMenu(null);
    setIconActionMenu(null);
    setDockActionMenu(null);
    setCtxMenu(null);
    setTrayOpen(false);
    setSpotlightOpen(true);
  }, [captureFocusOrigin]);

  const closeSpotlight = useCallback((restore = true) => {
    setSpotlightOpen(false);
    if (restore) restoreFocusOrigin();
  }, [restoreFocusOrigin]);

  const openLauncher = useCallback(() => {
    captureFocusOrigin();
    setSpotlightOpen(false);
    setCtxMenu(null);
    setIconActionMenu(null);
    setDockActionMenu(null);
    setTrayOpen(false);
    setSearchQuery('');
    setLauncherActiveIdx(0);
    setLauncherActionMenu(null);
    setMenuOpen(true);
  }, [captureFocusOrigin]);

  const closeLauncher = useCallback((restore = true) => {
    setMenuOpen(false);
    setLauncherActionMenu(null);
    if (restore) restoreFocusOrigin();
  }, [restoreFocusOrigin]);

  useEffect(() => {
    const handleWidgetTheme = (event: Event) => {
      const requested = (event as CustomEvent).detail;
      if (requested === 'light' || requested === 'dark') {
        setPrefs(p => ({ ...p, theme: requested }));
      }
    };
    window.addEventListener('nexus:widget-theme-request', handleWidgetTheme);
    return () => window.removeEventListener('nexus:widget-theme-request', handleWidgetTheme);
  }, []);

  useEffect(() => {
    const refreshFromStorage = () => setShortcuts(readShortcuts());
    window.addEventListener('storage', refreshFromStorage);
    return () => window.removeEventListener('storage', refreshFromStorage);
  }, []);

  const handleShortcutsChange = useCallback((next: SavedShortcut[]) => {
    setShortcuts(next);
    saveShortcuts(next);
    /* Keep open shortcut window titles synchronized if a shortcut is renamed */
    setWindowState(s => ({
      ...s,
      windows: s.windows.map(win => {
        if (!isShortcutAppId(win.appId)) return win;
        const found = next.find(item => toShortcutAppId(item.id) === win.appId);
        return found && found.title !== win.title ? { ...win, title: found.title } : win;
      }),
    }));
  }, []);

  const handleRemoveShortcut = useCallback((shortcutId: string) => {
    const appId = toShortcutAppId(shortcutId);
    setShortcuts(prev => {
      const next = prev.filter(item => item.id !== shortcutId);
      saveShortcuts(next);
      return next;
    });
    setPinnedDesktop(prev => prev.filter(id => id !== appId));
    setPinnedDock(prev => prev.filter(id => id !== appId));
    setDesktopPos(prev => {
      if (!(appId in prev)) return prev;
      const copy = { ...prev };
      delete copy[appId];
      return copy;
    });
    setWindowState(s => {
      const wins = s.windows.filter(w => w.appId !== appId);
      return {
        ...s,
        windows: wins,
        activeWindowId: wins.some(w => w.id === s.activeWindowId)
          ? s.activeWindowId
          : (wins.filter(w => w.status !== 'minimized').at(-1)?.id ?? null),
      };
    });
  }, []);

  /* ── Splash → screen (skips wait on reduced motion or active session reload) ── */
  useEffect(() => {
    if (screen !== 'splash') {
      try { sessionStorage.setItem(SESSION_SPLASH_SHOWN, '1'); } catch {}
      return;
    }
    const t = setTimeout(() => {
      try { sessionStorage.setItem(SESSION_SPLASH_SHOWN, '1'); } catch {}
      setScreen(resolvePostSplashScreen(passwordRecord));
    }, initialSplashMs);
    return () => clearTimeout(t);
  }, [initialSplashMs, passwordRecord, screen]);

  const handleUnlock = () => {
    try { sessionStorage.setItem(SESSION_UNLOCKED, '1'); } catch {}
    setScreen('desktop');
  };

  /* ── Clock ──────────────────────────────────────────────────────────── */
  useEffect(() => {
    const iv = setInterval(() => setNow(new Date()), prefs.showSeconds ? 1000 : 15_000);
    return () => clearInterval(iv);
  }, [prefs.showSeconds]);

  /* ── Persist (defer storage writes while active pointer drag is in flight) ── */
  useEffect(() => { try { localStorage.setItem(SETTINGS_KEY, JSON.stringify(prefs)); } catch {} }, [prefs]);
  useEffect(() => { try { localStorage.setItem(PINNED_DESKTOP_KEY, JSON.stringify(pinnedDesktop)); } catch {} }, [pinnedDesktop]);
  useEffect(() => { try { localStorage.setItem(PINNED_DOCK_KEY, JSON.stringify(pinnedDock)); } catch {} }, [pinnedDock]);
  useEffect(() => {
    if (isDraggingRef.current) return;
    try { localStorage.setItem(DESKTOP_POS_KEY, JSON.stringify(desktopPos)); } catch {}
  }, [desktopPos]);
  useEffect(() => { saveMessages(messages); }, [messages]);
  useEffect(() => {
    if (!prefs.showMessages || !messages.length) { setMessageIndex(0); return; }
    setMessageIndex(i => i % messages.length);
    const timer = window.setInterval(
      () => setMessageIndex(i => (i + 1) % Math.max(messages.length, 1)),
      Math.max(1, prefs.msgRefreshMins) * 60_000
    );
    return () => window.clearInterval(timer);
  }, [messages.length, prefs.msgRefreshMins, prefs.showMessages]);
  useEffect(() => {
    if (isDraggingRef.current) return;
    saveWidgets(widgets);
  }, [widgets]);
  useEffect(() => {
    persistWindowState(windowState, prefs.restoreSession);
  }, [windowState, prefs.restoreSession]);

  /* Keep floating windows, snapped splits, desktop icons, and widgets reachable when viewport resizes (FR-03) */
  useEffect(() => {
    const handleViewportResize = () => {
      const vw = window.innerWidth;
      const vh = window.innerHeight;

      setWindowState(state => {
        let changed = false;
        const windows = state.windows.map(win => {
          if (win.status === 'maximized') {
            if (!win.restoreBounds) return win;
            const restoreBounds = clampBounds(win.restoreBounds, vw, vh);
            if (restoreBounds.x === win.restoreBounds.x && restoreBounds.y === win.restoreBounds.y && restoreBounds.width === win.restoreBounds.width && restoreBounds.height === win.restoreBounds.height) return win;
            changed = true;
            return { ...win, restoreBounds };
          }
          if (win.snapZone) {
            const snappedBounds = computeSnapBounds(win.snapZone, vw, vh);
            const restoreBounds = win.restoreBounds ? clampBounds(win.restoreBounds, vw, vh) : undefined;
            if (
              snappedBounds.x === win.bounds.x &&
              snappedBounds.y === win.bounds.y &&
              snappedBounds.width === win.bounds.width &&
              snappedBounds.height === win.bounds.height &&
              (!restoreBounds ||
                (restoreBounds.x === win.restoreBounds?.x &&
                  restoreBounds.y === win.restoreBounds?.y &&
                  restoreBounds.width === win.restoreBounds?.width &&
                  restoreBounds.height === win.restoreBounds?.height))
            ) {
              return win;
            }
            changed = true;
            return { ...win, bounds: snappedBounds, ...(restoreBounds ? { restoreBounds } : {}) };
          }
          const bounds = clampBounds(win.bounds, vw, vh);
          if (bounds.x === win.bounds.x && bounds.y === win.bounds.y && bounds.width === win.bounds.width && bounds.height === win.bounds.height) return win;
          changed = true;
          return { ...win, bounds };
        });
        return changed ? { ...state, windows } : state;
      });

      setDesktopPos(prev => {
        let changed = false;
        const next: Record<string, DesktopPosition> = {};
        for (const [id, pos] of Object.entries(prev)) {
          const clamped = clampDesktopPosition(pos, vw, vh);
          if (clamped.x !== pos.x || clamped.y !== pos.y) changed = true;
          next[id] = clamped;
        }
        return changed ? next : prev;
      });

      setWidgets(prev => {
        let changed = false;
        const next = prev.map(w => {
          const clamped = clampWidgetBounds(w.bounds, vw, vh, false);
          if (
            clamped.x === w.bounds.x &&
            clamped.y === w.bounds.y &&
            clamped.width === w.bounds.width &&
            clamped.height === w.bounds.height
          ) {
            return w;
          }
          changed = true;
          return { ...w, bounds: clamped };
        });
        return changed ? next : prev;
      });
    };
    window.addEventListener('resize', handleViewportResize);
    return () => window.removeEventListener('resize', handleViewportResize);
  }, []);

  /* ── Global Keyboard Shortcuts & Escape Dismissal ───────────────────── */
  useEffect(() => {
    const h = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && !e.shiftKey && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (screen !== 'desktop') return;
        if (spotlightOpen) closeSpotlight(true);
        else openSpotlight();
        return;
      }
      if (e.key === 'Escape') {
        if (setupIntent) {
          setSetupIntent(null);
          restoreFocusOrigin();
          return;
        }
        if (changelogOpen) {
          setChangelogOpen(false);
          restoreFocusOrigin();
          return;
        }
        if (spotlightOpen) {
          closeSpotlight(true);
          return;
        }
        if (menuOpen) {
          if (launcherActionMenu) {
            setLauncherActionMenu(null);
          } else {
            closeLauncher(true);
          }
          return;
        }
        if (arrangeMode) {
          setArrangeMode(false);
        }
        setLauncherActionMenu(null);
        setIconActionMenu(null);
        setDockActionMenu(null);
        setSelectedIcon(null);
        setCtxMenu(null);
        setTrayOpen(false);
      }
      if (e.key === 'F2') {
        e.preventDefault();
        setArrangeMode(v => !v);
        return;
      }

      /* Active window snapping shortcuts: Alt+[ (Left), Alt+] (Right), Alt+ArrowUp (Maximize), Alt+ArrowDown (Restore) */
      if (e.altKey && !e.ctrlKey && !e.metaKey && windowState.activeWindowId) {
        const activeId = windowState.activeWindowId;
        if (e.key === '[') {
          e.preventDefault();
          setWindowState(s => ({
            ...s,
            windows: s.windows.map(w =>
              w.id === activeId ? applyWindowSnap(w, 'left', window.innerWidth, window.innerHeight) : w
            ),
          }));
          return;
        }
        if (e.key === ']') {
          e.preventDefault();
          setWindowState(s => ({
            ...s,
            windows: s.windows.map(w =>
              w.id === activeId ? applyWindowSnap(w, 'right', window.innerWidth, window.innerHeight) : w
            ),
          }));
          return;
        }
        if (e.key === 'ArrowUp') {
          e.preventDefault();
          setWindowState(s => ({
            ...s,
            windows: s.windows.map(w =>
              w.id === activeId ? applyWindowSnap(w, 'top', window.innerWidth, window.innerHeight) : w
            ),
          }));
          return;
        }
        if (e.key === 'ArrowDown') {
          e.preventDefault();
          setWindowState(s => ({
            ...s,
            windows: s.windows.map(w =>
              w.id === activeId ? unsnapWindow(w, window.innerWidth, window.innerHeight) : w
            ),
          }));
          return;
        }
      }
    };
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [arrangeMode, changelogOpen, closeLauncher, closeSpotlight, launcherActionMenu, menuOpen, openSpotlight, restoreFocusOrigin, screen, setupIntent, spotlightOpen, windowState.activeWindowId]);

  /* ── Window ops ──────────────────────────────────────────────────────── */
  const openApp = useCallback((appId: AppId, preferExisting = false) => {
    const def = getAppDefinition(appId, shortcuts); if (!def) return;
    setWindowState(s => {
      const isSingleInstance =
        preferExisting || appId === 'settings' || appId === 'bookmarks' || isShortcutAppId(appId);
      const existing = isSingleInstance
        ? [...s.windows].reverse().find(w => w.appId === appId)
        : undefined;
      if (existing) {
        return {
          ...s,
          activeWindowId: existing.id,
          windows: s.windows.map(w =>
            w.id === existing.id && w.status === 'minimized' ? { ...w, status: 'normal' } : w
          ),
        };
      }
      const id = `window-${s.nextId}`;
      const offset = (s.nextId % 5) * 22;
      const bounds = clampBounds({ ...def.defaultBounds, x: def.defaultBounds.x + offset, y: def.defaultBounds.y + offset }, window.innerWidth, window.innerHeight);
      const win = makeWindow(appId, id, bounds, def.name);
      const next = { ...s, windows: [...s.windows, win], activeWindowId: id, nextId: s.nextId + 1 };
      persistWindowCounter(next.nextId);
      return next;
    });
    setMenuOpen(false); setSpotlightOpen(false); setLauncherActionMenu(null); setIconActionMenu(null); setDockActionMenu(null); setCtxMenu(null); setTrayOpen(false);
    restoreFocusRef.current = null;
  }, [shortcuts]);

  const handleCreateQuickNote = useCallback(
    (checklist = false) => {
      const current = readNotesState();
      const fresh = createScratchpadNote({
        title: checklist ? 'Tasks' : '',
        content: checklist ? SAMPLE_CHECKLIST_TEMPLATE : '',
      });
      saveNotesState({
        notes: [fresh, ...current.notes],
        activeNoteId: fresh.id,
      });
      window.dispatchEvent(new Event('storage'));
      openApp('notes', true);
    },
    [openApp]
  );

  const handleOpenNewBrowserTab = useCallback(() => {
    openApp('browser', true);
    enqueueBrowserNavigation({ kind: 'start' });
  }, [openApp]);

  const handleTileTopWindows = useCallback(() => {
    setWindowState((s) => tileTopTwoWindows(s, window.innerWidth, window.innerHeight));
  }, []);

  const handleMinimizeAllWindows = useCallback(() => {
    setWindowState((s) => ({
      ...s,
      activeWindowId: null,
      windows: s.windows.map((w) => ({ ...w, status: 'minimized' as const })),
    }));
  }, []);

  const handleRestoreMinimizedWindows = useCallback(() => {
    setWindowState((s) => {
      const restored = s.windows.map((w) =>
        w.status === 'minimized' ? { ...w, status: 'normal' as const } : w
      );
      return {
        ...s,
        windows: restored,
        activeWindowId: s.activeWindowId ?? restored.at(-1)?.id ?? null,
      };
    });
  }, []);

  const handleLockWorkspace = useCallback(() => {
    if (!passwordRecord) return;
    try {
      sessionStorage.removeItem(SESSION_UNLOCKED);
    } catch {}
    setScreen('lock');
  }, [passwordRecord]);

  useEffect(() => {
    const handleOpenAppRequest = (event: Event) => {
      const detail = (event as CustomEvent<OpenAppEventDetail>).detail;
      if (!detail?.appId) return;
      openApp(detail.appId, detail.preferExisting ?? true);
    };
    window.addEventListener(NEXUS_OPEN_APP_EVENT, handleOpenAppRequest);
    return () => window.removeEventListener(NEXUS_OPEN_APP_EVENT, handleOpenAppRequest);
  }, [openApp]);

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
      ? unsnapWindow(w, window.innerWidth, window.innerHeight)
      : { ...w, status: 'maximized', snapZone: undefined, restoreBounds: w.restoreBounds ?? w.bounds }), [updateWindow]);
  const snapWindow = useCallback((id: string, zone: SnapZone) =>
    updateWindow(id, w => applyWindowSnap(w, zone, window.innerWidth, window.innerHeight)), [updateWindow]);
  const moveWindow   = useCallback((id: string, b: WindowBounds) =>
    updateWindow(id, w => ({
      ...w,
      status: 'normal',
      snapZone: undefined,
      restoreBounds: undefined,
      bounds: clampBounds(b, window.innerWidth, window.innerHeight),
    })), [updateWindow]);
  const resizeWindow = useCallback((id: string, b: WindowBounds) =>
    updateWindow(id, w => ({
      ...w,
      snapZone: undefined,
      restoreBounds: undefined,
      bounds: clampBounds(b, window.innerWidth, window.innerHeight),
    })), [updateWindow]);

  /* ── Desktop icon drag (persisted on pointerup) ──────────────────────── */
  const handleIconPointerDown = (e: React.PointerEvent<HTMLButtonElement>, appId: AppId) => {
    if (!arrangeMode || e.button !== 0) return;
    isDraggingRef.current = true;
    const sx = e.clientX, sy = e.clientY;
    const idx = pinnedDesktop.indexOf(appId);
    const start = { ...(desktopPos[appId] ?? positionForIndex(idx)) };
    let latestPos = start;

    const onMove = (me: PointerEvent) => {
      latestPos = snapDesktopPosition(
        { x: start.x + me.clientX - sx, y: start.y + me.clientY - sy },
        window.innerWidth,
        window.innerHeight,
      );
      setDesktopPos(p => ({ ...p, [appId]: latestPos }));
    };

    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setDesktopPos(p => {
        const next = { ...p, [appId]: latestPos };
        try { localStorage.setItem(DESKTOP_POS_KEY, JSON.stringify(next)); } catch {}
        return next;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  /* ── Desktop widget drag & resize in Arrange Mode (FR-03) ────────────── */
  const handleWidgetPointerDown = (
    e: React.PointerEvent<HTMLElement>,
    widgetId: string,
    mode: 'move' | 'resize'
  ) => {
    if (!arrangeMode || e.button !== 0) return;
    e.preventDefault();
    e.stopPropagation();

    const targetWidget = widgets.find(w => w.id === widgetId);
    if (!targetWidget) return;

    isDraggingRef.current = true;
    const sx = e.clientX;
    const sy = e.clientY;
    const startBounds = { ...targetWidget.bounds };
    let latestBounds = startBounds;

    const onMove = (me: PointerEvent) => {
      const dx = me.clientX - sx;
      const dy = me.clientY - sy;
      const rawBounds: WindowBounds =
        mode === 'move'
          ? { ...startBounds, x: startBounds.x + dx, y: startBounds.y + dy }
          : { ...startBounds, width: startBounds.width + dx, height: startBounds.height + dy };

      latestBounds = clampWidgetBounds(rawBounds, window.innerWidth, window.innerHeight, true);
      setWidgets(prev =>
        prev.map(w => (w.id === widgetId ? { ...w, bounds: latestBounds } : w))
      );
    };

    const onUp = () => {
      isDraggingRef.current = false;
      window.removeEventListener('pointermove', onMove);
      window.removeEventListener('pointerup', onUp);
      setWidgets(prev => {
        const next = prev.map(w =>
          w.id === widgetId ? { ...w, bounds: latestBounds, updatedAt: Date.now() } : w
        );
        saveWidgets(next);
        return next;
      });
    };

    window.addEventListener('pointermove', onMove);
    window.addEventListener('pointerup', onUp, { once: true });
  };

  const togglePin = useCallback((appId: AppId, dest: 'desktop' | 'dock') => {
    (dest === 'desktop' ? setPinnedDesktop : setPinnedDock)(items =>
      items.includes(appId) ? items.filter(id => id !== appId) : [...items, appId]);
  }, []);

  const allApps = useMemo(() => getAllAppDefinitions(shortcuts), [shortcuts]);

  const visibleApps = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return allApps.filter(app => {
      if (launcherFilter === 'core' && app.category === 'shortcut') return false;
      if (launcherFilter === 'shortcut' && app.category !== 'shortcut') return false;
      if (!q) return true;
      return `${app.name} ${app.description} ${app.shortcut?.url ?? ''}`.toLowerCase().includes(q);
    });
  }, [allApps, launcherFilter, searchQuery]);

  const clampedLauncherIdx = visibleApps.length > 0
    ? Math.min(launcherActiveIdx, visibleApps.length - 1)
    : -1;

  useEffect(() => {
    if (!menuOpen || clampedLauncherIdx < 0 || !launcherListRef.current) return;
    const row = launcherListRef.current.querySelector<HTMLElement>(`[data-launcher-idx="${clampedLauncherIdx}"]`);
    row?.scrollIntoView({ block: 'nearest' });
  }, [clampedLauncherIdx, menuOpen]);

  const handleLauncherKeyDown = (e: ReactKeyboardEvent<HTMLElement>) => {
    if (!visibleApps.length) return;
    const step = prefs.menuView === 'grid' ? 3 : 1;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setLauncherActiveIdx(i => Math.min(visibleApps.length - 1, Math.min(i, visibleApps.length - 1) + step));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setLauncherActiveIdx(i => Math.max(0, Math.min(i, visibleApps.length - 1) - step));
    } else if (e.key === 'ArrowRight' && prefs.menuView === 'grid') {
      e.preventDefault();
      setLauncherActiveIdx(i => Math.min(visibleApps.length - 1, Math.min(i, visibleApps.length - 1) + 1));
    } else if (e.key === 'ArrowLeft' && prefs.menuView === 'grid') {
      e.preventDefault();
      setLauncherActiveIdx(i => Math.max(0, Math.min(i, visibleApps.length - 1) - 1));
    } else if (e.key === 'Home') {
      e.preventDefault();
      setLauncherActiveIdx(0);
    } else if (e.key === 'End') {
      e.preventDefault();
      setLauncherActiveIdx(visibleApps.length - 1);
    } else if (e.key === 'Enter') {
      const target = e.target as HTMLElement;
      /* Only trigger keyboard launch from search input or row container so secondary buttons still handle Enter natively */
      if (target.tagName === 'INPUT' || target.classList.contains('app-launcher')) {
        const chosen = visibleApps[clampedLauncherIdx];
        if (chosen) {
          e.preventDefault();
          openApp(chosen.id);
        }
      }
    }
  };

  /* ── Backup Export / Import / Factory Reset (FR-14) ──────────────────── */
  const handleExportWorkspace = useCallback(() => {
    const snapshot = buildWorkspaceBackup({
      preferences: prefs,
      pinnedDesktop,
      pinnedDock,
      desktopPositions: desktopPos,
      messages,
      shortcuts,
      widgets,
    });
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    const dateStamp = new Date().toISOString().slice(0, 10);
    a.href = url;
    a.download = `nexus-workspace-${dateStamp}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }, [desktopPos, messages, pinnedDesktop, pinnedDock, prefs, shortcuts, widgets]);

  const handleImportWorkspace = useCallback(
    (rawJson: string): { ok: true; summary: string } | { ok: false; error: string } => {
      try {
        const backup = parseAndValidateWorkspaceBackup(rawJson);
        applyWorkspaceBackupToStorage(backup);

        setPrefs({
          theme: backup.preferences.theme,
          wallpaper: backup.preferences.wallpaper as Wallpaper,
          showSeconds: backup.preferences.showSeconds,
          showMessages: backup.preferences.showMessages,
          restoreSession: backup.preferences.restoreSession === true,
          menuView: backup.preferences.menuView,
          msgRefreshMins: backup.preferences.msgRefreshMins,
        });
        setShortcuts(backup.shortcuts);
        saveShortcuts(backup.shortcuts);
        setPinnedDesktop(backup.pinnedDesktop);
        setPinnedDock(backup.pinnedDock);
        setDesktopPos(backup.desktopPositions);
        setMessages(backup.messages);
        setWidgets(backup.widgets);
        window.dispatchEvent(new Event('storage'));

        return {
          ok: true,
          summary: `Restored ${backup.shortcuts.length} shortcut${backup.shortcuts.length === 1 ? '' : 's'}, ${backup.widgets.length} widget${backup.widgets.length === 1 ? '' : 's'}, and desktop layout.`,
        };
      } catch (err) {
        return {
          ok: false,
          error: err instanceof Error ? err.message : 'Invalid workspace backup file.',
        };
      }
    },
    []
  );

  const handleResetWorkspace = useCallback(() => {
    clearAllWorkspaceStorage();
    setPasswordRecord(null);
    setPrefs(DEFAULT_PREFS);
    setShortcuts([]);
    setPinnedDesktop([]);
    setPinnedDock([]);
    setDesktopPos({});
    setMessages(DEFAULT_MESSAGES);
    setWidgets([]);
    setPreviewWidget(null);
    setArrangeMode(false);
    setWindowState(s => {
      const settingsWins = s.windows.filter(w => w.appId === 'settings');
      return {
        ...s,
        windows: settingsWins,
        activeWindowId: settingsWins[0]?.id ?? null,
      };
    });
    window.dispatchEvent(new Event('storage'));
  }, []);

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
    showMessages:      prefs.showMessages,
    restoreSession:    prefs.restoreSession,
    arrangeMode,
    hasPassword:       Boolean(passwordRecord),
    msgRefreshMins:    prefs.msgRefreshMins,
    messages,
    onToggleTheme:     () => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' })),
    onWallpaperChange: (w: Wallpaper) => setPrefs(p => ({ ...p, wallpaper: w })),
    onToggleSeconds:   () => setPrefs(p => ({ ...p, showSeconds: !p.showSeconds })),
    onToggleMessages:  () => setPrefs(p => ({ ...p, showMessages: !p.showMessages })),
    onToggleRestoreSession: () => setPrefs(p => ({ ...p, restoreSession: !p.restoreSession })),
    onResetMessages:   () => setMessages(DEFAULT_MESSAGES),
    onToggleArrange:   () => setArrangeMode(v => !v),
    onPassword:        () => { captureFocusOrigin(); setSetupIntent('setup'); },
    onRemovePassword:  () => { captureFocusOrigin(); setSetupIntent('remove'); },
    onExportWorkspace: handleExportWorkspace,
    onImportWorkspace: handleImportWorkspace,
    onResetWorkspace:  handleResetWorkspace,
    onMsgRefreshChange:(mins: number) => setPrefs(p => ({ ...p, msgRefreshMins: mins })),
    onMessagesChange:  (msgs: DesktopMessage[]) => setMessages(msgs),
    widgets,
    onWidgetsChange:   (next: WidgetDefinition[]) => setWidgets(next),
    onPreviewWidget:   (widget: WidgetDefinition) => setPreviewWidget(widget),
    onOpenApp:         (id: AppId) => openApp(id),
    shortcuts,
    onShortcutsChange: handleShortcutsChange,
    onRemoveShortcut:  handleRemoveShortcut,
    pinnedDesktop,
    pinnedDock,
    onTogglePin:       togglePin,
  };

  const handleExecuteSpotlightCommand = useCallback(
    (cmd: SpotlightCommandPayload) => {
      switch (cmd.type) {
        case 'copy-math':
          navigator.clipboard?.writeText(cmd.rawValue).catch(() => {});
          return;
        case 'open-app':
          openApp(cmd.appId, true);
          return;
        case 'open-external-url':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          openExternalUrlSafely(cmd.url);
          return;
        case 'focus-window':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          focusWindow(cmd.windowId);
          return;
        case 'snap-active-window':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          if (windowState.activeWindowId) {
            snapWindow(windowState.activeWindowId, cmd.zone);
          }
          return;
        case 'unsnap-active-window':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          if (windowState.activeWindowId) {
            updateWindow(windowState.activeWindowId, w =>
              unsnapWindow(w, window.innerWidth, window.innerHeight)
            );
          }
          return;
        case 'minimize-active-window':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          if (windowState.activeWindowId) {
            minimizeWindow(windowState.activeWindowId);
          }
          return;
        case 'close-active-window':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          if (windowState.activeWindowId) {
            closeWindow(windowState.activeWindowId);
          }
          return;
        case 'minimize-all-windows':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          setWindowState(s => ({
            ...s,
            activeWindowId: null,
            windows: s.windows.map(w => ({ ...w, status: 'minimized' as const })),
          }));
          return;
        case 'close-all-windows':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          setWindowState(s => ({ ...s, windows: [], activeWindowId: null }));
          return;
        case 'open-note': {
          const current = readNotesState();
          saveNotesState({ ...current, activeNoteId: cmd.noteId });
          window.dispatchEvent(new Event('storage'));
          openApp('notes', true);
          return;
        }
        case 'create-note': {
          const current = readNotesState();
          const fresh = createScratchpadNote({
            title: cmd.title?.trim() ?? (cmd.checklist ? 'Tasks' : ''),
            content: cmd.checklist
              ? SAMPLE_CHECKLIST_TEMPLATE
              : cmd.title?.trim()
                ? `# ${cmd.title.trim()}\n\n`
                : '',
          });
          saveNotesState({
            notes: [fresh, ...current.notes],
            activeNoteId: fresh.id,
          });
          window.dispatchEvent(new Event('storage'));
          openApp('notes', true);
          return;
        }
        case 'browser-search':
          openApp('browser', true);
          enqueueBrowserNavigation({
            kind: 'search',
            query: cmd.query,
            engine: cmd.engine,
          });
          return;
        case 'browser-url':
          openApp('browser', true);
          enqueueBrowserNavigation({
            kind: 'url',
            url: cmd.url,
            title: cmd.title,
          });
          return;
        case 'toggle-theme':
          setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }));
          closeSpotlight(true);
          return;
        case 'set-wallpaper':
          setPrefs(p => ({ ...p, wallpaper: cmd.wallpaperId as Wallpaper }));
          closeSpotlight(true);
          return;
        case 'next-wallpaper':
          setPrefs(p => ({
            ...p,
            wallpaper:
              WALLPAPERS[(WALLPAPERS.findIndex(w => w.id === p.wallpaper) + 1) % WALLPAPERS.length]
                .id,
          }));
          closeSpotlight(true);
          return;
        case 'toggle-arrange':
          setArrangeMode(v => !v);
          closeSpotlight(false);
          restoreFocusRef.current = null;
          return;
        case 'toggle-seconds':
          setPrefs(p => ({ ...p, showSeconds: !p.showSeconds }));
          closeSpotlight(true);
          return;
        case 'toggle-messages':
          setPrefs(p => ({ ...p, showMessages: !p.showMessages }));
          closeSpotlight(true);
          return;
        case 'toggle-restore-session':
          setPrefs(p => ({ ...p, restoreSession: !p.restoreSession }));
          closeSpotlight(true);
          return;
        case 'export-workspace':
          handleExportWorkspace();
          closeSpotlight(true);
          return;
        case 'open-changelog':
          setSpotlightOpen(false);
          setChangelogOpen(true);
          return;
        case 'lock-screen':
          setSpotlightOpen(false);
          restoreFocusRef.current = null;
          try { sessionStorage.removeItem(SESSION_UNLOCKED); } catch {}
          setScreen('lock');
          return;
        case 'setup-passcode':
          setSpotlightOpen(false);
          setSetupIntent('setup');
          return;
        case 'open-launcher':
          setSpotlightOpen(false);
          setSearchQuery('');
          setLauncherActiveIdx(0);
          setMenuOpen(true);
          return;
      }
    },
    [
      closeSpotlight,
      closeWindow,
      focusWindow,
      handleExportWorkspace,
      minimizeWindow,
      openApp,
      snapWindow,
      updateWindow,
      windowState.activeWindowId,
    ]
  );

  const closeAll = () => {
    if (menuOpen) closeLauncher(false);
    if (spotlightOpen) closeSpotlight(false);
    setLauncherActionMenu(null); setIconActionMenu(null); setDockActionMenu(null);
    setSelectedIcon(null); setCtxMenu(null); setTrayOpen(false);
  };

  /* ── Screens ─────────────────────────────────────────────────────────── */
  if (screen === 'splash') return <SplashScreen />;
  if (screen === 'lock')   return <LockScreen now={now} wallpaper={prefs.wallpaper} theme={prefs.theme} passwordRecord={passwordRecord} onUnlock={handleUnlock} />;

  const timeStr = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', ...(prefs.showSeconds ? { second: '2-digit' } : {}) });
  const activeDesktopMenuApp = iconActionMenu ? getAppDefinition(iconActionMenu.id, shortcuts) : undefined;
  const activeDockMenuApp = dockActionMenu ? getAppDefinition(dockActionMenu.id, shortcuts) : undefined;
  const visibleWindowCount = windowState.windows.filter((w) => w.status !== 'minimized').length;
  const minimizedWindowCount = windowState.windows.filter((w) => w.status === 'minimized').length;
  const currentMessage = prefs.showMessages && messages.length > 0
    ? messages[messageIndex % messages.length]
    : undefined;

  const openDesktopContextMenu = (e: React.MouseEvent<HTMLElement>) => {
    const target = e.target as HTMLElement;
    if (
      target.closest(
        '.desktop-icon,.wf,.app-launcher,.ctx-menu,.tray-menu,.dock,.desktop-tray,.desktop-widget,.arrange-banner,.spotlight-modal,.changelog-modal,.setup-card'
      )
    ) {
      return;
    }
    e.preventDefault();
    setCtxMenu({ x: e.clientX, y: e.clientY });
    setIconActionMenu(null);
    setDockActionMenu(null);
    setLauncherActionMenu(null);
    setMenuOpen(false);
    setTrayOpen(false);
  };

  /* ── Render desktop ──────────────────────────────────────────────────── */
  return (
    <div
      className={`desktop theme-${prefs.theme} wallpaper-${prefs.wallpaper}`}
      onClick={closeAll}
      onContextMenu={openDesktopContextMenu}
    >
      {/* Wallpaper blobs */}
      <div key={prefs.wallpaper} className="desktop-wallpaper wallpaper-transition" aria-hidden>
        <div className="wp-blob wp-blob-1" />
        <div className="wp-blob wp-blob-2" />
        <div className="wp-blob wp-blob-3" />
      </div>

      {currentMessage && currentMessage.text.trim() && (
        <div className="desktop-message" key={currentMessage.id || messageIndex} aria-live="polite">
          <span>{currentMessage.text}</span>
        </div>
      )}

      {/* ── Subtle Arrange Mode Banner ── */}
      {arrangeMode && (
        <div className="arrange-banner" onClick={e => e.stopPropagation()}>
          <Move size={13} />
          <span>Arrange mode · Drag icons or resize widgets on grid</span>
          <button type="button" className="arrange-done-btn" onClick={() => setArrangeMode(false)}>
            Done
          </button>
        </div>
      )}

      {/* ── Desktop canvas (icons only; floating menus render at root z-index) ── */}
      <section
        className={`desktop-canvas ${arrangeMode ? 'is-arranging' : ''}`}
        aria-label="Desktop"
        onClick={() => setSelectedIcon(null)}
      >
        {/* Pinned desktop icons */}
        {pinnedDesktop.map((id, index) => {
          const app = getAppDefinition(id, shortcuts); if (!app) return null;
          const toneClass = app.shortcut ? 'icon-shortcut' : `icon-${id}`;
          const pos = desktopPos[id] ?? positionForIndex(index);
          return (
            <button
              key={id}
              className={`desktop-icon ${toneClass} ${selectedIcon === id ? 'is-selected' : ''} ${arrangeMode ? 'is-drag' : ''}`}
              style={{ left: pos.x, top: pos.y }}
              onPointerDown={e => { e.stopPropagation(); setSelectedIcon(id); handleIconPointerDown(e, id); }}
              onDoubleClick={() => openApp(id)}
              onClick={e => { e.stopPropagation(); if (!arrangeMode) setSelectedIcon(id); }}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                setSelectedIcon(id);
                setIconActionMenu({ id, x: e.clientX, y: e.clientY });
                setCtxMenu(null);
                setLauncherActionMenu(null);
                setDockActionMenu(null);
                setTrayOpen(false);
              }}
              title={arrangeMode ? 'Drag to move' : `Open ${app.name}`}
            >
              <span className="di-img"><AppIconGraphic app={app} size={24} /></span>
              <span className="di-label">{app.name}</span>
            </button>
          );
        })}
      </section>

      {/* ── Desktop Widgets (Interactive in normal mode, draggable/resizable in Arrange Mode) ── */}
      {widgets.filter((widget) => widget.visible && widget.id !== previewWidget?.id).map((widget) => (
        <section
          key={widget.id}
          className={`desktop-widget ${arrangeMode ? 'is-arranging' : ''}`}
          style={{
            left: widget.bounds.x,
            top: widget.bounds.y,
            width: widget.bounds.width,
            height: widget.bounds.height,
          }}
          aria-label={widget.name}
        >
          <WidgetRuntime
            widget={widget}
            theme={prefs.theme}
            onOpenApp={(id) => { if (getAppDefinition(id, shortcuts)) openApp(id as AppId); }}
            onOpenUrl={openExternalUrlSafely}
          />
          {arrangeMode && (
            <div
              className="widget-arrange-surface"
              onPointerDown={(e) => handleWidgetPointerDown(e, widget.id, 'move')}
              title={`Drag to move ${widget.name}`}
            >
              <div className="widget-arrange-bar" onPointerDown={e => e.stopPropagation()}>
                <span className="widget-arrange-title">{widget.name}</span>
                <span className="widget-arrange-dims">{widget.bounds.width}×{widget.bounds.height}</span>
                <button
                  type="button"
                  className="widget-arrange-btn"
                  onClick={() => openApp('widgets')}
                  title="Open in Widget Studio"
                  aria-label={`Edit ${widget.name} in Widget Studio`}
                >
                  <Code2 size={11} />
                </button>
                <button
                  type="button"
                  className="widget-arrange-btn"
                  onClick={() => setWidgets(prev => prev.map(w => w.id === widget.id ? { ...w, visible: false } : w))}
                  title="Hide from desktop"
                  aria-label={`Hide ${widget.name} from desktop`}
                >
                  <EyeOff size={11} />
                </button>
              </div>
              <button
                type="button"
                className="widget-resize-handle"
                onPointerDown={(e) => handleWidgetPointerDown(e, widget.id, 'resize')}
                aria-label={`Resize ${widget.name}`}
                title="Drag to resize"
              />
            </div>
          )}
        </section>
      ))}

      {previewWidget && (
        <section
          className="desktop-widget widget-preview"
          style={{
            left: previewWidget.bounds.x,
            top: previewWidget.bounds.y,
            width: previewWidget.bounds.width,
            height: previewWidget.bounds.height,
          }}
        >
          <WidgetRuntime
            widget={previewWidget}
            theme={prefs.theme}
            onOpenApp={(id) => { if (getAppDefinition(id, shortcuts)) openApp(id as AppId); }}
            onOpenUrl={openExternalUrlSafely}
          />
          <button className="widget-preview-close" onClick={() => setPreviewWidget(null)}>Close preview</button>
        </section>
      )}

      {/* ── Window layer ── */}
      <div className="window-layer">
        {snapPreviewZone && (() => {
          const ghost = computeSnapBounds(snapPreviewZone, window.innerWidth, window.innerHeight);
          return (
            <div
              className="wf-snap-ghost"
              style={{
                zIndex: 18,
                left: ghost.x,
                top: ghost.y,
                width: ghost.width,
                height: ghost.height,
              }}
              aria-hidden
            />
          );
        })()}
        {windowState.windows.map((win, idx) => (
          <WindowFrame
            key={win.id} window={win}
            active={windowState.activeWindowId === win.id}
            zIndex={30 + (windowState.activeWindowId === win.id ? windowState.windows.length : idx)}
            onFocus={() => focusWindow(win.id)}
            onClose={() => closeWindow(win.id)}
            onMinimize={() => minimizeWindow(win.id)}
            onToggleMaximize={() => toggleMaximize(win.id)}
            onSnap={zone => snapWindow(win.id, zone)}
            onMove={b => moveWindow(win.id, b)}
            onResize={b => resizeWindow(win.id, b)}
            onSnapPreviewChange={setSnapPreviewZone}
          >
            <AppHost appId={win.appId} settings={settingsProps} />
          </WindowFrame>
        ))}
      </div>

      {/* ── App launcher — centered above dock ── */}
      {menuOpen && (
        <>
          <button className="launcher-scrim" aria-label="Close launcher" onClick={() => closeLauncher(true)} />
          <section
            className="app-launcher"
            role="dialog"
            aria-modal="true"
            aria-label="Application launcher"
            tabIndex={-1}
            onKeyDown={handleLauncherKeyDown}
            onClick={e => {
              e.stopPropagation();
              if (!(e.target as HTMLElement).closest('.l-more,.l-pin-menu')) setLauncherActionMenu(null);
            }}
          >
            <div className="launcher-header">
              <div className="launcher-brand"><Layers size={16} strokeWidth={1.5} /><span>Nexus</span></div>
              <button className="launcher-close" onClick={() => closeLauncher(true)} aria-label="Close launcher"><X size={14} /></button>
            </div>
            <label className="launcher-search">
              <Search size={14} />
              <input
                autoFocus
                value={searchQuery}
                onChange={e => {
                  setSearchQuery(e.target.value);
                  setLauncherActiveIdx(0);
                }}
                placeholder="Search apps & shortcuts…"
                aria-label="Search applications"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="search-clear"
                  onClick={() => { setSearchQuery(''); setLauncherActiveIdx(0); }}
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </label>
            <div className="launcher-bar">
              <div className="launcher-tabs" role="tablist" aria-label="Application categories">
                <button
                  type="button"
                  role="tab"
                  aria-selected={launcherFilter === 'all'}
                  className={launcherFilter === 'all' ? 'is-active' : ''}
                  onClick={() => { setLauncherFilter('all'); setLauncherActiveIdx(0); }}
                >
                  All · {allApps.length}
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={launcherFilter === 'core'}
                  className={launcherFilter === 'core' ? 'is-active' : ''}
                  onClick={() => { setLauncherFilter('core'); setLauncherActiveIdx(0); }}
                >
                  Workspace
                </button>
                <button
                  type="button"
                  role="tab"
                  aria-selected={launcherFilter === 'shortcut'}
                  className={launcherFilter === 'shortcut' ? 'is-active' : ''}
                  onClick={() => { setLauncherFilter('shortcut'); setLauncherActiveIdx(0); }}
                >
                  Shortcuts · {shortcuts.length}
                </button>
              </div>
              <div className="view-toggle">
                <button type="button" className={prefs.menuView === 'list' ? 'is-active' : ''} onClick={() => setPrefs(p => ({ ...p, menuView: 'list' }))} aria-label="List view"><List size={12} /></button>
                <button type="button" className={prefs.menuView === 'grid' ? 'is-active' : ''} onClick={() => setPrefs(p => ({ ...p, menuView: 'grid' }))} aria-label="Grid view"><Grid2X2 size={12} /></button>
              </div>
            </div>
            <div
              ref={launcherListRef}
              className={`launcher-list ${prefs.menuView === 'grid' ? 'is-grid' : ''} ${launcherActionMenu ? 'has-open-menu' : ''}`}
            >
              {visibleApps.map((app, index) => {
                const dp = pinnedDesktop.includes(app.id);
                const dk = pinnedDock.includes(app.id);
                const isOpen = launcherActionMenu === app.id;
                const isKbActive = index === clampedLauncherIdx;
                const toneClass = app.shortcut ? 'icon-shortcut' : `icon-${app.id}`;
                const placement = computeLauncherMenuPlacement(
                  index,
                  visibleApps.length,
                  prefs.menuView
                );
                return (
                  <div
                    className={`l-row ${toneClass} ${isOpen ? 'is-open' : ''} ${isKbActive ? 'is-kb-active' : ''}`}
                    key={app.id}
                    data-launcher-idx={index}
                    style={{ '--row-idx': Math.min(index, 10) } as CSSProperties}
                    onMouseEnter={() => setLauncherActiveIdx(index)}
                    onContextMenu={e => {
                      e.preventDefault();
                      e.stopPropagation();
                      setLauncherActionMenu(a => a === app.id ? null : app.id);
                      setIconActionMenu(null);
                      setDockActionMenu(null);
                    }}
                  >
                    <button type="button" className="l-app" onClick={() => openApp(app.id)}>
                      <span className="l-icon">
                        <AppIconGraphic app={app} size={prefs.menuView === 'grid' ? 22 : 20} />
                      </span>
                      <span className="l-info">
                        <strong>{app.name}</strong>
                        <small>{app.description}</small>
                      </span>
                      {(dp || dk) && <Pin size={10} className="l-pin" />}
                    </button>
                    <button
                      type="button"
                      className="l-more"
                      onClick={e => {
                        e.stopPropagation();
                        setLauncherActionMenu(a => a === app.id ? null : app.id);
                        setIconActionMenu(null);
                        setDockActionMenu(null);
                      }}
                      aria-label={`Options for ${app.name}`}
                      aria-expanded={isOpen}
                    >
                      <MoreHorizontal size={14} />
                    </button>
                    {isOpen && (
                      <div
                        className={`l-pin-menu align-${placement.align}${placement.flipUp ? ' is-flip-up' : ''}`}
                        role="menu"
                        onClick={e => e.stopPropagation()}
                      >
                        <button type="button" role="menuitem" onClick={() => openApp(app.id)}>
                          <LayoutGrid size={12} />
                          <span>Open {app.name}</span>
                        </button>
                        {app.id === 'notes' && (
                          <>
                            <button type="button" role="menuitem" onClick={() => handleCreateQuickNote(false)}>
                              <StickyNote size={12} />
                              <span>New note</span>
                            </button>
                            <button type="button" role="menuitem" onClick={() => handleCreateQuickNote(true)}>
                              <CheckSquare size={12} />
                              <span>New checklist</span>
                            </button>
                          </>
                        )}
                        {app.id === 'browser' && (
                          <button type="button" role="menuitem" onClick={handleOpenNewBrowserTab}>
                            <Compass size={12} />
                            <span>New search tab</span>
                          </button>
                        )}
                        {app.id === 'widgets' && (
                          <button
                            type="button"
                            role="menuitem"
                            onClick={() => {
                              setArrangeMode(v => !v);
                              closeLauncher(false);
                            }}
                          >
                            <Move size={12} />
                            <span>{arrangeMode ? 'Done arranging' : 'Arrange desktop'}</span>
                          </button>
                        )}
                        <div className="ctx-sep" role="separator" />
                        <button type="button" role="menuitem" onClick={() => { togglePin(app.id, 'desktop'); setLauncherActionMenu(null); }}>
                          {dp ? <Check size={12} /> : <Plus size={12} />}
                          <span>{dp ? 'Remove from desktop' : 'Pin to desktop'}</span>
                        </button>
                        <button type="button" role="menuitem" onClick={() => { togglePin(app.id, 'dock'); setLauncherActionMenu(null); }}>
                          {dk ? <Check size={12} /> : <Plus size={12} />}
                          <span>{dk ? 'Remove from dock' : 'Pin to dock'}</span>
                        </button>
                        {app.shortcut && (
                          <>
                            <div className="ctx-sep" role="separator" />
                            <a
                              href={app.shortcut.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="l-menu-link"
                              onClick={() => { setLauncherActionMenu(null); closeLauncher(false); }}
                            >
                              <ExternalLink size={12} />
                              <span>Open in browser tab</span>
                            </a>
                            <button type="button" role="menuitem" onClick={() => openApp('bookmarks')}>
                              <Bookmark size={12} />
                              <span>Manage shortcuts</span>
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {visibleApps.length === 0 && (
                <div className="l-empty">
                  <span>{launcherFilter === 'shortcut' && shortcuts.length === 0 ? 'No web shortcuts saved yet.' : 'No matching apps found.'}</span>
                  {launcherFilter === 'shortcut' && (
                    <button type="button" className="l-empty-btn" onClick={() => openApp('bookmarks')}>
                      <Plus size={12} /> Add shortcut in Saved links
                    </button>
                  )}
                </div>
              )}
            </div>
            <div className="launcher-footer">
              <div className="launcher-footer-actions">
                <button
                  type="button"
                  className="launcher-manage-links"
                  onClick={() => handleCreateQuickNote(false)}
                >
                  <StickyNote size={11} />
                  <span>New note</span>
                </button>
                <button
                  type="button"
                  className="launcher-manage-links"
                  onClick={() => openApp('bookmarks')}
                >
                  <Plus size={11} />
                  <span>Add shortcut</span>
                </button>
              </div>
              <div className="launcher-footer-meta">
                <button
                  type="button"
                  className="launcher-icon-btn"
                  onClick={() => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}
                  title={prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                  aria-label={prefs.theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                >
                  {prefs.theme === 'dark' ? <Sun size={13} /> : <Moon size={13} />}
                </button>
                <button
                  type="button"
                  className="launcher-icon-btn"
                  onClick={() => openApp('settings')}
                  title="Workspace settings"
                  aria-label="Workspace settings"
                >
                  <SettingsIcon size={13} />
                </button>
                {passwordRecord && (
                  <button
                    type="button"
                    className="launcher-icon-btn"
                    onClick={() => { closeLauncher(false); handleLockWorkspace(); }}
                    title="Lock workspace"
                    aria-label="Lock workspace"
                  >
                    <Lock size={13} />
                  </button>
                )}
                <button
                  type="button"
                  className="changelog-trigger"
                  onClick={e => {
                    captureFocusOrigin();
                    e.stopPropagation();
                    setMenuOpen(false);
                    setLauncherActionMenu(null);
                    setChangelogOpen(true);
                  }}
                >
                  <History size={13} /><span>Changelog</span><span className="version-pill">{NEXUS_VERSION_TAG}</span>
                </button>
              </div>
            </div>
          </section>
        </>
      )}

      {/* ── Desktop right-click menu (rendered at desktop root so it layers above windows & widgets) ── */}
      {ctxMenu && (
        <DesktopCtxMenu
          x={ctxMenu.x}
          y={ctxMenu.y}
          onClose={() => setCtxMenu(null)}
          onCreateNote={() => handleCreateQuickNote(false)}
          onCreateChecklist={() => handleCreateQuickNote(true)}
          onOpenNewBrowserTab={handleOpenNewBrowserTab}
          onOpenBookmarks={() => openApp('bookmarks')}
          onOpenSpotlight={openSpotlight}
          onOpenLauncher={openLauncher}
          visibleWindowCount={visibleWindowCount}
          minimizedWindowCount={minimizedWindowCount}
          onTileWindows={handleTileTopWindows}
          onMinimizeAllWindows={handleMinimizeAllWindows}
          onRestoreWindows={handleRestoreMinimizedWindows}
          onToggleArrange={() => setArrangeMode(v => !v)}
          arrangeMode={arrangeMode}
          onOpenWidgets={() => openApp('widgets')}
          theme={prefs.theme}
          onToggleTheme={() => setPrefs(p => ({ ...p, theme: p.theme === 'light' ? 'dark' : 'light' }))}
          canRotateQuote={prefs.showMessages && messages.length > 1}
          onNextQuote={() => setMessageIndex(i => (i + 1) % Math.max(messages.length, 1))}
          wallpaper={prefs.wallpaper}
          onWallpaperChange={wallpaper => setPrefs(p => ({ ...p, wallpaper }))}
          onOpenSettings={() => openApp('settings')}
          hasPassword={Boolean(passwordRecord)}
          onLock={handleLockWorkspace}
        />
      )}

      {/* ── Desktop icon right-click menu (rendered at desktop root) ── */}
      {iconActionMenu && activeDesktopMenuApp && (() => {
        const clampedIconPos = clampMenuPosition(
          iconActionMenu.x,
          iconActionMenu.y,
          216,
          activeDesktopMenuApp.id === 'notes' ? 236 : 190,
          window.innerWidth,
          window.innerHeight,
          12
        );
        return (
          <>
            <div
              className="ctx-scrim"
              onClick={() => setIconActionMenu(null)}
              onContextMenu={e => { e.preventDefault(); setIconActionMenu(null); }}
            />
            <div
              className="ctx-menu"
              style={{ left: clampedIconPos.x, top: clampedIconPos.y }}
              role="menu"
              onClick={e => e.stopPropagation()}
            >
              <button type="button" role="menuitem" onClick={() => { openApp(iconActionMenu.id); setIconActionMenu(null); }}>
                <LayoutGrid size={13} />
                <span>Open {activeDesktopMenuApp.name}</span>
              </button>
              {iconActionMenu.id === 'notes' && (
                <>
                  <button type="button" role="menuitem" onClick={() => { handleCreateQuickNote(false); setIconActionMenu(null); }}>
                    <StickyNote size={13} />
                    <span>New note</span>
                  </button>
                  <button type="button" role="menuitem" onClick={() => { handleCreateQuickNote(true); setIconActionMenu(null); }}>
                    <CheckSquare size={13} />
                    <span>New checklist</span>
                  </button>
                </>
              )}
              {iconActionMenu.id === 'browser' && (
                <button type="button" role="menuitem" onClick={() => { handleOpenNewBrowserTab(); setIconActionMenu(null); }}>
                  <Compass size={13} />
                  <span>New search tab</span>
                </button>
              )}
              {activeDesktopMenuApp.shortcut && (
                <a
                  href={activeDesktopMenuApp.shortcut.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="ctx-link"
                  onClick={() => setIconActionMenu(null)}
                >
                  <ExternalLink size={13} />
                  <span>Open in browser tab</span>
                </a>
              )}
              <div className="ctx-sep" role="separator" />
              <button type="button" role="menuitem" onClick={() => { togglePin(iconActionMenu.id, 'desktop'); setIconActionMenu(null); }}>
                {pinnedDesktop.includes(iconActionMenu.id) ? <Check size={13} /> : <Plus size={13} />}
                <span>{pinnedDesktop.includes(iconActionMenu.id) ? 'Remove from desktop' : 'Pin to desktop'}</span>
              </button>
              <button type="button" role="menuitem" onClick={() => { togglePin(iconActionMenu.id, 'dock'); setIconActionMenu(null); }}>
                {pinnedDock.includes(iconActionMenu.id) ? <Check size={13} /> : <Plus size={13} />}
                <span>{pinnedDock.includes(iconActionMenu.id) ? 'Remove from dock' : 'Pin to dock'}</span>
              </button>
            </div>
          </>
        );
      })()}

      {/* ── Dock right-click menu ── */}
      {dockActionMenu && activeDockMenuApp && (
        <>
          <div
            className="ctx-scrim"
            onClick={() => setDockActionMenu(null)}
            onContextMenu={e => { e.preventDefault(); setDockActionMenu(null); }}
          />
          <div
            className="ctx-menu dock-ctx-menu"
            style={{ left: Math.max(12, Math.min(dockActionMenu.x - 102, window.innerWidth - 220)) }}
            role="menu"
            onClick={e => e.stopPropagation()}
          >
            <button type="button" role="menuitem" onClick={() => { openApp(dockActionMenu.id); setDockActionMenu(null); }}>
              <LayoutGrid size={13} />
              <span>Open {activeDockMenuApp.name}</span>
            </button>
            {dockActionMenu.id === 'notes' && (
              <>
                <button type="button" role="menuitem" onClick={() => { handleCreateQuickNote(false); setDockActionMenu(null); }}>
                  <StickyNote size={13} />
                  <span>New note</span>
                </button>
                <button type="button" role="menuitem" onClick={() => { handleCreateQuickNote(true); setDockActionMenu(null); }}>
                  <CheckSquare size={13} />
                  <span>New checklist</span>
                </button>
              </>
            )}
            {dockActionMenu.id === 'browser' && (
              <button type="button" role="menuitem" onClick={() => { handleOpenNewBrowserTab(); setDockActionMenu(null); }}>
                <Compass size={13} />
                <span>New search tab</span>
              </button>
            )}
            {activeDockMenuApp.shortcut && (
              <a
                href={activeDockMenuApp.shortcut.url}
                target="_blank"
                rel="noopener noreferrer"
                className="ctx-link"
                onClick={() => setDockActionMenu(null)}
              >
                <ExternalLink size={13} />
                <span>Open in browser tab</span>
              </a>
            )}
            <div className="ctx-sep" role="separator" />
            <button type="button" role="menuitem" onClick={() => { togglePin(dockActionMenu.id, 'dock'); setDockActionMenu(null); }}>
              {pinnedDock.includes(dockActionMenu.id) ? <Check size={13} /> : <Plus size={13} />}
              <span>{pinnedDock.includes(dockActionMenu.id) ? 'Remove from dock' : 'Keep in dock'}</span>
            </button>
            <button type="button" role="menuitem" onClick={() => { togglePin(dockActionMenu.id, 'desktop'); setDockActionMenu(null); }}>
              {pinnedDesktop.includes(dockActionMenu.id) ? <Check size={13} /> : <Plus size={13} />}
              <span>{pinnedDesktop.includes(dockActionMenu.id) ? 'Remove from desktop' : 'Pin to desktop'}</span>
            </button>
          </div>
        </>
      )}

      {/* ── Dock — shows pinned + all currently open (unpinned) apps ── */}
      <nav className="dock" aria-label="Dock">
        {dockAppIds.map(id => {
          const app = getAppDefinition(id, shortcuts); if (!app) return null;
          const toneClass = app.shortcut ? 'icon-shortcut' : `icon-${id}`;
          const openWins = windowState.windows.filter(w => w.appId === id);
          const isActive = openWins.some(w => w.id === windowState.activeWindowId);
          const isPinned = pinnedDock.includes(id);
          const existingWin = [...windowState.windows].reverse().find(w => w.appId === id);
          return (
            <button
              key={id}
              className={`dock-item ${toneClass} ${openWins.length > 0 ? 'has-win' : ''} ${isActive ? 'is-active' : ''} ${!isPinned ? 'is-transient' : ''}`}
              onClick={() => existingWin ? focusWindow(existingWin.id) : openApp(id)}
              onContextMenu={e => {
                e.preventDefault();
                e.stopPropagation();
                const rect = e.currentTarget.getBoundingClientRect();
                setDockActionMenu({ id, x: rect.left + rect.width / 2 });
                setIconActionMenu(null);
                setLauncherActionMenu(null);
                setMenuOpen(false);
              }}
              title={app.name} aria-label={app.name}
            >
              <span className="dock-icon"><AppIconGraphic app={app} size={22} /></span>
              <span className="dock-label">{app.name}</span>
              {openWins.length > 0 && <span className="dock-dot" />}
            </button>
          );
        })}
        {dockAppIds.length > 0 && <div className="dock-sep" />}
        <button
          className={`dock-item dock-spotlight ${spotlightOpen ? 'is-active' : ''}`}
          onClick={e => {
            e.stopPropagation();
            if (spotlightOpen) closeSpotlight(true);
            else openSpotlight();
          }}
          aria-label="Command palette" title="Command palette (Ctrl+K)"
        >
          <span className="dock-icon"><Search size={18} strokeWidth={1.5} /></span>
          <span className="dock-label">Spotlight · ⌘K</span>
        </button>
        <button
          className={`dock-item dock-all ${menuOpen ? 'is-active' : ''}`}
          onClick={e => {
            e.stopPropagation();
            if (menuOpen) closeLauncher(true);
            else openLauncher();
          }}
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
          onLock={() => { try { sessionStorage.removeItem(SESSION_UNLOCKED); } catch {} setScreen('lock'); }}
          onSetupPassword={() => { captureFocusOrigin(); setSetupIntent('setup'); }}
          onRemovePassword={() => { captureFocusOrigin(); setSetupIntent('remove'); }}
          onClose={() => setTrayOpen(false)}
          wallpaper={prefs.wallpaper}
          onWallpaperChange={wallpaper => setPrefs(p => ({ ...p, wallpaper }))}
        />
      )}

      {/* ── Changelog modal ── */}
      {changelogOpen && (
        <div
          className="changelog-scrim"
          role="presentation"
          onMouseDown={e => {
            if (e.target === e.currentTarget) {
              setChangelogOpen(false);
              restoreFocusOrigin();
            }
          }}
        >
          <section className="changelog-modal" role="dialog" aria-modal="true" aria-labelledby="changelog-title">
            <header className="changelog-hero">
              <div className="changelog-hero-top">
                <span className="changelog-mark"><History size={19} /></span>
                <button
                  type="button"
                  className="changelog-close"
                  autoFocus
                  onClick={() => { setChangelogOpen(false); restoreFocusOrigin(); }}
                  aria-label="Close changelog"
                >
                  <X size={15} />
                </button>
              </div>
              <div className="changelog-kicker">Product notes · Release history</div>
              <div className="changelog-title-row">
                <h2 id="changelog-title">Changelog</h2>
                <span className="changelog-version">{NEXUS_VERSION_TAG}</span>
              </div>
              <p>{CURRENT_RELEASE.summary}</p>
            </header>
            <div className="changelog-body">
              <div className="changelog-release-line">
                <div>
                  <strong>Current release · {NEXUS_VERSION_TAG}</strong>
                  <span>{[CURRENT_RELEASE.date, CURRENT_RELEASE.title].filter(Boolean).join(' · ')}</span>
                </div>
              </div>
              {CURRENT_RELEASE.groups.map(group => {
                const renderGroupIcon = (kind: ChangelogCategory) => {
                  if (kind === 'added') return <Sparkles size={14} />;
                  if (kind === 'updated') return <Wrench size={14} />;
                  if (kind === 'removed') return <MinusCircle size={14} />;
                  return <CheckCircle2 size={14} />;
                };
                return (
                  <section className="changelog-group" key={`${CURRENT_RELEASE.version}-${group.kind}`}>
                    <h3>
                      <span className={`change-icon ${group.kind}`}>{renderGroupIcon(group.kind)}</span>
                      v{CURRENT_RELEASE.version} · {group.label}
                    </h3>
                    <ul>
                      {group.items.map((item, idx) => (
                        <li key={idx}>{item}</li>
                      ))}
                    </ul>
                  </section>
                );
              })}
              {PREVIOUS_RELEASES.length > 0 && (
                <>
                  <div className="changelog-version-divider"><span>Previous releases</span></div>
                  {PREVIOUS_RELEASES.map(release =>
                    release.groups.map(group => {
                      const renderGroupIcon = (kind: ChangelogCategory) => {
                        if (kind === 'added') return <Sparkles size={14} />;
                        if (kind === 'updated') return <Wrench size={14} />;
                        if (kind === 'removed') return <MinusCircle size={14} />;
                        return <CheckCircle2 size={14} />;
                      };
                      return (
                        <section className="changelog-group" key={`${release.version}-${group.kind}`}>
                          <h3>
                            <span className={`change-icon ${group.kind}`}>{renderGroupIcon(group.kind)}</span>
                            v{release.version} · {release.title}
                          </h3>
                          <ul>
                            {group.items.map((item, idx) => (
                              <li key={idx}>{item}</li>
                            ))}
                          </ul>
                        </section>
                      );
                    })
                  )}
                </>
              )}
            </div>
            <footer className="changelog-footer">
              <span>Local-first personal desktop · {NEXUS_VERSION_TAG}</span>
              <button type="button" onClick={() => { setChangelogOpen(false); restoreFocusOrigin(); }}>
                Back to Nexus <ChevronR size={13} />
              </button>
            </footer>
          </section>
        </div>
      )}

      {/* ── Spotlight Command Palette (Cmd/Ctrl + K) ── */}
      {spotlightOpen && (
        <SpotlightPalette
          apps={allApps}
          windows={windowState.windows}
          activeWindowId={windowState.activeWindowId}
          theme={prefs.theme}
          wallpaper={prefs.wallpaper}
          wallpapers={WALLPAPERS}
          arrangeMode={arrangeMode}
          showSeconds={prefs.showSeconds}
          showMessages={prefs.showMessages}
          restoreSession={prefs.restoreSession}
          hasPassword={Boolean(passwordRecord)}
          versionTag={NEXUS_VERSION_TAG}
          onExecute={handleExecuteSpotlightCommand}
          onClose={() => closeSpotlight(true)}
        />
      )}

      {/* ── Passcode setup / change / removal overlay ── */}
      {setupIntent && (
        <PasswordSetup
          existingRecord={passwordRecord}
          initialIntent={setupIntent}
          onSave={record => {
            setPasswordRecord(record);
            try { sessionStorage.setItem(SESSION_UNLOCKED, '1'); } catch {}
            setSetupIntent(null);
            restoreFocusOrigin();
          }}
          onRemove={() => {
            setPasswordRecord(null);
            setSetupIntent(null);
            restoreFocusOrigin();
          }}
          onCancel={() => {
            setSetupIntent(null);
            restoreFocusOrigin();
          }}
        />
      )}
    </div>
  );
}

