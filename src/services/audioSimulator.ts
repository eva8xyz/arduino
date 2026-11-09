/**
 * Web Audio API synthesizer for simulating DFPlayer Mini sound playback in the browser.
 */

class AudioSimulator {
  private ctx: AudioContext | null = null;
  private currentOsc: OscillatorNode | null = null;
  private currentGain: GainNode | null = null;
  private isMuted = false;

  private getAudioContext(): AudioContext {
    if (!this.ctx) {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      this.ctx = new AudioCtx();
    }
    if (this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    return this.ctx;
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  /**
   * Play a simulated musical track based on track number (1..12 or higher)
   */
  playTrack(trackNumber: number, volume = 20): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      this.stop();

      // Frequencies corresponding to pentatonic scale across octaves
      const baseNotes = [
        261.63, // C4 (Track 1)
        293.66, // D4 (Track 2)
        329.63, // E4 (Track 3)
        349.23, // F4 (Track 4)
        392.00, // G4 (Track 5)
        440.00, // A4 (Track 6)
        493.88, // B4 (Track 7)
        523.25, // C5 (Track 8)
        587.33, // D5 (Track 9)
        659.25, // E5 (Track 10)
        698.46, // F5 (Track 11)
        783.99, // G5 (Track 12)
      ];

      const noteIndex = ((trackNumber - 1) % baseNotes.length + baseNotes.length) % baseNotes.length;
      const freq = baseNotes[noteIndex];
      const now = ctx.currentTime;

      // Master gain scaled by DFPlayer 0..30 volume
      const masterGain = ctx.createGain();
      const gainLevel = Math.max(0.01, (volume / 30) * 0.25);
      masterGain.gain.setValueAtTime(gainLevel, now);
      masterGain.connect(ctx.destination);

      // Create a nice warm sound: fundamental + octave overtone
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const noteGain1 = ctx.createGain();
      const noteGain2 = ctx.createGain();

      osc1.type = 'triangle';
      osc1.frequency.setValueAtTime(freq, now);

      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(freq * 2, now);

      // Envelope ADSR
      noteGain1.gain.setValueAtTime(0, now);
      noteGain1.gain.linearRampToValueAtTime(1.0, now + 0.04);
      noteGain1.gain.exponentialRampToValueAtTime(0.001, now + 1.2);

      noteGain2.gain.setValueAtTime(0, now);
      noteGain2.gain.linearRampToValueAtTime(0.4, now + 0.05);
      noteGain2.gain.exponentialRampToValueAtTime(0.001, now + 0.9);

      osc1.connect(noteGain1);
      noteGain1.connect(masterGain);

      osc2.connect(noteGain2);
      noteGain2.connect(masterGain);

      osc1.start(now);
      osc2.start(now);
      osc1.stop(now + 1.3);
      osc2.stop(now + 1.0);
    } catch {
      // Audio playback failed or not allowed before gesture
    }
  }

  /**
   * Short tactile click feedback for capacitive electrode touch
   */
  playTouchClick(electrodeIndex: number): void {
    if (this.isMuted) return;
    try {
      const ctx = this.getAudioContext();
      const now = ctx.currentTime;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      const freq = 400 + electrodeIndex * 80;
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now);
      osc.frequency.exponentialRampToValueAtTime(freq * 0.5, now + 0.08);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.08);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now);
      osc.stop(now + 0.09);
    } catch {
      // ignore
    }
  }

  stop(): void {
    if (this.currentOsc) {
      try {
        this.currentOsc.stop();
        this.currentOsc.disconnect();
      } catch {
        // ignore
      }
      this.currentOsc = null;
    }
  }
}

export const audioSimulator = new AudioSimulator();
