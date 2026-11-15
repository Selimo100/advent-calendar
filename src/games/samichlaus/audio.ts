/**
 * Optional sound. Off by default and only ever created after the player
 * explicitly switches it on — there is no automatic music and the game is
 * fully playable without audio. Tones are synthesised, so no files are loaded.
 */

export type Sound = 'jump' | 'land' | 'present' | 'checkpoint' | 'fall' | 'victory';

const TONES: Record<Sound, { freq: number; to: number; duration: number; type: OscillatorType; gain: number }> = {
  jump: { freq: 420, to: 700, duration: 0.12, type: 'triangle', gain: 0.06 },
  land: { freq: 220, to: 140, duration: 0.09, type: 'sine', gain: 0.05 },
  present: { freq: 780, to: 1180, duration: 0.16, type: 'triangle', gain: 0.07 },
  checkpoint: { freq: 520, to: 880, duration: 0.3, type: 'sine', gain: 0.07 },
  fall: { freq: 300, to: 110, duration: 0.26, type: 'sine', gain: 0.06 },
  victory: { freq: 523, to: 1046, duration: 0.6, type: 'triangle', gain: 0.08 },
};

export interface SoundPlayer {
  play(sound: Sound): void;
  destroy(): void;
}

/** Creates a player. Call only in response to a user action. */
export function createSoundPlayer(): SoundPlayer {
  let context: AudioContext | null = null;
  try {
    context = new AudioContext();
  } catch {
    context = null;
  }

  return {
    play(sound) {
      if (!context) return;
      if (context.state === 'suspended') void context.resume();
      const tone = TONES[sound];
      const now = context.currentTime;
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = tone.type;
      oscillator.frequency.setValueAtTime(tone.freq, now);
      oscillator.frequency.exponentialRampToValueAtTime(tone.to, now + tone.duration);
      gain.gain.setValueAtTime(tone.gain, now);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + tone.duration);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(now);
      oscillator.stop(now + tone.duration + 0.02);
    },
    destroy() {
      void context?.close();
      context = null;
    },
  };
}
