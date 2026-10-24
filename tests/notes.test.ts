import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearCompletedTasks,
  computeNoteStats,
  createScratchpadNote,
  extractNoteSnippet,
  extractNoteTitle,
  LEGACY_NOTES_KEY,
  parseMarkdownBlocks,
  readNotesState,
  saveNotesState,
  slugifyNoteFilename,
  sortNotesForSidebar,
  toggleChecklistLine,
} from '../src/data/notes';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';

describe('Upgraded Scratchpad (v1.0.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('migrates legacy single-note scratchpad content seamlessly when v2 storage is absent', () => {
    localStorage.setItem(LEGACY_NOTES_KEY, '# Release Plan\n- [ ] Ship Scratchpad v1.0');
    const state = readNotesState();
    expect(state.notes).toHaveLength(1);
    expect(state.notes[0].content).toBe('# Release Plan\n- [ ] Ship Scratchpad v1.0');
    expect(extractNoteTitle(state.notes[0].title, state.notes[0].content)).toBe('Release Plan');
    expect(extractNoteSnippet(state.notes[0].title, state.notes[0].content)).toBe('Ship Scratchpad v1.0');
  });

  it('toggles interactive checklist lines and clears completed tasks cleanly', () => {
    const md = ['# Daily Tasks', '- [ ] Write tests', '  - [x] Update version', '- Regular bullet'].join('\n');

    const statsBefore = computeNoteStats(md);
    expect(statsBefore.tasksTotal).toBe(2);
    expect(statsBefore.tasksCompleted).toBe(1);

    const toggledFirst = toggleChecklistLine(md, 1);
    expect(toggledFirst.split('\n')[1]).toBe('- [x] Write tests');

    const toggledSecond = toggleChecklistLine(toggledFirst, 2);
    expect(toggledSecond.split('\n')[2]).toBe('  - [ ] Update version');

    const cleared = clearCompletedTasks(toggledFirst);
    expect(cleared).toContain('# Daily Tasks');
    expect(cleared).toContain('- Regular bullet');
    expect(cleared).not.toContain('Write tests');
    expect(cleared).not.toContain('Update version');
  });

  it('parses Markdown headings, interactive checklists with line indices, code blocks, and safe links', () => {
    const md = [
      '# Architecture Notes',
      '',
      '- [ ] Audit `window-store.ts`',
      '- [x] Verify [Docs](https://example.com) and ignore [Bad](javascript:alert(1))',
      '',
      '```ts',
      'const ready = true;',
      '```',
    ].join('\n');

    const blocks = parseMarkdownBlocks(md);
    expect(blocks[0]).toMatchObject({ type: 'heading', level: 1 });
    expect(blocks[1]).toMatchObject({
      type: 'task-list',
      items: [
        { lineIndex: 2, checked: false },
        { lineIndex: 3, checked: true },
      ],
    });
    expect(blocks[2]).toEqual({
      type: 'code-block',
      language: 'ts',
      code: 'const ready = true;',
    });

    if (blocks[1].type === 'task-list') {
      const secondTokens = blocks[1].items[1].tokens;
      expect(secondTokens.some((t) => t.type === 'link' && t.href === 'https://example.com/')).toBe(true);
      expect(secondTokens.some((t) => t.type === 'link' && t.href.startsWith('javascript:'))).toBe(false);
    }
  });

  it('sorts pinned notes ahead of unpinned notes and generates clean .md filenames', () => {
    const olderPinned = createScratchpadNote({
      id: 'n1',
      title: 'Pinned Roadmap',
      pinned: true,
      updatedAt: 1000,
    });
    const newerRegular = createScratchpadNote({
      id: 'n2',
      title: 'Quick Scratch',
      pinned: false,
      updatedAt: 5000,
    });

    const sorted = sortNotesForSidebar([newerRegular, olderPinned]);
    expect(sorted.map((n) => n.id)).toEqual(['n1', 'n2']);
    expect(slugifyNoteFilename('Q4 Product Spec!', '')).toBe('q4-product-spec.md');
  });

  it('round-trips multi-note Scratchpad libraries through Workspace Backup JSON', () => {
    const n1 = createScratchpadNote({
      id: 'note-alpha',
      title: 'Sprint Checklist',
      content: '- [x] Snapping\n- [ ] Scratchpad',
      pinned: true,
      updatedAt: 2000,
    });
    const n2 = createScratchpadNote({
      id: 'note-beta',
      title: 'Ideas',
      content: 'Spotlight command palette next.',
      pinned: false,
      updatedAt: 3000,
    });

    saveNotesState({ notes: [n1, n2], activeNoteId: 'note-beta' });

    const backup = buildWorkspaceBackup({
      preferences: {
        theme: 'light',
        wallpaper: 'mist',
        showSeconds: false,
        showMessages: true,
        menuView: 'list',
        msgRefreshMins: 5,
      },
      pinnedDesktop: [],
      pinnedDock: ['notes'],
      desktopPositions: {},
      messages: [{ id: 'm1', text: 'Focus.' }],
      shortcuts: [],
      widgets: [],
    });

    const validated = parseAndValidateWorkspaceBackup(JSON.stringify(backup));
    expect(validated.notesState?.notes).toHaveLength(2);
    expect(validated.notesState?.activeNoteId).toBe('note-beta');
    expect(validated.scratchpad).toBe('Spotlight command palette next.');

    localStorage.clear();
    applyWorkspaceBackupToStorage(validated);

    const restored = readNotesState();
    expect(restored.notes).toHaveLength(2);
    expect(restored.activeNoteId).toBe('note-beta');
    expect(restored.notes.find((n) => n.id === 'note-alpha')?.pinned).toBe(true);
  });
});
