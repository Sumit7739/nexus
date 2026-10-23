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
  html: '<div class="widget"><strong data-time>Loading…</strong><small>Local widget</small></div>',
  css: '.widget { display: grid; gap: 6px; padding: 16px; color: #e9f0df; font: 14px system-ui; } small { color: #9eaa98; }',
  js: 'window.addEventListener("nexus:ready", () => {\\n  document.querySelector("[data-time]").textContent = new Date().toLocaleTimeString();\\n});',
  json: '{}',
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
