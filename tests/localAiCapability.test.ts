import { describe, expect, it, vi } from 'vitest';
import { detectLocalAiCapability } from '../src/services/localAiCapability';

describe('local AI WebGPU capability probe', () => {
  it('requires a secure context', async () => {
    const result = await detectLocalAiCapability({ isSecureContext: false, navigator: { gpu: { requestAdapter: vi.fn() } } });
    expect(result.status).toBe('unsupported');
    expect(result.message).toContain('HTTPS');
  });

  it('reports browsers without WebGPU as unsupported', async () => {
    const result = await detectLocalAiCapability({ isSecureContext: true, navigator: {} });
    expect(result.status).toBe('unsupported');
    expect(result.message).toContain('does not expose WebGPU');
  });

  it('reports a missing GPU adapter as unavailable', async () => {
    const result = await detectLocalAiCapability({
      isSecureContext: true,
      navigator: { gpu: { requestAdapter: vi.fn().mockResolvedValue(null) } },
    });
    expect(result.status).toBe('unavailable');
  });

  it('creates and releases a device before reporting availability', async () => {
    const destroy = vi.fn();
    const requestDevice = vi.fn().mockResolvedValue({ destroy });
    const result = await detectLocalAiCapability({
      isSecureContext: true,
      navigator: { gpu: { requestAdapter: vi.fn().mockResolvedValue({ requestDevice }) } },
    });
    expect(result.status).toBe('available');
    expect(requestDevice).toHaveBeenCalledOnce();
    expect(destroy).toHaveBeenCalledOnce();
    expect(result.message).toContain('compatible local model');
  });

  it('reports adapter/device initialization errors without crashing settings', async () => {
    const result = await detectLocalAiCapability({
      isSecureContext: true,
      navigator: { gpu: { requestAdapter: vi.fn().mockRejectedValue(new Error('blocked')) } },
    });
    expect(result.status).toBe('unavailable');
  });
});
