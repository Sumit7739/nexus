import type { WindowBounds } from '../window-manager/types';

export interface WidgetSource {
  html: string;
  css: string;
  js: string;
  json: string;
}

export interface WidgetDefinition {
  version: 1;
  id: string;
  name: string;
  source: WidgetSource;
  bounds: WindowBounds;
  visible: boolean;
  updatedAt: number;
}

export const DEFAULT_WIDGET_SOURCE: WidgetSource = {
  html: `<div class="widget">
  <span class="kicker" id="title">Local widget</span>
  <strong data-time>Loading…</strong>
</div>`,
  css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body {
  display: flex; align-items: center;
  padding: 18px 20px;
  background: #f7f5f0; color: #1a1916;
}
body[data-theme="dark"] {
  background: #18160f; color: #f0ede4;
}
.widget { display: flex; flex-direction: column; gap: 6px; }
.kicker { font-size: 10px; font-weight: 600; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.55; }
strong { font-family: Georgia, serif; font-style: italic; font-weight: 400; font-size: 28px; font-variant-numeric: tabular-nums; }`,
  js: `function update() {
  const el = document.querySelector('[data-time]');
  if (el) el.textContent = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const title = document.getElementById('title');
  if (title && NEXUS.data.title) title.textContent = NEXUS.data.title;
}

window.addEventListener('nexus:ready', () => {
  update();
  setInterval(update, 10000);
});`,
  json: `{\n  "title": "Local widget"\n}`,
};

export function createWidget(name = 'Untitled widget'): WidgetDefinition {
  return {
    version: 1,
    id: `widget-${crypto.randomUUID()}`,
    name: name.trim() || 'Untitled widget',
    source: { ...DEFAULT_WIDGET_SOURCE },
    bounds: { x: 420, y: 110, width: 260, height: 150 },
    visible: true,
    updatedAt: Date.now(),
  };
}

export function parseWidgetJson(value: string): Record<string, unknown> {
  try {
    const parsed: unknown = JSON.parse(value);
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed as Record<string, unknown> : {};
  } catch {
    return {};
  }
}

export function readWidgets(): WidgetDefinition[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem('nexus.widgets.v1') || '[]');
    if (!Array.isArray(parsed)) return [];
    return parsed.filter((widget): widget is WidgetDefinition => (
      widget?.version === 1 &&
      typeof widget.id === 'string' &&
      typeof widget.name === 'string' &&
      widget.source && typeof widget.source.html === 'string' &&
      typeof widget.source.css === 'string' &&
      typeof widget.source.js === 'string' &&
      typeof widget.source.json === 'string' &&
      widget.bounds && typeof widget.bounds.x === 'number' &&
      typeof widget.bounds.y === 'number' &&
      typeof widget.bounds.width === 'number' &&
      typeof widget.bounds.height === 'number'
    ));
  } catch {
    return [];
  }
}

export function saveWidgets(widgets: WidgetDefinition[]) {
  try { localStorage.setItem('nexus.widgets.v1', JSON.stringify(widgets)); } catch {}
}
