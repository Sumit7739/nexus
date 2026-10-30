import { beforeEach, describe, expect, it } from 'vitest';
import {
  getDaylineDate,
  readDaylineState,
  sanitizeDaylineState,
  saveDaylineState,
} from '../src/data/dayline';

describe('dayline persistence', () => {
  beforeEach(() => localStorage.clear());

  it('uses the local calendar date', () => {
    expect(getDaylineDate(new Date(2026, 9, 31, 23, 45))).toBe('2026-10-31');
  });

  it('round-trips planned blocks and settings', () => {
    saveDaylineState({
      days: {
        '2026-10-31': {
          date: '2026-10-31',
          blocks: {
            '09:00': {
              id: 'block',
              task: 'Ship the feature',
              sourceNoteId: 'note-1',
              sourceLineIndex: 2,
              completed: false,
            },
          },
        },
      },
      timezones: ['UTC', 'Asia/Kolkata'],
      weatherLocation: 'Pune',
    });

    expect(readDaylineState()).toMatchObject({
      timezones: ['UTC', 'Asia/Kolkata'],
      weatherLocation: 'Pune',
      days: { '2026-10-31': { blocks: { '09:00': { task: 'Ship the feature' } } } },
    });
  });

  it('drops malformed blocks during sanitization', () => {
    const state = sanitizeDaylineState({
      days: { '2026-10-31': { blocks: { 'bad': { task: 'missing source' } } } },
      timezones: [],
    });
    expect(state.days['2026-10-31'].blocks).toEqual({});
    expect(state.timezones).toEqual(['UTC']);
  });
});
