// All sounds are synthesized with the Web Audio API — ~0 KB of assets.
let ac: AudioContext | null = null;
let enabled = true;

export const setSoundEnabled = (v: boolean) => { enabled = v; };

/** When running inside the Expo WebView wrapper, ask the native side for a haptic tap. */
function haptic(kind: 'tick' | 'soft' | 'success') {
  (window as unknown as { ReactNativeWebView?: { postMessage(m: string): void } }).ReactNativeWebView?.postMessage(JSON.stringify({ haptic: kind }));
}

function ctx(): AudioContext {
  const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
  ac = ac ?? new Ctor();
  if (ac.state === 'suspended') void ac.resume();
  return ac;
}

interface Blip { type?: OscillatorType; f0: number; f1?: number; t0?: number; dur?: number; vol?: number }

function blip({ type = 'sine', f0, f1 = f0, t0 = 0, dur = 0.1, vol = 0.3 }: Blip) {
  const a = ctx(), o = a.createOscillator(), g = a.createGain(), t = a.currentTime + t0;
  o.type = type;
  o.frequency.setValueAtTime(f0, t);
  o.frequency.exponentialRampToValueAtTime(f1, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  o.connect(g); g.connect(a.destination);
  o.start(t); o.stop(t + dur + 0.02);
}

/** The satisfying tick: punch + click edge + sparkle rise, ~0.3 s. */
export function tick(scale = 1) {
  haptic('tick');
  if (!enabled) return;
  blip({ f0: 1200, f1: 800, dur: 0.12, vol: 0.35 * scale });                       // punch
  blip({ type: 'triangle', f0: 2400, f1: 2000, dur: 0.05, vol: 0.18 * scale });    // click edge
  blip({ f0: 1800, f1: 3200, t0: 0.06, dur: 0.22, vol: 0.14 * scale });            // sparkle rise
}
export function softTick() { haptic('soft'); if (enabled) blip({ f0: 1800, f1: 1700, dur: 0.05, vol: 0.1 }); }
export function fanfare() {
  haptic('success');
  if (!enabled) return;
  tick(1);
  [523.25, 659.25, 783.99, 1046.5].forEach((f, i) => blip({ type: 'triangle', f0: f, t0: 0.12 + i * 0.07, dur: 0.7, vol: 0.16 }));
  blip({ f0: 2093, t0: 0.4, dur: 0.6, vol: 0.07 });
}
export function chime() {
  if (!enabled) return;
  blip({ f0: 988, dur: 0.2, vol: 0.2 });
  blip({ f0: 1318, t0: 0.2, dur: 0.35, vol: 0.2 });
}
