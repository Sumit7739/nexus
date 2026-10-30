import { playStarterMusicStream } from './media';
import {
  extractNoteTitle,
  readNotesState,
  saveNotesState,
  sortNotesForSidebar,
  toggleChecklistLine,
  type ScratchpadNote,
} from './notes';
import { applySoundscapePreset } from './soundscape';

export const FOCUS_STORAGE_KEY = 'nexus.focus.v1';
export const NEXUS_FOCUS_OPEN_POPOVER_EVENT = 'nexus:open-focus-popover';

export type FocusStatus = 'idle' | 'running' | 'paused' | 'completed';
export type FocusPhase = 'focus' | 'break';
export type FocusAudioMode =
  | 'none'
  | 'rainy-study'
  | 'deep-shield'
  | 'cabin-hearth'
  | 'lofi-stream';

export interface LinkedFocusTask {
  noteId: string;
  noteTitle: string;
  lineIndex: number;
  text: string;
}

export interface ScratchpadTaskCandidate extends LinkedFocusTask {
  id: string;
}

export interface FocusPreferences {
  defaultDurationMinutes: number;
  breakDurationMinutes: number;
  audioMode: FocusAudioMode;
  declutterWindows: boolean;
  soundChime: boolean;
}

export interface FocusSessionRecord {
  id: string;
  intention: string;
  noteId?: string;
  noteTitle?: string;
  durationMinutes: number;
  completedAt: number;
  taskCheckedOff: boolean;
}

export interface FocusPersistedState {
  version: 1;
  preferences: FocusPreferences;
  completedSessions: FocusSessionRecord[];
}

export interface FocusState {
  status: FocusStatus;
  phase: FocusPhase;
  durationSeconds: number;
  remainingSeconds: number;
  startedAt: number | null;
  targetEndAt: number | null;
  linkedTask: LinkedFocusTask | null;
  intention: string;
  preferences: FocusPreferences;
  completedSessions: FocusSessionRecord[];
  lastCompletedSessionId: string | null;
  declutteredWindowIds: string[];
}

export const FOCUS_DURATION_PRESETS = [15, 25, 50] as const;

export const FOCUS_AUDIO_OPTIONS: ReadonlyArray<{
  id: FocusAudioMode;
  label: string;
  subtitle: string;
}> = [
  { id: 'none', label: 'Keep current', subtitle: 'Do not change playing audio' },
  { id: 'rainy-study', label: 'Rainy Study', subtitle: 'Soft rain + vinyl + hearth' },
  { id: 'deep-shield', label: 'Deep Brown', subtitle: 'Brown noise + pine wind' },
  { id: 'cabin-hearth', label: 'Cabin Hearth', subtitle: 'Warm fire + pines' },
  { id: 'lofi-stream', label: 'Lofi Radio', subtitle: '24/7 Chillhop focus beats' },
];

export const DEFAULT_FOCUS_PREFERENCES: FocusPreferences = {
  defaultDurationMinutes: 25,
  breakDurationMinutes: 5,
  audioMode: 'none',
  declutterWindows: false,
  soundChime: true,
};

const VALID_AUDIO_MODES = new Set<FocusAudioMode>([
  'none',
  'rainy-study',
  'deep-shield',
  'cabin-hearth',
  'lofi-stream',
]);

const TASK_LINE_RE = /^(\s*)([-*])\s+\[([ xX])\]\s*(.*)$/;
const FENCE_RE = /^```([\w+-]*)\s*$/;

function clampMinutes(mins: unknown, fallback: number, min = 1, max = 180): number {
  if (typeof mins !== 'number' || !Number.isFinite(mins)) return fallback;
  return Math.max(min, Math.min(max, Math.round(mins)));
}

export function cleanTaskDisplayText(raw: string): string {
  return raw
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/(`|\*\*|__|~~|\*)/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Extracts all unchecked `- [ ]` tasks across Scratchpad notes (sorted pinned-first, then recent).
 */
export function extractUncheckedTasksFromNotes(
  notes: readonly ScratchpadNote[],
  maxTasks = 40
): ScratchpadTaskCandidate[] {
  const ordered = sortNotesForSidebar(notes);
  const candidates: ScratchpadTaskCandidate[] = [];

  for (const note of ordered) {
    const noteTitle = extractNoteTitle(note.title, note.content);
    const lines = note.content.split(/\r?\n/);
    let inFence = false;

    for (let lineIdx = 0; lineIdx < lines.length; lineIdx++) {
      const line = lines[lineIdx];
      if (FENCE_RE.test(line.trim())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;

      const match = TASK_LINE_RE.exec(line);
      if (!match) continue;
      const isChecked = match[3].toLowerCase() === 'x';
      if (isChecked) continue;

      const text = cleanTaskDisplayText(match[4] ?? '');
      if (!text) continue;

      candidates.push({
        id: `${note.id}:${lineIdx}`,
        noteId: note.id,
        noteTitle,
        lineIndex: lineIdx,
        text: text.slice(0, 160),
      });

      if (candidates.length >= maxTasks) {
        return candidates;
      }
    }
  }

  return candidates;
}

export function formatFocusClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.ceil(totalSeconds));
  const hrs = Math.floor(safe / 3600);
  const mins = Math.floor((safe % 3600) / 60);
  const secs = safe % 60;
  if (hrs > 0) {
    return `${hrs}:${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
  }
  return `${String(mins).padStart(2, '0')}:${String(secs).padStart(2, '0')}`;
}

export function computeTodayFocusStats(
  sessions: readonly FocusSessionRecord[],
  nowMs = Date.now()
): {
  sessionsCount: number;
  totalMinutes: number;
  tasksCompletedCount: number;
} {
  const nowDate = new Date(nowMs);
  const startOfDay = new Date(
    nowDate.getFullYear(),
    nowDate.getMonth(),
    nowDate.getDate()
  ).getTime();
  const endOfDay = startOfDay + 86_400_000;

  let sessionsCount = 0;
  let totalMinutes = 0;
  let tasksCompletedCount = 0;

  for (const session of sessions) {
    if (session.completedAt >= startOfDay && session.completedAt < endOfDay) {
      sessionsCount += 1;
      totalMinutes += Math.max(1, session.durationMinutes);
      if (session.taskCheckedOff) tasksCompletedCount += 1;
    }
  }

  return { sessionsCount, totalMinutes, tasksCompletedCount };
}

export function sanitizeFocusPersistedState(raw: unknown): FocusPersistedState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  if (obj.version !== 1) return null;

  const rawPrefs = (
    obj.preferences && typeof obj.preferences === 'object' ? obj.preferences : {}
  ) as Partial<FocusPreferences>;

  const preferences: FocusPreferences = {
    defaultDurationMinutes: clampMinutes(
      rawPrefs.defaultDurationMinutes,
      DEFAULT_FOCUS_PREFERENCES.defaultDurationMinutes,
      1,
      180
    ),
    breakDurationMinutes: clampMinutes(
      rawPrefs.breakDurationMinutes,
      DEFAULT_FOCUS_PREFERENCES.breakDurationMinutes,
      1,
      60
    ),
    audioMode:
      typeof rawPrefs.audioMode === 'string' &&
      VALID_AUDIO_MODES.has(rawPrefs.audioMode as FocusAudioMode)
        ? (rawPrefs.audioMode as FocusAudioMode)
        : 'none',
    declutterWindows: rawPrefs.declutterWindows === true,
    soundChime: rawPrefs.soundChime !== false,
  };

  const completedSessions: FocusSessionRecord[] = [];
  const seenIds = new Set<string>();
  if (Array.isArray(obj.completedSessions)) {
    for (const item of obj.completedSessions) {
      if (!item || typeof item !== 'object') continue;
      const rec = item as Partial<FocusSessionRecord>;
      if (typeof rec.id !== 'string' || !rec.id.trim() || seenIds.has(rec.id)) continue;
      if (typeof rec.intention !== 'string' || !rec.intention.trim()) continue;
      if (typeof rec.completedAt !== 'number' || !Number.isFinite(rec.completedAt)) continue;
      seenIds.add(rec.id);
      completedSessions.push({
        id: rec.id.trim().slice(0, 64),
        intention: rec.intention.trim().slice(0, 160),
        ...(typeof rec.noteId === 'string' && rec.noteId.trim()
          ? { noteId: rec.noteId.trim().slice(0, 64) }
          : {}),
        ...(typeof rec.noteTitle === 'string' && rec.noteTitle.trim()
          ? { noteTitle: rec.noteTitle.trim().slice(0, 140) }
          : {}),
        durationMinutes: clampMinutes(rec.durationMinutes, 25, 1, 300),
        completedAt: rec.completedAt,
        taskCheckedOff: rec.taskCheckedOff === true,
      });
      if (completedSessions.length >= 120) break;
    }
  }

  return {
    version: 1,
    preferences,
    completedSessions,
  };
}

export function readFocusPersistedState(): FocusPersistedState {
  try {
    const raw = localStorage.getItem(FOCUS_STORAGE_KEY);
    if (raw) {
      const parsed = sanitizeFocusPersistedState(JSON.parse(raw));
      if (parsed) return parsed;
    }
  } catch {
    /* Fall back to defaults */
  }
  return {
    version: 1,
    preferences: { ...DEFAULT_FOCUS_PREFERENCES },
    completedSessions: [],
  };
}

export function saveFocusPersistedState(persisted: FocusPersistedState): void {
  try {
    localStorage.setItem(FOCUS_STORAGE_KEY, JSON.stringify(persisted));
  } catch {
    /* Ignore storage quota errors */
  }
}

/* ── Gentle Web Audio Completion Chime (Zero dependencies, safe in SSR/tests) ── */
export function playFocusCompletionChime(): void {
  try {
    if (typeof window === 'undefined') return;
    const AudioCtx =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtx) return;

    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const notes = [
      { freq: 528, delay: 0, duration: 0.9 },
      { freq: 660, delay: 0.18, duration: 1.25 },
    ];

    for (const n of notes) {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, now + n.delay);

      gain.gain.setValueAtTime(0.0001, now + n.delay);
      gain.gain.linearRampToValueAtTime(0.085, now + n.delay + 0.025);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + n.delay + n.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start(now + n.delay);
      osc.stop(now + n.delay + n.duration + 0.05);
    }

    window.setTimeout(() => {
      ctx.close().catch(() => {});
    }, 1800);
  } catch {
    /* AudioContext blocked or unavailable in test environment */
  }
}

/* ── External Store Singleton ──────────────────────────────────────────────── */

function createInitialFocusState(): FocusState {
  const persisted = readFocusPersistedState();
  const defaultSecs = persisted.preferences.defaultDurationMinutes * 60;
  return {
    status: 'idle',
    phase: 'focus',
    durationSeconds: defaultSecs,
    remainingSeconds: defaultSecs,
    startedAt: null,
    targetEndAt: null,
    linkedTask: null,
    intention: '',
    preferences: persisted.preferences,
    completedSessions: persisted.completedSessions,
    lastCompletedSessionId: null,
    declutteredWindowIds: [],
  };
}

let focusState: FocusState = createInitialFocusState();
const listeners = new Set<() => void>();
let tickerHandle: ReturnType<typeof setInterval> | null = null;

function emitChange(): void {
  for (const listener of listeners) {
    listener();
  }
}

function persistFromCurrentState(): void {
  saveFocusPersistedState({
    version: 1,
    preferences: focusState.preferences,
    completedSessions: focusState.completedSessions,
  });
}

function stopTicker(): void {
  if (tickerHandle !== null) {
    clearInterval(tickerHandle);
    tickerHandle = null;
  }
}

function ensureTickerRunning(): void {
  if (tickerHandle !== null) return;
  tickerHandle = setInterval(() => {
    tickFocusTimer();
  }, 500);
}

function applyFocusAudioMode(mode: FocusAudioMode): void {
  if (mode === 'none') return;
  if (mode === 'rainy-study') {
    applySoundscapePreset('preset-rainy-study');
  } else if (mode === 'deep-shield') {
    applySoundscapePreset('preset-deep-shield');
  } else if (mode === 'cabin-hearth') {
    applySoundscapePreset('preset-cabin-hearth');
  } else if (mode === 'lofi-stream') {
    playStarterMusicStream(0);
  }
}

function finalizeFocusCompletion(completedAtMs = Date.now(), recordedMinutesOverride?: number): void {
  stopTicker();

  let lastCompletedSessionId = focusState.lastCompletedSessionId;
  let nextCompleted = focusState.completedSessions;

  if (focusState.phase === 'focus') {
    const durationMinutes =
      recordedMinutesOverride ?? Math.max(1, Math.round(focusState.durationSeconds / 60));
    const sessionRecord: FocusSessionRecord = {
      id: `focus-${completedAtMs.toString(36)}-${Math.random().toString(36).slice(2, 6)}`,
      intention:
        focusState.intention.trim() ||
        focusState.linkedTask?.text ||
        'Deep work session',
      ...(focusState.linkedTask
        ? {
            noteId: focusState.linkedTask.noteId,
            noteTitle: focusState.linkedTask.noteTitle,
          }
        : {}),
      durationMinutes,
      completedAt: completedAtMs,
      taskCheckedOff: false,
    };
    lastCompletedSessionId = sessionRecord.id;
    nextCompleted = [sessionRecord, ...focusState.completedSessions].slice(0, 120);
  }

  if (focusState.preferences.soundChime) {
    playFocusCompletionChime();
  }

  focusState = {
    ...focusState,
    status: 'completed',
    remainingSeconds: 0,
    targetEndAt: null,
    completedSessions: nextCompleted,
    lastCompletedSessionId,
  };
  persistFromCurrentState();
  emitChange();
}

export function tickFocusTimer(nowMs = Date.now()): void {
  if (focusState.status !== 'running' || focusState.targetEndAt === null) {
    stopTicker();
    return;
  }

  const remainingMs = focusState.targetEndAt - nowMs;
  if (remainingMs <= 0) {
    finalizeFocusCompletion(nowMs);
    return;
  }

  const nextRemaining = Math.max(1, Math.ceil(remainingMs / 1000));
  if (nextRemaining !== focusState.remainingSeconds) {
    focusState = {
      ...focusState,
      remainingSeconds: nextRemaining,
    };
    emitChange();
  }
}

export function getFocusState(): FocusState {
  return focusState;
}

export function subscribeFocusState(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

export interface StartFocusSessionOptions {
  linkedTask?: LinkedFocusTask | null;
  intention?: string;
  durationMinutes?: number;
  audioMode?: FocusAudioMode;
  declutteredWindowIds?: string[];
  nowMs?: number;
}

export function startFocusSession(options: StartFocusSessionOptions = {}): FocusState {
  const nowMs = options.nowMs ?? Date.now();
  const durationMinutes = clampMinutes(
    options.durationMinutes ?? focusState.preferences.defaultDurationMinutes,
    focusState.preferences.defaultDurationMinutes,
    1,
    180
  );
  const durationSeconds = durationMinutes * 60;
  const linkedTask =
    options.linkedTask !== undefined ? options.linkedTask : focusState.linkedTask;
  const resolvedIntention = (
    options.intention?.trim() ||
    linkedTask?.text ||
    focusState.intention.trim() ||
    'Deep work session'
  ).slice(0, 160);

  const chosenAudioMode = options.audioMode ?? focusState.preferences.audioMode;

  const nextPrefs: FocusPreferences = {
    ...focusState.preferences,
    defaultDurationMinutes: durationMinutes,
    audioMode: chosenAudioMode,
  };

  focusState = {
    ...focusState,
    status: 'running',
    phase: 'focus',
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAt: nowMs,
    targetEndAt: nowMs + durationSeconds * 1000,
    linkedTask: linkedTask ?? null,
    intention: resolvedIntention,
    preferences: nextPrefs,
    lastCompletedSessionId: null,
    declutteredWindowIds: options.declutteredWindowIds ?? focusState.declutteredWindowIds,
  };

  persistFromCurrentState();
  applyFocusAudioMode(chosenAudioMode);
  ensureTickerRunning();
  emitChange();
  return focusState;
}

export function startFocusBreak(durationMinutes?: number, nowMs = Date.now()): FocusState {
  const breakMins = clampMinutes(
    durationMinutes ?? focusState.preferences.breakDurationMinutes,
    focusState.preferences.breakDurationMinutes,
    1,
    60
  );
  const durationSeconds = breakMins * 60;

  focusState = {
    ...focusState,
    status: 'running',
    phase: 'break',
    durationSeconds,
    remainingSeconds: durationSeconds,
    startedAt: nowMs,
    targetEndAt: nowMs + durationSeconds * 1000,
    intention: 'Short restorative break',
    lastCompletedSessionId: null,
  };

  ensureTickerRunning();
  emitChange();
  return focusState;
}

export function pauseFocusSession(nowMs = Date.now()): FocusState {
  if (focusState.status !== 'running') return focusState;
  const remaining =
    focusState.targetEndAt !== null
      ? Math.max(1, Math.ceil((focusState.targetEndAt - nowMs) / 1000))
      : focusState.remainingSeconds;
  stopTicker();
  focusState = {
    ...focusState,
    status: 'paused',
    remainingSeconds: remaining,
    targetEndAt: null,
  };
  emitChange();
  return focusState;
}

export function resumeFocusSession(nowMs = Date.now()): FocusState {
  if (focusState.status !== 'paused') return focusState;
  const remaining = Math.max(1, focusState.remainingSeconds);
  focusState = {
    ...focusState,
    status: 'running',
    targetEndAt: nowMs + remaining * 1000,
  };
  ensureTickerRunning();
  emitChange();
  return focusState;
}

export function toggleFocusPause(nowMs = Date.now()): FocusState {
  if (focusState.status === 'running') return pauseFocusSession(nowMs);
  if (focusState.status === 'paused') return resumeFocusSession(nowMs);
  return focusState;
}

export function extendFocusSession(extraMinutes = 5, nowMs = Date.now()): FocusState {
  if (focusState.status !== 'running' && focusState.status !== 'paused') return focusState;
  const extraSecs = clampMinutes(extraMinutes, 5, 1, 60) * 60;
  const nextDuration = focusState.durationSeconds + extraSecs;
  const nextRemaining = focusState.remainingSeconds + extraSecs;
  focusState = {
    ...focusState,
    durationSeconds: nextDuration,
    remainingSeconds: nextRemaining,
    targetEndAt:
      focusState.status === 'running' ? nowMs + nextRemaining * 1000 : null,
  };
  emitChange();
  return focusState;
}

export function finishFocusSessionEarly(nowMs = Date.now()): FocusState {
  if (focusState.status !== 'running' && focusState.status !== 'paused') return focusState;
  const elapsedSeconds = Math.max(60, focusState.durationSeconds - focusState.remainingSeconds);
  const recordedMinutes = Math.max(1, Math.round(elapsedSeconds / 60));
  finalizeFocusCompletion(nowMs, recordedMinutes);
  return focusState;
}

export function resetFocusSession(): FocusState {
  stopTicker();
  const defaultSecs = focusState.preferences.defaultDurationMinutes * 60;
  focusState = {
    ...focusState,
    status: 'idle',
    phase: 'focus',
    durationSeconds: defaultSecs,
    remainingSeconds: defaultSecs,
    startedAt: null,
    targetEndAt: null,
    lastCompletedSessionId: null,
    declutteredWindowIds: [],
  };
  emitChange();
  return focusState;
}

export function setFocusDraftTask(
  task: LinkedFocusTask | null,
  customIntention?: string
): FocusState {
  focusState = {
    ...focusState,
    linkedTask: task,
    intention:
      customIntention !== undefined
        ? customIntention.slice(0, 160)
        : task
          ? task.text
          : '',
  };
  emitChange();
  return focusState;
}

export function setFocusDeclutteredWindows(windowIds: string[]): void {
  focusState = {
    ...focusState,
    declutteredWindowIds: [...windowIds],
  };
  emitChange();
}

export function consumeFocusDeclutteredWindows(): string[] {
  const ids = [...focusState.declutteredWindowIds];
  if (ids.length > 0) {
    focusState = {
      ...focusState,
      declutteredWindowIds: [],
    };
    emitChange();
  }
  return ids;
}

export function updateFocusPreferences(patch: Partial<FocusPreferences>): FocusState {
  const nextPrefs: FocusPreferences = {
    defaultDurationMinutes:
      patch.defaultDurationMinutes !== undefined
        ? clampMinutes(
            patch.defaultDurationMinutes,
            focusState.preferences.defaultDurationMinutes,
            1,
            180
          )
        : focusState.preferences.defaultDurationMinutes,
    breakDurationMinutes:
      patch.breakDurationMinutes !== undefined
        ? clampMinutes(
            patch.breakDurationMinutes,
            focusState.preferences.breakDurationMinutes,
            1,
            60
          )
        : focusState.preferences.breakDurationMinutes,
    audioMode:
      patch.audioMode !== undefined && VALID_AUDIO_MODES.has(patch.audioMode)
        ? patch.audioMode
        : focusState.preferences.audioMode,
    declutterWindows:
      patch.declutterWindows !== undefined
        ? Boolean(patch.declutterWindows)
        : focusState.preferences.declutterWindows,
    soundChime:
      patch.soundChime !== undefined
        ? Boolean(patch.soundChime)
        : focusState.preferences.soundChime,
  };

  const idleSecs = nextPrefs.defaultDurationMinutes * 60;
  focusState = {
    ...focusState,
    preferences: nextPrefs,
    ...(focusState.status === 'idle'
      ? { durationSeconds: idleSecs, remainingSeconds: idleSecs }
      : {}),
  };
  persistFromCurrentState();
  emitChange();
  return focusState;
}

export function clearFocusHistory(): FocusState {
  focusState = {
    ...focusState,
    completedSessions: [],
    lastCompletedSessionId: null,
  };
  persistFromCurrentState();
  emitChange();
  return focusState;
}

/**
 * Checks off the linked `- [ ]` task inside Scratchpad's `nexus.notes.v2` storage.
 * Matches `lineIndex` first if still an unchecked task; falls back to matching task text
 * if lines above it were edited during the session.
 */
export function completeLinkedScratchpadTask(overrideTask?: LinkedFocusTask): boolean {
  const target = overrideTask ?? focusState.linkedTask;
  if (!target) return false;

  const notesState = readNotesState();
  const noteIdx = notesState.notes.findIndex((n) => n.id === target.noteId);
  if (noteIdx === -1) return false;

  const note = notesState.notes[noteIdx];
  const lines = note.content.split('\n');
  let resolvedLineIdx = -1;

  const candidateLine = lines[target.lineIndex]?.replace(/\r$/, '') ?? '';
  const directMatch = TASK_LINE_RE.exec(candidateLine);
  if (
    directMatch &&
    directMatch[3].toLowerCase() !== 'x' &&
    cleanTaskDisplayText(directMatch[4] ?? '') === target.text
  ) {
    resolvedLineIdx = target.lineIndex;
  } else {
    /* Fallback: scan note outside code fences for the first unchecked task matching text */
    let inFence = false;
    for (let i = 0; i < lines.length; i++) {
      const clean = lines[i].replace(/\r$/, '');
      if (FENCE_RE.test(clean.trim())) {
        inFence = !inFence;
        continue;
      }
      if (inFence) continue;
      const m = TASK_LINE_RE.exec(clean);
      if (m && m[3].toLowerCase() !== 'x') {
        if (cleanTaskDisplayText(m[4] ?? '') === target.text) {
          resolvedLineIdx = i;
          break;
        }
      }
    }
    /* Secondary fallback: if `lineIndex` is still an unchecked task even if wording was tweaked */
    if (resolvedLineIdx === -1 && directMatch && directMatch[3].toLowerCase() !== 'x') {
      resolvedLineIdx = target.lineIndex;
    }
  }

  if (resolvedLineIdx === -1) return false;

  const updatedContent = toggleChecklistLine(note.content, resolvedLineIdx);
  if (updatedContent === note.content) return false;

  const nextNotes = notesState.notes.map((n, idx) =>
    idx === noteIdx ? { ...n, content: updatedContent, updatedAt: Date.now() } : n
  );

  saveNotesState({
    ...notesState,
    notes: nextNotes,
  });

  if (typeof window !== 'undefined') {
    window.dispatchEvent(new Event('storage'));
  }

  /* Mark latest completed session record as checked off */
  if (focusState.lastCompletedSessionId) {
    focusState = {
      ...focusState,
      completedSessions: focusState.completedSessions.map((rec) =>
        rec.id === focusState.lastCompletedSessionId ? { ...rec, taskCheckedOff: true } : rec
      ),
    };
    persistFromCurrentState();
    emitChange();
  }

  return true;
}

export function reloadFocusFromStorage(): FocusState {
  stopTicker();
  focusState = createInitialFocusState();
  emitChange();
  return focusState;
}

export function requestOpenFocusPopover(): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(NEXUS_FOCUS_OPEN_POPOVER_EVENT));
  }
}
