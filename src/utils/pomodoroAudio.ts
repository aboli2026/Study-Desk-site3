import { PomodoroSound } from '../types';

let audioCtx: AudioContext | null = null;

async function getReadyAudioContext(): Promise<AudioContext | null> {
  try {
    const AudioContextClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioContextClass) return null;
    if (!audioCtx) {
      audioCtx = new AudioContextClass();
    }
    if (audioCtx.state === 'suspended' || (audioCtx.state as string) === 'interrupted') {
      await audioCtx.resume();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Plays a minimal, soothing ambient tone using the Web Audio API.
 * High quality harmonic synthesis without requiring external audio assets.
 */
export async function playMinimalPomodoroSound(
  soundType: PomodoroSound = 'crystal',
  volume: number = 0.6
): Promise<void> {
  try {
    const ctx = await getReadyAudioContext();
    if (!ctx) return;

    const clampedVolume = Math.max(0.01, Math.min(1.0, volume));
    const now = ctx.currentTime;

    switch (soundType) {
      case 'crystal': {
        // Minimal Crystal Chime (C5, G5, C6) - Sparkling, soft and elegant
        const freqs = [523.25, 783.99, 1046.5];
        freqs.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.08);

          const startGain = clampedVolume * (0.35 / (idx + 1));
          gain.gain.setValueAtTime(0.0001, now + idx * 0.08);
          gain.gain.linearRampToValueAtTime(startGain, now + idx * 0.08 + 0.03);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.08 + 1.4);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.08);
          osc.stop(now + idx * 0.08 + 1.45);
        });
        break;
      }

      case 'zen': {
        // Gentle Zen Bell / Singing Bowl (432Hz deep soothing fundamental + warm harmonics)
        const harmonics = [432, 864, 1296];
        harmonics.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = idx === 0 ? 'sine' : 'triangle';
          osc.frequency.setValueAtTime(freq, now);

          const startGain = clampedVolume * (idx === 0 ? 0.4 : 0.15);
          gain.gain.setValueAtTime(0.0001, now);
          gain.gain.linearRampToValueAtTime(startGain, now + 0.04);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + 2.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now);
          osc.stop(now + 2.25);
        });
        break;
      }

      case 'marimba': {
        // Soft Wooden Marimba double chime (F5 -> A5)
        const notes = [698.46, 880.0];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.12);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.12);
          gain.gain.linearRampToValueAtTime(clampedVolume * 0.4, now + idx * 0.12 + 0.015);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.12 + 0.7);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.12);
          osc.stop(now + idx * 0.12 + 0.75);
        });
        break;
      }

      case 'bell':
      default: {
        // Classic Gentle Bell (A5 -> D6)
        const notes = [880, 1174.66];
        notes.forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const gain = ctx.createGain();

          osc.type = 'sine';
          osc.frequency.setValueAtTime(freq, now + idx * 0.15);

          gain.gain.setValueAtTime(0.0001, now + idx * 0.15);
          gain.gain.linearRampToValueAtTime(clampedVolume * 0.35, now + idx * 0.15 + 0.02);
          gain.gain.exponentialRampToValueAtTime(0.0001, now + idx * 0.15 + 1.2);

          osc.connect(gain);
          gain.connect(ctx.destination);

          osc.start(now + idx * 0.15);
          osc.stop(now + idx * 0.15 + 1.25);
        });
        break;
      }
    }
  } catch (err) {
    console.warn('Audio playback not supported or failed:', err);
  }
}

/**
 * Requests browser system notification permission.
 */
export async function requestBrowserNotificationPermission(): Promise<boolean> {
  if (!('Notification' in window)) return false;
  try {
    const permission = await Notification.requestPermission();
    return permission === 'granted';
  } catch {
    return false;
  }
}

/**
 * Sends a native browser system notification if permitted.
 */
export function sendBrowserNotification(title: string, body: string): void {
  if (!('Notification' in window)) return;
  if (Notification.permission !== 'granted') return;

  try {
    new Notification(title, {
      body,
      tag: 'pomodoro-timer-alert',
      icon: '/favicon.ico',
      badge: '/favicon.ico',
      requireInteraction: false,
    });
  } catch (e) {
    console.warn('Browser notification trigger failed:', e);
  }
}

/**
 * Plays a minimal, high-satisfaction tactile "pop + crystal chime" for completing tasks.
 * Designed with a subtle micro-tap (frequency sweep) followed by a 2-tone melodic harmonic
 * chord (E6 -> B6 -> E7 sparkle) that produces a rewarding dopamine feedback sound without any fatigue.
 */
export async function playMinimalDingSound(volume: number = 0.55): Promise<void> {
  try {
    const ctx = await getReadyAudioContext();
    if (!ctx) return;

    const clampedVolume = Math.max(0.01, Math.min(1.0, volume));
    const now = ctx.currentTime;

    // 1. Organic tactile "pop" click (frequency sweep 640Hz -> 1180Hz in 16ms)
    const popOsc = ctx.createOscillator();
    const popGain = ctx.createGain();
    popOsc.type = 'sine';
    popOsc.frequency.setValueAtTime(640, now);
    popOsc.frequency.exponentialRampToValueAtTime(1180, now + 0.016);
    popGain.gain.setValueAtTime(0.0001, now);
    popGain.gain.linearRampToValueAtTime(clampedVolume * 0.4, now + 0.004);
    popGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.035);
    popOsc.connect(popGain);
    popGain.connect(ctx.destination);
    popOsc.start(now);
    popOsc.stop(now + 0.04);

    // 2. High-satisfaction two-tone melodic chime:
    // E6 (1318.51Hz) followed by B6 (1975.53Hz) + subtle sparkle harmonic E7 (2637 Hz)
    const chimeNotes = [
      { freq: 1318.51, delay: 0.018, duration: 0.36, gain: 0.42 },
      { freq: 1975.53, delay: 0.075, duration: 0.55, gain: 0.52 },
      { freq: 2637.02, delay: 0.095, duration: 0.42, gain: 0.15 },
    ];

    chimeNotes.forEach((item) => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(item.freq, now + item.delay);

      const targetGain = clampedVolume * item.gain;
      gain.gain.setValueAtTime(0.0001, now + item.delay);
      gain.gain.linearRampToValueAtTime(targetGain, now + item.delay + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + item.delay + item.duration);

      osc.connect(gain);
      gain.connect(ctx.destination);

      osc.start(now + item.delay);
      osc.stop(now + item.delay + item.duration + 0.02);
    });
  } catch (e) {
    console.warn('Failed to play minimal ding sound:', e);
  }
}

// Alias for semantic clarity
export const playTaskCompleteSound = playMinimalDingSound;

/**
 * Plays a subtle, soft down-tone for un-checking / restoring a completed task to the active list.
 */
export async function playTaskUndoSound(volume: number = 0.35): Promise<void> {
  try {
    const ctx = await getReadyAudioContext();
    if (!ctx) return;

    const clampedVolume = Math.max(0.01, Math.min(1.0, volume));
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(1180, now);
    osc.frequency.exponentialRampToValueAtTime(580, now + 0.08);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(clampedVolume * 0.28, now + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.1);

    osc.connect(gain);
    gain.connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  } catch (e) {
    console.warn('Failed to play undo sound:', e);
  }
}

