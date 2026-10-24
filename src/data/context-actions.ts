import type { AppId } from '../window-manager/types';
import {
  classifyOmniboxInput,
  enqueueBrowserNavigation,
  formatTabTitleForUrl,
  type SearchEngineId,
} from './browser';
import {
  createScratchpadNote,
  readNotesState,
  saveNotesState,
  type ScratchpadNote,
} from './notes';
import { extractHostname } from './shortcuts';

/* ── Cross-Window App Handoff Event ───────────────────────────────────────── */

export const NEXUS_OPEN_APP_EVENT = 'nexus:open-app';

export interface OpenAppEventDetail {
  appId: AppId;
  preferExisting?: boolean;
}

export function requestOpenApp(
  appId: AppId,
  options?: { preferExisting?: boolean }
): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<OpenAppEventDetail>(NEXUS_OPEN_APP_EVENT, {
      detail: {
        appId,
        preferExisting: options?.preferExisting ?? true,
      },
    })
  );
}

/* ── Selection-to-Task / Checklist Conversion ─────────────────────────────── */

/**
 * Converts a single line of text or Markdown into an unchecked `- [ ] ` task item,
 * preserving leading whitespace indentation and stripping redundant list/heading/quote prefixes.
 * Blank lines are returned unchanged.
 */
export function convertLineToTaskItem(line: string): string {
  if (!line.trim()) return line;

  const indentMatch = /^(\s*)(.*)$/.exec(line);
  const indent = indentMatch ? indentMatch[1] : '';
  let body = (indentMatch ? indentMatch[2] : line).trim();

  // Strip existing checklist, bullet, numbered list, blockquote, or heading markers
  body = body
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
    .replace(/^[-*+•]\s+/, '')
    .replace(/^\d+[.)]\s+/, '')
    .replace(/^>\s*/, '')
    .replace(/^#{1,6}\s+/, '')
    .trim();

  if (!body) return line;
  return `${indent}- [ ] ${body}`;
}

/**
 * Converts arbitrary selected text (single line, paragraph, or multi-line list)
 * into clean Markdown checklist items (`- [ ] ...`).
 */
export function convertTextToTaskMarkdown(text: string): string {
  const nonEmptyLines = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .filter((line) => line.trim().length > 0);

  if (nonEmptyLines.length === 0) return '';

  const minIndent = nonEmptyLines.reduce((min, line) => {
    const match = /^(\s*)/.exec(line);
    const len = match ? match[1].length : 0;
    return Math.min(min, len);
  }, Number.POSITIVE_INFINITY);

  const sharedIndent = Number.isFinite(minIndent) ? minIndent : 0;

  return nonEmptyLines
    .map((raw) => convertLineToTaskItem(raw.slice(sharedIndent)))
    .filter((line) => line.trim().length > 0)
    .join('\n');
}

export interface RangeTaskConversionResult {
  content: string;
  nextSelectionStart: number;
  nextSelectionEnd: number;
  tasksCreated: number;
}

/**
 * Converts all lines touched by `[selectionStart, selectionEnd]` in a Markdown string
 * into `- [ ] ` task items in-place, returning the updated Markdown and updated selection offsets.
 */
export function convertRangeInMarkdownToTasks(
  markdown: string,
  selectionStart: number,
  selectionEnd: number
): RangeTaskConversionResult {
  const len = markdown.length;
  const clampedStart = Math.max(0, Math.min(selectionStart, len));
  let clampedEnd = Math.max(clampedStart, Math.min(selectionEnd, len));

  // If selection ends cleanly at column 0 of the following line, exclude that trailing newline
  if (clampedEnd > clampedStart && markdown[clampedEnd - 1] === '\n') {
    clampedEnd -= 1;
  }

  const lineStart = markdown.lastIndexOf('\n', Math.max(0, clampedStart - 1)) + 1;
  const nextNewlineIdx = markdown.indexOf('\n', clampedEnd);
  const lineEnd = nextNewlineIdx === -1 ? len : nextNewlineIdx;

  const block = markdown.slice(lineStart, lineEnd);
  const lines = block.split('\n');
  let tasksCreated = 0;

  const convertedLines = lines.map((line) => {
    if (!line.trim()) {
      // If cursor was on a single blank line with no selection, insert a ready-to-type task marker
      if (lines.length === 1 && selectionStart === selectionEnd) {
        tasksCreated += 1;
        return `${line}- [ ] `;
      }
      return line;
    }
    tasksCreated += 1;
    return convertLineToTaskItem(line);
  });

  const replacement = convertedLines.join('\n');
  const content = `${markdown.slice(0, lineStart)}${replacement}${markdown.slice(lineEnd)}`;

  return {
    content,
    nextSelectionStart: lineStart,
    nextSelectionEnd: lineStart + replacement.length,
    tasksCreated,
  };
}

function stripInlineMarkdownForMatch(line: string): string {
  return line
    .replace(/^(\s*)([-*+]\s+\[[ xX]\]\s+|[-*+•]\s+|\d+[.)]\s+|>\s*|#{1,6}\s+)/, '')
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '$1')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\*\*([^*]+)\*\*/g, '$1')
    .replace(/\*([^*]+)\*/g, '$1')
    .replace(/~~([^~]+)~~/g, '$1')
    .trim();
}

/**
 * Converts text selected inside Scratchpad's rendered Markdown Preview pane into task item(s).
 * Attempts an exact non-ambiguous line conversion in-place first; falls back to appending
 * checklist items cleanly to the end of the note.
 */
export function convertPreviewSelectionToTasksInMarkdown(
  markdown: string,
  selectedText: string
): { content: string; tasksCreated: number; mode: 'in-place' | 'appended' } {
  const selectedLines = selectedText
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);

  if (selectedLines.length === 0) {
    return { content: markdown, tasksCreated: 0, mode: 'in-place' };
  }

  const docLines = markdown.split('\n');
  const matchedIndices: number[] = [];
  let searchFrom = 0;

  for (const target of selectedLines) {
    let foundIdx = -1;
    for (let i = searchFrom; i < docLines.length; i += 1) {
      const plain = stripInlineMarkdownForMatch(docLines[i]);
      if (plain && (plain === target || (target.length >= 12 && plain.includes(target)))) {
        foundIdx = i;
        break;
      }
    }
    if (foundIdx === -1) {
      matchedIndices.length = 0;
      break;
    }
    matchedIndices.push(foundIdx);
    searchFrom = foundIdx + 1;
  }

  if (matchedIndices.length === selectedLines.length) {
    const nextLines = [...docLines];
    for (const idx of matchedIndices) {
      nextLines[idx] = convertLineToTaskItem(nextLines[idx]);
    }
    return {
      content: nextLines.join('\n'),
      tasksCreated: matchedIndices.length,
      mode: 'in-place',
    };
  }

  const taskBlock = convertTextToTaskMarkdown(selectedText);
  const taskCount = taskBlock ? taskBlock.split('\n').length : 0;
  const trimmedDoc = markdown.replace(/\s+$/, '');
  const content = trimmedDoc ? `${trimmedDoc}\n\n${taskBlock}` : taskBlock;

  return {
    content,
    tasksCreated: taskCount,
    mode: 'appended',
  };
}

/* ── Browser → Scratchpad Clipping & Task Capture ─────────────────────────── */

export interface BrowserSelectionSource {
  title?: string;
  url?: string;
  query?: string;
}

export function deriveNoteTitleFromSelection(text: string, fallback = 'Clipped note'): string {
  const firstLine = text
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean);

  if (!firstLine) return fallback;

  const cleaned = firstLine
    .replace(/^[-*+•>\d.)\s]+/, '')
    .replace(/[#*_`~]/g, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (!cleaned) return fallback;
  if (cleaned.length <= 52) return cleaned;

  const sliced = cleaned.slice(0, 52);
  const lastSpace = sliced.lastIndexOf(' ');
  return `${lastSpace > 24 ? sliced.slice(0, lastSpace) : sliced}…`;
}

export function formatBrowserSourceAttribution(source?: BrowserSelectionSource): string {
  if (!source) return '';
  const cleanUrl = source.url?.trim();
  const cleanTitle = source.title?.trim();
  const cleanQuery = source.query?.trim();

  if (cleanUrl) {
    const label = cleanTitle || extractHostname(cleanUrl) || cleanUrl;
    return `Source: [${label}](${cleanUrl})`;
  }
  if (cleanQuery) {
    return `Source: Browser research · “${cleanQuery}”`;
  }
  if (cleanTitle) {
    return `Source: ${cleanTitle}`;
  }
  return '';
}

/**
 * Formats a selected Browser paragraph or multi-line snippet into editorial Markdown
 * with clean blockquote lines and source attribution.
 */
export function formatBrowserClipMarkdown(
  text: string,
  source?: BrowserSelectionSource
): string {
  const normalized = text.replace(/\r\n/g, '\n').trim();
  if (!normalized) return '';

  const quotedLines = normalized
    .split('\n')
    .map((line) => {
      const trimmed = line.trim();
      return trimmed ? `> ${trimmed}` : '>';
    })
    .join('\n');

  const attribution = formatBrowserSourceAttribution(source);
  return attribution ? `${quotedLines}\n\n${attribution}` : quotedLines;
}

export type ScratchpadCaptureMode = 'append-note' | 'new-note' | 'append-task';

export interface ScratchpadCaptureResult {
  note: ScratchpadNote;
  mode: ScratchpadCaptureMode;
  addedTasks: number;
}

/**
 * Captures selected text into Scratchpad's persistent multi-note store and notifies
 * any mounted Scratchpad window to refresh live.
 */
export function sendSelectionToScratchpad(options: {
  text: string;
  mode: ScratchpadCaptureMode;
  source?: BrowserSelectionSource;
  openScratchpad?: boolean;
}): ScratchpadCaptureResult | null {
  const cleaned = options.text.replace(/\r\n/g, '\n').trim();
  if (!cleaned) return null;

  const state = readNotesState();
  const now = Date.now();

  let addedTasks = 0;
  let blockToInsert = '';

  if (options.mode === 'append-task') {
    const tasksMd = convertTextToTaskMarkdown(cleaned);
    if (!tasksMd) return null;
    addedTasks = tasksMd.split('\n').length;

    const cleanUrl = options.source?.url?.trim();
    if (cleanUrl && addedTasks === 1) {
      const label = options.source?.title?.trim() || extractHostname(cleanUrl) || 'source';
      blockToInsert = `${tasksMd} ([${label}](${cleanUrl}))`;
    } else {
      const attribution = formatBrowserSourceAttribution(options.source);
      blockToInsert = attribution ? `${tasksMd}\n  ${attribution}` : tasksMd;
    }
  } else {
    blockToInsert = formatBrowserClipMarkdown(cleaned, options.source);
  }

  if (!blockToInsert) return null;

  if (options.mode === 'new-note') {
    const fresh = createScratchpadNote({
      title: deriveNoteTitleFromSelection(cleaned, options.source?.title || 'Browser clip'),
      content: blockToInsert,
      createdAt: now,
      updatedAt: now,
    });
    saveNotesState({
      notes: [fresh, ...state.notes],
      activeNoteId: fresh.id,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    if (options.openScratchpad !== false) {
      requestOpenApp('notes', { preferExisting: true });
    }
    return { note: fresh, mode: options.mode, addedTasks };
  }

  const activeNote =
    state.notes.find((n) => n.id === state.activeNoteId) ?? state.notes[0];

  if (!activeNote) {
    const fallback = createScratchpadNote({
      title:
        options.mode === 'append-task'
          ? 'Tasks'
          : deriveNoteTitleFromSelection(cleaned, 'Browser clip'),
      content: blockToInsert,
      createdAt: now,
      updatedAt: now,
    });
    saveNotesState({ notes: [fallback], activeNoteId: fallback.id });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    if (options.openScratchpad !== false) {
      requestOpenApp('notes', { preferExisting: true });
    }
    return { note: fallback, mode: options.mode, addedTasks };
  }

  const existingTrimmed = activeNote.content.replace(/\s+$/, '');
  const nextContent = existingTrimmed
    ? `${existingTrimmed}\n\n${blockToInsert}`
    : blockToInsert;

  const updatedNote: ScratchpadNote = {
    ...activeNote,
    content: nextContent,
    updatedAt: now,
  };

  saveNotesState({
    notes: state.notes.map((n) => (n.id === activeNote.id ? updatedNote : n)),
    activeNoteId: activeNote.id,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }
  if (options.openScratchpad !== false) {
    requestOpenApp('notes', { preferExisting: true });
  }

  return { note: updatedNote, mode: options.mode, addedTasks };
}

/* ── Scratchpad → Browser Research Handoff ────────────────────────────────── */

export function normalizeResearchQuery(rawSelection: string, maxLength = 220): string {
  const compact = rawSelection
    .replace(/\r\n/g, ' ')
    .replace(/^[-*+]\s+\[[ xX]\]\s+/, '')
    .replace(/^[#>*`-\s]+/, '')
    .replace(/\s+/g, ' ')
    .trim();

  if (compact.length <= maxLength) return compact;
  const sliced = compact.slice(0, maxLength);
  const lastSpace = sliced.lastIndexOf(' ');
  return (lastSpace > 80 ? sliced.slice(0, lastSpace) : sliced).trim();
}

export function researchSelectionInBrowser(
  rawSelection: string,
  options?: {
    engine?: SearchEngineId;
    preferUrlIfValid?: boolean;
    openBrowserWindow?: boolean;
  }
): { kind: 'url' | 'search'; target: string } | null {
  const trimmed = rawSelection.trim();
  if (!trimmed) return null;

  const preferUrl = options?.preferUrlIfValid ?? true;
  const singleTokenCandidate = !/\s/.test(trimmed) ? classifyOmniboxInput(trimmed) : null;

  if (preferUrl && singleTokenCandidate?.kind === 'url') {
    enqueueBrowserNavigation({
      kind: 'url',
      url: singleTokenCandidate.url,
      title: formatTabTitleForUrl(singleTokenCandidate.url),
    });
    if (options?.openBrowserWindow !== false) {
      requestOpenApp('browser', { preferExisting: true });
    }
    return { kind: 'url', target: singleTokenCandidate.url };
  }

  const query = normalizeResearchQuery(trimmed);
  if (!query) return null;

  enqueueBrowserNavigation({
    kind: 'search',
    query,
    engine: options?.engine ?? 'ai',
  });
  if (options?.openBrowserWindow !== false) {
    requestOpenApp('browser', { preferExisting: true });
  }

  return { kind: 'search', target: query };
}

/* ── Clamped Floating Action Bar Positioning ──────────────────────────────── */

export interface AnchorBox {
  left: number;
  top: number;
  bottom: number;
  width: number;
}

export interface ContainerBox {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface FloatingBarPosition {
  x: number;
  y: number;
  placement: 'above' | 'below';
}

/**
 * Computes container-relative `(x, y)` coordinates for a floating selection action bar,
 * clamping horizontally so it never overflows the container edges and flipping below
 * the selection when near the top edge.
 */
export function computeFloatingBarPosition(
  anchor: AnchorBox,
  container: ContainerBox,
  barDimensions: { width?: number; height?: number } = {}
): FloatingBarPosition {
  const barWidth = barDimensions.width ?? 340;
  const barHeight = barDimensions.height ?? 38;
  const margin = 10;
  const gap = 8;

  const relCenterX = anchor.left - container.left + anchor.width / 2;
  const relTop = anchor.top - container.top;
  const relBottom = anchor.bottom - container.top;

  const minX = margin;
  const maxX = Math.max(margin, container.width - barWidth - margin);
  const unclampedX = relCenterX - barWidth / 2;
  const x = Math.round(Math.min(maxX, Math.max(minX, unclampedX)));

  const aboveY = relTop - barHeight - gap;
  if (aboveY >= margin) {
    return {
      x,
      y: Math.round(aboveY),
      placement: 'above',
    };
  }

  const maxY = Math.max(margin, container.height - barHeight - margin);
  const belowY = Math.min(maxY, Math.max(margin, relBottom + gap));
  return {
    x,
    y: Math.round(belowY),
    placement: 'below',
  };
}
