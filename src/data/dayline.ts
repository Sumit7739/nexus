export const DAYLINE_STORAGE_KEY = 'nexus.dayline.v1';

export interface DaylineBlock {
  id: string;
  task: string;
  sourceNoteId: string;
  sourceLineIndex: number;
  completed: boolean;
}

export interface DaylineDay {
  date: string;
  blocks: Record<string, DaylineBlock>;
}

export interface DaylineState {
  days: Record<string, DaylineDay>;
  timezones: string[];
  weatherLocation: string;
}

export const DEFAULT_DAYLINE_STATE: DaylineState = {
  days: {},
  timezones: ['UTC'],
  weatherLocation: '',
};

function isValidDateKey(value: unknown): value is string {
  return typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value);
}

export function getDaylineDate(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function createDaylineState(): DaylineState {
  return { days: {}, timezones: [...DEFAULT_DAYLINE_STATE.timezones], weatherLocation: '' };
}

export function sanitizeDaylineState(raw: unknown): DaylineState {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return createDaylineState();
  const obj = raw as Record<string, unknown>;
  const days: Record<string, DaylineDay> = {};
  if (obj.days && typeof obj.days === 'object' && !Array.isArray(obj.days)) {
    for (const [date, value] of Object.entries(obj.days)) {
      if (!isValidDateKey(date) || !value || typeof value !== 'object' || Array.isArray(value)) continue;
      const rawBlocks = (value as Record<string, unknown>).blocks;
      if (!rawBlocks || typeof rawBlocks !== 'object' || Array.isArray(rawBlocks)) continue;
      const blocks: Record<string, DaylineBlock> = {};
      for (const [hour, rawBlock] of Object.entries(rawBlocks)) {
        if (!/^(?:[01]\d|2[0-3]):00$/.test(hour) || !rawBlock || typeof rawBlock !== 'object') continue;
        const block = rawBlock as Record<string, unknown>;
        if (
          typeof block.task !== 'string' ||
          typeof block.sourceNoteId !== 'string' ||
          typeof block.sourceLineIndex !== 'number'
        ) continue;
        blocks[hour] = {
          id: typeof block.id === 'string' ? block.id : `${date}-${hour}`,
          task: block.task.slice(0, 500),
          sourceNoteId: block.sourceNoteId,
          sourceLineIndex: Math.max(0, Math.floor(block.sourceLineIndex)),
          completed: block.completed === true,
        };
      }
      days[date] = { date, blocks };
    }
  }
  const timezones = Array.isArray(obj.timezones)
    ? obj.timezones.filter((zone): zone is string => typeof zone === 'string' && zone.length <= 80).slice(0, 6)
    : [];
  return {
    days,
    timezones: timezones.length > 0 ? timezones : [...DEFAULT_DAYLINE_STATE.timezones],
    weatherLocation: typeof obj.weatherLocation === 'string' ? obj.weatherLocation.slice(0, 80) : '',
  };
}

export function readDaylineState(): DaylineState {
  try {
    const raw = localStorage.getItem(DAYLINE_STORAGE_KEY);
    return raw ? sanitizeDaylineState(JSON.parse(raw)) : createDaylineState();
  } catch {
    return createDaylineState();
  }
}

export function saveDaylineState(state: DaylineState): void {
  try {
    localStorage.setItem(DAYLINE_STORAGE_KEY, JSON.stringify(state));
  } catch {
    /* Ignore storage quota errors; the app remains usable for this session. */
  }
}

export function readStoredDaylineStateForBackup(): DaylineState | undefined {
  try {
    const raw = localStorage.getItem(DAYLINE_STORAGE_KEY);
    return raw ? sanitizeDaylineState(JSON.parse(raw)) : undefined;
  } catch {
    return undefined;
  }
}
