import { useEffect, useMemo, useRef, useState } from 'react';
import type { WidgetDefinition } from './types';
import { parseWidgetJson } from './types';

interface Props {
  widget: WidgetDefinition;
  onOpenApp: (appId: string) => void;
  onOpenUrl: (url: string) => void;
}

function buildDocument(widget: WidgetDefinition) {
  const payload = JSON.stringify(parseWidgetJson(widget.source.json)).replace(/</g, '\\u003c');
  const script = widget.source.js.replace(/<\/script/gi, '<\\\\/script');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>${widget.source.css}</style></head><body>${widget.source.html}<script>
const NEXUS_DATA = ${payload};
const NEXUS = {
  data: NEXUS_DATA,
  time: () => parent.postMessage({ type: 'nexus:read-time' }, '*'),
  openApp: (appId) => parent.postMessage({ type: 'nexus:open-app', appId }, '*'),
  openUrl: (url) => parent.postMessage({ type: 'nexus:open-url', url }, '*'),
  notify: (message) => parent.postMessage({ type: 'nexus:notify', message }, '*'),
  setState: (state) => parent.postMessage({ type: 'nexus:set-state', state }, '*')
};
window.NEXUS = NEXUS;
parent.postMessage({ type: 'nexus:ready', data: NEXUS_DATA }, '*');
${script}
</script></body></html>`;
}

export function WidgetRuntime({ widget, onOpenApp, onOpenUrl }: Props) {
  const frameRef = useRef<HTMLIFrameElement>(null);
  const [error, setError] = useState('');
  const documentSource = useMemo(() => buildDocument(widget), [widget]);

  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== frameRef.current?.contentWindow || !event.data || typeof event.data.type !== 'string') return;
      switch (event.data.type) {
        case 'nexus:ready':
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:ready', data: event.data.data }, '*');
          break;
        case 'nexus:read-time':
          frameRef.current?.contentWindow?.postMessage({ type: 'nexus:time', value: new Date().toISOString() }, '*');
          break;
        case 'nexus:open-app':
          if (typeof event.data.appId === 'string') onOpenApp(event.data.appId);
          break;
        case 'nexus:open-url':
          if (typeof event.data.url === 'string' && /^https:\/\//i.test(event.data.url)) onOpenUrl(event.data.url);
          break;
        case 'nexus:set-state':
          try { localStorage.setItem(`nexus.widget-state.${widget.id}`, JSON.stringify(event.data.state)); } catch { setError('Widget state could not be saved.'); }
          break;
        case 'nexus:notify':
          if (typeof event.data.message === 'string') setError(event.data.message);
          break;
        default:
          break;
      }
    };
    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [onOpenApp, onOpenUrl, widget.id]);

  return <div className="widget-runtime">
    <iframe ref={frameRef} title={widget.name} srcDoc={documentSource} sandbox="allow-scripts allow-forms" />
    {error && <span className="widget-runtime-notice">{error}</span>}
  </div>;
}
