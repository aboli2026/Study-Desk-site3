import React, { useState, useEffect, useRef, useCallback } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  RotateCcw,
  Maximize2,
  ChevronRight,
  ChevronLeft,
  Move,
  Download,
} from 'lucide-react';

interface ImageZoomLightboxProps {
  images: string[];
  initialIndex?: number;
  isOpen: boolean;
  onClose: () => void;
  title?: string;
}

export const ImageZoomLightbox: React.FC<ImageZoomLightboxProps> = ({
  images,
  initialIndex = 0,
  isOpen,
  onClose,
  title,
}) => {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const [scale, setScale] = useState(1);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isDragging, setIsDragging] = useState(false);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const containerRef = useRef<HTMLDivElement>(null);
  const imgRef = useRef<HTMLImageElement>(null);

  // Sync index when opening
  useEffect(() => {
    if (isOpen) {
      setCurrentIndex(Math.max(0, Math.min(initialIndex, images.length - 1)));
      setScale(1);
      setPosition({ x: 0, y: 0 });
    }
  }, [isOpen, initialIndex, images.length]);

  // Reset zoom & pan when switching images
  const resetZoom = useCallback(() => {
    setScale(1);
    setPosition({ x: 0, y: 0 });
  }, []);

  const handleNext = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev < images.length - 1 ? prev + 1 : 0));
    resetZoom();
  }, [images.length, resetZoom]);

  const handlePrev = useCallback(() => {
    if (images.length <= 1) return;
    setCurrentIndex((prev) => (prev > 0 ? prev - 1 : images.length - 1));
    resetZoom();
  }, [images.length, resetZoom]);

  const handleZoomIn = useCallback(() => {
    setScale((prev) => Math.min(prev + 0.35, 4.5));
  }, []);

  const handleZoomOut = useCallback(() => {
    setScale((prev) => {
      const next = Math.max(prev - 0.35, 0.5);
      if (next <= 1) setPosition({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const handleToggleZoom = useCallback(() => {
    setScale((prev) => {
      if (prev > 1.2) {
        setPosition({ x: 0, y: 0 });
        return 1;
      }
      return 2.2;
    });
  }, []);

  // Keyboard controls
  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      } else if (e.key === 'ArrowRight') {
        // In Persian RTL: right arrow goes to previous or next depending on convention, let's support both
        handlePrev();
      } else if (e.key === 'ArrowLeft') {
        handleNext();
      } else if (e.key === '+' || e.key === '=') {
        handleZoomIn();
      } else if (e.key === '-' || e.key === '_') {
        handleZoomOut();
      } else if (e.key === '0') {
        resetZoom();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, handleNext, handlePrev, handleZoomIn, handleZoomOut, resetZoom]);

  // Mouse wheel zoom
  const handleWheel = (e: React.WheelEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const delta = -e.deltaY;
    if (delta > 0) {
      setScale((prev) => Math.min(prev + 0.25, 4.5));
    } else {
      setScale((prev) => {
        const next = Math.max(prev - 0.25, 0.5);
        if (next <= 1) setPosition({ x: 0, y: 0 });
        return next;
      });
    }
  };

  // Drag-to-pan handlers (active when zoomed in)
  const handleMouseDown = (e: React.MouseEvent) => {
    if (scale <= 1) return;
    e.preventDefault();
    setIsDragging(true);
    dragStartRef.current = {
      x: e.clientX,
      y: e.clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDragging) return;
    const dx = e.clientX - dragStartRef.current.x;
    const dy = e.clientY - dragStartRef.current.y;
    setPosition({
      x: dragStartRef.current.posX + dx,
      y: dragStartRef.current.posY + dy,
    });
  };

  const handleMouseUp = () => {
    setIsDragging(false);
  };

  // Touch drag & pinch
  const touchStartRef = useRef<{ dist: number; startScale: number } | null>(null);

  const handleTouchStart = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      touchStartRef.current = { dist, startScale: scale };
    } else if (e.touches.length === 1 && scale > 1) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.touches[0].clientX,
        y: e.touches[0].clientY,
        posX: position.x,
        posY: position.y,
      };
    }
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (e.touches.length === 2 && touchStartRef.current) {
      const dist = Math.hypot(
        e.touches[0].clientX - e.touches[1].clientX,
        e.touches[0].clientY - e.touches[1].clientY
      );
      const ratio = dist / touchStartRef.current.dist;
      setScale(Math.max(0.5, Math.min(4.5, touchStartRef.current.startScale * ratio)));
    } else if (e.touches.length === 1 && isDragging) {
      const dx = e.touches[0].clientX - dragStartRef.current.x;
      const dy = e.touches[0].clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    }
  };

  const handleTouchEnd = () => {
    setIsDragging(false);
    touchStartRef.current = null;
  };

  // Download current image
  const handleDownload = () => {
    const curImg = images[currentIndex];
    if (!curImg) return;
    const a = document.createElement('a');
    a.href = curImg;
    a.download = `sticky-note-image-${currentIndex + 1}.jpg`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  if (!isOpen || images.length === 0 || !images[currentIndex]) return null;

  const currentImage = images[currentIndex];

  return (
    <div
      className="fixed inset-0 z-[120] bg-neutral-950/92 backdrop-blur-md flex flex-col items-center justify-between select-none animate-in fade-in duration-200"
      onMouseUp={handleMouseUp}
      onMouseLeave={handleMouseUp}
      onTouchEnd={handleTouchEnd}
      onClick={(e) => {
        // Close if clicked directly on background backdrop
        if (e.target === containerRef.current) {
          onClose();
        }
      }}
    >
      {/* Top Floating Bar */}
      <div className="w-full px-4 py-3 sm:px-6 sm:py-4 flex items-center justify-between z-50 text-white shrink-0 pointer-events-auto">
        <div className="flex items-center gap-3">
          {images.length > 1 && (
            <div className="px-3 py-1 rounded-full bg-white/15 backdrop-blur-md text-xs font-mono font-bold tracking-wider">
              {currentIndex + 1} / {images.length}
            </div>
          )}
          {title && (
            <span className="text-xs sm:text-sm font-bold text-neutral-200 truncate max-w-[200px] sm:max-w-xs">
              {title}
            </span>
          )}
        </div>

        {/* Top Right Exit Button */}
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={handleDownload}
            className="p-2 sm:p-2.5 rounded-full bg-white/10 hover:bg-white/20 text-white transition-colors cursor-pointer shadow-md"
            title="دانلود تصویر"
          >
            <Download className="w-4 h-4" />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 sm:w-10 sm:h-10 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 transition-transform ios-spring-btn"
            title="بستن (Esc)"
            aria-label="بستن"
          >
            <X className="w-5 h-5 stroke-[2.5]" />
          </button>
        </div>
      </div>

      {/* Main Interactive Stage with Drag & Wheel Zoom */}
      <div
        ref={containerRef}
        onWheel={handleWheel}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        className="flex-1 w-full flex items-center justify-center relative overflow-hidden p-2 sm:p-6 cursor-default"
      >
        {/* Previous Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handlePrev();
            }}
            className="absolute right-3 sm:right-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center cursor-pointer shadow-xl backdrop-blur-md z-40 transition-transform active:scale-95"
            title="تصویر قبلی (کلید راست)"
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Next Image Arrow */}
        {images.length > 1 && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              handleNext();
            }}
            className="absolute left-3 sm:left-6 top-1/2 -translate-y-1/2 w-11 h-11 sm:w-12 sm:h-12 rounded-full bg-black/60 hover:bg-black/85 text-white flex items-center justify-center cursor-pointer shadow-xl backdrop-blur-md z-40 transition-transform active:scale-95"
            title="تصویر بعدی (کلید چپ)"
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}

        {/* The Scalable & Draggable Image */}
        <div
          style={{
            transform: `translate3d(${position.x}px, ${position.y}px, 0) scale(${scale})`,
            transition: isDragging ? 'none' : 'transform 180ms cubic-bezier(0.2, 0.9, 0.3, 1)',
            cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'zoom-in',
          }}
          className="will-change-transform flex items-center justify-center max-w-full max-h-full"
          onDoubleClick={handleToggleZoom}
        >
          <img
            ref={imgRef}
            src={currentImage}
            alt="تصویر یادداشت"
            draggable={false}
            className="max-w-[90vw] max-h-[76vh] object-contain rounded-2xl shadow-2xl border border-white/10 select-none pointer-events-none"
          />
        </div>
      </div>

      {/* Bottom Floating Glass Control Capsule */}
      <div className="pb-4 sm:pb-6 z-50 shrink-0 pointer-events-auto">
        <div className="flex items-center gap-1.5 sm:gap-2 px-3 py-2 sm:px-4 sm:py-2.5 rounded-full bg-neutral-900/85 backdrop-blur-xl border border-white/15 text-white shadow-2xl">
          {/* Zoom Out Button */}
          <button
            type="button"
            onClick={handleZoomOut}
            disabled={scale <= 0.5}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/15 active:scale-95 disabled:opacity-30 cursor-pointer transition-all"
            title="کوچک‌نمایی (-)"
          >
            <ZoomOut className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Zoom Percentage Label */}
          <span
            onClick={resetZoom}
            className="px-2 py-0.5 text-xs sm:text-sm font-mono font-bold text-neutral-200 cursor-pointer hover:text-white min-w-[50px] text-center"
            title="دوبار کلیک یا کلیک برای ریست به ۱۰۰٪"
          >
            {Math.round(scale * 100)}%
          </span>

          {/* Zoom In Button */}
          <button
            type="button"
            onClick={handleZoomIn}
            disabled={scale >= 4.5}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/15 active:scale-95 disabled:opacity-30 cursor-pointer transition-all"
            title="بزرگ‌نمایی (+)"
          >
            <ZoomIn className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          <div className="w-px h-4 bg-white/20 mx-1" />

          {/* Reset Zoom Button */}
          <button
            type="button"
            onClick={resetZoom}
            className="p-1.5 sm:p-2 rounded-full hover:bg-white/15 active:scale-95 cursor-pointer transition-all"
            title="بازنشانی اندازه (کلید 0)"
          >
            <RotateCcw className="w-4 h-4 sm:w-4.5 sm:h-4.5" />
          </button>

          {/* Pan hint when zoomed */}
          {scale > 1 && (
            <div className="hidden sm:flex items-center gap-1 text-[11px] text-neutral-400 font-sans pr-1">
              <Move className="w-3.5 h-3.5" />
              <span>قابلیت جابجایی با درگ</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
