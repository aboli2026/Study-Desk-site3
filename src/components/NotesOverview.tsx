import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  StickyNote,
  FileText,
  Search,
  Plus,
  BookOpen,
  Pin,
  Trash2,
  Edit2,
  Copy,
  Check,
  X,
  FolderOpen,
  FolderPlus,
  Folder,
  Upload,
  AlertTriangle,
  ChevronDown,
  ChevronLeft,
  ChevronUp,
  ExternalLink,
  Image as ImageIcon,
  Type,
  Eye,
  Sparkles,
  CheckSquare,
  Clock,
  RotateCcw,
  CheckCircle2,
  ZoomIn,
} from 'lucide-react';
import { NoteItem, NoteFolder, StudyFile, StickyNoteItem, StudyTask } from '../types';
function cleanPastedMarkdown(text: string): string {
  if (!text) return '';
  return text
    .replace(/```[\s\S]*?```/g, (m) => m.replace(/```[a-zA-Z0-9_-]*\n?/g, '').replace(/```/g, ''))
    .replace(/`([^`]+)`/g, '$1')
    .replace(/^#{1,6}\s+/gm, '')
    .replace(/(\*\*|__)(.*?)\1/g, '$2')
    .replace(/(\*|_)(.*?)\1/g, '$2')
    .replace(/~~(.*?)~~/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]+\)/g, '$1')
    .replace(/^[\s]*[-*+]\s+/gm, '• ')
    .replace(/^>\s?/gm, '')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function hasMarkdownArtifacts(text: string): boolean {
  if (!text) return false;
  return [/^#{1,6}\s+/m, /\*\*[^*]+\*\*/, /`[^`]+`/, /```[\s\S]*?```/, /\[[^\]]+\]\([^)]+\)/, /^>\s+/m, /^[\s]*[-*+]\s+/m].some((p) => p.test(text));
}
import { getAllTasksFromStorage, saveAllTasksToStorage } from '../utils/fileStorage';
import { playTaskCompleteSound, playTaskUndoSound } from '../utils/pomodoroAudio';
import { ImageZoomLightbox } from './ImageZoomLightbox';

export interface FileStickyNoteEntry {
  fileId: string;
  fileName: string;
  file: StudyFile;
  note: StickyNoteItem;
}

interface NotesOverviewProps {
  notes: NoteItem[];
  folders: NoteFolder[];
  studyFiles?: StudyFile[];
  onSelectNoteToEdit: (noteId: string) => void;
  onStartNewNote: () => void;
  onTogglePinNote: (noteId: string, currentPin?: boolean) => void;
  onDeleteNote: (noteId: string) => void;
  onOpenFileAtPage?: (file: StudyFile, pageNumber: number) => void;
  onUpdateStickyNote?: (fileId: string, updatedNote: StickyNoteItem) => void;
  onDeleteStickyNote?: (fileId: string, stickyNoteId: string) => void;
  onSwitchToEditor: () => void;
  onAddFolder?: (folder: Omit<NoteFolder, 'id' | 'createdAt'>) => void;
  onUpdateFolder?: (folderId: string, name: string, color?: string, parentId?: string | null) => void;
  onDeleteFolder?: (folderId: string) => void;
  onTriggerNewFile?: () => void;
}

const PRESET_COLORS = [
  { bg: '#fef08a', text: '#713f12', name: 'زرد کلاسیک' },
  { bg: '#bbf7d0', text: '#14532d', name: 'سبز نعنایی' },
  { bg: '#fed7aa', text: '#7c2d12', name: 'هلویی' },
  { bg: '#bae6fd', text: '#0c4a6e', name: 'آبی آسمانی' },
  { bg: '#e9d5ff', text: '#581c87', name: 'بنفش اسطوخودوس' },
  { bg: '#fecdd3', text: '#881337', name: 'صورتی ملایم' },
  { bg: '#f3f4f6', text: '#1f2937', name: 'خاکستری مینیمال' },
];

const FOLDER_COLOR_PALETTE = [
  { name: 'آبی', value: '#2563eb', bg: 'bg-blue-50', text: 'text-blue-700', dot: 'bg-blue-500' },
  { name: 'زمردی', value: '#059669', bg: 'bg-emerald-50', text: 'text-emerald-700', dot: 'bg-emerald-500' },
  { name: 'کهربایی', value: '#d97706', bg: 'bg-amber-50', text: 'text-amber-700', dot: 'bg-amber-500' },
  { name: 'بنفش', value: '#7c3aed', bg: 'bg-purple-50', text: 'text-purple-700', dot: 'bg-purple-500' },
  { name: 'رز', value: '#e11d48', bg: 'bg-rose-50', text: 'text-rose-700', dot: 'bg-rose-500' },
  { name: 'فیروزه‌ای', value: '#0891b2', bg: 'bg-cyan-50', text: 'text-cyan-700', dot: 'bg-cyan-500' },
  { name: 'نارنجی', value: '#ea580c', bg: 'bg-orange-50', text: 'text-orange-700', dot: 'bg-orange-500' },
  { name: 'دودی', value: '#4b5563', bg: 'bg-neutral-100', text: 'text-neutral-700', dot: 'bg-neutral-500' },
];

/**
 * Converts HTML content to clean readable plain text while strictly preserving
 * paragraph and line breaks so preview cards and text viewers match how the user wrote them.
 */
function htmlToPreviewText(html: string): string {
  if (!html) return '';
  const withBreaks = html
    .replace(/<br\s*[\/]?>/gi, '\n')
    .replace(/<\/p>/gi, '\n')
    .replace(/<\/div>/gi, '\n')
    .replace(/<\/li>/gi, '\n')
    .replace(/<\/tr>/gi, '\n')
    .replace(/<\/h[1-6]>/gi, '\n\n');

  const div = document.createElement('div');
  div.innerHTML = withBreaks;
  const rawText = div.textContent || div.innerText || '';

  return rawText
    .split('\n')
    .map((line) => line.replace(/[ \t]+/g, ' ').trim())
    .filter((line, idx, arr) => line.length > 0 || (idx > 0 && arr[idx - 1].length > 0))
    .join('\n')
    .trim();
}

/**
 * Strips HTML tags and collapses spaces for search queries
 */
function stripHtml(html: string): string {
  if (!html) return '';
  const div = document.createElement('div');
  div.innerHTML = html;
  return (div.textContent || div.innerText || '').replace(/\s+/g, ' ').trim();
}

/**
 * Helper to get all descendant folder IDs for a given folder ID
 */
function getFolderAndDescendantIds(folderId: string, allFolders: NoteFolder[]): string[] {
  const result: string[] = [folderId];
  const queue: string[] = [folderId];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = allFolders.filter((f) => f.parentId === curr);
    children.forEach((c) => {
      result.push(c.id);
      queue.push(c.id);
    });
  }
  return result;
}

interface ActiveViewerItem {
  type: 'sticky' | 'note';
  id: string;
  title: string;
  content: string;
  rawHtml?: string;
  sourceLabel: string;
  pageNumber?: number;
  color?: string;
  textColor?: string;
  date?: string;
  originalEntry?: FileStickyNoteEntry;
  originalNote?: NoteItem;
  isBold?: boolean;
  imageUrl?: string;
  images?: string[];
}

export const NotesOverview: React.FC<NotesOverviewProps> = ({
  notes,
  folders,
  studyFiles = [],
  onSelectNoteToEdit,
  onStartNewNote,
  onTogglePinNote,
  onDeleteNote,
  onOpenFileAtPage,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onSwitchToEditor,
  onAddFolder,
  onUpdateFolder,
  onDeleteFolder,
  onTriggerNewFile,
}) => {
  // Main Tab State: 'notes' (یادداشت‌ها) | 'tasks' (تسک‌ها) | 'sticky-notes' (استیکی‌نوت‌ها)
  const [activeTab, setActiveTab] = useState<'notes' | 'tasks' | 'sticky-notes'>('notes');

  // Search input
  const [searchQuery, setSearchQuery] = useState('');

  // Sticky Notes Filter (by file)
  const [selectedFileId, setSelectedFileId] = useState<string>('all');

  // Standalone Notes Filter (by folder)
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');

  // Category Submenu Dropdown Popover Anchor (زیرمجموعه کشویی دسته‌بندی‌ها دقیقاً مانند کتابخانه)
  const [isCategorySubmenuOpen, setIsCategorySubmenuOpen] = useState(false);
  const categorySubmenuRef = useRef<HTMLDivElement | null>(null);

  // File Submenu Dropdown Popover Anchor for Sticky Notes (زیرمجموعه کشویی فیلتر فایل‌ها)
  const [isFileSubmenuOpen, setIsFileSubmenuOpen] = useState(false);
  const fileSubmenuRef = useRef<HTMLDivElement | null>(null);

  // Close category & file submenus on outside click
  useEffect(() => {
    const handleOutsideClick = (e: MouseEvent) => {
      if (categorySubmenuRef.current && !categorySubmenuRef.current.contains(e.target as Node)) {
        setIsCategorySubmenuOpen(false);
      }
      if (fileSubmenuRef.current && !fileSubmenuRef.current.contains(e.target as Node)) {
        setIsFileSubmenuOpen(false);
      }
    };
    if (isCategorySubmenuOpen || isFileSubmenuOpen) {
      document.addEventListener('mousedown', handleOutsideClick);
      return () => document.removeEventListener('mousedown', handleOutsideClick);
    }
  }, [isCategorySubmenuOpen, isFileSubmenuOpen]);

  // Clean Reader Window Modal State (پنجره تمیز، شارپ و خلوت برای مرور و خواندن کامل)
  const [viewingItem, setViewingItem] = useState<ActiveViewerItem | null>(null);
  const [readerFontSize, setReaderFontSize] = useState<'normal' | 'large' | 'huge'>('large');

  // Fullscreen Zoom Lightbox State
  const [lightboxState, setLightboxState] = useState<{
    images: string[];
    index: number;
    title?: string;
  } | null>(null);

  // Inline expanded sticky note cards (امکان مطالعه کامل یادداشت مستقیماً در کارت بدون نیاز به پاپ‌آپ)
  const [expandedStickyIds, setExpandedStickyIds] = useState<Record<string, boolean>>({});

  const toggleExpandSticky = (id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedStickyIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  // Sticky Note Quick Edit Modal
  const [editingStickyNote, setEditingStickyNote] = useState<FileStickyNoteEntry | null>(null);
  const [editTitle, setEditTitle] = useState('');
  const [editContent, setEditContent] = useState('');
  const [editColor, setEditColor] = useState('#fef08a');
  const [editTextColor, setEditTextColor] = useState('#713f12');

  // Folder Management Modal State (ایجاد و ویرایش پوشه‌ها هماهنگ با دیزاین سراسری)
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [parentFolderIdInput, setParentFolderIdInput] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderColorInput, setFolderColorInput] = useState('#2563eb');
  const [folderToDelete, setFolderToDelete] = useState<NoteFolder | null>(null);

  // Delete Confirmations
  const [deletingStickyNote, setDeletingStickyNote] = useState<FileStickyNoteEntry | null>(null);
  const [deletingNote, setDeletingNote] = useState<NoteItem | null>(null);

  // Copy toast notification
  const [copiedToast, setCopiedToast] = useState<string | null>(null);

  const showCopyToast = (msg: string) => {
    setCopiedToast(msg);
    setTimeout(() => {
      setCopiedToast(null);
    }, 2200);
  };

  // Tasks State & Operations (تسک‌های مطالعه با محیط خلوت، تمیز و امکان ثبت آسان)
  const [tasks, setTasks] = useState<StudyTask[]>(() => getAllTasksFromStorage());
  const [isTaskModalOpen, setIsTaskModalOpen] = useState(false);
  const [editingTask, setEditingTask] = useState<StudyTask | null>(null);
  const [taskTitleInput, setTaskTitleInput] = useState('');
  const [taskDescInput, setTaskDescInput] = useState('');
  const [taskPriorityInput, setTaskPriorityInput] = useState<'low' | 'medium' | 'high'>('medium');
  const [taskDueDateInput, setTaskDueDateInput] = useState('');
  const [animatingTaskIds, setAnimatingTaskIds] = useState<Record<string, boolean>>({});

  // Handle Escape key to close any active modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        if (lightboxState) {
          setLightboxState(null);
          return;
        }
        if (isTaskModalOpen) setIsTaskModalOpen(false);
        if (viewingItem) setViewingItem(null);
        if (isFolderModalOpen) setIsFolderModalOpen(false);
        if (editingStickyNote) setEditingStickyNote(null);
        if (folderToDelete) setFolderToDelete(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [lightboxState, isTaskModalOpen, viewingItem, isFolderModalOpen, editingStickyNote, folderToDelete]);

  const isAnyModalOpen = Boolean(
    viewingItem ||
      isTaskModalOpen ||
      editingStickyNote ||
      isFolderModalOpen ||
      lightboxState ||
      folderToDelete ||
      deletingNote ||
      deletingStickyNote
  );

  // Lock background scroll when any modal or reader window is open
  useEffect(() => {
    if (isAnyModalOpen) {
      const origOverflow = document.body.style.overflow;
      const origTouchAction = document.body.style.touchAction;
      document.body.style.overflow = 'hidden';
      document.body.style.touchAction = 'none';
      return () => {
        document.body.style.overflow = origOverflow;
        document.body.style.touchAction = origTouchAction;
      };
    }
  }, [isAnyModalOpen]);

  // Persist tasks whenever changed
  useEffect(() => {
    saveAllTasksToStorage(tasks);
  }, [tasks]);

  const activeTasks = useMemo(() => {
    return tasks
      .filter((t) => !t.completed)
      .sort((a, b) => {
        const priorityWeights: Record<string, number> = { high: 3, medium: 2, low: 1 };
        const weightA = priorityWeights[a.priority || 'medium'] || 2;
        const weightB = priorityWeights[b.priority || 'medium'] || 2;
        if (weightA !== weightB) return weightB - weightA;
        return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      });
  }, [tasks]);

  const completedTasks = useMemo(() => {
    return tasks
      .filter((t) => t.completed)
      .sort((a, b) => {
        const timeA = a.completedAt || a.createdAt;
        const timeB = b.completedAt || b.createdAt;
        return new Date(timeB).getTime() - new Date(timeA).getTime();
      });
  }, [tasks]);

  const activeTasksCount = activeTasks.length;
  const completedTasksCount = completedTasks.length;

  const handleToggleTask = (taskId: string) => {
    const task = tasks.find((t) => t.id === taskId);
    if (!task) return;

    if (!task.completed) {
      // پخش صدای دیرینگ مینیمال و آرام‌بخش با وب آودیو
      playTaskCompleteSound(0.6);

      // فعال‌سازی انیمیشن اسلایدی و مشکی شدن کارت قبل از انتقال
      setAnimatingTaskIds((prev) => ({ ...prev, [taskId]: true }));
      setTimeout(() => {
        setTasks((prev) =>
          prev.map((t) =>
            t.id === taskId
              ? {
                  ...t,
                  completed: true,
                  completedAt: new Date().toLocaleTimeString('fa-IR', { hour: '2-digit', minute: '2-digit' }),
                }
              : t
          )
        );
        setAnimatingTaskIds((prev) => {
          const next = { ...prev };
          delete next[taskId];
          return next;
        });
        showCopyToast('تسک تکمیل شد و به ستون چپ منتقل گردید');
      }, 480);
    } else {
      // پخش صدای ملایم برای بازگردانی تسک
      playTaskUndoSound(0.35);

      // بازگردانی از ستون انجام‌شده‌ها به لیست فعال
      setTasks((prev) =>
        prev.map((t) =>
          t.id === taskId
            ? {
                ...t,
                completed: false,
                completedAt: undefined,
              }
            : t
        )
      );
      showCopyToast('تسک مجدداً به لیست کارهای فعال اضافه شد');
    }
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks((prev) => prev.filter((t) => t.id !== taskId));
    showCopyToast('تسک حذف شد');
  };

  const handleOpenAddTaskModal = () => {
    setEditingTask(null);
    setTaskTitleInput('');
    setTaskDescInput('');
    setTaskPriorityInput('medium');
    setTaskDueDateInput('');
    setIsTaskModalOpen(true);
  };

  const handleOpenEditTaskModal = (task: StudyTask) => {
    setEditingTask(task);
    setTaskTitleInput(task.title);
    setTaskDescInput(task.description || '');
    setTaskPriorityInput(task.priority || 'medium');
    setTaskDueDateInput(task.dueDate || '');
    setIsTaskModalOpen(true);
  };

  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = taskTitleInput.trim();
    if (!trimmed) return;

    if (editingTask) {
      setTasks((prev) =>
        prev.map((t) =>
          t.id === editingTask.id
            ? {
                ...t,
                title: trimmed,
                description: taskDescInput.trim() || undefined,
                priority: taskPriorityInput,
                dueDate: taskDueDateInput.trim() || undefined,
              }
            : t
        )
      );
      showCopyToast('تسک بروزرسانی شد');
    } else {
      const newTask: StudyTask = {
        id: `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
        title: trimmed,
        description: taskDescInput.trim() || undefined,
        completed: false,
        priority: taskPriorityInput,
        dueDate: taskDueDateInput.trim() || undefined,
        createdAt: new Date().toISOString(),
      };
      setTasks((prev) => [newTask, ...prev]);
      showCopyToast('تسک جدید اضافه شد');
    }

    setIsTaskModalOpen(false);
  };

  const handleClearCompletedTasks = () => {
    setTasks((prev) => prev.filter((t) => !t.completed));
    showCopyToast('تسک‌های انجام‌شده پاکسازی شدند');
  };

  // Organize root folders and subcategories map
  const rootFolders = useMemo(() => {
    return folders.filter((f) => !f.parentId || !folders.some((p) => p.id === f.parentId));
  }, [folders]);

  const subfoldersMap = useMemo(() => {
    const map: Record<string, NoteFolder[]> = {};
    folders.forEach((f) => {
      if (f.parentId) {
        if (!map[f.parentId]) map[f.parentId] = [];
        map[f.parentId].push(f);
      }
    });
    return map;
  }, [folders]);

  // Flatten all sticky notes from files
  const allStickyNotes: FileStickyNoteEntry[] = useMemo(() => {
    const list: FileStickyNoteEntry[] = [];
    (studyFiles || []).forEach((file) => {
      (file.stickyNotes || []).forEach((note) => {
        list.push({
          fileId: file.id,
          fileName: file.name,
          file,
          note,
        });
      });
    });
    return list.sort((a, b) => {
      if (a.fileName !== b.fileName) {
        return a.fileName.localeCompare(b.fileName, 'fa');
      }
      return (a.note.pageNumber || 1) - (b.note.pageNumber || 1);
    });
  }, [studyFiles]);

  // Unique files that have sticky notes
  const filesWithStickyNotes = useMemo(() => {
    const fileMap = new Map<string, { id: string; name: string; count: number }>();
    allStickyNotes.forEach((entry) => {
      const existing = fileMap.get(entry.fileId);
      if (existing) {
        existing.count += 1;
      } else {
        fileMap.set(entry.fileId, {
          id: entry.fileId,
          name: entry.fileName,
          count: 1,
        });
      }
    });
    return Array.from(fileMap.values());
  }, [allStickyNotes]);

  // Active selected file info for sticky notes filter button label
  const activeSelectedFile = useMemo(() => {
    if (selectedFileId === 'all') return null;
    return filesWithStickyNotes.find((f) => f.id === selectedFileId) || null;
  }, [selectedFileId, filesWithStickyNotes]);

  // Count notes per folder with hierarchy rollup
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: notes.length,
      uncategorized: notes.filter((n) => !n.folderId).length,
    };
    folders.forEach((f) => {
      const familyIds = getFolderAndDescendantIds(f.id, folders);
      counts[f.id] = notes.filter((n) => n.folderId && familyIds.includes(n.folderId)).length;
      counts[`${f.id}_direct`] = notes.filter((n) => n.folderId === f.id).length;
    });
    return counts;
  }, [notes, folders]);

  // Active selected folder info for breadcrumb display
  const activeSelectedFolder = useMemo(() => {
    if (selectedFolderId === 'all') return null;
    if (selectedFolderId === 'uncategorized') {
      return {
        id: 'uncategorized',
        name: 'عمومی (بدون پوشه)',
        color: '#737373',
        breadcrumb: 'عمومی و بدون پوشه',
        parent: null,
      };
    }
    const curr = folders.find((f) => f.id === selectedFolderId);
    if (!curr) return null;
    const parent = curr.parentId ? folders.find((f) => f.id === curr.parentId) : null;
    return {
      id: curr.id,
      folder: curr,
      parent,
      name: curr.name,
      breadcrumb: parent ? `${parent.name} › ${curr.name}` : curr.name,
      color: curr.color || '#2563eb',
    };
  }, [selectedFolderId, folders]);

  // Filtered Sticky Notes
  const filteredStickyNotes = useMemo(() => {
    return allStickyNotes.filter((entry) => {
      if (selectedFileId !== 'all' && entry.fileId !== selectedFileId) {
        return false;
      }
      if (searchQuery.trim()) {
        const query = searchQuery.trim().toLowerCase();
        const titleMatch = (entry.note.title || '').toLowerCase().includes(query);
        const contentMatch = (entry.note.content || '').toLowerCase().includes(query);
        const fileMatch = entry.fileName.toLowerCase().includes(query);
        if (!titleMatch && !contentMatch && !fileMatch) {
          return false;
        }
      }
      return true;
    });
  }, [allStickyNotes, selectedFileId, searchQuery]);

  // Filtered Standalone Notes
  const filteredNotes = useMemo(() => {
    return notes
      .filter((note) => {
        if (selectedFolderId !== 'all') {
          if (selectedFolderId === 'uncategorized') {
            if (note.folderId) return false;
          } else {
            const allowedFolderIds = getFolderAndDescendantIds(selectedFolderId, folders);
            if (!note.folderId || !allowedFolderIds.includes(note.folderId)) {
              return false;
            }
          }
        }
        if (searchQuery.trim()) {
          const query = searchQuery.trim().toLowerCase();
          const titleMatch = (note.title || '').toLowerCase().includes(query);
          const contentMatch = stripHtml(note.content || '').toLowerCase().includes(query);
          if (!titleMatch && !contentMatch) {
            return false;
          }
        }
        return true;
      })
      .sort((a, b) => {
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
  }, [notes, selectedFolderId, searchQuery, folders]);

  // Open Clean Viewer for a Sticky Note
  const handleOpenStickyViewer = (entry: FileStickyNoteEntry) => {
    setViewingItem({
      type: 'sticky',
      id: entry.note.id,
      title: cleanPastedMarkdown(entry.note.title || `یادداشت صفحه ${entry.note.pageNumber}`),
      content: cleanPastedMarkdown(entry.note.content || ''),
      sourceLabel: entry.fileName,
      pageNumber: entry.note.pageNumber,
      color: entry.note.color,
      textColor: '#000000',
      date: entry.note.createdAt,
      originalEntry: entry,
      isBold: entry.note.isBold,
      imageUrl: entry.note.imageUrl,
      images: entry.note.images && entry.note.images.length > 0 ? entry.note.images : (entry.note.imageUrl ? [entry.note.imageUrl] : []),
    });
  };

  // Open Clean Viewer for a Standalone Note
  const handleOpenNoteViewer = (note: NoteItem) => {
    const folder = folders.find((f) => f.id === note.folderId);
    setViewingItem({
      type: 'note',
      id: note.id,
      title: note.title || 'بدون عنوان',
      content: htmlToPreviewText(note.content || ''),
      rawHtml: note.content || '',
      sourceLabel: folder ? folder.name : 'عمومی',
      date: note.updatedAt || note.createdAt,
      originalNote: note,
    });
  };

  // Open Edit Modal for Sticky Note
  const handleOpenEditStickyNote = (entry: FileStickyNoteEntry, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingStickyNote(entry);
    setEditTitle(cleanPastedMarkdown(entry.note.title || ''));
    setEditContent(cleanPastedMarkdown(entry.note.content || ''));
    setEditColor(entry.note.color || '#fef08a');
    setEditTextColor(entry.note.textColor || '#713f12');
  };

  // Save Edit Sticky Note
  const handleSaveEditStickyNote = (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingStickyNote || !onUpdateStickyNote) return;

    const cleanedTitle = cleanPastedMarkdown(editTitle.trim());
    const cleanedContent = cleanPastedMarkdown(editContent.trim());

    const updated: StickyNoteItem = {
      ...editingStickyNote.note,
      title: cleanedTitle,
      content: cleanedContent,
      color: editColor,
      textColor: editTextColor,
    };
    onUpdateStickyNote(editingStickyNote.fileId, updated);
    setEditingStickyNote(null);
    if (viewingItem && viewingItem.id === updated.id) {
      setViewingItem({
        ...viewingItem,
        title: updated.title,
        content: updated.content,
        color: updated.color,
        textColor: updated.textColor,
      });
    }
    showCopyToast('تغییرات ذخیره شد');
  };

  // Confirm delete sticky note
  const handleConfirmDeleteStickyNote = () => {
    if (!deletingStickyNote || !onDeleteStickyNote) return;
    onDeleteStickyNote(deletingStickyNote.fileId, deletingStickyNote.note.id);
    if (viewingItem?.id === deletingStickyNote.note.id) {
      setViewingItem(null);
    }
    setDeletingStickyNote(null);
    showCopyToast('استیکی‌نوت حذف شد');
  };

  // Confirm delete standalone note
  const handleConfirmDeleteNote = () => {
    if (!deletingNote) return;
    onDeleteNote(deletingNote.id);
    if (viewingItem?.id === deletingNote.id) {
      setViewingItem(null);
    }
    setDeletingNote(null);
    showCopyToast('یادداشت حذف شد');
  };

  // Copy to clipboard helper
  const handleCopyText = (text: string, label: string) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    showCopyToast(`${label} کپی شد`);
  };

  // Folder management handlers
  const handleOpenAddFolder = (initialParentId: string | null = null) => {
    setEditingFolder(null);
    setParentFolderIdInput(initialParentId);
    setFolderNameInput('');
    setFolderColorInput('#2563eb');
    setIsFolderModalOpen(true);
  };

  const handleOpenEditFolder = (f: NoteFolder, e: React.MouseEvent) => {
    e.stopPropagation();
    setEditingFolder(f);
    setParentFolderIdInput(f.parentId || null);
    setFolderNameInput(f.name);
    setFolderColorInput(f.color || '#2563eb');
    setIsFolderModalOpen(true);
  };

  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    const name = folderNameInput.trim();
    if (!name) return;

    if (editingFolder) {
      if (onUpdateFolder) {
        onUpdateFolder(editingFolder.id, name, folderColorInput, parentFolderIdInput);
      }
    } else {
      if (onAddFolder) {
        onAddFolder({
          name,
          color: folderColorInput,
          parentId: parentFolderIdInput,
        });
      }
    }
    setIsFolderModalOpen(false);
  };

  const handleConfirmDeleteFolder = () => {
    if (!folderToDelete) return;
    if (onDeleteFolder) {
      onDeleteFolder(folderToDelete.id);
    }
    if (selectedFolderId === folderToDelete.id) {
      setSelectedFolderId('all');
    }
    setFolderToDelete(null);
    showCopyToast('پوشه حذف شد');
  };

  return (
    <div className="flex-1 flex flex-col h-full bg-neutral-50/60 overflow-hidden relative select-auto font-sans" dir="rtl">
      {/* Unified Search, Folders & File Filters Toolbar (Compact Mobile-Optimized) */}
      {activeTab !== 'tasks' && (
        <div
          className={`bg-white/95 backdrop-blur-md border-b border-neutral-200/80 px-3 sm:px-6 py-2.5 shrink-0 shadow-2xs relative transition-all ${
            isCategorySubmenuOpen || isFileSubmenuOpen ? 'z-40' : 'z-20'
          }`}
        >
        <div className="max-w-6xl mx-auto space-y-2">
          {/* Upper Row: Search input + New Note Button */}
          <div className="flex items-center gap-2">
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" />
              <input
                type="text"
                placeholder={
                  activeTab === 'notes'
                    ? 'جستجو در یادداشت‌ها...'
                    : 'جستجو در استیکی‌نوت‌ها...'
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pr-8 pl-7 py-1.5 bg-neutral-50/90 hover:bg-neutral-50 focus:bg-white border border-neutral-200/80 focus:border-neutral-400 rounded-xl text-xs text-neutral-900 placeholder:text-neutral-400 focus:outline-none transition-all"
              />
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 p-0.5 text-neutral-400 hover:text-neutral-700 rounded-full hover:bg-neutral-200 cursor-pointer transition-colors"
                  title="پاک کردن جستجو"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {activeTab === 'notes' && (
              <button
                type="button"
                onClick={onStartNewNote}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs active:scale-95 transition-transform shrink-0"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>یادداشت جدید</span>
              </button>
            )}
          </div>

          {/* Lower Row: Category Pills & Submenu Filter (دقیقاً مشابه بخش کتابخانه) */}
          {activeTab === 'notes' ? (
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-100/90 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1">
                {/* 1. All Notes (همه یادداشت‌ها) */}
                <button
                  type="button"
                  onClick={() => setSelectedFolderId('all')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ios-spring-btn shrink-0 ${
                    selectedFolderId === 'all'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <FolderOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>همه یادداشت‌ها</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      selectedFolderId === 'all'
                        ? 'bg-neutral-700 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {notes.length}
                  </span>
                </button>

                {/* Divider */}
                <div className="w-px h-4 bg-neutral-200 shrink-0 hidden sm:block" />

                {/* 2. Category Submenu Dropdown (زیرمجموعه کشویی دسته‌بندی‌ها دقیقاً مثل کتابخانه) */}
                <div className={`relative shrink-0 ${isCategorySubmenuOpen ? 'z-50' : ''}`} ref={categorySubmenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsCategorySubmenuOpen(!isCategorySubmenuOpen)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ios-spring-btn shrink-0 ${
                      activeSelectedFolder && activeSelectedFolder.id !== 'uncategorized'
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : selectedFolderId === 'uncategorized'
                        ? 'bg-neutral-100 text-neutral-900 border-neutral-300'
                        : isCategorySubmenuOpen
                        ? 'bg-neutral-100 text-neutral-900 border-neutral-300'
                        : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200/90'
                    }`}
                  >
                    <Folder className="w-3.5 h-3.5 shrink-0" />
                    {activeSelectedFolder && activeSelectedFolder.id !== 'uncategorized' ? (
                      <span className="flex items-center gap-1.5">
                        <span
                          className="w-2 h-2 rounded-full shrink-0"
                          style={{ backgroundColor: activeSelectedFolder.color || '#2563eb' }}
                        />
                        <span>دسته: {activeSelectedFolder.name}</span>
                      </span>
                    ) : selectedFolderId === 'uncategorized' ? (
                      <span className="flex items-center gap-1.5">
                        <span className="w-2 h-2 rounded-full bg-neutral-400 shrink-0" />
                        <span>عمومی (بدون پوشه)</span>
                      </span>
                    ) : (
                      <span>دسته‌بندی‌ها</span>
                    )}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 opacity-60 ${
                        isCategorySubmenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Submenu Dropdown Popover with global iOS jelly animation */}
                  {isCategorySubmenuOpen && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl p-2 z-50 animate-ios-jelly origin-top sm:origin-top-right select-none border border-neutral-200/80 ring-1 ring-black/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 px-2 border-b border-neutral-100 mb-1">
                        <span className="text-[11px] font-bold text-neutral-500">
                          انتخاب دسته‌بندی
                        </span>
                        {onAddFolder && (
                          <button
                            type="button"
                            onClick={() => {
                              setIsCategorySubmenuOpen(false);
                              handleOpenAddFolder(null);
                            }}
                            className="text-[11px] font-bold text-neutral-800 hover:text-black flex items-center gap-1 bg-neutral-100 hover:bg-neutral-200 px-2 py-0.5 rounded-lg transition-colors cursor-pointer"
                          >
                            <Plus className="w-3 h-3" />
                            <span>دسته جدید</span>
                          </button>
                        )}
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                        {/* Option to clear category filter */}
                        {selectedFolderId !== 'all' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFolderId('all');
                              setIsCategorySubmenuOpen(false);
                            }}
                            className="w-full text-right px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 rounded-xl flex items-center justify-between border border-rose-200 transition-colors cursor-pointer mb-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>حذف فیلتر دسته‌بندی (نمایش همه)</span>
                            </div>
                            <X className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}

                        {/* All Categories Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFolderId('all');
                            setIsCategorySubmenuOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                            selectedFolderId === 'all'
                              ? 'font-bold bg-neutral-100 text-neutral-900'
                              : 'text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <FolderOpen className="w-3.5 h-3.5 text-neutral-400" />
                            <span>همه یادداشت‌ها</span>
                          </div>
                          {selectedFolderId === 'all' && (
                            <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                          )}
                        </button>

                        {/* Categories List (با ساختار درختی و زیرمجموعه‌بندی تمیز) */}
                        {rootFolders.map((f) => {
                          const isCurrent = selectedFolderId === f.id;
                          const count = folderCounts[f.id] || 0;
                          const children = subfoldersMap[f.id] || [];

                          return (
                            <React.Fragment key={f.id}>
                              <div
                                className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors ${
                                  isCurrent ? 'bg-neutral-100' : 'hover:bg-neutral-50'
                                }`}
                              >
                                <button
                                  type="button"
                                  onClick={() => {
                                    setSelectedFolderId(f.id);
                                    setIsCategorySubmenuOpen(false);
                                  }}
                                  className="flex items-center gap-2 min-w-0 flex-1 text-right text-xs cursor-pointer py-0.5"
                                >
                                  <span
                                    className="w-2.5 h-2.5 rounded-full shrink-0"
                                    style={{ backgroundColor: f.color || '#2563eb' }}
                                  />
                                  <span
                                    className={`truncate ${
                                      isCurrent ? 'font-bold text-neutral-900' : 'text-neutral-700'
                                    }`}
                                  >
                                    {f.name}
                                  </span>
                                  {children.length > 0 && (
                                    <span className="text-[10px] text-neutral-400 font-normal">
                                      ({children.length} زیردسته)
                                    </span>
                                  )}
                                </button>

                                <div className="flex items-center gap-1 shrink-0">
                                  <span
                                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                                      isCurrent
                                        ? 'bg-neutral-900 text-white'
                                        : 'bg-neutral-100 text-neutral-600'
                                    }`}
                                  >
                                    {count}
                                  </span>

                                  {/* Quick Add Subcategory */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleOpenAddFolder(f.id);
                                      setIsCategorySubmenuOpen(false);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-800 rounded cursor-pointer transition-opacity"
                                    title="افزودن زیرمجموعه جدید به این دسته"
                                  >
                                    <Plus className="w-3 h-3" />
                                  </button>

                                  {/* Edit Trigger */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      handleOpenEditFolder(f, e);
                                      setIsCategorySubmenuOpen(false);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-700 rounded cursor-pointer transition-opacity"
                                    title="ویرایش دسته‌بندی"
                                  >
                                    <Edit2 className="w-3 h-3" />
                                  </button>

                                  {/* Delete Trigger */}
                                  <button
                                    type="button"
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      setFolderToDelete(f);
                                      setIsCategorySubmenuOpen(false);
                                    }}
                                    className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 rounded cursor-pointer transition-opacity"
                                    title="حذف دسته‌بندی"
                                  >
                                    <Trash2 className="w-3 h-3" />
                                  </button>

                                  {isCurrent && (
                                    <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0 mr-1" />
                                  )}
                                </div>
                              </div>

                              {/* Children / Subcategories */}
                              {children.map((child) => {
                                const isChildCurrent = selectedFolderId === child.id;
                                const childCount = folderCounts[child.id] || 0;
                                return (
                                  <div
                                    key={child.id}
                                    className={`group flex items-center justify-between rounded-xl pr-6 pl-2.5 py-1 transition-colors ${
                                      isChildCurrent ? 'bg-neutral-100' : 'hover:bg-neutral-50/80'
                                    }`}
                                  >
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setSelectedFolderId(child.id);
                                        setIsCategorySubmenuOpen(false);
                                      }}
                                      className="flex items-center gap-1.5 min-w-0 flex-1 text-right text-xs cursor-pointer py-0.5"
                                    >
                                      <span className="text-neutral-300 text-xs select-none">↳</span>
                                      <span
                                        className="w-2 h-2 rounded-full shrink-0"
                                        style={{ backgroundColor: child.color || '#2563eb' }}
                                      />
                                      <span
                                        className={`truncate ${
                                          isChildCurrent
                                            ? 'font-bold text-neutral-900'
                                            : 'text-neutral-600 text-[11px]'
                                        }`}
                                      >
                                        {child.name}
                                      </span>
                                    </button>

                                    <div className="flex items-center gap-1 shrink-0">
                                      <span
                                        className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                                          isChildCurrent
                                            ? 'bg-neutral-900 text-white'
                                            : 'bg-neutral-100 text-neutral-500'
                                        }`}
                                      >
                                        {childCount}
                                      </span>

                                      {/* Edit Child */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          handleOpenEditFolder(child, e);
                                          setIsCategorySubmenuOpen(false);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-neutral-700 rounded cursor-pointer transition-opacity"
                                        title="ویرایش زیرمجموعه"
                                      >
                                        <Edit2 className="w-2.5 h-2.5" />
                                      </button>

                                      {/* Delete Child */}
                                      <button
                                        type="button"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setFolderToDelete(child);
                                          setIsCategorySubmenuOpen(false);
                                        }}
                                        className="opacity-0 group-hover:opacity-100 p-1 text-neutral-400 hover:text-rose-600 rounded cursor-pointer transition-opacity"
                                        title="حذف زیرمجموعه"
                                      >
                                        <Trash2 className="w-2.5 h-2.5" />
                                      </button>

                                      {isChildCurrent && (
                                        <Check className="w-3 h-3 text-neutral-800 shrink-0 mr-1" />
                                      )}
                                    </div>
                                  </div>
                                );
                              })}
                            </React.Fragment>
                          );
                        })}

                        {/* Uncategorized Option */}
                        <div
                          className={`group flex items-center justify-between rounded-xl px-2.5 py-1.5 transition-colors border-t border-neutral-100 mt-1 pt-1.5 ${
                            selectedFolderId === 'uncategorized'
                              ? 'bg-neutral-100'
                              : 'hover:bg-neutral-50'
                          }`}
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFolderId('uncategorized');
                              setIsCategorySubmenuOpen(false);
                            }}
                            className="flex items-center gap-2 min-w-0 flex-1 text-right text-xs cursor-pointer py-0.5"
                          >
                            <span className="w-2.5 h-2.5 rounded-full bg-neutral-400 shrink-0" />
                            <span
                              className={`truncate ${
                                selectedFolderId === 'uncategorized'
                                  ? 'font-bold text-neutral-900'
                                  : 'text-neutral-700'
                              }`}
                            >
                              عمومی (بدون پوشه)
                            </span>
                          </button>
                          <div className="flex items-center gap-1 shrink-0">
                            <span className="text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold bg-neutral-100 text-neutral-600">
                              {folderCounts.uncategorized || 0}
                            </span>
                            {selectedFolderId === 'uncategorized' && (
                              <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0 mr-1" />
                            )}
                          </div>
                        </div>

                        {folders.length === 0 && (
                          <div className="p-3 text-center text-xs text-neutral-400">
                            هنوز دسته‌ای ایجاد نکرده‌اید. با زدن «دسته جدید» می‌توانید پوشه بسازید.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Reset Button */}
              {(selectedFolderId !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFolderId('all');
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  title="پاک کردن فیلترها"
                >
                  <X className="w-3 h-3" />
                  <span>پاکسازی فیلتر</span>
                </button>
              )}
            </div>
          ) : (
            /* Sticky Notes File Filter Row (دقیقاً هماهنگ با بخش یادداشت‌ها و کتابخانه با زیرمجموعه کشویی تمیز) */
            <div className="flex items-center justify-between gap-2 pt-1.5 border-t border-neutral-100/90 flex-wrap">
              <div className="flex items-center gap-1.5 sm:gap-2 flex-wrap flex-1">
                {/* 1. All Files (همه فایل‌ها) */}
                <button
                  type="button"
                  onClick={() => setSelectedFileId('all')}
                  className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 ios-spring-btn shrink-0 ${
                    selectedFileId === 'all'
                      ? 'bg-neutral-900 text-white shadow-xs'
                      : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900'
                  }`}
                >
                  <BookOpen className="w-3.5 h-3.5 shrink-0" />
                  <span>همه فایل‌ها</span>
                  <span
                    className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full ${
                      selectedFileId === 'all'
                        ? 'bg-neutral-700 text-white'
                        : 'bg-neutral-100 text-neutral-500'
                    }`}
                  >
                    {allStickyNotes.length}
                  </span>
                </button>

                {/* Divider */}
                <div className="w-px h-4 bg-neutral-200 shrink-0 hidden sm:block" />

                {/* 2. File Submenu Dropdown (زیرمجموعه کشویی منابع و فایل‌ها دقیقاً مشابه کتابخانه و یادداشت‌ها) */}
                <div className={`relative shrink-0 ${isFileSubmenuOpen ? 'z-50' : ''}`} ref={fileSubmenuRef}>
                  <button
                    type="button"
                    onClick={() => setIsFileSubmenuOpen(!isFileSubmenuOpen)}
                    className={`px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer flex items-center gap-1.5 border ios-spring-btn shrink-0 ${
                      activeSelectedFile
                        ? 'bg-neutral-900 text-white border-neutral-900 shadow-xs'
                        : isFileSubmenuOpen
                        ? 'bg-neutral-100 text-neutral-900 border-neutral-300'
                        : 'bg-white hover:bg-neutral-50 text-neutral-700 border-neutral-200/90'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5 shrink-0" />
                    {activeSelectedFile ? (
                      <span className="flex items-center gap-1.5 max-w-[180px] sm:max-w-[220px]">
                        <span className="truncate">فایل: {activeSelectedFile.name}</span>
                      </span>
                    ) : (
                      <span>فایل‌ها و منابع</span>
                    )}
                    <ChevronDown
                      className={`w-3 h-3 transition-transform duration-200 opacity-60 ${
                        isFileSubmenuOpen ? 'rotate-180' : ''
                      }`}
                    />
                  </button>

                  {/* Submenu Dropdown Popover with global iOS jelly animation */}
                  {isFileSubmenuOpen && (
                    <div
                      className="absolute left-1/2 -translate-x-1/2 sm:translate-x-0 sm:left-auto sm:right-0 top-full mt-2 w-64 max-w-[calc(100vw-2.5rem)] bg-white rounded-2xl shadow-2xl p-2 z-50 animate-ios-jelly origin-top sm:origin-top-right select-none border border-neutral-200/80 ring-1 ring-black/5"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between pb-2 px-2 border-b border-neutral-100 mb-1">
                        <span className="text-[11px] font-bold text-neutral-500">
                          انتخاب منبع و فایل
                        </span>
                        <span className="text-[10px] text-neutral-400 font-mono">
                          {filesWithStickyNotes.length} منبع
                        </span>
                      </div>

                      <div className="max-h-60 overflow-y-auto space-y-1 py-1">
                        {/* Option to clear file filter */}
                        {selectedFileId !== 'all' && (
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedFileId('all');
                              setIsFileSubmenuOpen(false);
                            }}
                            className="w-full text-right px-2.5 py-1.5 text-xs font-bold text-rose-600 bg-rose-50/70 hover:bg-rose-100/80 rounded-xl flex items-center justify-between border border-rose-200 transition-colors cursor-pointer mb-1"
                          >
                            <div className="flex items-center gap-1.5">
                              <Trash2 className="w-3.5 h-3.5 text-rose-500" />
                              <span>حذف فیلتر (نمایش همه فایل‌ها)</span>
                            </div>
                            <X className="w-3.5 h-3.5 text-rose-500" />
                          </button>
                        )}

                        {/* All Files Option */}
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedFileId('all');
                            setIsFileSubmenuOpen(false);
                          }}
                          className={`w-full text-right px-2.5 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors ${
                            selectedFileId === 'all'
                              ? 'font-bold bg-neutral-100 text-neutral-900'
                              : 'text-neutral-700'
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <BookOpen className="w-3.5 h-3.5 text-neutral-400" />
                            <span>همه فایل‌ها و استیکی‌نوت‌ها</span>
                          </div>
                          {selectedFileId === 'all' && (
                            <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0" />
                          )}
                        </button>

                        {/* Files List */}
                        {filesWithStickyNotes.map((f) => {
                          const isCurrent = selectedFileId === f.id;
                          return (
                            <button
                              key={f.id}
                              type="button"
                              onClick={() => {
                                setSelectedFileId(f.id);
                                setIsFileSubmenuOpen(false);
                              }}
                              className={`w-full text-right px-2.5 py-2 rounded-xl text-xs flex items-center justify-between hover:bg-neutral-100 cursor-pointer transition-colors group ${
                                isCurrent
                                  ? 'font-bold bg-neutral-100 text-neutral-900'
                                  : 'text-neutral-700'
                              }`}
                            >
                              <div className="flex items-center gap-2 min-w-0 flex-1">
                                <FileText className="w-3.5 h-3.5 text-neutral-400 group-hover:text-neutral-700 shrink-0" />
                                <span className="truncate">{f.name}</span>
                              </div>
                              <div className="flex items-center gap-1 shrink-0 mr-1.5">
                                <span
                                  className={`text-[10px] font-mono px-1.5 py-0.2 rounded-full font-bold ${
                                    isCurrent
                                      ? 'bg-neutral-900 text-white'
                                      : 'bg-neutral-100 text-neutral-600'
                                  }`}
                                >
                                  {f.count}
                                </span>
                                {isCurrent && (
                                  <Check className="w-3.5 h-3.5 text-neutral-800 shrink-0 mr-1" />
                                )}
                              </div>
                            </button>
                          );
                        })}

                        {filesWithStickyNotes.length === 0 && (
                          <div className="p-3 text-center text-xs text-neutral-400">
                            هنوز استیکی‌نوتی در هیچ فایلی ثبت نشده است.
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              </div>

              {/* Filter Reset Button */}
              {(selectedFileId !== 'all' || searchQuery) && (
                <button
                  type="button"
                  onClick={() => {
                    setSelectedFileId('all');
                    setSearchQuery('');
                  }}
                  className="px-2 py-1 text-[11px] font-semibold text-neutral-500 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg transition-colors cursor-pointer flex items-center gap-1 shrink-0"
                  title="پاک کردن فیلترها"
                >
                  <X className="w-3 h-3" />
                  <span>پاکسازی فیلتر</span>
                </button>
              )}
            </div>
          )}
        </div>
      </div>
      )}

      {/* 3. Main List: کلیک روی هر کارت پنجره تمیز و خلوت را با فیزیک ژله‌ای باز می‌کند */}
      <main
        className={`flex-1 ${
          isAnyModalOpen ? 'overflow-hidden pointer-events-none select-none' : 'overflow-y-auto'
        } px-2.5 sm:px-6 py-3 relative z-0 ${activeTab === 'tasks' ? 'bg-neutral-100/75' : ''}`}
        style={{ paddingBottom: 'calc(max(env(safe-area-inset-bottom, 0px), 12px) + 72px)' }}
      >
        <div className="w-full max-w-6xl mx-auto">
          {activeTab === 'tasks' ? (
            /* =========================================================
               TAB: ظاهر تمیز و خلوت تسک‌ها با دکمه افزودن تسک و ستون‌های متقارن با اسکرول بار داخلی
               ========================================================= */
            <div className="w-full flex flex-col space-y-4">
              {/* Header: Title + THE ONE AND ONLY "افزودن تسک" Button */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-3.5 pb-1 shrink-0">
                <div>
                  <h2 className="text-base sm:text-lg font-bold text-neutral-900 flex items-center gap-2.5">
                    <span>مدیریت و فهرست تسک‌ها</span>
                    <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-neutral-900 text-white font-bold shadow-2xs">
                      {activeTasksCount} در حال انجام
                    </span>
                    {completedTasksCount > 0 && (
                      <span className="text-[11px] px-2.5 py-0.5 rounded-full font-mono bg-emerald-100 text-emerald-800 font-bold shadow-2xs">
                        {completedTasksCount} تکمیل‌شده
                      </span>
                    )}
                  </h2>
                  <p className="text-xs text-neutral-400 mt-0.5">
                    تسک‌های فعال در ستون راست و تسک‌های انجام‌شده در صفحه سمت چپ به صورت لیست نمایش داده می‌شوند
                  </p>
                </div>

                {/* Header Actions */}
                <div className="flex items-center gap-2 self-start sm:self-auto shrink-0">
                  {/* Add Task Button */}
                  <button
                    type="button"
                    onClick={handleOpenAddTaskModal}
                    className="flex items-center gap-2 px-5 py-2.5 bg-neutral-900 hover:bg-neutral-800 text-white text-xs sm:text-sm font-bold rounded-xl cursor-pointer ios-spring-btn shadow-md hover:shadow-lg shrink-0"
                  >
                    <Plus className="w-4 h-4" />
                    <span>افزودن تسک</span>
                  </button>
                </div>
              </div>

              {/* Symmetrical Dual Columns: Right = Active Tasks | Left = Completed Tasks */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5 sm:gap-6 items-stretch flex-1 min-h-0 h-full pb-1">
                {/* 1. ستون راست (مستطیل عمودی متقارن: کارهای در حال انجام) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col h-full min-h-0 overflow-hidden">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <span className="w-2.5 h-2.5 rounded-full bg-amber-500 animate-pulse" />
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                        کارهای در حال انجام
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-bold shadow-2xs">
                        {activeTasksCount}
                      </span>
                    </div>
                  </div>

                  {/* Scrollable Active Tasks List with recessed track for strong card contrast */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-2.5 sm:p-3 bg-neutral-100/70 rounded-2xl min-h-0 custom-column-scroll">
                    {activeTasks.length === 0 ? (
                      <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center space-y-2.5 p-6 text-neutral-400">
                        <div className="w-12 h-12 rounded-2xl bg-white text-neutral-400 flex items-center justify-center shadow-xs">
                          <CheckSquare className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-800">
                          {tasks.length === 0 ? 'هیچ تسکی ثبت نشده است' : 'تمامی تسک‌های فعال تکمیل شده‌اند!'}
                        </h4>
                        <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                          {tasks.length === 0
                            ? 'برای شروع برنامه‌ریزی، روی دکمه «افزودن تسک» در بالای صفحه کلیک کنید.'
                            : 'همه وظایف فعلی انجام شده‌اند. می‌توانید تسک‌های جدید اضافه کنید.'}
                        </p>
                      </div>
                    ) : (
                      activeTasks.map((task) => {
                        const isAnimating = Boolean(animatingTaskIds[task.id]);
                        const priority = task.priority || 'medium';

                        return (
                          <div
                            key={task.id}
                            onClick={() => handleToggleTask(task.id)}
                            className={`relative overflow-hidden group rounded-2xl transition-all duration-200 p-2.5 sm:p-3 cursor-pointer select-none ring-1 hover:-translate-y-0.5 ${
                              isAnimating
                                ? 'bg-neutral-900 text-white ring-neutral-900 shadow-xl scale-[0.99]'
                                : 'bg-white ring-black/5 shadow-[0_2px_8px_rgba(0,0,0,0.05),0_1px_3px_rgba(0,0,0,0.03)] hover:shadow-[0_6px_16px_rgba(0,0,0,0.08)]'
                            }`}
                          >
                            {/* Sliding Black Overlay Animation */}
                            <div
                              className={`absolute inset-0 bg-neutral-900 transition-transform duration-500 ease-out pointer-events-none z-0 ${
                                isAnimating ? 'translate-x-0' : 'translate-x-full'
                              }`}
                            />

                            <div className="relative z-10 flex items-start sm:items-center justify-between gap-2.5">
                              {/* Big Tick Button & Content */}
                              <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                                {/* Big Tick Button with iOS spring physics */}
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleToggleTask(task.id);
                                  }}
                                  className={`w-7 h-7 sm:w-8 sm:h-8 rounded-xl flex items-center justify-center shrink-0 cursor-pointer ios-spring-btn ${
                                    isAnimating
                                      ? 'bg-emerald-500 text-white shadow-md shadow-emerald-500/30 scale-105'
                                      : 'bg-emerald-50 hover:bg-emerald-500 text-emerald-600 hover:text-white shadow-xs hover:shadow-md'
                                  }`}
                                  title="تیک زدن و تکمیل تسک"
                                >
                                  <Check
                                    className={`w-4 h-4 stroke-[3] transition-all duration-300 ${
                                      isAnimating
                                        ? 'text-white scale-110'
                                        : 'text-emerald-600 group-hover:scale-105'
                                    }`}
                                  />
                                </button>

                                <div className="min-w-0 flex-1">
                                  <div className="flex items-center gap-2 flex-wrap">
                                    <span
                                      className={`text-sm sm:text-base font-bold transition-colors duration-300 ${
                                        isAnimating ? 'text-white line-through opacity-90' : 'text-neutral-900'
                                      }`}
                                    >
                                      {task.title}
                                    </span>

                                    {/* Priority badge */}
                                    {!isAnimating && priority === 'high' && (
                                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-rose-100 text-rose-700 shadow-2xs">
                                        فوری
                                      </span>
                                    )}
                                    {!isAnimating && priority === 'medium' && (
                                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-amber-100 text-amber-800 shadow-2xs">
                                        مهم
                                      </span>
                                    )}
                                    {!isAnimating && priority === 'low' && (
                                      <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-neutral-200/80 text-neutral-700 shadow-2xs">
                                        عادی
                                      </span>
                                    )}

                                    {/* Due date badge */}
                                    {task.dueDate && (
                                      <span
                                        className={`flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg transition-colors duration-300 ${
                                          isAnimating ? 'text-neutral-400 bg-neutral-800' : 'text-neutral-600 bg-neutral-100'
                                        }`}
                                      >
                                        <Clock className="w-3 h-3" />
                                        <span>{task.dueDate}</span>
                                      </span>
                                    )}
                                  </div>

                                  {task.description && (
                                    <p
                                      className={`text-xs sm:text-sm mt-1 leading-relaxed transition-colors duration-300 ${
                                        isAnimating ? 'text-neutral-400 line-through' : 'text-neutral-600'
                                      }`}
                                    >
                                      {task.description}
                                    </p>
                                  )}
                                </div>
                              </div>

                              {/* Action Buttons */}
                              {!isAnimating && (
                                <div
                                  className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0"
                                  onClick={(e) => e.stopPropagation()}
                                >
                                  <button
                                    type="button"
                                    onClick={() => handleOpenEditTaskModal(task)}
                                    className="p-1.5 text-neutral-400 hover:text-neutral-800 hover:bg-neutral-100 rounded-lg cursor-pointer transition-colors ios-spring-btn"
                                    title="ویرایش"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteTask(task.id)}
                                    className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer transition-colors ios-spring-btn"
                                    title="حذف"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>

                {/* 2. ستون چپ (مستطیل عمودی متقارن: تسک‌های انجام‌شده) */}
                <div className="bg-white rounded-3xl p-4 sm:p-5 shadow-[0_10px_30px_-5px_rgba(0,0,0,0.06),0_4px_12px_-2px_rgba(0,0,0,0.03)] flex flex-col h-full min-h-0 overflow-hidden">
                  {/* Column Header */}
                  <div className="flex items-center justify-between pb-2 mb-2 shrink-0">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center font-bold shadow-2xs">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                      </div>
                      <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                        تسک‌های انجام‌شده
                      </h3>
                      <span className="text-[11px] font-mono px-2 py-0.5 rounded-full bg-neutral-100 text-neutral-700 font-bold shadow-2xs">
                        {completedTasksCount}
                      </span>
                    </div>

                    {completedTasksCount > 0 && (
                      <button
                        type="button"
                        onClick={handleClearCompletedTasks}
                        className="text-[11px] font-medium text-neutral-400 hover:text-rose-600 px-2 py-1 rounded-lg hover:bg-rose-50 transition-colors cursor-pointer ios-spring-btn"
                      >
                        پاک‌سازی همه
                      </button>
                    )}
                  </div>

                  {/* Scrollable Completed Tasks List with its OWN scrollbar inside this rectangle */}
                  <div className="flex-1 overflow-y-auto space-y-3 p-2.5 sm:p-3 bg-neutral-100/70 rounded-2xl min-h-0 custom-column-scroll">
                    {completedTasks.length === 0 ? (
                      <div className="h-full min-h-[180px] flex flex-col items-center justify-center text-center space-y-2.5 p-6 text-neutral-400">
                        <div className="w-12 h-12 rounded-2xl bg-white text-neutral-400 flex items-center justify-center shadow-xs">
                          <CheckCircle2 className="w-6 h-6 stroke-[1.5]" />
                        </div>
                        <h4 className="text-xs sm:text-sm font-bold text-neutral-800">
                          هنوز تسکی تکمیل نشده است
                        </h4>
                        <p className="text-[11px] text-neutral-400 max-w-xs leading-relaxed">
                          با زدن دکمه تیک روی هر تسک فعال، کارت آن مشکی شده و به این ستون منتقل می‌شود.
                        </p>
                      </div>
                    ) : (
                      completedTasks.map((task) => {
                        const priority = task.priority || 'medium';

                        return (
                          <div
                            key={task.id}
                            className="group relative bg-neutral-900 text-white rounded-2xl shadow-[0_2px_10px_-2px_rgba(0,0,0,0.25),0_1px_4px_rgba(0,0,0,0.15)] hover:shadow-[0_6px_18px_-2px_rgba(0,0,0,0.35)] p-2.5 sm:p-3 flex items-start sm:items-center justify-between gap-2.5 select-none ring-1 ring-white/10 transition-all duration-200 hover:-translate-y-0.5"
                          >
                            {/* Completed Check Icon matching active tick button */}
                            <div className="flex items-start sm:items-center gap-2.5 min-w-0 flex-1">
                              {/* Tick Button */}
                              <button
                                type="button"
                                onClick={() => handleToggleTask(task.id)}
                                className="w-7 h-7 sm:w-8 sm:h-8 rounded-xl bg-emerald-500 text-white flex items-center justify-center shrink-0 cursor-pointer shadow-md shadow-emerald-500/30 hover:bg-emerald-600 ios-spring-btn"
                                title="کلیک برای بازگردانی به لیست کارهای در حال انجام"
                              >
                                <Check className="w-4 h-4 stroke-[3]" />
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm sm:text-base font-bold text-neutral-200 line-through opacity-90">
                                    {task.title}
                                  </span>

                                  {/* Priority badge (subtle dark style) */}
                                  {priority === 'high' && (
                                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-rose-950/80 text-rose-300 shadow-2xs">
                                      فوری
                                    </span>
                                  )}
                                  {priority === 'medium' && (
                                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-amber-950/80 text-amber-300 shadow-2xs">
                                      مهم
                                    </span>
                                  )}
                                  {priority === 'low' && (
                                    <span className="px-2.5 py-0.5 text-[11px] font-bold rounded-lg bg-neutral-800 text-neutral-300 shadow-2xs">
                                      عادی
                                    </span>
                                  )}

                                  {/* Due date badge */}
                                  {task.dueDate && (
                                    <span className="flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-lg bg-neutral-800 text-neutral-400">
                                      <Clock className="w-3 h-3" />
                                      <span>{task.dueDate}</span>
                                    </span>
                                  )}

                                  {/* Completed timestamp badge */}
                                  {task.completedAt && (
                                    <span className="flex items-center gap-1 text-[10px] font-mono text-emerald-400 bg-emerald-950/70 px-2 py-0.5 rounded-md shadow-2xs">
                                      <span>انجام شد در {task.completedAt}</span>
                                    </span>
                                  )}
                                </div>

                                {task.description && (
                                  <p className="text-xs sm:text-sm mt-1 leading-relaxed text-neutral-400 line-through">
                                    {task.description}
                                  </p>
                                )}
                              </div>
                            </div>

                            {/* Actions: Undo & Delete */}
                            <div className="flex items-center gap-1 opacity-60 group-hover:opacity-100 transition-opacity shrink-0">
                              <button
                                type="button"
                                onClick={() => handleToggleTask(task.id)}
                                className="p-1.5 text-neutral-400 hover:text-white hover:bg-neutral-800 rounded-lg cursor-pointer transition-colors ios-spring-btn"
                                title="بازگردانی به لیست کارهای فعال"
                              >
                                <RotateCcw className="w-3.5 h-3.5" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteTask(task.id)}
                                className="p-1.5 text-neutral-400 hover:text-rose-400 hover:bg-rose-950/40 rounded-lg cursor-pointer transition-colors ios-spring-btn"
                                title="حذف تسک"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            </div>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : activeTab === 'sticky-notes' ? (
            /* =========================================================
               TAB: لیست استیکی‌نوت‌ها با انیمیشن فنری کارت‌ها
               ========================================================= */
            <div>
              {filteredStickyNotes.length === 0 ? (
                <div className="bg-white border border-dashed border-neutral-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-amber-50 text-amber-500 flex items-center justify-center shadow-2xs">
                    <StickyNote className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-800">
                    {searchQuery || selectedFileId !== 'all'
                      ? 'هیچ استیکی‌نوتی با این فیلتر یافت نشد'
                      : 'هنوز هیچ استیکی‌نوتی در فایل‌ها ثبت نشده است'}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                    هنگام مطالعه کتاب‌ها و جزوه‌ها، از ابزار یادداشت چسبان روی صفحات استفاده کنید یا فایل دلخواه خود را اضافه فرمایید.
                  </p>
                  {onTriggerNewFile && (
                    <button
                      type="button"
                      onClick={onTriggerNewFile}
                      className="mt-2 px-4 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs cursor-pointer ios-spring-btn flex items-center gap-1.5"
                    >
                      <Upload className="w-3.5 h-3.5" />
                      <span>افزودن فایل دلخواه</span>
                    </button>
                  )}
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {filteredStickyNotes.map((entry) => {
                    const rawContent = cleanPastedMarkdown(entry.note.content || '');
                    const displayTitle = cleanPastedMarkdown(entry.note.title || `یادداشت صفحه ${entry.note.pageNumber}`);
                    const noteBg = entry.note.color || '#fef08a';
                    const hasImages = Boolean((entry.note.images && entry.note.images.length > 0) || entry.note.imageUrl);

                    return (
                      <article
                        key={`${entry.fileId}-${entry.note.id}`}
                        onClick={() => handleOpenStickyViewer(entry)}
                        className={`rounded-2xl bg-white border border-neutral-200/90 hover:border-neutral-400 hover:shadow-md transition-all flex flex-col ${
                          hasImages ? 'h-[145px] sm:h-[155px]' : 'h-[110px] sm:h-[120px]'
                        } group cursor-pointer overflow-hidden relative select-none`}
                        style={{ borderTop: `3px solid ${noteBg}` }}
                        title="برای باز کردن و مطالعه کامل کلیک کنید"
                      >
                        <div className="p-2.5 sm:p-3 pb-1 flex-1 min-h-0 flex flex-col overflow-hidden">
                          {/* Top Row: File Name + Page Badge */}
                          <div className="flex items-center justify-between gap-1.5 mb-1 shrink-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <BookOpen className="w-3 h-3 text-neutral-500 shrink-0" />
                              <span
                                className="text-[11px] font-bold text-neutral-700 truncate max-w-[140px]"
                                title={entry.fileName}
                              >
                                {entry.fileName}
                              </span>
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span
                                className="px-1.5 py-0.2 rounded-md text-[10px] font-bold font-mono border border-black/10 shadow-2xs text-black"
                                style={{
                                  backgroundColor: noteBg,
                                  color: '#000000',
                                }}
                              >
                                ص {entry.note.pageNumber}
                              </span>
                            </div>
                          </div>

                          {/* Right-aligned, compact Content Container for Sticky Notes */}
                          <div className="flex-1 min-h-0 overflow-hidden flex flex-col justify-start mt-0.5 mb-0.5 px-0.5 w-full text-right" dir="rtl">
                            {/* Title */}
                            <h3 className="text-xs sm:text-sm font-bold text-neutral-950 group-hover:text-black truncate mb-0.5 tracking-tight shrink-0 text-right w-full" dir="rtl">
                              {displayTitle}
                            </h3>

                            {/* Attached Images Preview if present (compact fixed height) */}
                            {hasImages && (
                              <div
                                className="mb-1 shrink-0 w-full flex justify-start"
                                dir="rtl"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  const allImgs =
                                    entry.note.images && entry.note.images.length > 0
                                      ? entry.note.images
                                      : [entry.note.imageUrl!];
                                  setLightboxState({
                                    images: allImgs,
                                    index: 0,
                                    title: displayTitle,
                                  });
                                }}
                                title="برای نمایش تمام‌صفحه با قابلیت زوم کلیک کنید"
                              >
                                {(!entry.note.images || entry.note.images.length <= 1) ? (
                                  <div className="rounded-md overflow-hidden border border-black/10 h-10 w-16 bg-white/60 flex items-center justify-center relative group/cardimg">
                                    <img
                                      src={entry.note.images?.[0] || entry.note.imageUrl}
                                      alt="پیوست استیکی‌نوت"
                                      className="w-full h-full object-cover transition-transform group-hover/cardimg:scale-105"
                                      loading="lazy"
                                    />
                                    <div className="absolute inset-0 bg-black/25 opacity-0 group-hover/cardimg:opacity-100 transition-opacity flex items-center justify-center text-white">
                                      <ZoomIn className="w-3.5 h-3.5 drop-shadow-xs" />
                                    </div>
                                  </div>
                                ) : (
                                  <div className="grid grid-cols-2 gap-1 w-full max-w-[130px]">
                                    {entry.note.images.slice(0, 2).map((img, idx) => (
                                      <div key={idx} className="relative rounded-md overflow-hidden border border-black/10 h-10 bg-white/60 shadow-2xs group/cardimg">
                                        <img src={img} alt="" className="w-full h-full object-cover transition-transform group-hover/cardimg:scale-105" loading="lazy" />
                                        {idx === 1 && entry.note.images!.length > 2 && (
                                          <div className="absolute inset-0 bg-black/50 flex items-center justify-center text-white text-[9px] font-bold font-mono">
                                            +{entry.note.images!.length - 2}
                                          </div>
                                        )}
                                      </div>
                                    ))}
                                  </div>
                                )}
                              </div>
                            )}

                            {/* Content with high contrast, pure black text and compact layout */}
                            <div
                              className={`text-[11px] text-neutral-900 font-medium leading-relaxed select-text font-sans overflow-hidden text-right w-full line-clamp-2`}
                              dir="rtl"
                              style={{ color: '#000000' }}
                            >
                              {rawContent || (
                                <span className="text-neutral-500 italic font-normal text-[10px]">بدون متن...</span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Bottom Row Actions - Pinned to bottom, slimmed down to maximize text visibility */}
                        <div className="px-2.5 sm:px-3 py-1 bg-neutral-50/80 border-t border-neutral-100 flex items-center justify-between gap-1.5 shrink-0 mt-auto">
                          <div className="flex items-center gap-1.5 min-w-0">
                            <span className="text-[10px] text-neutral-400 font-mono truncate">
                              {entry.note.createdAt || 'ثبت شده'}
                            </span>

                            {/* Direct Jump to PDF page button */}
                            {onOpenFileAtPage && (
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  onOpenFileAtPage(entry.file, entry.note.pageNumber);
                                }}
                                className="px-1.5 py-0.5 text-[10px] font-bold text-neutral-700 hover:text-neutral-900 bg-white hover:bg-neutral-100 border border-neutral-200/90 rounded-md cursor-pointer flex items-center gap-1 shadow-2xs"
                                title="رفتن به این صفحه در کتاب"
                              >
                                <ExternalLink className="w-2.5 h-2.5 text-neutral-500" />
                                <span className="hidden sm:inline">مشاهده در فایل</span>
                              </button>
                            )}
                          </div>

                          <div className="flex items-center gap-0.5 shrink-0">
                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(entry.note.content, 'متن یادداشت');
                              }}
                              className="p-1 text-neutral-500 hover:text-neutral-900 hover:bg-neutral-200/60 rounded-md cursor-pointer"
                              title="کپی متن"
                            >
                              <Copy className="w-3.5 h-3.5" />
                            </button>

                            {/* Edit button */}
                            <button
                              type="button"
                              onClick={(e) => handleOpenEditStickyNote(entry, e)}
                              className="p-1 text-neutral-500 hover:text-sky-600 hover:bg-sky-50 rounded-md cursor-pointer"
                              title="ویرایش سریع"
                            >
                              <Edit2 className="w-3.5 h-3.5" />
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingStickyNote(entry);
                              }}
                              className="p-1 text-neutral-500 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer"
                              title="حذف"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            /* =========================================================
               TAB: لیست یادداشت‌های اختصاصی با انیمیشن فنری کارت‌ها
               ========================================================= */
            <div>
              {filteredNotes.length === 0 ? (
                <div className="bg-white border border-dashed border-neutral-200 rounded-3xl p-12 text-center flex flex-col items-center justify-center space-y-3">
                  <div className="w-12 h-12 rounded-2xl bg-sky-50 text-sky-600 flex items-center justify-center shadow-2xs">
                    <FileText className="w-6 h-6" />
                  </div>
                  <h3 className="text-sm font-bold text-neutral-800">
                    {searchQuery || selectedFolderId !== 'all'
                      ? 'هیچ یادداشتی با این فیلتر یافت نشد'
                      : 'هنوز یادداشتی ثبت نشده است'}
                  </h3>
                  <p className="text-xs text-neutral-400 max-w-sm leading-relaxed">
                    می‌توانید برای یادداشت‌برداری و خلاصه‌نویسی نکات درسی، یک یادداشت جدید ایجاد کرده یا فایلی را بارگذاری کنید.
                  </p>
                  <div className="flex items-center gap-2 pt-1">
                    <button
                      type="button"
                      onClick={onStartNewNote}
                      className="px-4 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl shadow-xs cursor-pointer ios-spring-btn flex items-center gap-1.5"
                    >
                      <Plus className="w-3.5 h-3.5" />
                      <span>ایجاد یادداشت جدید</span>
                    </button>
                    {onTriggerNewFile && (
                      <button
                        type="button"
                        onClick={onTriggerNewFile}
                        className="px-4 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn flex items-center gap-1.5"
                      >
                        <Upload className="w-3.5 h-3.5" />
                        <span>افزودن فایل دلخواه</span>
                      </button>
                    )}
                  </div>
                </div>
              ) : (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-3">
                  {filteredNotes.map((note) => {
                    const noteFolder = folders.find((f) => f.id === note.folderId);
                    const preview = htmlToPreviewText(note.content || '');

                    return (
                      <article
                        key={note.id}
                        onClick={() => handleOpenNoteViewer(note)}
                        className={`rounded-2xl p-2.5 sm:p-3 bg-white ios-spring-card flex flex-col h-[125px] sm:h-[135px] group cursor-pointer border transition-all overflow-hidden relative select-none ${
                          note.isPinned
                            ? 'border-amber-300/80 bg-gradient-to-b from-amber-50/20 to-white shadow-xs'
                            : 'border-neutral-200/75 hover:border-neutral-300 hover:shadow-md'
                        }`}
                        title="برای مشاهده متن کامل کلیک کنید"
                      >
                        <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
                          {/* Top Row: File icon + Quiet Folder Label + Date & Pin */}
                          <div className="flex items-center justify-between gap-1.5 mb-1 shrink-0">
                            <div className="flex items-center gap-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-neutral-100 group-hover:bg-neutral-900 group-hover:text-white text-neutral-600 flex items-center justify-center shrink-0 transition-colors shadow-2xs">
                                <FileText className="w-3 h-3" />
                              </div>

                              {noteFolder ? (
                                <div className="flex items-center gap-1 min-w-0 text-[11px] text-neutral-500 font-medium">
                                  <span
                                    className="w-1.5 h-1.5 rounded-full shrink-0"
                                    style={{ backgroundColor: noteFolder.color || '#2563eb' }}
                                  />
                                  <span className="truncate max-w-[110px]">{noteFolder.name}</span>
                                </div>
                              ) : (
                                <span className="text-[11px] text-neutral-400">عمومی</span>
                              )}
                            </div>

                            <div className="flex items-center gap-1 shrink-0">
                              <span className="text-[10px] text-neutral-400 font-mono tabular-nums">
                                {note.createdAt}
                              </span>
                              {note.isPinned && (
                                <span className="p-0.5 text-amber-500" title="سنجاق‌شده">
                                  <Pin className="w-3 h-3 fill-amber-500" />
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Title */}
                          <h3 className="text-xs sm:text-sm font-bold text-neutral-900 group-hover:text-black truncate mb-0.5 shrink-0 text-right" dir="rtl">
                            {note.title || 'بدون عنوان'}
                          </h3>

                          {/* Snippet Preview with compact font */}
                          <p className="text-[11px] text-neutral-500 line-clamp-2 leading-relaxed overflow-hidden whitespace-pre-line font-sans select-text text-right" dir="rtl">
                            {preview || 'بدون متن'}
                          </p>
                        </div>

                        {/* Bottom Row Actions - Pinned to bottom */}
                        <div className="mt-auto pt-1.5 border-t border-neutral-100 flex items-center justify-between shrink-0">
                          <span className="text-[10px] text-neutral-400 font-mono">
                            {note.updatedAt ? `ویرایش ${note.updatedAt}` : note.createdAt}
                          </span>

                          <div className="flex items-center gap-0.5">
                            {/* Pin button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onTogglePinNote(note.id, note.isPinned);
                              }}
                              className={`p-1 rounded-md cursor-pointer ios-spring-tool ${
                                note.isPinned
                                  ? 'text-amber-500 hover:text-amber-600'
                                  : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                              }`}
                              title={note.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
                            >
                              <Pin className={`w-3 h-3 ${note.isPinned ? 'fill-amber-500' : ''}`} />
                            </button>

                            {/* Copy button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleCopyText(htmlToPreviewText(note.content), 'متن یادداشت');
                              }}
                              className="p-1 text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100 rounded-md cursor-pointer ios-spring-tool"
                              title="کپی متن"
                            >
                              <Copy className="w-3 h-3" />
                            </button>

                            {/* Edit button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                onSelectNoteToEdit(note.id);
                              }}
                              className="p-1 text-neutral-400 hover:text-sky-600 hover:bg-sky-50 rounded-md cursor-pointer ios-spring-tool"
                              title="ویرایش در ویرایشگر پیشرفته"
                            >
                              <Edit2 className="w-3 h-3" />
                            </button>

                            {/* Delete button */}
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setDeletingNote(note);
                              }}
                              className="p-1 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-md cursor-pointer ios-spring-tool"
                              title="حذف"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      {/* ========================================================
          POPUP MODALS & DIALOGS
          ======================================================== */}

      {/* Clean Reader Modal (پنجره خلوت، کاملاً شارپ و با وضوح بالا برای خواندن استیکی‌نوت یا یادداشت) */}
      {viewingItem && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-5 animate-in fade-in duration-150 touch-none overscroll-contain"
          onClick={() => setViewingItem(null)}
          onTouchMove={(e) => {
            if (e.target === e.currentTarget) {
              e.preventDefault();
            }
          }}
        >
          <div
            className="bg-white rounded-3xl max-w-lg w-full p-4 sm:p-5 shadow-2xl border border-neutral-200/90 space-y-3 animate-ios-modal flex flex-col max-h-[88vh] overscroll-contain touch-auto pointer-events-auto select-auto"
            onClick={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
          >
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3.5 border-b border-neutral-100 shrink-0 gap-3">
              <div className="flex items-center gap-2 min-w-0">
                <span
                  className="w-3 h-3 rounded-full shrink-0 border border-black/10"
                  style={{ backgroundColor: viewingItem.color || '#2563eb' }}
                />
                <div className="flex items-center gap-1.5 truncate">
                  <span className="text-xs sm:text-sm font-bold text-neutral-800 truncate">
                    {viewingItem.sourceLabel}
                  </span>
                  {viewingItem.pageNumber && (
                    <span
                      className="px-2 py-0.5 rounded-md text-[11px] font-black font-mono border border-black/10 shrink-0 shadow-2xs text-black"
                      style={{
                        backgroundColor: viewingItem.color || '#fef08a',
                        color: '#000000',
                      }}
                    >
                      صفحه {viewingItem.pageNumber}
                    </span>
                  )}
                </div>
              </div>

              {/* Font Size Adjusters & Close */}
              <div className="flex items-center gap-2 shrink-0">
                <div className="flex items-center gap-0.5 bg-neutral-100 p-1 rounded-xl border border-neutral-200/80 text-xs font-bold text-neutral-600">
                  <button
                    type="button"
                    onClick={() => setReaderFontSize('normal')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-xs ${
                      readerFontSize === 'normal'
                        ? 'bg-white text-neutral-900 shadow-2xs font-extrabold'
                        : 'hover:text-neutral-900'
                    }`}
                    title="اندازه فونت استاندارد"
                  >
                    A
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderFontSize('large')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[13px] ${
                      readerFontSize === 'large'
                        ? 'bg-white text-neutral-900 shadow-2xs font-extrabold'
                        : 'hover:text-neutral-900'
                    }`}
                    title="اندازه فونت بزرگ (پیشنهادی)"
                  >
                    A+
                  </button>
                  <button
                    type="button"
                    onClick={() => setReaderFontSize('huge')}
                    className={`px-2 py-1 rounded-lg transition-colors cursor-pointer text-[14px] ${
                      readerFontSize === 'huge'
                        ? 'bg-white text-neutral-900 shadow-2xs font-extrabold'
                        : 'hover:text-neutral-900'
                    }`}
                    title="اندازه فونت بسیار بزرگ"
                  >
                    A++
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 transition-transform shrink-0 ios-spring-btn"
                  title="خروج و بستن پنجره (Esc)"
                  aria-label="خروج و بستن پنجره"
                >
                  <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
                </button>
              </div>
            </div>

            {/* Modal Title & Content with Isolated Scroll */}
            <div
              className="overflow-y-auto flex-1 space-y-3 pl-1 pr-0.5 overscroll-contain custom-column-scroll"
              dir="rtl"
              style={{
                overscrollBehavior: 'contain',
                WebkitOverflowScrolling: 'touch',
              }}
            >
              <h2 className="text-base sm:text-lg font-black text-neutral-950 leading-snug tracking-tight text-right w-full">
                {viewingItem.title}
              </h2>

              {viewingItem.type === 'sticky' ? (
                /* Styled Sticky Note Card Box with authentic paper look & high contrast, snugly wrapped around content without empty space */
                <div
                  className="px-4 py-3.5 sm:px-5 sm:py-4 rounded-2xl border border-black/10 select-text transition-all shadow-xs flex flex-col justify-center items-start text-right w-full mx-auto"
                  style={{
                    backgroundColor: viewingItem.color || '#fef08a',
                    color: '#000000',
                  }}
                  dir="rtl"
                >
                  <div
                    className={`whitespace-pre-wrap font-sans text-right w-full break-words text-neutral-950 my-auto ${
                      viewingItem.isBold ? 'font-bold' : 'font-medium'
                    } ${
                      readerFontSize === 'normal'
                        ? 'text-[14px] sm:text-[15px] leading-[1.8]'
                        : readerFontSize === 'large'
                        ? 'text-[16px] sm:text-[17px] leading-[2.0]'
                        : 'text-[18px] sm:text-[20px] leading-[2.2]'
                    }`}
                    dir="rtl"
                    style={{ color: '#000000' }}
                  >
                    {viewingItem.content || (
                      <span className="text-neutral-500 italic">بدون متن</span>
                    )}
                  </div>

                  {((viewingItem.images && viewingItem.images.length > 0) || viewingItem.imageUrl) && (
                    <div className="mt-4 pt-3.5 border-t border-black/10 w-full">
                      <div className="text-xs font-bold mb-2 opacity-80 flex items-center justify-between">
                        <span className="flex items-center gap-1.5">
                          <ImageIcon className="w-3.5 h-3.5" />
                          <span>تصاویر ضمیمه ({viewingItem.images?.length || 1}):</span>
                          <span className="text-[10px] font-normal opacity-70">
                            (برای نمایش تمام‌صفحه با قابلیت زوم کلیک کنید)
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-2.5 overflow-x-auto pb-1.5 custom-column-scroll">
                        {(viewingItem.images && viewingItem.images.length > 0
                          ? viewingItem.images
                          : [viewingItem.imageUrl!]
                        ).map((img, idx) => (
                          <div
                            key={idx}
                            onClick={() => {
                              const allImgs =
                                viewingItem.images && viewingItem.images.length > 0
                                  ? viewingItem.images
                                  : [viewingItem.imageUrl!];
                              setLightboxState({
                                images: allImgs,
                                index: idx,
                                title: viewingItem.title,
                              });
                            }}
                            className="relative w-16 h-16 sm:w-20 sm:h-20 rounded-xl overflow-hidden border border-black/15 bg-white/80 group shadow-2xs shrink-0 cursor-pointer hover:ring-2 hover:ring-black/40 transition-all select-none"
                            title="کلیک برای نمایش تمام‌صفحه و زوم"
                          >
                            <img
                              src={img}
                              alt={`تصویر ${idx + 1}`}
                              className="w-full h-full object-cover transition-transform duration-200 group-hover:scale-105 pointer-events-none"
                              loading="lazy"
                            />
                            <div className="absolute top-1 right-1 px-1.5 py-0.2 rounded-md bg-black/70 text-white text-[9px] font-mono font-bold backdrop-blur-xs">
                              {idx + 1}
                            </div>
                            <div className="absolute inset-0 bg-black/35 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center text-white">
                              <ZoomIn className="w-4 h-4 drop-shadow-xs" />
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                /* Regular Note Clean Reader with rich formatting or preserved paragraphs */
                viewingItem.rawHtml && /<[a-z][\s\S]*>/i.test(viewingItem.rawHtml) ? (
                  <div
                    dangerouslySetInnerHTML={{ __html: viewingItem.rawHtml }}
                    dir="rtl"
                    className={`text-neutral-950 leading-relaxed font-sans select-text prose max-w-none text-right prose-p:my-2.5 prose-p:leading-[2.0] prose-headings:my-3 prose-headings:text-right prose-ul:my-2 prose-li:my-1 prose-img:rounded-xl prose-img:shadow-sm ${
                      readerFontSize === 'normal'
                        ? 'text-[14px] sm:text-[15px] prose-p:text-[14px] sm:prose-p:text-[15px]'
                        : readerFontSize === 'large'
                        ? 'text-[16px] sm:text-[17px] prose-p:text-[16px] sm:prose-p:text-[17px]'
                        : 'text-[18px] sm:text-[20px] prose-p:text-[18px] sm:prose-p:text-[20px]'
                    }`}
                  />
                ) : (
                  <div
                    dir="rtl"
                    className={`text-neutral-950 leading-relaxed whitespace-pre-wrap font-sans select-text text-right w-full ${
                      readerFontSize === 'normal'
                        ? 'text-[14px] sm:text-[15px] leading-[2.0]'
                        : readerFontSize === 'large'
                        ? 'text-[16px] sm:text-[17px] leading-[2.2]'
                        : 'text-[18px] sm:text-[20px] leading-[2.4]'
                    }`}
                  >
                    {viewingItem.content || (
                      <span className="text-neutral-400 italic">بدون متن</span>
                    )}
                  </div>
                )
              )}
            </div>

            {/* Modal Footer Actions */}
            <div className="pt-3.5 border-t border-neutral-100 flex items-center justify-between shrink-0 gap-2">
              <span className="text-[11px] text-neutral-400 font-mono">
                {viewingItem.date || ''}
              </span>

              <div className="flex items-center gap-2">
                {/* Direct Jump to PDF page button if reading a sticky note */}
                {viewingItem.type === 'sticky' && viewingItem.originalEntry && onOpenFileAtPage && (
                  <button
                    type="button"
                    onClick={() => {
                      const entry = viewingItem.originalEntry!;
                      setViewingItem(null);
                      onOpenFileAtPage(entry.file, entry.note.pageNumber);
                    }}
                    className="px-3.5 py-1.5 text-xs font-bold text-neutral-800 bg-neutral-100 hover:bg-neutral-200 border border-neutral-200 rounded-xl cursor-pointer flex items-center gap-1.5"
                    title="رفتن به این صفحه در کتاب"
                  >
                    <BookOpen className="w-3.5 h-3.5 text-neutral-600" />
                    <span>مشاهده در کتاب</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => handleCopyText(htmlToPreviewText(viewingItem.rawHtml || viewingItem.content), 'متن')}
                  className="px-3 py-1.5 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer flex items-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>کپی</span>
                </button>

                {viewingItem.type === 'sticky' && viewingItem.originalEntry && (
                  <button
                    type="button"
                    onClick={() => {
                      const entry = viewingItem.originalEntry!;
                      setViewingItem(null);
                      setEditingStickyNote(entry);
                      setEditTitle(entry.note.title || '');
                      setEditContent(entry.note.content || '');
                      setEditColor(entry.note.color || '#fef08a');
                      setEditTextColor(entry.note.textColor || '#713f12');
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-sky-700 bg-sky-50 hover:bg-sky-100 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                )}

                {viewingItem.type === 'note' && viewingItem.originalNote && (
                  <button
                    type="button"
                    onClick={() => {
                      const noteId = viewingItem.originalNote!.id;
                      setViewingItem(null);
                      onSelectNoteToEdit(noteId);
                    }}
                    className="px-3 py-1.5 text-xs font-semibold text-neutral-900 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer flex items-center gap-1.5"
                  >
                    <Edit2 className="w-3.5 h-3.5" />
                    <span>ویرایش</span>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setViewingItem(null)}
                  className="px-3.5 py-1.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl cursor-pointer shadow-xs"
                >
                  بستن
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Folder Creation / Edit Modal (هماهنگ با سبک دیزاین سراسری) */}
      {isFolderModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setIsFolderModalOpen(false)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-5 sm:p-6 shadow-2xl space-y-4 animate-ios-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-900 text-white flex items-center justify-center shadow-xs">
                  <FolderPlus className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingFolder ? 'ویرایش پوشه' : 'ایجاد پوشه جدید'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsFolderModalOpen(false)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 shrink-0 transition-transform ios-spring-btn"
                title="خروج و بستن پنجره (Esc)"
                aria-label="خروج و بستن پنجره"
              >
                <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveFolder} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                  نام دسته‌بندی:
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  placeholder="مثلاً: نکات کنکور، فیزیک پایه، خلاصه‌ها..."
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                  دسته‌بندی والد (اختیاری - برای زیرمجموعه‌سازی):
                </label>
                <select
                  value={parentFolderIdInput || ''}
                  onChange={(e) => setParentFolderIdInput(e.target.value ? e.target.value : null)}
                  className="w-full px-3.5 py-2.5 bg-neutral-50 border border-neutral-200 rounded-xl text-xs sm:text-sm text-neutral-900 focus:outline-none focus:ring-2 focus:ring-neutral-900 focus:bg-white cursor-pointer"
                >
                  <option value="">بدون والد (دسته‌بندی اصلی)</option>
                  {folders
                    .filter((f) => !f.parentId && (!editingFolder || f.id !== editingFolder.id))
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.name}
                      </option>
                    ))}
                </select>
                <p className="text-[11px] text-neutral-400 mt-1">
                  با انتخاب والد، این دسته‌بندی در زیرمجموعه قرار می‌گیرد تا نوار اصلی همیشه خلوت و مرتب بماند.
                </p>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-2">
                  رنگ برچسب:
                </label>
                <div className="grid grid-cols-4 gap-2">
                  {FOLDER_COLOR_PALETTE.map((pal) => {
                    const isSelected = folderColorInput === pal.value;
                    return (
                      <button
                        key={pal.value}
                        type="button"
                        onClick={() => setFolderColorInput(pal.value)}
                        className={`py-2 px-2.5 rounded-xl border text-xs font-semibold flex items-center justify-center gap-1.5 cursor-pointer ios-spring-tool transition-all ${
                          pal.bg
                        } ${pal.text} ${
                          isSelected
                            ? 'ring-2 ring-neutral-900 border-neutral-400 shadow-xs'
                            : 'border-transparent hover:opacity-85'
                        }`}
                      >
                        <span className={`w-2.5 h-2.5 rounded-full ${pal.dot}`} />
                        <span className="text-[11px] truncate">{pal.name}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsFolderModalOpen(false)}
                  className="flex-1 py-2.5 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2.5 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl cursor-pointer shadow-xs ios-spring-btn"
                >
                  {editingFolder ? 'ذخیره تغییرات' : 'ایجاد پوشه'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Folder Confirmation Dialog */}
      {folderToDelete && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setFolderToDelete(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Folder className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف پوشه «{folderToDelete.name}»
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                با حذف این پوشه، یادداشت‌های داخل آن حذف نخواهند شد و به وضعیت «عمومی و بدون پوشه» منتقل می‌شوند.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setFolderToDelete(null)}
                className="flex-1 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmDeleteFolder}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer ios-spring-btn"
              >
                حذف پوشه
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Sticky Note Quick Edit Modal */}
      {editingStickyNote && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setEditingStickyNote(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-md w-full p-6 shadow-2xl space-y-4 animate-ios-modal"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <h3 className="text-sm font-bold text-neutral-900">
                ویرایش سریع استیکی‌نوت
              </h3>
              <button
                type="button"
                onClick={() => setEditingStickyNote(null)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 shrink-0 transition-transform ios-spring-btn"
                title="خروج و بستن پنجره (Esc)"
                aria-label="خروج و بستن پنجره"
              >
                <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveEditStickyNote} className="space-y-4">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  عنوان:
                </label>
                <input
                  type="text"
                  value={editTitle}
                  onChange={(e) => setEditTitle(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData('text/plain');
                    if (pasted) {
                      e.preventDefault();
                      const cleaned = cleanPastedMarkdown(pasted).replace(/\n/g, ' ').trim();
                      const target = e.currentTarget;
                      let inserted = false;
                      try {
                        inserted = document.execCommand('insertText', false, cleaned);
                      } catch {}
                      if (inserted) {
                        setEditTitle(target.value);
                      } else {
                        const start = target.selectionStart ?? target.value.length;
                        const end = target.selectionEnd ?? target.value.length;
                        const val = target.value;
                        const updated = val.slice(0, start) + cleaned + val.slice(end);
                        setEditTitle(updated);
                        const newPos = start + cleaned.length;
                        requestAnimationFrame(() => {
                          if (target) target.setSelectionRange(newPos, newPos);
                        });
                      }
                    }
                  }}
                  placeholder="عنوان یا کلیدواژه یادداشت..."
                  className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 text-right font-medium"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  متن برگه چسبان:
                </label>
                <textarea
                  rows={4}
                  value={editContent}
                  onChange={(e) => setEditContent(e.target.value)}
                  onPaste={(e) => {
                    const pasted = e.clipboardData?.getData('text/plain');
                    if (pasted) {
                      e.preventDefault();
                      const cleaned = cleanPastedMarkdown(pasted);
                      const target = e.currentTarget;
                      let inserted = false;
                      try {
                        inserted = document.execCommand('insertText', false, cleaned);
                      } catch {}
                      if (inserted) {
                        setEditContent(target.value);
                      } else {
                        const start = target.selectionStart ?? target.value.length;
                        const end = target.selectionEnd ?? target.value.length;
                        const val = target.value;
                        const updated = val.slice(0, start) + cleaned + val.slice(end);
                        setEditContent(updated);
                        const newPos = start + cleaned.length;
                        requestAnimationFrame(() => {
                          if (target) target.setSelectionRange(newPos, newPos);
                        });
                      }
                    }
                  }}
                  placeholder="متن یادداشت..."
                  className="w-full px-3.5 py-2.5 text-xs bg-neutral-50 border border-neutral-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-neutral-900 leading-relaxed font-sans placeholder:text-neutral-400 resize-none text-right font-medium"
                  dir="rtl"
                />
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                  رنگ برگه:
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  {PRESET_COLORS.map((c) => (
                    <button
                      key={c.bg}
                      type="button"
                      onClick={() => {
                        setEditColor(c.bg);
                        setEditTextColor(c.text);
                      }}
                      style={{ backgroundColor: c.bg }}
                      className={`w-7 h-7 rounded-full border transition-transform cursor-pointer ios-spring-tool ${
                        editColor === c.bg
                          ? 'ring-2 ring-neutral-900 scale-110 shadow-xs'
                          : 'border-black/10 hover:scale-105'
                      }`}
                      title={c.name}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setEditingStickyNote(null)}
                  className="flex-1 py-2 text-xs font-semibold text-neutral-600 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="flex-1 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl cursor-pointer shadow-xs ios-spring-btn"
                >
                  ذخیره تغییرات
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Sticky Note Dialog */}
      {deletingStickyNote && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDeletingStickyNote(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف استیکی‌نوت
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                آیا از حذف این یادداشت چسبان اطمینان دارید؟
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingStickyNote(null)}
                className="flex-1 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmDeleteStickyNote}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer ios-spring-btn"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Standalone Note Dialog */}
      {deletingNote && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200"
          onClick={() => setDeletingNote(null)}
        >
          <div
            className="bg-white rounded-3xl max-w-sm w-full p-6 shadow-2xl space-y-4 animate-ios-modal text-center"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="w-12 h-12 rounded-2xl bg-rose-50 text-rose-600 flex items-center justify-center mx-auto shadow-xs">
              <Trash2 className="w-6 h-6" />
            </div>
            <div>
              <h3 className="text-base font-bold text-neutral-900">
                حذف یادداشت
              </h3>
              <p className="text-xs text-neutral-500 mt-2 leading-relaxed">
                آیا از حذف یادداشت «{deletingNote.title || 'بدون عنوان'}» اطمینان دارید؟ این عملیات قابل بازگشت نیست.
              </p>
            </div>
            <div className="flex items-center justify-center gap-2 pt-2">
              <button
                onClick={() => setDeletingNote(null)}
                className="flex-1 py-2 text-xs font-semibold text-neutral-700 bg-neutral-100 hover:bg-neutral-200 rounded-xl cursor-pointer ios-spring-btn"
              >
                انصراف
              </button>
              <button
                onClick={handleConfirmDeleteNote}
                className="flex-1 py-2 text-xs font-bold text-white bg-rose-600 hover:bg-rose-700 rounded-xl shadow-md cursor-pointer ios-spring-btn"
              >
                بله، حذف شود
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Task Add/Edit Modal */}
      {isTaskModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-150"
          onClick={() => setIsTaskModalOpen(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-3xl p-6 sm:p-7 max-w-md w-full shadow-[0_25px_60px_-15px_rgba(0,0,0,0.25)] space-y-4 animate-ios-modal"
          >
            <div className="flex items-center justify-between pb-2">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-neutral-100 text-neutral-800 flex items-center justify-center shadow-2xs">
                  <CheckSquare className="w-4 h-4" />
                </div>
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingTask ? 'ویرایش تسک' : 'افزودن تسک جدید'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => setIsTaskModalOpen(false)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 shrink-0 transition-transform ios-spring-btn"
                title="خروج و بستن پنجره (Esc)"
                aria-label="خروج و بستن پنجره"
              >
                <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>
            </div>

            <form onSubmit={handleSaveTask} className="space-y-4">
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  عنوان تسک <span className="text-rose-500">*</span>
                </label>
                <input
                  type="text"
                  required
                  autoFocus
                  value={taskTitleInput}
                  onChange={(e) => setTaskTitleInput(e.target.value)}
                  placeholder="مثال: مطالعه فصل ۳ یا حل تمرین‌ها"
                  className="w-full px-3.5 py-2.5 rounded-xl bg-neutral-100/80 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:outline-none text-xs sm:text-sm text-neutral-900 shadow-2xs transition-all"
                />
              </div>

              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">
                  توضیحات تکمیلی (اختیاری)
                </label>
                <textarea
                  rows={3}
                  value={taskDescInput}
                  onChange={(e) => setTaskDescInput(e.target.value)}
                  placeholder="نکات مهم، منابع یا توضیحات تسک..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100/80 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:outline-none text-xs text-neutral-900 resize-none shadow-2xs transition-all"
                />
              </div>

              {/* Priority Selector */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">اولویت</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'low', label: 'عادی', color: 'bg-neutral-100 text-neutral-700 hover:bg-neutral-200/70', active: 'bg-neutral-900 text-white shadow-sm' },
                    { id: 'medium', label: 'مهم', color: 'bg-amber-100/70 text-amber-800 hover:bg-amber-100', active: 'bg-amber-600 text-white shadow-sm' },
                    { id: 'high', label: 'فوری', color: 'bg-rose-100/70 text-rose-800 hover:bg-rose-100', active: 'bg-rose-600 text-white shadow-sm' },
                  ].map((p) => (
                    <button
                      key={p.id}
                      type="button"
                      onClick={() => setTaskPriorityInput(p.id as 'low' | 'medium' | 'high')}
                      className={`py-2 text-xs font-bold rounded-xl cursor-pointer transition-all shadow-2xs ios-spring-btn ${
                        taskPriorityInput === p.id ? p.active : p.color
                      }`}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Due Date / Tag */}
              <div>
                <label className="block text-xs font-bold text-neutral-700 mb-1.5">مهلت یا زمان‌بندی (اختیاری)</label>
                <div className="flex items-center gap-1.5 flex-wrap mb-2">
                  {['امروز', 'فردا', 'این هفته'].map((chip) => (
                    <button
                      key={chip}
                      type="button"
                      onClick={() => setTaskDueDateInput(chip)}
                      className={`px-2.5 py-1 text-[11px] rounded-lg cursor-pointer transition-all ios-spring-btn ${
                        taskDueDateInput === chip
                          ? 'bg-neutral-900 text-white font-bold shadow-xs'
                          : 'bg-neutral-100 hover:bg-neutral-200/80 text-neutral-600'
                      }`}
                    >
                      {chip}
                    </button>
                  ))}
                </div>
                <input
                  type="text"
                  value={taskDueDateInput}
                  onChange={(e) => setTaskDueDateInput(e.target.value)}
                  placeholder="مثال: امروز، فردا یا تاریخ دلخواه..."
                  className="w-full px-3.5 py-2 rounded-xl bg-neutral-100/80 focus:bg-white focus:ring-2 focus:ring-neutral-900/10 focus:outline-none text-xs text-neutral-900 shadow-2xs transition-all"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsTaskModalOpen(false)}
                  className="px-4 py-2 text-xs font-bold text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl cursor-pointer ios-spring-btn"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-5 py-2 text-xs font-bold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl cursor-pointer shadow-sm hover:shadow ios-spring-btn"
                >
                  {editingTask ? 'ذخیره تغییرات' : 'افزودن تسک'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Floating Bottom Navigation Capsule with the 3 main options (یادداشت‌ها / تسک‌ها / استیکی‌نوت‌ها) */}
      <nav
        aria-label="بخش‌های اصلی برنامه"
        className="absolute bottom-2 left-1/2 -translate-x-1/2 z-40 bg-white/95 backdrop-blur-md p-1.5 rounded-full shadow-[0_8px_30px_rgba(0,0,0,0.16)] border border-neutral-200/90 grid grid-cols-3 gap-1 select-none w-[calc(100%-1.5rem)] max-w-[370px] ring-1 ring-black/5"
      >
        {/* 1. یادداشت‌ها */}
        <button
          type="button"
          onClick={() => setActiveTab('notes')}
          className={`w-full py-2 px-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ios-spring-btn whitespace-nowrap ${
            activeTab === 'notes'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
          }`}
        >
          <FileText className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">یادداشت‌ها</span>
          <span className="text-[10px] font-mono tabular-nums opacity-80">
            ({notes.length})
          </span>
        </button>

        {/* 2. تسک‌ها */}
        <button
          type="button"
          onClick={() => setActiveTab('tasks')}
          className={`w-full py-2 px-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ios-spring-btn whitespace-nowrap ${
            activeTab === 'tasks'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
          }`}
        >
          <CheckSquare className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">تسک‌ها</span>
          <span className="text-[10px] font-mono tabular-nums opacity-80">
            ({activeTasksCount})
          </span>
        </button>

        {/* 3. استیکی‌نوت‌ها */}
        <button
          type="button"
          onClick={() => setActiveTab('sticky-notes')}
          className={`w-full py-2 px-1 rounded-full text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1 ios-spring-btn whitespace-nowrap ${
            activeTab === 'sticky-notes'
              ? 'bg-neutral-900 text-white shadow-xs'
              : 'text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100/80'
          }`}
        >
          <StickyNote className="w-3.5 h-3.5 shrink-0" />
          <span className="whitespace-nowrap">استیکی‌ها</span>
          <span className="text-[10px] font-mono tabular-nums opacity-80">
            ({allStickyNotes.length})
          </span>
        </button>
      </nav>

      {/* 4. Copied Toast Notification with Jelly Physics (Positioned above floating capsule) */}
      {copiedToast && (
        <div
          className="absolute bottom-16 left-1/2 -translate-x-1/2 z-50 bg-neutral-900 text-white px-4 py-2 rounded-2xl shadow-2xl flex items-center gap-2 text-xs font-bold animate-ios-jelly whitespace-nowrap"
        >
          <Check className="w-4 h-4 text-emerald-400" />
          <span>{copiedToast}</span>
        </div>
      )}

      {/* 5. Fullscreen Interactive Lightbox Modal with Zoom & Pan */}
      {lightboxState && (
        <ImageZoomLightbox
          images={lightboxState.images}
          initialIndex={lightboxState.index}
          isOpen={Boolean(lightboxState)}
          onClose={() => setLightboxState(null)}
          title={lightboxState.title}
        />
      )}
    </div>
  );
};
