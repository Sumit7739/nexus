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
    <button data-app="music">Music</button>
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
  {
    id: 'now-playing',
    name: 'Now Playing Deck',
    summary: 'Live desktop Music controller with cover art, progress bar, likes, and focus stream launcher.',
    bounds: { width: 312, height: 186 },
    source: {
      html: `<div class="deck">
  <div class="top">
    <div class="art" id="artWrap">
      <img id="art" alt="" referrerpolicy="no-referrer" hidden />
      <span id="artFallback">♪</span>
    </div>
    <div class="meta">
      <div class="kicker-row">
        <span id="status">Idle</span>
        <button id="openBtn" class="link-btn" type="button">Open Music</button>
      </div>
      <strong id="title">Nothing playing</strong>
      <span class="sub" id="channel">Pick a focus stream or play from Music</span>
    </div>
  </div>

  <div class="timeline">
    <div class="bar" id="bar"><div class="fill" id="fill"></div></div>
    <span class="clock" id="clock">00:00</span>
  </div>

  <div class="controls">
    <div class="transport">
      <button id="prevBtn" type="button" title="Previous">⏮</button>
      <button id="playBtn" type="button" class="primary">Play Focus</button>
      <button id="nextBtn" type="button" title="Next">⏭</button>
    </div>
    <div class="extras">
      <button id="likeBtn" type="button" title="Like track">♡</button>
      <button id="muteBtn" type="button" title="Mute / Unmute">Vol</button>
    </div>
  </div>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { background: #f7f5f0; color: #1a1916; padding: 14px 16px; }
body[data-theme="dark"] { background: #18160f; color: #f0ede4; }
.deck { display: flex; flex-direction: column; justify-content: space-between; height: 100%; gap: 10px; }
.top { display: flex; align-items: center; gap: 12px; min-width: 0; }
.art {
  width: 54px; height: 54px; flex: 0 0 54px; border-radius: 11px; overflow: hidden;
  border: 1px solid rgba(128,125,118,0.24); background: rgba(128,125,118,0.1);
  display: grid; place-items: center; font-size: 18px;
}
.art img { width: 100%; height: 100%; object-fit: cover; display: block; }
.meta { flex: 1; min-width: 0; display: flex; flex-direction: column; gap: 2px; }
.kicker-row { display: flex; justify-content: space-between; align-items: center; font-size: 10px; opacity: 0.65; }
.link-btn { border: 0; background: none; color: inherit; text-decoration: underline; font-size: 10.5px; cursor: pointer; padding: 0; }
strong { font-size: 13px; font-weight: 600; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.sub { font-size: 11px; opacity: 0.6; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
.timeline { display: flex; align-items: center; gap: 8px; }
.bar { flex: 1; height: 5px; border-radius: 99px; background: rgba(128,125,118,0.22); overflow: hidden; cursor: pointer; }
.fill { height: 100%; width: 0%; background: currentColor; transition: width 0.2s linear; }
.clock { font-size: 10px; opacity: 0.65; font-variant-numeric: tabular-nums; min-width: 34px; text-align: right; }
.controls { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.transport, .extras { display: flex; align-items: center; gap: 6px; }
button {
  height: 29px; padding: 0 10px; border-radius: 8px;
  border: 1px solid rgba(128,125,118,0.28); background: transparent;
  color: inherit; font-size: 11px; font-weight: 500; cursor: pointer; white-space: nowrap;
}
button:hover { background: rgba(128,125,118,0.12); }
button.primary { background: #1a1916; color: #f7f5f0; border-color: #1a1916; font-weight: 600; }
body[data-theme="dark"] button.primary { background: #f0ede4; color: #18160f; border-color: #f0ede4; }
button.liked { border-color: rgba(190,24,93,0.45); color: #be185d; }
body[data-theme="dark"] button.liked { border-color: rgba(249,168,212,0.45); color: #f9a8d4; }`,
      js: `function fmt(sec) {
  const s = Math.max(0, Math.floor(Number(sec) || 0));
  return String(Math.floor(s / 60)).padStart(2, '0') + ':' + String(s % 60).padStart(2, '0');
}

const artImg = document.getElementById('art');
const artFallback = document.getElementById('artFallback');
artImg.onerror = () => { artImg.hidden = true; artFallback.hidden = false; };

function render(state) {
  if (!state) return;
  const track = state.current;
  document.getElementById('status').textContent = track
    ? (state.isPlaying ? 'Playing' : 'Paused')
    : 'Focus radio';
  document.getElementById('title').textContent = track ? track.title : 'Ready to play';
  document.getElementById('channel').textContent = track
    ? track.channelTitle
    : (NEXUS.data.defaultLabel || 'Click Play Focus to start background audio');

  if (track && track.thumbnail) {
    if (artImg.dataset.src !== track.thumbnail) {
      artImg.dataset.src = track.thumbnail;
      artImg.src = track.thumbnail;
    }
    artImg.hidden = false;
    artFallback.hidden = true;
  } else {
    artImg.hidden = true;
    artFallback.hidden = false;
  }

  const isLive = Boolean(track && (track.duration === 'LIVE' || state.duration === 0));
  const pct = !track ? 0 : isLive ? 100 : Math.min(100, (state.currentTime / Math.max(1, state.duration)) * 100);
  document.getElementById('fill').style.width = pct + '%';
  document.getElementById('clock').textContent = !track ? '00:00' : isLive ? 'LIVE' : fmt(state.currentTime);

  document.getElementById('playBtn').textContent = !track
    ? 'Play Focus'
    : (state.isPlaying ? 'Pause' : 'Play');

  const likeBtn = document.getElementById('likeBtn');
  likeBtn.textContent = state.isLiked ? '♥' : '♡';
  likeBtn.classList.toggle('liked', Boolean(state.isLiked));
  likeBtn.disabled = !track;

  document.getElementById('muteBtn').textContent = state.isMuted ? 'Muted' : state.volume + '%';
}

document.getElementById('playBtn').onclick = () => {
  const s = NEXUS.music.getState();
  if (!s.current) NEXUS.music.playStream(Number(NEXUS.data.defaultStreamIndex) || 0);
  else NEXUS.music.toggle();
};
document.getElementById('prevBtn').onclick = () => NEXUS.music.prev();
document.getElementById('nextBtn').onclick = () => NEXUS.music.next();
document.getElementById('likeBtn').onclick = () => NEXUS.music.toggleLike();
document.getElementById('muteBtn').onclick = () => NEXUS.music.toggleMute();
document.getElementById('openBtn').onclick = () => NEXUS.music.open();
document.getElementById('bar').onclick = (e) => {
  const s = NEXUS.music.getState();
  if (!s.current || !s.duration) return;
  const rect = e.currentTarget.getBoundingClientRect();
  const ratio = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
  NEXUS.music.seek(Math.round(ratio * s.duration));
};

NEXUS.music.onChange(render);
window.addEventListener('nexus:ready', () => render(NEXUS.music.getState()));`,
      json: `{\n  "defaultStreamIndex": 0,\n  "defaultLabel": "Start 24/7 focus radio"\n}`,
    },
  },
  {
    id: 'ambient-mixer',
    name: 'Ambient Soundscape',
    summary: 'Layered procedural Rain, Vinyl, Fireplace, and Brown Noise faders synced with Music.',
    bounds: { width: 312, height: 210 },
    source: {
      html: `<div class="amb">
  <div class="head">
    <div>
      <span class="kicker">Ambient mixer</span>
      <strong id="summary">No ambient layers</strong>
    </div>
    <div class="head-btns">
      <button id="presetBtn" type="button" title="Cycle focus presets">Preset</button>
      <button id="toggleBtn" type="button" class="primary">Play</button>
    </div>
  </div>
  <div class="faders" id="faders">
    <label class="row"><span>Soft Rain</span><input type="range" min="0" max="100" data-layer="rain" /><em data-pct="rain">0%</em></label>
    <label class="row"><span>Vinyl Dust</span><input type="range" min="0" max="100" data-layer="vinyl" /><em data-pct="vinyl">0%</em></label>
    <label class="row"><span>Fireplace</span><input type="range" min="0" max="100" data-layer="hearth" /><em data-pct="hearth">0%</em></label>
    <label class="row"><span>Deep Brown</span><input type="range" min="0" max="100" data-layer="brown" /><em data-pct="brown">0%</em></label>
  </div>
</div>`,
      css: `* { box-sizing: border-box; margin: 0; }
html, body { height: 100%; font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
body { background: #f7f5f0; color: #1a1916; padding: 14px 16px; }
body[data-theme="dark"] { background: #18160f; color: #f0ede4; }
.amb { display: flex; flex-direction: column; justify-content: space-between; height: 100%; gap: 10px; }
.head { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
.kicker { display: block; font-size: 9.5px; font-weight: 700; letter-spacing: 0.08em; text-transform: uppercase; opacity: 0.55; }
strong { display: block; font-size: 12.5px; font-weight: 600; margin-top: 2px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 165px; }
.head-btns { display: flex; gap: 5px; flex-shrink: 0; }
button {
  height: 26px; padding: 0 9px; border-radius: 7px;
  border: 1px solid rgba(128,125,118,0.28); background: transparent;
  color: inherit; font-size: 11px; font-weight: 500; cursor: pointer; white-space: nowrap;
}
button:hover { background: rgba(128,125,118,0.12); }
button.primary { background: #1a1916; color: #f7f5f0; border-color: #1a1916; font-weight: 600; }
body[data-theme="dark"] button.primary { background: #f0ede4; color: #18160f; border-color: #f0ede4; }
.faders { display: flex; flex-direction: column; gap: 7px; }
.row { display: grid; grid-template-columns: 76px 1fr 34px; align-items: center; gap: 8px; font-size: 11px; }
.row span { opacity: 0.82; white-space: nowrap; }
.row input[type="range"] { width: 100%; height: 4px; accent-color: currentColor; cursor: pointer; }
.row em { font-style: normal; font-size: 10px; opacity: 0.65; text-align: right; font-variant-numeric: tabular-nums; }`,
      js: `const PRESETS = ['Rainy Study', 'Cabin Hearth', 'Deep Focus Shield', 'Midnight Porch'];
let presetIdx = 0;

function render(state) {
  const sc = state && state.soundscape;
  if (!sc) return;
  document.getElementById('summary').textContent = sc.activeCount > 0 ? sc.summary : 'Tap Play or drag a fader';
  document.getElementById('toggleBtn').textContent = sc.isPlaying && sc.activeCount > 0 ? 'Pause' : 'Play';
  ['rain', 'vinyl', 'hearth', 'brown'].forEach((id) => {
    const val = Number(sc.levels[id] || 0);
    const input = document.querySelector('[data-layer="' + id + '"]');
    const pct = document.querySelector('[data-pct="' + id + '"]');
    if (input) input.value = String(val);
    if (pct) pct.textContent = val + '%';
  });
}

document.querySelectorAll('[data-layer]').forEach((input) => {
  input.addEventListener('input', (e) => {
    NEXUS.music.setSoundscape(e.target.dataset.layer, Number(e.target.value));
  });
});

document.getElementById('toggleBtn').onclick = () => NEXUS.music.toggleSoundscape();
document.getElementById('presetBtn').onclick = () => {
  NEXUS.music.applySoundscapePreset(PRESETS[presetIdx % PRESETS.length]);
  presetIdx += 1;
};

NEXUS.music.onChange(render);
window.addEventListener('nexus:ready', () => render(NEXUS.music.getState()));`,
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

export type ApiReferenceCategory = 'Music' | 'Lifecycle' | 'Theme' | 'Storage' | 'Navigation';

export interface ApiReferenceEntry {
  id: string;
  category: ApiReferenceCategory;
  title: string;
  signature: string;
  description: string;
  snippet: string;
}

export const WIDGET_API_ENTRIES: ApiReferenceEntry[] = [
  {
    id: 'music-state',
    category: 'Music',
    title: 'Read & subscribe to live playback',
    signature: "NEXUS.music.getState() · NEXUS.music.onChange(fn) · 'nexus:music'",
    description:
      'Returns the live desktop Music snapshot (current track, isPlaying, isMuted, volume, shuffle, repeat, currentTime, duration, isLiked, queue, playlists, and streams) and streams updates in real time without reloading the widget.',
    snippet: `function renderMusic(state) {\n  if (!state.current) {\n    console.log('Idle —', state.streams.length, 'focus streams ready');\n    return;\n  }\n  console.log(state.current.title, state.isPlaying ? 'Playing' : 'Paused', state.currentTime + 's');\n}\n\nNEXUS.music.onChange(renderMusic);\nwindow.addEventListener('nexus:ready', () => {\n  renderMusic(NEXUS.music.getState());\n});`,
  },
  {
    id: 'music-transport',
    category: 'Music',
    title: 'Playback & timeline transport controls',
    signature: 'NEXUS.music.toggle() · play(target?) · pause() · stop() · next() · prev() · seek(sec)',
    description:
      'Controls the persistent desktop audio player directly from your widget. Calling play() or toggle() when idle starts your most recent track or focus stream.',
    snippet: `document.getElementById('playPause')?.addEventListener('click', () => NEXUS.music.toggle());\ndocument.getElementById('next')?.addEventListener('click', () => NEXUS.music.next());\ndocument.getElementById('prev')?.addEventListener('click', () => NEXUS.music.prev());\n// Jump to 1m 30s in the active track:\nNEXUS.music.seek(90);`,
  },
  {
    id: 'music-audio-modes',
    category: 'Music',
    title: 'Volume, mute, shuffle, repeat & likes',
    signature: 'NEXUS.music.setVolume(0–100) · toggleMute() · toggleShuffle() · cycleRepeat() · toggleLike()',
    description:
      'Adjusts output volume (0–100), toggles mute or shuffle, cycles repeat mode (off → all → one), and saves or removes the current track in Liked songs.',
    snippet: `NEXUS.music.setVolume(65);\nNEXUS.music.toggleMute();\nNEXUS.music.toggleShuffle();\nNEXUS.music.cycleRepeat();\nNEXUS.music.toggleLike();`,
  },
  {
    id: 'music-streams-playlists',
    category: 'Music',
    title: 'Play focus streams, YouTube IDs/URLs, queue & playlists',
    signature: 'NEXUS.music.playStream(indexOrId?) · play(idOrUrl) · enqueue(idOrUrl, title?) · playPlaylist(idOrName)',
    description:
      'Starts any of the 6 built-in 24/7 focus radio streams (0–5), streams any YouTube video ID or URL as background audio, queues a track up next, or launches a saved playlist by ID or name.',
    snippet: `// Start built-in 24/7 Synthwave Radio (stream index 1):\nNEXUS.music.playStream(1);\n\n// Play or queue any YouTube track URL / 11-char video ID:\nNEXUS.music.play('https://youtu.be/jfKfPfyJRdk');\nNEXUS.music.enqueue('4xDzrJKXOOY', 'Synthwave Radio');\n\n// Play a saved user playlist by name or ID:\nNEXUS.music.playPlaylist('Deep Work');`,
  },
  {
    id: 'music-app-bridge',
    category: 'Music',
    title: 'Open Music app & run searches',
    signature: "NEXUS.music.open(tab?) · NEXUS.music.search(query)",
    description:
      'Opens or focuses the Music app window on a specific tab ("discover", "queue", "liked", "playlists", or "history"), or opens Music and runs a live track search.',
    snippet: `// Open the Music window directly to Liked songs:\nNEXUS.music.open('liked');\n\n// Open Music and search for tracks:\nNEXUS.music.search('ambient piano trio');`,
  },
  {
    id: 'music-soundscape',
    category: 'Music',
    title: 'Procedural soundscape layers & presets',
    signature: 'NEXUS.music.setSoundscape(layer, 0–100) · applySoundscapePreset(name) · toggleSoundscape() · clearSoundscape()',
    description:
      'Layers zero-dependency Web Audio ambience ("rain", "vinyl", "hearth", "brown", "wind", "night") underneath Music tracks or standalone. Live state is exposed on NEXUS.music.getState().soundscape.',
    snippet: `// Blend Soft Rain (55%) + Vinyl Dust (28%) underneath any playing song:\nNEXUS.music.setSoundscape('rain', 55);\nNEXUS.music.setSoundscape('vinyl', 28);\n\n// Or launch a built-in / custom saved mix by name:\nNEXUS.music.applySoundscapePreset('Rainy Study');\n\n// Toggle ambience pause/resume or adjust master ambience volume:\nNEXUS.music.toggleSoundscape();\nNEXUS.music.setSoundscapeVolume(80);`,
  },
  {
    id: 'ready',
    category: 'Lifecycle',
    title: 'Initialize on ready',
    signature: "window.addEventListener('nexus:ready', callback)",
    description: 'Fires once host config, saved state, music snapshot, and theme are synchronized with the iframe.',
    snippet: `window.addEventListener('nexus:ready', (e) => {\n  console.log('Config:', NEXUS.data, 'Theme:', NEXUS.getTheme(), 'Music:', NEXUS.music.getState());\n});`,
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
    description: 'Opens a built-in Nexus app window (browser, youtube, music, notes, bookmarks, widgets, settings) or an HTTPS link.',
    snippet: `NEXUS.openApp('music');\nNEXUS.openUrl('https://example.com');`,
  },
];

