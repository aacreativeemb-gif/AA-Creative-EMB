// High-quality Web Audio API Synthesizer for 1-Second Ding Tone & Chimes
// Zero external file dependencies - 100% reliable in all modern browsers

class SoundController {
  private audioCtx: AudioContext | null = null;
  public isAudioMuted = false;
  private ringTimer: number | null = null;

  private getAudioContext(): AudioContext | null {
    if (typeof window === 'undefined') return null;
    if (!this.audioCtx) {
      const AudioCtxClass = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtxClass) {
        this.audioCtx = new AudioCtxClass();
      }
    }
    if (this.audioCtx && this.audioCtx.state === 'suspended') {
      this.audioCtx.resume().catch(() => {});
    }
    return this.audioCtx;
  }

  // 1-Second Crystal Clear "Ding" Bell Tone
  playDing(type: 'visitor' | 'message' | 'ticket' = 'visitor') {
    if (this.isAudioMuted) return;

    try {
      const ctx = this.getAudioContext();
      if (!ctx) return;

      const now = ctx.currentTime;
      const duration = 1.0; // 1 second sound tone

      // Master Gain
      const masterGain = ctx.createGain();
      masterGain.connect(ctx.destination);
      masterGain.gain.setValueAtTime(0.001, now);
      masterGain.gain.exponentialRampToValueAtTime(0.35, now + 0.02);
      masterGain.gain.exponentialRampToValueAtTime(0.0001, now + duration);

      // Primary Oscillator (Fundamental Frequency)
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const osc3 = ctx.createOscillator();

      // Frequencies for a bright, pleasant notification bell chime
      if (type === 'visitor') {
        // Bright two-tone ascending chime (High C & G bell)
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(880, now); // A5
        osc1.frequency.exponentialRampToValueAtTime(1046.5, now + 0.12); // C6

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1760, now); // A6 overtone
        osc2.frequency.exponentialRampToValueAtTime(2093, now + 0.12);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(523.25, now); // C5 body
      } else if (type === 'message') {
        // Friendly gentle message ding
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(659.25, now); // E5
        osc1.frequency.setValueAtTime(987.77, now + 0.08); // B5

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1318.5, now);
        osc2.frequency.setValueAtTime(1975.5, now + 0.08);

        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(440, now);
      } else {
        // Urgent ticket alert
        osc1.type = 'sine';
        osc1.frequency.setValueAtTime(783.99, now); // G5
        osc1.frequency.setValueAtTime(1174.66, now + 0.09); // D6

        osc2.type = 'triangle';
        osc2.frequency.setValueAtTime(1567.98, now);
        osc3.type = 'sine';
        osc3.frequency.setValueAtTime(392.00, now);
      }

      osc1.connect(masterGain);
      osc2.connect(masterGain);
      osc3.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc3.start(now);

      osc1.stop(now + duration);
      osc2.stop(now + duration);
      osc3.stop(now + duration);
    } catch (err) {
      console.warn('Audio tone playback bypassed:', err);
    }
  }

  // Rings the ding repeatedly for N seconds — used when a customer sends a
  // chat message and the admin dashboard is live, so the agent has time to
  // notice and get ready before replying.
  ringBell(type: 'visitor' | 'message' | 'ticket' = 'message', durationSeconds = 10) {
    if (this.isAudioMuted) return;
    if (this.ringTimer) {
      clearInterval(this.ringTimer);
      this.ringTimer = null;
    }
    this.playDing(type);
    let elapsed = 0;
    const stepMs = 1100; // a little over 1s so each ding finishes before the next starts
    this.ringTimer = window.setInterval(() => {
      elapsed += stepMs;
      if (elapsed >= durationSeconds * 1000) {
        if (this.ringTimer) clearInterval(this.ringTimer);
        this.ringTimer = null;
        return;
      }
      this.playDing(type);
    }, stepMs);
  }

  stopRinging() {
    if (this.ringTimer) {
      clearInterval(this.ringTimer);
      this.ringTimer = null;
    }
  }
}

export const soundFx = new SoundController();
