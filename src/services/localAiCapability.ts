export type LocalAiCapability =
  | { status: 'available'; message: string }
  | { status: 'unsupported'; message: string }
  | { status: 'unavailable'; message: string };

type ProbeDevice = { destroy?: () => void };
type ProbeAdapter = { requestDevice: () => Promise<ProbeDevice> };
export type LocalAiProbeEnvironment = {
  isSecureContext?: boolean;
  navigator?: {
    gpu?: {
      requestAdapter: () => Promise<ProbeAdapter | null>;
    };
  };
};

/**
 * Checks whether this page can initialize a WebGPU device.
 * This does not download a model or guarantee that a particular model fits.
 * The environment argument keeps capability detection deterministic in tests.
 */
export async function detectLocalAiCapability(
  environment?: LocalAiProbeEnvironment,
): Promise<LocalAiCapability> {
  const env = environment ?? (globalThis as unknown as LocalAiProbeEnvironment);

  if (env.isSecureContext === false) {
    return {
      status: 'unsupported',
      message: 'WebGPU requires a secure context. Open Breezy over HTTPS to check local GPU support.',
    };
  }

  const gpu = env.navigator?.gpu;
  if (!gpu) {
    return {
      status: 'unsupported',
      message: 'This browser does not expose WebGPU. Breezy will continue to work without local GPU inference.',
    };
  }

  let device: ProbeDevice | undefined;
  try {
    const adapter = await gpu.requestAdapter();
    if (!adapter) {
      return {
        status: 'unavailable',
        message: 'WebGPU is present, but this device did not provide a usable GPU adapter.',
      };
    }

    device = await adapter.requestDevice();
    return {
      status: 'available',
      message: 'A WebGPU device initialized. A compatible local model and enough memory are still required.',
    };
  } catch {
    return {
      status: 'unavailable',
      message: 'WebGPU could not initialize on this device. Update the browser or graphics drivers, or continue without local GPU inference.',
    };
  } finally {
    device?.destroy?.();
  }
}
