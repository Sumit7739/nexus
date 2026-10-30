import { beforeEach, describe, expect, it } from 'vitest';
import { generateWidgetWithPuter } from '../src/data/puter-ai';

describe('Puter widget crafter', () => {
  beforeEach(() => {
    delete window.puter;
  });

  it('converts a Puter JSON response into widget source', async () => {
    window.puter = {
      ai: {
        chat: async () => ({
          content: '```json\n{"name":"Clock","html":"<strong>Now</strong>","css":"strong{}","js":"console.log(1)","json":"{}","width":300,"height":120}\n```',
        }),
      },
    };

    const generated = await generateWidgetWithPuter('A clock');
    expect(generated).toMatchObject({
      name: 'Clock',
      source: { html: '<strong>Now</strong>', json: '{}', },
      width: 300,
      height: 120,
    });
    expect(generated.source.css).toContain('body[data-theme="dark"]');
    expect(generated.source.js).toContain('nexus:theme');
  });

  it('reports unavailable Puter AI explicitly', async () => {
    await expect(generateWidgetWithPuter('A clock')).rejects.toThrow(/Puter AI.*unavailable/i);
  });
});
