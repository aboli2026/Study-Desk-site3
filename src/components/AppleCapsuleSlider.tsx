import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Sun } from 'lucide-react';

interface AppleCapsuleSliderProps {
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (val: number) => void;
  onDragStateChange?: (isDragging: boolean) => void;
  color?: 'amber' | 'neutral' | 'indigo' | 'emerald';
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  showPercentInside?: boolean;
  unit?: string;
  className?: string;
}

export const AppleCapsuleSlider: React.FC<AppleCapsuleSliderProps> = ({
  value,
  min,
  max,
  step = 1,
  onChange,
  onDragStateChange,
  color = 'neutral',
  leftIcon,
  rightIcon,
  showPercentInside = true,
  unit = '٪',
  className = '',
}) => {
  const trackRef = useRef<HTMLDivElement>(null);
  const fillRef = useRef<HTMLDivElement>(null);
  const valueDisplayRef = useRef<HTMLSpanElement>(null);

  const [isDragging, setIsDragging] = useState(false);
  const [localValue, setLocalValue] = useState(value);

  const isDraggingRef = useRef(false);
  const rafIdRef = useRef<number | null>(null);

  // Sync internal state if prop changes externally and not dragging
  useEffect(() => {
    if (!isDraggingRef.current) {
      setLocalValue(value);
    }
  }, [value]);

  const clampedValue = Math.min(max, Math.max(min, localValue));
  const percentage = Math.min(100, Math.max(0, ((clampedValue - min) / (max - min)) * 100));

  // Compute color styles
  const colorStyles = {
    amber: {
      gradient: 'from-amber-400 via-amber-500 to-amber-500',
      activeText: 'text-amber-950',
      glow: 'shadow-[0_0_15px_rgba(245,158,11,0.25)]',
    },
    neutral: {
      gradient: 'from-neutral-700 via-neutral-800 to-neutral-900',
      activeText: 'text-white',
      glow: 'shadow-[0_0_15px_rgba(0,0,0,0.25)]',
    },
    indigo: {
      gradient: 'from-indigo-500 via-indigo-600 to-indigo-600',
      activeText: 'text-white',
      glow: 'shadow-[0_0_15px_rgba(99,102,241,0.25)]',
    },
    emerald: {
      gradient: 'from-emerald-400 via-emerald-500 to-emerald-600',
      activeText: 'text-white',
      glow: 'shadow-[0_0_15px_rgba(16,185,129,0.25)]',
    },
  }[color];

  // Calculate value from pointer X coordinate (fluid left-to-right physics inside the capsule)
  const calculateValueFromPointer = useCallback(
    (clientX: number): number => {
      if (!trackRef.current) return localValue;
      const rect = trackRef.current.getBoundingClientRect();
      const trackWidth = rect.width;
      if (trackWidth <= 0) return localValue;

      const offsetX = Math.max(0, Math.min(trackWidth, clientX - rect.left));
      const ratio = offsetX / trackWidth;
      const rawValue = min + ratio * (max - min);

      const effectiveStep = step > 0 ? step : 1;
      const stepped = Math.round(rawValue / effectiveStep) * effectiveStep;
      return Math.min(max, Math.max(min, stepped));
    },
    [min, max, step, localValue]
  );

  const updateVisualAndNotify = useCallback(
    (newVal: number) => {
      setLocalValue(newVal);

      // Fast direct DOM update to bypass React render latency during mouse drag
      if (fillRef.current) {
        const pct = Math.min(100, Math.max(0, ((newVal - min) / (max - min)) * 100));
        fillRef.current.style.width = `${pct}%`;
      }
      if (valueDisplayRef.current) {
        valueDisplayRef.current.textContent = `${newVal}${unit}`;
      }

      onChange(newVal);
    },
    [min, max, onChange, unit]
  );

  const handlePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    isDraggingRef.current = true;
    setIsDragging(true);
    onDragStateChange?.(true);

    const initialVal = calculateValueFromPointer(e.clientX);
    updateVisualAndNotify(initialVal);

    const onPointerMove = (moveEvent: PointerEvent) => {
      if (!isDraggingRef.current) return;
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
      }
      rafIdRef.current = requestAnimationFrame(() => {
        const updatedVal = calculateValueFromPointer(moveEvent.clientX);
        updateVisualAndNotify(updatedVal);
      });
    };

    const onPointerUp = () => {
      isDraggingRef.current = false;
      setIsDragging(false);
      onDragStateChange?.(false);
      if (rafIdRef.current !== null) {
        cancelAnimationFrame(rafIdRef.current);
        rafIdRef.current = null;
      }
      window.removeEventListener('pointermove', onPointerMove);
      window.removeEventListener('pointerup', onPointerUp);
      window.removeEventListener('pointercancel', onPointerUp);
    };

    window.addEventListener('pointermove', onPointerMove, { passive: false });
    window.addEventListener('pointerup', onPointerUp);
    window.addEventListener('pointercancel', onPointerUp);
  };

  // Mouse wheel scroll to smoothly adjust brightness/value
  const handleWheel = (e: React.WheelEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();

    const direction = e.deltaY < 0 ? 1 : -1;
    const effectiveStep = step > 0 ? step : 1;
    const delta = direction * (e.shiftKey ? effectiveStep * 5 : effectiveStep);
    const nextVal = Math.min(max, Math.max(min, localValue + delta));

    if (nextVal !== localValue) {
      updateVisualAndNotify(nextVal);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    let nextVal = localValue;
    const effectiveStep = step > 0 ? step : 1;
    if (e.key === 'ArrowRight' || e.key === 'ArrowUp') {
      nextVal = Math.min(max, localValue + effectiveStep);
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') {
      nextVal = Math.max(min, localValue - effectiveStep);
    } else if (e.key === 'Home') {
      nextVal = min;
    } else if (e.key === 'End') {
      nextVal = max;
    } else {
      return;
    }
    e.preventDefault();
    updateVisualAndNotify(nextVal);
  };

  return (
    <div className={`w-full select-none ${className}`}>
      {/* 
        Minimal Seamless Apple Capsule Slider with instantaneous mouse response & wheel control
      */}
      <div
        ref={trackRef}
        dir="ltr"
        role="slider"
        tabIndex={0}
        aria-valuemin={min}
        aria-valuemax={max}
        aria-valuenow={clampedValue}
        aria-label="اسلایدر کپسولی تنظیم روشنایی"
        onPointerDown={handlePointerDown}
        onWheel={handleWheel}
        onKeyDown={handleKeyDown}
        className={`relative w-full h-11 sm:h-12 bg-neutral-200/90 rounded-full cursor-pointer overflow-hidden flex items-center shadow-[inset_0_2px_4px_rgba(0,0,0,0.1)] border border-neutral-300/80 transition-transform focus:outline-none focus:ring-2 focus:ring-neutral-400/40 ${
          isDragging ? 'scale-[1.01] cursor-ew-resize' : 'hover:border-neutral-400/80 active:scale-[0.99]'
        }`}
        style={{
          touchAction: 'none',
          WebkitTapHighlightColor: 'transparent',
        }}
      >
        {/* Seamless Filled Capsule Bar (بدون تاخیر حرکتی هنگام درگ موس) */}
        <div
          ref={fillRef}
          className={`absolute left-0 top-0 bottom-0 bg-gradient-to-r ${colorStyles.gradient} rounded-full ${
            isDragging ? 'transition-none' : 'transition-[width] duration-150 ease-out'
          }`}
          style={{
            width: `${percentage}%`,
            transform: 'translateZ(0)',
            willChange: 'width',
          }}
        />

        {/* Embedded Left Dim Icon */}
        <div
          className={`absolute left-3.5 z-10 pointer-events-none flex items-center justify-center transition-colors duration-150 ${
            percentage > 12 ? 'text-white drop-shadow-xs' : 'text-neutral-500'
          }`}
        >
          {leftIcon || <Sun className="w-4 h-4 opacity-80" />}
        </div>

        {/* Embedded Right Bright Icon */}
        <div
          className={`absolute right-3.5 z-10 pointer-events-none flex items-center justify-center transition-colors duration-150 ${
            percentage > 90 ? 'text-white drop-shadow-xs' : 'text-neutral-500'
          }`}
        >
          {rightIcon || <Sun className="w-5 h-5" />}
        </div>

        {/* Center Minimal Live Value Readout */}
        {showPercentInside && (
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center z-10">
            <span
              ref={valueDisplayRef}
              className={`font-mono font-bold text-xs tracking-wide px-2.5 py-0.5 rounded-full transition-all duration-150 tabular-nums ${
                percentage > 50
                  ? 'text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.3)]'
                  : 'text-neutral-700 font-extrabold'
              }`}
            >
              {clampedValue}
              {unit}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};
