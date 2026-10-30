/* ── Procedural Web Audio Soundscape Mixer (Zero External Assets) ─────────── */

export type SoundscapeLayerId = 'rain' | 'vinyl' | 'hearth' | 'brown' | 'wind' | 'night';

export interface SoundscapeChannelMeta {
  id: SoundscapeLayerId;
  name: string;
  subtitle: string;
  defaultToggleLevel: number;
  maxGain: number;
}

export const SOUNDSCAPE_CHANNELS: readonly SoundscapeChannelMeta[] = [
  {
    id: 'rain',
    name: 'Soft Rain',
    subtitle: 'Steady windowpane rainfall',
    defaultToggleLevel: 55,
    maxGain: 0.38,
  },
  {
    id: 'vinyl',
    name: 'Vinyl Dust',
    subtitle: 'Warm analog needle crackle',
    defaultToggleLevel: 32,
    maxGain: 0.24,
  },
  {
    id: 'hearth',
    name: 'Fireplace',
    subtitle: 'Low embers & wood crackle',
    defaultToggleLevel: 50,
    maxGain: 0.36,
  },
  {
    id: 'brown',
    name: 'Deep Brown',
    subtitle: 'Velvet low-frequency shield',
    defaultToggleLevel: 60,
    maxGain: 0.42,
  },
  {
    id: 'wind',
    name: 'Pines & Wind',
    subtitle: 'Slow canyon breeze swells',
    defaultToggleLevel: 40,
    maxGain: 0.32,
  },
  {
    id: 'night',
    name: 'Night Crickets',
    subtitle: 'Distant evening chorus',
    defaultToggleLevel: 38,
    maxGain: 0.16,
  },
];

export const VALID_SOUNDSCAPE_LAYER_IDS = new Set<SoundscapeLayerId>(
  SOUNDSCAPE_CHANNELS.map((c) => c.id)
);

export type SoundscapeLevels = Record<SoundscapeLayerId, number>;

export interface SoundscapePreset {
  id: string;
  name: string;
  subtitle: string;
  levels: Partial<SoundscapeLevels>;
  isBuiltIn?: boolean;
  createdAt?: number;
}

export const STARTER_SOUNDSCAPE_PRESETS: readonly SoundscapePreset[] = [
  {
    id: 'preset-rainy-study',
    name: 'Rainy Study',
    subtitle: 'Soft rain · Vinyl dust · Brown',
    levels: { rain: 58, vinyl: 28, brown: 20 },
    isBuiltIn: true,
  },
  {
    id: 'preset-cabin-fire',
    name: 'Cabin Hearth',
    subtitle: 'Fireplace · Pines · Light rain',
    levels: { hearth: 58, wind: 28, rain: 22 },
    isBuiltIn: true,
  },
  {
    id: 'preset-deep-shield',
    name: 'Deep Focus Shield',
    subtitle: 'Deep brown · Soft rain',
    levels: { brown: 66, rain: 24 },
    isBuiltIn: true,
  },
  {
    id: 'preset-midnight-porch',
    name: 'Midnight Porch',
    subtitle: 'Night crickets · Pines · Vinyl',
    levels: { night: 45, wind: 26, vinyl: 16 },
    isBuiltIn: true,
  },
];

export const SOUNDSCAPE_STORAGE_KEY = 'nexus.soundscape.v1';

export interface SoundscapePersistedState {
  version: 1;
  masterVolume: number;
  levels: SoundscapeLevels;
  activePresetId: string | null;
  customPresets: SoundscapePreset[];
}

export interface SoundscapeState {
  isPlaying: boolean;
  masterVolume: number;
  levels: SoundscapeLevels;
  activePresetId: string | null;
  customPresets: SoundscapePreset[];
}

export function createZeroSoundscapeLevels(): SoundscapeLevels {
  return {
    rain: 0,
    vinyl: 0,
    hearth: 0,
    brown: 0,
    wind: 0,
    night: 0,
  };
}

export function clampSoundscapePercent(val: unknown, fallback = 0): number {
  if (typeof val !== 'number' || !Number.isFinite(val)) return fallback;
  return Math.max(0, Math.min(100, Math.round(val)));
}

export function normalizeSoundscapeLevels(raw: unknown): SoundscapeLevels {
  const out = createZeroSoundscapeLevels();
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return out;
  const obj = raw as Record<string, unknown>;
  for (const ch of SOUNDSCAPE_CHANNELS) {
    out[ch.id] = clampSoundscapePercent(obj[ch.id], 0);
  }
  return out;
}

export function describeLevelsSubtitle(levels: Partial<SoundscapeLevels>): string {
  const active = SOUNDSCAPE_CHANNELS.filter((ch) => (levels[ch.id] ?? 0) > 0);
  if (active.length === 0) return 'Silent mix';
  return active
    .slice(0, 3)
    .map((ch) => `${ch.name} ${levels[ch.id]}%`)
    .join(' · ');
}

export function sanitizeSoundscapePersistedState(
  raw: unknown
): SoundscapePersistedState | null {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return null;
  const obj = raw as Record<string, unknown>;
  const masterVolume = clampSoundscapePercent(obj.masterVolume, 75);
  const levels = normalizeSoundscapeLevels(obj.levels);

  const customPresets: SoundscapePreset[] = [];
  const seenIds = new Set<string>(STARTER_SOUNDSCAPE_PRESETS.map((p) => p.id));
  if (Array.isArray(obj.customPresets)) {
    for (const item of obj.customPresets) {
      if (!item || typeof item !== 'object' || Array.isArray(item)) continue;
      const p = item as Record<string, unknown>;
      if (typeof p.id !== 'string' || !p.id.trim() || seenIds.has(p.id)) continue;
      if (typeof p.name !== 'string' || !p.name.trim()) continue;
      const pLevels = normalizeSoundscapeLevels(p.levels);
      const hasAny = SOUNDSCAPE_CHANNELS.some((ch) => pLevels[ch.id] > 0);
      if (!hasAny) continue;

      const cleanId = p.id.trim().slice(0, 64);
      seenIds.add(cleanId);
      customPresets.push({
        id: cleanId,
        name: p.name.trim().slice(0, 40),
        subtitle:
          typeof p.subtitle === 'string' && p.subtitle.trim()
            ? p.subtitle.trim().slice(0, 80)
            : describeLevelsSubtitle(pLevels),
        levels: pLevels,
        isBuiltIn: false,
        createdAt:
          typeof p.createdAt === 'number' && Number.isFinite(p.createdAt)
            ? p.createdAt
            : Date.now(),
      });
      if (customPresets.length >= 16) break;
    }
  }

  const allPresetIds = new Set<string>([
    ...STARTER_SOUNDSCAPE_PRESETS.map((p) => p.id),
    ...customPresets.map((p) => p.id),
  ]);
  const activePresetId =
    typeof obj.activePresetId === 'string' && allPresetIds.has(obj.activePresetId)
      ? obj.activePresetId
      : null;

  return {
    version: 1,
    masterVolume,
    levels,
    activePresetId,
    customPresets,
  };
}

export function createDefaultSoundscapePersistedState(): SoundscapePersistedState {
  return {
    version: 1,
    masterVolume: 75,
    levels: createZeroSoundscapeLevels(),
    activePresetId: null,
    customPresets: [],
  };
}

export function readSoundscapePersistedState(): SoundscapePersistedState {
  try {
    const raw = localStorage.getItem(SOUNDSCAPE_STORAGE_KEY);
    if (raw) {
      const sanitized = sanitizeSoundscapePersistedState(JSON.parse(raw));
      if (sanitized) return sanitized;
    }
  } catch {
    /* Fall back to clean defaults */
  }
  return createDefaultSoundscapePersistedState();
}

export function saveSoundscapePersistedState(state: SoundscapePersistedState): void {
  try {
    localStorage.setItem(SOUNDSCAPE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Ignore quota / private-mode storage errors */
  }
}

/* ── Procedural Seamless Stereo Buffer Builders & Web Audio Graph ─────────── */

interface AudioGraphChannel {
  gain: GainNode;
  maxGain: number;
}

class ProceduralSoundscapeEngine {
  private ctx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private channels = new Map<SoundscapeLayerId, AudioGraphChannel>();

  private getAudioContextCtor(): (typeof AudioContext) | null {
    if (typeof window === 'undefined') return null;
    const w = window as Window & { webkitAudioContext?: typeof AudioContext };
    return window.AudioContext ?? w.webkitAudioContext ?? null;
  }

  private createSeamlessBuffer(
    ctx: AudioContext,
    durationSec: number,
    generator: (channel: number, sampleIdx: number, sampleRate: number) => number
  ): AudioBuffer {
    const sr = ctx.sampleRate;
    const length = Math.floor(sr * durationSec);
    const fadeLen = Math.min(4096, Math.floor(length / 6));
    const totalGen = length + fadeLen;
    const buffer = ctx.createBuffer(2, length, sr);

    for (let ch = 0; ch < 2; ch++) {
      const raw = new Float32Array(totalGen);
      for (let i = 0; i < totalGen; i++) {
        raw[i] = generator(ch, i, sr);
      }
      const out = buffer.getChannelData(ch);
      for (let i = 0; i < length; i++) {
        if (i < fadeLen) {
          const t = i / fadeLen;
          /* Equal-power-inspired crossfade of tail into head for zero seam */
          out[i] = raw[i] * t + raw[length + i] * (1 - t);
        } else {
          out[i] = raw[i];
        }
      }
    }
    return buffer;
  }

  private buildPinkNoiseBuffer(ctx: AudioContext, seconds = 6): AudioBuffer {
    const b = [
      [0, 0, 0, 0, 0, 0, 0],
      [0, 0, 0, 0, 0, 0, 0],
    ];
    return this.createSeamlessBuffer(ctx, seconds, (ch) => {
      const s = b[ch];
      const white = Math.random() * 2 - 1;
      s[0] = 0.99886 * s[0] + white * 0.0555179;
      s[1] = 0.99332 * s[1] + white * 0.0750759;
      s[2] = 0.96900 * s[2] + white * 0.1538520;
      s[3] = 0.86650 * s[3] + white * 0.3104856;
      s[4] = 0.55000 * s[4] + white * 0.5329522;
      s[5] = -0.7616 * s[5] - white * 0.0168980;
      const pink = s[0] + s[1] + s[2] + s[3] + s[4] + s[5] + s[6] + white * 0.5362;
      s[6] = white * 0.115926;
      return pink * 0.11;
    });
  }

  private buildBrownNoiseBuffer(ctx: AudioContext, seconds = 6): AudioBuffer {
    const last = [0, 0];
    return this.createSeamlessBuffer(ctx, seconds, (ch) => {
      const white = Math.random() * 2 - 1;
      last[ch] = (last[ch] + 0.022 * white) / 1.022;
      return last[ch] * 3.1;
    });
  }

  private buildVinylBuffer(ctx: AudioContext, seconds = 7): AudioBuffer {
    const crackleEnv = [0, 0];
    const dustState = [0, 0];
    return this.createSeamlessBuffer(ctx, seconds, (ch, _idx, sr) => {
      const white = Math.random() * 2 - 1;
      dustState[ch] = 0.94 * dustState[ch] + 0.06 * white;
      /* ~10 subtle analog micro-ticks per second per channel */
      if (Math.random() < 9.5 / sr) {
        crackleEnv[ch] = (0.25 + Math.random() * 0.65) * (Math.random() < 0.5 ? 1 : -1);
      }
      crackleEnv[ch] *= Math.exp(-1 / (sr * 0.0014));
      return dustState[ch] * 0.22 + crackleEnv[ch] * 0.72;
    });
  }

  private buildHearthBuffer(ctx: AudioContext, seconds = 7.5): AudioBuffer {
    const rumble = [0, 0];
    const popEnv = [0, 0];
    const popTonePhase = [0, 0];
    const popFreq = [900, 1100];
    return this.createSeamlessBuffer(ctx, seconds, (ch, _idx, sr) => {
      const white = Math.random() * 2 - 1;
      rumble[ch] = (rumble[ch] + 0.025 * white) / 1.025;
      if (Math.random() < 4.2 / sr) {
        popEnv[ch] = 0.35 + Math.random() * 0.65;
        popFreq[ch] = 650 + Math.random() * 1250;
      }
      popEnv[ch] *= Math.exp(-1 / (sr * 0.0038));
      popTonePhase[ch] += (2 * Math.PI * popFreq[ch]) / sr;
      const crackle = (white * 0.65 + Math.sin(popTonePhase[ch]) * 0.35) * popEnv[ch];
      return rumble[ch] * 2.1 + crackle * 0.58;
    });
  }

  private buildNightCricketsBuffer(ctx: AudioContext, seconds = 8): AudioBuffer {
    const sr = ctx.sampleRate;
    const totalHint = Math.floor(sr * (seconds + 1));
    /* Pre-schedule gentle evening chirp bursts per channel */
    const events: Array<Array<{ start: number; pulses: number; freq: number; amp: number }>> = [
      [],
      [],
    ];
    for (let ch = 0; ch < 2; ch++) {
      let cursor = Math.floor(sr * (0.25 + ch * 0.42));
      while (cursor < totalHint - sr * 0.4) {
        events[ch].push({
          start: cursor,
          pulses: 3 + Math.floor(Math.random() * 2),
          freq: ch === 0 ? 4120 : 4260,
          amp: 0.26 + Math.random() * 0.16,
        });
        cursor += Math.floor(sr * (0.85 + Math.random() * 0.95));
      }
    }

    const airState = [0, 0];
    const eventCursor = [0, 0];
    return this.createSeamlessBuffer(ctx, seconds, (ch, idx, sampleRate) => {
      const white = Math.random() * 2 - 1;
      airState[ch] = 0.97 * airState[ch] + 0.03 * white;
      let chirp = 0;

      const list = events[ch];
      while (
        eventCursor[ch] < list.length &&
        idx > list[eventCursor[ch]].start + sampleRate * 0.35
      ) {
        eventCursor[ch]++;
      }

      const ev = list[eventCursor[ch]];
      if (ev && idx >= ev.start) {
        const pulseDur = Math.floor(sampleRate * 0.021);
        const gapDur = Math.floor(sampleRate * 0.014);
        const stride = pulseDur + gapDur;
        const rel = idx - ev.start;
        const pulseIndex = Math.floor(rel / stride);
        const within = rel % stride;
        if (pulseIndex < ev.pulses && within < pulseDur) {
          const env = 0.5 * (1 - Math.cos((2 * Math.PI * within) / pulseDur));
          const t = idx / sampleRate;
          const carrier =
            Math.sin(2 * Math.PI * ev.freq * t) * 0.85 +
            Math.sin(4 * Math.PI * ev.freq * t) * 0.15;
          chirp = carrier * env * ev.amp;
        }
      }

      return airState[ch] * 0.12 + chirp;
    });
  }

  private startLoopSource(ctx: AudioContext, buffer: AudioBuffer): AudioBufferSourceNode {
    const src = ctx.createBufferSource();
    src.buffer = buffer;
    src.loop = true;
    src.start(0);
    return src;
  }

  private ensureGraph(): AudioContext | null {
    if (this.ctx) return this.ctx;
    const Ctor = this.getAudioContextCtor();
    if (!Ctor) return null;

    let ctx: AudioContext;
    try {
      ctx = new Ctor();
    } catch {
      return null;
    }

    this.ctx = ctx;
    const master = ctx.createGain();
    master.gain.value = 0;
    master.connect(ctx.destination);
    this.masterGain = master;

    const pinkBuf = this.buildPinkNoiseBuffer(ctx, 6);
    const brownBuf = this.buildBrownNoiseBuffer(ctx, 6);
    const vinylBuf = this.buildVinylBuffer(ctx, 7);
    const hearthBuf = this.buildHearthBuffer(ctx, 7.5);
    const nightBuf = this.buildNightCricketsBuffer(ctx, 8);

    const makeChannelGain = (id: SoundscapeLayerId): GainNode => {
      const meta = SOUNDSCAPE_CHANNELS.find((c) => c.id === id)!;
      const g = ctx.createGain();
      g.gain.value = 0;
      g.connect(master);
      this.channels.set(id, { gain: g, maxGain: meta.maxGain });
      return g;
    };

    /* 1. Soft Rain */
    const rainSrc = this.startLoopSource(ctx, pinkBuf);
    const rainBand = ctx.createBiquadFilter();
    rainBand.type = 'bandpass';
    rainBand.frequency.value = 1420;
    rainBand.Q.value = 0.55;
    const rainShelf = ctx.createBiquadFilter();
    rainShelf.type = 'highshelf';
    rainShelf.frequency.value = 3600;
    rainShelf.gain.value = -4.5;
    const rainLfo = ctx.createOscillator();
    rainLfo.type = 'sine';
    rainLfo.frequency.value = 0.085;
    const rainLfoDepth = ctx.createGain();
    rainLfoDepth.gain.value = 210;
    rainLfo.connect(rainLfoDepth);
    rainLfoDepth.connect(rainBand.frequency);
    rainLfo.start(0);
    rainSrc.connect(rainBand);
    rainBand.connect(rainShelf);
    rainShelf.connect(makeChannelGain('rain'));

    /* 2. Vinyl Dust */
    const vinylSrc = this.startLoopSource(ctx, vinylBuf);
    const vinylHp = ctx.createBiquadFilter();
    vinylHp.type = 'highpass';
    vinylHp.frequency.value = 480;
    const vinylLp = ctx.createBiquadFilter();
    vinylLp.type = 'lowpass';
    vinylLp.frequency.value = 4400;
    vinylSrc.connect(vinylHp);
    vinylHp.connect(vinylLp);
    vinylLp.connect(makeChannelGain('vinyl'));

    /* 3. Fireplace */
    const hearthSrc = this.startLoopSource(ctx, hearthBuf);
    const hearthLp = ctx.createBiquadFilter();
    hearthLp.type = 'lowpass';
    hearthLp.frequency.value = 2200;
    hearthSrc.connect(hearthLp);
    hearthLp.connect(makeChannelGain('hearth'));

    /* 4. Deep Brown */
    const brownSrc = this.startLoopSource(ctx, brownBuf);
    const brownLp = ctx.createBiquadFilter();
    brownLp.type = 'lowpass';
    brownLp.frequency.value = 275;
    brownLp.Q.value = 0.5;
    brownSrc.connect(brownLp);
    brownLp.connect(makeChannelGain('brown'));

    /* 5. Pines & Wind */
    const windSrc = this.startLoopSource(ctx, pinkBuf);
    const windGain = makeChannelGain('wind');
    const windFilterA = ctx.createBiquadFilter();
    windFilterA.type = 'bandpass';
    windFilterA.frequency.value = 390;
    windFilterA.Q.value = 2.1;
    const windFilterB = ctx.createBiquadFilter();
    windFilterB.type = 'bandpass';
    windFilterB.frequency.value = 640;
    windFilterB.Q.value = 2.4;

    const lfoA = ctx.createOscillator();
    lfoA.frequency.value = 0.067;
    const lfoADepth = ctx.createGain();
    lfoADepth.gain.value = 145;
    lfoA.connect(lfoADepth);
    lfoADepth.connect(windFilterA.frequency);
    lfoA.start(0);

    const lfoB = ctx.createOscillator();
    lfoB.frequency.value = 0.094;
    const lfoBDepth = ctx.createGain();
    lfoBDepth.gain.value = 190;
    lfoB.connect(lfoBDepth);
    lfoBDepth.connect(windFilterB.frequency);
    lfoB.start(0);

    windSrc.connect(windFilterA);
    windSrc.connect(windFilterB);
    windFilterA.connect(windGain);
    windFilterB.connect(windGain);

    /* 6. Night Crickets */
    const nightSrc = this.startLoopSource(ctx, nightBuf);
    const nightLp = ctx.createBiquadFilter();
    nightLp.type = 'lowpass';
    nightLp.frequency.value = 5100;
    nightSrc.connect(nightLp);
    nightLp.connect(makeChannelGain('night'));

    return ctx;
  }

  sync(state: SoundscapeState): void {
    const hasAudibleLayer = SOUNDSCAPE_CHANNELS.some((ch) => state.levels[ch.id] > 0);
    const shouldPlay = state.isPlaying && hasAudibleLayer && state.masterVolume > 0;

    if (!shouldPlay && !this.ctx) {
      return;
    }

    const ctx = this.ensureGraph();
    if (!ctx || !this.masterGain) return;

    const now = ctx.currentTime;
    if (shouldPlay && ctx.state === 'suspended') {
      ctx.resume().catch(() => {});
    }

    const targetMaster = shouldPlay ? state.masterVolume / 100 : 0;
    this.masterGain.gain.setTargetAtTime(targetMaster, now, 0.06);

    for (const ch of SOUNDSCAPE_CHANNELS) {
      const node = this.channels.get(ch.id);
      if (!node) continue;
      const normalized = state.levels[ch.id] / 100;
      /* Perceptual curve (x^1.35) feels smooth across the whole 0-100 fader travel */
      const shaped = Math.pow(normalized, 1.35) * node.maxGain;
      node.gain.gain.setTargetAtTime(shouldPlay ? shaped : 0, now, 0.06);
    }

    if (!shouldPlay && ctx.state === 'running') {
      window.setTimeout(() => {
        if (this.ctx && !isSoundscapeAudiblyPlaying()) {
          this.ctx.suspend().catch(() => {});
        }
      }, 280);
    }
  }
}

const audioEngine = new ProceduralSoundscapeEngine();

/* ── External Store & Public Actions ──────────────────────────────────────── */

function createInitialSoundscapeState(): SoundscapeState {
  const persisted = readSoundscapePersistedState();
  return {
    isPlaying: false,
    masterVolume: persisted.masterVolume,
    levels: persisted.levels,
    activePresetId: persisted.activePresetId,
    customPresets: persisted.customPresets,
  };
}

let soundscapeState: SoundscapeState = createInitialSoundscapeState();
const soundscapeListeners = new Set<() => void>();

function persistSoundscapeSlice(state: SoundscapeState): void {
  saveSoundscapePersistedState({
    version: 1,
    masterVolume: state.masterVolume,
    levels: state.levels,
    activePresetId: state.activePresetId,
    customPresets: state.customPresets,
  });
}

function updateSoundscapeState(
  updater: (prev: SoundscapeState) => SoundscapeState,
  persist = true
): void {
  const next = updater(soundscapeState);
  if (next === soundscapeState) return;
  soundscapeState = next;
  if (persist) {
    persistSoundscapeSlice(next);
  }
  audioEngine.sync(next);
  for (const listener of soundscapeListeners) {
    listener();
  }
}

export function getSoundscapeState(): SoundscapeState {
  return soundscapeState;
}

export function subscribeSoundscapeState(listener: () => void): () => void {
  soundscapeListeners.add(listener);
  return () => soundscapeListeners.delete(listener);
}

export function getActiveSoundscapeLayersCount(
  levels: SoundscapeLevels = soundscapeState.levels
): number {
  let count = 0;
  for (const ch of SOUNDSCAPE_CHANNELS) {
    if (levels[ch.id] > 0) count++;
  }
  return count;
}

export function isSoundscapeAudiblyPlaying(state: SoundscapeState = soundscapeState): boolean {
  return state.isPlaying && getActiveSoundscapeLayersCount(state.levels) > 0;
}

export function describeActiveSoundscape(state: SoundscapeState = soundscapeState): string {
  const active = SOUNDSCAPE_CHANNELS.filter((ch) => state.levels[ch.id] > 0);
  if (active.length === 0) return 'No ambient layers';
  if (active.length <= 2) {
    return active.map((ch) => ch.name).join(' · ');
  }
  return `${active[0].name} · ${active[1].name} +${active.length - 2}`;
}

export function getAllSoundscapePresets(
  state: SoundscapeState = soundscapeState
): SoundscapePreset[] {
  return [...STARTER_SOUNDSCAPE_PRESETS, ...state.customPresets];
}

export function setSoundscapeLayerLevel(layerId: SoundscapeLayerId, level: number): void {
  if (!VALID_SOUNDSCAPE_LAYER_IDS.has(layerId)) return;
  const clamped = clampSoundscapePercent(level, 0);
  updateSoundscapeState((prev) => {
    if (prev.levels[layerId] === clamped && (clamped === 0 || prev.isPlaying)) {
      return prev;
    }
    const nextLevels: SoundscapeLevels = {
      ...prev.levels,
      [layerId]: clamped,
    };
    const anyRemaining = getActiveSoundscapeLayersCount(nextLevels) > 0;
    return {
      ...prev,
      levels: nextLevels,
      activePresetId: null,
      /* Auto-activate when raising a fader > 0; auto-pause when all faders hit 0 */
      isPlaying: clamped > 0 ? true : anyRemaining ? prev.isPlaying : false,
    };
  });
}

export function toggleSoundscapeLayer(layerId: SoundscapeLayerId): void {
  const meta = SOUNDSCAPE_CHANNELS.find((c) => c.id === layerId);
  if (!meta) return;
  const current = soundscapeState.levels[layerId];
  setSoundscapeLayerLevel(layerId, current > 0 ? 0 : meta.defaultToggleLevel);
}

export function setSoundscapeMasterVolume(volume: number): void {
  const clamped = clampSoundscapePercent(volume, 75);
  updateSoundscapeState((prev) => {
    if (prev.masterVolume === clamped) return prev;
    return { ...prev, masterVolume: clamped };
  });
}

export function setSoundscapePlaying(playing: boolean): void {
  updateSoundscapeState((prev) => {
    if (playing && getActiveSoundscapeLayersCount(prev.levels) === 0) {
      /* If user presses Play with all faders at 0, load the first starter preset ("Rainy Study") */
      const starter = STARTER_SOUNDSCAPE_PRESETS[0];
      return {
        ...prev,
        isPlaying: true,
        activePresetId: starter.id,
        levels: normalizeSoundscapeLevels(starter.levels),
      };
    }
    if (prev.isPlaying === playing) return prev;
    return { ...prev, isPlaying: playing };
  });
}

export function toggleSoundscapePlaying(): void {
  setSoundscapePlaying(!soundscapeState.isPlaying);
}

export function applySoundscapePreset(presetIdOrName: string): boolean {
  const needle = presetIdOrName.trim().toLowerCase();
  if (!needle) return false;
  const all = getAllSoundscapePresets();
  const target =
    all.find((p) => p.id.toLowerCase() === needle) ??
    all.find((p) => p.name.toLowerCase() === needle) ??
    all.find((p) => p.name.toLowerCase().includes(needle));
  if (!target) return false;

  updateSoundscapeState((prev) => ({
    ...prev,
    isPlaying: true,
    activePresetId: target.id,
    levels: normalizeSoundscapeLevels(target.levels),
  }));
  return true;
}

export function clearSoundscapeLevels(): void {
  updateSoundscapeState((prev) => ({
    ...prev,
    isPlaying: false,
    activePresetId: null,
    levels: createZeroSoundscapeLevels(),
  }));
}

export function stopSoundscape(): void {
  updateSoundscapeState((prev) => {
    if (!prev.isPlaying) return prev;
    return { ...prev, isPlaying: false };
  }, false);
}

export function saveCustomSoundscapeMix(name: string): SoundscapePreset | null {
  const cleanName = name.trim().slice(0, 40);
  if (!cleanName) return null;
  if (getActiveSoundscapeLayersCount(soundscapeState.levels) === 0) return null;

  const levelsCopy = { ...soundscapeState.levels };
  const created: SoundscapePreset = {
    id: `mix-${crypto.randomUUID()}`,
    name: cleanName,
    subtitle: describeLevelsSubtitle(levelsCopy),
    levels: levelsCopy,
    isBuiltIn: false,
    createdAt: Date.now(),
  };

  updateSoundscapeState((prev) => ({
    ...prev,
    activePresetId: created.id,
    customPresets: [created, ...prev.customPresets].slice(0, 16),
  }));
  return created;
}

export function deleteCustomSoundscapeMix(presetId: string): void {
  updateSoundscapeState((prev) => {
    const nextPresets = prev.customPresets.filter((p) => p.id !== presetId);
    if (nextPresets.length === prev.customPresets.length) return prev;
    return {
      ...prev,
      activePresetId: prev.activePresetId === presetId ? null : prev.activePresetId,
      customPresets: nextPresets,
    };
  });
}

export function reloadSoundscapeFromStorage(): void {
  const persisted = readSoundscapePersistedState();
  updateSoundscapeState(
    () => ({
      isPlaying: false,
      masterVolume: persisted.masterVolume,
      levels: persisted.levels,
      activePresetId: persisted.activePresetId,
      customPresets: persisted.customPresets,
    }),
    false
  );
}
