import { beforeEach, describe, expect, it } from 'vitest';
import {
  clearStashItems,
  closeStashShelf,
  classifyStashInput,
  convertStashToMusicQueueItem,
  getStashState,
  openStashShelf,
  stashItem,
} from '../src/data/stash';

describe('stash shelf', () => {
  beforeEach(() => {
    localStorage.clear();
    clearStashItems();
    closeStashShelf();
  });

  it('classifies supported drop content', () => {
    expect(classifyStashInput('#ff6b4a').kind).toBe('color');
    expect(classifyStashInput('https://example.com').kind).toBe('url');
    expect(classifyStashInput('https://youtu.be/dQw4w9WgXcQ').kind).toBe('youtube');
    expect(classifyStashInput('const answer = 42;\nconsole.log(answer);').kind).toBe('code');
  });

  it('opens an empty shelf without creating a fake card', () => {
    openStashShelf();

    expect(getStashState().isOpen).toBe(true);
    expect(getStashState().items).toHaveLength(0);
  });

  it('builds a valid Music track from a stashed YouTube link', () => {
    const item = stashItem({ content: 'https://youtu.be/dQw4w9WgXcQ', openShelf: false });
    expect(item).not.toBeNull();

    const track = convertStashToMusicQueueItem(item!);
    expect(track).toMatchObject({
      id: 'dQw4w9WgXcQ',
      title: 'YouTube video dQw4w9WgXcQ',
      channelTitle: 'YouTube',
      durationSeconds: 0,
    });
    expect(track?.thumbnail).toContain('dQw4w9WgXcQ');
  });
});
