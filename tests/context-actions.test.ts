import { beforeEach, describe, expect, it } from 'vitest';
import { consumePendingBrowserNavigations } from '../src/data/browser';
import {
  computeFloatingBarPosition,
  convertLineToTaskItem,
  convertPreviewSelectionToTasksInMarkdown,
  convertRangeInMarkdownToTasks,
  convertTextToTaskMarkdown,
  deriveNoteTitleFromSelection,
  formatBrowserClipMarkdown,
  NEXUS_OPEN_APP_EVENT,
  researchSelectionInBrowser,
  sendSelectionToScratchpad,
  type OpenAppEventDetail,
} from '../src/data/context-actions';
import { createScratchpadNote, readNotesState, saveNotesState } from '../src/data/notes';

describe('Context-aware selection actions (v1.2.0)', () => {
  beforeEach(() => {
    localStorage.clear();
    consumePendingBrowserNavigations();
  });

  describe('Task & checklist conversion', () => {
    it('converts plain text, bullets, numbered items, quotes, and headings into clean - [ ] tasks without double prefixes', () => {
      expect(convertLineToTaskItem('Draft architecture review')).toBe(
        '- [ ] Draft architecture review'
      );
      expect(convertLineToTaskItem('  * Ship v1.2 context actions')).toBe(
        '  - [ ] Ship v1.2 context actions'
      );
      expect(convertLineToTaskItem('3. Verify unit test coverage')).toBe(
        '- [ ] Verify unit test coverage'
      );
      expect(convertLineToTaskItem('> Follow up on benchmark numbers')).toBe(
        '- [ ] Follow up on benchmark numbers'
      );
      expect(convertLineToTaskItem('### Prepare release notes')).toBe(
        '- [ ] Prepare release notes'
      );
      expect(convertLineToTaskItem('- [ ] Already unchecked item')).toBe(
        '- [ ] Already unchecked item'
      );
      expect(convertLineToTaskItem('- [x] Reopen completed item')).toBe(
        '- [ ] Reopen completed item'
      );
    });

    it('converts multi-line prose or bullet lists into clean checklist markdown while preserving relative sub-item indentation', () => {
      const input = `
        1. Audit storage keys
          - Write integration tests

        * Update changelog
      `;
      expect(convertTextToTaskMarkdown(input)).toBe(
        [
          '- [ ] Audit storage keys',
          '  - [ ] Write integration tests',
          '- [ ] Update changelog',
        ].join('\n')
      );
    });

    it('converts selected character ranges in Markdown editor content into tasks in-place', () => {
      const doc = '# Sprint Plan\nReview PR #42\nUpdate docs\nShip release';
      const start = doc.indexOf('Review PR');
      const end = doc.indexOf('Update docs') + 'Update docs'.length;

      const res = convertRangeInMarkdownToTasks(doc, start, end);
      expect(res.tasksCreated).toBe(2);
      expect(res.content).toBe(
        '# Sprint Plan\n- [ ] Review PR #42\n- [ ] Update docs\nShip release'
      );
      expect(res.content.slice(res.nextSelectionStart, res.nextSelectionEnd)).toBe(
        '- [ ] Review PR #42\n- [ ] Update docs'
      );
    });

    it('converts Preview-mode selected text into tasks in-place when lines match, or appends cleanly', () => {
      const doc = '# Reading Notes\nCompare SQLite WAL mode throughput\nBenchmark DuckDB parquet scans';
      const inPlace = convertPreviewSelectionToTasksInMarkdown(
        doc,
        'Compare SQLite WAL mode throughput'
      );
      expect(inPlace.mode).toBe('in-place');
      expect(inPlace.tasksCreated).toBe(1);
      expect(inPlace.content).toContain('- [ ] Compare SQLite WAL mode throughput');

      const appended = convertPreviewSelectionToTasksInMarkdown(
        doc,
        'Synthesized action item not verbatim in doc'
      );
      expect(appended.mode).toBe('appended');
      expect(appended.tasksCreated).toBe(1);
      expect(appended.content.endsWith('- [ ] Synthesized action item not verbatim in doc')).toBe(
        true
      );
    });
  });

  describe('Browser → Scratchpad capture', () => {
    it('formats clipped browser paragraphs with blockquote styling and source attribution', () => {
      const md = formatBrowserClipMarkdown(
        'Local-first software keeps user data fast and private.',
        {
          title: 'Ink & Switch — Local-First Software',
          url: 'https://www.inkandswitch.com/local-first/',
        }
      );

      expect(md).toBe(
        '> Local-first software keeps user data fast and private.\n\nSource: [Ink & Switch — Local-First Software](https://www.inkandswitch.com/local-first/)'
      );
    });

    it('appends selections, creates new notes, and adds checklist tasks in Scratchpad while dispatching cross-window open events', () => {
      const seed = createScratchpadNote({
        id: 'note-seed',
        title: 'Research Log',
        content: 'Initial thoughts.',
      });
      saveNotesState({ notes: [seed], activeNoteId: seed.id });

      const openedApps: OpenAppEventDetail[] = [];
      const onOpenApp = (e: Event) => {
        openedApps.push((e as CustomEvent<OpenAppEventDetail>).detail);
      };
      window.addEventListener(NEXUS_OPEN_APP_EVENT, onOpenApp);

      try {
        // 1. Append paragraph to active note
        const appendRes = sendSelectionToScratchpad({
          text: 'WebAssembly GC enables managed languages to share the host heap.',
          mode: 'append-note',
          source: { query: 'WebAssembly GC' },
        });
        expect(appendRes?.mode).toBe('append-note');

        let stored = readNotesState();
        expect(stored.notes[0].content).toContain('Initial thoughts.');
        expect(stored.notes[0].content).toContain(
          '> WebAssembly GC enables managed languages to share the host heap.'
        );
        expect(stored.notes[0].content).toContain('Source: Browser research · “WebAssembly GC”');

        // 2. Append selection as checklist task with URL link
        const taskRes = sendSelectionToScratchpad({
          text: 'Read the W3C Wasm GC specification',
          mode: 'append-task',
          source: {
            title: 'WebAssembly Spec',
            url: 'https://webassembly.github.io/gc/',
          },
        });
        expect(taskRes?.addedTasks).toBe(1);
        stored = readNotesState();
        expect(stored.notes[0].content).toContain(
          '- [ ] Read the W3C Wasm GC specification ([WebAssembly Spec](https://webassembly.github.io/gc/))'
        );

        // 3. Create new dedicated note from selection
        const newNoteRes = sendSelectionToScratchpad({
          text: 'Dieter Rams: Good design is as little design as possible.',
          mode: 'new-note',
          source: { title: 'Design Principles' },
        });
        expect(newNoteRes?.mode).toBe('new-note');
        stored = readNotesState();
        expect(stored.notes).toHaveLength(2);
        expect(stored.activeNoteId).toBe(newNoteRes?.note.id);
        expect(deriveNoteTitleFromSelection('Dieter Rams: Good design is clear.')).toBe(
          'Dieter Rams: Good design is clear.'
        );

        expect(openedApps).toHaveLength(3);
        expect(openedApps.every((d) => d.appId === 'notes' && d.preferExisting === true)).toBe(
          true
        );
      } finally {
        window.removeEventListener(NEXUS_OPEN_APP_EVENT, onOpenApp);
      }
    });
  });

  describe('Scratchpad → Browser research handoff & toolbar positioning', () => {
    it('enqueues Gemini + Web search for prose selections and direct URL navigation for selected links', () => {
      const openedApps: OpenAppEventDetail[] = [];
      const onOpenApp = (e: Event) => {
        openedApps.push((e as CustomEvent<OpenAppEventDetail>).detail);
      };
      window.addEventListener(NEXUS_OPEN_APP_EVENT, onOpenApp);

      try {
        const searchRes = researchSelectionInBrowser(
          '  - [ ] Compare CRDTs vs Operational Transformation  '
        );
        expect(searchRes).toEqual({
          kind: 'search',
          target: 'Compare CRDTs vs Operational Transformation',
        });

        const urlRes = researchSelectionInBrowser('https://developer.mozilla.org/en-US/');
        expect(urlRes).toEqual({
          kind: 'url',
          target: 'https://developer.mozilla.org/en-US/',
        });

        const queued = consumePendingBrowserNavigations();
        expect(queued).toHaveLength(2);
        expect(queued[0]).toEqual({
          kind: 'search',
          query: 'Compare CRDTs vs Operational Transformation',
          engine: 'ai',
        });
        expect(queued[1]).toMatchObject({
          kind: 'url',
          url: 'https://developer.mozilla.org/en-US/',
        });
        expect(openedApps.map((a) => a.appId)).toEqual(['browser', 'browser']);
      } finally {
        window.removeEventListener(NEXUS_OPEN_APP_EVENT, onOpenApp);
      }
    });

    it('clamps floating action bar within container edges and flips below when near the top', () => {
      const container = { left: 100, top: 100, width: 600, height: 400 };

      // Near top-left corner -> flips below and clamps x >= 10
      const nearTopLeft = computeFloatingBarPosition(
        { left: 105, top: 112, bottom: 132, width: 30 },
        container,
        { width: 340, height: 38 }
      );
      expect(nearTopLeft.placement).toBe('below');
      expect(nearTopLeft.x).toBe(10);
      expect(nearTopLeft.y).toBe(40);

      // Middle of container -> places cleanly above selection
      const middle = computeFloatingBarPosition(
        { left: 350, top: 260, bottom: 280, width: 100 },
        container,
        { width: 340, height: 38 }
      );
      expect(middle.placement).toBe('above');
      expect(middle.x).toBe(130);
      expect(middle.y).toBe(114);
    });
  });
});
