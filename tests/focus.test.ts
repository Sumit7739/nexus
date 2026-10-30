import { beforeEach, describe, expect, it } from 'vitest';
import { APP_REGISTRY } from '../src/apps/registry';
import { DEFAULT_MESSAGES } from '../src/data/messages';
import {
  completeLinkedScratchpadTask,
  computeTodayFocusStats,
  extendFocusSession,
  extractUncheckedTasksFromNotes,
  finishFocusSessionEarly,
  formatFocusClock,
  getFocusState,
  pauseFocusSession,
  reloadFocusFromStorage,
  resetFocusSession,
  resumeFocusSession,
  startFocusSession,
  tickFocusTimer,
  updateFocusPreferences,
} from '../src/data/focus';
import {
  createScratchpadNote,
  readNotesState,
  saveNotesState,
} from '../src/data/notes';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';
import { buildSpotlightResults } from '../src/spotlight/spotlight-engine';

const WALLPAPERS = [
  { id: 'mist', name: 'Soft mist' },
  { id: 'glacier', name: 'Glacier' },
] as const;

describe('Focus Rituals tied to Scratchpad Tasks (v1.8.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    reloadFocusFromStorage();
    updateFocusPreferences({ soundChime: false, audioMode: 'none' });
  });

  it('extracts unchecked - [ ] tasks across Scratchpad notes while ignoring fenced code and checked items', () => {
    const pinnedNote = createScratchpadNote({
      id: 'note-pinned',
      title: 'Sprint Plan',
      pinned: true,
      content: [
        '# Sprint Plan',
        '- [x] Already shipped feature',
        '- [ ] **Draft** API contract for `NEXUS.notes`',
        '```md',
        '- [ ] Fake task inside code block',
        '```',
        '* [ ] Review PR [link](https://example.com)',
      ].join('\n'),
    });
    const otherNote = createScratchpadNote({
      id: 'note-2',
      title: 'Backlog',
      pinned: false,
      content: '- [ ] Polish dark mode tokens',
    });

    const tasks = extractUncheckedTasksFromNotes([otherNote, pinnedNote]);
    expect(tasks).toHaveLength(3);
    expect(tasks[0]).toMatchObject({
      noteId: 'note-pinned',
      noteTitle: 'Sprint Plan',
      lineIndex: 2,
      text: 'Draft API contract for NEXUS.notes',
    });
    expect(tasks[1]).toMatchObject({
      noteId: 'note-pinned',
      lineIndex: 6,
      text: 'Review PR link',
    });
    expect(tasks[2]).toMatchObject({
      noteId: 'note-2',
      text: 'Polish dark mode tokens',
    });
  });

  it('runs, pauses, extends, ticks to completion, and logs Today focus stats', () => {
    const t0 = 1_730_000_000_000;
    startFocusSession({
      intention: 'Write architecture RFC',
      durationMinutes: 25,
      nowMs: t0,
    });

    expect(getFocusState().status).toBe('running');
    expect(getFocusState().remainingSeconds).toBe(1500);
    expect(formatFocusClock(getFocusState().remainingSeconds)).toBe('25:00');

    /* Advance 5 minutes */
    tickFocusTimer(t0 + 300_000);
    expect(getFocusState().remainingSeconds).toBe(1200);

    /* Pause & extend +5m */
    pauseFocusSession(t0 + 300_000);
    expect(getFocusState().status).toBe('paused');
    extendFocusSession(5, t0 + 300_000);
    expect(getFocusState().remainingSeconds).toBe(1500);
    expect(getFocusState().durationSeconds).toBe(1800);

    /* Resume and advance past targetEndAt */
    resumeFocusSession(t0 + 310_000);
    expect(getFocusState().status).toBe('running');
    tickFocusTimer(t0 + 310_000 + 1_500_000 + 500);

    const completed = getFocusState();
    expect(completed.status).toBe('completed');
    expect(completed.remainingSeconds).toBe(0);
    expect(completed.completedSessions).toHaveLength(1);
    expect(completed.completedSessions[0]).toMatchObject({
      intention: 'Write architecture RFC',
      durationMinutes: 30,
      taskCheckedOff: false,
    });

    const stats = computeTodayFocusStats(
      completed.completedSessions,
      t0 + 310_000 + 1_500_500
    );
    expect(stats.sessionsCount).toBe(1);
    expect(stats.totalMinutes).toBe(30);
  });

  it('checks off the linked - [ ] task in Scratchpad storage even if lines shifted above it', () => {
    const note = createScratchpadNote({
      id: 'note-tasks',
      title: 'Today',
      content: '- [ ] First item\n- [ ] Ship Focus Popover\n- [ ] Write unit tests',
    });
    saveNotesState({ notes: [note], activeNoteId: note.id });

    startFocusSession({
      linkedTask: {
        noteId: note.id,
        noteTitle: 'Today',
        lineIndex: 1,
        text: 'Ship Focus Popover',
      },
      durationMinutes: 25,
    });

    /* Simulate user inserting a heading at top of note while focusing */
    saveNotesState({
      notes: [
        {
          ...note,
          content: '# Daily Log\n\n- [ ] First item\n- [ ] Ship Focus Popover\n- [ ] Write unit tests',
        },
      ],
      activeNoteId: note.id,
    });

    finishFocusSessionEarly();
    const ok = completeLinkedScratchpadTask();
    expect(ok).toBe(true);

    const updatedNote = readNotesState().notes[0];
    expect(updatedNote.content).toContain('- [x] Ship Focus Popover');
    expect(updatedNote.content).toContain('- [ ] First item');
    expect(getFocusState().completedSessions[0]?.taskCheckedOff).toBe(true);

    resetFocusSession();
    expect(getFocusState().status).toBe('idle');
  });

  it('indexes Scratchpad tasks and focus <mins>m <intention> queries in Spotlight', () => {
    const note = createScratchpadNote({
      id: 'note-sp',
      title: 'Roadmap',
      content: '- [ ] Build Stash Edge Shelf',
    });

    const taskResults = buildSpotlightResults({
      query: 'Stash Edge',
      filter: 'all',
      apps: APP_REGISTRY,
      windows: [],
      activeWindowId: null,
      notes: [note],
      theme: 'light',
      wallpaper: 'mist',
      wallpapers: WALLPAPERS,
      arrangeMode: false,
      showSeconds: false,
      showMessages: true,
      restoreSession: false,
      hasPassword: false,
      versionTag: 'v1.8.0',
      focusState: getFocusState(),
    });

    const focusTaskHit = taskResults.items.find((i) => i.id.startsWith('focus:task:'));
    expect(focusTaskHit).toBeDefined();
    expect(focusTaskHit?.title).toBe('Focus on: Build Stash Edge Shelf');
    expect(focusTaskHit?.command).toMatchObject({
      type: 'focus-start',
      intention: 'Build Stash Edge Shelf',
    });

    const prefixResults = buildSpotlightResults({
      query: 'focus 45m Deep code review',
      filter: 'all',
      apps: APP_REGISTRY,
      windows: [],
      activeWindowId: null,
      notes: [note],
      theme: 'light',
      wallpaper: 'mist',
      wallpapers: WALLPAPERS,
      arrangeMode: false,
      showSeconds: false,
      showMessages: true,
      restoreSession: false,
      hasPassword: false,
      versionTag: 'v1.8.0',
      focusState: getFocusState(),
    });

    expect(prefixResults.items[0]?.id).toBe('focus:prefix-start');
    expect(prefixResults.items[0]?.command).toEqual({
      type: 'focus-start',
      durationMinutes: 45,
      intention: 'Deep code review',
      linkedTask: null,
    });
  });

  it('round-trips focusState preferences and session history through Workspace Backup JSON', () => {
    updateFocusPreferences({
      defaultDurationMinutes: 50,
      declutterWindows: true,
      audioMode: 'rainy-study',
      soundChime: false,
    });
    startFocusSession({ intention: 'Backup verification block', durationMinutes: 50 });
    finishFocusSessionEarly();

    const backup = buildWorkspaceBackup({
      preferences: {
        theme: 'dark',
        wallpaper: 'mist',
        showSeconds: false,
        showMessages: true,
        restoreSession: false,
        menuView: 'list',
        msgRefreshMins: 5,
      },
      pinnedDesktop: [],
      pinnedDock: [],
      desktopPositions: {},
      messages: DEFAULT_MESSAGES,
      shortcuts: [],
      widgets: [],
    });

    expect(backup.focusState?.preferences.defaultDurationMinutes).toBe(50);
    expect(backup.focusState?.preferences.declutterWindows).toBe(true);
    expect(backup.focusState?.completedSessions).toHaveLength(1);

    const rawJson = JSON.stringify(backup);
    localStorage.clear();
    reloadFocusFromStorage();
    expect(getFocusState().completedSessions).toHaveLength(0);

    const validated = parseAndValidateWorkspaceBackup(rawJson);
    applyWorkspaceBackupToStorage(validated);
    reloadFocusFromStorage();

    expect(getFocusState().preferences.defaultDurationMinutes).toBe(50);
    expect(getFocusState().preferences.declutterWindows).toBe(true);
    expect(getFocusState().preferences.audioMode).toBe('rainy-study');
    expect(getFocusState().completedSessions[0]?.intention).toBe('Backup verification block');
  });
});
