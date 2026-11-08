import { useState, useEffect, useRef } from 'react';

export interface PerformanceStats {
  fps: number;
  refreshRate: number;
  isSynced: boolean;
}

/**
 * Hook to estimate display refresh rate and live FPS in real-time
 * using requestAnimationFrame timestamps.
 */
export function useDisplayRefreshRate(): PerformanceStats {
  const [stats, setStats] = useState<PerformanceStats>({
    fps: 60,
    refreshRate: 60,
    isSynced: true,
  });

  const frameTimesRef = useRef<number[]>([]);
  const lastTimeRef = useRef<number>(performance.now());
  const rafIdRef = useRef<number | null>(null);

  useEffect(() => {
    let active = true;
    let detectedMaxFps = 60;

    const measure = (now: number) => {
      if (!active) return;

      const delta = now - lastTimeRef.current;
      lastTimeRef.current = now;

      if (delta > 0 && delta < 200) {
        frameTimesRef.current.push(delta);
        if (frameTimesRef.current.length > 30) {
          frameTimesRef.current.shift();
        }
      }

      rafIdRef.current = requestAnimationFrame(measure);
    };

    rafIdRef.current = requestAnimationFrame(measure);

    // Periodic evaluation every 1000ms
    const interval = setInterval(() => {
      const times = frameTimesRef.current;
      if (times.length > 5) {
        const avgDelta = times.reduce((a, b) => a + b, 0) / times.length;
        const currentFps = Math.round(1000 / avgDelta);

        // Detect target refresh rate (common standard monitor rates: 60, 75, 90, 120, 144, 165, 240)
        const commonRates = [60, 75, 90, 120, 144, 165, 240];
        let matchedRate = 60;
        for (const rate of commonRates) {
          if (currentFps >= rate - 6) {
            matchedRate = rate;
          }
        }

        if (matchedRate > detectedMaxFps) {
          detectedMaxFps = matchedRate;
        }

        const isSynced = Math.abs(currentFps - detectedMaxFps) <= 6;

        setStats({
          fps: Math.min(240, Math.max(1, currentFps)),
          refreshRate: detectedMaxFps,
          isSynced,
        });
      }
    }, 1000);

    return () => {
      active = false;
      if (rafIdRef.current) cancelAnimationFrame(rafIdRef.current);
      clearInterval(interval);
    };
  }, []);

  return stats;
}
