import {
  useCallback,
  useRef,
  useState,
  useSyncExternalStore,
} from 'react';
import {
  Bookmark,
  Check,
  Clipboard,
  Code,
  Compass,
  Copy,
  ExternalLink,
  FileText,
  Headphones,
  Palette,
  Play,
  Plus,
  Sparkles,
  StickyNote,
  Trash2,
  X,
  Zap,
} from 'lucide-react';
import {
  clearStashItems,
  closeStashShelf,
  convertStashToMusicQueueItem,
  convertStashToNote,
  convertStashToSavedLink,
  getStashState,
  removeStashItem,
  setStashFilter,
  stashItem,
  openStashShelf,
  subscribeStashState,
  type StashCardKind,
  type StashItem,
} from '../data/stash';
import { enqueueTrackNext } from '../data/media';
import { requestOpenApp } from '../data/context-actions';

export interface StashEdgeShelfProps {
  onOpenApp?: (appId: string) => void;
  onOpenExternalUrl?: (url: string) => void;
}

export function StashEdgeShelf({ onOpenApp, onOpenExternalUrl }: StashEdgeShelfProps) {
  const shelfRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLTextAreaElement | null>(null);

  const state = useSyncExternalStore(subscribeStashState, getStashState, getStashState);
  const [quickInput, setQuickInput] = useState('');
  const [isDragOver, setIsDragOver] = useState(false);
  const [feedbackNotice, setFeedbackNotice] = useState<string | null>(null);

  const showNotice = useCallback((msg: string) => {
    setFeedbackNotice(msg);
    setTimeout(() => {
      setFeedbackNotice((curr) => (curr === msg ? null : curr));
    }, 2400);
  }, []);

  // Quick Stash submit
  const handleQuickSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!quickInput.trim()) return;
    const item = stashItem({
      content: quickInput.trim(),
      source: { title: 'Quick Input' },
      openShelf: true,
    });
    if (item) {
      setQuickInput('');
      showNotice(`Stashed ${item.kind} card`);
    }
  };

  // Drag and drop handler onto the screen edge or shelf
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'copy';
    if (!isDragOver) setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    // Only clear if dragging completely out
    if (e.currentTarget.contains(e.relatedTarget as Node)) return;
    setIsDragOver(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragOver(false);

    // Try text/uri-list then text/plain
    const uri = e.dataTransfer.getData('text/uri-list');
    const text = e.dataTransfer.getData('text/plain');
    const content = (uri || text || '').trim();

    if (content) {
      const item = stashItem({
        content,
        source: { title: 'Desktop Drop Zone' },
        openShelf: true,
      });
      if (item) {
        showNotice(`Dropped & stashed ${item.kind} item`);
      }
    }
  };

  const handleCopy = (item: StashItem) => {
    if (navigator?.clipboard?.writeText) {
      navigator.clipboard.writeText(item.content).catch(() => {});
    }
    showNotice('Copied to clipboard');
  };

  const handleConvertToNote = (item: StashItem) => {
    convertStashToNote(item, 'new-note');
    if (onOpenApp) {
      onOpenApp('notes');
    } else {
      requestOpenApp('notes', { preferExisting: true });
    }
    showNotice('Created Scratchpad note');
  };

  const handleConvertToLink = (item: StashItem) => {
    const res = convertStashToSavedLink(item);
    if (res) {
      showNotice(`Saved shortcut "${res.title}"`);
    }
  };

  const handleConvertToMusicQueue = (item: StashItem) => {
    const track = convertStashToMusicQueueItem(item);
    if (track) {
      enqueueTrackNext(track);
      if (onOpenApp) {
        onOpenApp('music');
      } else {
        requestOpenApp('music', { preferExisting: true });
      }
      showNotice(`Queued "${track.title}" in Music`);
    }
  };

  const filteredItems = state.filter === 'all'
    ? state.items
    : state.items.filter((i) => i.kind === state.filter);

  return (
    <>
      {/* Edge Hover Strip / Drop Zone (always mounted at screen edge) */}
      <div
        className={`stash-edge-trigger ${state.isOpen ? 'is-open' : ''} ${
          isDragOver ? 'is-drag-over' : ''
        }`}
        onClick={(event) => event.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
        aria-label="Stash Edge Shelf"
      >
        <button
          type="button"
          className="stash-tab-pill"
          onClick={() => {
            if (state.isOpen) closeStashShelf();
            else openStashShelf();
          }}
          title={state.isOpen ? 'Close Stash shelf (Alt+S)' : 'Open Stash shelf (Alt+S)'}
          aria-expanded={state.isOpen}
        >
          <Zap size={14} className="stash-tab-icon" />
          <span className="stash-tab-count">{state.items.length}</span>
        </button>
      </div>

      {/* Slide-out Shelf Container */}
      <div
        ref={shelfRef}
        className={`stash-shelf ${state.isOpen ? 'is-open' : ''} ${
          isDragOver ? 'is-drag-over' : ''
        }`}
        role="region"
        aria-label="Stash Edge Shelf"
        onClick={(event) => event.stopPropagation()}
        onDragOver={handleDragOver}
        onDragLeave={handleDragLeave}
        onDrop={handleDrop}
      >
        {/* Header */}
        <div className="stash-shelf-header">
          <div className="stash-brand">
            <span className="stash-brand-icon">
              <Zap size={16} strokeWidth={2} />
            </span>
            <div className="stash-brand-text">
              <div className="stash-title-row">
                <span className="stash-title">Stash</span>
                <span className="stash-badge">{state.items.length}</span>
              </div>
              <span className="stash-subtitle">Universal Drop Zone & Snippet Tray</span>
            </div>
          </div>
          <div className="stash-header-actions">
            {state.items.length > 0 && (
              <button
                type="button"
                className="stash-hdr-btn"
                onClick={clearStashItems}
                title="Clear all stashed cards"
              >
                <Trash2 size={13} />
              </button>
            )}
            <button
              type="button"
              className="stash-hdr-btn close-btn"
              onClick={closeStashShelf}
              title="Close Stash Shelf (Esc or Alt+S)"
            >
              <X size={15} />
            </button>
          </div>
        </div>

        {/* Quick Drop / Paste Input */}
        <form className="stash-input-box" onSubmit={handleQuickSubmit}>
          <textarea
            ref={inputRef}
            className="stash-input-area"
            value={quickInput}
            onChange={(e) => setQuickInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) {
                e.preventDefault();
                handleQuickSubmit(e);
              }
            }}
            placeholder="Drop anything here, paste text, URLs, colors, or code..."
            rows={2}
          />
          <div className="stash-input-footer">
            <span className="stash-hint">Drag & drop or Ctrl+Enter</span>
            <button
              type="submit"
              className="stash-submit-btn"
              disabled={!quickInput.trim()}
              title="Add to Stash"
            >
              <Plus size={13} />
              <span>Stash</span>
            </button>
          </div>
        </form>

        {/* Filters */}
        <div className="stash-filters" role="tablist">
          {(
            [
              { id: 'all', label: 'All', count: state.items.length },
              {
                id: 'url',
                label: 'Links',
                count: state.items.filter((i) => i.kind === 'url').length,
              },
              {
                id: 'code',
                label: 'Code',
                count: state.items.filter((i) => i.kind === 'code').length,
              },
              {
                id: 'color',
                label: 'Colors',
                count: state.items.filter((i) => i.kind === 'color').length,
              },
              {
                id: 'youtube',
                label: 'Videos',
                count: state.items.filter((i) => i.kind === 'youtube').length,
              },
              {
                id: 'calculation',
                label: 'Math',
                count: state.items.filter((i) => i.kind === 'calculation').length,
              },
            ] as const
          ).map((tab) => (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={state.filter === tab.id}
              className={`stash-filter-pill ${state.filter === tab.id ? 'is-active' : ''}`}
              onClick={() => setStashFilter(tab.id as 'all' | StashCardKind)}
            >
              <span>{tab.label}</span>
              {tab.count > 0 && <span className="pill-count">{tab.count}</span>}
            </button>
          ))}
        </div>

        {/* Drop indicator overlay */}
        {isDragOver && (
          <div className="stash-drop-overlay">
            <Zap size={28} />
            <span>Drop anywhere to stash item</span>
          </div>
        )}

        {/* Card List */}
        <div className="stash-cards-scroll">
          {filteredItems.length === 0 ? (
            <div className="stash-empty-state">
              <div className="stash-empty-glyph">
                <Clipboard size={24} />
              </div>
              <p className="stash-empty-title">
                {state.filter === 'all'
                  ? 'Your Stash shelf is clean'
                  : `No ${state.filter} cards stashed yet`}
              </p>
              <p className="stash-empty-desc">
                Drag text from Browser, code blocks from Scratchpad, copy color hex codes, or drop links here.
              </p>
            </div>
          ) : (
            <div className="stash-cards-grid">
              {filteredItems.map((item) => {
                const isUrl = item.kind === 'url';
                const isYoutube = item.kind === 'youtube';
                const isColor = item.kind === 'color';
                const isCode = item.kind === 'code';
                const isCalc = item.kind === 'calculation';

                return (
                  <div
                    key={item.id}
                    className={`stash-card kind-${item.kind}`}
                    draggable
                    onDragStart={(e) => {
                      e.dataTransfer.setData('text/plain', item.content);
                    }}
                  >
                    <div className="stash-card-top">
                      <div className="stash-card-kind-badge">
                        {isColor && (
                          <span
                            className="color-dot"
                            style={{ backgroundColor: item.content }}
                          />
                        )}
                        {isColor && <Palette size={11} />}
                        {isCode && <Code size={11} />}
                        {isUrl && <Compass size={11} />}
                        {isYoutube && <Play size={11} />}
                        {isCalc && <Sparkles size={11} />}
                        {!isColor && !isCode && !isUrl && !isYoutube && !isCalc && (
                          <FileText size={11} />
                        )}
                        <span>{item.kind}</span>
                      </div>
                      <div className="stash-card-top-actions">
                        <button
                          type="button"
                          className="card-mini-btn"
                          title="Copy to clipboard"
                          onClick={() => handleCopy(item)}
                        >
                          <Copy size={11} />
                        </button>
                        <button
                          type="button"
                          className="card-mini-btn remove"
                          title="Remove from Stash"
                          onClick={() => removeStashItem(item.id)}
                        >
                          <X size={11} />
                        </button>
                      </div>
                    </div>

                    {/* Card Content Display */}
                    <div className="stash-card-body">
                      {isColor ? (
                        <div className="stash-color-preview">
                          <div
                            className="color-block"
                            style={{ backgroundColor: item.content }}
                          />
                          <div className="color-info">
                            <strong className="color-val">{item.content}</strong>
                            <span className="color-hint">Color swatch</span>
                          </div>
                        </div>
                      ) : isCode ? (
                        <pre className="stash-code-preview">
                          <code>{item.content}</code>
                        </pre>
                      ) : isUrl ? (
                        <div className="stash-url-preview">
                          <strong className="url-title">{item.title || item.content}</strong>
                          <span className="url-link">{item.content}</span>
                        </div>
                      ) : isYoutube ? (
                        <div className="stash-yt-preview">
                          <strong className="yt-title">{item.title || 'YouTube Video'}</strong>
                          <span className="yt-url">{item.content}</span>
                        </div>
                      ) : (
                        <p className="stash-text-preview">{item.content}</p>
                      )}
                    </div>

                    {/* Quick Conversion Footer Actions */}
                    <div className="stash-card-actions">
                      <button
                        type="button"
                        className="stash-act-btn"
                        title="Create new note in Scratchpad"
                        onClick={() => handleConvertToNote(item)}
                      >
                        <StickyNote size={11} />
                        <span>Note</span>
                      </button>

                      {isUrl && (
                        <button
                          type="button"
                          className="stash-act-btn"
                          title="Save as desktop shortcut link"
                          onClick={() => handleConvertToLink(item)}
                        >
                          <Bookmark size={11} />
                          <span>Save Link</span>
                        </button>
                      )}

                      {isYoutube && (
                        <button
                          type="button"
                          className="stash-act-btn"
                          title="Queue track in Music"
                          onClick={() => handleConvertToMusicQueue(item)}
                        >
                          <Headphones size={11} />
                          <span>Queue</span>
                        </button>
                      )}

                      {isUrl && (
                        <button
                          type="button"
                          className="stash-act-btn"
                          title="Open URL in Browser"
                          onClick={() => {
                            if (onOpenExternalUrl) onOpenExternalUrl(item.content);
                            else window.open(item.content, '_blank', 'noopener,noreferrer');
                          }}
                        >
                          <ExternalLink size={11} />
                          <span>Open</span>
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Toast notice inside Stash */}
        {feedbackNotice && (
          <div className="stash-toast" role="status">
            <Check size={12} />
            <span>{feedbackNotice}</span>
          </div>
        )}
      </div>
    </>
  );
}
