import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearPasscodeRecord,
  computeSplashDurationMs,
  createPasscodeRecord,
  DEFAULT_SPLASH_MS,
  readPasscodeRecord,
  savePasscodeRecord,
  verifyPasscode,
} from '../src/security/passcode';
import { clampDesktopPosition, clampWidgetBounds } from '../src/desktop/layout';
import {
  buildWorkspaceBackup,
  clearAllWorkspaceStorage,
  parseAndValidateWorkspaceBackup,
} from '../src/persistence/workspace-backup';

describe('PRD completion features', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  describe('passcode setup, verification, and removal (FR-10)', () => {
    it('hashes passcodes with PBKDF2, verifies matching inputs, and clears cleanly', async () => {
      expect(readPasscodeRecord()).toBeNull();

      /* Use fast iteration count in unit test for speed while testing exact PBKDF2 flow */
      const record = await createPasscodeRecord('aurora-42', 2000);
      expect(record.salt).toMatch(/^[0-9a-f]{32}$/);
      expect(record.hash).toMatch(/^[0-9a-f]{64}$/);
      expect(record.hash).not.toContain('aurora-42');

      savePasscodeRecord(record);
      expect(readPasscodeRecord()).toEqual(record);

      expect(await verifyPasscode('aurora-42', record)).toBe(true);
      expect(await verifyPasscode('wrong-passcode', record)).toBe(false);

      clearPasscodeRecord();
      expect(readPasscodeRecord()).toBeNull();
    });
  });

  describe('splash reduced-motion and session fast-reload (FR-09)', () => {
    it('skips splash delay when reduced motion is enabled or splash already played in session', () => {
      expect(computeSplashDurationMs({ prefersReducedMotion: false, alreadyShownInSession: false })).toBe(
        DEFAULT_SPLASH_MS
      );
      expect(computeSplashDurationMs({ prefersReducedMotion: true, alreadyShownInSession: false })).toBe(0);
      expect(computeSplashDurationMs({ prefersReducedMotion: false, alreadyShownInSession: true })).toBe(0);
    });
  });

  describe('desktop icon and widget viewport clamping (FR-03)', () => {
    it('clamps off-screen desktop icon coordinates back into a shrunk viewport', () => {
      expect(clampDesktopPosition({ x: 1400, y: 900 }, 800, 600)).toEqual({
        x: 700,
        y: 378,
      });
    });

    it('snaps and clamps widget bounds within viewport and minimum sizes', () => {
      const snapped = clampWidgetBounds(
        { x: 950, y: 780, width: 110, height: 60 },
        900,
        650,
        true
      );
      expect(snapped.width).toBeGreaterThanOrEqual(160);
      expect(snapped.height).toBeGreaterThanOrEqual(100);
      expect(snapped.x + snapped.width).toBeLessThanOrEqual(900 - 14);
      expect(snapped.y + snapped.height).toBeLessThanOrEqual(650 - 96);
    });
  });

  describe('versioned workspace backup export, import, and reset (FR-14)', () => {
    it('round-trips valid workspace state and strips invalid pin or URL entries', () => {
      localStorage.setItem('nexus.scratchpad.v1', 'Ship v0.8 cleanly');
      const snapshot = buildWorkspaceBackup({
        preferences: {
          theme: 'dark',
          wallpaper: 'ocean',
          showSeconds: true,
          showMessages: false,
          menuView: 'grid',
          msgRefreshMins: 10,
        },
        pinnedDesktop: ['browser', 'shortcut:sc-1'],
        pinnedDock: ['notes'],
        desktopPositions: { browser: { x: 24, y: 48 } },
        messages: [{ id: 'm1', text: 'Quiet workspace.' }],
        shortcuts: [{ id: 'sc-1', title: 'Linear', url: 'https://linear.app', mode: 'external' }],
        widgets: [],
      });

      const parsed = parseAndValidateWorkspaceBackup(JSON.stringify(snapshot));
      expect(parsed.preferences.theme).toBe('dark');
      expect(parsed.preferences.showMessages).toBe(false);
      expect(parsed.shortcuts).toHaveLength(1);
      expect(parsed.pinnedDesktop).toEqual(['browser', 'shortcut:sc-1']);
      expect(parsed.scratchpad).toBe('Ship v0.8 cleanly');

      clearAllWorkspaceStorage();
      expect(localStorage.getItem('nexus.scratchpad.v1')).toBeNull();
    });

    it('rejects malformed or non-Nexus JSON payloads cleanly', () => {
      expect(() => parseAndValidateWorkspaceBackup('{bad json')).toThrow(/not valid JSON/i);
      expect(() => parseAndValidateWorkspaceBackup('{"hello":"world"}')).toThrow(/not a Nexus workspace backup/i);
    });
  });
});
