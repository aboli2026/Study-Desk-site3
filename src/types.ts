export type ActiveTab = 'notes' | 'settings';

export interface NoteFolder {
  id: string;
  name: string;
  parentId?: string | null;
  color?: string;
  icon?: string;
  createdAt?: string;
}

export interface NoteItem {
  id: string;
  title: string;
  content: string;
  createdAt: string;
  updatedAt: string;
  folderId?: string;
  category?: string;
  tags?: string[];
  isPinned?: boolean;
  attachedFileId?: string;
  attachedFileName?: string;
}

export type PomodoroMode = 'focus' | 'short-break' | 'long-break';

export type StudySessionType = PomodoroMode | 'file-study' | 'app-usage';

export type PomodoroSound = 'crystal' | 'zen' | 'marimba' | 'bell';

export interface PomodoroSettings {
  focusDuration: number; // in minutes
  shortBreakDuration: number; // in minutes
  longBreakDuration: number; // in minutes
  roundsBeforeLongBreak: number;
  autoStartBreaks: boolean;
  autoStartFocus: boolean;
  soundType: PomodoroSound;
  soundVolume: number; // 0 to 1
  browserNotifications: boolean;
}

export interface PomodoroSession {
  id: string;
  type: StudySessionType | string;
  durationMinutes: number;
  timestamp: string;
  createdAt?: number;
  date?: string;
  fileName?: string;
  source?: 'pomodoro' | 'file' | 'app';
}

export interface FileCategory {
  id: string;
  name: string;
  color: string; // 'blue' | 'emerald' | 'amber' | 'violet' | 'rose' | 'cyan' | 'indigo' | 'orange'
  createdAt?: string;
}

export interface StudyFile {
  id: string;
  name: string;
  size: number;
  data: ArrayBuffer;
  originalData?: ArrayBuffer;
  fileHandle?: any;
  uploadDate: string;
  pageCount?: number;
  currentPage?: number;
  pageStrokes?: Record<number, DrawingStroke[]>;
  stickyNotes?: StickyNoteItem[];
  scale?: number;
  lastModified?: string;
  category?: string; // ID of category or empty/undefined
  tags?: string[];
  isFavorite?: boolean;
}

export interface FileEdits {
  fileId: string;
  pageStrokes: Record<number, DrawingStroke[]>;
  stickyNotes: StickyNoteItem[];
  currentPage?: number;
  pageCount?: number;
  scale?: number;
  updatedAt: string;
}

export interface DrawingStroke {
  id: string;
  points: { x: number; y: number }[];
  color: string;
  width: number;
  tool?: 'pen' | 'highlighter' | 'ruler';
  opacity?: number;
}

export interface StickyNoteItem {
  id: string;
  pageNumber: number;
  x: number; // scaled to 1.0 base
  y: number;
  title: string;
  content: string;
  color: string;
  textColor: string;
  isBold: boolean;
  createdAt: string;
  imageUrl?: string;
  images?: string[];
}

export type EyeComfortMode = 'normal' | 'yellow' | 'dark-gray' | 'soft-gray';

export interface EyeComfortSettings {
  brightness: number; // 30 to 100 (default 100)
  colorMode: EyeComfortMode;
  warmth: number; // 20 to 80 (default 50)
}

export interface ToolShortcuts {
  hand: string;
  select: string;
  pen: string;
  highlighter: string;
  ruler: string;
  eraser: string;
  stickyNote: string;
  quickNotes?: string;
}

export type CapsulePosition =
  | 'bottom-center'
  | 'top-center'
  | 'right-center'
  | 'left-center'
  | 'right-top'
  | 'left-top'
  | 'right-bottom'
  | 'left-bottom'
  | 'bottom-right'
  | 'bottom-left'
  | 'top-right'
  | 'top-left';

export const isCapsuleVertical = (pos: CapsulePosition): boolean => {
  return (
    pos === 'right-center' ||
    pos === 'left-center' ||
    pos === 'right-top' ||
    pos === 'left-top' ||
    pos === 'right-bottom' ||
    pos === 'left-bottom' ||
    pos === 'bottom-right' ||
    pos === 'bottom-left' ||
    pos === 'top-right' ||
    pos === 'top-left'
  );
};

export type RenderQuality = 'eco' | 'balanced' | 'high';

export interface PerformanceSettings {
  ecoMode: boolean; // Economic / Low-spec hardware mode
  renderQuality: RenderQuality; // 'eco' = 1x DPR, 'balanced' = 1.3x DPR, 'high' = 2x DPR
  virtualization: boolean; // Release offscreen canvas memory for multi-page documents
  simplifyStrokes: boolean; // Optimize high-frequency drawing points
  hardwareAcceleration: boolean; // GPU compositing layers
  reduceAnimations: boolean; // Disable heavy blur and complex physics
}

export const detectEconomicHardware = (): boolean => {
  if (typeof navigator === 'undefined') return false;
  const cores = navigator.hardwareConcurrency || 4;
  const mem = (navigator as unknown as { deviceMemory?: number }).deviceMemory || 4;
  return cores <= 4 || mem <= 4;
};

export const DEFAULT_PERFORMANCE_SETTINGS: PerformanceSettings = {
  ecoMode: typeof navigator !== 'undefined' ? (navigator.hardwareConcurrency || 4) <= 4 : false,
  renderQuality: typeof navigator !== 'undefined' && (navigator.hardwareConcurrency || 4) <= 4 ? 'eco' : 'balanced',
  virtualization: true,
  simplifyStrokes: true,
  hardwareAcceleration: true,
  reduceAnimations: false,
};

export interface StudyTask {
  id: string;
  title: string;
  description?: string;
  completed: boolean;
  priority?: 'low' | 'medium' | 'high';
  dueDate?: string;
  createdAt: string;
  completedAt?: string;
}

