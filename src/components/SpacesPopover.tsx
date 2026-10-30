import { useState, useSyncExternalStore } from 'react';
import {
  Check,
  Copy,
  Headphones,
  Layers,
  Plus,
  SlidersHorizontal,
  Trash2,
  X,
} from 'lucide-react';
import { getMusicState, STARTER_MUSIC_STREAMS, subscribeMusicState } from '../data/media';
import {
  describeSpaceSummary,
  isWidgetVisibleInSpace,
  MAX_SPACES,
  parseAudioRuleValue,
  serializeAudioRuleValue,
  type DesktopSpace,
  type SpaceAudioRule,
  type SpaceWallpaperId,
} from '../data/spaces';
import type { WidgetDefinition } from '../widgets/types';

export interface SpacesPopoverProps {
  spaces: DesktopSpace[];
  activeSpaceId: string;
  wallpapers: readonly { id: SpaceWallpaperId; name: string }[];
  widgets: WidgetDefinition[];
  onSwitchSpace: (spaceId: string) => void;
  onCreateSpace: () => void;
  onUpdateSpace: (
    spaceId: string,
    patch: Partial<Pick<DesktopSpace, 'name' | 'description' | 'wallpaper' | 'audioRule'>>
  ) => void;
  onCaptureCurrentIntoSpace: (spaceId: string) => void;
  onToggleWidgetInSpace: (spaceId: string, widgetId: string, visible: boolean) => void;
  onDeleteSpace: (spaceId: string) => void;
  onOpenSpacesSettings: () => void;
  onClose: () => void;
}

export function SpacesPopover({
  spaces,
  activeSpaceId,
  wallpapers,
  widgets,
  onSwitchSpace,
  onCreateSpace,
  onUpdateSpace,
  onCaptureCurrentIntoSpace,
  onToggleWidgetInSpace,
  onDeleteSpace,
  onOpenSpacesSettings,
  onClose,
}: SpacesPopoverProps) {
  const music = useSyncExternalStore(subscribeMusicState, getMusicState);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const canCreate = spaces.length < MAX_SPACES;

  return (
    <>
      <button
        type="button"
        className="launcher-scrim"
        aria-label="Close spaces switcher"
        onClick={onClose}
      />
      <section
        className="spaces-popover"
        role="dialog"
        aria-modal="true"
        aria-label="Desktop Spaces"
        onClick={(e) => e.stopPropagation()}
      >
        <header className="spaces-popover-header">
          <div className="spaces-popover-brand">
            <Layers size={15} strokeWidth={1.6} />
            <div>
              <strong>Desktop Spaces</strong>
              <span>Switch contexts · Alt + 1–{spaces.length}</span>
            </div>
          </div>
          <div className="spaces-popover-head-actions">
            <button
              type="button"
              className="secondary-btn spaces-new-btn"
              onClick={onCreateSpace}
              disabled={!canCreate}
              title={
                canCreate
                  ? 'Save current windows & wallpaper as a new Space'
                  : `Maximum of ${MAX_SPACES} spaces reached`
              }
            >
              <Plus size={12} /> New space
            </button>
            <button
              type="button"
              className="launcher-close"
              onClick={onClose}
              aria-label="Close spaces switcher"
            >
              <X size={14} />
            </button>
          </div>
        </header>

        <div className="spaces-popover-list" role="list">
          {spaces.map((space, idx) => {
            const isActive = space.id === activeSpaceId;
            const isEditing = editingId === space.id;
            const wpName = wallpapers.find((w) => w.id === space.wallpaper)?.name ?? space.wallpaper;
            const summary = describeSpaceSummary(space, wpName, music.playlists);

            return (
              <div
                key={space.id}
                role="listitem"
                className={`space-card ${isActive ? 'is-active' : ''} ${isEditing ? 'is-expanded' : ''}`}
              >
                <div className="space-card-main">
                  <button
                    type="button"
                    className="space-card-select"
                    onClick={() => {
                      onSwitchSpace(space.id);
                      if (!isEditing) onClose();
                    }}
                  >
                    <span className={`space-index-tile swatch-${space.wallpaper}`}>
                      <span>{idx + 1}</span>
                    </span>
                    <span className="space-card-copy">
                      <span className="space-card-title-row">
                        <strong>{space.name}</strong>
                        {isActive && <span className="space-active-label">Current</span>}
                      </span>
                      <span className="space-card-meta">{summary}</span>
                    </span>
                  </button>

                  <div className="space-card-actions">
                    <kbd className="space-kbd" aria-hidden="true">
                      Alt+{idx + 1}
                    </kbd>
                    <button
                      type="button"
                      className={`icon-btn space-config-btn ${isEditing ? 'is-pinned' : ''}`}
                      onClick={() => {
                        setEditingId((prev) => (prev === space.id ? null : space.id));
                        setConfirmDeleteId(null);
                      }}
                      aria-label={`Configure ${space.name}`}
                      aria-expanded={isEditing}
                      title="Configure space wallpaper, audio & widgets"
                    >
                      <SlidersHorizontal size={13} />
                    </button>
                  </div>
                </div>

                {isEditing && (
                  <div className="space-editor-drawer">
                    <div className="space-editor-grid">
                      <label className="space-field">
                        <span>Space name</span>
                        <input
                          type="text"
                          value={space.name}
                          maxLength={40}
                          onChange={(e) => onUpdateSpace(space.id, { name: e.target.value })}
                          placeholder="e.g. Deep Work"
                        />
                      </label>

                      <label className="space-field">
                        <span>
                          <Headphones size={11} /> Linked audio on switch
                        </span>
                        <select
                          value={serializeAudioRuleValue(space.audioRule)}
                          onChange={(e) => {
                            const nextRule: SpaceAudioRule = parseAudioRuleValue(e.target.value);
                            onUpdateSpace(space.id, { audioRule: nextRule });
                          }}
                          aria-label={`Audio rule for ${space.name}`}
                        >
                          <option value="keep">Keep current audio</option>
                          <option value="pause">Pause desktop music</option>
                          <optgroup label="24/7 Focus Streams">
                            {STARTER_MUSIC_STREAMS.map((stream) => (
                              <option key={stream.id} value={`stream:${stream.id}`}>
                                {stream.title}
                              </option>
                            ))}
                          </optgroup>
                          {music.playlists.length > 0 && (
                            <optgroup label="Your Playlists">
                              {music.playlists.map((pl) => (
                                <option key={pl.id} value={`playlist:${pl.id}`}>
                                  {pl.name} ({pl.tracks.length})
                                </option>
                              ))}
                            </optgroup>
                          )}
                        </select>
                      </label>
                    </div>

                    <div className="space-field">
                      <span>Wallpaper · {wpName}</span>
                      <div className="space-swatches" role="group" aria-label={`Wallpaper for ${space.name}`}>
                        {wallpapers.map((wp) => (
                          <button
                            key={wp.id}
                            type="button"
                            className={space.wallpaper === wp.id ? 'is-current' : ''}
                            title={wp.name}
                            aria-label={wp.name}
                            onClick={() => onUpdateSpace(space.id, { wallpaper: wp.id })}
                          >
                            <span className={`wallpaper-swatch swatch-${wp.id}`} />
                          </button>
                        ))}
                      </div>
                    </div>

                    {widgets.length > 0 && (
                      <div className="space-field">
                        <span>Visible widgets in {space.name}</span>
                        <div className="space-widget-toggles">
                          {widgets.map((w) => {
                            const vis = isWidgetVisibleInSpace(w, space);
                            return (
                              <button
                                key={w.id}
                                type="button"
                                className={`space-widget-toggle ${vis ? 'is-on' : ''}`}
                                onClick={() => onToggleWidgetInSpace(space.id, w.id, !vis)}
                                aria-pressed={vis}
                              >
                                {vis ? <Check size={11} /> : null}
                                <span>{w.name}</span>
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    )}

                    <div className="space-editor-foot">
                      {!isActive ? (
                        <button
                          type="button"
                          className="secondary-btn"
                          onClick={() => onCaptureCurrentIntoSpace(space.id)}
                          title="Overwrite this space's windows with your currently open windows"
                        >
                          <Copy size={11} /> Save current windows here
                        </button>
                      ) : (
                        <span className="space-autosync-note">
                          Live window &amp; split changes sync automatically
                        </span>
                      )}

                      {spaces.length > 1 && (
                        <button
                          type="button"
                          className="settings-action danger"
                          onClick={() => {
                            if (confirmDeleteId === space.id) {
                              onDeleteSpace(space.id);
                              setConfirmDeleteId(null);
                              setEditingId(null);
                            } else {
                              setConfirmDeleteId(space.id);
                            }
                          }}
                        >
                          <Trash2 size={11} />
                          {confirmDeleteId === space.id ? 'Confirm delete?' : 'Delete'}
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
            );
          })}
        </div>

        <footer className="spaces-popover-footer">
          <span>Each Space saves its own windows, splits, wallpaper, widgets &amp; audio</span>
          <button
            type="button"
            className="spaces-manage-link"
            onClick={() => {
              onClose();
              onOpenSpacesSettings();
            }}
          >
            Manage in Settings
          </button>
        </footer>
      </section>
    </>
  );
}
