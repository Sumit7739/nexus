import { useEffect, useMemo, useRef, useState } from 'react';
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
  try { const value: unknown = JSON.parse(localStorage.getItem('nexus.widget-local.' + widgetId) || '{}'); return value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, unknown> : {}; } catch { return {}; }
}

function buildDocument(widget: WidgetDefinition, theme: 'light' | 'dark') {
  const payload = JSON.stringify(parseWidgetJson(widget.source.json)).replace(/</g, '\\u003c');
  const savedState = JSON.stringify(readWidgetState(widget.id)).replace(/</g, '\\u003c');
  const initialLocal = JSON.stringify(readWidgetLocal(widget.id)).replace(/</g, '\\u003c');
  const script = widget.source.js.replace(/<\/script/gi, '<\\\\/script');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${widget.source.css}</style></head><body>${widget.source.html}<script>
const NEXUS_DATA = ${payload};
let NEXUS_STATE = ${savedState};
let NEXUS_THEME = ${JSON.stringify(theme)};
let NEXUS_LOCAL = ${initialLocal}; 
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
  notify: (message) => parent.postMessage({ type: 'nexus:notify', message }, '*'),
  setState: (state) => { NEXUS_STATE = state; parent.postMessage({ type: 'nexus:set-state', state }, '*'); }
};
window.NEXUS = NEXUS;
window.addEventListener('message', (event) => {
  if (!event.data || typeof event.data.type !== 'string') return;
  if (event.data.type === 'nexus:ready') {
    if (Object.prototype.hasOwnProperty.call(event.data, 'state')) NEXUS_STATE = event.data.state;
    window.dispatchEvent(new CustomEvent('nexus:ready', { detail: { data: event.data.data ?? NEXUS_DATA, state: NEXUS_STATE } }));
  }
  if (event.data.type === 'nexus:theme') { NEXUS_THEME = event.data.theme; document.documentElement.dataset.theme = NEXUS_THEME; document.body.dataset.theme = NEXUS_THEME; window.dispatchEvent(new CustomEvent('nexus:theme', { detail: NEXUS_THEME })); }
  if (event.data.type === 'nexus:local') { NEXUS_LOCAL = event.data.values || {}; window.dispatchEvent(new CustomEvent('nexus:local', { detail: NEXUS_LOCAL })); }
  if (event.data.type === 'nexus:time') window.dispatchEvent(new CustomEvent('nexus:time', { detail: event.data.value }));
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
          try { const raw = localStorage.getItem('nexus.widget-local.' + widget.id); values = raw ? JSON.parse(raw) : {}; } catch {}
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:theme', theme: themeRef.current }, '*');
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*');
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:ready', data: event.data.data, state: event.data.state ?? null }, '*');
          break;
        }
        case 'nexus:read-time':
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:time', value: new Date().toISOString() }, '*');
          break;
        case 'nexus:open-app':
          if (typeof event.data.appId === 'string') onOpenApp(event.data.appId);
          break;
        case 'nexus:open-url':
          if (typeof event.data.url === 'string') {
            try {
              const url = new URL(event.data.url);
              if (url.protocol === 'https:' || url.protocol === 'http:') onOpenUrl(url.href);
            } catch { /* Ignore malformed URLs from untrusted widget code. */ }
          }
          break;
        case 'nexus:set-theme':
          if (event.data.theme === 'light' || event.data.theme === 'dark') window.dispatchEvent(new CustomEvent('nexus:widget-theme-request', { detail: event.data.theme }));
          break;
        case 'nexus:set-local':
          if (typeof event.data.key === 'string' && event.data.key.length <= 200) { try { const key = 'nexus.widget-local.' + widget.id; const values = readWidgetLocal(widget.id); values[event.data.key] = event.data.value; const serialized = JSON.stringify(values); if (serialized.length > 500_000) throw new Error('too large'); localStorage.setItem(key, serialized); frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*'); setError(''); } catch { setError('Widget local storage could not be saved.'); } }
          break;
        case 'nexus:remove-local':
          if (typeof event.data.key === 'string' && event.data.key.length <= 200) { try { const key = 'nexus.widget-local.' + widget.id; const values = readWidgetLocal(widget.id); delete values[event.data.key]; localStorage.setItem(key, JSON.stringify(values)); frameRef.current?.contentWindow?.postMessage({ type: 'nexus:local', values }, '*'); setError(''); } catch { setError('Widget local storage could not be updated.'); } }
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
          } catch { setError('Widget state could not be saved.'); }
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

  useEffect(() => { frameRef.current?.contentWindow?.postMessage({ type: 'nexus:theme', theme }, '*'); }, [theme]);

  return <div className="widget-runtime">
    <iframe ref={frameRef} title={widget.name} srcDoc={documentSource} sandbox="allow-scripts allow-forms" />
    {error && <span className="widget-runtime-notice">{error}</span>}
  </div>;
}
