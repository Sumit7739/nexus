import type { WidgetSource } from '../widgets/types';
import { WIDGET_API_ENTRIES } from '../widgets/templates';

interface PuterChatResponse {
  content?: unknown;
  message?: { content?: unknown };
  choices?: Array<{ message?: { content?: unknown }; text?: unknown }>;
}

interface PuterAi {
  chat: (
    prompt: string,
    options?: { temperature?: number; max_tokens?: number; signal?: AbortSignal }
  ) => Promise<PuterChatResponse | string>;
}

declare global {
  interface Window {
    puter?: { ai?: PuterAi };
  }
}

export interface GeneratedWidget {
  name: string;
  source: WidgetSource;
  width: number;
  height: number;
}

export interface WidgetCrafterMessage {
  role: 'user' | 'assistant';
  content: string;
}

function extractResponseText(response: PuterChatResponse | string): string {
  if (typeof response === 'string') return response;
  const candidates = [
    response.content,
    response.message?.content,
    response.choices?.[0]?.message?.content,
    response.choices?.[0]?.text,
  ];
  const content = candidates.find((candidate): candidate is string => typeof candidate === 'string');
  if (!content) throw new Error('Puter returned an empty AI response.');
  return content;
}

function parseJsonResponse(text: string): Record<string, unknown> {
  const withoutFence = text.replace(/```(?:json)?\s*/gi, '').replace(/```/g, '').trim();
  const start = withoutFence.indexOf('{');
  const end = withoutFence.lastIndexOf('}');
  if (start < 0 || end <= start) throw new Error('Puter returned widget code in an unreadable format.');
  try {
    const parsed: unknown = JSON.parse(withoutFence.slice(start, end + 1));
    if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
      throw new Error('Widget response must be a JSON object.');
    }
    return parsed as Record<string, unknown>;
  } catch {
    throw new Error('Puter returned invalid widget JSON. Try a more specific prompt.');
  }
}

function requiredSourceValue(source: Record<string, unknown>, key: keyof WidgetSource): string {
  const value = source[key];
  if (typeof value !== 'string') throw new Error(`Generated widget is missing source.${key}.`);
  if (value.length > 100_000) throw new Error(`Generated source.${key} is too large.`);
  return value;
}

function enforceThemeSupport(source: WidgetSource): WidgetSource {
  const themeCss = `\n/* Nexus theme contract */\nbody[data-theme="dark"] { color-scheme: dark; }\n`;
  const themeJs = `\n// Nexus theme contract: the host updates body[data-theme] and emits nexus:theme.\nconst applyNexusTheme = (theme) => { document.documentElement.dataset.theme = theme; document.body.dataset.theme = theme; };\napplyNexusTheme(typeof NEXUS?.getTheme === 'function' ? NEXUS.getTheme() : 'light');\nwindow.addEventListener('nexus:theme', (event) => applyNexusTheme(event.detail));\n`;
  return {
    ...source,
    css: source.css.includes('body[data-theme="dark"]') ? source.css : `${source.css}${themeCss}`,
    js: source.js.includes('nexus:theme') ? source.js : `${source.js}${themeJs}`,
  };
}

export async function generateWidgetWithPuter(
  prompt: string,
  history: readonly WidgetCrafterMessage[] = [],
  currentSource?: WidgetSource
): Promise<GeneratedWidget> {
  const request = prompt.trim();
  if (!request) throw new Error('Describe the widget you want to create.');
  if (request.length > 1_000) throw new Error('Widget description is too long (maximum 1,000 characters).');

  const ai = window.puter?.ai;
  if (!ai?.chat) {
    throw new Error('Puter AI is still loading or unavailable. Refresh the page and try again.');
  }

  const conversation = history.slice(-8).map(message => `${message.role.toUpperCase()}: ${message.content}`).join('\n');
  const current = currentSource
    ? `CURRENT WIDGET SOURCE:\n${JSON.stringify(currentSource)}`
    : 'There is no current widget source. Create the first version.';
  const response = await ai.chat(
    [
      'Create an editable Nexus desktop widget from the user request below.',
      'Return ONLY one JSON object with exactly these keys:',
      '{"name":"short title","html":"body markup","css":"styles","js":"browser JavaScript","json":"valid JSON data","width":260,"height":150}',
      'The html must be a self-contained fragment, not a full document.',
      'Every widget MUST support automatic light/dark theme changes: use body[data-theme="dark"] styles and listen for the nexus:theme event or use NEXUS.getTheme().',
      'The js runs in a sandboxed iframe and may use the documented NEXUS APIs, especially NEXUS.notes, NEXUS.shortcuts, NEXUS.music, NEXUS.getLocal(), and NEXUS.setLocal().',
      'Do not use fetch, imports, external scripts, API keys, or markdown fences.',
      'Use event listeners rather than inline event handlers. Keep the widget useful, polished, and under 100 lines of JS.',
      'Only use APIs listed in the reference context. Keep all state local or host-mediated.',
      `API REFERENCE CONTEXT:\n${WIDGET_API_ENTRIES.map(entry => `${entry.category}: ${entry.signature} — ${entry.description}`).join('\n')}`,
      current,
      conversation ? `CONVERSATION HISTORY:\n${conversation}` : '',
      `LATEST USER REQUEST: ${request}`,
    ].join('\n'),
    { temperature: 0.35, max_tokens: 4_000 }
  );

  const raw = parseJsonResponse(extractResponseText(response));
  const rawSource = raw.source && typeof raw.source === 'object' && !Array.isArray(raw.source)
    ? raw.source as Record<string, unknown>
    : raw;
  const name = typeof raw.name === 'string' && raw.name.trim() ? raw.name.trim().slice(0, 80) : 'AI Widget';
  const width = typeof raw.width === 'number' && Number.isFinite(raw.width)
    ? Math.min(640, Math.max(160, Math.round(raw.width)))
    : 260;
  const height = typeof raw.height === 'number' && Number.isFinite(raw.height)
    ? Math.min(480, Math.max(100, Math.round(raw.height)))
    : 150;

  return {
    name,
    width,
    height,
    source: enforceThemeSupport({
      html: requiredSourceValue(rawSource, 'html'),
      css: requiredSourceValue(rawSource, 'css'),
      js: requiredSourceValue(rawSource, 'js'),
      json: requiredSourceValue(rawSource, 'json'),
    }),
  };
}
