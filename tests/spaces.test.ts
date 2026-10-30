import { beforeEach, describe, expect, it } from 'vitest';
import { APP_REGISTRY } from '../src/apps/registry';
import {
  createDefaultSpacesState,
  createSpaceFromCurrentDesktop,
  describeSpaceSummary,
  isWidgetVisibleInSpace,
  materializeSpaceWindows,
  MAX_SPACES,
  moveWindowToSpace,
  parseAudioRuleValue,
  readSpacesState,
  sanitizeSpacesState,
  saveSpacesState,
  serializeAudioRuleValue,
  setSpaceWidgetVisibility,
  syncLiveDesktopIntoActiveSpace,
} from '../src/data/spaces';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';
import { buildSpotlightResults } from '../src/spotlight/spotlight-engine';
import type { WidgetDefinition } from '../src/widgets/types';
import { computeSnapBounds } from '../src/window-manager/window-store';

const VALID_APP_IDS = new Set<string>(APP_REGISTRY.map((a) => a.id));

const SAMPLE_WIDGET: WidgetDefinition = {
  version: 1,
  id: 'widget-clock-1',
  name: 'Minimal Clock',
  source: {
    html: '<div>12:00</div>',
    css: '',
    js: '',
    json: '{}',
  },
  bounds: { x: 48, y: 48, width: 240, height: 140 },
  visible: true,
  updatedAt: 1000,
};

describe('Desktop Spaces state, materialization & cross-surface integration', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('creates 3 starter spaces with Deep Work active, Research 50/50 split, and Unwind Chillhop audio rule', () => {
    const state = createDefaultSpacesState({
      initialWallpaper: 'aurora',
      viewportWidth: 1440,
      viewportHeight: 900,
      now: 1700000000000,
    });

    expect(state.spaces).toHaveLength(3);
    expect(state.activeSpaceId).toBe('space-deep-work');

    const [deepWork, research, unwind] = state.spaces;
    expect(deepWork.wallpaper).toBe('aurora');
    expect(deepWork.windows).toHaveLength(0);
    expect(deepWork.audioRule).toEqual({ kind: 'keep' });

    expect(research.name).toBe('Research');
    expect(research.wallpaper).toBe('glacier');
    expect(research.windows).toHaveLength(2);
    expect(research.windows[0].appId).toBe('browser');
    expect(research.windows[0].snapZone).toBe('left');
    expect(research.windows[1].appId).toBe('notes');
    expect(research.windows[1].snapZone).toBe('right');

    expect(unwind.name).toBe('Unwind');
    expect(unwind.wallpaper).toBe('dusk');
    expect(unwind.audioRule).toEqual({ kind: 'stream', streamId: '5yx6BWlEVcY' });
    expect(describeSpaceSummary(research, 'Glacier')).toContain('2 windows · Split · Glacier');
  });

  it('syncs live desktop edits into the active space and recomputes 50/50 split bounds on viewport resize', () => {
    const initial = createDefaultSpacesState({ viewportWidth: 1280, viewportHeight: 800 });

    const synced = syncLiveDesktopIntoActiveSpace(initial, {
      wallpaper: 'forest',
      activeWindowId: 'window-5',
      windows: [
        {
          id: 'window-5',
          appId: 'notes',
          title: 'Scratchpad',
          bounds: { x: 120, y: 80, width: 640, height: 480 },
          status: 'normal',
        },
      ],
    });

    const active = synced.spaces.find((s) => s.id === synced.activeSpaceId)!;
    expect(active.wallpaper).toBe('forest');
    expect(active.windows).toHaveLength(1);
    expect(active.windows[0].id).toBe('window-5');

    /* Switch to Research on a wider 1920x1080 screen and verify snap bounds & monotonic nextId */
    const research = synced.spaces.find((s) => s.id === 'space-research')!;
    const materialized = materializeSpaceWindows(research, 6, VALID_APP_IDS, 1920, 1080);

    expect(materialized.windows).toHaveLength(2);
    expect(materialized.windows[0].bounds).toEqual(computeSnapBounds('left', 1920, 1080));
    expect(materialized.windows[1].bounds).toEqual(computeSnapBounds('right', 1920, 1080));
    expect(materialized.nextId).toBeGreaterThan(21);
  });

  it('supports per-space widget visibility overrides without mutating other spaces', () => {
    let state = createDefaultSpacesState();
    const deepWork = state.spaces[0];
    const research = state.spaces[1];

    expect(isWidgetVisibleInSpace(SAMPLE_WIDGET, deepWork)).toBe(true);
    expect(isWidgetVisibleInSpace(SAMPLE_WIDGET, research)).toBe(true);

    state = setSpaceWidgetVisibility(state, deepWork.id, SAMPLE_WIDGET.id, false);
    expect(isWidgetVisibleInSpace(SAMPLE_WIDGET, state.spaces[0])).toBe(false);
    expect(isWidgetVisibleInSpace(SAMPLE_WIDGET, state.spaces[1])).toBe(true);
  });

  it('creates custom spaces up to MAX_SPACES and moves windows cleanly between spaces', () => {
    let state = createDefaultSpacesState({ viewportWidth: 1280, viewportHeight: 800 });

    for (let i = state.spaces.length; i < MAX_SPACES; i++) {
      const created = createSpaceFromCurrentDesktop(state, {
        name: `Custom ${i + 1}`,
        wallpaper: 'ocean',
        windows: [],
        activeWindowId: null,
        widgets: [SAMPLE_WIDGET],
        audioRule: { kind: 'pause' },
      });
      expect(created).not.toBeNull();
      state = created!.state;
    }

    expect(state.spaces).toHaveLength(MAX_SPACES);
    expect(
      createSpaceFromCurrentDesktop(state, {
        name: 'Overflow',
        wallpaper: 'mist',
        windows: [],
        activeWindowId: null,
        widgets: [],
      })
    ).toBeNull();

    /* Move a window from the active space into space-deep-work */
    const activeWinState = {
      windows: [
        {
          id: 'window-99',
          appId: 'notes' as const,
          title: 'Scratchpad',
          bounds: { x: 100, y: 90, width: 620, height: 440 },
          status: 'normal' as const,
        },
      ],
      activeWindowId: 'window-99',
      nextId: 100,
    };

    const moved = moveWindowToSpace(
      state,
      activeWinState,
      'window-99',
      'space-deep-work',
      1280,
      800
    );
    expect(moved).not.toBeNull();
    expect(moved!.windowState.windows).toHaveLength(0);
    const target = moved!.spacesState.spaces.find((s) => s.id === 'space-deep-work')!;
    expect(target.windows.some((w) => w.id === 'window-99')).toBe(true);
  });

  it('round-trips audio rule serialization and localStorage persistence safely', () => {
    const rules = [
      { kind: 'keep' as const },
      { kind: 'pause' as const },
      { kind: 'stream' as const, streamId: '5yx6BWlEVcY' },
      { kind: 'playlist' as const, playlistId: 'pl-focus-1' },
    ];
    for (const r of rules) {
      expect(parseAudioRuleValue(serializeAudioRuleValue(r))).toEqual(r);
    }

    const initial = createDefaultSpacesState();
    saveSpacesState({ ...initial, activeSpaceId: 'space-unwind' });
    const loaded = readSpacesState({ validAppIds: VALID_APP_IDS });
    expect(loaded.activeSpaceId).toBe('space-unwind');
    expect(sanitizeSpacesState({ spaces: [] })).toBeNull();
  });

  it('indexes Desktop Spaces switching, window movement, and typed space creation in Spotlight', () => {
    const spacesState = createDefaultSpacesState();
    const activeWins = [
      {
        id: 'window-1',
        appId: 'notes' as const,
        title: 'Scratchpad',
        bounds: { x: 80, y: 80, width: 640, height: 480 },
        status: 'normal' as const,
      },
    ];

    const switchResults = buildSpotlightResults({
      query: 'Unwind',
      filter: 'all',
      apps: APP_REGISTRY,
      windows: activeWins,
      activeWindowId: 'window-1',
      notes: [],
      theme: 'dark',
      wallpaper: 'mist',
      wallpapers: [{ id: 'mist', name: 'Warm Mist' }, { id: 'dusk', name: 'Velvet Dusk' }],
      arrangeMode: false,
      showSeconds: false,
      showMessages: true,
      restoreSession: false,
      hasPassword: false,
      versionTag: 'v1.6.0',
      spaces: spacesState.spaces,
      activeSpaceId: spacesState.activeSpaceId,
    });

    expect(
      switchResults.items.some(
        (item) =>
          item.command.type === 'switch-space' && item.command.spaceId === 'space-unwind'
      )
    ).toBe(true);
    expect(
      switchResults.items.some(
        (item) =>
          item.command.type === 'move-active-window-to-space' &&
          item.command.spaceId === 'space-unwind'
      )
    ).toBe(true);

    const createResults = buildSpotlightResults({
      query: 'new space Writing Studio',
      filter: 'all',
      apps: APP_REGISTRY,
      windows: [],
      activeWindowId: null,
      notes: [],
      theme: 'dark',
      wallpaper: 'mist',
      wallpapers: [{ id: 'mist', name: 'Warm Mist' }],
      arrangeMode: false,
      showSeconds: false,
      showMessages: true,
      restoreSession: false,
      hasPassword: false,
      versionTag: 'v1.6.0',
      spaces: spacesState.spaces,
      activeSpaceId: spacesState.activeSpaceId,
    });

    expect(
      createResults.items.some(
        (item) =>
          item.command.type === 'create-space' && item.command.name === 'Writing Studio'
      )
    ).toBe(true);
  });

  it('exports, validates, and restores spacesState in Workspace JSON backups', () => {
    const customSpaces = createDefaultSpacesState({ initialWallpaper: 'ember' });
    customSpaces.activeSpaceId = 'space-research';
    customSpaces.spaces[1].name = 'Deep Research';

    const backup = buildWorkspaceBackup({
      preferences: {
        theme: 'dark',
        wallpaper: 'glacier',
        showSeconds: false,
        showMessages: true,
        restoreSession: true,
        menuView: 'grid',
        msgRefreshMins: 5,
      },
      pinnedDesktop: ['notes', 'browser'],
      pinnedDock: ['notes', 'browser', 'settings'],
      desktopPositions: {},
      messages: [],
      shortcuts: [],
      widgets: [SAMPLE_WIDGET],
      spacesState: customSpaces,
    });

    const validated = parseAndValidateWorkspaceBackup(JSON.stringify(backup));
    expect(validated.spacesState).toBeDefined();
    expect(validated.spacesState!.activeSpaceId).toBe('space-research');
    expect(validated.spacesState!.spaces[1].name).toBe('Deep Research');

    localStorage.clear();
    applyWorkspaceBackupToStorage(validated);
    const restored = readSpacesState({ validAppIds: VALID_APP_IDS });
    expect(restored.activeSpaceId).toBe('space-research');
    expect(restored.spaces[1].name).toBe('Deep Research');
  });
});
