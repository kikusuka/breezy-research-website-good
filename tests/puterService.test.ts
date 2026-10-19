import { beforeEach, describe, expect, it, vi } from 'vitest';
import { puterService } from '../src/services/puterService';

describe('Puter.js service', () => {
  beforeEach(() => {
    window.puter = undefined;
  });

  it('uses Puter’s live model catalog instead of assuming a model exists', async () => {
    window.puter = {
      ai: {
        listModels: vi.fn().mockResolvedValue([
          { id: 'model-live-1', provider: 'sample-provider', name: 'Live Model One' },
          { provider: 'missing-id' },
          { id: 'model-live-2' },
        ]),
      },
    };

    await expect(puterService.listModels()).resolves.toEqual([
      { id: 'model-live-1', provider: 'sample-provider', name: 'Live Model One' },
      { id: 'model-live-2', provider: undefined, name: undefined },
    ]);
  });

  it('streams text chunks from the selected model', async () => {
    async function* stream() {
      yield { type: 'text', text: 'Hello' };
      yield { type: 'text', text: ' Breezy' };
    }
    window.puter = {
      auth: { isSignedIn: () => true },
      ai: { chat: vi.fn().mockResolvedValue(stream()) },
    };
    const onText = vi.fn();

    await puterService.streamChat([{ role: 'user', content: 'Hello?' }], {
      model: 'model-live-1',
      onText,
    });

    expect(onText.mock.calls).toEqual([['Hello'], [' Breezy']]);
    expect(window.puter.ai.chat).toHaveBeenCalledWith(
      [{ role: 'user', content: 'Hello?' }],
      false,
      expect.objectContaining({ model: 'model-live-1', stream: true, normalize: true }),
    );
  });

  it('surfaces Puter streaming error chunks instead of treating them as success', async () => {
    async function* stream() {
      yield { type: 'text', text: 'partial' };
      yield { type: 'error', message: 'quota exceeded' };
    }
    window.puter = {
      auth: { isSignedIn: () => true },
      ai: { chat: vi.fn().mockResolvedValue(stream()) },
    };

    await expect(puterService.streamChat([{ role: 'user', content: 'Hello?' }], {
      model: 'model-live-1',
      onText: () => {},
    })).rejects.toThrow('quota exceeded');
  });
});
