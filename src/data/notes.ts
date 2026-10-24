export const LEGACY_NOTES_KEY = 'nexus.scratchpad.v1';
export const NOTES_STORAGE_KEY = 'nexus.notes.v2';

export interface ScratchpadNote {
  id: string;
  title: string;
  content: string;
  pinned: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface NotesState {
  notes: ScratchpadNote[];
  activeNoteId: string;
}

export interface NoteStats {
  words: number;
  chars: number;
  tasksTotal: number;
  tasksCompleted: number;
}

export type InlineToken =
  | { type: 'text'; value: string }
  | { type: 'strong'; children: InlineToken[] }
  | { type: 'em'; children: InlineToken[] }
  | { type: 'del'; children: InlineToken[] }
  | { type: 'code'; value: string }
  | { type: 'link'; label: string; href: string };

export interface MarkdownTaskItem {
  lineIndex: number;
  checked: boolean;
  indent: number;
  tokens: InlineToken[];
}

export type MarkdownBlock =
  | { type: 'heading'; level: 1 | 2 | 3 | 4; tokens: InlineToken[] }
  | { type: 'paragraph'; lines: InlineToken[][] }
  | { type: 'task-list'; items: MarkdownTaskItem[] }
  | { type: 'unordered-list'; items: InlineToken[][] }
  | { type: 'ordered-list'; start: number; items: InlineToken[][] }
  | { type: 'blockquote'; lines: InlineToken[][] }
  | { type: 'code-block'; language: string; code: string }
  | { type: 'hr' };

const TASK_LINE_RE = /^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/;
const UL_LINE_RE = /^(\s*)[-*+]\s+(.*)$/;
const OL_LINE_RE = /^(\s*)(\d+)\.\s+(.*)$/;
const HEADING_RE = /^(#{1,4})\s+(.*)$/;
const HR_RE = /^\s*(?:---+|___+|\*\*\*+)\s*$/;
const FENCE_RE = /^```([\w+-]*)\s*$/;

function generateNoteId(): string {
  return `note-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}

export function createScratchpadNote(partial?: Partial<ScratchpadNote>): ScratchpadNote {
  const now = Date.now();
  return {
    id: partial?.id && partial.id.trim() ? partial.id.trim() : generateNoteId(),
    title: typeof partial?.title === 'string' ? partial.title.slice(0, 140) : '',
    content: typeof partial?.content === 'string' ? partial.content.slice(0, 200_000) : '',
    pinned: partial?.pinned === true,
    createdAt:
      typeof partial?.createdAt === 'number' && Number.isFinite(partial.createdAt)
        ? partial.createdAt
        : now,
    updatedAt:
      typeof partial?.updatedAt === 'number' && Number.isFinite(partial.updatedAt)
        ? partial.updatedAt
        : now,
  };
}

export function sanitizeNotesState(raw: unknown): NotesState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (!Array.isArray(obj.notes)) return null;

  const seen = new Set<string>();
  const notes: ScratchpadNote[] = [];

  for (const entry of obj.notes) {
    if (!entry || typeof entry !== 'object') continue;
    const n = entry as Partial<ScratchpadNote>;
    if (typeof n.id !== 'string' || !n.id.trim() || seen.has(n.id)) continue;
    if (typeof n.content !== 'string') continue;
    seen.add(n.id);
    notes.push(createScratchpadNote(n));
    if (notes.length >= 200) break;
  }

  if (notes.length === 0) return null;

  const requestedActive = typeof obj.activeNoteId === 'string' ? obj.activeNoteId : '';
  const activeNoteId = notes.some((n) => n.id === requestedActive) ? requestedActive : notes[0].id;

  return { notes, activeNoteId };
}

export function readNotesState(): NotesState {
  try {
    const rawV2 = localStorage.getItem(NOTES_STORAGE_KEY);
    if (rawV2) {
      const parsed = sanitizeNotesState(JSON.parse(rawV2));
      if (parsed) return parsed;
    }
  } catch {
    /* Fall back to legacy scratchpad or fresh note */
  }

  let legacyContent = '';
  try {
    legacyContent = localStorage.getItem(LEGACY_NOTES_KEY) ?? '';
  } catch {
    legacyContent = '';
  }

  const initialNote = createScratchpadNote({
    content: legacyContent,
  });

  return {
    notes: [initialNote],
    activeNoteId: initialNote.id,
  };
}

export function readStoredNotesStateForBackup(): NotesState | undefined {
  try {
    const rawV2 = localStorage.getItem(NOTES_STORAGE_KEY);
    if (!rawV2) return undefined;
    const parsed = sanitizeNotesState(JSON.parse(rawV2));
    return parsed ?? undefined;
  } catch {
    return undefined;
  }
}

export function saveNotesState(state: NotesState): void {
  const active =
    state.notes.find((n) => n.id === state.activeNoteId) ?? state.notes[0];
  try {
    localStorage.setItem(NOTES_STORAGE_KEY, JSON.stringify(state));
    localStorage.setItem(LEGACY_NOTES_KEY, active ? active.content : '');
  } catch {
    /* Ignore quota errors */
  }
}

export function sortNotesForSidebar(notes: readonly ScratchpadNote[]): ScratchpadNote[] {
  return [...notes].sort((a, b) => {
    if (a.pinned !== b.pinned) return a.pinned ? -1 : 1;
    return b.updatedAt - a.updatedAt;
  });
}

function stripMarkdownFormatting(line: string): string {
  return line
    .replace(/^#{1,6}\s+/, '')
    .replace(/^\s*[-*+]\s+\[[ xX]\]\s*/, '')
    .replace(/^\s*[-*+]\s+/, '')
    .replace(/^\s*\d+\.\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(\*\*|__|~~|\*|_ |`)/g, '')
    .trim();
}

export function extractNoteTitle(explicitTitle: string, content: string): string {
  const trimmedTitle = explicitTitle.trim();
  if (trimmedTitle) return trimmedTitle;

  const lines = content.split(/\r?\n/);
  for (const rawLine of lines) {
    const cleaned = stripMarkdownFormatting(rawLine);
    if (cleaned) {
      return cleaned.length > 56 ? `${cleaned.slice(0, 56).trimEnd()}…` : cleaned;
    }
  }
  return 'Untitled note';
}

export function extractNoteSnippet(explicitTitle: string, content: string): string {
  const lines = content.split(/\r?\n/);
  let skippedTitleLine = Boolean(explicitTitle.trim());

  for (const rawLine of lines) {
    if (FENCE_RE.test(rawLine.trim()) || HR_RE.test(rawLine)) continue;
    const cleaned = stripMarkdownFormatting(rawLine);
    if (!cleaned) continue;
    if (!skippedTitleLine) {
      skippedTitleLine = true;
      continue;
    }
    return cleaned.length > 72 ? `${cleaned.slice(0, 72).trimEnd()}…` : cleaned;
  }

  return 'No additional text';
}

export function computeNoteStats(content: string): NoteStats {
  const trimmed = content.trim();
  const words = trimmed ? trimmed.split(/\s+/).length : 0;
  const chars = content.length;

  let tasksTotal = 0;
  let tasksCompleted = 0;
  const lines = content.split(/\r?\n/);
  let inFence = false;

  for (const line of lines) {
    if (FENCE_RE.test(line.trim())) {
      inFence = !inFence;
      continue;
    }
    if (inFence) continue;
    const match = TASK_LINE_RE.exec(line);
    if (match) {
      tasksTotal += 1;
      if (match[3].toLowerCase() === 'x') {
        tasksCompleted += 1;
      }
    }
  }

  return { words, chars, tasksTotal, tasksCompleted };
}

export function toggleChecklistLine(markdown: string, lineIndex: number): string {
  const lines = markdown.split('\n');
  if (lineIndex < 0 || lineIndex >= lines.length) return markdown;

  const rawLine = lines[lineIndex];
  const hasCr = rawLine.endsWith('\r');
  const cleanLine = hasCr ? rawLine.slice(0, -1) : rawLine;

  const match = TASK_LINE_RE.exec(cleanLine);
  if (!match) return markdown;

  const [, indent, bullet, stateChar, rest] = match;
  const nextChar = stateChar.toLowerCase() === 'x' ? ' ' : 'x';
  const updated = `${indent}${bullet} [${nextChar}]${rest ? ` ${rest}` : ' '}`;
  lines[lineIndex] = hasCr ? `${updated}\r` : updated;
  return lines.join('\n');
}

export function clearCompletedTasks(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  let inFence = false;
  const kept: string[] = [];

  for (const line of lines) {
    if (FENCE_RE.test(line.trim())) {
      inFence = !inFence;
      kept.push(line);
      continue;
    }
    if (!inFence) {
      const match = TASK_LINE_RE.exec(line);
      if (match && match[3].toLowerCase() === 'x') {
        continue;
      }
    }
    kept.push(line);
  }

  return kept.join('\n');
}

export function slugifyNoteFilename(explicitTitle: string, content: string): string {
  const base = extractNoteTitle(explicitTitle, content)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 48);

  return `${base || 'scratchpad-note'}.md`;
}

export function formatRelativeNoteTime(timestamp: number, now = Date.now()): string {
  const diffSec = Math.max(0, Math.floor((now - timestamp) / 1000));
  if (diffSec < 45) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDays = Math.floor(diffHr / 24);
  if (diffDays < 7) return `${diffDays}d ago`;

  try {
    return new Date(timestamp).toLocaleDateString(undefined, {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return 'Saved';
  }
}

function sanitizeHref(rawHref: string): string | null {
  const trimmed = rawHref.trim();
  if (!trimmed) return null;
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'http:' || parsed.protocol === 'https:' || parsed.protocol === 'mailto:') {
      return parsed.toString();
    }
    return null;
  } catch {
    return null;
  }
}

export function parseInlineTokens(text: string): InlineToken[] {
  const tokens: InlineToken[] = [];
  const pattern =
    /(`([^`]+)`)|(\[([^\]]+)\]\(([^)\s]+)\))|(\*\*([^*]+)\*\*)|(~~([^~]+)~~)|(\*([^*]+)\*)/g;

  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      tokens.push({ type: 'text', value: text.slice(lastIndex, match.index) });
    }

    if (match[1] !== undefined) {
      tokens.push({ type: 'code', value: match[2] });
    } else if (match[3] !== undefined) {
      const safeHref = sanitizeHref(match[5]);
      if (safeHref) {
        tokens.push({ type: 'link', label: match[4], href: safeHref });
      } else {
        tokens.push({ type: 'text', value: match[0] });
      }
    } else if (match[6] !== undefined) {
      tokens.push({ type: 'strong', children: parseInlineTokens(match[7]) });
    } else if (match[8] !== undefined) {
      tokens.push({ type: 'del', children: parseInlineTokens(match[9]) });
    } else if (match[10] !== undefined) {
      tokens.push({ type: 'em', children: parseInlineTokens(match[11]) });
    }

    lastIndex = pattern.lastIndex;
  }

  if (lastIndex < text.length) {
    tokens.push({ type: 'text', value: text.slice(lastIndex) });
  }

  return tokens;
}

export function parseMarkdownBlocks(markdown: string): MarkdownBlock[] {
  const rawLines = markdown.split(/\r?\n/);
  const blocks: MarkdownBlock[] = [];
  let i = 0;

  while (i < rawLines.length) {
    const line = rawLines[i];

    /* Blank lines */
    if (!line.trim()) {
      i += 1;
      continue;
    }

    /* Fenced code block */
    const fenceMatch = FENCE_RE.exec(line.trim());
    if (fenceMatch) {
      const language = fenceMatch[1] || '';
      const codeLines: string[] = [];
      i += 1;
      while (i < rawLines.length && !FENCE_RE.test(rawLines[i].trim())) {
        codeLines.push(rawLines[i]);
        i += 1;
      }
      if (i < rawLines.length) i += 1; /* consume closing fence */
      blocks.push({ type: 'code-block', language, code: codeLines.join('\n') });
      continue;
    }

    /* Horizontal rule */
    if (HR_RE.test(line)) {
      blocks.push({ type: 'hr' });
      i += 1;
      continue;
    }

    /* Heading */
    const headingMatch = HEADING_RE.exec(line);
    if (headingMatch) {
      const level = Math.min(4, Math.max(1, headingMatch[1].length)) as 1 | 2 | 3 | 4;
      blocks.push({ type: 'heading', level, tokens: parseInlineTokens(headingMatch[2].trim()) });
      i += 1;
      continue;
    }

    /* Interactive task list */
    if (TASK_LINE_RE.test(line)) {
      const items: MarkdownTaskItem[] = [];
      while (i < rawLines.length) {
        const m = TASK_LINE_RE.exec(rawLines[i]);
        if (!m) break;
        items.push({
          lineIndex: i,
          checked: m[3].toLowerCase() === 'x',
          indent: Math.min(3, Math.floor(m[1].length / 2)),
          tokens: parseInlineTokens(m[4]),
        });
        i += 1;
      }
      blocks.push({ type: 'task-list', items });
      continue;
    }

    /* Blockquote */
    if (/^\s*>\s?/.test(line)) {
      const quoteLines: InlineToken[][] = [];
      while (i < rawLines.length && /^\s*>\s?/.test(rawLines[i])) {
        const content = rawLines[i].replace(/^\s*>\s?/, '');
        quoteLines.push(parseInlineTokens(content));
        i += 1;
      }
      blocks.push({ type: 'blockquote', lines: quoteLines });
      continue;
    }

    /* Unordered list (non-task) */
    if (UL_LINE_RE.test(line)) {
      const items: InlineToken[][] = [];
      while (i < rawLines.length && !TASK_LINE_RE.test(rawLines[i])) {
        const m = UL_LINE_RE.exec(rawLines[i]);
        if (!m) break;
        items.push(parseInlineTokens(m[2]));
        i += 1;
      }
      blocks.push({ type: 'unordered-list', items });
      continue;
    }

    /* Ordered list */
    const olFirst = OL_LINE_RE.exec(line);
    if (olFirst) {
      const start = Number.parseInt(olFirst[2], 10) || 1;
      const items: InlineToken[][] = [];
      while (i < rawLines.length) {
        const m = OL_LINE_RE.exec(rawLines[i]);
        if (!m) break;
        items.push(parseInlineTokens(m[3]));
        i += 1;
      }
      blocks.push({ type: 'ordered-list', start, items });
      continue;
    }

    /* Paragraph */
    const paraLines: InlineToken[][] = [];
    while (
      i < rawLines.length &&
      rawLines[i].trim() &&
      !FENCE_RE.test(rawLines[i].trim()) &&
      !HR_RE.test(rawLines[i]) &&
      !HEADING_RE.test(rawLines[i]) &&
      !TASK_LINE_RE.test(rawLines[i]) &&
      !UL_LINE_RE.test(rawLines[i]) &&
      !OL_LINE_RE.test(rawLines[i]) &&
      !/^\s*>\s?/.test(rawLines[i])
    ) {
      paraLines.push(parseInlineTokens(rawLines[i]));
      i += 1;
    }
    if (paraLines.length > 0) {
      blocks.push({ type: 'paragraph', lines: paraLines });
    }
  }

  return blocks;
}

export const SAMPLE_CHECKLIST_TEMPLATE = `# Today's Focus

- [ ] Review priority pull requests
- [ ] Draft weekly product notes
- [x] Organize workspace windows

## Quick Notes

Capture thoughts, **key decisions**, or \`snippets\` in plain Markdown. Switch to **Preview** or **Split** to check off tasks interactively.
`;
