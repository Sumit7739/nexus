import { extractYouTubeVideoId, type MediaTrack } from './media';
import {
  createScratchpadNote,
  extractNoteTitle,
  readNotesState,
  saveNotesState,
  type ScratchpadNote,
} from './notes';
import {
  extractHostname,
  normalizeHttpUrl,
  readShortcuts,
  saveShortcuts,
  suggestTitleFromUrl,
  type SavedShortcut,
} from './shortcuts';

export const STASH_STORAGE_KEY = 'nexus.stash.v1';
export const NEXUS_STASH_EVENT = 'nexus:stash-updated';
export const NEXUS_STASH_OPEN_EVENT = 'nexus:open-stash-shelf';

export type StashCardKind =
  | 'color'
  | 'calculation'
  | 'youtube'
  | 'url'
  | 'code'
  | 'text';

export interface StashCardSource {
  appId?: string;
  title?: string;
  url?: string;
}

export interface StashItem {
  id: string;
  kind: StashCardKind;
  content: string;
  title?: string;
  metadata?: Record<string, string | number | boolean>;
  source?: StashCardSource;
  createdAt: number;
}

export interface StashPersistedState {
  version: 1;
  items: StashItem[];
}

export interface StashState {
  items: StashItem[];
  isOpen: boolean;
  filter: 'all' | StashCardKind;
}

export const MAX_STASH_ITEMS = 60;

/* ── Kind Classifier ──────────────────────────────────────────────────────── */

const HEX_COLOR_RE = /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/;
const RGB_HSL_COLOR_RE = /^(?:rgb|rgba|hsl|hsla)\(\s*[\d.]+\s*,\s*[\d.%]+\s*,\s*[\d.%]+(?:\s*,\s*[\d.]+%?)?\s*\)$/i;

export function isColorValue(input: string): boolean {
  const trimmed = input.trim();
  return HEX_COLOR_RE.test(trimmed) || RGB_HSL_COLOR_RE.test(trimmed);
}

export function isCalculationResult(input: string): boolean {
  const trimmed = input.trim();
  // Matches "= 42", "= 3.1415", "42 * 2 = 84", "10% of 80 = 8"
  if (/^=\s*[\d,.-]+(?:\s*[a-zA-Z%]+)?$/.test(trimmed)) return true;
  if (/^.+=\s*[\d,.-]+(?:\s*[a-zA-Z%]+)?$/.test(trimmed)) return true;
  return false;
}

export function isCodeSnippet(input: string): boolean {
  const trimmed = input.trim();
  if (trimmed.startsWith('```') && trimmed.endsWith('```')) return true;
  const lines = trimmed.split(/\r?\n/);
  if (lines.length >= 2) {
    const codeIndicators = [
      /^(?:import|export|const|let|var|function|class|interface|type)\s+/,
      /[{};]$/,
      /^\s*(?:def|class|if|for|while|return)\s+/,
      /^(?:SELECT|INSERT|UPDATE|DELETE)\s+/i,
      /^\s*<[a-zA-Z][\s\S]*>/,
      /=>/,
    ];
    let matches = 0;
    for (const line of lines) {
      if (codeIndicators.some((re) => re.test(line.trim()))) {
        matches++;
      }
    }
    if (matches >= 2) return true;
  }
  return false;
}

export function classifyStashInput(
  rawInput: string
): { kind: StashCardKind; title?: string; metadata?: Record<string, string | number | boolean> } {
  const trimmed = rawInput.trim();

  // 1. YouTube video
  const ytVideoId = extractYouTubeVideoId(trimmed);
  if (ytVideoId) {
    return {
      kind: 'youtube',
      title: `YouTube Video (${ytVideoId})`,
      metadata: { videoId: ytVideoId },
    };
  }

  // 2. HTTP URL
  const normalizedUrl = normalizeHttpUrl(trimmed);
  if (normalizedUrl && !/\s/.test(trimmed)) {
    const host = extractHostname(normalizedUrl);
    const suggested = suggestTitleFromUrl(normalizedUrl);
    return {
      kind: 'url',
      title: suggested || host || 'Link',
      metadata: { url: normalizedUrl, host },
    };
  }

  // 3. Hex / RGB / HSL Color
  if (isColorValue(trimmed)) {
    return {
      kind: 'color',
      title: trimmed.toUpperCase(),
      metadata: { colorHex: trimmed },
    };
  }

  // 4. Calculation result
  if (isCalculationResult(trimmed)) {
    return {
      kind: 'calculation',
      title: 'Calculation',
    };
  }

  // 5. Code block
  if (isCodeSnippet(trimmed)) {
    const lines = trimmed.split(/\r?\n/);
    const firstNonFence = lines.find((l) => !l.startsWith('```'))?.trim() ?? 'Code Snippet';
    return {
      kind: 'code',
      title: firstNonFence.length > 40 ? `${firstNonFence.slice(0, 39)}…` : firstNonFence,
    };
  }

  // 6. Generic Text snippet
  const firstLine = trimmed.split(/\r?\n/)[0]?.trim() ?? 'Text Snippet';
  const displayTitle = firstLine.length > 48 ? `${firstLine.slice(0, 47)}…` : firstLine;
  return {
    kind: 'text',
    title: displayTitle,
  };
}

/* ── Storage Helpers ──────────────────────────────────────────────────────── */

export function sanitizeStashItems(raw: unknown): StashItem[] {
  if (!Array.isArray(raw)) return [];
  const valid: StashItem[] = [];
  const seenIds = new Set<string>();

  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const it = item as Partial<StashItem>;
    if (typeof it.id !== 'string' || !it.id.trim() || seenIds.has(it.id)) continue;
    if (typeof it.content !== 'string' || !it.content.trim()) continue;

    const kind: StashCardKind =
      it.kind === 'color' ||
      it.kind === 'calculation' ||
      it.kind === 'youtube' ||
      it.kind === 'url' ||
      it.kind === 'code'
        ? it.kind
        : 'text';

    seenIds.add(it.id);
    valid.push({
      id: it.id.trim(),
      kind,
      content: it.content.slice(0, 50_000),
      title: typeof it.title === 'string' ? it.title.slice(0, 140) : undefined,
      metadata: it.metadata && typeof it.metadata === 'object' ? { ...it.metadata } : undefined,
      source:
        it.source && typeof it.source === 'object'
          ? {
              appId: typeof it.source.appId === 'string' ? it.source.appId.slice(0, 40) : undefined,
              title: typeof it.source.title === 'string' ? it.source.title.slice(0, 140) : undefined,
              url: typeof it.source.url === 'string' ? it.source.url.slice(0, 500) : undefined,
            }
          : undefined,
      createdAt:
        typeof it.createdAt === 'number' && Number.isFinite(it.createdAt)
          ? it.createdAt
          : Date.now(),
    });

    if (valid.length >= MAX_STASH_ITEMS) break;
  }

  return valid;
}

export function sanitizeStashPersistedState(raw: unknown): StashPersistedState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;
  return {
    version: 1,
    items: sanitizeStashItems(obj.items),
  };
}

export function readStashPersistedState(): StashPersistedState {
  try {
    const raw = localStorage.getItem(STASH_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeStashPersistedState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* Ignore parse error, return fallback */
  }

  return {
    version: 1,
    items: [],
  };
}

export function saveStashPersistedState(persisted: StashPersistedState): void {
  try {
    localStorage.setItem(STASH_STORAGE_KEY, JSON.stringify(persisted));
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(NEXUS_STASH_EVENT));
    }
  } catch {
    /* Ignore storage quota */
  }
}

/* ── Store Singleton ──────────────────────────────────────────────────────── */

let stashState: StashState = {
  items: readStashPersistedState().items,
  isOpen: false,
  filter: 'all',
};

const stashListeners = new Set<() => void>();

function emitStashChange(): void {
  for (const listener of stashListeners) {
    listener();
  }
}

export function getStashState(): StashState {
  return stashState;
}

export function subscribeStashState(listener: () => void): () => void {
  stashListeners.add(listener);
  return () => {
    stashListeners.delete(listener);
  };
}

export function openStashShelf(): void {
  if (!stashState.isOpen) {
    stashState = { ...stashState, isOpen: true };
    emitStashChange();
  }
}

export function closeStashShelf(): void {
  if (stashState.isOpen) {
    stashState = { ...stashState, isOpen: false };
    emitStashChange();
  }
}

export function toggleStashShelf(): void {
  stashState = { ...stashState, isOpen: !stashState.isOpen };
  emitStashChange();
}

export function setStashFilter(filter: 'all' | StashCardKind): void {
  if (stashState.filter !== filter) {
    stashState = { ...stashState, filter };
    emitStashChange();
  }
}

export function requestOpenStashShelf(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEXUS_STASH_OPEN_EVENT));
  }
}

/* ── Mutations ────────────────────────────────────────────────────────────── */

export function stashItem(options: {
  content: string;
  kind?: StashCardKind;
  title?: string;
  source?: StashCardSource;
  openShelf?: boolean;
}): StashItem | null {
  const content = options.content.trim();
  if (!content) return null;

  const classification = classifyStashInput(content);
  const kind = options.kind ?? classification.kind;
  const title = options.title ?? classification.title;
  const metadata = classification.metadata;

  const now = Date.now();
  const newItem: StashItem = {
    id: `stash-${now.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
    kind,
    content,
    title,
    metadata,
    source: options.source,
    createdAt: now,
  };

  // Prepend new item and filter duplicates of the same exact content if present
  const nextItems = [newItem, ...stashState.items.filter((i) => i.content !== content)].slice(
    0,
    MAX_STASH_ITEMS
  );

  stashState = {
    ...stashState,
    items: nextItems,
    isOpen: options.openShelf !== false ? true : stashState.isOpen,
  };

  saveStashPersistedState({
    version: 1,
    items: nextItems,
  });

  emitStashChange();
  return newItem;
}

export function removeStashItem(id: string): void {
  const nextItems = stashState.items.filter((i) => i.id !== id);
  stashState = { ...stashState, items: nextItems };
  saveStashPersistedState({
    version: 1,
    items: nextItems,
  });
  emitStashChange();
}

export function clearStashItems(): void {
  stashState = { ...stashState, items: [] };
  saveStashPersistedState({
    version: 1,
    items: [],
  });
  emitStashChange();
}

/* ── 1-Click Conversions ──────────────────────────────────────────────────── */

/**
 * Converts a Stash item into a new or active Scratchpad note.
 */
export function convertStashToNote(
  item: StashItem,
  mode: 'new-note' | 'append-active' = 'new-note'
): ScratchpadNote {
  const notesState = readNotesState();
  const now = Date.now();

  let body = item.content;
  if (item.kind === 'code' && !body.startsWith('```')) {
    body = `\`\`\`\n${body}\n\`\`\``;
  } else if (item.kind === 'color') {
    body = `**Color swatch**: \`${item.content}\``;
  } else if (item.kind === 'url') {
    body = `[${item.title || item.content}](${item.content})`;
  } else if (item.kind === 'youtube') {
    body = `[${item.title || 'YouTube Video'}](${item.content})`;
  }

  if (item.source?.title || item.source?.url) {
    const srcLabel = item.source.title || item.source.url;
    body = `${body}\n\n> Stashed from ${srcLabel}`;
  }

  if (mode === 'new-note') {
    const title = item.title || extractNoteTitle('', body) || 'Stashed Note';
    const note = createScratchpadNote({
      title,
      content: body,
      createdAt: now,
      updatedAt: now,
    });
    saveNotesState({
      notes: [note, ...notesState.notes],
      activeNoteId: note.id,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    return note;
  }

  const active =
    notesState.notes.find((n) => n.id === notesState.activeNoteId) ?? notesState.notes[0];
  if (!active) {
    const note = createScratchpadNote({
      title: item.title || 'Stashed Note',
      content: body,
      createdAt: now,
      updatedAt: now,
    });
    saveNotesState({
      notes: [note],
      activeNoteId: note.id,
    });
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new Event('storage'));
    }
    return note;
  }

  const updatedNote: ScratchpadNote = {
    ...active,
    content: active.content.trim() ? `${active.content.trim()}\n\n${body}` : body,
    updatedAt: now,
  };

  saveNotesState({
    notes: notesState.notes.map((n) => (n.id === active.id ? updatedNote : n)),
    activeNoteId: active.id,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }
  return updatedNote;
}

/**
 * Converts a Stash item into a Saved Link / Desktop Shortcut.
 */
export function convertStashToSavedLink(item: StashItem): SavedShortcut | null {
  const candidateUrl =
    (typeof item.metadata?.url === 'string' ? item.metadata.url : null) ??
    normalizeHttpUrl(item.content);

  if (!candidateUrl) return null;

  const currentShortcuts = readShortcuts();
  const title =
    item.title && item.title !== candidateUrl
      ? item.title
      : suggestTitleFromUrl(candidateUrl) || extractHostname(candidateUrl) || 'Saved Link';

  const shortcutId = `link-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
  const newShortcut: SavedShortcut = {
    id: shortcutId,
    title,
    url: candidateUrl,
    mode: 'external',
  };

  saveShortcuts([...currentShortcuts, newShortcut]);
  return newShortcut;
}

/**
 * Converts a Stash item into a Music Queue track (if YouTube or audio link).
 */
export function convertStashToMusicQueueItem(item: StashItem): MediaTrack | null {
  const videoId =
    (typeof item.metadata?.videoId === 'string' ? item.metadata.videoId : null) ??
    extractYouTubeVideoId(item.content);

  if (!videoId) return null;

  const cleanTitle = item.title && !item.title.startsWith('YouTube Video')
    ? item.title
    : `YouTube video ${videoId}`;

  return {
    id: videoId,
    title: cleanTitle,
    channelTitle: 'YouTube',
    description: '',
    publishedAt: '',
    thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: 'LIVE',
    durationSeconds: 0,
  };
}
