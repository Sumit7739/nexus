import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ChangeEvent, type FormEvent, type KeyboardEvent as ReactKeyboardEvent } from 'react';
import {
  ArrowLeft, ArrowRight, ArrowUpRight, Bookmark, CalendarClock, Check, ChevronDown, ChevronUp, Clock3, CloudRain, Copy, Code2, Crosshair, Disc3, Download, ExternalLink, Flame, Sparkles,
  Globe2, HardDriveDownload, Headphones, Heart, Home, Layers, Link2, ListMusic, ListVideo, MessageSquareQuote, Monitor, MoonStar, Palette, Pause, Pencil, Pin, Play, Plus, RefreshCw, Repeat, Repeat1, RotateCcw, Search, Shield, Shuffle, SkipBack, SkipForward, StickyNote, Trash2, Tv, Upload, Volume2, VolumeX, Waves, Wind, X,
} from 'lucide-react';
import type { AppId, CoreAppId } from '../window-manager/types';
import type { DesktopMessage } from '../data/messages';
import type { WidgetDefinition, WidgetSource } from '../widgets/types';
import { createWidget } from '../widgets/types';
import { WidgetRuntime } from '../widgets/WidgetRuntime';
import {
  instantiateTemplate,
  WIDGET_API_ENTRIES,
  WIDGET_TEMPLATES,
  type ApiReferenceCategory,
} from '../widgets/templates';
import {
  extractHostname,
  fromShortcutAppId,
  isYouTubeUrl,
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
import {
  getDaylineDate,
  readDaylineState,
  saveDaylineState,
  type DaylineState,
} from '../data/dayline';
import { readNotesState, saveNotesState } from '../data/notes';
import { BrowserApp } from './BrowserApp';
import { ScratchpadApp } from './ScratchpadApp';
import { NEXUS_VERSION } from '../data/version';
import { requestOpenApp } from '../data/context-actions';
import { generateWidgetWithPuter, type WidgetCrafterMessage } from '../data/puter-ai';
import {
  addTrackToMusicPlaylist,
  buildTrackFromVideoId,
  captureVideoTimestampNote,
  clearMusicHistory,
  consumeMusicActions,
  consumeYouTubeActions,
  createMusicPlaylist,
  cycleMusicRepeat,
  deleteMusicPlaylist,
  enqueueTrackNext,
  enqueueYouTubeAction,
  extractYouTubeVideoId,
  formatMediaSeconds,
  getMusicState,
  moveQueueTrack,
  MUSIC_ACTION_EVENT,
  parseTimestampInputSeconds,
  playMusicPlaylist,
  playMusicTrack,
  playStarterMusicStream,
  readYouTubeHistory,
  readYouTubeWatchLater,
  removeQueueTrack,
  removeTrackFromMusicPlaylist,
  saveYouTubeHistory,
  saveYouTubeWatchLater,
  seekMusicTo,
  setMusicVolume,
  STARTER_MUSIC_STREAMS,
  stepMusicTrack,
  subscribeMusicState,
  toggleMusicMute,
  toggleMusicPlayback,
  toggleMusicShuffle,
  toggleMusicTrackLiked,
  YOUTUBE_ACTION_EVENT,
  YOUTUBE_HISTORY_KEY,
  type MediaTrack,
  type MusicTab,
  type YouTubeSection,
} from '../data/media';
import {
  describeSpaceSummary,
  isWidgetVisibleInSpace,
  MAX_SPACES,
  parseAudioRuleValue,
  serializeAudioRuleValue,
  type DesktopSpace,
} from '../data/spaces';
import {
  applySoundscapePreset,
  clearSoundscapeLevels,
  deleteCustomSoundscapeMix,
  describeActiveSoundscape,
  getActiveSoundscapeLayersCount,
  getAllSoundscapePresets,
  getSoundscapeState,
  isSoundscapeAudiblyPlaying,
  saveCustomSoundscapeMix,
  setSoundscapeLayerLevel,
  setSoundscapeMasterVolume,
  SOUNDSCAPE_CHANNELS,
  subscribeSoundscapeState,
  toggleSoundscapeLayer,
  toggleSoundscapePlaying,
  type SoundscapeLayerId,
} from '../data/soundscape';

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
  spaces?: DesktopSpace[];
  activeSpaceId?: string;
  initialSection?: 'appearance' | 'spaces' | 'desktop' | 'messages' | 'privacy' | 'backup';
  onInitialSectionConsumed?: () => void;
  onSwitchSpace?: (spaceId: string) => void;
  onCreateSpace?: () => void;
  onUpdateSpace?: (
    spaceId: string,
    patch: Partial<Pick<DesktopSpace, 'name' | 'description' | 'wallpaper' | 'audioRule'>>
  ) => void;
  onCaptureCurrentIntoSpace?: (spaceId: string) => void;
  onToggleWidgetInSpace?: (spaceId: string, widgetId: string, visible: boolean) => void;
  onDeleteSpace?: (spaceId: string) => void;
  onResetSpaces?: () => void;
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
    if (isYouTubeUrl(shortcut.url)) {
      return <YouTubeApp initialUrl={shortcut.url} initialTitle={shortcut.title} />;
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
    case 'music': return <MusicApp />;
    case 'notes': return <ScratchpadApp />;
    case 'dayline': return <DaylineApp />;
    case 'bookmarks': return <BookmarksApp settings={settings} />;
    case 'settings': return settings ? <SettingsApp settings={settings} /> : <div className="empty-state"><span>Settings unavailable.</span></div>;
    case 'widgets': return settings ? <WidgetStudioApp settings={settings} /> : <div className="empty-state"><span>Widget Studio unavailable.</span></div>;
    default: return <div className="empty-state"><span>App not found.</span></div>;
  }
}

function DaylineApp() {
  const date = getDaylineDate();
  const [notes, setNotes] = useState(() => readNotesState());
  const [state, setState] = useState<DaylineState>(() => readDaylineState());
  const [draggedTask, setDraggedTask] = useState<{ noteId: string; lineIndex: number; text: string } | null>(null);
  const [weather, setWeather] = useState<{ temperature: number; description: string } | null>(null);
  const [weatherLoading, setWeatherLoading] = useState(false);
  const [weatherError, setWeatherError] = useState('');
  const [newTimezone, setNewTimezone] = useState('');
  const today = state.days[date] ?? { date, blocks: {} };

  const tasks = useMemo(() => {
    const result: Array<{ noteId: string; lineIndex: number; text: string; checked: boolean }> = [];
    for (const note of notes.notes) {
      note.content.split(/\r?\n/).forEach((line, lineIndex) => {
        const match = line.match(/^(\s*)[-*]\s+\[([ xX])\]\s+(.*)$/);
        if (match?.[3]?.trim()) {
          result.push({ noteId: note.id, lineIndex, text: match[3].trim(), checked: match[2].toLowerCase() === 'x' });
        }
      });
    }
    return result;
  }, [notes]);

  const persist = useCallback((next: DaylineState) => {
    setState(next);
    saveDaylineState(next);
  }, []);

  const assignTask = useCallback((hour: string) => {
    if (!draggedTask) return;
    const nextDay = {
      ...today,
      blocks: {
        ...today.blocks,
        [hour]: {
          id: `${date}-${hour}`,
          task: draggedTask.text,
          sourceNoteId: draggedTask.noteId,
          sourceLineIndex: draggedTask.lineIndex,
          completed: false,
        },
      },
    };
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
    setDraggedTask(null);
  }, [date, draggedTask, persist, state, today]);

  const assignLinkedTask = useCallback((hour: string, task: { noteId: string; lineIndex: number; text: string }) => {
    const nextDay = {
      ...today,
      blocks: {
        ...today.blocks,
        [hour]: {
          id: `${date}-${hour}`,
          task: task.text,
          sourceNoteId: task.noteId,
          sourceLineIndex: task.lineIndex,
          completed: false,
        },
      },
    };
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
    setDraggedTask(null);
  }, [date, persist, state, today]);

  const assignText = useCallback((hour: string, rawText: string) => {
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!text) return;
    const currentNotes = readNotesState();
    const note = currentNotes.notes.find(item => item.id === currentNotes.activeNoteId) ?? currentNotes.notes[0];
    if (!note) return;
    const separator = note.content && !note.content.endsWith('\n') ? '\n' : '';
    const nextContent = `${note.content}${separator}- [ ] ${text}`;
    const sourceLineIndex = nextContent.split(/\r?\n/).length - 1;
    const nextNotes = {
      ...currentNotes,
      notes: currentNotes.notes.map(item => item.id === note.id
        ? { ...item, content: nextContent, updatedAt: Date.now() }
        : item),
    };
    saveNotesState(nextNotes);
    setNotes(nextNotes);
    const nextDay = {
      ...today,
      blocks: {
        ...today.blocks,
        [hour]: {
          id: `${date}-${hour}`,
          task: text,
          sourceNoteId: note.id,
          sourceLineIndex,
          completed: false,
        },
      },
    };
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
  }, [date, persist, state, today]);

  const editBlock = useCallback((hour: string, rawText: string) => {
    const block = today.blocks[hour];
    const text = rawText.replace(/\s+/g, ' ').trim().slice(0, 500);
    if (!block || !text || text === block.task) return;
    const nextDay = { ...today, blocks: { ...today.blocks, [hour]: { ...block, task: text } } };
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
    const currentNotes = readNotesState();
    const note = currentNotes.notes.find(item => item.id === block.sourceNoteId);
    if (!note) return;
    const lines = note.content.split(/\r?\n/);
    if (!lines[block.sourceLineIndex]) return;
    lines[block.sourceLineIndex] = lines[block.sourceLineIndex].replace(/(^\s*[-*]\s+\[[ xX]\]\s+).*/, `$1${text}`);
    const nextNotes = {
      ...currentNotes,
      notes: currentNotes.notes.map(item => item.id === note.id
        ? { ...item, content: lines.join('\n'), updatedAt: Date.now() }
        : item),
    };
    saveNotesState(nextNotes);
    setNotes(nextNotes);
  }, [date, persist, state, today]);

  const removeBlock = useCallback((hour: string) => {
    const nextDay = { ...today, blocks: { ...today.blocks } };
    delete nextDay.blocks[hour];
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
  }, [date, persist, state, today]);

  const toggleBlock = useCallback((hour: string) => {
    const block = today.blocks[hour];
    if (!block) return;
    const completed = !block.completed;
    const nextDay = { ...today, blocks: { ...today.blocks, [hour]: { ...block, completed } } };
    persist({ ...state, days: { ...state.days, [date]: nextDay } });
    if (completed) {
      const currentNotes = readNotesState();
      const note = currentNotes.notes.find(item => item.id === block.sourceNoteId);
      if (note) {
        const lines = note.content.split(/\r?\n/);
        const line = lines[block.sourceLineIndex];
        if (line) {
          lines[block.sourceLineIndex] = line.replace(/^(\s*[-*]\s+\[)([ xX])(\])/, '$1x$3');
          const nextNotes = {
            ...currentNotes,
            notes: currentNotes.notes.map(item => item.id === note.id
              ? { ...item, content: lines.join('\n'), updatedAt: Date.now() }
              : item),
          };
          saveNotesState(nextNotes);
          setNotes(nextNotes);
        }
      }
    }
  }, [date, persist, state, today]);

  const addTimezone = () => {
    const zone = newTimezone.trim();
    if (!zone || state.timezones.includes(zone) || state.timezones.length >= 6) return;
    try {
      new Intl.DateTimeFormat(undefined, { timeZone: zone }).format();
      persist({ ...state, timezones: [...state.timezones, zone] });
      setNewTimezone('');
    } catch {
      setNewTimezone('');
    }
  };

  const loadWeather = async () => {
    if (!state.weatherLocation.trim()) return;
    setWeatherLoading(true);
    setWeatherError('');
    try {
      const geoResponse = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(state.weatherLocation)}&count=1`);
      const geo = (await geoResponse.json()) as { results?: Array<{ latitude: number; longitude: number }> };
      const place = geo.results?.[0];
      if (!place) return;
      const weatherResponse = await fetch(`https://api.open-meteo.com/v1/forecast?latitude=${place.latitude}&longitude=${place.longitude}&current=temperature_2m,weather_code`);
      const current = (await weatherResponse.json()) as { current?: { temperature_2m?: number; weather_code?: number } };
      if (typeof current.current?.temperature_2m === 'number') {
        setWeather({ temperature: current.current.temperature_2m, description: `Code ${current.current.weather_code ?? 0}` });
      }
      else setWeatherError('Weather unavailable');
    } catch {
      setWeatherError('Weather unavailable');
    } finally {
      setWeatherLoading(false);
    }
  };

  return (
    <div className="dayline-app">
      <header className="dayline-header">
        <div>
          <span className="eyebrow"><CalendarClock size={12} /> Dayline</span>
          <h2>{new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' })}</h2>
          <p>Drag unchecked Scratchpad tasks onto your day.</p>
        </div>
        <div className="dayline-weather">
          <input
            value={state.weatherLocation}
            placeholder="Weather city"
            onChange={event => persist({ ...state, weatherLocation: event.target.value })}
            onKeyDown={event => { if (event.key === 'Enter') void loadWeather(); }}
          />
          <button type="button" className="secondary-btn" onClick={() => void loadWeather()} disabled={weatherLoading}>
            <CloudRain size={13} /> {weather ? `${weather.temperature}° · ${weather.description}` : weatherError || 'Weather'}
          </button>
        </div>
      </header>
      <div className="dayline-layout">
        <aside className="dayline-tasks">
          <div className="dayline-panel-heading"><strong>Scratchpad tasks</strong><span>{tasks.filter(task => !task.checked).length} open</span></div>
          {tasks.filter(task => !task.checked).map(task => (
            <div
              className="dayline-task"
              draggable
              key={`${task.noteId}-${task.lineIndex}`}
              onDragStart={event => {
                setDraggedTask(task);
                event.dataTransfer.effectAllowed = 'copy';
                event.dataTransfer.setData('text/plain', task.text);
                event.dataTransfer.setData('application/x-nexus-scratchpad-task', JSON.stringify({
                  noteId: task.noteId,
                  lineIndex: task.lineIndex,
                  text: task.text,
                }));
              }}
            >
              <span className="dayline-drag-handle">::</span>{task.text}
            </div>
          ))}
          {tasks.every(task => task.checked || !task.text) && <p className="dayline-empty">Add unchecked tasks in Scratchpad to plan them here.</p>}
        </aside>
        <main className="dayline-timeline">
          {Array.from({ length: 24 }, (_, hour) => {
            const key = `${String(hour).padStart(2, '0')}:00`;
            const block = today.blocks[key];
            return (
              <div
                className={`dayline-slot ${block ? 'has-task' : ''}`}
                key={key}
                onDragOver={event => { event.preventDefault(); event.dataTransfer.dropEffect = 'copy'; }}
                onDrop={event => {
                  event.preventDefault();
                  const linked = event.dataTransfer.getData('application/x-nexus-scratchpad-task');
                  if (linked) {
                    try {
                      const task = JSON.parse(linked) as { noteId?: string; lineIndex?: number; text?: string };
                      if (task.noteId && typeof task.lineIndex === 'number' && task.text) {
                        assignLinkedTask(key, { noteId: task.noteId, lineIndex: task.lineIndex, text: task.text });
                        return;
                      }
                    } catch {
                      /* Fall through to plain text handling. */
                    }
                  }
                  const dropped = event.dataTransfer.getData('text/plain');
                  if (dropped) assignText(key, dropped);
                  else assignTask(key);
                }}
                onPaste={event => {
                  const pasted = event.clipboardData.getData('text/plain');
                  if (pasted) {
                    event.preventDefault();
                    assignText(key, pasted);
                  }
                }}
              >
                <time>{key}</time>
                {block ? (
                  <div className={`dayline-block ${block.completed ? 'is-complete' : ''}`}>
                    <button type="button" className="dayline-check" onClick={() => toggleBlock(key)} aria-label="Toggle task completion">
                      <Check size={13} />
                    </button>
                    <input
                      value={block.task}
                      aria-label={`Edit ${key} task`}
                      onChange={event => {
                        const nextDay = { ...today, blocks: { ...today.blocks, [key]: { ...block, task: event.target.value } } };
                        setState({ ...state, days: { ...state.days, [date]: nextDay } });
                      }}
                      onBlur={event => editBlock(key, event.target.value)}
                      onKeyDown={event => { if (event.key === 'Enter') event.currentTarget.blur(); }}
                    />
                    <button type="button" className="dayline-remove" onClick={() => removeBlock(key)} aria-label="Remove time block">
                      <Trash2 size={12} />
                    </button>
                  </div>
                ) : (
                  <div className="dayline-empty-slot">
                    <input
                      placeholder="Drop or type a task"
                      aria-label={`Add task at ${key}`}
                      onKeyDown={event => {
                        if (event.key === 'Enter') {
                          assignText(key, event.currentTarget.value);
                          event.currentTarget.value = '';
                        }
                      }}
                    />
                    <span className="dayline-drop-hint">Drop text here</span>
                  </div>
                )}
              </div>
            );
          })}
        </main>
        <aside className="dayline-zones">
          <div className="dayline-panel-heading"><strong>Team clocks</strong><span>Local</span></div>
          {state.timezones.map(zone => (
            <div className="dayline-clock" key={zone}>
              <span>{zone}</span>
              <strong>{new Intl.DateTimeFormat(undefined, { timeZone: zone, hour: '2-digit', minute: '2-digit' }).format()}</strong>
            </div>
          ))}
          <div className="dayline-add-zone">
            <input value={newTimezone} placeholder="e.g. Asia/Kolkata" onChange={event => setNewTimezone(event.target.value)} />
            <button type="button" className="icon-btn" onClick={addTimezone} aria-label="Add timezone"><Plus size={13} /></button>
          </div>
        </aside>
      </div>
    </div>
  );
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

/* ── Nexus Tube (YouTube Workspace Wrapper) ───────────────────────────────── */

function YouTubeApp({
  initialUrl,
  initialTitle,
}: {
  initialUrl?: string;
  initialTitle?: string;
} = {}) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<MediaTrack[]>([]);
  const [history, setHistory] = useState<MediaTrack[]>(readYouTubeHistory);
  const [watchLater, setWatchLater] = useState<MediaTrack[]>(readYouTubeWatchLater);
  const [video, setVideo] = useState<MediaTrack | null>(() => {
    if (initialUrl) {
      const shortcutVid = extractYouTubeVideoId(initialUrl);
      if (shortcutVid) {
        return buildTrackFromVideoId(shortcutVid, initialTitle);
      }
    }
    return readYouTubeHistory()[0] ?? null;
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [section, setSection] = useState<YouTubeSection>('home');
  const [videoUrl, setVideoUrl] = useState('');
  const [searchTrail, setSearchTrail] = useState<Array<{ query: string; results: MediaTrack[] }>>([]);
  const [searchTrailIndex, setSearchTrailIndex] = useState(-1);

  /* Live playback time + Timestamp Note capture state */
  const playerFrameRef = useRef<HTMLIFrameElement | null>(null);
  const [liveSeconds, setLiveSeconds] = useState(0);
  const [timestampDraft, setTimestampDraft] = useState('00:00');
  const [timestampManuallyEdited, setTimestampManuallyEdited] = useState(false);
  const [noteDraft, setNoteDraft] = useState('');
  const [showDescription, setShowDescription] = useState(false);
  const [toastMessage, setToastMessage] = useState<{ text: string; showScratchpadLink?: boolean } | null>(null);

  const originParam =
    typeof window !== 'undefined' && window.location.origin
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  const showToast = useCallback((text: string, showScratchpadLink = false) => {
    setToastMessage({ text, showScratchpadLink });
    window.setTimeout(() => {
      setToastMessage(prev => (prev?.text === text ? null : prev));
    }, 3200);
  }, []);

  const playVideo = useCallback((next: MediaTrack) => {
    setVideo(next);
    setSection('home');
    setLiveSeconds(0);
    setTimestampDraft('00:00');
    setTimestampManuallyEdited(false);
    setShowDescription(false);
    setHistory(previous => {
      const updated = [next, ...previous.filter(item => item.id !== next.id)].slice(0, 30);
      saveYouTubeHistory(updated);
      return updated;
    });
  }, []);

  const runSearch = useCallback(async (trimmed: string, record = true) => {
    if (trimmed.length < 2) {
      setError('Enter at least two characters to search YouTube.');
      return;
    }
    setLoading(true);
    setError('');
    setSection('home');
    try {
      const response = await fetch(`/api/youtube/search?q=${encodeURIComponent(trimmed)}`);
      const data = (await response.json()) as { items?: MediaTrack[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'YouTube search failed.');
      const items = data.items ?? [];
      setResults(items);
      setQuery(trimmed);
      if (record) {
        setSearchTrail(previous => {
          const next = [...previous.slice(0, searchTrailIndex + 1), { query: trimmed, results: items }];
          setSearchTrailIndex(next.length - 1);
          return next;
        });
      }
      if (!items.length) setError('No videos found for that search.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'YouTube search failed.');
    } finally {
      setLoading(false);
    }
  }, [searchTrailIndex]);

  /* Sync storage updates (e.g., workspace import/reset) */
  useEffect(() => {
    const syncLists = () => {
      setHistory(readYouTubeHistory());
      setWatchLater(readYouTubeWatchLater());
    };
    window.addEventListener('storage', syncLists);
    return () => window.removeEventListener('storage', syncLists);
  }, []);

  /* Consume queued cross-app YouTube actions (from Spotlight, Browser, or Menus) */
  useEffect(() => {
    const processActions = () => {
      const actions = consumeYouTubeActions();
      for (const action of actions) {
        if (action.kind === 'search') {
          void runSearch(action.query, true);
        } else if (action.kind === 'play') {
          playVideo(action.video);
        } else if (action.kind === 'play-url') {
          const vid = extractYouTubeVideoId(action.url);
          if (vid) {
            playVideo(buildTrackFromVideoId(vid, action.title));
          } else {
            setVideoUrl(action.url);
            setSection('url');
          }
        } else if (action.kind === 'section') {
          setSection(action.section);
          setError('');
        }
      }
    };
    processActions();
    window.addEventListener(YOUTUBE_ACTION_EVENT, processActions);
    return () => window.removeEventListener(YOUTUBE_ACTION_EVENT, processActions);
  }, [playVideo, runSearch]);

  /* Track live playback timestamp from embedded youtube-nocookie iframe */
  useEffect(() => {
    if (!video) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== playerFrameRef.current?.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          info?: { currentTime?: number };
        };
        if (
          parsed.event === 'infoDelivery' &&
          parsed.info &&
          typeof parsed.info.currentTime === 'number' &&
          Number.isFinite(parsed.info.currentTime)
        ) {
          const secs = Math.max(0, Math.floor(parsed.info.currentTime));
          setLiveSeconds(secs);
          setTimestampDraft(prev => (timestampManuallyEdited ? prev : formatMediaSeconds(secs)));
        }
      } catch {
        /* Ignore non-JSON iframe messages */
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [timestampManuallyEdited, video]);

  const toggleWatchLater = (target: MediaTrack) => {
    setWatchLater(prev => {
      const exists = prev.some(item => item.id === target.id);
      const next = exists
        ? prev.filter(item => item.id !== target.id)
        : [target, ...prev].slice(0, 40);
      saveYouTubeWatchLater(next);
      showToast(exists ? 'Removed from Watch later' : 'Saved to Watch later');
      return next;
    });
  };

  const handoffToMusic = (target: MediaTrack) => {
    playMusicTrack(target, results.length ? results : history.length ? history : [target]);
    showToast(`Playing "${target.title}" in Music`);
  };

  const clearHistory = () => {
    setHistory([]);
    try {
      localStorage.removeItem(YOUTUBE_HISTORY_KEY);
    } catch {
      /* ignore */
    }
  };

  const playFromUrl = (event: FormEvent) => {
    event.preventDefault();
    const id = extractYouTubeVideoId(videoUrl);
    if (!id) {
      setError('Enter a valid YouTube URL or 11-character video ID.');
      return;
    }
    playVideo(buildTrackFromVideoId(id));
    setVideoUrl('');
    setError('');
  };

  const search = async (event: FormEvent) => {
    event.preventDefault();
    await runSearch(query.trim());
  };

  const navigateSearch = (direction: -1 | 1) => {
    const targetIndex = searchTrailIndex + direction;
    const target = searchTrail[targetIndex];
    if (!target) return;
    setSearchTrailIndex(targetIndex);
    setQuery(target.query);
    setResults(target.results);
    setError('');
  };

  const refreshSearch = () => {
    if (query.trim().length >= 2) void runSearch(query.trim(), false);
  };

  const clearSearch = () => {
    setQuery('');
    setResults([]);
    setVideo(null);
    setError('');
    setSearchTrail([]);
    setSearchTrailIndex(-1);
  };

  const handleCaptureTimestampNote = (event: FormEvent) => {
    event.preventDefault();
    if (!video) return;
    const parsedSecs = parseTimestampInputSeconds(timestampDraft);
    const chosenSeconds = parsedSecs !== null ? parsedSecs : liveSeconds;
    const res = captureVideoTimestampNote({
      video,
      seconds: chosenSeconds,
      noteText: noteDraft,
      openScratchpad: false,
    });
    setNoteDraft('');
    setTimestampManuallyEdited(false);
    setTimestampDraft(formatMediaSeconds(liveSeconds));
    showToast(`Saved [${res.formattedTimestamp}] note to Scratchpad`, true);
  };

  const watchLaterIds = useMemo(() => new Set(watchLater.map(item => item.id)), [watchLater]);
  const isVideoSavedLater = video ? watchLaterIds.has(video.id) : false;

  return (
    <div className="youtube-app">
      <div className="youtube-shell">
        <aside className="youtube-sidebar">
          <div className="youtube-brand">
            <span className="youtube-brand-mark"><Play size={13} fill="currentColor" /></span>
            <strong>Nexus Tube</strong>
          </div>
          <nav className="youtube-nav" aria-label="YouTube sections">
            <button
              type="button"
              className={section === 'home' ? 'is-active' : ''}
              onClick={() => setSection('home')}
            >
              <Home size={15} />
              <span>Home</span>
            </button>
            <button
              type="button"
              className={section === 'watch-later' ? 'is-active' : ''}
              onClick={() => setSection('watch-later')}
            >
              <Bookmark size={15} />
              <span>Watch later</span>
              <small>{watchLater.length}</small>
            </button>
            <button
              type="button"
              className={section === 'history' ? 'is-active' : ''}
              onClick={() => setSection('history')}
            >
              <Clock3 size={15} />
              <span>Watch history</span>
              <small>{history.length}</small>
            </button>
            <button
              type="button"
              className={section === 'url' ? 'is-active' : ''}
              onClick={() => {
                setSection('url');
                setError('');
              }}
            >
              <Link2 size={15} />
              <span>Play from URL</span>
            </button>
          </nav>
          <div className="youtube-sidebar-divider" />
          <div className="youtube-sidebar-label">Your library</div>
          <div className="youtube-library-item">
            <ListVideo size={14} />
            <span>Saved locally</span>
          </div>
          <div className="youtube-sidebar-spacer" />
          {history.length > 0 && (
            <button type="button" className="youtube-clear-history" onClick={clearHistory}>
              <Trash2 size={13} /> Clear history
            </button>
          )}
        </aside>

        <main className="youtube-main">
          {section !== 'url' && (
            <div className="youtube-search-row">
              <form className="youtube-search-bar" onSubmit={search}>
                <Search size={15} />
                <input
                  value={query}
                  onChange={event => setQuery(event.target.value)}
                  placeholder="Search videos, channels, or topics…"
                  aria-label="Search YouTube videos"
                />
                <button type="submit" className="primary-btn" disabled={loading}>
                  {loading ? 'Searching…' : 'Search'}
                </button>
              </form>
              <div className="youtube-search-actions" aria-label="Search controls">
                <button
                  type="button"
                  className="youtube-icon-action"
                  onClick={() => navigateSearch(-1)}
                  disabled={searchTrailIndex <= 0}
                  title="Previous search"
                  aria-label="Previous search"
                >
                  <ArrowLeft size={14} />
                </button>
                <button
                  type="button"
                  className="youtube-icon-action"
                  onClick={() => navigateSearch(1)}
                  disabled={searchTrailIndex < 0 || searchTrailIndex >= searchTrail.length - 1}
                  title="Next search"
                  aria-label="Next search"
                >
                  <ArrowRight size={14} />
                </button>
                <button
                  type="button"
                  className="youtube-icon-action"
                  onClick={refreshSearch}
                  disabled={loading || query.trim().length < 2}
                  title="Refresh search"
                  aria-label="Refresh search"
                >
                  <RefreshCw size={14} />
                </button>
                <button
                  type="button"
                  className="youtube-icon-action"
                  onClick={clearSearch}
                  disabled={!query && !results.length && !video}
                  title="Clear screen"
                  aria-label="Clear screen"
                >
                  <X size={14} />
                </button>
              </div>
            </div>
          )}

          {error && <p className="inline-error youtube-error">{error}</p>}

          {toastMessage && (
            <div className="yt-inline-toast" role="status" aria-live="polite">
              <Check size={12} />
              <span>{toastMessage.text}</span>
              {toastMessage.showScratchpadLink && (
                <button
                  type="button"
                  className="ctx-action-toast-link"
                  onClick={() => {
                    setToastMessage(null);
                    requestOpenApp('notes', { preferExisting: true });
                  }}
                >
                  Open Scratchpad
                </button>
              )}
            </div>
          )}

          {section === 'url' ? (
            <section className="youtube-url-view">
              <div className="youtube-url-hero">
                <span className="eyebrow">Direct playback</span>
                <h3>Play a video from a URL</h3>
                <p>Paste a YouTube link, Shorts link, or 11-character video ID to watch inside Nexus.</p>
                <form className="youtube-url-bar" onSubmit={playFromUrl}>
                  <Link2 size={15} />
                  <input
                    autoFocus
                    value={videoUrl}
                    onChange={event => setVideoUrl(event.target.value)}
                    placeholder="https://youtube.com/watch?v=…"
                    aria-label="Play YouTube URL"
                  />
                  <button type="submit" className="primary-btn">Play video</button>
                </form>
                <small>Supported: youtube.com, youtu.be, shorts, embed links, and video IDs.</small>
              </div>
              {video && (
                <button type="button" className="youtube-return-link" onClick={() => setSection('home')}>
                  <Play size={13} /> Return to currently playing video
                </button>
              )}
            </section>
          ) : section === 'watch-later' ? (
            <section className="youtube-history-view">
              <div className="youtube-content-heading">
                <div>
                  <span className="eyebrow">Saved queue</span>
                  <h3>Watch later</h3>
                </div>
                <span className="yt-count-label">{watchLater.length} saved</span>
              </div>
              <div className="youtube-video-grid">
                {watchLater.map(item => (
                  <YouTubeVideoCard
                    key={item.id}
                    item={item}
                    activeId={video?.id}
                    isSavedLater={watchLaterIds.has(item.id)}
                    onPlay={playVideo}
                    onToggleWatchLater={toggleWatchLater}
                    onListenInMusic={handoffToMusic}
                  />
                ))}
              </div>
              {!watchLater.length && (
                <div className="youtube-empty">
                  <Bookmark size={26} />
                  <strong>Your Watch later list is empty</strong>
                  <span>Bookmark any search result or active video to save it for later.</span>
                </div>
              )}
            </section>
          ) : section === 'history' ? (
            <section className="youtube-history-view">
              <div className="youtube-content-heading">
                <div>
                  <span className="eyebrow">Your library</span>
                  <h3>Watch history</h3>
                </div>
                <span className="yt-count-label">{history.length} watched</span>
              </div>
              <div className="youtube-video-grid">
                {history.map(item => (
                  <YouTubeVideoCard
                    key={item.id}
                    item={item}
                    activeId={video?.id}
                    isSavedLater={watchLaterIds.has(item.id)}
                    onPlay={playVideo}
                    onToggleWatchLater={toggleWatchLater}
                    onListenInMusic={handoffToMusic}
                  />
                ))}
              </div>
              {!history.length && (
                <div className="youtube-empty">
                  <Clock3 size={28} />
                  <strong>Your history is empty</strong>
                  <span>Videos you play will be saved here on this device.</span>
                </div>
              )}
            </section>
          ) : (
            <section className="youtube-home-view">
              <div className="youtube-player-column">
                {video ? (
                  <>
                    <div className="video-stage">
                      <iframe
                        key={video.id}
                        ref={playerFrameRef}
                        title={video.title}
                        src={`https://www.youtube-nocookie.com/embed/${video.id}?rel=0&enablejsapi=1${originParam}`}
                        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                        referrerPolicy="strict-origin-when-cross-origin"
                        allowFullScreen
                        onLoad={() => {
                          playerFrameRef.current?.contentWindow?.postMessage(
                            JSON.stringify({ event: 'listening', id: 'nexus-tube', channel: 'widget' }),
                            'https://www.youtube-nocookie.com'
                          );
                        }}
                      />
                    </div>

                    <div className="youtube-now-playing">
                      <div className="yt-np-header">
                        <div className="yt-np-copy">
                          <strong>{video.title}</strong>
                          <span className="yt-np-subline">
                            {[video.channelTitle, video.viewCount, video.duration]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        </div>
                        <div className="yt-np-actions">
                          <button
                            type="button"
                            className={`secondary-btn yt-action-btn ${isVideoSavedLater ? 'is-saved' : ''}`}
                            onClick={() => toggleWatchLater(video)}
                            title={isVideoSavedLater ? 'Remove from Watch later' : 'Save to Watch later'}
                          >
                            {isVideoSavedLater ? <Check size={12} /> : <Bookmark size={12} />}
                            <span>{isVideoSavedLater ? 'Saved' : 'Watch later'}</span>
                          </button>
                          <button
                            type="button"
                            className="secondary-btn yt-action-btn"
                            onClick={() => handoffToMusic(video)}
                            title="Continue listening in background desktop Music player"
                          >
                            <Headphones size={12} />
                            <span>Listen in Music</span>
                          </button>
                          {video.description.trim().length > 0 && (
                            <button
                              type="button"
                              className="secondary-btn yt-action-btn"
                              onClick={() => setShowDescription(v => !v)}
                              aria-expanded={showDescription}
                            >
                              {showDescription ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
                              <span>Details</span>
                            </button>
                          )}
                        </div>
                      </div>

                      {showDescription && video.description.trim().length > 0 && (
                        <p className="yt-np-description">{video.description}</p>
                      )}

                      {/* Timestamp Note Capture to Scratchpad */}
                      <form className="yt-note-bar" onSubmit={handleCaptureTimestampNote}>
                        <button
                          type="button"
                          className="yt-ts-sync-btn"
                          onClick={() => {
                            setTimestampManuallyEdited(false);
                            setTimestampDraft(formatMediaSeconds(liveSeconds));
                          }}
                          title="Sync input to current playback timestamp"
                        >
                          <Clock3 size={12} />
                        </button>
                        <input
                          className="yt-ts-input"
                          value={timestampDraft}
                          onChange={e => {
                            setTimestampManuallyEdited(true);
                            setTimestampDraft(e.target.value);
                          }}
                          aria-label="Video timestamp MM:SS"
                          title="Timestamp (MM:SS)"
                        />
                        <input
                          className="yt-note-input"
                          value={noteDraft}
                          onChange={e => setNoteDraft(e.target.value)}
                          placeholder="Capture a timestamped note to Scratchpad…"
                          aria-label="Timestamped note for Scratchpad"
                        />
                        <button type="submit" className="secondary-btn yt-note-submit">
                          <StickyNote size={12} />
                          <span>Save note</span>
                        </button>
                      </form>
                    </div>
                  </>
                ) : (
                  !results.length && (
                    <div className="youtube-empty">
                      <Play size={28} />
                      <strong>Search for something to watch</strong>
                      <span>Videos you play stay in your local workspace history.</span>
                    </div>
                  )
                )}
              </div>

              {(results.length > 0 || history.length > 0) && (
                <div className="youtube-discovery">
                  <div className="youtube-content-heading">
                    <div>
                      <span className="eyebrow">{results.length ? 'Discover' : 'Continue watching'}</span>
                      <h3>{results.length ? 'Search results' : 'Recently watched'}</h3>
                    </div>
                    <span className="yt-count-label">{results.length || history.length} videos</span>
                  </div>
                  <div className="youtube-video-grid">
                    {(results.length ? results : history).map(item => (
                      <YouTubeVideoCard
                        key={item.id}
                        item={item}
                        activeId={video?.id}
                        isSavedLater={watchLaterIds.has(item.id)}
                        onPlay={playVideo}
                        onToggleWatchLater={toggleWatchLater}
                        onListenInMusic={handoffToMusic}
                      />
                    ))}
                  </div>
                </div>
              )}
            </section>
          )}
        </main>
      </div>

      <div className="web-app-footer">
        <span>Search, Watch later, and history stay in this Nexus workspace.</span>
        {video && (
          <a
            href={`https://www.youtube.com/watch?v=${video.id}`}
            target="_blank"
            rel="noopener noreferrer"
          >
            <ExternalLink size={11} /> Watch on YouTube
          </a>
        )}
      </div>
    </div>
  );
}

/* ── Nexus Music (Persistent Desktop Audio Controller) ────────────────────── */

const SOUNDSCAPE_CHANNEL_ICONS: Record<SoundscapeLayerId, typeof CloudRain> = {
  rain: CloudRain,
  vinyl: Disc3,
  hearth: Flame,
  brown: Waves,
  wind: Wind,
  night: MoonStar,
};

function MusicApp() {
  const music = useSyncExternalStore(subscribeMusicState, getMusicState);
  const soundscape = useSyncExternalStore(subscribeSoundscapeState, getSoundscapeState);
  const [query, setQuery] = useState('');
  const [tracks, setTracks] = useState<MediaTrack[]>([]);
  const [tab, setTab] = useState<MusicTab>('discover');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [playlistMenuOpen, setPlaylistMenuOpen] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState('');
  const [newMixName, setNewMixName] = useState('');
  const [selectedPlaylistId, setSelectedPlaylistId] = useState<string | null>(null);
  const [artworkFailedId, setArtworkFailedId] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  const activeAmbientCount = getActiveSoundscapeLayersCount(soundscape.levels);
  const ambientAudible = isSoundscapeAudiblyPlaying(soundscape);
  const allSoundscapePresets = useMemo(() => getAllSoundscapePresets(soundscape), [soundscape]);

  const showFeedback = useCallback((msg: string) => {
    setFeedback(msg);
    window.setTimeout(() => {
      setFeedback(prev => (prev === msg ? null : prev));
    }, 2400);
  }, []);

  const runMusicSearch = useCallback(async (trimmed: string) => {
    if (trimmed.length < 2) {
      setError('Search for an artist, album, song, or mood.');
      return;
    }
    setLoading(true);
    setError('');
    setTab('discover');
    try {
      const response = await fetch(
        `/api/youtube/search?q=${encodeURIComponent(trimmed)}&category=music`
      );
      const data = (await response.json()) as { items?: MediaTrack[]; error?: string };
      if (!response.ok) throw new Error(data.error || 'Music search failed.');
      const items = data.items ?? [];
      setTracks(items);
      setQuery(trimmed);
      if (!items.length) setError('No music found for that search.');
    } catch (reason: unknown) {
      setError(reason instanceof Error ? reason.message : 'Music search failed.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const processMusicActions = () => {
      const actions = consumeMusicActions();
      for (const action of actions) {
        if (action.kind === 'search') {
          void runMusicSearch(action.query);
        } else if (action.kind === 'tab') {
          setTab(action.tab);
        }
      }
    };
    processMusicActions();
    window.addEventListener(MUSIC_ACTION_EVENT, processMusicActions);
    return () => window.removeEventListener(MUSIC_ACTION_EVENT, processMusicActions);
  }, [runMusicSearch]);

  const searchMusic = async (event: FormEvent) => {
    event.preventDefault();
    await runMusicSearch(query.trim());
  };

  const current = music.current;
  const likedIds = useMemo(() => new Set(music.liked.map(item => item.id)), [music.liked]);
  const isCurrentLiked = current ? likedIds.has(current.id) : false;

  const isLiveStream = Boolean(
    current && (current.duration === 'LIVE' || (music.duration <= 0 && !current.durationSeconds))
  );
  const displayDuration = current
    ? music.duration > 0
      ? music.duration
      : (current.durationSeconds ?? 0)
    : 0;

  const activePlaylist = useMemo(
    () =>
      music.playlists.find(p => p.id === selectedPlaylistId) ??
      music.playlists[0] ??
      null,
    [music.playlists, selectedPlaylistId]
  );

  const handleCreatePlaylist = (event: FormEvent) => {
    event.preventDefault();
    const created = createMusicPlaylist(newPlaylistName, current ?? undefined);
    if (!created) return;
    setNewPlaylistName('');
    setSelectedPlaylistId(created.id);
    setPlaylistMenuOpen(false);
    showFeedback(
      current
        ? `Created "${created.name}" with current track`
        : `Created playlist "${created.name}"`
    );
  };

  const watchCurrentInTube = () => {
    if (!current) return;
    enqueueYouTubeAction({ kind: 'play', video: current });
    requestOpenApp('youtube', { preferExisting: true });
  };

  return (
    <div className="music-app">
      <header className="music-header">
        <div className="music-brand">
          <span className="music-brand-icon"><Headphones size={17} /></span>
          <div>
            <span className="eyebrow">Nexus audio</span>
            <h3>Music</h3>
          </div>
        </div>

        <nav className="ws-seg music-tabs" aria-label="Music library sections">
          <button
            type="button"
            className={tab === 'discover' ? 'is-active' : ''}
            onClick={() => setTab('discover')}
          >
            Discover
          </button>
          <button
            type="button"
            className={tab === 'soundscapes' ? 'is-active' : ''}
            onClick={() => setTab('soundscapes')}
          >
            {activeAmbientCount > 0 ? `Soundscapes · ${activeAmbientCount}` : 'Soundscapes'}
          </button>
          <button
            type="button"
            className={tab === 'queue' ? 'is-active' : ''}
            onClick={() => setTab('queue')}
          >
            Queue · {music.queue.length}
          </button>
          <button
            type="button"
            className={tab === 'liked' ? 'is-active' : ''}
            onClick={() => setTab('liked')}
          >
            Liked · {music.liked.length}
          </button>
          <button
            type="button"
            className={tab === 'playlists' ? 'is-active' : ''}
            onClick={() => setTab('playlists')}
          >
            Playlists · {music.playlists.length}
          </button>
          <button
            type="button"
            className={tab === 'history' ? 'is-active' : ''}
            onClick={() => setTab('history')}
          >
            History · {music.history.length}
          </button>
        </nav>
      </header>

      <main className="music-main">
        <form className="music-search" onSubmit={searchMusic}>
          <Search size={16} />
          <input
            value={query}
            onChange={event => setQuery(event.target.value)}
            placeholder="Search artists, songs, albums, or ambient streams…"
            aria-label="Search music"
          />
          {query && (
            <button
              type="button"
              className="music-search-clear"
              onClick={() => {
                setQuery('');
                setTracks([]);
                setError('');
              }}
              aria-label="Clear music search"
            >
              <X size={12} />
            </button>
          )}
          <button type="submit" className="primary-btn" disabled={loading}>
            {loading ? 'Searching…' : 'Find music'}
          </button>
        </form>

        {error && <p className="inline-error music-error">{error}</p>}
        {feedback && (
          <div className="music-feedback-bar" role="status" aria-live="polite">
            <Check size={12} />
            <span>{feedback}</span>
          </div>
        )}

        {current ? (
          <section className="music-now-playing">
            <div className="music-artwork">
              {current.thumbnail && artworkFailedId !== current.id ? (
                <img
                  src={current.thumbnail}
                  alt=""
                  referrerPolicy="no-referrer"
                  onError={() => setArtworkFailedId(current.id)}
                />
              ) : (
                <Headphones size={40} />
              )}
            </div>

            <div className="music-track-copy">
              <div className="music-np-top">
                <div className="music-np-titles">
                  <span className="eyebrow">
                    {music.isPlaying ? 'Now playing · Continues when minimized' : 'Paused'}
                  </span>
                  <h2>{current.title}</h2>
                  <p>
                    {[current.channelTitle, current.viewCount].filter(Boolean).join(' · ')}
                  </p>
                </div>

                <div className="music-np-actions">
                  <button
                    type="button"
                    className={`icon-btn ${isCurrentLiked ? 'is-liked' : ''}`}
                    onClick={() => {
                      const liked = toggleMusicTrackLiked(current);
                      showFeedback(liked ? 'Added to Liked songs' : 'Removed from Liked songs');
                    }}
                    title={isCurrentLiked ? 'Remove from Liked songs' : 'Save to Liked songs'}
                    aria-label={isCurrentLiked ? 'Unlike track' : 'Like track'}
                  >
                    <Heart size={14} fill={isCurrentLiked ? 'currentColor' : 'none'} />
                  </button>
                  <button
                    type="button"
                    className={`secondary-btn music-mini-action ${playlistMenuOpen ? 'is-open' : ''}`}
                    onClick={() => setPlaylistMenuOpen(v => !v)}
                    aria-expanded={playlistMenuOpen}
                  >
                    <ListMusic size={12} />
                    <span>+ Playlist</span>
                  </button>
                  <button
                    type="button"
                    className={`secondary-btn music-mini-action ${ambientAudible ? 'is-open' : ''}`}
                    onClick={() => setTab('soundscapes')}
                    title="Layer ambient rain, vinyl, fireplace, or brown noise"
                  >
                    <CloudRain size={12} />
                    <span>{ambientAudible ? `+${activeAmbientCount} Ambient` : 'Ambience'}</span>
                  </button>
                  <button
                    type="button"
                    className="secondary-btn music-mini-action"
                    onClick={watchCurrentInTube}
                    title="Watch video in Nexus Tube"
                  >
                    <Tv size={12} />
                    <span>Video</span>
                  </button>
                </div>
              </div>

              {playlistMenuOpen && (
                <div className="music-playlist-popover">
                  {music.playlists.length > 0 && (
                    <div className="music-playlist-picks">
                      {music.playlists.map(pl => {
                        const alreadyIn = pl.tracks.some(t => t.id === current.id);
                        return (
                          <button
                            key={pl.id}
                            type="button"
                            className="music-pl-pick-btn"
                            onClick={() => {
                              addTrackToMusicPlaylist(pl.id, current);
                              setPlaylistMenuOpen(false);
                              showFeedback(`Added to "${pl.name}"`);
                            }}
                          >
                            <span>{pl.name}</span>
                            <small>{alreadyIn ? 'Saved' : `${pl.tracks.length} tracks`}</small>
                          </button>
                        );
                      })}
                    </div>
                  )}
                  <form className="music-pl-inline-form" onSubmit={handleCreatePlaylist}>
                    <input
                      value={newPlaylistName}
                      onChange={e => setNewPlaylistName(e.target.value)}
                      placeholder="New playlist name…"
                      aria-label="New playlist name"
                    />
                    <button type="submit" className="primary-btn" disabled={!newPlaylistName.trim()}>
                      Create
                    </button>
                  </form>
                </div>
              )}

              {/* Seek Scrubber / Live Progress */}
              <div className="music-progress-row">
                <span className="music-time-label">{formatMediaSeconds(music.currentTime)}</span>
                {displayDuration > 0 && !isLiveStream ? (
                  <input
                    type="range"
                    className="music-seek-slider"
                    min={0}
                    max={displayDuration}
                    value={Math.min(music.currentTime, displayDuration)}
                    onChange={e => seekMusicTo(Number(e.target.value))}
                    aria-label="Seek track position"
                  />
                ) : (
                  <div className="music-live-bar" aria-hidden="true">
                    <div className="music-live-bar-fill" />
                  </div>
                )}
                <span className="music-time-label">
                  {isLiveStream ? 'LIVE' : formatMediaSeconds(displayDuration)}
                </span>
              </div>

              {/* Transport + Shuffle + Repeat + Volume */}
              <div className="music-transport-bar">
                <div className="music-controls" aria-label="Playback controls">
                  <button
                    type="button"
                    className={music.shuffle ? 'is-toggled' : ''}
                    onClick={toggleMusicShuffle}
                    title={music.shuffle ? 'Shuffle on' : 'Shuffle off'}
                    aria-label="Toggle shuffle"
                    aria-pressed={music.shuffle}
                  >
                    <Shuffle size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => stepMusicTrack(-1, 'manual')}
                    disabled={music.queue.length <= 1 && music.repeat === 'off'}
                    title="Previous track"
                    aria-label="Previous track"
                  >
                    <SkipBack size={15} />
                  </button>
                  <button
                    type="button"
                    className="music-play-button"
                    onClick={toggleMusicPlayback}
                    title={music.isPlaying ? 'Pause' : 'Play'}
                    aria-label={music.isPlaying ? 'Pause' : 'Play'}
                  >
                    {music.isPlaying ? (
                      <Pause size={17} fill="currentColor" />
                    ) : (
                      <Play size={17} fill="currentColor" />
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => stepMusicTrack(1, 'manual')}
                    disabled={music.queue.length <= 1 && music.repeat === 'off'}
                    title="Next track"
                    aria-label="Next track"
                  >
                    <SkipForward size={15} />
                  </button>
                  <button
                    type="button"
                    className={music.repeat !== 'off' ? 'is-toggled' : ''}
                    onClick={cycleMusicRepeat}
                    title={`Repeat: ${music.repeat}`}
                    aria-label={`Repeat mode ${music.repeat}`}
                  >
                    {music.repeat === 'one' ? <Repeat1 size={14} /> : <Repeat size={14} />}
                  </button>
                </div>

                <div className="music-volume-group" aria-label="Volume controls">
                  <button
                    type="button"
                    className="music-mute-btn"
                    onClick={toggleMusicMute}
                    title={music.isMuted ? 'Unmute' : 'Mute'}
                    aria-label={music.isMuted ? 'Unmute' : 'Mute'}
                  >
                    {music.isMuted || music.volume === 0 ? (
                      <VolumeX size={15} />
                    ) : (
                      <Volume2 size={15} />
                    )}
                  </button>
                  <input
                    type="range"
                    className="music-volume-slider"
                    min={0}
                    max={100}
                    value={music.isMuted ? 0 : music.volume}
                    onChange={e => setMusicVolume(Number(e.target.value))}
                    aria-label="Audio volume"
                  />
                  <span className="music-vol-pct">{music.isMuted ? 0 : music.volume}%</span>
                </div>
              </div>
            </div>
          </section>
        ) : (
          <section className="music-hero">
            <div className="music-hero-orb"><Headphones size={32} /></div>
            <span className="eyebrow">Persistent desktop audio</span>
            <h2>Start a focus stream or search any song.</h2>
            <p>Audio keeps playing in your desktop Now Playing bar even if you minimize or close Music.</p>
            <div className="music-hero-actions">
              <button
                type="button"
                className="primary-btn music-hero-cta"
                onClick={() => playStarterMusicStream(0)}
              >
                <Play size={13} fill="currentColor" /> Play Lofi Focus Radio
              </button>
              <button
                type="button"
                className="secondary-btn music-hero-cta"
                onClick={() => setTab('soundscapes')}
              >
                <CloudRain size={13} />
                <span>
                  {ambientAudible
                    ? `Ambience: ${describeActiveSoundscape(soundscape)}`
                    : 'Layer Ambient Soundscape'}
                </span>
              </button>
            </div>
          </section>
        )}

        {/* Tab Views */}
        {tab === 'discover' && (
          <>
            {tracks.length > 0 && (
              <section className="music-library">
                <div className="music-section-heading">
                  <div>
                    <span className="eyebrow">Search results</span>
                    <h3>Matches for “{query}”</h3>
                  </div>
                  <span className="yt-count-label">{tracks.length} tracks</span>
                </div>
                <div className="music-track-grid">
                  {tracks.map(track => (
                    <MusicTrackRow
                      key={track.id}
                      track={track}
                      isActive={current?.id === track.id}
                      isLiked={likedIds.has(track.id)}
                      onPlay={() => playMusicTrack(track, tracks)}
                      onQueueNext={() => {
                        enqueueTrackNext(track);
                        showFeedback('Queued to play next');
                      }}
                      onToggleLike={() => toggleMusicTrackLiked(track)}
                    />
                  ))}
                </div>
              </section>
            )}

            <section className="music-library">
              <div className="music-section-heading">
                <div>
                  <span className="eyebrow">Zero-search ready</span>
                  <h3>Curated focus & ambient streams</h3>
                </div>
                <span className="yt-count-label">{STARTER_MUSIC_STREAMS.length} live radios</span>
              </div>
              <div className="music-track-grid">
                {STARTER_MUSIC_STREAMS.map(stream => (
                  <MusicTrackRow
                    key={stream.id}
                    track={stream}
                    isActive={current?.id === stream.id}
                    isLiked={likedIds.has(stream.id)}
                    onPlay={() => playMusicTrack(stream, STARTER_MUSIC_STREAMS)}
                    onQueueNext={() => {
                      enqueueTrackNext(stream);
                      showFeedback('Queued stream next');
                    }}
                    onToggleLike={() => toggleMusicTrackLiked(stream)}
                  />
                ))}
              </div>
            </section>
          </>
        )}

        {tab === 'soundscapes' && (
          <section className="music-library soundscape-studio">
            <div className="soundscape-master-bar">
              <div className="soundscape-master-info">
                <button
                  type="button"
                  className={`soundscape-power-btn ${ambientAudible ? 'is-playing' : ''}`}
                  onClick={toggleSoundscapePlaying}
                  aria-label={ambientAudible ? 'Pause ambient soundscape' : 'Play ambient soundscape'}
                >
                  {ambientAudible ? (
                    <Pause size={16} fill="currentColor" />
                  ) : (
                    <Play size={16} fill="currentColor" />
                  )}
                </button>
                <div>
                  <span className="eyebrow">
                    {ambientAudible
                      ? 'Layered Web Audio · Active underneath Music'
                      : 'Procedural Web Audio · Zero network lag'}
                  </span>
                  <h3>
                    {activeAmbientCount > 0
                      ? describeActiveSoundscape(soundscape)
                      : 'Blend rain, vinyl dust, fire & brown noise'}
                  </h3>
                </div>
              </div>

              <div className="soundscape-master-controls">
                <label className="music-volume-group" aria-label="Master ambient volume">
                  <Volume2 size={15} />
                  <input
                    type="range"
                    className="music-volume-slider"
                    min={0}
                    max={100}
                    value={soundscape.masterVolume}
                    onChange={e => setSoundscapeMasterVolume(Number(e.target.value))}
                  />
                  <span className="music-vol-pct">{soundscape.masterVolume}%</span>
                </label>
                {activeAmbientCount > 0 && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      clearSoundscapeLevels();
                      showFeedback('Cleared ambient faders');
                    }}
                  >
                    <RotateCcw size={12} /> Reset
                  </button>
                )}
              </div>
            </div>

            {/* Atmosphere Presets & User Saved Mixes */}
            <div className="soundscape-presets-block">
              <div className="music-section-heading">
                <div>
                  <span className="eyebrow">1-Click Atmospheres</span>
                  <h3>Focus presets &amp; saved mixes</h3>
                </div>
                <form
                  className="music-pl-create-bar"
                  onSubmit={e => {
                    e.preventDefault();
                    const created = saveCustomSoundscapeMix(newMixName);
                    if (!created) return;
                    setNewMixName('');
                    showFeedback(`Saved mix "${created.name}"`);
                  }}
                >
                  <input
                    value={newMixName}
                    onChange={e => setNewMixName(e.target.value)}
                    placeholder="Save active faders as…"
                    aria-label="Custom soundscape mix name"
                  />
                  <button
                    type="submit"
                    className="secondary-btn"
                    disabled={!newMixName.trim() || activeAmbientCount === 0}
                  >
                    <Plus size={12} /> Save mix
                  </button>
                </form>
              </div>

              <div className="soundscape-preset-grid">
                {allSoundscapePresets.map(preset => {
                  const isActivePreset =
                    soundscape.activePresetId === preset.id && ambientAudible;
                  return (
                    <div
                      key={preset.id}
                      className={`soundscape-preset-card ${isActivePreset ? 'is-active' : ''}`}
                    >
                      <button
                        type="button"
                        className="soundscape-preset-trigger"
                        onClick={() => applySoundscapePreset(preset.id)}
                      >
                        <strong>{preset.name}</strong>
                        <small>{preset.subtitle}</small>
                      </button>
                      {!preset.isBuiltIn && (
                        <button
                          type="button"
                          className="icon-btn soundscape-preset-del"
                          onClick={() => {
                            deleteCustomSoundscapeMix(preset.id);
                            showFeedback(`Removed mix "${preset.name}"`);
                          }}
                          title={`Delete ${preset.name}`}
                          aria-label={`Delete mix ${preset.name}`}
                        >
                          <Trash2 size={12} />
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* 6 Individual Procedural Channel Faders */}
            <div className="soundscape-channels-block">
              <div className="music-section-heading">
                <div>
                  <span className="eyebrow">Individual Channels</span>
                  <h3>Procedural soundscape faders</h3>
                </div>
                <span className="yt-count-label">
                  {activeAmbientCount} of {SOUNDSCAPE_CHANNELS.length} active
                </span>
              </div>

              <div className="soundscape-channels-grid">
                {SOUNDSCAPE_CHANNELS.map(ch => {
                  const Icon = SOUNDSCAPE_CHANNEL_ICONS[ch.id];
                  const level = soundscape.levels[ch.id];
                  const isChannelActive = level > 0;
                  return (
                    <div
                      key={ch.id}
                      className={`soundscape-channel-card ${
                        isChannelActive ? 'is-active' : ''
                      }`}
                    >
                      <div className="sc-channel-top">
                        <button
                          type="button"
                          className={`sc-channel-icon-btn ${
                            isChannelActive ? 'is-lit' : ''
                          }`}
                          onClick={() => toggleSoundscapeLayer(ch.id)}
                          title={isChannelActive ? `Mute ${ch.name}` : `Enable ${ch.name}`}
                          aria-label={isChannelActive ? `Mute ${ch.name}` : `Enable ${ch.name}`}
                          aria-pressed={isChannelActive}
                        >
                          <Icon size={16} />
                        </button>
                        <div className="sc-channel-copy">
                          <strong>{ch.name}</strong>
                          <small>{ch.subtitle}</small>
                        </div>
                        <span className="sc-channel-pct">
                          {isChannelActive ? `${level}%` : 'Off'}
                        </span>
                      </div>

                      <input
                        type="range"
                        className="sc-channel-slider"
                        min={0}
                        max={100}
                        value={level}
                        onChange={e => setSoundscapeLayerLevel(ch.id, Number(e.target.value))}
                        aria-label={`${ch.name} volume`}
                      />
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {tab === 'queue' && (
          <section className="music-library">
            <div className="music-section-heading">
              <div>
                <span className="eyebrow">Playback order</span>
                <h3>Up next queue</h3>
              </div>
              <span className="yt-count-label">{music.queue.length} in queue</span>
            </div>
            <div className="music-queue-list">
              {music.queue.map((track, idx) => (
                <div
                  key={track.id}
                  className={`music-queue-row ${current?.id === track.id ? 'is-active' : ''}`}
                >
                  <span className="music-queue-index">{idx + 1}</span>
                  <button
                    type="button"
                    className="music-queue-main"
                    onClick={() => playMusicTrack(track, music.queue)}
                  >
                    <strong>{track.title}</strong>
                    <small>
                      {[track.channelTitle, track.duration].filter(Boolean).join(' · ')}
                    </small>
                  </button>
                  <div className="music-queue-actions">
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={idx === 0}
                      onClick={() => moveQueueTrack(idx, -1)}
                      title="Move up"
                      aria-label={`Move ${track.title} up`}
                    >
                      <ChevronUp size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      disabled={idx === music.queue.length - 1}
                      onClick={() => moveQueueTrack(idx, 1)}
                      title="Move down"
                      aria-label={`Move ${track.title} down`}
                    >
                      <ChevronDown size={13} />
                    </button>
                    <button
                      type="button"
                      className="icon-btn"
                      onClick={() => removeQueueTrack(track.id)}
                      title="Remove from queue"
                      aria-label={`Remove ${track.title} from queue`}
                    >
                      <X size={13} />
                    </button>
                  </div>
                </div>
              ))}
              {!music.queue.length && (
                <p className="music-empty">Your playback queue is empty. Pick a starter stream or search above.</p>
              )}
            </div>
          </section>
        )}

        {tab === 'liked' && (
          <section className="music-library">
            <div className="music-section-heading">
              <div>
                <span className="eyebrow">Saved favorites</span>
                <h3>Liked songs</h3>
              </div>
              {music.liked.length > 0 && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => playMusicTrack(music.liked[0], music.liked)}
                >
                  <Play size={12} fill="currentColor" /> Play all
                </button>
              )}
            </div>
            <div className="music-track-grid">
              {music.liked.map(track => (
                <MusicTrackRow
                  key={track.id}
                  track={track}
                  isActive={current?.id === track.id}
                  isLiked={true}
                  onPlay={() => playMusicTrack(track, music.liked)}
                  onQueueNext={() => {
                    enqueueTrackNext(track);
                    showFeedback('Queued to play next');
                  }}
                  onToggleLike={() => toggleMusicTrackLiked(track)}
                />
              ))}
            </div>
            {!music.liked.length && (
              <p className="music-empty">Tap the heart icon on any track or stream to save it here.</p>
            )}
          </section>
        )}

        {tab === 'playlists' && (
          <section className="music-library">
            <div className="music-section-heading">
              <div>
                <span className="eyebrow">Custom collections</span>
                <h3>Playlists</h3>
              </div>
              <form className="music-pl-create-bar" onSubmit={handleCreatePlaylist}>
                <input
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  placeholder="New playlist title…"
                  aria-label="Create new playlist"
                />
                <button type="submit" className="secondary-btn" disabled={!newPlaylistName.trim()}>
                  <Plus size={12} /> New playlist
                </button>
              </form>
            </div>

            {music.playlists.length > 0 ? (
              <div className="music-playlists-layout">
                <aside className="music-pl-sidebar">
                  {music.playlists.map(pl => (
                    <button
                      key={pl.id}
                      type="button"
                      className={`music-pl-nav-btn ${activePlaylist?.id === pl.id ? 'is-active' : ''}`}
                      onClick={() => setSelectedPlaylistId(pl.id)}
                    >
                      <strong>{pl.name}</strong>
                      <small>{pl.tracks.length} tracks</small>
                    </button>
                  ))}
                </aside>

                {activePlaylist && (
                  <div className="music-pl-detail">
                    <div className="music-pl-detail-head">
                      <div>
                        <h4>{activePlaylist.name}</h4>
                        <span className="yt-count-label">{activePlaylist.tracks.length} tracks</span>
                      </div>
                      <div className="music-pl-detail-actions">
                        {current && !activePlaylist.tracks.some(t => t.id === current.id) && (
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => {
                              addTrackToMusicPlaylist(activePlaylist.id, current);
                              showFeedback(`Added current track to "${activePlaylist.name}"`);
                            }}
                          >
                            <Plus size={12} /> Add playing track
                          </button>
                        )}
                        <button
                          type="button"
                          className="primary-btn"
                          disabled={activePlaylist.tracks.length === 0}
                          onClick={() => playMusicPlaylist(activePlaylist.id)}
                        >
                          <Play size={12} fill="currentColor" /> Play playlist
                        </button>
                        <button
                          type="button"
                          className="settings-action danger"
                          onClick={() => deleteMusicPlaylist(activePlaylist.id)}
                          aria-label={`Delete playlist ${activePlaylist.name}`}
                        >
                          <Trash2 size={13} />
                        </button>
                      </div>
                    </div>

                    <div className="music-queue-list">
                      {activePlaylist.tracks.map((track, idx) => (
                        <div
                          key={track.id}
                          className={`music-queue-row ${current?.id === track.id ? 'is-active' : ''}`}
                        >
                          <span className="music-queue-index">{idx + 1}</span>
                          <button
                            type="button"
                            className="music-queue-main"
                            onClick={() => playMusicTrack(track, activePlaylist.tracks)}
                          >
                            <strong>{track.title}</strong>
                            <small>{track.channelTitle}</small>
                          </button>
                          <button
                            type="button"
                            className="icon-btn"
                            onClick={() => removeTrackFromMusicPlaylist(activePlaylist.id, track.id)}
                            title="Remove from playlist"
                            aria-label={`Remove ${track.title} from ${activePlaylist.name}`}
                          >
                            <X size={13} />
                          </button>
                        </div>
                      ))}
                      {activePlaylist.tracks.length === 0 && (
                        <p className="music-empty">
                          No tracks in this playlist yet. Use “+ Playlist” on any playing track.
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="music-empty">
                Create a playlist above to group tracks for deep work, reading, or late-night sessions.
              </p>
            )}
          </section>
        )}

        {tab === 'history' && (
          <section className="music-library">
            <div className="music-section-heading">
              <div>
                <span className="eyebrow">Your library</span>
                <h3>Recently played</h3>
              </div>
              {music.history.length > 0 && (
                <button type="button" className="music-clear" onClick={clearMusicHistory}>
                  Clear history
                </button>
              )}
            </div>
            <div className="music-track-grid">
              {music.history.map(track => (
                <MusicTrackRow
                  key={track.id}
                  track={track}
                  isActive={current?.id === track.id}
                  isLiked={likedIds.has(track.id)}
                  onPlay={() => playMusicTrack(track, music.history)}
                  onQueueNext={() => {
                    enqueueTrackNext(track);
                    showFeedback('Queued to play next');
                  }}
                  onToggleLike={() => toggleMusicTrackLiked(track)}
                />
              ))}
            </div>
            {!music.history.length && (
              <p className="music-empty">Your recently played music will appear here.</p>
            )}
          </section>
        )}
      </main>

      <footer className="web-app-footer">
        <span>Background audio continues in the desktop Now Playing bar when minimized or closed.</span>
      </footer>
    </div>
  );
}

function MusicTrackRow({
  track,
  isActive,
  isLiked,
  onPlay,
  onQueueNext,
  onToggleLike,
}: {
  track: MediaTrack;
  isActive: boolean;
  isLiked: boolean;
  onPlay: () => void;
  onQueueNext: () => void;
  onToggleLike: () => void;
}) {
  const [imgFailed, setImgFailed] = useState(false);
  return (
    <div className={`music-track-card ${isActive ? 'is-active' : ''}`}>
      <button type="button" className="music-track-card-play" onClick={onPlay}>
        {track.thumbnail && !imgFailed ? (
          <img
            src={track.thumbnail}
            alt=""
            referrerPolicy="no-referrer"
            onError={() => setImgFailed(true)}
          />
        ) : (
          <div className="music-thumb-fallback"><Headphones size={18} /></div>
        )}
        <span>
          <strong>{track.title}</strong>
          <small>
            {[track.channelTitle, track.duration, track.viewCount].filter(Boolean).join(' · ')}
          </small>
        </span>
      </button>
      <div className="music-track-card-actions">
        <button
          type="button"
          className={`music-card-icon-btn ${isLiked ? 'is-liked' : ''}`}
          onClick={onToggleLike}
          title={isLiked ? 'Remove from Liked songs' : 'Like track'}
          aria-label={isLiked ? `Unlike ${track.title}` : `Like ${track.title}`}
        >
          <Heart size={12} fill={isLiked ? 'currentColor' : 'none'} />
        </button>
        <button
          type="button"
          className="music-card-icon-btn"
          onClick={onQueueNext}
          title="Play next in queue"
          aria-label={`Play ${track.title} next`}
        >
          <Plus size={13} />
        </button>
      </div>
    </div>
  );
}

function YouTubeVideoCard({
  item,
  activeId,
  isSavedLater,
  onPlay,
  onToggleWatchLater,
  onListenInMusic,
}: {
  item: MediaTrack;
  activeId?: string;
  isSavedLater: boolean;
  onPlay: (item: MediaTrack) => void;
  onToggleWatchLater: (item: MediaTrack) => void;
  onListenInMusic: (item: MediaTrack) => void;
}) {
  const [thumbFailed, setThumbFailed] = useState(false);
  const subline = [item.channelTitle, item.viewCount].filter(Boolean).join(' · ');

  return (
    <article className={`youtube-video-card ${activeId === item.id ? 'is-active' : ''}`}>
      <button type="button" className="yt-card-trigger" onClick={() => onPlay(item)}>
        <span className="yt-thumb-wrap">
          {item.thumbnail && !thumbFailed ? (
            <img
              src={item.thumbnail}
              alt=""
              referrerPolicy="no-referrer"
              onError={() => setThumbFailed(true)}
            />
          ) : (
            <span className="youtube-thumb-fallback"><Play size={16} /></span>
          )}
          {item.duration && <span className="yt-duration-badge">{item.duration}</span>}
        </span>
        <span className="yt-card-meta">
          <strong>{item.title}</strong>
          <small>{subline}</small>
        </span>
      </button>
      <div className="yt-card-quick-actions">
        <button
          type="button"
          className={`yt-card-mini-btn ${isSavedLater ? 'is-saved' : ''}`}
          onClick={() => onToggleWatchLater(item)}
          title={isSavedLater ? 'Saved in Watch later' : 'Save to Watch later'}
          aria-label={isSavedLater ? `Remove ${item.title} from Watch later` : `Save ${item.title} to Watch later`}
        >
          {isSavedLater ? <Check size={11} /> : <Bookmark size={11} />}
        </button>
        <button
          type="button"
          className="yt-card-mini-btn"
          onClick={() => onListenInMusic(item)}
          title="Listen in Music"
          aria-label={`Listen to ${item.title} in Music`}
        >
          <Headphones size={11} />
        </button>
      </div>
    </article>
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
  const music = useSyncExternalStore(subscribeMusicState, getMusicState);
  const [section, setSection] = useState<'appearance' | 'spaces' | 'desktop' | 'messages' | 'privacy' | 'backup'>(
    () => settings.initialSection ?? 'appearance'
  );
  const [backupNotice, setBackupNotice] = useState<{ kind: 'success' | 'error'; text: string } | null>(null);
  const [confirmFactoryReset, setConfirmFactoryReset] = useState(false);
  const [confirmResetSpaces, setConfirmResetSpaces] = useState(false);
  const [confirmDeleteSpaceId, setConfirmDeleteSpaceId] = useState<string | null>(null);
  const importInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (settings.initialSection) {
      setSection(settings.initialSection);
      settings.onInitialSectionConsumed?.();
    }
  }, [settings]);

  const nav = [
    { id: 'appearance' as const, label: 'Appearance', Icon: Palette, detail: 'Theme and wallpaper' },
    { id: 'spaces' as const, label: 'Spaces', Icon: Layers, detail: 'Context workspaces' },
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

        {section === 'spaces' && (
          <section className="settings-group settings-panel">
            <div className="settings-group-heading settings-spaces-heading">
              <div>
                <strong>Desktop Spaces</strong>
                <span>
                  Switch between focused contexts in one click from the Dock or with Alt + 1–{(settings.spaces ?? []).length || 3}
                </span>
              </div>
              <div className="settings-row-actions">
                {settings.onResetSpaces && (
                  confirmResetSpaces ? (
                    <>
                      <button
                        type="button"
                        className="settings-action"
                        onClick={() => setConfirmResetSpaces(false)}
                      >
                        Cancel
                      </button>
                      <button
                        type="button"
                        className="settings-action danger"
                        onClick={() => {
                          settings.onResetSpaces?.();
                          setConfirmResetSpaces(false);
                        }}
                      >
                        Confirm reset
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={() => setConfirmResetSpaces(true)}
                    >
                      <RotateCcw size={12} /> Restore starter spaces
                    </button>
                  )
                )}
                {settings.onCreateSpace && (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={settings.onCreateSpace}
                    disabled={(settings.spaces?.length ?? 0) >= MAX_SPACES}
                  >
                    <Plus size={12} /> New space
                  </button>
                )}
              </div>
            </div>

            <div className="settings-spaces-list">
              {(settings.spaces ?? []).map((sp, idx) => {
                const isActive = sp.id === settings.activeSpaceId;
                const wallpaperNames: Record<string, string> = {
                  mist: 'Soft mist',
                  aurora: 'Aurora',
                  dusk: 'Warm dusk',
                  forest: 'Forest',
                  ocean: 'Ocean glass',
                  ember: 'Ember',
                  lavender: 'Lavender haze',
                  midnight: 'Midnight',
                  rose: 'Rosewater',
                  mono: 'Monochrome',
                  citrus: 'Citrus',
                  glacier: 'Glacier',
                };
                const wpLabel = wallpaperNames[sp.wallpaper] ?? sp.wallpaper;
                const summary = describeSpaceSummary(sp, wpLabel, music.playlists);

                return (
                  <div
                    key={sp.id}
                    className={`settings-space-item ${isActive ? 'is-active' : ''}`}
                  >
                    <div className="settings-space-top">
                      <div className="settings-space-id">
                        <span className={`space-index-tile swatch-${sp.wallpaper}`}>
                          <span>{idx + 1}</span>
                        </span>
                        <div className="settings-space-meta">
                          <div className="settings-space-title-line">
                            <input
                              type="text"
                              className="settings-space-name-input"
                              value={sp.name}
                              maxLength={40}
                              aria-label={`Space ${idx + 1} name`}
                              onChange={e => settings.onUpdateSpace?.(sp.id, { name: e.target.value })}
                            />
                            <span className="settings-meta-note">Alt + {idx + 1}</span>
                          </div>
                          <span>{summary}</span>
                        </div>
                      </div>

                      <div className="settings-row-actions">
                        {isActive ? (
                          <span className="settings-meta-note">Active space</span>
                        ) : (
                          <>
                            <button
                              type="button"
                              className="secondary-btn"
                              onClick={() => settings.onCaptureCurrentIntoSpace?.(sp.id)}
                              title="Save currently open windows into this space"
                            >
                              <Copy size={12} /> Capture windows
                            </button>
                            <button
                              type="button"
                              className="settings-action"
                              onClick={() => settings.onSwitchSpace?.(sp.id)}
                            >
                              Switch
                            </button>
                          </>
                        )}
                        {(settings.spaces?.length ?? 0) > 1 && (
                          <button
                            type="button"
                            className="settings-action danger"
                            onClick={() => {
                              if (confirmDeleteSpaceId === sp.id) {
                                settings.onDeleteSpace?.(sp.id);
                                setConfirmDeleteSpaceId(null);
                              } else {
                                setConfirmDeleteSpaceId(sp.id);
                              }
                            }}
                            aria-label={`Delete ${sp.name}`}
                          >
                            {confirmDeleteSpaceId === sp.id ? 'Confirm?' : <Trash2 size={12} />}
                          </button>
                        )}
                      </div>
                    </div>

                    <div className="settings-space-controls">
                      <label className="settings-space-field">
                        <span>Wallpaper</span>
                        <select
                          value={sp.wallpaper}
                          onChange={e =>
                            settings.onUpdateSpace?.(sp.id, {
                              wallpaper: e.target.value as SettingsProps['wallpaper'],
                            })
                          }
                          aria-label={`Wallpaper for ${sp.name}`}
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
                      </label>

                      <label className="settings-space-field">
                        <span>Linked audio</span>
                        <select
                          value={serializeAudioRuleValue(sp.audioRule)}
                          onChange={e =>
                            settings.onUpdateSpace?.(sp.id, {
                              audioRule: parseAudioRuleValue(e.target.value),
                            })
                          }
                          aria-label={`Audio rule for ${sp.name}`}
                        >
                          <option value="keep">Keep current audio</option>
                          <option value="pause">Pause desktop music</option>
                          <optgroup label="24/7 Focus Streams">
                            {STARTER_MUSIC_STREAMS.map(stream => (
                              <option key={stream.id} value={`stream:${stream.id}`}>
                                {stream.title}
                              </option>
                            ))}
                          </optgroup>
                          {music.playlists.length > 0 && (
                            <optgroup label="Your Playlists">
                              {music.playlists.map(pl => (
                                <option key={pl.id} value={`playlist:${pl.id}`}>
                                  {pl.name} ({pl.tracks.length})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </label>
                    </div>

                    {settings.widgets.length > 0 && (
                      <div className="settings-space-widgets">
                        <span>Desktop widgets in {sp.name}</span>
                        <div className="space-widget-toggles">
                          {settings.widgets.map(w => {
                            const vis = isWidgetVisibleInSpace(w, sp);
                            return (
                              <button
                                key={w.id}
                                type="button"
                                className={`space-widget-toggle ${vis ? 'is-on' : ''}`}
                                onClick={() => settings.onToggleWidgetInSpace?.(sp.id, w.id, !vis)}
                                aria-pressed={vis}
                              >
                                {vis ? <Check size={11} /> : null}
                                <span>{w.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
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

const VALID_CORE_APP_IDS: CoreAppId[] = ['browser', 'youtube', 'music', 'notes', 'bookmarks', 'settings', 'widgets'];

const API_CATEGORIES: readonly ('All' | ApiReferenceCategory)[] = [
  'All',
  'Core',
  'Music',
  'Lifecycle',
  'Theme',
  'Storage',
  'Navigation',
  'NEXUS.notes',
  'NEXUS.shortcuts',
  'NEXUS.dayline',
];

function openExternalUrlSafe(url: string): void {
  const link = document.createElement('a');
  link.href = url;
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}

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
  const [apiCategory, setApiCategory] = useState<'All' | ApiReferenceCategory>('All');
  const [apiQuery, setApiQuery] = useState('');
  const [crafterPrompt, setCrafterPrompt] = useState('');
  const [crafterBusy, setCrafterBusy] = useState(false);
  const [crafterError, setCrafterError] = useState('');
  const [crafterHistory, setCrafterHistory] = useState<WidgetCrafterMessage[]>([]);

  useEffect(() => {
    if (!editingId || !settings.widgets.some(w => w.id === editingId)) {
      setEditingId(settings.widgets[0]?.id ?? null);
    }
  }, [settings.widgets, editingId]);

  useEffect(() => {
    setConfirmDeleteId(null);
  }, [editingId, tab]);

  useEffect(() => {
    if (!editingId) {
      setCrafterHistory([]);
      return;
    }
    try {
      const raw = localStorage.getItem(`nexus.widget-crafter.v1.${editingId}`);
      const parsed = raw ? JSON.parse(raw) : [];
      setCrafterHistory(Array.isArray(parsed)
        ? parsed.filter((item): item is WidgetCrafterMessage =>
            item && (item.role === 'user' || item.role === 'assistant') && typeof item.content === 'string'
          ).slice(-24)
        : []);
    } catch {
      setCrafterHistory([]);
    }
  }, [editingId]);

  useEffect(() => {
    if (!editingId) return;
    try {
      localStorage.setItem(`nexus.widget-crafter.v1.${editingId}`, JSON.stringify(crafterHistory.slice(-24)));
    } catch {
      /* Keep the active conversation available in memory if storage is unavailable. */
    }
  }, [crafterHistory, editingId]);

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

  const sendCrafterMessage = async () => {
    if (!selected || crafterBusy || !crafterPrompt.trim()) return;
    const request = crafterPrompt.trim();
    const nextHistory: WidgetCrafterMessage[] = [...crafterHistory, { role: 'user', content: request }];
    setCrafterPrompt('');
    setCrafterHistory(nextHistory);
    setCrafterBusy(true);
    setCrafterError('');
    try {
      const generated = await generateWidgetWithPuter(request, crafterHistory, selected.source);
      updateSelected({
        name: generated.name,
        source: generated.source,
        bounds: { ...selected.bounds, width: generated.width, height: generated.height },
      });
      setCrafterHistory([
        ...nextHistory,
        { role: 'assistant', content: `Updated ${generated.name}. Review the code and preview, then tell me what to change next.` },
      ]);
    } catch (error: unknown) {
      setCrafterError(error instanceof Error ? error.message : 'Could not update the widget.');
      setCrafterHistory(nextHistory);
    } finally {
      setCrafterBusy(false);
    }
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

  const filteredApiEntries = useMemo(() => {
    const q = apiQuery.trim().toLowerCase();
    return WIDGET_API_ENTRIES.filter(entry => {
      if (apiCategory !== 'All' && entry.category !== apiCategory) return false;
      if (!q) return true;
      return `${entry.category} ${entry.title} ${entry.signature} ${entry.description} ${entry.snippet}`
        .toLowerCase()
        .includes(q);
    });
  }, [apiCategory, apiQuery]);

  const musicApiCount = useMemo(
    () => WIDGET_API_ENTRIES.filter(e => e.category === 'Music').length,
    []
  );

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
            {/* Pane A: File tree */}
            <aside className="ws-file-tree" aria-label="Widget files">
              <span className="ws-pane-label">Files</span>
              <strong className="ws-tree-widget-name">{selected.name}</strong>
              <div className="ws-tree-files">
                {SOURCE_FILES.map(file => (
                  <button
                    key={file.key}
                    type="button"
                    className={`ws-tree-file ${activeFile === file.key ? 'is-active' : ''}`}
                    onClick={() => setActiveFile(file.key)}
                  >
                    <span className={`ws-file-dot ws-file-dot-${file.key}`} />
                    {file.label}
                  </button>
                ))}
              </div>
              <span className="ws-tree-hint">Editable sandbox source</span>
            </aside>

            {/* Pane B: Code Editor */}
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

            {/* Pane C: Live widget preview + placement */}
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
                          onOpenUrl={openExternalUrlSafe}
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

            {/* Pane D: Conversational AI crafter */}
            <aside className="ws-chat-pane" aria-label="AI widget crafter">
              <div className="ws-chat-header">
                <div>
                  <span className="eyebrow"><Sparkles size={12} /> AI Crafter</span>
                  <strong>Keep shaping this widget</strong>
                </div>
                <span className="ws-crafter-provider">Puter</span>
              </div>
              <div className="ws-chat-history" aria-live="polite">
                {crafterHistory.length === 0 && (
                  <div className="ws-chat-empty">
                    <Sparkles size={20} />
                    <strong>What should change?</strong>
                    <span>Ask for a visual tweak, a new interaction, or an API-powered feature.</span>
                  </div>
                )}
                {crafterHistory.map((message, index) => (
                  <div key={`${message.role}-${index}`} className={`ws-chat-message is-${message.role}`}>
                    <span>{message.role === 'user' ? 'You' : 'Puter AI'}</span>
                    <p>{message.content}</p>
                  </div>
                ))}
                {crafterBusy && <div className="ws-chat-thinking"><Sparkles size={12} /> Updating source and preview…</div>}
              </div>
              <form
                className="ws-chat-form"
                onSubmit={event => {
                  event.preventDefault();
                  void sendCrafterMessage();
                }}
              >
                <textarea
                  value={crafterPrompt}
                  onChange={event => {
                    setCrafterPrompt(event.target.value);
                    if (crafterError) setCrafterError('');
                  }}
                  placeholder="Make the buttons larger and add NEXUS.music play/pause…"
                  rows={3}
                  maxLength={1000}
                  aria-label="Message AI widget crafter"
                />
                <button type="submit" className="primary-btn" disabled={crafterBusy || !crafterPrompt.trim()}>
                  <Sparkles size={13} /> {crafterBusy ? 'Working…' : 'Send'}
                </button>
                {crafterError && <p className="inline-error">{crafterError}</p>}
              </form>
            </aside>
          </div>
        )
      )}

      {/* ── VIEW 2: LIBRARY & STARTER TEMPLATES ── */}
      {tab === 'library' && (
        <div className="ws-scroll-page ws-library-page">
          <section className="ws-library-hero">
            <div>
              <span className="eyebrow">Widget Studio</span>
              <h2>Build your calm little tools.</h2>
              <p>Start from a template, import a widget, or open the Workbench and ask AI to craft one.</p>
            </div>
            <div className="ws-library-hero-actions">
              <button type="button" className="primary-btn" onClick={createBlank}><Plus size={13} /> Blank widget</button>
              <button type="button" className="secondary-btn" onClick={() => setTab('api')}><Code2 size={13} /> Browse APIs</button>
            </div>
          </section>
          <div className="ws-library-stats">
            <div><strong>{settings.widgets.length}</strong><span>Installed</span></div>
            <div><strong>{settings.widgets.filter(widget => widget.visible).length}</strong><span>On desktop</span></div>
            <div><strong>{WIDGET_TEMPLATES.length}</strong><span>Starter templates</span></div>
            <div><strong>{WIDGET_API_ENTRIES.length}</strong><span>Host APIs</span></div>
          </div>
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
              <div className="ws-library-list ws-library-grid">
                {settings.widgets.map(widget => (
                  <div className="ws-library-row ws-library-card" key={widget.id}>
                    <div className="ws-library-preview" aria-label={`${widget.name} preview`}>
                      <WidgetRuntime
                        widget={widget}
                        theme={settings.theme}
                        onOpenApp={appId => {
                          if (
                            settings.onOpenApp &&
                            (VALID_CORE_APP_IDS.includes(appId as CoreAppId) || isShortcutAppId(appId))
                          ) {
                            settings.onOpenApp(appId as AppId);
                          }
                        }}
                        onOpenUrl={openExternalUrlSafe}
                      />
                    </div>
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

            <div className="ws-template-grid ws-template-grid-featured">
              {WIDGET_TEMPLATES.map(tpl => (
                <article className="ws-template-card" key={tpl.id}>
                  <div className="ws-template-icon"><Sparkles size={16} /></div>
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
        <div className="ws-scroll-page ws-api-page">
          <section className="ws-section">
            <div className="ws-section-head">
              <div>
                <span className="eyebrow">Host Bridge · window.NEXUS</span>
                <h3>Widget API Reference</h3>
              </div>
            </div>

            <p className="ws-lead">
              Every widget runs inside an isolated iframe with <code>window.NEXUS</code> pre-injected.
              Configuration from <code>widget.json</code> is available synchronously on <code>NEXUS.data</code>,
              and live desktop audio state &amp; transport controls are exposed on <code>NEXUS.music</code>.
            </p>
            <div className="ws-api-contract">
              <div><strong>Sandbox first</strong><span>Widgets use host-mediated APIs; no direct parent access.</span></div>
              <div><strong>Theme ready</strong><span>Support <code>body[data-theme="dark"]</code> and <code>nexus:theme</code>.</span></div>
              <div><strong>Async bridges</strong><span>Notes and Saved Links return Promises across the iframe boundary.</span></div>
            </div>

            <div className="ws-api-toolbar">
              <div className="ws-seg ws-api-cats" role="group" aria-label="Filter API categories">
                {API_CATEGORIES.map(cat => (
                  <button
                    key={cat}
                    type="button"
                    className={apiCategory === cat ? 'is-active' : ''}
                    onClick={() => setApiCategory(cat)}
                  >
                    {cat === 'All'
                      ? `All · ${WIDGET_API_ENTRIES.length}`
                      : cat === 'Music'
                        ? `Music · ${musicApiCount}`
                        : cat}
                  </button>
                ))}
              </div>

              <label className="sl-search ws-api-search">
                <Search size={13} />
                <input
                  value={apiQuery}
                  onChange={e => setApiQuery(e.target.value)}
                  placeholder="Filter methods (e.g. music, setVolume, playStream)…"
                  aria-label="Search Widget API Reference"
                />
                {apiQuery && (
                  <button
                    type="button"
                    className="sl-search-clear"
                    onClick={() => setApiQuery('')}
                    aria-label="Clear API filter"
                  >
                    <X size={11} />
                  </button>
                )}
              </label>
            </div>

            {filteredApiEntries.length === 0 ? (
              <div className="ws-inline-empty">
                <p>No API entries match your current filter.</p>
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => {
                    setApiCategory('All');
                    setApiQuery('');
                  }}
                >
                  Reset filter
                </button>
              </div>
            ) : (
              <div className="ws-api-list ws-api-grid">
                {filteredApiEntries.map(entry => (
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
            )}
          </section>
        </div>
      )}
    </div>
  );
}