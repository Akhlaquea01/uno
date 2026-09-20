const STORAGE_KEY = 'uno:sound-enabled';

let audioCtx: AudioContext | null = null;

/** Lazily creates (and resumes) a shared AudioContext. Browsers block audio
 * until a user gesture, which is always true here (draw/UNO are clicks). */
function getAudioContext(): AudioContext | null {
  if (typeof window === 'undefined') return null;
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!Ctor) return null;
  if (!audioCtx) audioCtx = new Ctor();
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => undefined);
  return audioCtx;
}

export function isSoundEnabled(): boolean {
  try {
    return localStorage.getItem(STORAGE_KEY) !== 'off';
  } catch {
    return true;
  }
}

export function setSoundEnabled(enabled: boolean): void {
  try {
    localStorage.setItem(STORAGE_KEY, enabled ? 'on' : 'off');
  } catch {
    // localStorage unavailable — setting just won't persist.
  }
}

/** A short synthesized pitch sweep. No external audio files: everything here
 * is generated with the Web Audio API, so there's nothing to license,
 * download, or ship as a binary asset. */
function playSweep(startFreq: number, endFreq: number, duration: number, type: OscillatorType, gain: number) {
  const ctx = getAudioContext();
  if (!ctx) return;
  const osc = ctx.createOscillator();
  const gainNode = ctx.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(startFreq, ctx.currentTime);
  osc.frequency.exponentialRampToValueAtTime(Math.max(endFreq, 1), ctx.currentTime + duration);
  gainNode.gain.setValueAtTime(gain, ctx.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + duration);
  osc.connect(gainNode).connect(ctx.destination);
  osc.start();
  osc.stop(ctx.currentTime + duration);
}

/** Quick descending flip/shuffle sound for drawing a card. */
export function playDrawSound(): void {
  if (!isSoundEnabled()) return;
  playSweep(420, 150, 0.18, 'triangle', 0.09);
}

/** Soft tap for a card landing on the discard pile. */
export function playCardSound(): void {
  if (!isSoundEnabled()) return;
  playSweep(600, 300, 0.12, 'square', 0.05);
}

/** "UNO!" — spoken via the browser's built-in speech synthesis (not a
 * recorded voice line), layered over a bright synthesized chime so there's
 * still an audible cue on browsers without speech synthesis support. */
export function playUnoCall(): void {
  if (!isSoundEnabled()) return;
  playSweep(500, 950, 0.22, 'sawtooth', 0.07);

  if (typeof window === 'undefined' || !window.speechSynthesis) return;
  try {
    const utterance = new SpeechSynthesisUtterance('UNO!');
    utterance.rate = 1.15;
    utterance.pitch = 1.3;
    utterance.volume = 1;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
  } catch {
    // Speech synthesis unavailable — the chime above already played.
  }
}
