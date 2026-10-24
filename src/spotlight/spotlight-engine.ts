import type { AppDefinition } from '../apps/app-types';
import { classifyOmniboxInput, type SearchEngineId } from '../data/browser';
import {
  computeNoteStats,
  extractNoteSnippet,
  extractNoteTitle,
  formatRelativeNoteTime,
  sortNotesForSidebar,
  type ScratchpadNote,
} from '../data/notes';
import { extractHostname } from '../data/shortcuts';
import type { AppId, DesktopWindow, SnapZone } from '../window-manager/types';

/* ── Types ────────────────────────────────────────────────────────────────── */

export type SpotlightFilter = 'all' | 'apps' | 'notes' | 'windows' | 'actions';

export type SpotlightSectionId =
  | 'math'
  | 'windows'
  | 'apps'
  | 'notes'
  | 'query'
  | 'actions';

export type SpotlightCommandPayload =
  | { type: 'copy-math'; rawValue: string; formattedValue: string }
  | { type: 'open-app'; appId: AppId }
  | { type: 'open-external-url'; url: string }
  | { type: 'focus-window'; windowId: string }
  | { type: 'snap-active-window'; zone: SnapZone }
  | { type: 'unsnap-active-window' }
  | { type: 'minimize-active-window' }
  | { type: 'close-active-window' }
  | { type: 'minimize-all-windows' }
  | { type: 'close-all-windows' }
  | { type: 'open-note'; noteId: string }
  | { type: 'create-note'; title?: string; checklist?: boolean }
  | { type: 'browser-search'; query: string; engine: SearchEngineId }
  | { type: 'browser-url'; url: string; title?: string }
  | { type: 'toggle-theme' }
  | { type: 'set-wallpaper'; wallpaperId: string }
  | { type: 'next-wallpaper' }
  | { type: 'toggle-arrange' }
  | { type: 'toggle-seconds' }
  | { type: 'toggle-messages' }
  | { type: 'toggle-restore-session' }
  | { type: 'export-workspace' }
  | { type: 'open-changelog' }
  | { type: 'lock-screen' }
  | { type: 'setup-passcode' }
  | { type: 'open-launcher' };

export type SpotlightIconKind =
  | 'app'
  | 'window'
  | 'note'
  | 'note-new'
  | 'checklist'
  | 'calculator'
  | 'sparkles'
  | 'globe'
  | 'external'
  | 'tile-left'
  | 'tile-right'
  | 'maximize'
  | 'restore'
  | 'minimize'
  | 'close'
  | 'theme'
  | 'wallpaper'
  | 'arrange'
  | 'clock'
  | 'message'
  | 'session'
  | 'download'
  | 'changelog'
  | 'lock'
  | 'launcher';

export interface SpotlightItem {
  id: string;
  section: SpotlightSectionId;
  filterGroup: Exclude<SpotlightFilter, 'all'>;
  title: string;
  subtitle: string;
  keywords: string;
  iconKind: SpotlightIconKind;
  app?: AppDefinition;
  wallpaperSwatchId?: string;
  shortcutKeys?: string[];
  actionLabel: string;
  mathDisplay?: string;
  score: number;
  command: SpotlightCommandPayload;
}

export interface SpotlightSection {
  id: SpotlightSectionId;
  label: string;
  items: SpotlightItem[];
}

export interface SpotlightContext {
  query: string;
  filter: SpotlightFilter;
  apps: AppDefinition[];
  windows: DesktopWindow[];
  activeWindowId: string | null;
  notes: ScratchpadNote[];
  theme: 'light' | 'dark';
  wallpaper: string;
  wallpapers: readonly { id: string; name: string }[];
  arrangeMode: boolean;
  showSeconds: boolean;
  showMessages: boolean;
  restoreSession: boolean;
  hasPassword: boolean;
  versionTag: string;
  now?: number;
}

export interface SpotlightResults {
  items: SpotlightItem[];
  sections: SpotlightSection[];
  counts: Record<SpotlightFilter, number>;
}

/* ── Safe Recursive-Descent Math & Percentage Evaluator (Zero eval) ───────── */

export interface MathEvalResult {
  expression: string;
  value: number;
  rawValue: string;
  formattedValue: string;
}

type MathToken =
  | { kind: 'num'; value: number }
  | { kind: 'op'; op: '+' | '-' | '*' | '/' | '%' | '^' }
  | { kind: 'lparen' }
  | { kind: 'rparen' };

function roundMathPrecision(num: number): number {
  if (!Number.isFinite(num)) return num;
  if (Object.is(num, -0)) return 0;
  return Number(num.toPrecision(12));
}

function formatMathValue(num: number): { rawValue: string; formattedValue: string } {
  const clean = roundMathPrecision(num);
  if (Math.abs(clean) >= 1e12 || (Math.abs(clean) > 0 && Math.abs(clean) < 1e-6)) {
    const exp = clean.toExponential(6).replace(/\.?0+e/, 'e');
    return { rawValue: String(clean), formattedValue: exp };
  }
  const rawValue = String(clean);
  const formattedValue = clean.toLocaleString('en-US', {
    maximumFractionDigits: 8,
  });
  return { rawValue, formattedValue };
}

function tokenizeMath(expr: string): { tokens: MathToken[]; hasOperator: boolean } | null {
  const tokens: MathToken[] = [];
  let hasOperator = false;
  let i = 0;

  while (i < expr.length) {
    const ch = expr[i];
    if (/\s/.test(ch)) {
      i++;
      continue;
    }

    if (ch === '(') {
      /* Implicit multiplication: 2(3+4) or )( */
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.kind === 'num' || prev.kind === 'rparen')) {
        tokens.push({ kind: 'op', op: '*' });
        hasOperator = true;
      }
      tokens.push({ kind: 'lparen' });
      i++;
      continue;
    }

    if (ch === ')') {
      tokens.push({ kind: 'rparen' });
      i++;
      continue;
    }

    if (ch === '*' && expr[i + 1] === '*') {
      tokens.push({ kind: 'op', op: '^' });
      hasOperator = true;
      i += 2;
      continue;
    }

    if (ch === '+' || ch === '-' || ch === '*' || ch === '/' || ch === '%' || ch === '^') {
      tokens.push({ kind: 'op', op: ch });
      /* Count binary or meaningful operators */
      if (tokens.length > 1 || ch !== '+') {
        hasOperator = true;
      }
      i++;
      continue;
    }

    if (ch === '×') {
      tokens.push({ kind: 'op', op: '*' });
      hasOperator = true;
      i++;
      continue;
    }

    if (ch === '÷') {
      tokens.push({ kind: 'op', op: '/' });
      hasOperator = true;
      i++;
      continue;
    }

    /* Constant pi / π */
    if (ch === 'π' || expr.slice(i, i + 2).toLowerCase() === 'pi') {
      const len = ch === 'π' ? 1 : 2;
      const nextChar = expr[i + len];
      if (nextChar && /[a-z]/i.test(nextChar)) return null;
      const prev = tokens[tokens.length - 1];
      if (prev && (prev.kind === 'num' || prev.kind === 'rparen')) {
        tokens.push({ kind: 'op', op: '*' });
        hasOperator = true;
      }
      tokens.push({ kind: 'num', value: Math.PI });
      i += len;
      continue;
    }

    /* Numeric literal (supports thousands commas like 12,500.50) */
    if (/\d|\./.test(ch)) {
      let rawNum = '';
      let dotCount = 0;
      while (i < expr.length && /[\d.,]/.test(expr[i])) {
        if (expr[i] === '.') {
          dotCount++;
          if (dotCount > 1) return null;
          rawNum += '.';
        } else if (expr[i] !== ',') {
          rawNum += expr[i];
        }
        i++;
      }
      if (!rawNum || rawNum === '.') return null;
      const parsed = Number(rawNum);
      if (!Number.isFinite(parsed)) return null;

      /* Trailing % directly after a number inside arithmetic: e.g. 200 + 15% => 200 + 0.15 or standalone 25% * 80 */
      if (expr[i] === '%' && (i + 1 >= expr.length || !/[\d(]/.test(expr.slice(i + 1).trimStart()[0] ?? ''))) {
        const prev = tokens[tokens.length - 1];
        /* Only treat trailing % as /100 when combined with another operation; otherwise binary modulo handles `17 % 5` */
        if (prev && prev.kind === 'op' && (prev.op === '*' || prev.op === '/')) {
          tokens.push({ kind: 'num', value: parsed / 100 });
          hasOperator = true;
          i++;
          continue;
        }
      }

      tokens.push({ kind: 'num', value: parsed });
      continue;
    }

    return null;
  }

  return { tokens, hasOperator };
}

/**
 * Evaluates arithmetic and percentage expressions safely without `eval` or `Function`.
 * Returns `null` for non-math queries or plain standalone numbers (e.g. "2026").
 */
export function evaluateMathExpression(rawQuery: string): MathEvalResult | null {
  const trimmed = rawQuery.trim().replace(/^=\s*/, '');
  if (!trimmed || trimmed.length > 120) return null;

  /* Natural percentage phrases: "24% of 350" or "15% off 200" */
  const pctPhrase = trimmed.match(
    /^([+-]?\d[\d,]*(?:\.\d+)?)\s*%\s*(of|off)\s+([+-]?\d[\d,]*(?:\.\d+)?)$/i
  );
  if (pctPhrase) {
    const pct = Number(pctPhrase[1].replace(/,/g, ''));
    const mode = pctPhrase[2].toLowerCase();
    const base = Number(pctPhrase[3].replace(/,/g, ''));
    if (Number.isFinite(pct) && Number.isFinite(base)) {
      const computed = mode === 'off' ? base * (1 - pct / 100) : (pct / 100) * base;
      if (Number.isFinite(computed)) {
        const { rawValue, formattedValue } = formatMathValue(computed);
        return {
          expression: `${pct}% ${mode} ${base.toLocaleString('en-US')}`,
          value: roundMathPrecision(computed),
          rawValue,
          formattedValue,
        };
      }
    }
  }

  const tokenized = tokenizeMath(trimmed);
  if (!tokenized || !tokenized.hasOperator || tokenized.tokens.length < 2) {
    return null;
  }

  /* Reject bare signed numbers like "-42" so negative numbers alone aren't treated as calculations */
  if (
    tokenized.tokens.length === 2 &&
    tokenized.tokens[0].kind === 'op' &&
    tokenized.tokens[1].kind === 'num'
  ) {
    return null;
  }

  const { tokens } = tokenized;
  let pos = 0;

  function peek(): MathToken | undefined {
    return tokens[pos];
  }

  function consume(): MathToken | undefined {
    return tokens[pos++];
  }

  function parseExpression(): number | null {
    let left = parseTerm();
    if (left === null) return null;

    while (true) {
      const next = peek();
      if (!next || next.kind !== 'op' || (next.op !== '+' && next.op !== '-')) break;
      consume();
      const right = parseTerm();
      if (right === null) return null;
      left = next.op === '+' ? left + right : left - right;
    }
    return left;
  }

  function parseTerm(): number | null {
    let left = parsePower();
    if (left === null) return null;

    while (true) {
      const next = peek();
      if (
        !next ||
        next.kind !== 'op' ||
        (next.op !== '*' && next.op !== '/' && next.op !== '%')
      ) {
        break;
      }
      consume();
      const right = parsePower();
      if (right === null) return null;
      if (next.op === '*') {
        left = left * right;
      } else if (next.op === '/') {
        if (right === 0) return null;
        left = left / right;
      } else {
        if (right === 0) return null;
        left = left % right;
      }
    }
    return left;
  }

  function parsePower(): number | null {
    const base = parseUnary();
    if (base === null) return null;
    const next = peek();
    if (next && next.kind === 'op' && next.op === '^') {
      consume();
      const exponent = parsePower(); /* Right-associative */
      if (exponent === null) return null;
      return Math.pow(base, exponent);
    }
    return base;
  }

  function parseUnary(): number | null {
    const next = peek();
    if (next && next.kind === 'op' && (next.op === '+' || next.op === '-')) {
      consume();
      const operand = parseUnary();
      if (operand === null) return null;
      return next.op === '-' ? -operand : operand;
    }
    return parsePrimary();
  }

  function parsePrimary(): number | null {
    const next = peek();
    if (!next) return null;
    if (next.kind === 'num') {
      consume();
      return next.value;
    }
    if (next.kind === 'lparen') {
      consume();
      const inner = parseExpression();
      if (inner === null) return null;
      const closing = consume();
      if (!closing || closing.kind !== 'rparen') return null;
      return inner;
    }
    return null;
  }

  const value = parseExpression();
  if (value === null || pos !== tokens.length || !Number.isFinite(value)) {
    return null;
  }

  const { rawValue, formattedValue } = formatMathValue(value);
  return {
    expression: trimmed,
    value: roundMathPrecision(value),
    rawValue,
    formattedValue,
  };
}

/* ── Multi-Signal Fuzzy & Token Search Scoring ────────────────────────────── */

function scoreSubsequence(needle: string, haystack: string): number {
  if (!needle || !haystack || needle.length > haystack.length) return 0;
  let nIdx = 0;
  let consecutive = 0;
  let bonus = 0;
  for (let hIdx = 0; hIdx < haystack.length && nIdx < needle.length; hIdx++) {
    if (haystack[hIdx] === needle[nIdx]) {
      nIdx++;
      consecutive++;
      if (hIdx === 0 || /[\s·\-_/]/.test(haystack[hIdx - 1])) {
        bonus += 8;
      } else if (consecutive > 1) {
        bonus += 4;
      }
    } else {
      consecutive = 0;
    }
  }
  return nIdx === needle.length ? 22 + Math.min(28, bonus) : 0;
}

/**
 * Scores a candidate item against a normalized search query.
 * Returns `0` when the candidate does not match all tokens in the query.
 */
export function scoreQueryMatch(
  rawQuery: string,
  title: string,
  subtitle: string,
  keywords = ''
): number {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return 1;

  const tLower = title.toLowerCase();
  const sLower = subtitle.toLowerCase();
  const kLower = keywords.toLowerCase();
  const combined = `${tLower} ${sLower} ${kLower}`;

  if (tLower === q) return 220;
  if (tLower.startsWith(q)) return 175;

  const wordBoundaryIdx = tLower.indexOf(` ${q}`);
  if (wordBoundaryIdx !== -1) return 150;

  if (tLower.includes(q)) return 130;

  const tokens = q.split(/\s+/).filter(Boolean);
  let totalScore = 0;

  for (const tok of tokens) {
    if (tLower === tok) {
      totalScore += 95;
    } else if (tLower.startsWith(tok)) {
      totalScore += 82;
    } else if (tLower.includes(` ${tok}`)) {
      totalScore += 72;
    } else if (tLower.includes(tok)) {
      totalScore += 60;
    } else if (kLower.includes(tok)) {
      totalScore += 45;
    } else if (sLower.includes(tok)) {
      totalScore += 38;
    } else {
      const fuzzyTitle = tok.length >= 2 ? scoreSubsequence(tok, tLower) : 0;
      if (fuzzyTitle > 0) {
        totalScore += fuzzyTitle;
      } else {
        return 0;
      }
    }
  }

  if (combined.includes(q)) {
    totalScore += 16;
  }

  return totalScore;
}

function extractMatchingSnippet(content: string, query: string): string | null {
  const q = query.trim().toLowerCase();
  if (!q) return null;
  const lines = content
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((line) =>
      line
        .replace(/^\s*#{1,6}\s+/, '')
        .replace(/^\s*[-*+]\s+\[([ xX])\]\s+/, '')
        .replace(/[*_`~]/g, '')
        .trim()
    )
    .filter(Boolean);

  const tokens = q.split(/\s+/).filter(Boolean);
  const hit =
    lines.find((line) => line.toLowerCase().includes(q)) ??
    lines.find((line) => tokens.some((tok) => tok.length >= 2 && line.toLowerCase().includes(tok)));

  if (!hit) return null;
  return hit.length > 76 ? `${hit.slice(0, 75).trimEnd()}…` : hit;
}

function describeWindowState(win: DesktopWindow, isActive: boolean): string {
  const parts: string[] = [];
  if (isActive && win.status !== 'minimized') parts.push('Active');
  if (win.status === 'minimized') parts.push('Minimized');
  else if (win.status === 'maximized') parts.push('Maximized');
  else if (win.snapZone === 'left') parts.push('Left split');
  else if (win.snapZone === 'right') parts.push('Right split');
  else parts.push('Floating window');
  return parts.join(' · ');
}

const SECTION_LABELS: Record<SpotlightSectionId, string> = {
  math: 'Instant Answer',
  windows: 'Open Windows',
  apps: 'Applications & Shortcuts',
  notes: 'Scratchpad Notes',
  query: 'Web & Quick Capture',
  actions: 'Workspace Commands',
};

const SECTION_ORDER: SpotlightSectionId[] = [
  'math',
  'windows',
  'apps',
  'notes',
  'query',
  'actions',
];

/* ── Main Spotlight Index & Query Engine ──────────────────────────────────── */

export function buildSpotlightResults(ctx: SpotlightContext): SpotlightResults {
  const trimmedQuery = ctx.query.trim();
  const hasQuery = trimmedQuery.length > 0;
  const now = ctx.now ?? Date.now();

  const candidates: SpotlightItem[] = [];

  /* 1. Safe Math / Percentage Calculator */
  if (hasQuery) {
    const math = evaluateMathExpression(trimmedQuery);
    if (math) {
      candidates.push({
        id: 'math:eval',
        section: 'math',
        filterGroup: 'actions',
        title: math.formattedValue,
        subtitle: `${math.expression} · Copy result to clipboard`,
        keywords: 'calculator math compute',
        iconKind: 'calculator',
        actionLabel: 'Copy',
        mathDisplay: `= ${math.formattedValue}`,
        score: 500,
        command: {
          type: 'copy-math',
          rawValue: math.rawValue,
          formattedValue: math.formattedValue,
        },
      });
    }
  }

  /* 2. Open Windows & Tiling Controls */
  const orderedWindows = [...ctx.windows].reverse();
  orderedWindows.forEach((win, idx) => {
    const appDef = ctx.apps.find((a) => a.id === win.appId);
    const isActive = win.id === ctx.activeWindowId;
    const statusText = describeWindowState(win, isActive);
    const matchScore = hasQuery
      ? scoreQueryMatch(
          trimmedQuery,
          win.title,
          statusText,
          `window focus switch restore ${appDef?.name ?? ''}`
        )
      : 100 - idx;

    if (matchScore > 0) {
      candidates.push({
        id: `window:focus:${win.id}`,
        section: 'windows',
        filterGroup: 'windows',
        title: win.title,
        subtitle: statusText,
        keywords: `window open switch focus ${win.appId}`,
        iconKind: appDef ? 'app' : 'window',
        app: appDef,
        actionLabel: win.status === 'minimized' ? 'Restore' : 'Focus',
        score: hasQuery ? matchScore + (isActive ? 4 : 8) : matchScore,
        command: { type: 'focus-window', windowId: win.id },
      });
    }
  });

  const activeWindow = ctx.windows.find(
    (w) => w.id === ctx.activeWindowId && w.status !== 'minimized'
  );

  if (activeWindow) {
    const windowCommands: Array<{
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      iconKind: SpotlightIconKind;
      shortcutKeys?: string[];
      defaultVisible: boolean;
      command: SpotlightCommandPayload;
    }> = [
      {
        id: 'window:snap-left',
        title: 'Tile Active Window Left',
        subtitle: `${activeWindow.title} · 50% left split`,
        keywords: 'snap split left half tile window',
        iconKind: 'tile-left',
        shortcutKeys: ['Alt', '['],
        defaultVisible: true,
        command: { type: 'snap-active-window', zone: 'left' },
      },
      {
        id: 'window:snap-right',
        title: 'Tile Active Window Right',
        subtitle: `${activeWindow.title} · 50% right split`,
        keywords: 'snap split right half tile window',
        iconKind: 'tile-right',
        shortcutKeys: ['Alt', ']'],
        defaultVisible: true,
        command: { type: 'snap-active-window', zone: 'right' },
      },
      {
        id: 'window:maximize',
        title: 'Maximize Active Window',
        subtitle: `${activeWindow.title} · Fill workspace canvas`,
        keywords: 'maximize fullscreen expand snap top window',
        iconKind: 'maximize',
        shortcutKeys: ['Alt', '↑'],
        defaultVisible: false,
        command: { type: 'snap-active-window', zone: 'top' },
      },
      {
        id: 'window:restore',
        title: 'Restore Floating Window Bounds',
        subtitle: `${activeWindow.title} · Exit split or maximized state`,
        keywords: 'restore unsnap float center window',
        iconKind: 'restore',
        shortcutKeys: ['Alt', '↓'],
        defaultVisible: Boolean(activeWindow.snapZone || activeWindow.status === 'maximized'),
        command: { type: 'unsnap-active-window' },
      },
      {
        id: 'window:minimize-active',
        title: 'Minimize Active Window',
        subtitle: `${activeWindow.title} · Hide to dock`,
        keywords: 'minimize hide dock window',
        iconKind: 'minimize',
        defaultVisible: false,
        command: { type: 'minimize-active-window' },
      },
      {
        id: 'window:close-active',
        title: 'Close Active Window',
        subtitle: `${activeWindow.title}`,
        keywords: 'close quit dismiss window',
        iconKind: 'close',
        defaultVisible: false,
        command: { type: 'close-active-window' },
      },
    ];

    for (const wc of windowCommands) {
      if (!hasQuery && ctx.filter === 'all' && !wc.defaultVisible) continue;
      const score = hasQuery
        ? scoreQueryMatch(trimmedQuery, wc.title, wc.subtitle, wc.keywords)
        : 62;
      if (score > 0) {
        candidates.push({
          id: wc.id,
          section: 'windows',
          filterGroup: 'windows',
          title: wc.title,
          subtitle: wc.subtitle,
          keywords: wc.keywords,
          iconKind: wc.iconKind,
          shortcutKeys: wc.shortcutKeys,
          actionLabel: 'Run',
          score,
          command: wc.command,
        });
      }
    }
  }

  if (ctx.windows.length > 1) {
    const bulkWinCommands: Array<{
      id: string;
      title: string;
      subtitle: string;
      keywords: string;
      iconKind: SpotlightIconKind;
      command: SpotlightCommandPayload;
    }> = [
      {
        id: 'window:minimize-all',
        title: 'Minimize All Windows',
        subtitle: `Show clean desktop · ${ctx.windows.length} windows open`,
        keywords: 'minimize all show desktop hide windows',
        iconKind: 'minimize',
        command: { type: 'minimize-all-windows' },
      },
      {
        id: 'window:close-all',
        title: 'Close All Open Windows',
        subtitle: `Close all ${ctx.windows.length} open windows`,
        keywords: 'close all windows clear workspace quit',
        iconKind: 'close',
        command: { type: 'close-all-windows' },
      },
    ];

    for (const bwc of bulkWinCommands) {
      if (!hasQuery && ctx.filter === 'all') continue;
      const score = hasQuery
        ? scoreQueryMatch(trimmedQuery, bwc.title, bwc.subtitle, bwc.keywords)
        : 50;
      if (score > 0) {
        candidates.push({
          id: bwc.id,
          section: 'windows',
          filterGroup: 'windows',
          title: bwc.title,
          subtitle: bwc.subtitle,
          keywords: bwc.keywords,
          iconKind: bwc.iconKind,
          actionLabel: 'Run',
          score,
          command: bwc.command,
        });
      }
    }
  }

  /* 3. Core Workspace Apps & Saved Web Shortcuts */
  ctx.apps.forEach((app, idx) => {
    const host = app.shortcut ? extractHostname(app.shortcut.url) : '';
    const extraKeywords =
      app.id === 'notes'
        ? 'scratchpad markdown todo checklist memo editor'
        : app.id === 'browser'
          ? 'web internet search gemini tabs url'
          : app.id === 'bookmarks'
            ? 'shortcuts links bookmarks saved urls'
            : app.id === 'widgets'
              ? 'studio custom html css js code widget'
              : app.id === 'settings'
                ? 'preferences theme wallpaper privacy backup'
                : `${host} ${app.shortcut?.url ?? ''} shortcut`;

    const score = hasQuery
      ? scoreQueryMatch(trimmedQuery, app.name, app.description, extraKeywords)
      : 90 - idx;

    if (score > 0) {
      const isAlreadyOpen = ctx.windows.some((w) => w.appId === app.id);
      candidates.push({
        id: `app:${app.id}`,
        section: 'apps',
        filterGroup: 'apps',
        title: app.name,
        subtitle: isAlreadyOpen ? `${app.description} · Open` : app.description,
        keywords: extraKeywords,
        iconKind: 'app',
        app,
        actionLabel: isAlreadyOpen ? 'Switch' : 'Open',
        score: hasQuery ? score + (app.category !== 'shortcut' ? 8 : 4) : score,
        command: { type: 'open-app', appId: app.id },
      });
    }
  });

  /* 4. Scratchpad Multi-Note Index & Note Creation */
  const sortedNotes = sortNotesForSidebar(ctx.notes);
  sortedNotes.forEach((note, idx) => {
    if (!hasQuery && ctx.filter === 'all' && idx >= 4) return;

    const noteTitle = extractNoteTitle(note.title, note.content);
    const stats = computeNoteStats(note.content);
    const metaParts: string[] = [];
    if (note.pinned) metaParts.push('Pinned');
    if (stats.tasksTotal > 0) {
      metaParts.push(`${stats.tasksCompleted}/${stats.tasksTotal} tasks`);
    }
    metaParts.push(formatRelativeNoteTime(note.updatedAt, now));

    const matchingSnippet = hasQuery ? extractMatchingSnippet(note.content, trimmedQuery) : null;
    const defaultSnippet = extractNoteSnippet(note.content, note.title);
    const snippetText =
      matchingSnippet ?? (defaultSnippet !== 'Empty note' ? defaultSnippet : '');
    const subtitle = snippetText
      ? `${metaParts.join(' · ')} — ${snippetText}`
      : metaParts.join(' · ');

    const score = hasQuery
      ? scoreQueryMatch(trimmedQuery, noteTitle, subtitle, `note scratchpad ${note.content}`)
      : 80 - idx;

    if (score > 0) {
      candidates.push({
        id: `note:${note.id}`,
        section: 'notes',
        filterGroup: 'notes',
        title: noteTitle,
        subtitle,
        keywords: 'note scratchpad markdown',
        iconKind: stats.tasksTotal > 0 ? 'checklist' : 'note',
        actionLabel: 'Open note',
        score: hasQuery ? score + (note.pinned ? 3 : 0) : score,
        command: { type: 'open-note', noteId: note.id },
      });
    }
  });

  /* Static Note Creation Commands */
  const newNoteCommands: Array<{
    id: string;
    title: string;
    subtitle: string;
    keywords: string;
    iconKind: SpotlightIconKind;
    defaultAllVisible: boolean;
    command: SpotlightCommandPayload;
  }> = [
    {
      id: 'note:create-blank',
      title: 'New Scratchpad Note',
      subtitle: 'Create a fresh Markdown note in Scratchpad',
      keywords: 'new note create scratchpad draft memo markdown',
      iconKind: 'note-new',
      defaultAllVisible: true,
      command: { type: 'create-note' },
    },
    {
      id: 'note:create-checklist',
      title: 'New Checklist Note',
      subtitle: 'Start an interactive task list in Scratchpad',
      keywords: 'new checklist todo tasks scratchpad list',
      iconKind: 'checklist',
      defaultAllVisible: false,
      command: { type: 'create-note', checklist: true },
    },
  ];

  for (const nc of newNoteCommands) {
    if (!hasQuery && ctx.filter === 'all' && !nc.defaultAllVisible) continue;
    const score = hasQuery
      ? scoreQueryMatch(trimmedQuery, nc.title, nc.subtitle, nc.keywords)
      : 74;
    if (score > 0) {
      candidates.push({
        id: nc.id,
        section: 'notes',
        filterGroup: 'notes',
        title: nc.title,
        subtitle: nc.subtitle,
        keywords: nc.keywords,
        iconKind: nc.iconKind,
        actionLabel: 'Create',
        score,
        command: nc.command,
      });
    }
  }

  /* 5. Workspace, Theme, Wallpaper & System Commands */
  const currentWallpaperName =
    ctx.wallpapers.find((w) => w.id === ctx.wallpaper)?.name ?? ctx.wallpaper;

  const systemActions: Array<{
    id: string;
    title: string;
    subtitle: string;
    keywords: string;
    iconKind: SpotlightIconKind;
    shortcutKeys?: string[];
    wallpaperSwatchId?: string;
    defaultAllVisible: boolean;
    command: SpotlightCommandPayload;
  }> = [
    {
      id: 'action:toggle-theme',
      title: ctx.theme === 'dark' ? 'Switch to Light Mode' : 'Switch to Dark Mode',
      subtitle: `Appearance · Currently ${ctx.theme} theme`,
      keywords: 'theme dark light mode appearance toggle night day',
      iconKind: 'theme',
      defaultAllVisible: true,
      command: { type: 'toggle-theme' },
    },
    {
      id: 'action:toggle-arrange',
      title: ctx.arrangeMode ? 'Finish Arranging Desktop' : 'Arrange Desktop Icons & Widgets',
      subtitle: ctx.arrangeMode
        ? 'Exit grid arrange mode'
        : 'Drag desktop shortcuts and resize custom widgets',
      keywords: 'arrange desktop grid move resize icons widgets layout',
      iconKind: 'arrange',
      shortcutKeys: ['F2'],
      defaultAllVisible: true,
      command: { type: 'toggle-arrange' },
    },
    {
      id: 'action:next-wallpaper',
      title: 'Cycle Next Wallpaper',
      subtitle: `Current palette · ${currentWallpaperName}`,
      keywords: 'wallpaper background next cycle ambient color',
      iconKind: 'wallpaper',
      wallpaperSwatchId: ctx.wallpaper,
      defaultAllVisible: true,
      command: { type: 'next-wallpaper' },
    },
    {
      id: 'action:export-backup',
      title: 'Export Workspace Backup (JSON)',
      subtitle: 'Download shortcuts, notes, widgets, and preferences',
      keywords: 'export backup save download json workspace snapshot',
      iconKind: 'download',
      defaultAllVisible: true,
      command: { type: 'export-workspace' },
    },
    {
      id: 'action:changelog',
      title: 'Open Release Notes & Changelog',
      subtitle: `Nexus ${ctx.versionTag} · View product history`,
      keywords: `changelog release notes version whats new ${ctx.versionTag}`,
      iconKind: 'changelog',
      defaultAllVisible: true,
      command: { type: 'open-changelog' },
    },
    {
      id: 'action:toggle-seconds',
      title: ctx.showSeconds ? 'Hide Seconds in Tray Clock' : 'Show Seconds in Tray Clock',
      subtitle: 'Toggle live seconds readout in bottom-right tray',
      keywords: 'clock time seconds tray toggle',
      iconKind: 'clock',
      defaultAllVisible: false,
      command: { type: 'toggle-seconds' },
    },
    {
      id: 'action:toggle-messages',
      title: ctx.showMessages ? 'Hide Rotating Desktop Quotes' : 'Show Rotating Desktop Quotes',
      subtitle: 'Toggle ambient editorial messages on the desktop',
      keywords: 'messages quotes desktop hide show ambient',
      iconKind: 'message',
      defaultAllVisible: false,
      command: { type: 'toggle-messages' },
    },
    {
      id: 'action:toggle-restore-session',
      title: ctx.restoreSession
        ? 'Disable Window Session Restore'
        : 'Enable Window Session Restore',
      subtitle: 'Persist open windows and split-screen tiles across new tabs',
      keywords: 'session restore startup windows persist remember',
      iconKind: 'session',
      defaultAllVisible: false,
      command: { type: 'toggle-restore-session' },
    },
    ctx.hasPassword
      ? {
          id: 'action:lock-screen',
          title: 'Lock Workspace Now',
          subtitle: 'Return immediately to the passcode lock screen',
          keywords: 'lock screen privacy security sign out passcode',
          iconKind: 'lock',
          defaultAllVisible: true,
          command: { type: 'lock-screen' },
        }
      : {
          id: 'action:setup-passcode',
          title: 'Set Workspace Passcode',
          subtitle: 'Configure a local PBKDF2 privacy lock screen',
          keywords: 'passcode password lock security privacy setup',
          iconKind: 'lock',
          defaultAllVisible: false,
          command: { type: 'setup-passcode' },
        },
    {
      id: 'action:open-launcher',
      title: 'Open All Apps Drawer',
      subtitle: 'Browse workspace apps and manage desktop/dock pins',
      keywords: 'launcher drawer apps menu grid pin',
      iconKind: 'launcher',
      defaultAllVisible: false,
      command: { type: 'open-launcher' },
    },
  ];

  /* Individual named Wallpapers */
  for (const wp of ctx.wallpapers) {
    const isCurrent = wp.id === ctx.wallpaper;
    systemActions.push({
      id: `action:wallpaper:${wp.id}`,
      title: `Wallpaper: ${wp.name}`,
      subtitle: isCurrent ? 'Current ambient wallpaper' : 'Apply ambient desktop palette',
      keywords: `wallpaper background palette theme ${wp.name} ${wp.id}`,
      iconKind: 'wallpaper',
      wallpaperSwatchId: wp.id,
      defaultAllVisible: false,
      command: { type: 'set-wallpaper', wallpaperId: wp.id },
    });
  }

  systemActions.forEach((act, idx) => {
    if (!hasQuery && ctx.filter === 'all' && !act.defaultAllVisible) return;
    const score = hasQuery
      ? scoreQueryMatch(trimmedQuery, act.title, act.subtitle, act.keywords)
      : 60 - idx;
    if (score > 0) {
      candidates.push({
        id: act.id,
        section: 'actions',
        filterGroup: 'actions',
        title: act.title,
        subtitle: act.subtitle,
        keywords: act.keywords,
        iconKind: act.iconKind,
        shortcutKeys: act.shortcutKeys,
        wallpaperSwatchId: act.wallpaperSwatchId,
        actionLabel: 'Run',
        score,
        command: act.command,
      });
    }
  });

  /* 6. Query-Driven Deep Actions (URL open, Gemini/Web search, Quick Note capture) */
  if (hasQuery) {
    const omnibox = classifyOmniboxInput(trimmedQuery);
    if (omnibox?.kind === 'url') {
      const host = extractHostname(omnibox.url) || omnibox.url;
      candidates.push({
        id: 'query:browser-url',
        section: 'query',
        filterGroup: 'apps',
        title: `Open ${host} in Nexus Browser`,
        subtitle: omnibox.url,
        keywords: 'url open browser visit website',
        iconKind: 'globe',
        actionLabel: 'Open URL',
        score: 210,
        command: { type: 'browser-url', url: omnibox.url, title: host },
      });
      candidates.push({
        id: 'query:external-url',
        section: 'query',
        filterGroup: 'actions',
        title: `Open ${host} in External Browser Tab`,
        subtitle: `${omnibox.url} · Launches in new tab`,
        keywords: 'url external new tab browser',
        iconKind: 'external',
        actionLabel: 'New tab',
        score: 185,
        command: { type: 'open-external-url', url: omnibox.url },
      });
    } else {
      const cleanQuery = trimmedQuery.startsWith('?')
        ? trimmedQuery.slice(1).trim()
        : trimmedQuery;
      if (cleanQuery) {
        candidates.push({
          id: 'query:gemini-search',
          section: 'query',
          filterGroup: 'actions',
          title: `Ask Gemini & Web Search for "${cleanQuery}"`,
          subtitle: 'Nexus Browser · Live web sources + AI overview',
          keywords: 'search web gemini ai browser internet',
          iconKind: 'sparkles',
          actionLabel: 'Search',
          score: 36,
          command: { type: 'browser-search', query: cleanQuery, engine: 'ai' },
        });
        candidates.push({
          id: 'query:web-search',
          section: 'query',
          filterGroup: 'actions',
          title: `Search Web Results for "${cleanQuery}"`,
          subtitle: 'Nexus Browser · Organic web links',
          keywords: 'search web links browser',
          iconKind: 'globe',
          actionLabel: 'Web results',
          score: 32,
          command: { type: 'browser-search', query: cleanQuery, engine: 'web' },
        });
        candidates.push({
          id: 'query:create-titled-note',
          section: 'query',
          filterGroup: 'notes',
          title: `Create Scratchpad Note "${cleanQuery}"`,
          subtitle: 'Scratchpad · New Markdown note with this title',
          keywords: 'note create capture scratchpad',
          iconKind: 'note-new',
          actionLabel: 'Create note',
          score: 30,
          command: { type: 'create-note', title: cleanQuery },
        });
      }
    }
  }

  /* Compute per-filter counts before applying the active tab filter */
  const counts: Record<SpotlightFilter, number> = {
    all: candidates.length,
    apps: candidates.filter((c) => c.filterGroup === 'apps').length,
    notes: candidates.filter((c) => c.filterGroup === 'notes').length,
    windows: candidates.filter((c) => c.filterGroup === 'windows').length,
    actions: candidates.filter((c) => c.filterGroup === 'actions').length,
  };

  const filtered =
    ctx.filter === 'all'
      ? candidates
      : candidates.filter((item) => item.filterGroup === ctx.filter);

  /* When searching with a query, sort globally by relevance score while preserving clean grouping or direct rank */
  if (hasQuery) {
    filtered.sort((a, b) => b.score - a.score);

    /* Group into ordered sections while ordering sections by their highest-scoring item! */
    const bySection = new Map<SpotlightSectionId, SpotlightItem[]>();
    for (const item of filtered) {
      const bucket = bySection.get(item.section);
      if (bucket) bucket.push(item);
      else bySection.set(item.section, [item]);
    }

    const orderedSections: SpotlightSection[] = [...bySection.entries()]
      .sort((a, b) => (b[1][0]?.score ?? 0) - (a[1][0]?.score ?? 0))
      .map(([id, sectionItems]) => ({
        id,
        label: SECTION_LABELS[id],
        items: sectionItems,
      }));

    const flatItems = orderedSections.flatMap((sec) => sec.items);
    return { items: flatItems, sections: orderedSections, counts };
  }

  /* Empty query: preserve natural workspace section order */
  const orderedSections: SpotlightSection[] = [];
  for (const secId of SECTION_ORDER) {
    const secItems = filtered
      .filter((item) => item.section === secId)
      .sort((a, b) => b.score - a.score);
    if (secItems.length > 0) {
      orderedSections.push({
        id: secId,
        label: SECTION_LABELS[secId],
        items: secItems,
      });
    }
  }

  const flatItems = orderedSections.flatMap((sec) => sec.items);
  return { items: flatItems, sections: orderedSections, counts };
}
