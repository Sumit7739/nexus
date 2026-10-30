import { beforeEach, describe, expect, it } from 'vitest';
import {
  addTrackToMusicPlaylist,
  buildTrackFromVideoId,
  captureVideoTimestampNote,
  consumeMusicActions,
  createMusicPlaylist,
  cycleMusicRepeat,
  dispatchWidgetMusicCommand,
  enqueueTrackNext,
  extractYouTubeVideoId,
  formatCompactViews,
  formatMediaSeconds,
  getMusicState,
  getWidgetMusicSnapshot,
  moveQueueTrack,
  parseIsoDurationSeconds,
  parseTimestampInputSeconds,
  playMusicPlaylist,
  playMusicTrack,
  readMusicHistory,
  readMusicLiked,
  readMusicPlaylists,
  readYouTubeHistory,
  readYouTubeWatchLater,
  removeQueueTrack,
  reportAudioTelemetry,
  resetMusicStoreForTests,
  saveMusicHistory,
  saveMusicLiked,
  saveMusicPlaylists,
  saveYouTubeHistory,
  saveYouTubeWatchLater,
  toggleMusicTrackLiked,
  type MediaTrack,
} from '../src/data/media';
import { createScratchpadNote, readNotesState, saveNotesState } from '../src/data/notes';
import {
  applyWorkspaceBackupToStorage,
  buildWorkspaceBackup,
  clearAllWorkspaceStorage,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';
import { WIDGET_API_ENTRIES, WIDGET_TEMPLATES } from '../src/widgets/templates';

const SAMPLE_TRACK_A: MediaTrack = {
  id: 'jfKfPfyJRdk',
  title: 'lofi hip hop radio — beats to relax/study to',
  channelTitle: 'Lofi Girl',
  description: '24/7 mellow beats',
  publishedAt: '2024-01-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/jfKfPfyJRdk/mqdefault.jpg',
  duration: 'LIVE',
  durationSeconds: 0,
};

const SAMPLE_TRACK_B: MediaTrack = {
  id: '4xDzrJKXOOY',
  title: 'synthwave radio — beats to chill/game to',
  channelTitle: 'Lofi Girl',
  description: 'Retro analog synthwave',
  publishedAt: '2024-02-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/4xDzrJKXOOY/mqdefault.jpg',
  duration: '04:18',
  durationSeconds: 258,
  viewCount: '1250000',
};

const SAMPLE_TRACK_C: MediaTrack = {
  id: 'Dx5qFachd3A',
  title: 'Relaxing Jazz Piano Radio',
  channelTitle: 'Cafe Music BGM channel',
  description: 'Acoustic jazz trio',
  publishedAt: '2024-03-01T00:00:00Z',
  thumbnail: 'https://i.ytimg.com/vi/Dx5qFachd3A/mqdefault.jpg',
  duration: '01:02:05',
  durationSeconds: 3725,
};

beforeEach(() => {
  localStorage.clear();
  sessionStorage.clear();
  consumeMusicActions();
  resetMusicStoreForTests();
});

describe('media parsing & formatting helpers', () => {
  it('extracts valid 11-char YouTube IDs across watch, short, shorts, embed, live, and bare IDs', () => {
    expect(extractYouTubeVideoId('https://www.youtube.com/watch?v=jfKfPfyJRdk&t=120s')).toBe(
      'jfKfPfyJRdk'
    );
    expect(extractYouTubeVideoId('https://youtu.be/4xDzrJKXOOY?si=abc')).toBe('4xDzrJKXOOY');
    expect(extractYouTubeVideoId('https://youtube.com/shorts/Dx5qFachd3A')).toBe('Dx5qFachd3A');
    expect(extractYouTubeVideoId('https://www.youtube-nocookie.com/embed/5yx6BWlEVcY')).toBe(
      '5yx6BWlEVcY'
    );
    expect(extractYouTubeVideoId('https://www.youtube.com/live/S_MOd40zlYU')).toBe('S_MOd40zlYU');
    expect(extractYouTubeVideoId('DWcJFNfaw9c')).toBe('DWcJFNfaw9c');

    expect(extractYouTubeVideoId('https://github.com/vitejs/vite')).toBeNull();
    expect(extractYouTubeVideoId('https://www.youtube.com/results?search_query=lofi')).toBeNull();
    expect(extractYouTubeVideoId('not-a-valid-id-too-long')).toBeNull();
  });

  it('parses ISO-8601 durations, timestamps, and compact view counts accurately', () => {
    expect(parseIsoDurationSeconds('PT4M18S')).toBe(258);
    expect(parseIsoDurationSeconds('PT1H2M5S')).toBe(3725);
    expect(parseIsoDurationSeconds('PT45S')).toBe(45);
    expect(parseIsoDurationSeconds('P0D')).toBe(0);

    expect(formatMediaSeconds(258)).toBe('04:18');
    expect(formatMediaSeconds(3725)).toBe('1:02:05');
    expect(formatMediaSeconds(-4)).toBe('00:00');

    expect(parseTimestampInputSeconds('[04:18]')).toBe(258);
    expect(parseTimestampInputSeconds('1:02:05')).toBe(3725);
    expect(parseTimestampInputSeconds('95')).toBe(95);
    expect(parseTimestampInputSeconds('invalid')).toBeNull();

    expect(formatCompactViews('1250000')).toBe('1.3M views');
    expect(formatCompactViews(42000)).toBe('42K views');
    expect(formatCompactViews(840)).toBe('840 views');
    expect(formatCompactViews(0)).toBe('');

    const fallbackTrack = buildTrackFromVideoId('4xDzrJKXOOY', 'Synthwave Mix - YouTube');
    expect(fallbackTrack.title).toBe('Synthwave Mix');
  });
});

describe('Nexus Tube timestamp note capture to Scratchpad', () => {
  it('appends a formatted Markdown timestamp link to the active Scratchpad note', () => {
    const seedNote = createScratchpadNote({
      id: 'note-study',
      title: 'Distributed Systems Lecture',
      content: '# Distributed Systems Lecture\n\nInitial summary.',
    });
    saveNotesState({ notes: [seedNote], activeNoteId: seedNote.id });

    const captured = captureVideoTimestampNote({
      video: SAMPLE_TRACK_B,
      seconds: 258,
      noteText: 'Raft leader election timeout invariants',
    });

    expect(captured.formattedTimestamp).toBe('04:18');
    expect(captured.urlWithTime).toBe('https://www.youtube.com/watch?v=4xDzrJKXOOY&t=258s');

    const updatedNotes = readNotesState();
    const active = updatedNotes.notes.find((n) => n.id === captured.noteId);
    expect(active?.content).toContain(
      '- **[04:18](https://www.youtube.com/watch?v=4xDzrJKXOOY&t=258s)** — Raft leader election timeout invariants (*synthwave radio — beats to chill/game to*)'
    );
  });
});

describe('persistent desktop musicStore, queue, likes, playlists & auto-advance', () => {
  it('manages queue order, likes, and custom playlists with localStorage persistence', () => {
    playMusicTrack(SAMPLE_TRACK_A, [SAMPLE_TRACK_A, SAMPLE_TRACK_C]);
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_A.id);
    expect(getMusicState().isPlaying).toBe(true);

    enqueueTrackNext(SAMPLE_TRACK_B);
    expect(getMusicState().queue.map((t) => t.id)).toEqual([
      SAMPLE_TRACK_A.id,
      SAMPLE_TRACK_B.id,
      SAMPLE_TRACK_C.id,
    ]);

    moveQueueTrack(2, -1);
    expect(getMusicState().queue.map((t) => t.id)).toEqual([
      SAMPLE_TRACK_A.id,
      SAMPLE_TRACK_C.id,
      SAMPLE_TRACK_B.id,
    ]);

    removeQueueTrack(SAMPLE_TRACK_C.id);
    expect(getMusicState().queue.map((t) => t.id)).toEqual([
      SAMPLE_TRACK_A.id,
      SAMPLE_TRACK_B.id,
    ]);

    expect(toggleMusicTrackLiked(SAMPLE_TRACK_B)).toBe(true);
    expect(readMusicLiked().map((t) => t.id)).toEqual([SAMPLE_TRACK_B.id]);
    expect(toggleMusicTrackLiked(SAMPLE_TRACK_B)).toBe(false);
    expect(readMusicLiked()).toEqual([]);

    const pl = createMusicPlaylist('Late Night Focus', SAMPLE_TRACK_A);
    expect(pl).not.toBeNull();
    addTrackToMusicPlaylist(pl!.id, SAMPLE_TRACK_B);
    expect(readMusicPlaylists()[0]?.tracks.map((t) => t.id)).toEqual([
      SAMPLE_TRACK_A.id,
      SAMPLE_TRACK_B.id,
    ]);

    playMusicPlaylist(pl!.id);
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_A.id);
  });

  it('auto-advances on playerState=0 across repeat off, all, and one modes', () => {
    playMusicTrack(SAMPLE_TRACK_A, [SAMPLE_TRACK_A, SAMPLE_TRACK_B]);

    // End of track A -> advances to track B
    reportAudioTelemetry({ playerState: 0 });
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_B.id);
    expect(getMusicState().isPlaying).toBe(true);

    // Repeat is 'off' at end of queue -> stops playback cleanly
    reportAudioTelemetry({ playerState: 0 });
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_B.id);
    expect(getMusicState().isPlaying).toBe(false);

    // Cycle repeat -> 'all': end of queue wraps back to track A
    cycleMusicRepeat();
    expect(getMusicState().repeat).toBe('all');
    reportAudioTelemetry({ playerState: 0 });
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_A.id);
    expect(getMusicState().isPlaying).toBe(true);

    // Cycle repeat -> 'one': end of track seeks to 0 on the same track
    cycleMusicRepeat();
    expect(getMusicState().repeat).toBe('one');
    reportAudioTelemetry({ currentTime: 120 });
    reportAudioTelemetry({ playerState: 0 });
    expect(getMusicState().current?.id).toBe(SAMPLE_TRACK_A.id);
    expect(getMusicState().currentTime).toBe(0);
    expect(getMusicState().pendingCommand?.func).toBe('seekTo');
  });
});

describe('workspace backup round-trip for YouTube & Music libraries', () => {
  it('exports, validates, restores, and clears YouTube & Music storage keys', () => {
    saveYouTubeHistory([SAMPLE_TRACK_B]);
    saveYouTubeWatchLater([SAMPLE_TRACK_C]);
    saveMusicHistory([SAMPLE_TRACK_A]);
    saveMusicLiked([SAMPLE_TRACK_B]);
    saveMusicPlaylists([
      {
        id: 'pl-1',
        name: 'Deep Work',
        tracks: [SAMPLE_TRACK_A, SAMPLE_TRACK_C],
        createdAt: 1_700_000_000_000,
      },
    ]);

    const snapshot = buildWorkspaceBackup({
      preferences: {
        theme: 'dark',
        wallpaper: 'midnight',
        showSeconds: false,
        showMessages: true,
        restoreSession: true,
        menuView: 'grid',
        msgRefreshMins: 5,
      },
      pinnedDesktop: ['youtube', 'music', 'notes'],
      pinnedDock: ['youtube', 'music'],
      desktopPositions: {},
      messages: [{ id: 'm1', text: 'Stay focused.' }],
      shortcuts: [],
      widgets: [],
    });

    const serialized = JSON.stringify(snapshot);
    clearAllWorkspaceStorage();

    expect(readYouTubeHistory()).toEqual([]);
    expect(readYouTubeWatchLater()).toEqual([]);
    expect(readMusicHistory()).toEqual([]);
    expect(readMusicLiked()).toEqual([]);
    expect(readMusicPlaylists()).toEqual([]);

    const validated = parseAndValidateWorkspaceBackup(serialized);
    applyWorkspaceBackupToStorage(validated);

    expect(readYouTubeHistory().map((t) => t.id)).toEqual([SAMPLE_TRACK_B.id]);
    expect(readYouTubeWatchLater().map((t) => t.id)).toEqual([SAMPLE_TRACK_C.id]);
    expect(readMusicHistory().map((t) => t.id)).toEqual([SAMPLE_TRACK_A.id]);
    expect(readMusicLiked().map((t) => t.id)).toEqual([SAMPLE_TRACK_B.id]);
    expect(readMusicPlaylists()[0]?.name).toBe('Deep Work');
    expect(readMusicPlaylists()[0]?.tracks).toHaveLength(2);
  });
});

describe('Widget Studio Music Bridge (window.NEXUS.music) & API Reference', () => {
  it('exposes Music API Reference docs and the Now Playing Deck widget template', () => {
    const musicEntries = WIDGET_API_ENTRIES.filter((entry) => entry.category === 'Music');
    expect(musicEntries.length).toBeGreaterThanOrEqual(5);
    expect(musicEntries.some((e) => e.signature.includes('NEXUS.music.getState()'))).toBe(true);
    expect(musicEntries.some((e) => e.signature.includes('NEXUS.music.open'))).toBe(true);

    const nowPlayingTpl = WIDGET_TEMPLATES.find((tpl) => tpl.id === 'now-playing');
    expect(nowPlayingTpl).toBeDefined();
    expect(nowPlayingTpl?.source.js).toContain('NEXUS.music.onChange');
  });

  it('handles transport, streams, URLs, likes, playlists, volume, and Music app handoff cleanly', () => {
    let musicAppOpenedCount = 0;
    const onOpenMusic = () => {
      musicAppOpenedCount += 1;
    };

    // Start built-in stream #1 (Synthwave Radio)
    expect(dispatchWidgetMusicCommand('play-stream', 1, onOpenMusic)).toBe(true);
    expect(getWidgetMusicSnapshot().current?.id).toBe('4xDzrJKXOOY');
    expect(getWidgetMusicSnapshot().isPlaying).toBe(true);

    // Idempotent pause & play (never accidentally toggles in the wrong direction)
    dispatchWidgetMusicCommand('pause', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isPlaying).toBe(false);
    dispatchWidgetMusicCommand('pause', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isPlaying).toBe(false);

    dispatchWidgetMusicCommand('play', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isPlaying).toBe(true);
    dispatchWidgetMusicCommand('play', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isPlaying).toBe(true);

    // Volume, mute, shuffle, repeat, seek & like
    dispatchWidgetMusicCommand('set-volume', 45, onOpenMusic);
    expect(getWidgetMusicSnapshot().volume).toBe(45);
    dispatchWidgetMusicCommand('toggle-mute', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isMuted).toBe(true);
    dispatchWidgetMusicCommand('toggle-shuffle', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().shuffle).toBe(true);
    dispatchWidgetMusicCommand('cycle-repeat', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().repeat).toBe('all');
    dispatchWidgetMusicCommand('seek', 92, onOpenMusic);
    expect(getWidgetMusicSnapshot().currentTime).toBe(92);

    dispatchWidgetMusicCommand('toggle-like', undefined, onOpenMusic);
    expect(getWidgetMusicSnapshot().isLiked).toBe(true);
    expect(getWidgetMusicSnapshot().likedCount).toBe(1);

    // Enqueue a YouTube URL with custom title & play a playlist by name
    dispatchWidgetMusicCommand(
      'enqueue',
      { target: 'https://youtu.be/Dx5qFachd3A', title: 'Jazz Trio Live' },
      onOpenMusic
    );
    expect(getWidgetMusicSnapshot().queue.some((t) => t.id === 'Dx5qFachd3A')).toBe(true);

    createMusicPlaylist('Morning Flow', SAMPLE_TRACK_C);
    expect(dispatchWidgetMusicCommand('play-playlist', 'morning flow', onOpenMusic)).toBe(true);
    expect(getWidgetMusicSnapshot().current?.id).toBe(SAMPLE_TRACK_C.id);

    // Open Music app on 'liked' tab & run search query
    expect(dispatchWidgetMusicCommand('open', 'liked', onOpenMusic)).toBe(true);
    expect(dispatchWidgetMusicCommand('search', 'ambient synth', onOpenMusic)).toBe(true);
    expect(musicAppOpenedCount).toBe(2);
    expect(consumeMusicActions()).toEqual([
      { kind: 'tab', tab: 'liked' },
      { kind: 'search', query: 'ambient synth' },
    ]);
  });
});

