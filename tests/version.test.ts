import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  CHANGELOG_RELEASES,
  CURRENT_RELEASE,
  NEXUS_VERSION,
  NEXUS_VERSION_TAG,
} from '../src/data/version';

describe('centralized version & changelog consistency', () => {
  it('keeps NEXUS_VERSION, NEXUS_VERSION_TAG, and CURRENT_RELEASE in sync', () => {
    expect(NEXUS_VERSION).toMatch(/^\d+\.\d+\.\d+$/);
    expect(NEXUS_VERSION_TAG).toBe(`v${NEXUS_VERSION}`);
    expect(CHANGELOG_RELEASES.length).toBeGreaterThanOrEqual(5);
    expect(CURRENT_RELEASE.version).toBe(NEXUS_VERSION);
    expect(CURRENT_RELEASE.groups.length).toBeGreaterThan(0);
  });

  it('keeps package.json, public/manifest.json, and CHANGELOG.md synced with NEXUS_VERSION', () => {
    const pkgJson = JSON.parse(readFileSync(resolve(process.cwd(), 'package.json'), 'utf8')) as {
      version: string;
    };
    const manifestJson = JSON.parse(
      readFileSync(resolve(process.cwd(), 'public/manifest.json'), 'utf8')
    ) as { version: string };
    const changelogMd = readFileSync(resolve(process.cwd(), 'CHANGELOG.md'), 'utf8');

    expect(pkgJson.version).toBe(NEXUS_VERSION);
    expect(manifestJson.version).toBe(NEXUS_VERSION);
    expect(changelogMd).toContain(`## [${NEXUS_VERSION}]`);
  });
});
