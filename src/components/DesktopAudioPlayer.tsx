import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import {
  ArrowUpRight,
  CloudRain,
  Headphones,
  Pause,
  Play,
  RotateCcw,
  SkipBack,
  SkipForward,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import {
  enqueueMusicAction,
  formatMediaSeconds,
  getMusicState,
  reportAudioTelemetry,
  stepMusicTrack,
  stopMusic,
  subscribeMusicState,
  toggleMusicMute,
  toggleMusicPlayback,
} from '../data/media';
import {
  applySoundscapePreset,
  clearSoundscapeLevels,
  describeActiveSoundscape,
  getActiveSoundscapeLayersCount,
  getSoundscapeState,
  isSoundscapeAudiblyPlaying,
  setSoundscapeLayerLevel,
  setSoundscapeMasterVolume,
  SOUNDSCAPE_CHANNELS,
  STARTER_SOUNDSCAPE_PRESETS,
  stopSoundscape,
  subscribeSoundscapeState,
  toggleSoundscapePlaying,
} from '../data/soundscape';

export interface DesktopAudioPlayerProps {
  onOpenMusic: () => void;
}

export function DesktopAudioPlayer({ onOpenMusic }: DesktopAudioPlayerProps) {
  const music = useSyncExternalStore(subscribeMusicState, getMusicState);
  const soundscape = useSyncExternalStore(subscribeSoundscapeState, getSoundscapeState);
  const iframeRef = useRef<HTMLIFrameElement | null>(null);
  const containerRef = useRef<HTMLElement | null>(null);
  const lastCommandNonceRef = useRef<number>(0);
  const [thumbFailedId, setThumbFailedId] = useState<string | null>(null);
  const [ambientOpen, setAmbientOpen] = useState(false);

  const current = music.current;
  const activeAmbientCount = getActiveSoundscapeLayersCount(soundscape.levels);
  const ambientAudible = isSoundscapeAudiblyPlaying(soundscape);

  const originParam =
    typeof window !== 'undefined' && window.location.origin
      ? `&origin=${encodeURIComponent(window.location.origin)}`
      : '';

  const postToPlayer = (payload: Record<string, unknown>) => {
    iframeRef.current?.contentWindow?.postMessage(
      JSON.stringify(payload),
      'https://www.youtube-nocookie.com'
    );
  };

  /* Close quick ambient popover on outside pointerdown or Escape */
  useEffect(() => {
    if (!ambientOpen) return;
    const onPointerDown = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setAmbientOpen(false);
      }
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setAmbientOpen(false);
    };
    window.addEventListener('pointerdown', onPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('pointerdown', onPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [ambientOpen]);

  /* Listen to YouTube IFrame API postMessage state & progress updates */
  useEffect(() => {
    if (!current) return;
    const handleMessage = (event: MessageEvent) => {
      if (event.source !== iframeRef.current?.contentWindow) return;
      if (typeof event.data !== 'string') return;
      try {
        const parsed = JSON.parse(event.data) as {
          event?: string;
          info?: unknown;
        };
        if (parsed.event === 'onStateChange' && typeof parsed.info === 'number') {
          reportAudioTelemetry({ playerState: parsed.info });
          return;
        }
        if (parsed.event === 'infoDelivery' && parsed.info && typeof parsed.info === 'object') {
          const info = parsed.info as {
            currentTime?: number;
            duration?: number;
            playerState?: number;
          };
          reportAudioTelemetry({
            currentTime: info.currentTime,
            duration: info.duration,
            playerState: info.playerState,
          });
        }
      } catch {
        /* Ignore non-JSON messages */
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [current]);

  /* Forward imperative transport commands (play/pause/mute/volume/seek) */
  useEffect(() => {
    const cmd = music.pendingCommand;
    if (!cmd || cmd.nonce === lastCommandNonceRef.current) return;
    lastCommandNonceRef.current = cmd.nonce;
    postToPlayer({ event: 'command', func: cmd.func, args: cmd.args });
  }, [music.pendingCommand]);

  if (!current && !ambientAudible && !ambientOpen) return null;

  const isLiveStream = current
    ? current.duration === 'LIVE' || (music.duration <= 0 && !current.durationSeconds)
    : false;
  const displayDuration = current
    ? music.duration > 0
      ? music.duration
      : (current.durationSeconds ?? 0)
    : 0;
  const timeReadout = current
    ? isLiveStream
      ? music.currentTime > 0
        ? `${formatMediaSeconds(music.currentTime)} · LIVE`
        : 'LIVE'
      : displayDuration > 0
        ? `${formatMediaSeconds(music.currentTime)} / ${formatMediaSeconds(displayDuration)}`
        : formatMediaSeconds(music.currentTime)
    : `${soundscape.masterVolume}%`;

  const showThumb = Boolean(current?.thumbnail) && thumbFailedId !== current?.id;

  const openFullSoundscapes = () => {
    setAmbientOpen(false);
    enqueueMusicAction({ kind: 'tab', tab: 'soundscapes' });
    onOpenMusic();
  };

  return (
    <aside
      ref={containerRef}
      className="desktop-mini-player"
      aria-label="Now playing audio controls"
      onClick={e => e.stopPropagation()}
    >
      <button
        type="button"
        className="dmp-track-trigger"
        onClick={() => {
          if (current) onOpenMusic();
          else openFullSoundscapes();
        }}
        title={current ? 'Open Music workspace' : 'Open Soundscape Mixer'}
      >
        <span className={`dmp-artwork ${!current ? 'is-ambient' : ''}`}>
          {current ? (
            showThumb ? (
              <img
                src={current.thumbnail}
                alt=""
                referrerPolicy="no-referrer"
                onError={() => setThumbFailedId(current.id)}
              />
            ) : (
              <Headphones size={15} />
            )
          ) : (
            <CloudRain size={15} />
          )}
        </span>
        <span className="dmp-meta">
          <strong>{current ? current.title : describeActiveSoundscape(soundscape)}</strong>
          <small>
            <span>{current ? current.channelTitle : 'Ambient soundscape'}</span>
            <span aria-hidden="true">·</span>
            <span className="dmp-time">{timeReadout}</span>
            {current && ambientAudible && (
              <>
                <span aria-hidden="true">·</span>
                <span className="dmp-ambient-note">+{activeAmbientCount} ambient</span>
              </>
            )}
          </small>
        </span>
      </button>

      <div className="dmp-controls" role="group" aria-label="Mini player playback controls">
        {current && (
          <button
            type="button"
            className="dmp-btn"
            onClick={() => stepMusicTrack(-1, 'manual')}
            title="Previous track"
            aria-label="Previous track"
          >
            <SkipBack size={13} />
          </button>
        )}
        <button
          type="button"
          className="dmp-btn dmp-btn-play"
          onClick={() => {
            if (current) toggleMusicPlayback();
            else toggleSoundscapePlaying();
          }}
          title={
            current
              ? music.isPlaying
                ? 'Pause track'
                : 'Play track'
              : soundscape.isPlaying
                ? 'Pause ambience'
                : 'Play ambience'
          }
          aria-label={
            current
              ? music.isPlaying
                ? 'Pause'
                : 'Play'
              : soundscape.isPlaying
                ? 'Pause ambience'
                : 'Play ambience'
          }
        >
          {(current ? music.isPlaying : soundscape.isPlaying) ? (
            <Pause size={13} fill="currentColor" />
          ) : (
            <Play size={13} fill="currentColor" />
          )}
        </button>
        {current && (
          <button
            type="button"
            className="dmp-btn"
            onClick={() => stepMusicTrack(1, 'manual')}
            title="Next track"
            aria-label="Next track"
          >
            <SkipForward size={13} />
          </button>
        )}
        <button
          type="button"
          className={`dmp-btn ${ambientAudible || ambientOpen ? 'is-ambient-on' : ''}`}
          onClick={() => setAmbientOpen(v => !v)}
          title="Layered ambient soundscape mixer"
          aria-label="Toggle ambient soundscape mixer"
          aria-expanded={ambientOpen}
        >
          <CloudRain size={13} />
        </button>
        {current && (
          <button
            type="button"
            className="dmp-btn"
            onClick={toggleMusicMute}
            title={music.isMuted ? 'Unmute' : 'Mute'}
            aria-label={music.isMuted ? 'Unmute' : 'Mute'}
          >
            {music.isMuted ? <VolumeX size={13} /> : <Volume2 size={13} />}
          </button>
        )}
        <button
          type="button"
          className="dmp-btn"
          onClick={() => {
            if (current) onOpenMusic();
            else openFullSoundscapes();
          }}
          title="Open Music window"
          aria-label="Open Music window"
        >
          <ArrowUpRight size={13} />
        </button>
        <button
          type="button"
          className="dmp-btn dmp-btn-close"
          onClick={() => {
            if (current) {
              stopMusic();
            } else {
              stopSoundscape();
              setAmbientOpen(false);
            }
          }}
          title={current ? 'Stop track playback' : 'Stop ambient soundscape'}
          aria-label={current ? 'Stop playback' : 'Stop ambient soundscape'}
        >
          <X size={13} />
        </button>
      </div>

      {/* Quick Floating Soundscape Popover */}
      {ambientOpen && (
        <div
          className="dmp-soundscape-popover"
          role="dialog"
          aria-label="Ambient soundscape quick mixer"
        >
          <div className="dmp-sc-head">
            <div className="dmp-sc-title">
              <strong>Ambient layers</strong>
              <span>
                {activeAmbientCount > 0
                  ? describeActiveSoundscape(soundscape)
                  : 'Layer underneath music or solo'}
              </span>
            </div>
            <div className="dmp-sc-head-actions">
              {activeAmbientCount > 0 && (
                <button
                  type="button"
                  className="icon-btn"
                  onClick={clearSoundscapeLevels}
                  title="Reset all faders to 0%"
                  aria-label="Reset ambient faders"
                >
                  <RotateCcw size={12} />
                </button>
              )}
              <button
                type="button"
                className="primary-btn dmp-sc-toggle-btn"
                onClick={toggleSoundscapePlaying}
              >
                {ambientAudible ? (
                  <>
                    <Pause size={11} fill="currentColor" /> Pause
                  </>
                ) : (
                  <>
                    <Play size={11} fill="currentColor" /> Play
                  </>
                )}
              </button>
            </div>
          </div>

          <div className="dmp-sc-presets" role="group" aria-label="Starter soundscapes">
            {STARTER_SOUNDSCAPE_PRESETS.map(preset => (
              <button
                key={preset.id}
                type="button"
                className={`dmp-sc-preset-btn ${
                  soundscape.activePresetId === preset.id && ambientAudible ? 'is-active' : ''
                }`}
                onClick={() => applySoundscapePreset(preset.id)}
              >
                {preset.name}
              </button>
            ))}
          </div>

          <div className="dmp-sc-faders">
            {SOUNDSCAPE_CHANNELS.map(ch => {
              const val = soundscape.levels[ch.id];
              return (
                <label key={ch.id} className="dmp-sc-row">
                  <span className={val > 0 ? 'is-lit' : ''}>{ch.name}</span>
                  <input
                    type="range"
                    min={0}
                    max={100}
                    value={val}
                    onChange={e => setSoundscapeLayerLevel(ch.id, Number(e.target.value))}
                    aria-label={`${ch.name} level`}
                  />
                  <em>{val}%</em>
                </label>
              );
            })}
          </div>

          <div className="dmp-sc-footer">
            <label className="dmp-sc-master">
              <Volume2 size={12} />
              <input
                type="range"
                min={0}
                max={100}
                value={soundscape.masterVolume}
                onChange={e => setSoundscapeMasterVolume(Number(e.target.value))}
                aria-label="Master ambient volume"
              />
              <em>{soundscape.masterVolume}%</em>
            </label>
            <button type="button" className="ws-text-btn" onClick={openFullSoundscapes}>
              Saved mixes →
            </button>
          </div>
        </div>
      )}

      {/* Persistent hidden YouTube IFrame audio bridge */}
      {current && (
        <div className="dmp-audio-bridge" aria-hidden="true">
          <iframe
            key={current.id}
            ref={iframeRef}
            title={`Background audio player for ${current.title}`}
            src={`https://www.youtube-nocookie.com/embed/${current.id}?autoplay=1&controls=0&enablejsapi=1&rel=0&playsinline=1${originParam}`}
            allow="autoplay; encrypted-media"
            referrerPolicy="strict-origin-when-cross-origin"
            onLoad={() => {
              postToPlayer({ event: 'listening', id: 'nexus-audio', channel: 'widget' });
              postToPlayer({
                event: 'command',
                func: 'addEventListener',
                args: ['onStateChange'],
              });
              postToPlayer({ event: 'command', func: 'setVolume', args: [music.volume] });
              if (music.isMuted) {
                postToPlayer({ event: 'command', func: 'mute', args: [] });
              }
              if (!music.isPlaying) {
                postToPlayer({ event: 'command', func: 'pauseVideo', args: [] });
              }
            }}
          />
        </div>
      )}
    </aside>
  );
}
