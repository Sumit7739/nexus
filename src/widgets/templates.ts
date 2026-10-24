import type { WidgetDefinition, WidgetSource } from './types';

export interface WidgetTemplate {
  id: string;
  name: string;
  summary: string;
  bounds: { width: number; height: number };
  source: WidgetSource;
}

export const WIDGET_TEMPLATES: WidgetTemplate[] = [
  {
    id: 'desk-clock',
    name: 'Editorial Clock',
    summary: 'Theme-aware time, date, and greeting driven by widget.json.',
    bounds: { width: 280, height: 156 },
    source: {
      html: `<div class="card">
  <div class="meta">
    <span id="greeting">Workspace</span>
    <span class="sep">·</span>
    <span id="date">—</span>
  </div>
  <div class="time" id="clock">00:00</div>
  <div class="sub" id="zone">Local time</div>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body {
  background: #f7f5f0;
  color: #1a1916;
  padding: 18px 20px;
  display: flex;
  align-items: center;
}
body[data-theme="dark"] {
  background: #18160f;
  color: #f0ede4;
}
.card { display: flex; flex-direction: column; gap: 6px; width: 100%; }
.meta {
  display: flex; align-items: center; gap: 6px;
  font-size: 10px; font-weight: 600; letter-spacing: 0.08em;
  text-transform: uppercase; opacity: 0.55;
}
.time {
  font-family: Georgia, serif;
  font-style: italic;
  font-size: 40px;
  line-height: 1.05;
  letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
.sub { font-size: 11px; opacity: 0.5; }`,
      js: `function render() {
  const now = new Date();
  const showSeconds = Boolean(NEXUS.data.showSeconds);
  document.getElementById('clock').textContent = now.toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
    ...(showSeconds ? { second: '2-digit' } : {})
  });
  document.getElementById('date').textContent = now.toLocaleDateString([], {
    weekday: 'short',
    month: 'short',
    day: 'numeric'
  });
  const hr = now.getHours();
  const label = NEXUS.data.label || (hr < 12 ? 'Morning' : hr < 18 ? 'Afternoon' : 'Evening');
  document.getElementById('greeting').textContent = label;
  document.getElementById('zone').textContent = Intl.DateTimeFormat().resolvedOptions().timeZone;
}

window.addEventListener('nexus:ready', () => {
  render();
  setInterval(render, 1000);
});`,
      json: `{\n  "label": "Focus",\n  "showSeconds": false\n}`,
    },
  },
  {
    id: 'focus-timer',
    name: 'Focus Timer',
    summary: '25-minute Pomodoro timer with session counter saved locally.',
    bounds: { width: 280, height: 176 },
    source: {
      html: `<div class="wrap">
  <div class="top">
    <span class="label">Focus session</span>
    <span class="sessions"><span id="count">0</span> completed</span>
  </div>
  <div class="digits" id="timer">25:00</div>
  <div class="actions">
    <button id="toggle" class="primary">Start</button>
    <button id="reset">Reset</button>
  </div>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body {
  background: #f7f5f0; color: #1a1916;
  padding: 16px 18px; display: flex;
}
body[data-theme="dark"] { background: #18160f; color: #f0ede4; }
.wrap { display: flex; flex-direction: column; justify-content: space-between; width: 100%; }
.top { display: flex; justify-content: space-between; font-size: 11px; opacity: 0.6; font-variant-numeric: tabular-nums; }
.digits {
  font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
  font-size: 36px; font-weight: 500; letter-spacing: -1px;
  font-variant-numeric: tabular-nums;
}
.actions { display: flex; gap: 8px; }
button {
  height: 30px; padding: 0 12px; border-radius: 8px;
  border: 1px solid rgba(128,125,118,0.28);
  background: transparent; color: inherit;
  font-size: 11.5px; font-weight: 500; cursor: pointer;
}
button.primary {
  background: #1a1916; color: #f7f5f0; border-color: #1a1916;
}
body[data-theme="dark"] button.primary {
  background: #f0ede4; color: #18160f; border-color: #f0ede4;
}`,
      js: `const mins = Number(NEXUS.data.minutes) || 25;
let remaining = mins * 60;
let running = false;
let intervalId = null;

function format(sec) {
  const m = String(Math.floor(sec / 60)).padStart(2, '0');
  const s = String(sec % 60).padStart(2, '0');
  return m + ':' + s;
}

function paint() {
  document.getElementById('timer').textContent = format(remaining);
  document.getElementById('toggle').textContent = running ? 'Pause' : 'Start';
  document.getElementById('count').textContent = String(NEXUS.getLocal('completed') || 0);
}

document.getElementById('toggle').addEventListener('click', () => {
  running = !running;
  if (running) {
    intervalId = setInterval(() => {
      remaining -= 1;
      if (remaining <= 0) {
        clearInterval(intervalId);
        running = false;
        remaining = mins * 60;
        const next = (Number(NEXUS.getLocal('completed')) || 0) + 1;
        NEXUS.setLocal('completed', next);
      }
      paint();
    }, 1000);
  } else {
    clearInterval(intervalId);
  }
  paint();
});

document.getElementById('reset').addEventListener('click', () => {
  clearInterval(intervalId);
  running = false;
  remaining = mins * 60;
  paint();
});

window.addEventListener('nexus:local', paint);
window.addEventListener('nexus:ready', paint);`,
      json: `{\n  "minutes": 25\n}`,
    },
  },
  {
    id: 'quick-tasks',
    name: 'Mini Checklist',
    summary: 'Persistent desktop checklist backed by widget-scoped storage.',
    bounds: { width: 290, height: 220 },
    source: {
      html: `<div class="todo">
  <header>
    <strong>Today</strong>
    <span id="summary">0 / 0</span>
  </header>
  <ul id="list"></ul>
  <form id="form">
    <input id="input" placeholder="Add a task…" autocomplete="off" />
    <button type="submit">Add</button>
  </form>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; padding: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { background: #f7f5f0; color: #1a1916; padding: 14px 16px; }
body[data-theme="dark"] { background: #18160f; color: #f0ede4; }
.todo { display: flex; flex-direction: column; height: 100%; gap: 10px; }
header { display: flex; justify-content: space-between; align-items: baseline; font-size: 12px; border-bottom: 1px solid rgba(128,125,118,0.2); padding-bottom: 7px; }
header span { font-size: 10.5px; opacity: 0.55; font-variant-numeric: tabular-nums; }
ul { list-style: none; flex: 1; overflow-y: auto; display: flex; flex-direction: column; gap: 5px; }
li { display: flex; align-items: center; gap: 8px; font-size: 12px; padding: 3px 0; }
li.done span { text-decoration: line-through; opacity: 0.45; }
li span { flex: 1; cursor: pointer; }
li button { border: 0; background: none; color: inherit; opacity: 0.4; cursor: pointer; font-size: 13px; }
li button:hover { opacity: 1; }
form { display: flex; gap: 6px; padding-top: 6px; border-top: 1px solid rgba(128,125,118,0.2); }
input {
  flex: 1; min-width: 0; height: 28px; padding: 0 9px;
  border-radius: 7px; border: 1px solid rgba(128,125,118,0.28);
  background: transparent; color: inherit; font-size: 11.5px; outline: none;
}
form button {
  height: 28px; padding: 0 10px; border-radius: 7px; border: 0;
  background: #1a1916; color: #f7f5f0; font-size: 11px; font-weight: 600; cursor: pointer;
}
body[data-theme="dark"] form button { background: #f0ede4; color: #18160f; }`,
      js: `function getItems() {
  const saved = NEXUS.getLocal('items');
  return Array.isArray(saved) ? saved : (NEXUS.data.defaults || []);
}

function render() {
  const items = getItems();
  const list = document.getElementById('list');
  list.innerHTML = '';
  const doneCount = items.filter(i => i.done).length;
  document.getElementById('summary').textContent = doneCount + ' / ' + items.length;

  items.forEach((item, idx) => {
    const li = document.createElement('li');
    if (item.done) li.className = 'done';
    const text = document.createElement('span');
    text.textContent = item.text;
    text.onclick = () => {
      const next = items.map((t, i) => i === idx ? { ...t, done: !t.done } : t);
      NEXUS.setLocal('items', next);
    };
    const del = document.createElement('button');
    del.textContent = '×';
    del.onclick = () => {
      NEXUS.setLocal('items', items.filter((_, i) => i !== idx));
    };
    li.append(text, del);
    list.appendChild(li);
  });
}

document.getElementById('form').addEventListener('submit', (e) => {
  e.preventDefault();
  const input = document.getElementById('input');
  const text = input.value.trim();
  if (!text) return;
  NEXUS.setLocal('items', [...getItems(), { text, done: false }]);
  input.value = '';
});

window.addEventListener('nexus:local', render);
window.addEventListener('nexus:ready', render);`,
      json: `{\n  "defaults": [\n    { "text": "Review notes in Scratchpad", "done": false },\n    { "text": "Customize desktop wallpaper", "done": true }\n  ]\n}`,
    },
  },
  {
    id: 'workspace-shortcuts',
    name: 'Quick Actions',
    summary: 'Launch Nexus apps and toggle workspace theme via the host bridge.',
    bounds: { width: 270, height: 154 },
    source: {
      html: `<div class="docklet">
  <div class="head">
    <span>Quick actions</span>
    <button id="themeBtn">Switch theme</button>
  </div>
  <div class="grid">
    <button data-app="notes">Scratchpad</button>
    <button data-app="bookmarks">Saved links</button>
    <button data-app="browser">Web</button>
    <button data-app="settings">Settings</button>
  </div>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { background: #f7f5f0; color: #1a1916; padding: 14px 15px; }
body[data-theme="dark"] { background: #18160f; color: #f0ede4; }
.docklet { display: flex; flex-direction: column; justify-content: space-between; height: 100%; gap: 10px; }
.head { display: flex; justify-content: space-between; align-items: center; font-size: 11px; opacity: 0.75; }
.head button {
  border: 0; background: none; color: inherit; text-decoration: underline;
  font-size: 11px; cursor: pointer; padding: 0;
}
.grid { display: grid; grid-template-columns: 1fr 1fr; gap: 7px; }
.grid button {
  height: 36px; border-radius: 8px;
  border: 1px solid rgba(128,125,118,0.25);
  background: rgba(128,125,118,0.06);
  color: inherit; font-size: 11.5px; font-weight: 500; cursor: pointer;
}
.grid button:hover { background: rgba(128,125,118,0.14); }`,
      js: `function syncLabel() {
  const isDark = NEXUS.getTheme() === 'dark';
  document.getElementById('themeBtn').textContent = isDark ? 'Light mode' : 'Dark mode';
}

document.getElementById('themeBtn').addEventListener('click', () => {
  const next = NEXUS.getTheme() === 'dark' ? 'light' : 'dark';
  NEXUS.setTheme(next);
});

document.querySelectorAll('[data-app]').forEach((btn) => {
  btn.addEventListener('click', () => NEXUS.openApp(btn.dataset.app));
});

window.addEventListener('nexus:theme', syncLabel);
window.addEventListener('nexus:ready', syncLabel);`,
      json: `{}`,
    },
  },
];

export function instantiateTemplate(template: WidgetTemplate, existingCount: number): WidgetDefinition {
  const offset = (existingCount % 4) * 28;
  return {
    version: 1,
    id: `widget-${crypto.randomUUID()}`,
    name: template.name,
    source: { ...template.source },
    bounds: {
      x: 420 + offset,
      y: 110 + offset,
      width: template.bounds.width,
      height: template.bounds.height,
    },
    visible: true,
    updatedAt: Date.now(),
  };
}

export interface ApiReferenceEntry {
  id: string;
  category: 'Theme' | 'Storage' | 'Lifecycle' | 'Navigation';
  title: string;
  signature: string;
  description: string;
  snippet: string;
}

export const WIDGET_API_ENTRIES: ApiReferenceEntry[] = [
  {
    id: 'ready',
    category: 'Lifecycle',
    title: 'Initialize on ready',
    signature: "window.addEventListener('nexus:ready', callback)",
    description: 'Fires once host config, saved state, and theme are synchronized with the iframe.',
    snippet: `window.addEventListener('nexus:ready', (e) => {\n  console.log('Config:', NEXUS.data, 'Theme:', NEXUS.getTheme());\n});`,
  },
  {
    id: 'theme-get',
    category: 'Theme',
    title: 'Read & watch theme',
    signature: "NEXUS.getTheme() · 'nexus:theme'",
    description: 'Returns "light" or "dark". The host also sets data-theme on <html> and <body> automatically.',
    snippet: `const theme = NEXUS.getTheme();\nwindow.addEventListener('nexus:theme', (e) => {\n  console.log('Switched to:', e.detail);\n});`,
  },
  {
    id: 'theme-set',
    category: 'Theme',
    title: 'Switch workspace theme',
    signature: "NEXUS.setTheme('light' | 'dark')",
    description: 'Requests the Nexus desktop to switch between warm-paper light mode and charcoal dark mode.',
    snippet: `NEXUS.setTheme(NEXUS.getTheme() === 'dark' ? 'light' : 'dark');`,
  },
  {
    id: 'local-rw',
    category: 'Storage',
    title: 'Scoped key-value storage',
    signature: 'NEXUS.getLocal(key) · NEXUS.setLocal(key, value)',
    description: 'Reads and persists JSON-serializable values isolated to this widget instance.',
    snippet: `const count = (NEXUS.getLocal('count') || 0) + 1;\nNEXUS.setLocal('count', count);\nwindow.addEventListener('nexus:local', (e) => {\n  console.log('Updated store:', e.detail);\n});`,
  },
  {
    id: 'local-manage',
    category: 'Storage',
    title: 'Inspect or clear keys',
    signature: 'NEXUS.getAllLocal() · NEXUS.removeLocal(key)',
    description: 'Returns a shallow copy of all stored keys for this widget or removes a single key.',
    snippet: `const all = NEXUS.getAllLocal();\nNEXUS.removeLocal('count');`,
  },
  {
    id: 'navigation',
    category: 'Navigation',
    title: 'Open apps & external URLs',
    signature: 'NEXUS.openApp(appId) · NEXUS.openUrl(url)',
    description: 'Opens a built-in Nexus app window (browser, youtube, notes, bookmarks, settings) or an HTTPS link.',
    snippet: `NEXUS.openApp('notes');\nNEXUS.openUrl('https://example.com');`,
  },
];
