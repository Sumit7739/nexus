import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bold,
  Check,
  CheckSquare,
  Code,
  Compass,
  Copy,
  Download,
  ExternalLink,
  Heading2,
  Italic,
  Minus,
  PanelLeft,
  Pause,
  Pin,
  Play,
  Plus,
  Quote,
  Search,
  Sparkles,
  StickyNote,
  Timer,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import { stashItem } from '../data/stash';
import {
  clearCompletedTasks,
  computeNoteStats,
  createScratchpadNote,
  extractNoteSnippet,
  extractNoteTitle,
  formatRelativeNoteTime,
  parseMarkdownBlocks,
  readNotesState,
  SAMPLE_CHECKLIST_TEMPLATE,
  saveNotesState,
  slugifyNoteFilename,
  sortNotesForSidebar,
  toggleChecklistLine,
  type InlineToken,
  type MarkdownBlock,
  type NotesState,
  type ScratchpadNote,
} from '../data/notes';
import { SelectionActionBar } from '../components/SelectionActionBar';
import { classifyOmniboxInput } from '../data/browser';
import {
  computeFloatingBarPosition,
  convertPreviewSelectionToTasksInMarkdown,
  convertRangeInMarkdownToTasks,
  deriveNoteTitleFromSelection,
  researchSelectionInBrowser,
} from '../data/context-actions';
import {
  cleanTaskDisplayText,
  completeLinkedScratchpadTask,
  extendFocusSession,
  extractUncheckedTasksFromNotes,
  finishFocusSessionEarly,
  formatFocusClock,
  getFocusState,
  pauseFocusSession,
  requestOpenFocusPopover,
  resetFocusSession,
  resumeFocusSession,
  startFocusSession,
  subscribeFocusState,
} from '../data/focus';

type EditorMode = 'write' | 'split' | 'preview';
type NoteFilter = 'all' | 'pinned' | 'tasks';

function renderInlineTokens(tokens: InlineToken[], keyPrefix: string): ReactNode[] {
  return tokens.map((tok, idx) => {
    const key = `${keyPrefix}-${idx}`;
    switch (tok.type) {
      case 'text':
        return tok.value;
      case 'code':
        return (
          <code key={key} className="sp-md-inline-code">
            {tok.value}
          </code>
        );
      case 'strong':
        return <strong key={key}>{renderInlineTokens(tok.children, key)}</strong>;
      case 'em':
        return <em key={key}>{renderInlineTokens(tok.children, key)}</em>;
      case 'del':
        return <del key={key}>{renderInlineTokens(tok.children, key)}</del>;
      case 'link':
        return (
          <a key={key} href={tok.href} target="_blank" rel="noopener noreferrer" className="sp-md-link">
            {tok.label}
          </a>
        );
    }
  });
}

function tokensToPlainText(tokens: InlineToken[]): string {
  return tokens
    .map((tok) => {
      switch (tok.type) {
        case 'text':
        case 'code':
          return tok.value;
        case 'link':
          return tok.label;
        case 'strong':
        case 'em':
        case 'del':
          return tokensToPlainText(tok.children);
      }
    })
    .join('');
}

function MarkdownPreview({
  content,
  onToggleTask,
  onFocusTask,
  activeFocusLineIndex,
  activeFocusClock,
}: {
  content: string;
  onToggleTask: (lineIndex: number) => void;
  onFocusTask?: (lineIndex: number, text: string) => void;
  activeFocusLineIndex?: number | null;
  activeFocusClock?: string | null;
}) {
  const blocks = useMemo(() => parseMarkdownBlocks(content), [content]);
  const [copiedBlockIdx, setCopiedBlockIdx] = useState<number | null>(null);

  if (blocks.length === 0) {
    return (
      <div className="sp-preview-empty">
        <StickyNote size={18} strokeWidth={1.5} />
        <strong>Nothing to preview yet</strong>
        <span>Switch to Write or Split mode to start drafting Markdown or task checklists.</span>
      </div>
    );
  }

  const copyCode = (idx: number, code: string) => {
    navigator.clipboard?.writeText(code).catch(() => {});
    setCopiedBlockIdx(idx);
    window.setTimeout(() => {
      setCopiedBlockIdx((prev) => (prev === idx ? null : prev));
    }, 1500);
  };

  return (
    <div className="sp-markdown-body">
      {blocks.map((block: MarkdownBlock, bIdx: number) => {
        const key = `b-${bIdx}`;
        switch (block.type) {
          case 'heading': {
            const Tag = `h${block.level}` as 'h1' | 'h2' | 'h3' | 'h4';
            return (
              <Tag key={key} className={`sp-md-h${block.level}`}>
                {renderInlineTokens(block.tokens, key)}
              </Tag>
            );
          }
          case 'paragraph':
            return (
              <p key={key} className="sp-md-p">
                {block.lines.map((lineTokens, lIdx) => (
                  <span key={`${key}-l-${lIdx}`}>
                    {lIdx > 0 && <br />}
                    {renderInlineTokens(lineTokens, `${key}-l-${lIdx}`)}
                  </span>
                ))}
              </p>
            );
          case 'task-list':
            return (
              <ul key={key} className="sp-md-tasks">
                {block.items.map((item) => {
                  const plainTaskText = cleanTaskDisplayText(tokensToPlainText(item.tokens));
                  const isFocusingThis =
                    !item.checked &&
                    activeFocusLineIndex !== null &&
                    activeFocusLineIndex !== undefined &&
                    activeFocusLineIndex === item.lineIndex;
                  return (
                    <li
                      key={`task-${item.lineIndex}`}
                      className={`sp-md-task-row${item.checked ? ' is-done' : ''}${
                        isFocusingThis ? ' is-focusing' : ''
                      }${item.indent > 0 ? ` indent-${item.indent}` : ''}`}
                    >
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={item.checked}
                        className={`sp-task-checkbox${item.checked ? ' is-checked' : ''}`}
                        onClick={() => onToggleTask(item.lineIndex)}
                        title={item.checked ? 'Mark incomplete' : 'Mark complete'}
                      >
                        {item.checked && <Check size={11} strokeWidth={2.5} />}
                      </button>
                      <span
                        className="sp-md-task-label"
                        onClick={() => onToggleTask(item.lineIndex)}
                      >
                        {item.tokens.length > 0 ? (
                          renderInlineTokens(item.tokens, `task-${item.lineIndex}`)
                        ) : (
                          <span className="sp-muted-placeholder">Empty task</span>
                        )}
                      </span>
                      {!item.checked && plainTaskText && onFocusTask && (
                        isFocusingThis ? (
                          <button
                            type="button"
                            className="sp-task-focus-btn is-active"
                            onClick={(e) => {
                              e.stopPropagation();
                              requestOpenFocusPopover();
                            }}
                            title="Open active focus timer"
                          >
                            <Timer size={11} />
                            <span>{activeFocusClock || 'Focusing'}</span>
                          </button>
                        ) : (
                          <button
                            type="button"
                            className="sp-task-focus-btn"
                            onClick={(e) => {
                              e.stopPropagation();
                              onFocusTask(item.lineIndex, plainTaskText);
                            }}
                            title={`Start focus ritual on "${plainTaskText}"`}
                          >
                            <Timer size={11} />
                            <span>Focus</span>
                          </button>
                        )
                      )}
                    </li>
                  );
                })}
              </ul>
            );
          case 'unordered-list':
            return (
              <ul key={key} className="sp-md-ul">
                {block.items.map((item, iIdx) => (
                  <li key={`${key}-${iIdx}`}>{renderInlineTokens(item, `${key}-${iIdx}`)}</li>
                ))}
              </ul>
            );
          case 'ordered-list':
            return (
              <ol key={key} start={block.start} className="sp-md-ol">
                {block.items.map((item, iIdx) => (
                  <li key={`${key}-${iIdx}`}>{renderInlineTokens(item, `${key}-${iIdx}`)}</li>
                ))}
              </ol>
            );
          case 'blockquote':
            return (
              <blockquote key={key} className="sp-md-quote">
                {block.lines.map((lineTokens, lIdx) => (
                  <p key={`${key}-q-${lIdx}`}>{renderInlineTokens(lineTokens, `${key}-q-${lIdx}`)}</p>
                ))}
              </blockquote>
            );
          case 'code-block':
            return (
              <div key={key} className="sp-md-codewrap">
                <div className="sp-md-codebar">
                  <span>{block.language || 'code'}</span>
                  <button
                    type="button"
                    className="sp-code-copy"
                    onClick={() => copyCode(bIdx, block.code)}
                  >
                    {copiedBlockIdx === bIdx ? <Check size={11} /> : <Copy size={11} />}
                    {copiedBlockIdx === bIdx ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <pre className="sp-md-pre">
                  <code>{block.code}</code>
                </pre>
              </div>
            );
          case 'hr':
            return <hr key={key} className="sp-md-hr" />;
        }
      })}
    </div>
  );
}

export function ScratchpadApp() {
  const focus = useSyncExternalStore(subscribeFocusState, getFocusState);
  const [state, setState] = useState<NotesState>(readNotesState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<EditorMode>('write');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);
  const [selectionMenu, setSelectionMenu] = useState<{
    origin: 'editor' | 'preview';
    text: string;
    selectionStart: number;
    selectionEnd: number;
    x: number;
    y: number;
    placement: 'above' | 'below';
  } | null>(null);
  const [actionNotice, setActionNotice] = useState<string | null>(null);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);
  const stageRef = useRef<HTMLDivElement | null>(null);
  const previewPaneRef = useRef<HTMLDivElement | null>(null);
  const noticeTimerRef = useRef<number | null>(null);

  const showActionNotice = useCallback((msg: string) => {
    setActionNotice(msg);
    if (noticeTimerRef.current !== null) {
      window.clearTimeout(noticeTimerRef.current);
    }
    noticeTimerRef.current = window.setTimeout(() => {
      setActionNotice(null);
      noticeTimerRef.current = null;
    }, 2400);
  }, []);

  useEffect(() => {
    return () => {
      if (noticeTimerRef.current !== null) {
        window.clearTimeout(noticeTimerRef.current);
      }
    };
  }, []);

  /* Persist whenever state changes */
  useEffect(() => {
    saveNotesState(state);
  }, [state]);

  /* Sync if workspace backup is imported or reset while Scratchpad is open */
  useEffect(() => {
    const onStorageSync = () => {
      setState(readNotesState());
      setConfirmDeleteId(null);
    };
    window.addEventListener('storage', onStorageSync);
    return () => window.removeEventListener('storage', onStorageSync);
  }, []);

  const activeNote: ScratchpadNote = useMemo(() => {
    return state.notes.find((n) => n.id === state.activeNoteId) ?? state.notes[0];
  }, [state]);

  useEffect(() => {
    setSelectionMenu(null);
  }, [activeNote.id, mode]);

  const sortedNotes = useMemo(() => sortNotesForSidebar(state.notes), [state.notes]);

  const filteredNotes = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    return sortedNotes.filter((n) => {
      if (filter === 'pinned' && !n.pinned) return false;
      if (filter === 'tasks' && computeNoteStats(n.content).tasksTotal === 0) return false;
      if (!q) return true;
      const derivedTitle = extractNoteTitle(n.title, n.content).toLowerCase();
      return derivedTitle.includes(q) || n.content.toLowerCase().includes(q);
    });
  }, [sortedNotes, searchQuery, filter]);

  const stats = useMemo(() => computeNoteStats(activeNote.content), [activeNote.content]);

  const updateActiveNote = (patch: Partial<Pick<ScratchpadNote, 'title' | 'content' | 'pinned'>>) => {
    const now = Date.now();
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) =>
        n.id === activeNote.id ? { ...n, ...patch, updatedAt: now } : n
      ),
    }));
  };

  const handleCreateNote = () => {
    const fresh = createScratchpadNote();
    setState((prev) => ({
      notes: [fresh, ...prev.notes],
      activeNoteId: fresh.id,
    }));
    setSearchQuery('');
    setFilter('all');
    setConfirmDeleteId(null);
    if (mode === 'preview') setMode('write');
    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  };

  const handleTogglePin = (noteId: string) => {
    setState((prev) => ({
      ...prev,
      notes: prev.notes.map((n) => (n.id === noteId ? { ...n, pinned: !n.pinned } : n)),
    }));
  };

  const handleDeleteNote = (note: ScratchpadNote) => {
    const isEmpty = !note.title.trim() && !note.content.trim();
    if (!isEmpty && confirmDeleteId !== note.id) {
      setConfirmDeleteId(note.id);
      return;
    }

    setState((prev) => {
      const remaining = prev.notes.filter((n) => n.id !== note.id);
      if (remaining.length === 0) {
        const replacement = createScratchpadNote();
        return { notes: [replacement], activeNoteId: replacement.id };
      }
      const nextActive =
        prev.activeNoteId === note.id
          ? sortNotesForSidebar(remaining)[0].id
          : prev.activeNoteId;
      return { notes: remaining, activeNoteId: nextActive };
    });
    setConfirmDeleteId(null);
  };

  const uncheckedInActiveNote = useMemo(
    () => extractUncheckedTasksFromNotes([activeNote], 25),
    [activeNote]
  );

  const handleToggleTaskLine = (lineIndex: number) => {
    const nextContent = toggleChecklistLine(activeNote.content, lineIndex);
    if (nextContent !== activeNote.content) {
      updateActiveNote({ content: nextContent });
    }
  };

  const handleFocusTaskLine = (lineIndex: number, text: string) => {
    const noteTitle = extractNoteTitle(activeNote.title, activeNote.content);
    const mins = focus.preferences.defaultDurationMinutes;
    startFocusSession({
      linkedTask: {
        noteId: activeNote.id,
        noteTitle,
        lineIndex,
        text,
      },
      intention: text,
      durationMinutes: mins,
    });
    showActionNotice(`Started ${mins}m focus on "${text.slice(0, 36)}"`);
  };

  const handleCompleteFocusAndCheckTask = () => {
    if (focus.status === 'running' || focus.status === 'paused') {
      finishFocusSessionEarly();
    }
    if (focus.linkedTask) {
      const checked = completeLinkedScratchpadTask(focus.linkedTask);
      if (checked) {
        setState(readNotesState());
        showActionNotice('Checked off focus task');
      }
    }
  };

  const handleClearCompleted = () => {
    const nextContent = clearCompletedTasks(activeNote.content);
    if (nextContent !== activeNote.content) {
      updateActiveNote({ content: nextContent });
    }
  };

  const handleCopyMarkdown = () => {
    const payload = activeNote.title.trim()
      ? `# ${activeNote.title.trim()}\n\n${activeNote.content}`
      : activeNote.content;
    navigator.clipboard?.writeText(payload).catch(() => {});
    setCopiedNote(true);
    window.setTimeout(() => setCopiedNote(false), 1600);
  };

  const handleDownloadMarkdown = () => {
    const filename = slugifyNoteFilename(activeNote.title, activeNote.content);
    const hasHeadingOnLineOne = /^\s*#\s+/.test(activeNote.content);
    const body =
      activeNote.title.trim() && !hasHeadingOnLineOne
        ? `# ${activeNote.title.trim()}\n\n${activeNote.content}`
        : activeNote.content;

    const blob = new Blob([body], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement('a');
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  /* ── Editor formatting helpers ── */
  const applyWrapSelection = (prefix: string, suffix: string, placeholder: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = activeNote.content;
    const selected = val.slice(start, end);
    const inner = selected || placeholder;
    const next = `${val.slice(0, start)}${prefix}${inner}${suffix}${val.slice(end)}`;
    updateActiveNote({ content: next });

    window.requestAnimationFrame(() => {
      el.focus();
      el.setSelectionRange(start + prefix.length, start + prefix.length + inner.length);
    });
  };

  const applyLinePrefix = (prefix: string) => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = activeNote.content;

    if (prefix === '- [ ] ' && end > start) {
      const converted = convertRangeInMarkdownToTasks(val, start, end);
      updateActiveNote({ content: converted.content });
      setSelectionMenu(null);
      window.requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(converted.nextSelectionStart, converted.nextSelectionEnd);
      });
      return;
    }

    const lineStart = val.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const lineEndIdx = val.indexOf('\n', start);
    const lineEnd = lineEndIdx === -1 ? val.length : lineEndIdx;
    const currentLine = val.slice(lineStart, lineEnd);

    let nextLine: string;
    let delta: number;

    if (prefix === '- [ ] ') {
      if (/^\s*[-*]\s+\[[ xX]\]\s*/.test(currentLine)) {
        nextLine = currentLine.replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '');
        delta = nextLine.length - currentLine.length;
      } else if (/^\s*[-*]\s+/.test(currentLine)) {
        nextLine = currentLine.replace(/^(\s*)[-*]\s+/, '$1- [ ] ');
        delta = nextLine.length - currentLine.length;
      } else {
        nextLine = `- [ ] ${currentLine}`;
        delta = 6;
      }
    } else if (currentLine.startsWith(prefix)) {
      nextLine = currentLine.slice(prefix.length);
      delta = -prefix.length;
    } else {
      const stripped = currentLine.replace(/^(#{1,4}\s+|>\s+)/, '');
      nextLine = `${prefix}${stripped}`;
      delta = nextLine.length - currentLine.length;
    }

    const next = `${val.slice(0, lineStart)}${nextLine}${val.slice(lineEnd)}`;
    updateActiveNote({ content: next });

    window.requestAnimationFrame(() => {
      el.focus();
      const nextCursor = Math.max(lineStart, start + delta);
      el.setSelectionRange(nextCursor, nextCursor);
    });
  };

  /* ── Context-Aware Selection Detection (Editor + Preview) ── */
  const evaluateEditorSelection = (pointer?: { clientX: number; clientY: number }) => {
    const el = textareaRef.current;
    const stage = stageRef.current;
    if (!el || !stage) return;

    const start = el.selectionStart;
    const end = el.selectionEnd;
    const raw = el.value.slice(start, end);
    if (end <= start || raw.trim().length < 2) {
      setSelectionMenu((prev) => (prev?.origin === 'editor' ? null : prev));
      return;
    }

    const stageRect = stage.getBoundingClientRect();
    const editorRect = el.getBoundingClientRect();

    const anchor = pointer
      ? {
          left: pointer.clientX - 20,
          top: pointer.clientY - 22,
          bottom: pointer.clientY + 12,
          width: 40,
        }
      : {
          left: editorRect.left + editorRect.width / 2 - 20,
          top: editorRect.top + 52,
          bottom: editorRect.top + 72,
          width: 40,
        };

    const pos = computeFloatingBarPosition(anchor, stageRect, {
      width: 390,
      height: 38,
    });

    setSelectionMenu({
      origin: 'editor',
      text: raw,
      selectionStart: start,
      selectionEnd: end,
      x: pos.x,
      y: pos.y,
      placement: pos.placement,
    });
  };

  const evaluatePreviewSelection = () => {
    const previewEl = previewPaneRef.current;
    const stage = stageRef.current;
    if (!previewEl || !stage) return;

    const sel = window.getSelection();
    if (!sel || sel.isCollapsed || sel.rangeCount === 0) {
      setSelectionMenu((prev) => (prev?.origin === 'preview' ? null : prev));
      return;
    }

    const raw = sel.toString().trim();
    if (raw.length < 2) {
      setSelectionMenu((prev) => (prev?.origin === 'preview' ? null : prev));
      return;
    }

    const range = sel.getRangeAt(0);
    if (!previewEl.contains(range.commonAncestorContainer)) {
      return;
    }

    const rangeRect = range.getBoundingClientRect();
    const stageRect = stage.getBoundingClientRect();
    const anchor =
      rangeRect.width === 0 && rangeRect.height === 0
        ? {
            left: stageRect.left + stageRect.width / 2 - 20,
            top: stageRect.top + 48,
            bottom: stageRect.top + 68,
            width: 40,
          }
        : {
            left: rangeRect.left,
            top: rangeRect.top,
            bottom: rangeRect.bottom,
            width: rangeRect.width,
          };

    const pos = computeFloatingBarPosition(anchor, stageRect, {
      width: 390,
      height: 38,
    });

    setSelectionMenu({
      origin: 'preview',
      text: raw,
      selectionStart: 0,
      selectionEnd: 0,
      x: pos.x,
      y: pos.y,
      placement: pos.placement,
    });
  };

  const handleTurnSelectionIntoTask = () => {
    if (!selectionMenu) return;

    if (selectionMenu.origin === 'editor') {
      const converted = convertRangeInMarkdownToTasks(
        activeNote.content,
        selectionMenu.selectionStart,
        selectionMenu.selectionEnd
      );
      updateActiveNote({ content: converted.content });
      setSelectionMenu(null);
      showActionNotice(
        converted.tasksCreated > 1
          ? `Converted ${converted.tasksCreated} lines into tasks`
          : 'Converted selection into task'
      );
      window.requestAnimationFrame(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.focus();
        el.setSelectionRange(converted.nextSelectionStart, converted.nextSelectionEnd);
      });
      return;
    }

    const previewResult = convertPreviewSelectionToTasksInMarkdown(
      activeNote.content,
      selectionMenu.text
    );
    updateActiveNote({ content: previewResult.content });
    try {
      window.getSelection()?.removeAllRanges();
    } catch {
      /* ignore */
    }
    setSelectionMenu(null);
    showActionNotice(
      previewResult.tasksCreated > 1
        ? `Converted ${previewResult.tasksCreated} items into tasks`
        : 'Converted selection into task'
    );
  };

  const handleExtractSelectionToNote = () => {
    if (!selectionMenu) return;
    const body = selectionMenu.text.trim();
    if (!body) return;
    const fresh = createScratchpadNote({
      title: deriveNoteTitleFromSelection(body, 'Extracted note'),
      content: body,
    });
    setState((prev) => ({
      notes: [fresh, ...prev.notes],
      activeNoteId: fresh.id,
    }));
    setSelectionMenu(null);
    showActionNotice('Created new note from selection');
  };

  const insertDivider = () => {
    const el = textareaRef.current;
    if (!el) return;
    const start = el.selectionStart;
    const end = el.selectionEnd;
    const val = activeNote.content;
    const needsLeadingNewline = start > 0 && val[start - 1] !== '\n';
    const snippet = `${needsLeadingNewline ? '\n' : ''}\n---\n\n`;
    const next = `${val.slice(0, start)}${snippet}${val.slice(end)}`;
    updateActiveNote({ content: next });

    window.requestAnimationFrame(() => {
      el.focus();
      const pos = start + snippet.length;
      el.setSelectionRange(pos, pos);
    });
  };

  const handleEditorKeyDown = (e: ReactKeyboardEvent<HTMLTextAreaElement>) => {
    const el = e.currentTarget;
    const { selectionStart, selectionEnd, value } = el;

    /* Cmd/Ctrl + B or I */
    if ((e.metaKey || e.ctrlKey) && !e.altKey) {
      const key = e.key.toLowerCase();
      if (key === 'b') {
        e.preventDefault();
        applyWrapSelection('**', '**', 'bold text');
        return;
      }
      if (key === 'i') {
        e.preventDefault();
        applyWrapSelection('*', '*', 'italic text');
        return;
      }
    }

    /* Tab / Shift+Tab indentation */
    if (e.key === 'Tab') {
      e.preventDefault();
      if (e.shiftKey) {
        const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
        if (value.slice(lineStart, lineStart + 2) === '  ') {
          const next = `${value.slice(0, lineStart)}${value.slice(lineStart + 2)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            const pos = Math.max(lineStart, selectionStart - 2);
            el.setSelectionRange(pos, Math.max(lineStart, selectionEnd - 2));
          });
        }
      } else {
        const next = `${value.slice(0, selectionStart)}  ${value.slice(selectionEnd)}`;
        updateActiveNote({ content: next });
        window.requestAnimationFrame(() => {
          el.setSelectionRange(selectionStart + 2, selectionStart + 2);
        });
      }
      return;
    }

    /* Smart Enter continuation for checklists & lists */
    if (e.key === 'Enter' && selectionStart === selectionEnd && !e.shiftKey) {
      const lineStart = value.lastIndexOf('\n', Math.max(0, selectionStart - 1)) + 1;
      const lineBeforeCursor = value.slice(lineStart, selectionStart);

      const taskMatch = /^(\s*)([-*])\s+\[[ xX]\]\s*(.*)$/.exec(lineBeforeCursor);
      if (taskMatch) {
        e.preventDefault();
        const [, indent, bullet, body] = taskMatch;
        if (!body.trim()) {
          /* Empty task item -> exit checklist cleanly */
          const next = `${value.slice(0, lineStart)}${value.slice(selectionStart)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            el.setSelectionRange(lineStart, lineStart);
          });
        } else {
          const insert = `\n${indent}${bullet} [ ] `;
          const next = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            const pos = selectionStart + insert.length;
            el.setSelectionRange(pos, pos);
          });
        }
        return;
      }

      const ulMatch = /^(\s*)([-*+])\s+(.*)$/.exec(lineBeforeCursor);
      if (ulMatch) {
        e.preventDefault();
        const [, indent, bullet, body] = ulMatch;
        if (!body.trim()) {
          const next = `${value.slice(0, lineStart)}${value.slice(selectionStart)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            el.setSelectionRange(lineStart, lineStart);
          });
        } else {
          const insert = `\n${indent}${bullet} `;
          const next = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            const pos = selectionStart + insert.length;
            el.setSelectionRange(pos, pos);
          });
        }
        return;
      }

      const olMatch = /^(\s*)(\d+)\.\s+(.*)$/.exec(lineBeforeCursor);
      if (olMatch) {
        e.preventDefault();
        const [, indent, numStr, body] = olMatch;
        if (!body.trim()) {
          const next = `${value.slice(0, lineStart)}${value.slice(selectionStart)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            el.setSelectionRange(lineStart, lineStart);
          });
        } else {
          const nextNum = (Number.parseInt(numStr, 10) || 1) + 1;
          const insert = `\n${indent}${nextNum}. `;
          const next = `${value.slice(0, selectionStart)}${insert}${value.slice(selectionEnd)}`;
          updateActiveNote({ content: next });
          window.requestAnimationFrame(() => {
            const pos = selectionStart + insert.length;
            el.setSelectionRange(pos, pos);
          });
        }
      }
    }
  };

  const isBlankActiveNote = !activeNote.title.trim() && !activeNote.content.trim();

  return (
    <div className={`scratchpad-shell${sidebarOpen ? '' : ' is-sidebar-collapsed'}`}>
      {/* ── Left Multi-Note Sidebar ── */}
      {sidebarOpen && (
        <aside className="sp-sidebar" aria-label="Scratchpad notes">
          <div className="sp-sidebar-top">
            <div className="sp-search-box">
              <Search size={12} strokeWidth={1.7} />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search notes…"
                aria-label="Search notes"
              />
              {searchQuery && (
                <button
                  type="button"
                  className="sp-search-clear"
                  onClick={() => setSearchQuery('')}
                  aria-label="Clear search"
                >
                  <X size={11} />
                </button>
              )}
            </div>
            <button
              type="button"
              className="primary-btn sp-new-btn"
              onClick={handleCreateNote}
              title="New note"
            >
              <Plus size={13} strokeWidth={2} />
              New
            </button>
          </div>

          <div className="sp-filter-row" role="tablist" aria-label="Filter notes">
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'all'}
              className={filter === 'all' ? 'is-active' : ''}
              onClick={() => setFilter('all')}
            >
              All ({state.notes.length})
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'pinned'}
              className={filter === 'pinned' ? 'is-active' : ''}
              onClick={() => setFilter('pinned')}
            >
              Pinned
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={filter === 'tasks'}
              className={filter === 'tasks' ? 'is-active' : ''}
              onClick={() => setFilter('tasks')}
            >
              Checklists
            </button>
          </div>

          <div className="sp-note-list">
            {filteredNotes.length === 0 ? (
              <div className="sp-sidebar-empty">
                <span>No matching notes.</span>
                {(searchQuery || filter !== 'all') && (
                  <button
                    type="button"
                    className="secondary-btn"
                    onClick={() => {
                      setSearchQuery('');
                      setFilter('all');
                    }}
                  >
                    Show all notes
                  </button>
                )}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = note.id === activeNote.id;
                const noteTitle = extractNoteTitle(note.title, note.content);
                const snippet = extractNoteSnippet(note.title, note.content);
                const noteStats = computeNoteStats(note.content);
                const isConfirming = confirmDeleteId === note.id;

                return (
                  <div
                    key={note.id}
                    className={`sp-note-item${isSelected ? ' is-active' : ''}`}
                    onClick={() => {
                      setState((prev) => ({ ...prev, activeNoteId: note.id }));
                      setConfirmDeleteId(null);
                    }}
                  >
                    <div className="sp-note-item-head">
                      <span className="sp-note-item-title">
                        {note.pinned && <Pin size={10} className="sp-pin-inline" />}
                        {noteTitle}
                      </span>
                      <div
                        className={`sp-note-item-actions${isConfirming ? ' is-visible' : ''}`}
                        onClick={(e) => e.stopPropagation()}
                      >
                        {isConfirming ? (
                          <>
                            <button
                              type="button"
                              className="sp-confirm-del"
                              onClick={() => handleDeleteNote(note)}
                              title="Confirm delete"
                            >
                              Delete
                            </button>
                            <button
                              type="button"
                              className="sp-cancel-del"
                              onClick={() => setConfirmDeleteId(null)}
                              aria-label="Cancel delete"
                            >
                              <X size={11} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button
                              type="button"
                              className={`sp-mini-icon${note.pinned ? ' is-pinned' : ''}`}
                              onClick={() => handleTogglePin(note.id)}
                              title={note.pinned ? 'Unpin note' : 'Pin note'}
                              aria-label={note.pinned ? 'Unpin note' : 'Pin note'}
                            >
                              <Pin size={11} />
                            </button>
                            <button
                              type="button"
                              className="sp-mini-icon danger"
                              onClick={() => handleDeleteNote(note)}
                              title="Delete note"
                              aria-label="Delete note"
                            >
                              <Trash2 size={11} />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    <p className="sp-note-item-snippet">{snippet}</p>

                    <div className="sp-note-item-meta">
                      <span>{formatRelativeNoteTime(note.updatedAt)}</span>
                      {noteStats.tasksTotal > 0 ? (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>
                            {noteStats.tasksCompleted}/{noteStats.tasksTotal} done
                          </span>
                        </>
                      ) : (
                        <>
                          <span aria-hidden="true">·</span>
                          <span>{noteStats.words}w</span>
                        </>
                      )}
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </aside>
      )}

      {/* ── Main Note Stage ── */}
      <section className="sp-main">
        {/* Top bar: Sidebar toggle + Title input + View switcher + Export */}
        <header className="sp-header">
          <div className="sp-header-left">
            <button
              type="button"
              className={`icon-btn sp-sidebar-toggle${sidebarOpen ? ' is-active' : ''}`}
              onClick={() => setSidebarOpen((v) => !v)}
              title={sidebarOpen ? 'Hide notes sidebar' : 'Show notes sidebar'}
              aria-label={sidebarOpen ? 'Hide notes sidebar' : 'Show notes sidebar'}
            >
              <PanelLeft size={14} />
            </button>
            <input
              ref={titleInputRef}
              type="text"
              className="sp-title-input"
              value={activeNote.title}
              onChange={(e) => updateActiveNote({ title: e.target.value })}
              placeholder={extractNoteTitle('', activeNote.content)}
              aria-label="Note title"
            />
          </div>

          <div className="sp-header-right">
            <div className="ws-seg" role="group" aria-label="Editor view mode">
              <button
                type="button"
                className={mode === 'write' ? 'is-active' : ''}
                onClick={() => setMode('write')}
              >
                Write
              </button>
              <button
                type="button"
                className={mode === 'split' ? 'is-active' : ''}
                onClick={() => setMode('split')}
              >
                Split
              </button>
              <button
                type="button"
                className={mode === 'preview' ? 'is-active' : ''}
                onClick={() => setMode('preview')}
              >
                Preview
              </button>
            </div>

            <button
              type="button"
              className="icon-btn"
              onClick={handleCopyMarkdown}
              title="Copy Markdown"
              aria-label="Copy Markdown"
            >
              {copiedNote ? <Check size={13} /> : <Copy size={13} />}
            </button>

            <button
              type="button"
              className="secondary-btn sp-download-btn"
              onClick={handleDownloadMarkdown}
              title="Download as .md file"
            >
              <Download size={12} />
              .md
            </button>
          </div>
        </header>

        {/* Formatting & Checklist Strip (shown in Write & Split modes) */}
        {mode !== 'preview' && (
          <div className="sp-format-bar" role="toolbar" aria-label="Markdown formatting">
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyLinePrefix('- [ ] ')}
              title="Toggle checklist item (- [ ] )"
            >
              <CheckSquare size={12} />
              <span>Task</span>
            </button>
            <span className="sp-fmt-sep" aria-hidden="true" />
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyLinePrefix('## ')}
              title="Heading (## )"
              aria-label="Heading"
            >
              <Heading2 size={13} />
            </button>
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyWrapSelection('**', '**', 'bold')}
              title="Bold (Ctrl/Cmd + B)"
              aria-label="Bold"
            >
              <Bold size={12} />
            </button>
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyWrapSelection('*', '*', 'italic')}
              title="Italic (Ctrl/Cmd + I)"
              aria-label="Italic"
            >
              <Italic size={12} />
            </button>
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyWrapSelection('`', '`', 'code')}
              title="Inline code"
              aria-label="Inline code"
            >
              <Code size={12} />
            </button>
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={() => applyLinePrefix('> ')}
              title="Blockquote (> )"
              aria-label="Blockquote"
            >
              <Quote size={12} />
            </button>
            <button
              type="button"
              className="sp-fmt-btn"
              onClick={insertDivider}
              title="Horizontal divider (---)"
              aria-label="Horizontal divider"
            >
              <Minus size={12} />
            </button>

            <div className="sp-format-spacer" />

            {isBlankActiveNote && (
              <button
                type="button"
                className="sp-fmt-text-action"
                onClick={() => updateActiveNote({ content: SAMPLE_CHECKLIST_TEMPLATE })}
              >
                Insert checklist template
              </button>
            )}

            {focus.status === 'idle' && uncheckedInActiveNote.length > 0 && (
              <button
                type="button"
                className="sp-fmt-text-action"
                onClick={() =>
                  handleFocusTaskLine(
                    uncheckedInActiveNote[0].lineIndex,
                    uncheckedInActiveNote[0].text
                  )
                }
                title={`Start focus ritual on "${uncheckedInActiveNote[0].text}"`}
              >
                Focus next task
              </button>
            )}

            {stats.tasksCompleted > 0 && (
              <button
                type="button"
                className="sp-fmt-text-action"
                onClick={handleClearCompleted}
              >
                Clear completed ({stats.tasksCompleted})
              </button>
            )}
          </div>
        )}

        {/* Active Focus Session Strip (visible across Write / Split / Preview) */}
        {focus.status !== 'idle' && (
          <div
            className={`sp-focus-banner status-${focus.status}`}
            role="region"
            aria-label="Active focus session"
          >
            <button
              type="button"
              className="sp-focus-banner-main"
              onClick={() => requestOpenFocusPopover()}
              title="Open Focus Ritual controls"
            >
              <Timer size={13} strokeWidth={1.7} />
              <span className="sp-focus-banner-clock">
                {focus.status === 'completed'
                  ? 'Complete'
                  : formatFocusClock(focus.remainingSeconds)}
              </span>
              <span aria-hidden="true">·</span>
              <span className="sp-focus-banner-text">
                {focus.intention || 'Deep work session'}
              </span>
            </button>
            <div className="sp-focus-banner-actions">
              {(focus.status === 'running' || focus.status === 'paused') && (
                <>
                  <button
                    type="button"
                    className="sp-focus-mini-btn"
                    onClick={() =>
                      focus.status === 'running'
                        ? pauseFocusSession()
                        : resumeFocusSession()
                    }
                  >
                    {focus.status === 'running' ? <Pause size={11} /> : <Play size={11} />}
                    <span>{focus.status === 'running' ? 'Pause' : 'Resume'}</span>
                  </button>
                  <button
                    type="button"
                    className="sp-focus-mini-btn"
                    onClick={() => extendFocusSession(5)}
                  >
                    <span>+5m</span>
                  </button>
                  {focus.phase === 'focus' && (
                    <button
                      type="button"
                      className="sp-focus-mini-btn is-accent"
                      onClick={handleCompleteFocusAndCheckTask}
                    >
                      <Check size={11} />
                      <span>{focus.linkedTask ? 'Check off' : 'Finish'}</span>
                    </button>
                  )}
                </>
              )}
              {focus.status === 'completed' && (
                <>
                  {focus.linkedTask && (
                    <button
                      type="button"
                      className="sp-focus-mini-btn is-accent"
                      onClick={handleCompleteFocusAndCheckTask}
                    >
                      <CheckSquare size={11} />
                      <span>Check off task</span>
                    </button>
                  )}
                  <button
                    type="button"
                    className="sp-focus-mini-btn"
                    onClick={() => resetFocusSession()}
                  >
                    <span>Dismiss</span>
                  </button>
                </>
              )}
            </div>
          </div>
        )}

        {/* Editor / Split / Preview Stage */}
        <div
          ref={stageRef}
          className={`sp-stage mode-${mode}`}
          onMouseDown={(e) => {
            if (!(e.target as HTMLElement).closest('.sel-action-bar')) {
              setSelectionMenu(null);
            }
          }}
        >
          {selectionMenu && (() => {
            const trimmedSel = selectionMenu.text.trim();
            const urlCandidate =
              !/\s/.test(trimmedSel) ? classifyOmniboxInput(trimmedSel) : null;
            const isUrl = urlCandidate?.kind === 'url';

            return (
              <SelectionActionBar
                x={selectionMenu.x}
                y={selectionMenu.y}
                placement={selectionMenu.placement}
                ariaLabel="Scratchpad selection actions"
                onDismiss={() => setSelectionMenu(null)}
                actions={[
                  ...(isUrl
                    ? [
                        {
                          id: 'open-url-browser',
                          label: 'Open URL in Browser',
                          icon: <ExternalLink size={12} />,
                          primary: true,
                          title: 'Open selected URL in Nexus Browser',
                          onSelect: () => {
                            researchSelectionInBrowser(trimmedSel, {
                              preferUrlIfValid: true,
                              openBrowserWindow: true,
                            });
                            setSelectionMenu(null);
                            showActionNotice('Opened URL in Nexus Browser');
                          },
                        },
                      ]
                    : []),
                  {
                    id: 'research-browser',
                    label: isUrl ? 'Research' : 'Research in Browser',
                    icon: isUrl ? <Compass size={12} /> : <Sparkles size={12} />,
                    primary: !isUrl,
                    title: 'Ask Nexus Browser to research selected text with Gemini + Live Web Search',
                    onSelect: () => {
                      researchSelectionInBrowser(trimmedSel, {
                        engine: 'ai',
                        preferUrlIfValid: false,
                        openBrowserWindow: true,
                      });
                      setSelectionMenu(null);
                      showActionNotice('Researching selection in Nexus Browser');
                    },
                  },
                  {
                    id: 'turn-into-task',
                    label: 'Turn into Task',
                    icon: <CheckSquare size={12} />,
                    title: 'Convert selected text into checklist task item(s) (- [ ])',
                    onSelect: handleTurnSelectionIntoTask,
                  },
                  {
                    id: 'focus-selection',
                    label: `Focus ${focus.preferences.defaultDurationMinutes}m`,
                    icon: <Timer size={12} />,
                    title: 'Start a timed Focus Ritual on this selection',
                    onSelect: () => {
                      const cleanIntent = cleanTaskDisplayText(
                        selectionMenu.text.split(/\r?\n/)[0] ?? selectionMenu.text
                      ).replace(/^\s*[-*]\s+\[[ xX]\]\s*/, '');
                      if (cleanIntent) {
                        const matchedCandidate = uncheckedInActiveNote.find(
                          (t) => t.text === cleanIntent
                        );
                        startFocusSession({
                          linkedTask: matchedCandidate
                            ? {
                                noteId: matchedCandidate.noteId,
                                noteTitle: matchedCandidate.noteTitle,
                                lineIndex: matchedCandidate.lineIndex,
                                text: matchedCandidate.text,
                              }
                            : null,
                          intention: cleanIntent,
                          durationMinutes: focus.preferences.defaultDurationMinutes,
                        });
                        setSelectionMenu(null);
                        showActionNotice(
                          `Started ${focus.preferences.defaultDurationMinutes}m focus`
                        );
                      }
                    },
                  },
                  {
                    id: 'extract-note',
                    label: 'New Note',
                    icon: <Plus size={12} />,
                    title: 'Create a new Scratchpad note from selected text',
                    onSelect: handleExtractSelectionToNote,
                  },
                  {
                    id: 'stash-selection',
                    label: 'Stash',
                    icon: <Zap size={12} />,
                    title: 'Send selected text to Stash Edge Shelf',
                    onSelect: () => {
                      const item = stashItem({
                        content: selectionMenu.text,
                        source: {
                          title: activeNote ? extractNoteTitle(activeNote.title, activeNote.content) : 'Scratchpad note',
                        },
                        openShelf: true,
                      });
                      setSelectionMenu(null);
                      if (item) {
                        showActionNotice(`Stashed ${item.kind} card`);
                      }
                    },
                  },
                  {
                    id: 'copy-text',
                    label: 'Copy',
                    icon: <Copy size={12} />,
                    title: 'Copy selected text',
                    onSelect: () => {
                      navigator.clipboard?.writeText(selectionMenu.text).catch(() => {});
                      setSelectionMenu(null);
                      showActionNotice('Copied selection');
                    },
                  },
                ]}
              />
            );
          })()}

          {actionNotice && (
            <div className="ctx-action-toast" role="status" aria-live="polite">
              <Check size={12} />
              <span>{actionNotice}</span>
            </div>
          )}

          {mode !== 'preview' && (
            <div className="sp-editor-pane">
              <textarea
                ref={textareaRef}
                value={activeNote.content}
                onChange={(e) => {
                  updateActiveNote({ content: e.target.value });
                  if (selectionMenu) setSelectionMenu(null);
                }}
                onKeyDown={handleEditorKeyDown}
                onMouseUp={(e) => {
                  const pt = { clientX: e.clientX, clientY: e.clientY };
                  window.requestAnimationFrame(() => evaluateEditorSelection(pt));
                }}
                onKeyUp={() => window.requestAnimationFrame(() => evaluateEditorSelection())}
                onScroll={() => {
                  if (selectionMenu?.origin === 'editor') setSelectionMenu(null);
                }}
                placeholder="Write in plain text or Markdown… Use '- [ ] ' for interactive tasks."
                aria-label="Scratchpad note editor"
              />
            </div>
          )}

          {mode !== 'write' && (
            <div
              ref={previewPaneRef}
              className="sp-preview-pane"
              onMouseUp={() => window.requestAnimationFrame(evaluatePreviewSelection)}
              onKeyUp={() => window.requestAnimationFrame(evaluatePreviewSelection)}
              onScroll={() => {
                if (selectionMenu?.origin === 'preview') setSelectionMenu(null);
              }}
            >
              <MarkdownPreview
                content={activeNote.content}
                onToggleTask={handleToggleTaskLine}
                onFocusTask={handleFocusTaskLine}
                activeFocusLineIndex={
                  focus.status !== 'idle' &&
                  focus.linkedTask?.noteId === activeNote.id
                    ? focus.linkedTask.lineIndex
                    : null
                }
                activeFocusClock={
                  focus.status === 'running' || focus.status === 'paused'
                    ? formatFocusClock(focus.remainingSeconds)
                    : focus.status === 'completed'
                      ? 'Done'
                      : null
                }
              />
            </div>
          )}
        </div>

        {/* Quiet Tabular Footer */}
        <footer className="sp-footer">
          <div className="sp-footer-stats">
            {stats.tasksTotal > 0 && (
              <>
                <span>
                  {stats.tasksCompleted}/{stats.tasksTotal} tasks done
                </span>
                <span aria-hidden="true">·</span>
              </>
            )}
            <span>{stats.words} words</span>
            <span aria-hidden="true">·</span>
            <span>{stats.chars} chars</span>
          </div>
          <span className="saved-indicator">Saved locally</span>
        </footer>
      </section>
    </div>
  );
}
