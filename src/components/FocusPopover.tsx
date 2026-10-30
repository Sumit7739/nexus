import { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import {
  Check,
  CheckSquare,
  Coffee,
  Pause,
  Play,
  Plus,
  RotateCcw,
  StickyNote,
  Timer,
  X,
} from 'lucide-react';
import {
  clearFocusHistory,
  completeLinkedScratchpadTask,
  computeTodayFocusStats,
  extendFocusSession,
  extractUncheckedTasksFromNotes,
  finishFocusSessionEarly,
  FOCUS_AUDIO_OPTIONS,
  FOCUS_DURATION_PRESETS,
  formatFocusClock,
  getFocusState,
  pauseFocusSession,
  resumeFocusSession,
  setFocusDraftTask,
  startFocusBreak,
  subscribeFocusState,
  updateFocusPreferences,
  type FocusAudioMode,
  type LinkedFocusTask,
} from '../data/focus';
import { formatRelativeNoteTime, readNotesState, type ScratchpadNote } from '../data/notes';

export interface FocusPopoverProps {
  onStartSession: (options: {
    linkedTask: LinkedFocusTask | null;
    intention: string;
    durationMinutes: number;
    audioMode: FocusAudioMode;
  }) => void;
  onResetOrFinishRestoreWindows: () => void;
  onOpenNoteInScratchpad: (noteId: string) => void;
  onCreateChecklistNote: () => void;
  onClose: () => void;
}

export function FocusPopover({
  onStartSession,
  onResetOrFinishRestoreWindows,
  onOpenNoteInScratchpad,
  onCreateChecklistNote,
  onClose,
}: FocusPopoverProps) {
  const focus = useSyncExternalStore(subscribeFocusState, getFocusState);
  const [notes, setNotes] = useState<ScratchpadNote[]>(() => readNotesState().notes);

  const [selectedTask, setSelectedTask] = useState<LinkedFocusTask | null>(
    () => focus.linkedTask
  );
  const [customIntention, setCustomIntention] = useState<string>(() =>
    focus.linkedTask ? '' : focus.intention
  );
  const [customMinutesMode, setCustomMinutesMode] = useState<boolean>(
    () =>
      !FOCUS_DURATION_PRESETS.includes(
        focus.preferences.defaultDurationMinutes as (typeof FOCUS_DURATION_PRESETS)[number]
      )
  );
  const [durationMinutes, setDurationMinutes] = useState<number>(
    () => focus.preferences.defaultDurationMinutes
  );
  const [checkedFeedback, setCheckedFeedback] = useState(false);

  useEffect(() => {
    const syncNotes = () => {
      setNotes(readNotesState().notes);
    };
    window.addEventListener('storage', syncNotes);
    return () => window.removeEventListener('storage', syncNotes);
  }, []);

  const uncheckedTasks = useMemo(
    () => extractUncheckedTasksFromNotes(notes, 30),
    [notes]
  );

  const todayStats = useMemo(
    () => computeTodayFocusStats(focus.completedSessions),
    [focus.completedSessions]
  );

  const latestCompletedRecord = useMemo(
    () =>
      focus.lastCompletedSessionId
        ? focus.completedSessions.find((s) => s.id === focus.lastCompletedSessionId) ?? null
        : null,
    [focus.completedSessions, focus.lastCompletedSessionId]
  );

  const isTaskAlreadyChecked = Boolean(latestCompletedRecord?.taskCheckedOff || checkedFeedback);

  const progressPct =
    focus.durationSeconds > 0
      ? Math.min(
          100,
          Math.max(
            0,
            ((focus.durationSeconds - focus.remainingSeconds) / focus.durationSeconds) * 100
          )
        )
      : 0;

  const handlePickScratchpadTask = (task: LinkedFocusTask) => {
    const isSame =
      selectedTask?.noteId === task.noteId &&
      selectedTask?.lineIndex === task.lineIndex &&
      selectedTask?.text === task.text;
    if (isSame) {
      setSelectedTask(null);
      setFocusDraftTask(null, customIntention);
    } else {
      setSelectedTask(task);
      setCustomIntention('');
      setFocusDraftTask(task);
    }
  };

  const handleLaunchFocus = () => {
    const cleanMins = Math.max(1, Math.min(180, Math.round(durationMinutes) || 25));
    const intention =
      selectedTask?.text || customIntention.trim() || 'Deep work session';
    setCheckedFeedback(false);
    onStartSession({
      linkedTask: selectedTask,
      intention,
      durationMinutes: cleanMins,
      audioMode: focus.preferences.audioMode,
    });
  };

  const handleCompleteAndCheckOff = () => {
    if (focus.status === 'running' || focus.status === 'paused') {
      finishFocusSessionEarly();
      onResetOrFinishRestoreWindows();
    }
    if (focus.linkedTask) {
      const ok = completeLinkedScratchpadTask(focus.linkedTask);
      if (ok) {
        setCheckedFeedback(true);
        setNotes(readNotesState().notes);
      }
    }
  };

  const handleCheckOffCompletedTask = () => {
    if (!focus.linkedTask) return;
    const ok = completeLinkedScratchpadTask(focus.linkedTask);
    if (ok) {
      setCheckedFeedback(true);
      setNotes(readNotesState().notes);
    }
  };

  const handleResetToIdle = () => {
    setCheckedFeedback(false);
    onResetOrFinishRestoreWindows();
  };

  return (
    <>
      <button
        type="button"
        className="launcher-scrim"
        aria-label="Close focus rituals"
        onClick={onClose}
      />
      <section
        className="focus-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Focus Rituals"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="focus-popover-header">
          <div className="focus-popover-brand">
            <Timer size={15} strokeWidth={1.6} />
            <div>
              <strong>Focus Ritual</strong>
              <span>
                {todayStats.sessionsCount > 0
                  ? `${todayStats.sessionsCount} session${todayStats.sessionsCount === 1 ? '' : 's'} · ${todayStats.totalMinutes}m today`
                  : 'Tie deep work blocks to Scratchpad tasks'}
              </span>
            </div>
          </div>
          <button
            type="button"
            className="launcher-close"
            onClick={onClose}
            aria-label="Close focus rituals"
          >
            <X size={14} />
          </button>
        </header>

        {/* ── STATE A: IDLE SETUP ── */}
        {focus.status === 'idle' && (
          <div className="focus-popover-body">
            {/* 1. Intention or Linked Scratchpad Task */}
            <div className="focus-section">
              <div className="focus-section-label">
                <span>Task or intention</span>
                {selectedTask && (
                  <button
                    type="button"
                    className="focus-text-link"
                    onClick={() => {
                      setSelectedTask(null);
                      setFocusDraftTask(null, '');
                    }}
                  >
                    Clear task
                  </button>
                )}
              </div>

              {selectedTask ? (
                <div className="focus-selected-task">
                  <CheckSquare size={14} strokeWidth={1.7} />
                  <div className="focus-selected-copy">
                    <strong>{selectedTask.text}</strong>
                    <span>Scratchpad · {selectedTask.noteTitle}</span>
                  </div>
                  <button
                    type="button"
                    className="icon-btn"
                    title="Open note in Scratchpad"
                    aria-label="Open note in Scratchpad"
                    onClick={() => {
                      onOpenNoteInScratchpad(selectedTask.noteId);
                      onClose();
                    }}
                  >
                    <StickyNote size={13} />
                  </button>
                </div>
              ) : (
                <input
                  type="text"
                  className="focus-intention-input"
                  value={customIntention}
                  onChange={(e) => {
                    setCustomIntention(e.target.value);
                    setFocusDraftTask(null, e.target.value);
                  }}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      handleLaunchFocus();
                    }
                  }}
                  placeholder="Write an intention or pick a Scratchpad task below…"
                  aria-label="Focus intention"
                />
              )}

              {/* Unchecked Tasks from Scratchpad */}
              <div className="focus-tasks-drawer">
                <div className="focus-tasks-head">
                  <span>
                    Unchecked Scratchpad tasks · {uncheckedTasks.length}
                  </span>
                  <button
                    type="button"
                    className="focus-text-link"
                    onClick={() => {
                      onCreateChecklistNote();
                      onClose();
                    }}
                  >
                    New checklist
                  </button>
                </div>

                {uncheckedTasks.length > 0 ? (
                  <div className="focus-task-list" role="listbox" aria-label="Scratchpad tasks">
                    {uncheckedTasks.slice(0, 8).map((task) => {
                      const isPicked =
                        selectedTask?.noteId === task.noteId &&
                        selectedTask?.lineIndex === task.lineIndex &&
                        selectedTask?.text === task.text;
                      return (
                        <button
                          key={task.id}
                          type="button"
                          role="option"
                          aria-selected={isPicked}
                          className={`focus-task-option${isPicked ? ' is-selected' : ''}`}
                          onClick={() => handlePickScratchpadTask(task)}
                        >
                          <span className="focus-task-box" aria-hidden="true">
                            {isPicked && <Check size={10} strokeWidth={2.5} />}
                          </span>
                          <span className="focus-task-copy">
                            <strong>{task.text}</strong>
                            <small>{task.noteTitle}</small>
                          </span>
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  <div className="focus-task-empty">
                    <span>No open `- [ ]` tasks in Scratchpad yet.</span>
                  </div>
                )}
              </div>
            </div>

            {/* 2. Duration & Atmosphere */}
            <div className="focus-controls-grid">
              <div className="focus-field">
                <span>Duration</span>
                <div className="focus-duration-row">
                  {FOCUS_DURATION_PRESETS.map((preset) => {
                    const active = !customMinutesMode && durationMinutes === preset;
                    return (
                      <button
                        key={preset}
                        type="button"
                        className={`focus-dur-btn${active ? ' is-active' : ''}`}
                        onClick={() => {
                          setCustomMinutesMode(false);
                          setDurationMinutes(preset);
                          updateFocusPreferences({ defaultDurationMinutes: preset });
                        }}
                      >
                        {preset}m
                      </button>
                    );
                  })}
                  <button
                    type="button"
                    className={`focus-dur-btn${customMinutesMode ? ' is-active' : ''}`}
                    onClick={() => setCustomMinutesMode(true)}
                  >
                    Custom
                  </button>
                </div>
                {customMinutesMode && (
                  <div className="focus-custom-mins">
                    <input
                      type="number"
                      min={1}
                      max={180}
                      value={durationMinutes}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        if (Number.isFinite(val)) {
                          setDurationMinutes(val);
                        }
                      }}
                      aria-label="Custom focus minutes"
                    />
                    <span>minutes (1–180)</span>
                  </div>
                )}
              </div>

              <label className="focus-field">
                <span>Atmosphere pairing</span>
                <select
                  value={focus.preferences.audioMode}
                  onChange={(e) =>
                    updateFocusPreferences({
                      audioMode: e.target.value as FocusAudioMode,
                    })
                  }
                >
                  {FOCUS_AUDIO_OPTIONS.map((opt) => (
                    <option key={opt.id} value={opt.id}>
                      {opt.label} — {opt.subtitle}
                    </option>
                  ))}
                </select>
              </label>
            </div>

            {/* 3. Declutter Toggle */}
            <div className="focus-toggle-row">
              <div>
                <strong>Declutter background windows</strong>
                <span>Minimize non-Scratchpad apps during focus and restore on finish</span>
              </div>
              <button
                type="button"
                role="switch"
                aria-checked={focus.preferences.declutterWindows}
                className={`settings-switch${focus.preferences.declutterWindows ? ' is-on' : ''}`}
                onClick={() =>
                  updateFocusPreferences({
                    declutterWindows: !focus.preferences.declutterWindows,
                  })
                }
              >
                <span />
              </button>
            </div>

            <button
              type="button"
              className="primary-btn focus-start-cta"
              onClick={handleLaunchFocus}
            >
              <Play size={13} />
              <span>
                Start {Math.max(1, Math.min(180, Math.round(durationMinutes) || 25))}m focus
                {selectedTask ? ' on task' : ''}
              </span>
            </button>
          </div>
        )}

        {/* ── STATE B: RUNNING OR PAUSED SESSION ── */}
        {(focus.status === 'running' || focus.status === 'paused') && (
          <div className="focus-popover-body is-live">
            <div className="focus-live-readout">
              <div className="focus-live-phase">
                <span
                  className={`focus-live-dot${focus.status === 'paused' ? ' is-paused' : ''}`}
                />
                <span>
                  {focus.phase === 'break'
                    ? 'Restorative break'
                    : focus.status === 'paused'
                      ? 'Paused focus block'
                      : 'In focus'}
                </span>
              </div>
              <div className="focus-live-clock" aria-live="off">
                {formatFocusClock(focus.remainingSeconds)}
              </div>
              <div className="focus-progress-track" aria-hidden="true">
                <div
                  className="focus-progress-fill"
                  style={{ width: `${progressPct}%` }}
                />
              </div>
            </div>

            <div className="focus-live-task-box">
              <div className="focus-live-task-copy">
                <strong>{focus.intention || 'Deep work session'}</strong>
                <span>
                  {focus.linkedTask
                    ? `Scratchpad · ${focus.linkedTask.noteTitle}`
                    : `${Math.round(focus.durationSeconds / 60)}m focus block`}
                </span>
              </div>
              {focus.linkedTask && (
                <button
                  type="button"
                  className="secondary-btn focus-open-note-btn"
                  onClick={() => {
                    onOpenNoteInScratchpad(focus.linkedTask!.noteId);
                    onClose();
                  }}
                >
                  <StickyNote size={12} />
                  <span>Open note</span>
                </button>
              )}
            </div>

            <div className="focus-live-actions">
              <button
                type="button"
                className="primary-btn"
                onClick={() =>
                  focus.status === 'running' ? pauseFocusSession() : resumeFocusSession()
                }
              >
                {focus.status === 'running' ? <Pause size={13} /> : <Play size={13} />}
                <span>{focus.status === 'running' ? 'Pause' : 'Resume'}</span>
              </button>

              <button
                type="button"
                className="secondary-btn"
                onClick={() => extendFocusSession(5)}
                title="Extend timer by 5 minutes"
              >
                <Plus size={12} />
                <span>5m</span>
              </button>

              {focus.phase === 'focus' && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={handleCompleteAndCheckOff}
                >
                  <Check size={13} />
                  <span>
                    {focus.linkedTask ? 'Check off & finish' : 'Finish block'}
                  </span>
                </button>
              )}

              <button
                type="button"
                className="icon-btn"
                onClick={handleResetToIdle}
                title="End session"
                aria-label="End session"
              >
                <RotateCcw size={13} />
              </button>
            </div>
          </div>
        )}

        {/* ── STATE C: COMPLETED SESSION ── */}
        {focus.status === 'completed' && (
          <div className="focus-popover-body is-completed">
            <div className="focus-complete-hero">
              <span className="focus-complete-mark">
                <Check size={18} strokeWidth={2.2} />
              </span>
              <h3>
                {focus.phase === 'break' ? 'Break complete' : 'Focus block complete'}
              </h3>
              <p>
                {focus.phase === 'break'
                  ? 'Ready whenever you want to begin your next block.'
                  : `${focus.intention} · ${Math.max(1, Math.round(focus.durationSeconds / 60))}m logged`}
              </p>
            </div>

            {focus.phase === 'focus' && focus.linkedTask && (
              <div className="focus-complete-task-card">
                <div className="focus-selected-copy">
                  <strong>{focus.linkedTask.text}</strong>
                  <span>Scratchpad · {focus.linkedTask.noteTitle}</span>
                </div>
                {isTaskAlreadyChecked ? (
                  <span className="focus-checked-confirm">
                    <Check size={12} /> Checked off in Scratchpad
                  </span>
                ) : (
                  <button
                    type="button"
                    className="primary-btn"
                    onClick={handleCheckOffCompletedTask}
                  >
                    <CheckSquare size={13} />
                    <span>Check off task</span>
                  </button>
                )}
              </div>
            )}

            <div className="focus-complete-actions">
              {focus.phase === 'focus' && (
                <button
                  type="button"
                  className="secondary-btn"
                  onClick={() => startFocusBreak(focus.preferences.breakDurationMinutes)}
                >
                  <Coffee size={13} />
                  <span>Start {focus.preferences.breakDurationMinutes}m break</span>
                </button>
              )}
              <button
                type="button"
                className="secondary-btn"
                onClick={handleResetToIdle}
              >
                <span>New focus block</span>
              </button>
            </div>
          </div>
        )}

        {/* ── RECENT COMPLETED LOG FOOTER ── */}
        {focus.completedSessions.length > 0 && (
          <footer className="focus-popover-footer">
            <div className="focus-log-head">
              <span>Recent focus log</span>
              <button
                type="button"
                className="focus-text-link"
                onClick={() => clearFocusHistory()}
              >
                Clear
              </button>
            </div>
            <div className="focus-log-list">
              {focus.completedSessions.slice(0, 3).map((rec) => (
                <div key={rec.id} className="focus-log-row">
                  <span className="focus-log-title">
                    {rec.taskCheckedOff ? '✓ ' : ''}
                    {rec.intention}
                  </span>
                  <span className="focus-log-meta">
                    {rec.durationMinutes}m · {formatRelativeNoteTime(rec.completedAt)}
                  </span>
                </div>
              ))}
            </div>
          </footer>
        )}
      </section>
    </>
  );
}
