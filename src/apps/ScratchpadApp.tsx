import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type KeyboardEvent as ReactKeyboardEvent,
  type ReactNode,
} from 'react';
import {
  Bold,
  Check,
  CheckSquare,
  Code,
  Copy,
  Download,
  Heading2,
  Italic,
  Minus,
  PanelLeft,
  Pin,
  Plus,
  Quote,
  Search,
  StickyNote,
  Trash2,
  X,
} from 'lucide-react';
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

function MarkdownPreview({
  content,
  onToggleTask,
}: {
  content: string;
  onToggleTask: (lineIndex: number) => void;
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
                {block.items.map((item) => (
                  <li
                    key={`task-${item.lineIndex}`}
                    className={`sp-md-task-row${item.checked ? ' is-done' : ''}${
                      item.indent > 0 ? ` indent-${item.indent}` : ''
                    }`}
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
                  </li>
                ))}
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
  const [state, setState] = useState<NotesState>(readNotesState);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [mode, setMode] = useState<EditorMode>('write');
  const [searchQuery, setSearchQuery] = useState('');
  const [filter, setFilter] = useState<NoteFilter>('all');
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [copiedNote, setCopiedNote] = useState(false);

  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const titleInputRef = useRef<HTMLInputElement | null>(null);

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

  const handleToggleTaskLine = (lineIndex: number) => {
    const nextContent = toggleChecklistLine(activeNote.content, lineIndex);
    if (nextContent !== activeNote.content) {
      updateActiveNote({ content: nextContent });
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
    const val = activeNote.content;
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

        {/* Editor / Split / Preview Stage */}
        <div className={`sp-stage mode-${mode}`}>
          {mode !== 'preview' && (
            <div className="sp-editor-pane">
              <textarea
                ref={textareaRef}
                value={activeNote.content}
                onChange={(e) => updateActiveNote({ content: e.target.value })}
                onKeyDown={handleEditorKeyDown}
                placeholder="Write in plain text or Markdown… Use '- [ ] ' for interactive tasks."
                aria-label="Scratchpad note editor"
              />
            </div>
          )}

          {mode !== 'write' && (
            <div className="sp-preview-pane">
              <MarkdownPreview
                content={activeNote.content}
                onToggleTask={handleToggleTaskLine}
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
