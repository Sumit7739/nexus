import { useEffect, useMemo, useRef, useState } from 'react';
import {
  dispatchWidgetMusicCommand,
  getWidgetMusicSnapshot,
  subscribeMusicState,
} from '../data/media';
import { subscribeSoundscapeState } from '../data/soundscape';
import { openStashShelf, stashItem } from '../data/stash';
import { readNotesState, saveNotesState, toggleChecklistLine } from '../data/notes';
import { readShortcuts } from '../data/shortcuts';
import { getDaylineDate, readDaylineState, saveDaylineState } from '../data/dayline';
import type { WidgetDefinition } from './types';
import { parseWidgetJson } from './types';

interface Props {
  widget: WidgetDefinition;
  theme: 'light' | 'dark';
  onOpenApp: (appId: string) => void;
  onOpenUrl: (url: string) => void;
}

function readWidgetState(widgetId: string): unknown {
  try {
    const raw = localStorage.getItem(`nexus.widget-state.${widgetId}`);
    return raw === null ? null : JSON.parse(raw);
  } catch {
    return null;
  }
}

function readWidgetLocal(widgetId: string): Record<string, unknown> {
  try {
    const value: unknown = JSON.parse(localStorage.getItem('nexus.widget-local.' + widgetId) || '{}');
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : {};
  } catch {
    return {};
  }
}

function buildDocument(widget: WidgetDefinition, theme: 'light' | 'dark') {
  const payload = JSON.stringify(parseWidgetJson(widget.source.json)).replace(/</g, '\\u003c');
  const savedState = JSON.stringify(readWidgetState(widget.id)).replace(/</g, '\\u003c');
  const initialLocal = JSON.stringify(readWidgetLocal(widget.id)).replace(/</g, '\\u003c');
  const initialMusic = JSON.stringify(getWidgetMusicSnapshot()).replace(/</g, '\\u003c');
  const script = widget.source.js.replace(/<\/script/gi, '<\\\\/script');
  const safeTheme = theme === 'dark' ? 'dark' : 'light';
  return `<!doctype html><html data-theme="${safeTheme}"><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${widget.source.css}</style></head><body data-theme="${safeTheme}">${widget.source.html}<script>
const NEXUS_DATA = ${payload};
let NEXUS_STATE = ${savedState};
let NEXUS_THEME = ${JSON.stringify(theme)};
let NEXUS_LOCAL = ${initialLocal};
let NEXUS_MUSIC = ${initialMusic};
const sendMusicCmd = (action, cmdPayload) => parent.postMessage({ type: 'nexus:music-cmd', action, payload: cmdPayload }, '*');
const pendingHostRequests = new Map();
const requestHost = (type, payload) => new Promise((resolve) => {
  const requestId = Math.random().toString(36).slice(2);
  pendingHostRequests.set(requestId, resolve);
  parent.postMessage({ type, requestId, payload }, '*');
});
const NEXUS = {
  data: NEXUS_DATA,
  getState: () => NEXUS_STATE,
  time: () => parent.postMessage({ type: 'nexus:read-time' }, '*'),
  getTheme: () => NEXUS_THEME,
  setTheme: (theme) => parent.postMessage({ type: 'nexus:set-theme', theme }, '*'),
  getLocal: (key) => Object.prototype.hasOwnProperty.call(NEXUS_LOCAL, key) ? NEXUS_LOCAL[key] : null,
  getAllLocal: () => ({ ...NEXUS_LOCAL }),
  setLocal: (key, value) => parent.postMessage({ type: 'nexus:set-local', key, value }, '*'),
  removeLocal: (key) => parent.postMessage({ type: 'nexus:remove-local', key }, '*'),
  openApp: (appId) => parent.postMessage({ type: 'nexus:open-app', appId }, '*'),
  openUrl: (url) => parent.postMessage({ type: 'nexus:open-url', url }, '*'),
  stash: (content, options) => parent.postMessage({ type: 'nexus:stash', content, title: options && typeof options === 'object' ? options.title : undefined }, '*'),
  openStash: () => parent.postMessage({ type: 'nexus:open-stash' }, '*'),
  notes: {
    list: () => requestHost('nexus:notes-read'),
    toggleTask: (noteId, lineIndex) => requestHost('nexus:notes-toggle-task', { noteId, lineIndex }),
  },
  shortcuts: {
    list: () => requestHost('nexus:shortcuts-read'),
    open: (id) => requestHost('nexus:shortcut-open', { id }),
  },
  dayline: {
    getState: () => requestHost('nexus:dayline-read'),
    addBlock: (hour, task) => requestHost('nexus:dayline-add-block', { hour, task }),
    updateBlock: (hour, task) => requestHost('nexus:dayline-update-block', { hour, task }),
    toggleBlock: (hour) => requestHost('nexus:dayline-toggle-block', { hour }),
  },
  notify: (message) => parent.postMessage({ type: 'nexus:notify', message }, '*'),
  setState: (state) => { NEXUS_STATE = state; parent.postMessage({ type: 'nexus:set-state', state }, '*'); },
  getMusic: () => NEXUS_MUSIC,
  music: {
    getState: () => NEXUS_MUSIC,
    refresh: () => parent.postMessage({ type: 'nexus:music-read' }, '*'),
    onChange: (callback) => {
      if (typeof callback !== 'function') return () => {};
      const handler = (event) => callback(event.detail);
      window.addEventListener('nexus:music', handler);
      return () => window.removeEventListener('nexus:music', handler);
    },
    play: (target) => sendMusicCmd('play', target),
    pause: () => sendMusicCmd('pause'),
    toggle: () => sendMusicCmd('toggle'),
    stop: () => sendMusicCmd('stop'),
    next: () => sendMusicCmd('next'),
    prev: () => sendMusicCmd('prev'),
    seek: (seconds) => sendMusicCmd('seek', Number(seconds)),
    setVolume: (volume) => sendMusicCmd('set-volume', Number(volume)),
    toggleMute: () => sendMusicCmd('toggle-mute'),
    toggleShuffle: () => sendMusicCmd('toggle-shuffle'),
    cycleRepeat: () => sendMusicCmd('cycle-repeat'),
    toggleLike: (track) => sendMusicCmd('toggle-like', track),
    playStream: (indexOrId) => sendMusicCmd('play-stream', indexOrId),
    playPlaylist: (idOrName) => sendMusicCmd('play-playlist', idOrName),
    enqueue: (target, title) => sendMusicCmd('enqueue', typeof target === 'string' ? { target, title } : target),
    search: (query) => sendMusicCmd('search', query),
    open: (tab) => sendMusicCmd('open', tab),
    setSoundscape: (layer, level) => sendMusicCmd('set-soundscape', { layer, level: Number(level) }),
    toggleSoundscape: (enable) => sendMusicCmd('toggle-soundscape', typeof enable === 'boolean' ? enable : undefined),
    setSoundscapeVolume: (volume) => sendMusicCmd('set-soundscape-volume', Number(volume)),
    applySoundscapePreset: (idOrName) => sendMusicCmd('apply-soundscape-preset', idOrName),
    clearSoundscape: () => sendMusicCmd('clear-soundscape'),
  }
};
window.NEXUS = NEXUS;
window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data.type !== 'string') return;
  if (event.data.type === 'nexus:response' && typeof event.data.requestId === 'string') {
    const resolve = pendingHostRequests.get(event.data.requestId);
    if (resolve) {
      pendingHostRequests.delete(event.data.requestId);
      resolve(event.data.value);
    }
    return;
  }
  if (event.data.type === 'nexus:ready') {
    if (Object.prototype.hasOwnProperty.call(event.data, 'state')) NEXUS_STATE = event.data.state;
    window.dispatchEvent(new CustomEvent('nexus:ready', { detail: { data: event.data.data ?? NEXUS_DATA, state: NEXUS_STATE, music: NEXUS_MUSIC } }));
  }
  if (event.data.type === 'nexus:theme') {
    NEXUS_THEME = event.data.theme;
    document.documentElement.dataset.theme = NEXUS_THEME;
    document.body.dataset.theme = NEXUS_THEME;
    window.dispatchEvent(new CustomEvent('nexus:theme', { detail: NEXUS_THEME }));
  }
  if (event.data.type === 'nexus:local') {
    NEXUS_LOCAL = event.data.values || {};
    window.dispatchEvent(new CustomEvent('nexus:local', { detail: NEXUS_LOCAL }));
  }
  if (event.data.type === 'nexus:music' && event.data.state) {
    NEXUS_MUSIC = event.data.state;
    window.dispatchEvent(new CustomEvent('nexus:music', { detail: NEXUS_MUSIC }));
  }
  if (event.data.type === 'nexus:time') {
    window.dispatchEvent(new CustomEvent('nexus:time', { detail: event.data.value }));
  }
});
parent.postMessage({ type: 'nexus:ready', data: NEXUS_DATA, state: NEXUS_STATE }, '*');
${script}
</script></body></html>`;
}

export function WidgetRuntime({ widget, theme, onOpenApp, onOpenUrl }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  const themeRef = useRef(theme);
  themeRef.current = theme;
  const documentSource = useMemo(() => buildDocument(widget, theme), [widget, theme]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data.type !== 'string') return;
      switch (event.data.type) {
        case 'nexus:ready': {
          let values: Record<string, unknown> = {};
          try {
            const raw = localStorage.getItem('nexus.widget-local.' + widget.id);
            values = raw ? JSON.parse(raw) : {};
          } catch {}
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:theme', theme: themeRef.current }, '*');
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*');
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:music', state: getWidgetMusicSnapshot() }, '*');
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:ready', data: event.data.data, state: event.data.state ?? null }, '*');
          break;
        }
        case 'nexus:read-time':
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:time', value: new Date().toISOString() }, '*');
          break;
        case 'nexus:music-read':
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:music', state: getWidgetMusicSnapshot() }, '*');
          break;
        case 'nexus:music-cmd':
          if (typeof event.data.action === 'string') {
            dispatchWidgetMusicCommand(event.data.action, event.data.payload, () => onOpenApp('music'));
          }
          break;
        case 'nexus:open-app':
          if (typeof event.data.appId === 'string') onOpenApp(event.data.appId);
          break;
        case 'nexus:open-url':
          if (typeof event.data.url === 'string') {
            try {
              const url = new URL(event.data.url);
              if (url.protocol === 'https:' || url.protocol === 'http:') onOpenUrl(url.href);
            } catch {
              /* Ignore malformed URLs from untrusted widget code. */
            }
          }
          break;
        case 'nexus:stash':
          if (typeof event.data.content === 'string' && event.data.content.trim()) {
            stashItem({
              content: event.data.content.trim(),
              title: typeof event.data.title === 'string' ? event.data.title : undefined,
              source: { title: `Widget: ${widget.name}` },
              openShelf: true,
            });
          }
          break;
        case 'nexus:open-stash':
          openStashShelf();
          break;
        case 'nexus:notes-read': {
          const notes = readNotesState().notes.map(note => ({
            id: note.id,
            title: note.title,
            content: note.content,
            updatedAt: note.updatedAt,
          }));
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: notes,
          }, '*');
          break;
        }
        case 'nexus:notes-toggle-task': {
          const payload = event.data.payload;
          const state = readNotesState();
          const note = state.notes.find(item => item.id === payload?.noteId);
          const lineIndex = payload?.lineIndex;
          if (!note || !Number.isInteger(lineIndex)) break;
          const updatedNote = {
            ...note,
            content: toggleChecklistLine(note.content, lineIndex),
            updatedAt: Date.now(),
          };
          saveNotesState({
            notes: state.notes.map(item => item.id === note.id ? updatedNote : item),
            activeNoteId: state.activeNoteId,
          });
          window.dispatchEvent(new Event('storage'));
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: { id: note.id, content: updatedNote.content },
          }, '*');
          break;
        }
        case 'nexus:shortcuts-read': {
          const shortcuts = readShortcuts().map(shortcut => ({
            id: shortcut.id,
            title: shortcut.title,
            url: shortcut.url,
            mode: shortcut.mode,
          }));
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: shortcuts,
          }, '*');
          break;
        }
        case 'nexus:shortcut-open': {
          const id = event.data.payload?.id;
          const shortcut = typeof id === 'string' ? readShortcuts().find(item => item.id === id) : undefined;
          if (!shortcut) break;
          onOpenUrl(shortcut.url);
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: { ok: true },
          }, '*');
          break;
        }
        case 'nexus:dayline-read': {
          const date = getDaylineDate();
          const state = readDaylineState();
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: { ...(state.days[date] ?? { date, blocks: {} }), timezones: state.timezones },
          }, '*');
          break;
        }
        case 'nexus:dayline-add-block':
        case 'nexus:dayline-update-block':
        case 'nexus:dayline-toggle-block': {
          const payload = event.data.payload;
          const hour = typeof payload?.hour === 'string' && /^\d{2}:00$/.test(payload.hour) ? payload.hour : '';
          const date = getDaylineDate();
          const state = readDaylineState();
          const day = state.days[date] ?? { date, blocks: {} };
          const existing = day.blocks[hour];
          if (!hour || (event.data.type !== 'nexus:dayline-toggle-block' && typeof payload?.task !== 'string')) break;
          let block = event.data.type === 'nexus:dayline-toggle-block'
            ? existing && { ...existing, completed: !existing.completed }
            : {
                id: existing?.id ?? `${date}-${hour}`,
                task: payload.task.trim().slice(0, 500),
                sourceNoteId: existing?.sourceNoteId ?? '',
                sourceLineIndex: existing?.sourceLineIndex ?? -1,
                completed: existing?.completed ?? false,
              };
          if (!block) break;
          if (event.data.type === 'nexus:dayline-add-block' && !existing) {
            const notesState = readNotesState();
            const note = notesState.notes.find(item => item.id === notesState.activeNoteId) ?? notesState.notes[0];
            if (note) {
              const separator = note.content && !note.content.endsWith('\n') ? '\n' : '';
              const content = `${note.content}${separator}- [ ] ${block.task}`;
              const lines = content.split(/\r?\n/);
              const sourceLineIndex = lines.length - 1;
              saveNotesState({
                ...notesState,
                notes: notesState.notes.map(item => item.id === note.id
                  ? { ...item, content, updatedAt: Date.now() }
                  : item),
              });
              block = { ...block, sourceNoteId: note.id, sourceLineIndex };
              window.dispatchEvent(new Event('storage'));
            }
          }
          if (event.data.type === 'nexus:dayline-update-block' && existing?.sourceNoteId && existing.sourceLineIndex >= 0) {
            const notesState = readNotesState();
            const note = notesState.notes.find(item => item.id === existing.sourceNoteId);
            if (note) {
              const lines = note.content.split(/\r?\n/);
              if (lines[existing.sourceLineIndex]) {
                lines[existing.sourceLineIndex] = lines[existing.sourceLineIndex].replace(
                  /(^\s*[-*]\s+\[[ xX]\]\s+).*/,
                  `$1${block.task}`
                );
                saveNotesState({
                  ...notesState,
                  notes: notesState.notes.map(item => item.id === note.id
                    ? { ...item, content: lines.join('\n'), updatedAt: Date.now() }
                    : item),
                });
                window.dispatchEvent(new Event('storage'));
              }
            }
          }
          const nextState = { ...state, days: { ...state.days, [date]: { ...day, blocks: { ...day.blocks, [hour]: block } } } };
          saveDaylineState(nextState);
          frameRef.current?.contentWindow?.postMessage({
            type: 'nexus:response',
            requestId: event.data.requestId,
            value: block,
          }, '*');
          break;
        }
        case 'nexus:set-theme':
          if (event.data.theme === 'light' || event.data.theme === 'dark') {
            window.dispatchEvent(new CustomEvent('nexus:widget-theme-request', { detail: event.data.theme }));
          }
          break;
        case 'nexus:set-local':
          if (typeof event.data.key === 'string' && event.data.key.length <= 200) {
            try {
              const key = 'nexus.widget-local.' + widget.id;
              const values = readWidgetLocal(widget.id);
              values[event.data.key] = event.data.value;
              const serialized = JSON.stringify(values);
              if (serialized.length > 500_000) throw new Error('too large');
              localStorage.setItem(key, serialized);
              frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*');
              setError('');
            } catch {
              setError('Widget local storage could not be saved.');
            }
          }
          break;
        case 'nexus:remove-local':
          if (typeof event.data.key === 'string' && event.data.key.length <= 200) {
            try {
              const key = 'nexus.widget-local.' + widget.id;
              const values = readWidgetLocal(widget.id);
              delete values[event.data.key];
              localStorage.setItem(key, JSON.stringify(values));
              frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*');
              setError('');
            } catch {
              setError('Widget local storage could not be updated.');
            }
          }
          break;
        case 'nexus:set-state':
          try {
            const serialized = JSON.stringify(event.data.state);
            if (serialized === undefined || serialized.length > 500_000) {
              setError('Widget state is invalid or too large to save.');
              break;
            }
            localStorage.setItem(`nexus.widget-state.${widget.id}`, serialized);
            setError('');
          } catch {
            setError('Widget state could not be saved.');
          }
          break;
        case 'nexus:notify':
          if (typeof event.data.message === 'string') setError(event.data.message.slice(0, 300));
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOpenApp, onOpenUrl, widget.id]);

  useEffect(() => {
    frameRef.current?.contentWindow?.postMessage({ type: 'nexus:theme', theme }, '*');
  }, [theme]);

  useEffect(() => {
    const pushMusicSnapshot = () => {
      frameRef.current?.contentWindow?.postMessage(
        { type: 'nexus:music', state: getWidgetMusicSnapshot() },
        '*'
      );
    };
    const unsubMusic = subscribeMusicState(pushMusicSnapshot);
    const unsubSoundscape = subscribeSoundscapeState(pushMusicSnapshot);
    return () => {
      unsubMusic();
      unsubSoundscape();
    };
  }, [documentSource]);

  return (
    <div className="widget-runtime">
      <iframe ref={frameRef} title={widget.name} srcDoc={documentSource} sandbox="allow-scripts allow-forms" />
      {error && <span className="widget-runtime-notice">{error}</span>}
    </div>
  );
}
