/**
 * Synthesizes a low-frequency, rhythmic heartbeat ambient sound effect
 * using the browser Web Audio API to reinforce the 'alive' dialectic chamber aesthetic.
 */

type AudioStateListener = (state: {
  isEnabled: boolean;
  isPlaying: boolean;
  volume: number;
  bpm: number;
}) => void;

class HeartbeatAudioEngine {
  private audioCtx: AudioContext | null = null;
  private masterGain: GainNode | null = null;
  private timer: number | null = null;
  private isEnabled: boolean = false;
  private isPlaying: boolean = false;
  private volume: number = 0.35;
  private bpm: number = 74;
  private listeners: Set<AudioStateListener> = new Set();

  constructor() {
    // Load persisted state from localStorage
    try {
      const savedEnabled = localStorage.getItem('synthexis_ambient_audio_enabled');
      if (savedEnabled !== null) {
        this.isEnabled = savedEnabled === 'true';
      }
      const savedVolume = localStorage.getItem('synthexis_ambient_audio_volume');
      if (savedVolume !== null) {
        const parsedVol = parseFloat(savedVolume);
        if (!isNaN(parsedVol) && parsedVol >= 0 && parsedVol <= 1) {
          this.volume = parsedVol;
        }
      }
    } catch {
      // ignore storage error
    }
  }

  private initAudioContext(): boolean {
    if (this.audioCtx) {
      if (this.audioCtx.state === 'suspended') {
        this.audioCtx.resume().catch(() => {});
      }
      return true;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (!AudioCtxClass) return false;

      this.audioCtx = new AudioCtxClass();
      this.masterGain = this.audioCtx.createGain();
      this.masterGain.gain.setValueAtTime(this.volume, this.audioCtx.currentTime);
      this.masterGain.connect(this.audioCtx.destination);
      return true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
      return false;
    }
  }

  public subscribe(listener: AudioStateListener): () => void {
    this.listeners.add(listener);
    listener(this.getState());
    return () => {
      this.listeners.delete(listener);
    };
  }

  private notify() {
    const state = this.getState();
    this.listeners.forEach((l) => l(state));
  }

  public getState() {
    return {
      isEnabled: this.isEnabled,
      isPlaying: this.isPlaying,
      volume: this.volume,
      bpm: this.bpm,
    };
  }

  public toggle(): boolean {
    this.isEnabled = !this.isEnabled;
    try {
      localStorage.setItem('synthexis_ambient_audio_enabled', String(this.isEnabled));
    } catch {}

    if (this.isEnabled) {
      this.initAudioContext();
      // Play a gentle single pulse preview when user enables it
      this.triggerSinglePulse();
    } else {
      this.stop();
    }
    this.notify();
    return this.isEnabled;
  }

  public setEnabled(enabled: boolean) {
    if (this.isEnabled === enabled) return;
    this.isEnabled = enabled;
    try {
      localStorage.setItem('synthexis_ambient_audio_enabled', String(enabled));
    } catch {}
    if (!enabled) {
      this.stop();
    } else {
      this.initAudioContext();
    }
    this.notify();
  }

  public setVolume(vol: number) {
    const clamped = Math.max(0, Math.min(1, vol));
    this.volume = clamped;
    try {
      localStorage.setItem('synthexis_ambient_audio_volume', String(clamped));
    } catch {}

    if (this.masterGain && this.audioCtx) {
      this.masterGain.gain.setTargetAtTime(clamped, this.audioCtx.currentTime, 0.05);
    }
    this.notify();
  }

  public setBpm(bpm: number) {
    if (bpm <= 0) return;
    this.bpm = bpm;
    if (this.isPlaying) {
      // Reschedule interval
      this.restartInterval();
    }
  }

  /**
   * Synthesizes a low-frequency, warm double-thump (lub-dub)
   */
  public triggerSinglePulse() {
    if (!this.initAudioContext() || !this.audioCtx || !this.masterGain) return;

    const ctx = this.audioCtx;
    const now = ctx.currentTime;

    // --- First Pulse: Lub (Deeper & slightly longer) ---
    const osc1 = ctx.createOscillator();
    const gain1 = ctx.createGain();
    const filter1 = ctx.createBiquadFilter();

    filter1.type = 'lowpass';
    filter1.frequency.setValueAtTime(140, now);
    filter1.Q.setValueAtTime(1.8, now);

    osc1.type = 'sine';
    // Frequency drops from 54Hz to 36Hz for sub-bass punch
    osc1.frequency.setValueAtTime(54, now);
    osc1.frequency.exponentialRampToValueAtTime(36, now + 0.16);

    gain1.gain.setValueAtTime(0.0001, now);
    gain1.gain.linearRampToValueAtTime(0.85, now + 0.025);
    gain1.gain.exponentialRampToValueAtTime(0.0001, now + 0.18);

    osc1.connect(filter1);
    filter1.connect(gain1);
    gain1.connect(this.masterGain);

    osc1.start(now);
    osc1.stop(now + 0.2);

    // --- Second Pulse: Dub (~140ms later, slightly punchier & higher) ---
    const t2 = now + 0.14;
    const osc2 = ctx.createOscillator();
    const gain2 = ctx.createGain();
    const filter2 = ctx.createBiquadFilter();

    filter2.type = 'lowpass';
    filter2.frequency.setValueAtTime(160, t2);
    filter2.Q.setValueAtTime(1.5, t2);

    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(64, t2);
    osc2.frequency.exponentialRampToValueAtTime(42, t2 + 0.13);

    gain2.gain.setValueAtTime(0.0001, t2);
    gain2.gain.linearRampToValueAtTime(0.65, t2 + 0.02);
    gain2.gain.exponentialRampToValueAtTime(0.0001, t2 + 0.15);

    osc2.connect(filter2);
    filter2.connect(gain2);
    gain2.connect(this.masterGain);

    osc2.start(t2);
    osc2.stop(t2 + 0.18);
  }

  public start(bpm?: number) {
    if (bpm) this.bpm = bpm;
    if (!this.isEnabled) return;

    if (!this.initAudioContext()) return;

    this.isPlaying = true;
    this.notify();

    // Trigger immediately
    this.triggerSinglePulse();

    this.restartInterval();
  }

  private restartInterval() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }

    const intervalMs = Math.max(400, (60 / this.bpm) * 1000);
    this.timer = window.setInterval(() => {
      if (this.isPlaying && this.isEnabled) {
        this.triggerSinglePulse();
      }
    }, intervalMs);
  }

  public stop() {
    if (this.timer) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    this.isPlaying = false;
    this.notify();
  }
}

// Singleton instance
export const audioHeartbeat = new HeartbeatAudioEngine();
