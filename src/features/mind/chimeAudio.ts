"use client";

/**
 * Generates a soft, brief Web Audio chime on completion without external audio
 * assets or network requests. Fails silently when AudioContext is unavailable.
 */
export function playSoftChime(): void {
  if (typeof window === "undefined") return;

  const AudioCtx =
    window.AudioContext ??
    (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;

  try {
    const ctx = new AudioCtx();
    const now = ctx.currentTime;

    const gain = ctx.createGain();
    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.08, now + 0.03);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 1.5);
    gain.connect(ctx.destination);

    // Gentle C5 + soft octave overtone for a calm bell timbre.
    const fundamental = ctx.createOscillator();
    fundamental.type = "sine";
    fundamental.frequency.setValueAtTime(523.25, now);
    fundamental.connect(gain);

    const overtoneGain = ctx.createGain();
    overtoneGain.gain.setValueAtTime(0.25, now);
    overtoneGain.connect(gain);

    const overtone = ctx.createOscillator();
    overtone.type = "sine";
    overtone.frequency.setValueAtTime(1046.5, now);
    overtone.connect(overtoneGain);

    fundamental.start(now);
    overtone.start(now);
    fundamental.stop(now + 1.55);
    overtone.stop(now + 1.55);

    fundamental.onended = () => {
      void ctx.close().catch(() => {});
    };
  } catch {
    // Ignore audio context restrictions (e.g. autoplay policy or unsupported test env).
  }
}
