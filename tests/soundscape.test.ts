import { beforeEach, describe, expect, it } from 'vitest';
import { APP_REGISTRY } from '../src/apps/registry';
import {
  dispatchWidgetMusicCommand,
  getWidgetMusicSnapshot,
} from '../src/data/media';
import {
  applySoundscapePreset,
  clearSoundscapeLevels,
  deleteCustomSoundscapeMix,
  describeActiveSoundscape,
  getActiveSoundscapeLayersCount,
  getSoundscapeState,
  isSoundscapeAudiblyPlaying,
  readSoundscapePersistedState,
  reloadSoundscapeFromStorage,
  saveCustomSoundscapeMix,
  setSoundscapeLayerLevel,
  setSoundscapeMasterVolume,
  setSoundscapePlaying,
  toggleSoundscapeLayer,
} from '../src/data/soundscape';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';
import { buildSpotlightResults } from '../src/spotlight/spotlight-engine';

describe('Procedural Soundscape Mixer state, presets, Widget API & backup parity', () => {
  beforeEach(() => {
    localStorage.clear();
    clearSoundscapeLevels();
    setSoundscapeMasterVolume(75);
    reloadSoundscapeFromStorage();
  });

  it('auto-activates when raising a channel fader and pauses when all faders return to zero', () => {
    expect(getSoundscapeState().isPlaying).toBe(false);
    expect(getActiveSoundscapeLayersCount()).toBe(0);

    setSoundscapeLayerLevel('rain', 60);
    setSoundscapeLayerLevel('vinyl', 30);

    expect(getSoundscapeState().isPlaying).toBe(true);
    expect(isSoundscapeAudiblyPlaying()).toBe(true);
    expect(getActiveSoundscapeLayersCount()).toBe(2);
    expect(describeActiveSoundscape()).toBe('Soft Rain · Vinyl Dust');

    /* Zeroing both faders automatically pauses playback */
    setSoundscapeLayerLevel('rain', 0);
    setSoundscapeLayerLevel('vinyl', 0);
    expect(getActiveSoundscapeLayersCount()).toBe(0);
    expect(getSoundscapeState().isPlaying).toBe(false);
  });

  it('toggles individual channels and loads Rainy Study automatically if Play is pressed from silence', () => {
    setSoundscapePlaying(true);
    const afterPlay = getSoundscapeState();
    expect(afterPlay.isPlaying).toBe(true);
    expect(afterPlay.activePresetId).toBe('preset-rainy-study');
    expect(afterPlay.levels.rain).toBeGreaterThan(0);

    clearSoundscapeLevels();
    toggleSoundscapeLayer('hearth');
    expect(getSoundscapeState().levels.hearth).toBe(50);
    toggleSoundscapeLayer('hearth');
    expect(getSoundscapeState().levels.hearth).toBe(0);
  });

  it('applies built-in presets and creates/deletes persisted custom mixes', () => {
    expect(applySoundscapePreset('Cabin Hearth')).toBe(true);
    expect(getSoundscapeState().levels.hearth).toBe(58);
    expect(getSoundscapeState().levels.wind).toBe(28);

    setSoundscapeLayerLevel('night', 42);
    const saved = saveCustomSoundscapeMix('Late Coding');
    expect(saved).not.toBeNull();
    expect(getSoundscapeState().customPresets.some(p => p.name === 'Late Coding')).toBe(true);

    const persisted = readSoundscapePersistedState();
    expect(persisted.customPresets).toHaveLength(1);
    expect(persisted.customPresets[0].name).toBe('Late Coding');

    deleteCustomSoundscapeMix(saved!.id);
    expect(getSoundscapeState().customPresets).toHaveLength(0);
  });

  it('exposes live soundscape telemetry and controls through window.NEXUS.music widget bridge', () => {
    expect(
      dispatchWidgetMusicCommand('set-soundscape', { layer: 'brown', level: 64 })
    ).toBe(true);
    expect(dispatchWidgetMusicCommand('set-soundscape-volume', 82)).toBe(true);

    let snap = getWidgetMusicSnapshot();
    expect(snap.soundscape.isPlaying).toBe(true);
    expect(snap.soundscape.masterVolume).toBe(82);
    expect(snap.soundscape.levels.brown).toBe(64);
    expect(snap.soundscape.activeCount).toBe(1);

    expect(dispatchWidgetMusicCommand('apply-soundscape-preset', 'Midnight Porch')).toBe(true);
    snap = getWidgetMusicSnapshot();
    expect(snap.soundscape.levels.night).toBe(45);

    expect(dispatchWidgetMusicCommand('clear-soundscape')).toBe(true);
    expect(getWidgetMusicSnapshot().soundscape.activeCount).toBe(0);
  });

  it('indexes Soundscape presets and mixer actions in Spotlight search', () => {
    const results = buildSpotlightResults({
      query: 'Rainy Study',
      filter: 'all',
      apps: APP_REGISTRY,
      windows: [],
      activeWindowId: null,
      notes: [],
      theme: 'dark',
      wallpaper: 'mist',
      wallpapers: [{ id: 'mist', name: 'Soft mist' }],
      arrangeMode: false,
      showSeconds: false,
      showMessages: true,
      restoreSession: false,
      hasPassword: false,
      versionTag: 'v1.7.0',
    });

    expect(
      results.items.some(
        item =>
          item.command.type === 'soundscape-preset' &&
          item.command.presetId === 'preset-rainy-study'
      )
    ).toBe(true);
  });

  it('exports, validates, and restores soundscapeState in Workspace JSON backups', () => {
    setSoundscapeLayerLevel('rain', 52);
    setSoundscapeLayerLevel('hearth', 34);
    setSoundscapeMasterVolume(68);
    saveCustomSoundscapeMix('Stormy Cabin');

    const backup = buildWorkspaceBackup({
      preferences: {
        theme: 'dark',
        wallpaper: 'dusk',
        showSeconds: false,
        showMessages: true,
        restoreSession: false,
        menuView: 'grid',
        msgRefreshMins: 5,
      },
      pinnedDesktop: [],
      pinnedDock: [],
      desktopPositions: {},
      messages: [],
      shortcuts: [],
      widgets: [],
    });

    const parsed = parseAndValidateWorkspaceBackup(JSON.stringify(backup));
    expect(parsed.soundscapeState).toBeDefined();
    expect(parsed.soundscapeState!.masterVolume).toBe(68);
    expect(parsed.soundscapeState!.levels.rain).toBe(52);
    expect(parsed.soundscapeState!.customPresets[0]?.name).toBe('Stormy Cabin');

    localStorage.clear();
    clearSoundscapeLevels();
    applyWorkspaceBackupToStorage(parsed);
    reloadSoundscapeFromStorage();

    expect(getSoundscapeState().masterVolume).toBe(68);
    expect(getSoundscapeState().levels.rain).toBe(52);
    expect(getSoundscapeState().customPresets[0]?.name).toBe('Stormy Cabin');
  });
});
