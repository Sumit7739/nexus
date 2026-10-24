import { describe, expect, it } from 'vitest';
import {
  classifyOmniboxInput,
  getSearchEngine,
  isKnownFrameRestricted,
} from '../src/data/browser';

describe('Nexus Browser omnibox & engine helpers', () => {
  it('classifies URLs, bare domains, and localhost as url intent', () => {
    expect(classifyOmniboxInput('https://en.wikipedia.org/wiki/Bauhaus')).toEqual({
      kind: 'url',
      url: 'https://en.wikipedia.org/wiki/Bauhaus',
    });
    expect(classifyOmniboxInput('linear.app')).toEqual({
      kind: 'url',
      url: 'https://linear.app/',
    });
    expect(classifyOmniboxInput('localhost:3000/api')).toEqual({
      kind: 'url',
      url: 'http://localhost:3000/api',
    });
  });

  it('classifies natural-language queries, single words, and ?-prefixed strings as search intent', () => {
    expect(classifyOmniboxInput('how does webassembly work')).toEqual({
      kind: 'search',
      query: 'how does webassembly work',
    });
    expect(classifyOmniboxInput('bauhaus')).toEqual({
      kind: 'search',
      query: 'bauhaus',
    });
    expect(classifyOmniboxInput('?linear.app')).toEqual({
      kind: 'search',
      query: 'linear.app',
    });
    expect(classifyOmniboxInput('   ')).toBeNull();
  });

  it('builds encoded search URLs across browser engines and identifies frame-restricted hosts', () => {
    expect(getSearchEngine('google').buildUrl('rust async')).toBe(
      'https://www.google.com/search?q=rust%20async'
    );
    expect(getSearchEngine('duckduckgo').buildUrl('nexus workspace')).toBe(
      'https://duckduckgo.com/?q=nexus%20workspace'
    );
    expect(getSearchEngine('wikipedia').buildUrl('Bauhaus')).toBe(
      'https://en.wikipedia.org/w/index.php?search=Bauhaus'
    );

    expect(isKnownFrameRestricted('https://github.com/facebook/react')).toBe(true);
    expect(isKnownFrameRestricted('https://en.wikipedia.org/wiki/Main_Page')).toBe(false);
  });
});
