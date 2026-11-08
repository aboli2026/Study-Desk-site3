import React, { useState, useRef, useEffect, useCallback, useMemo } from 'react';
import {
  Plus,
  Trash2,
  Calendar,
  FileEdit,
  Bold,
  Italic,
  Underline,
  Strikethrough,
  Heading1,
  Heading2,
  Heading3,
  List,
  ListOrdered,
  Quote,
  Palette,
  Highlighter,
  AlignRight,
  AlignCenter,
  AlignLeft,
  Image as ImageIcon,
  Undo2,
  Redo2,
  RemoveFormatting,
  Minus,
  Search,
  Upload,
  Check,
  X,
  Copy,
  Maximize2,
  Minimize2,
  Folder as FolderIcon,
  FolderPlus,
  FolderOpen,
  Pin,
  Edit2,
  ChevronDown,
  ChevronLeft,
  Layers,
  CornerDownLeft,
  ArrowRight,
  Columns,
} from 'lucide-react';
import { NoteItem, NoteFolder, StudyFile, StickyNoteItem } from '../types';
import { NotesOverview } from './NotesOverview';

export interface NotesViewProps {
  notes: NoteItem[];
  onAddNote: (note: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>) => void;
  onUpdateNote: (id: string, title: string, content: string, extra?: Partial<NoteItem>) => void;
  onDeleteNote: (id: string) => void;
  studyFiles?: StudyFile[];
  onOpenFileAtPage?: (file: StudyFile, pageNumber: number) => void;
  onUpdateStickyNote?: (fileId: string, stickyNote: StickyNoteItem) => void;
  onDeleteStickyNote?: (fileId: string, stickyNoteId: string) => void;
  onTriggerNewFile?: () => void;
  initialNoteId?: string | null;
}

const FOLDERS_STORAGE_KEY = 'study_workspace_folders';

// Initial hierarchical folders (empty - user creates custom categories)
const DEFAULT_FOLDERS: NoteFolder[] = [];

const FOLDER_COLORS = [
  { name: 'آبی', value: '#2563eb' },
  { name: 'سبز', value: '#16a34a' },
  { name: 'نارنجی', value: '#ea580c' },
  { name: 'بنفش', value: '#7c3aed' },
  { name: 'قرمز', value: '#dc2626' },
  { name: 'فیروزه‌ای', value: '#0891b2' },
  { name: 'خاکستری', value: '#525252' },
];

// Preset Text Colors
const TEXT_COLORS = [
  { label: 'پیش‌فرض (تیره)', value: '#171717' },
  { label: 'خاکستری', value: '#525252' },
  { label: 'قرمز', value: '#dc2626' },
  { label: 'نارنجی', value: '#ea580c' },
  { label: 'کهربایی', value: '#d97706' },
  { label: 'سبز', value: '#16a34a' },
  { label: 'فیروزه‌ای', value: '#0891b2' },
  { label: 'آبی', value: '#2563eb' },
  { label: 'بنفش', value: '#7c3aed' },
  { label: 'زرشکی', value: '#e11d48' },
];

// Preset Highlight Colors
const HIGHLIGHT_COLORS = [
  { label: 'بدون هایلایت', value: 'transparent', bg: '#f3f4f6' },
  { label: 'زرد فسفری', value: '#fef08a', bg: '#fef08a' },
  { label: 'سبز روشن', value: '#bbf7d0', bg: '#bbf7d0' },
  { label: 'آبی آسمانی', value: '#bae6fd', bg: '#bae6fd' },
  { label: 'صورتی ملایم', value: '#fbcfe8', bg: '#fbcfe8' },
  { label: 'نارنجی پاستلی', value: '#fed7aa', bg: '#fed7aa' },
  { label: 'بنفش ملایم', value: '#e9d5ff', bg: '#e9d5ff' },
];

/**
 * Optimizes and compresses image to lightweight base64 Data URL
 */
function compressImage(file: File, maxWidth = 1200, maxHeight = 1200, quality = 0.85): Promise<string> {
  return new Promise((resolve, reject) => {
    if (file.type === 'image/svg+xml' || file.type === 'image/gif') {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = reject;
      reader.readAsDataURL(file);
      return;
    }

    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        let width = img.width;
        let height = img.height;
        if (width > maxWidth || height > maxHeight) {
          if (width > height) {
            height = Math.round((height * maxWidth) / width);
            width = maxWidth;
          } else {
            width = Math.round((width * maxHeight) / height);
            maxHeight = height;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(e.target?.result as string);
          return;
        }
        ctx.drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.onerror = () => resolve(e.target?.result as string);
      img.src = e.target?.result as string;
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

function getPreviewText(content: string) {
  if (!content) return 'بدون متن...';
  const hasImage = content.includes('<img');
  const text = content.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text && hasImage) return '📷 شامل تصویر';
  if (hasImage) return `📷 ${text}`;
  return text || 'بدون متن...';
}

/**
 * Recursive tree node interface
 */
interface FolderNode extends NoteFolder {
  children: FolderNode[];
}

function buildFolderTree(folders: NoteFolder[]): FolderNode[] {
  const map = new Map<string, FolderNode>();
  const roots: FolderNode[] = [];

  folders.forEach((f) => {
    map.set(f.id, { ...f, children: [] });
  });

  folders.forEach((f) => {
    const node = map.get(f.id)!;
    if (f.parentId && map.has(f.parentId)) {
      map.get(f.parentId)!.children.push(node);
    } else {
      roots.push(node);
    }
  });

  return roots;
}

function getFolderAndDescendantIds(folderId: string, folders: NoteFolder[]): string[] {
  const result: string[] = [folderId];
  const queue: string[] = [folderId];

  while (queue.length > 0) {
    const curr = queue.shift()!;
    const children = folders.filter((f) => f.parentId === curr);
    children.forEach((c) => {
      result.push(c.id);
      queue.push(c.id);
    });
  }

  return result;
}

function getFolderPath(folderId: string | undefined, folders: NoteFolder[]): NoteFolder[] {
  if (!folderId) return [];
  const path: NoteFolder[] = [];
  let curr: NoteFolder | undefined = folders.find((f) => f.id === folderId);
  while (curr) {
    path.unshift(curr);
    const parentId = curr.parentId;
    curr = parentId ? folders.find((f) => f.id === parentId) : undefined;
  }
  return path;
}

export const NotesView: React.FC<NotesViewProps> = ({
  notes,
  onAddNote,
  onUpdateNote,
  onDeleteNote,
  studyFiles,
  onOpenFileAtPage,
  onUpdateStickyNote,
  onDeleteStickyNote,
  onTriggerNewFile,
  initialNoteId,
}) => {
  // View mode: 'overview' (default dual-column review) or 'editor' (standalone note editing)
  const [viewMode, setViewMode] = useState<'overview' | 'editor'>('overview');

  useEffect(() => {
    if (initialNoteId) {
      setSelectedNoteId(initialNoteId);
      setIsCreatingNew(false);
      setViewMode('editor');
    }
  }, [initialNoteId]);

  // Folders State
  const [folders, setFolders] = useState<NoteFolder[]>(() => {
    try {
      const saved = localStorage.getItem(FOLDERS_STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed)) {
          const hasOldMocks = parsed.some((f: any) => f.id === 'f-university' || f.id === 'f-feqh');
          if (hasOldMocks) {
            localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify([]));
            return [];
          }
          return parsed;
        }
      }
    } catch {
      // Fallback
    }
    return DEFAULT_FOLDERS;
  });

  // Expanded folders in the hierarchical tree
  const [expandedFolderIds, setExpandedFolderIds] = useState<Record<string, boolean>>({});

  // Toggle folder tree panel visibility (clean & collapsible)
  const [isFolderTreeOpen, setIsFolderTreeOpen] = useState(false);

  // Selected folder filter: 'all' | 'uncategorized' | folderId
  const [selectedFolderId, setSelectedFolderId] = useState<string>('all');

  const [selectedNoteId, setSelectedNoteId] = useState<string | null>(
    notes.length > 0 ? notes[0].id : null
  );
  const [isCreatingNew, setIsCreatingNew] = useState(notes.length === 0);
  const [newTitle, setNewTitle] = useState('');
  const [newFolderId, setNewFolderId] = useState<string | undefined>(undefined);
  const [searchQuery, setSearchQuery] = useState('');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Folder Management Modal State
  const [isFolderModalOpen, setIsFolderModalOpen] = useState(false);
  const [editingFolder, setEditingFolder] = useState<NoteFolder | null>(null);
  const [parentFolderIdInput, setParentFolderIdInput] = useState<string | null>(null);
  const [folderNameInput, setFolderNameInput] = useState('');
  const [folderColorInput, setFolderColorInput] = useState(FOLDER_COLORS[0].value);

  // Note Folder Selector Dropdown in Editor
  const [isNoteFolderDropdownOpen, setIsNoteFolderDropdownOpen] = useState(false);

  // Popover state for formatting
  const [isTextColorOpen, setIsTextColorOpen] = useState(false);
  const [isHighlightColorOpen, setIsHighlightColorOpen] = useState(false);
  const [isImageModalOpen, setIsImageModalOpen] = useState(false);
  const [imageUrlInput, setImageUrlInput] = useState('');
  const [copiedNotification, setCopiedNotification] = useState(false);

  // References to contentEditable elements
  const activeEditorRef = useRef<HTMLDivElement>(null);
  const newEditorRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const lastSavedContentRef = useRef<string>('');

  const activeNote = notes.find((n) => n.id === selectedNoteId);

  // Save folders to localStorage
  useEffect(() => {
    try {
      localStorage.setItem(FOLDERS_STORAGE_KEY, JSON.stringify(folders));
    } catch (e) {
      console.warn('Failed to save folders:', e);
    }
  }, [folders]);

  // Synchronize active note content when note switches
  useEffect(() => {
    if (activeNote && activeEditorRef.current) {
      if (activeEditorRef.current.innerHTML !== activeNote.content) {
        activeEditorRef.current.innerHTML = activeNote.content || '';
        lastSavedContentRef.current = activeNote.content || '';
      }
    }
  }, [selectedNoteId, activeNote?.id]);

  // Execute standard formatting command
  const executeCommand = useCallback((command: string, value: string | undefined = undefined) => {
    document.execCommand(command, false, value);
    if (!isCreatingNew && activeNote && activeEditorRef.current) {
      const updatedHtml = activeEditorRef.current.innerHTML;
      lastSavedContentRef.current = updatedHtml;
      onUpdateNote(activeNote.id, activeNote.title, updatedHtml);
    }
  }, [isCreatingNew, activeNote, onUpdateNote]);

  // Insert image safely into editor at current selection or at the end
  const insertImageIntoEditor = useCallback((src: string, alt = 'تصویر یادداشت') => {
    const editor = isCreatingNew ? newEditorRef.current : activeEditorRef.current;
    if (!editor) return;

    editor.focus();
    const imgHtml = `<div class="my-3 text-center"><img src="${src}" alt="${alt}" class="max-w-full inline-block rounded-xl border border-neutral-200 shadow-sm max-h-[500px] object-contain hover:ring-2 hover:ring-neutral-400" /><br/></div><p><br></p>`;

    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && editor.contains(sel.getRangeAt(0).commonAncestorContainer)) {
      document.execCommand('insertHTML', false, imgHtml);
    } else {
      editor.innerHTML += imgHtml;
    }

    if (!isCreatingNew && activeNote) {
      const updatedHtml = editor.innerHTML;
      lastSavedContentRef.current = updatedHtml;
      onUpdateNote(activeNote.id, activeNote.title, updatedHtml);
    }
  }, [isCreatingNew, activeNote, onUpdateNote]);

  // Handle image upload from file picker
  const handleImageFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      const base64 = await compressImage(file);
      insertImageIntoEditor(base64, file.name);
    } catch (err) {
      console.error('Failed to process image:', err);
    } finally {
      if (fileInputRef.current) fileInputRef.current.value = '';
      setIsImageModalOpen(false);
    }
  };

  // Handle drag and drop image directly onto editor
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith('image/')) {
        try {
          const base64 = await compressImage(file);
          insertImageIntoEditor(base64, file.name);
        } catch (err) {
          console.error('Failed to process dropped image:', err);
        }
      }
    }
  };

  // Handle Ctrl+V image paste directly into editor
  const handlePaste = async (e: React.ClipboardEvent<HTMLDivElement>) => {
    const items = e.clipboardData?.items;
    if (!items) return;

    for (let i = 0; i < items.length; i++) {
      if (items[i].type.startsWith('image/')) {
        e.preventDefault();
        const file = items[i].getAsFile();
        if (file) {
          try {
            const base64 = await compressImage(file);
            insertImageIntoEditor(base64, 'تصویر پیست‌شده');
          } catch (err) {
            console.error('Failed to process pasted image:', err);
          }
        }
        return;
      }
    }
  };

  // Content change handler for active note
  const handleActiveContentInput = () => {
    if (!activeNote || !activeEditorRef.current) return;
    const html = activeEditorRef.current.innerHTML;
    lastSavedContentRef.current = html;
    onUpdateNote(activeNote.id, activeNote.title, html);
  };

  // Title change handler for active note
  const handleActiveTitleChange = (newTitleText: string) => {
    if (!activeNote) return;
    const currentHtml = activeEditorRef.current?.innerHTML || activeNote.content;
    onUpdateNote(activeNote.id, newTitleText, currentHtml);
  };

  // Change folder of active note
  const handleAssignFolder = (folderId: string | undefined) => {
    if (!activeNote) return;
    onUpdateNote(activeNote.id, activeNote.title, activeNote.content, { folderId });
    setIsNoteFolderDropdownOpen(false);
  };

  // Toggle pin status of active note
  const handleTogglePin = (noteId: string, currentPinned?: boolean) => {
    const targetNote = notes.find((n) => n.id === noteId);
    if (!targetNote) return;
    onUpdateNote(targetNote.id, targetNote.title, targetNote.content, {
      isPinned: !currentPinned,
    });
  };

  // Submit new note creation
  const handleCreateSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const content = newEditorRef.current?.innerHTML || '';
    if (!newTitle.trim() && !content.trim()) return;

    const targetFolderId =
      newFolderId !== undefined
        ? newFolderId
        : selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized'
        ? selectedFolderId
        : undefined;

    onAddNote({
      title: newTitle.trim() || 'یادداشت بدون عنوان',
      content: content.trim(),
      folderId: targetFolderId,
    });

    setNewTitle('');
    if (newEditorRef.current) newEditorRef.current.innerHTML = '';
    setIsCreatingNew(false);
    setViewMode('overview');
  };

  const handleStartNew = () => {
    setIsCreatingNew(true);
    setSelectedNoteId(null);
    setNewTitle('');
    setNewFolderId(
      selectedFolderId !== 'all' && selectedFolderId !== 'uncategorized'
        ? selectedFolderId
        : undefined
    );
    setTimeout(() => {
      if (newEditorRef.current) newEditorRef.current.innerHTML = '';
    }, 0);
  };

  // Copy plain text of note to clipboard
  const handleCopyNote = () => {
    const editor = isCreatingNew ? newEditorRef.current : activeEditorRef.current;
    if (!editor) return;
    const text = editor.innerText || '';
    navigator.clipboard.writeText(text);
    setCopiedNotification(true);
    setTimeout(() => setCopiedNotification(false), 2000);
  };

  // Save new or edited folder
  const handleSaveFolder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderNameInput.trim()) return;

    if (editingFolder) {
      setFolders((prev) =>
        prev.map((f) =>
          f.id === editingFolder.id
            ? {
                ...f,
                name: folderNameInput.trim(),
                parentId: parentFolderIdInput,
                color: folderColorInput,
              }
            : f
        )
      );
    } else {
      const newFolder: NoteFolder = {
        id: `f-${Date.now()}`,
        name: folderNameInput.trim(),
        parentId: parentFolderIdInput,
        color: folderColorInput,
        createdAt: new Date().toLocaleDateString('fa-IR'),
      };
      setFolders((prev) => [...prev, newFolder]);
      // Expand parent if added inside a parent
      if (parentFolderIdInput) {
        setExpandedFolderIds((prev) => ({ ...prev, [parentFolderIdInput]: true }));
      }
      setSelectedFolderId(newFolder.id);
    }

    setIsFolderModalOpen(false);
    setEditingFolder(null);
    setParentFolderIdInput(null);
    setFolderNameInput('');
  };

  // Delete folder
  const handleDeleteFolder = (folderId: string) => {
    if (
      confirm(
        'آیا از حذف این پوشه اطمینان دارید؟ زیرپوشه‌ها و یادداشت‌های داخل آن حذف نخواهند شد و به پوشه بالاتر منتقل می‌شوند.'
      )
    ) {
      const folderToDelete = folders.find((f) => f.id === folderId);
      const parentId = folderToDelete?.parentId || null;

      setFolders((prev) =>
        prev
          .filter((f) => f.id !== folderId)
          .map((f) => (f.parentId === folderId ? { ...f, parentId } : f))
      );

      if (selectedFolderId === folderId) {
        setSelectedFolderId('all');
      }
    }
  };

  const toggleFolderExpand = (folderId: string, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedFolderIds((prev) => ({
      ...prev,
      [folderId]: !prev[folderId],
    }));
  };

  // Build hierarchical tree
  const folderTree = useMemo(() => buildFolderTree(folders), [folders]);

  // Count notes per folder (including descendants)
  const folderCounts = useMemo(() => {
    const counts: Record<string, number> = {
      all: notes.length,
      uncategorized: 0,
    };
    folders.forEach((f) => {
      counts[f.id] = 0;
    });

    notes.forEach((note) => {
      if (!note.folderId) {
        counts.uncategorized++;
      } else {
        const familyIds = getFolderAndDescendantIds(note.folderId, folders);
        familyIds.forEach((id) => {
          if (counts[id] !== undefined) {
            // Note is direct child
          }
        });
        if (counts[note.folderId] !== undefined) {
          counts[note.folderId]++;
        }
      }
    });

    return counts;
  }, [notes, folders]);

  // Filter notes by search and selected folder, with pinned notes on top
  const filteredNotes = useMemo(() => {
    return notes
      .filter((n) => {
        // Folder filter
        if (selectedFolderId === 'all') {
          // All notes
        } else if (selectedFolderId === 'uncategorized') {
          if (n.folderId) return false;
        } else {
          // Check if note belongs to selected folder or its descendants
          const allowedFolderIds = getFolderAndDescendantIds(selectedFolderId, folders);
          if (!n.folderId || !allowedFolderIds.includes(n.folderId)) return false;
        }

        // Search filter
        if (!searchQuery.trim()) return true;
        const q = searchQuery.toLowerCase();
        const titleMatch = n.title.toLowerCase().includes(q);
        const contentMatch = (n.content || '').toLowerCase().includes(q);
        return titleMatch || contentMatch;
      })
      .sort((a, b) => {
        // Pinned notes always on top
        if (a.isPinned && !b.isPinned) return -1;
        if (!a.isPinned && b.isPinned) return 1;
        return 0;
      });
  }, [notes, selectedFolderId, searchQuery, folders]);

  // Current active note's folder
  const currentNoteFolder = useMemo(() => {
    if (isCreatingNew) {
      return folders.find((f) => f.id === newFolderId);
    }
    if (activeNote?.folderId) {
      return folders.find((f) => f.id === activeNote.folderId);
    }
    return undefined;
  }, [isCreatingNew, newFolderId, activeNote, folders]);

  // Current selected folder object for header display
  const activeSelectedFolder = useMemo(() => {
    if (selectedFolderId === 'all') return { name: 'همه یادداشت‌ها', color: '#171717' };
    if (selectedFolderId === 'uncategorized') return { name: 'عمومی و بدون پوشه', color: '#737373' };
    return folders.find((f) => f.id === selectedFolderId) || { name: 'پوشه', color: '#2563eb' };
  }, [selectedFolderId, folders]);

  // Active note breadcrumb path
  const noteBreadcrumbPath = useMemo(() => {
    const fId = isCreatingNew ? newFolderId : activeNote?.folderId;
    return getFolderPath(fId, folders);
  }, [isCreatingNew, newFolderId, activeNote?.folderId, folders]);

  // Recursive Tree Item Component for Folders
  const renderTreeItem = (node: FolderNode, level = 0) => {
    const isSelected = selectedFolderId === node.id;
    const hasChildren = node.children && node.children.length > 0;
    const isExpanded = expandedFolderIds[node.id];
    const directCount = notes.filter((n) => n.folderId === node.id).length;

    return (
      <div key={node.id} className="select-none">
        <div
          onClick={() => setSelectedFolderId(node.id)}
          style={{ paddingRight: `${level * 16 + 10}px` }}
          className={`py-1.5 pl-2 flex items-center justify-between rounded-lg cursor-pointer group text-xs transition-colors ${
            isSelected
              ? 'bg-neutral-900 text-white font-bold'
              : 'text-neutral-700 hover:bg-neutral-100 hover:text-neutral-900 font-medium'
          }`}
        >
          <div className="flex items-center gap-1.5 min-w-0">
            {hasChildren ? (
              <button
                type="button"
                onClick={(e) => toggleFolderExpand(node.id, e)}
                className={`p-0.5 rounded cursor-pointer ${
                  isSelected ? 'hover:bg-neutral-800 text-white' : 'hover:bg-neutral-200 text-neutral-400'
                }`}
              >
                {isExpanded ? (
                  <ChevronDown className="w-3 h-3" />
                ) : (
                  <ChevronLeft className="w-3 h-3" />
                )}
              </button>
            ) : (
              <span className="w-4 shrink-0" />
            )}

            <span
              className="w-2 h-2 rounded-full shrink-0"
              style={{ backgroundColor: node.color || '#2563eb' }}
            />
            <span className="truncate">{node.name}</span>
          </div>

          <div className="flex items-center gap-1 shrink-0">
            <span
              className={`font-mono text-[10px] tabular-nums ${
                isSelected ? 'text-neutral-300' : 'text-neutral-400'
              }`}
            >
              ({directCount})
            </span>

            {/* Quick Actions (Add Subfolder / Edit / Delete) */}
            <div className="hidden group-hover:flex items-center gap-0.5">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFolder(null);
                  setParentFolderIdInput(node.id);
                  setFolderNameInput('');
                  setFolderColorInput(node.color || FOLDER_COLORS[0].value);
                  setIsFolderModalOpen(true);
                }}
                className={`p-0.5 rounded cursor-pointer ${
                  isSelected ? 'hover:bg-neutral-800 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-500'
                }`}
                title="افزودن زیرپوشه به این پوشه"
              >
                <Plus className="w-3 h-3" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setEditingFolder(node);
                  setParentFolderIdInput(node.parentId || null);
                  setFolderNameInput(node.name);
                  setFolderColorInput(node.color || FOLDER_COLORS[0].value);
                  setIsFolderModalOpen(true);
                }}
                className={`p-0.5 rounded cursor-pointer ${
                  isSelected ? 'hover:bg-neutral-800 text-neutral-200' : 'hover:bg-neutral-200 text-neutral-500'
                }`}
                title="ویرایش پوشه"
              >
                <Edit2 className="w-2.5 h-2.5" />
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDeleteFolder(node.id);
                }}
                className={`p-0.5 rounded cursor-pointer ${
                  isSelected ? 'hover:bg-neutral-800 text-neutral-200' : 'hover:bg-neutral-200 text-rose-500'
                }`}
                title="حذف پوشه"
              >
                <Trash2 className="w-2.5 h-2.5" />
              </button>
            </div>
          </div>
        </div>

        {/* Nested Sub-folders */}
        {hasChildren && isExpanded && (
          <div className="space-y-0.5">
            {node.children.map((child) => renderTreeItem(child, level + 1))}
          </div>
        )}
      </div>
    );
  };

  if (viewMode === 'overview' && !isFullscreen) {
    return (
      <NotesOverview
        notes={notes}
        folders={folders}
        studyFiles={studyFiles}
        onSelectNoteToEdit={(noteId) => {
          setSelectedNoteId(noteId);
          setIsCreatingNew(false);
          setViewMode('editor');
        }}
        onStartNewNote={() => {
          handleStartNew();
          setViewMode('editor');
        }}
        onTogglePinNote={handleTogglePin}
        onDeleteNote={onDeleteNote}
        onOpenFileAtPage={onOpenFileAtPage}
        onUpdateStickyNote={onUpdateStickyNote}
        onDeleteStickyNote={onDeleteStickyNote}
        onSwitchToEditor={() => setViewMode('editor')}
        onAddFolder={(newF) => {
          const created: NoteFolder = {
            ...newF,
            id: `f-${Date.now()}`,
            createdAt: new Date().toLocaleDateString('fa-IR'),
          };
          setFolders((prev) => [...prev, created]);
        }}
        onUpdateFolder={(folderId, name, color, parentId) => {
          setFolders((prev) =>
            prev.map((f) =>
              f.id === folderId
                ? {
                    ...f,
                    name,
                    ...(color ? { color } : {}),
                    ...(parentId !== undefined ? { parentId } : {}),
                  }
                : f
            )
          );
        }}
        onDeleteFolder={handleDeleteFolder}
        onTriggerNewFile={onTriggerNewFile}
      />
    );
  }

  return (
    <div
      className={`h-full flex flex-col md:flex-row bg-white overflow-hidden relative select-auto ${
        isFullscreen ? 'fixed inset-0 z-50' : ''
      }`}
    >
      {/* Hidden File Input for Image Upload */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleImageFileChange}
        className="hidden"
      />

      {/* Folders Hierarchical Tree Sidebar (سایدبار اختصاصی و درختی پوشه‌ها) */}
      {!isFullscreen && isFolderTreeOpen && (
        <div className="w-64 border-l border-neutral-200 bg-neutral-50/90 flex flex-col h-full shrink-0 animate-ios-popover-open z-10">
          <div className="p-3 border-b border-neutral-200 flex items-center justify-between">
            <span className="text-xs font-bold text-neutral-800 flex items-center gap-1.5">
              <FolderIcon className="w-4 h-4 text-neutral-700" />
              پوشه‌ها و دسته‌ها
            </span>
            <div className="flex items-center gap-1">
              <button
                onClick={() => {
                  setEditingFolder(null);
                  setParentFolderIdInput(null);
                  setFolderNameInput('');
                  setFolderColorInput(FOLDER_COLORS[0].value);
                  setIsFolderModalOpen(true);
                }}
                className="p-1 hover:bg-neutral-200 rounded-md text-neutral-600 cursor-pointer"
                title="ایجاد پوشه اصلی جدید"
              >
                <FolderPlus className="w-3.5 h-3.5" />
              </button>
              <button
                onClick={() => setIsFolderTreeOpen(false)}
                className="p-1 hover:bg-neutral-200 rounded-md text-neutral-400 hover:text-neutral-700 cursor-pointer"
                title="بستن پنل پوشه‌ها"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto p-2 space-y-0.5">
            {/* All Notes */}
            <div
              onClick={() => setSelectedFolderId('all')}
              className={`py-1.5 px-2.5 flex items-center justify-between rounded-lg cursor-pointer text-xs transition-colors ${
                selectedFolderId === 'all'
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'text-neutral-700 hover:bg-neutral-100 font-medium'
              }`}
            >
              <span className="flex items-center gap-1.5">
                <Layers className="w-3.5 h-3.5" />
                <span>همه یادداشت‌ها</span>
              </span>
              <span className="font-mono text-[10px] tabular-nums opacity-80">
                ({notes.length})
              </span>
            </div>

            {/* Hierarchical Folder Nodes */}
            <div className="pt-1 space-y-0.5">
              {folderTree.map((node) => renderTreeItem(node, 0))}
            </div>

            {/* Uncategorized */}
            <div
              onClick={() => setSelectedFolderId('uncategorized')}
              className={`py-1.5 px-2.5 flex items-center justify-between rounded-lg cursor-pointer text-xs transition-colors mt-2 border-t border-neutral-200/60 pt-2 ${
                selectedFolderId === 'uncategorized'
                  ? 'bg-neutral-900 text-white font-bold'
                  : 'text-neutral-500 hover:bg-neutral-100 font-medium'
              }`}
            >
              <span>بدون پوشه (عمومی)</span>
              <span className="font-mono text-[10px] tabular-nums opacity-80">
                ({folderCounts.uncategorized})
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Main Notes List Sidebar (Only shown on desktop in split-view; hidden on mobile for clean full-screen editor) */}
      {!isFullscreen && (
        <div className="hidden md:flex md:w-80 border-l border-neutral-200 bg-white flex-col h-full shrink-0 overflow-hidden">
          {/* Header */}
          <div className="p-3.5 border-b border-neutral-100 space-y-2.5">
            {/* Back to 2-Column Overview button */}
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <button
                type="button"
                onClick={() => setViewMode('overview')}
                className="text-xs font-bold text-neutral-800 hover:text-neutral-950 bg-neutral-100 hover:bg-neutral-200/80 px-2.5 py-1.5 rounded-xl flex items-center gap-1.5 cursor-pointer transition-colors shadow-2xs"
                title="بازگشت به مرور یادداشت‌ها"
              >
                <ArrowRight className="w-3.5 h-3.5 text-neutral-600" />
                <span>مرور یادداشت‌ها</span>
              </button>
              <span className="text-[11px] font-semibold text-neutral-400">
                ویرایشگر یادداشت
              </span>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 min-w-0">
                {/* Toggle Folder Tree Button */}
                <button
                  type="button"
                  onClick={() => setIsFolderTreeOpen((prev) => !prev)}
                  className={`p-1.5 rounded-lg border text-xs cursor-pointer flex items-center gap-1 transition-colors ios-spring-btn ${
                    isFolderTreeOpen
                      ? 'bg-neutral-900 text-white border-neutral-900'
                      : 'bg-neutral-50 hover:bg-neutral-100 border-neutral-200 text-neutral-700'
                  }`}
                  title="نمایش یا پنهان‌سازی درخت پوشه‌ها"
                >
                  <FolderOpen className="w-3.5 h-3.5" />
                  <span className="truncate max-w-[110px] font-semibold text-[11px]">
                    {activeSelectedFolder.name}
                  </span>
                </button>

                <span className="text-[11px] text-neutral-400 font-mono tabular-nums">
                  ({filteredNotes.length})
                </span>
              </div>

              <button
                onClick={handleStartNew}
                className="px-3 py-1.5 text-xs font-semibold text-white bg-neutral-900 hover:bg-neutral-800 rounded-xl flex items-center gap-1.5 cursor-pointer shadow-xs ios-spring-btn shrink-0"
                title="ایجاد یادداشت جدید"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>یادداشت جدید</span>
              </button>
            </div>

            {/* Minimal Search Bar */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 text-neutral-400 absolute right-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="جستجو در یادداشت‌ها..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-3 pr-8 py-1.5 text-xs bg-neutral-50 hover:bg-neutral-100/70 focus:bg-white border border-neutral-200/80 rounded-xl focus:border-neutral-400 focus:outline-none transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>

          {/* Notes List */}
          <div className="flex-1 overflow-y-auto divide-y divide-neutral-100 p-2 space-y-1">
            {filteredNotes.length === 0 ? (
              <div className="p-8 text-center text-xs text-neutral-400 leading-relaxed">
                {searchQuery
                  ? 'هیچ یادداشتی با این عبارت یافت نشد.'
                  : selectedFolderId !== 'all'
                  ? 'در این پوشه هنوز یادداشتی نیست.'
                  : 'هنوز یادداشتی ثبت نشده است.'}
              </div>
            ) : (
              filteredNotes.map((note) => {
                const isSelected = !isCreatingNew && note.id === selectedNoteId;
                const noteFolder = folders.find((f) => f.id === note.folderId);
                return (
                  <div
                    key={note.id}
                    onClick={() => {
                      setSelectedNoteId(note.id);
                      setIsCreatingNew(false);
                    }}
                    className={`p-3 rounded-xl cursor-pointer text-right relative group ios-spring-card ${
                      isSelected
                        ? 'bg-white shadow-md'
                        : 'hover:bg-neutral-50/70'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex items-center gap-1.5 flex-1 min-w-0">
                        {note.isPinned && (
                          <Pin className="w-3.5 h-3.5 text-amber-500 fill-amber-500 shrink-0" />
                        )}
                        <h4 className="text-sm font-bold text-neutral-900 truncate leading-snug">
                          {note.title || 'بدون عنوان'}
                        </h4>
                      </div>

                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleTogglePin(note.id, note.isPinned);
                          }}
                          className={`p-1 rounded-md cursor-pointer ios-spring-tool ${
                            note.isPinned
                              ? 'text-amber-500 hover:text-amber-600'
                              : 'opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-neutral-700'
                          }`}
                          title={note.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن'}
                        >
                          <Pin className={`w-3.5 h-3.5 ${note.isPinned ? 'fill-amber-500' : ''}`} />
                        </button>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onDeleteNote(note.id);
                            if (selectedNoteId === note.id) setSelectedNoteId(null);
                          }}
                          className="opacity-0 group-hover:opacity-100 text-neutral-400 hover:text-rose-600 p-1 cursor-pointer rounded-md ios-spring-tool"
                          title="حذف یادداشت"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>

                    <p className="text-xs text-neutral-500 line-clamp-1 mt-1 leading-relaxed">
                      {getPreviewText(note.content)}
                    </p>

                    <div className="mt-2 flex items-center justify-between text-[10px] text-neutral-400">
                      {noteFolder ? (
                        <span
                          className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded font-medium"
                          style={{
                            backgroundColor: `${noteFolder.color}15`,
                            color: noteFolder.color,
                          }}
                        >
                          <span>{noteFolder.name}</span>
                        </span>
                      ) : (
                        <span>عمومی</span>
                      )}

                      <span className="font-mono tabular-nums">{note.createdAt}</span>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* Main Note Editor Area (Full screen on mobile, split-view on desktop) */}
      <div className="flex-1 flex flex-col h-full w-full bg-white overflow-hidden">
        {isCreatingNew ? (
          /* Creating New Note Form */
          <form onSubmit={handleCreateSubmit} className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Clean Apple Notes-style Top Bar */}
            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
              {/* Right: Back Button & Folder Chip */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setViewMode('overview');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 text-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
                  title="بازگشت به لیست یادداشت‌ها"
                >
                  <ArrowRight className="w-4 h-4 text-neutral-600" />
                  <span>یادداشت‌ها</span>
                </button>

                {/* Folder Selector Pill */}
                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsNoteFolderDropdownOpen((prev) => !prev)}
                    className="px-2.5 py-1 rounded-full border border-neutral-200/80 hover:border-neutral-300 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <FolderIcon className="w-3.5 h-3.5 text-neutral-500 shrink-0" />
                    <span className="truncate max-w-[110px] sm:max-w-[160px]">
                      {currentNoteFolder?.name || 'بدون پوشه'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                  </button>

                  {isNoteFolderDropdownOpen && (
                    <div className="absolute top-full mt-1.5 right-0 z-50 bg-white shadow-2xl rounded-xl p-1.5 min-w-[200px] space-y-0.5 animate-ios-popover-open max-h-60 overflow-y-auto">
                      <button
                        type="button"
                        onClick={() => {
                          setNewFolderId(undefined);
                          setIsNoteFolderDropdownOpen(false);
                        }}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                          !newFolderId ? 'bg-neutral-100 text-neutral-900 font-bold' : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <span>بدون پوشه (عمومی)</span>
                        {!newFolderId && <Check className="w-3 h-3" />}
                      </button>
                      {folders.map((f) => {
                        const path = getFolderPath(f.id, folders);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => {
                              setNewFolderId(f.id);
                              setIsNoteFolderDropdownOpen(false);
                            }}
                            className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                              newFolderId === f.id ? 'bg-neutral-100 text-neutral-900 font-bold' : 'hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: f.color || '#2563eb' }}
                              />
                              <span className="truncate">
                                {path.map((p) => p.name).join(' › ')}
                              </span>
                            </span>
                            {newFolderId === f.id && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Left: Action Buttons */}
              <div className="flex items-center gap-1.5 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    setIsCreatingNew(false);
                    setViewMode('overview');
                  }}
                  className="px-2.5 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 rounded-lg cursor-pointer"
                >
                  انصراف
                </button>
                <button
                  type="submit"
                  className="px-3.5 sm:px-4 py-1.5 bg-neutral-900 hover:bg-neutral-800 active:scale-95 text-white text-xs font-bold rounded-xl cursor-pointer shadow-xs flex items-center gap-1.5 transition-transform"
                >
                  <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                  <span>ذخیره</span>
                </button>
              </div>
            </div>

            {/* Rich Editor Toolbar */}
            <EditorToolbar
              onCommand={executeCommand}
              onInsertImageClick={() => setIsImageModalOpen(true)}
              isTextColorOpen={isTextColorOpen}
              setIsTextColorOpen={setIsTextColorOpen}
              isHighlightColorOpen={isHighlightColorOpen}
              setIsHighlightColorOpen={setIsHighlightColorOpen}
              onSelectTextColor={(color) => executeCommand('foreColor', color)}
              onSelectHighlightColor={(color) => executeCommand('hiliteColor', color)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
            />

            {/* Editable Content */}
            <div className="flex-1 flex flex-col p-4 sm:p-8 pb-32 overflow-y-auto max-w-3xl w-full mx-auto" dir="rtl">
              <input
                type="text"
                placeholder="عنوان یادداشت..."
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                className="w-full text-lg sm:text-2xl font-black text-neutral-900 placeholder:text-neutral-300 border-none outline-none focus:ring-0 mb-3 bg-transparent text-right tracking-tight"
                dir="rtl"
                autoFocus
              />

              <div
                ref={newEditorRef}
                contentEditable
                suppressContentEditableWarning
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                data-placeholder="اینجا بنویسید..."
                dir="rtl"
                className="flex-1 min-h-[250px] outline-none text-neutral-800 leading-relaxed text-sm sm:text-base prose max-w-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-300 empty:before:pointer-events-none text-right prose-p:text-right prose-headings:text-right"
              />
            </div>
          </form>
        ) : activeNote ? (
          /* Active Note Editor */
          <div className="flex-1 flex flex-col h-full overflow-hidden">
            {/* Clean Apple Notes-style Top Bar for Existing Note */}
            <div className="px-3.5 sm:px-6 py-2.5 sm:py-3 border-b border-neutral-100 flex items-center justify-between shrink-0 bg-white">
              {/* Right: Back Button & Folder Selector */}
              <div className="flex items-center gap-2 min-w-0">
                <button
                  type="button"
                  onClick={() => {
                    setSelectedNoteId(null);
                    setViewMode('overview');
                  }}
                  className="px-2.5 py-1.5 rounded-xl bg-neutral-100 hover:bg-neutral-200/80 active:scale-95 text-neutral-800 text-xs font-bold flex items-center gap-1.5 cursor-pointer transition-all shadow-2xs shrink-0"
                  title="بازگشت به لیست یادداشت‌ها"
                >
                  <ArrowRight className="w-4 h-4 text-neutral-600" />
                  <span>یادداشت‌ها</span>
                </button>

                <div className="relative">
                  <button
                    type="button"
                    onClick={() => setIsNoteFolderDropdownOpen((prev) => !prev)}
                    className="px-2.5 py-1 rounded-full border border-neutral-200/80 hover:border-neutral-300 text-xs font-semibold text-neutral-700 bg-neutral-50 hover:bg-neutral-100 flex items-center gap-1.5 cursor-pointer shrink-0 transition-colors"
                  >
                    <FolderIcon
                      className="w-3.5 h-3.5 shrink-0"
                      style={{ color: currentNoteFolder?.color || '#737373' }}
                    />
                    <span className="truncate max-w-[100px] sm:max-w-[150px]">
                      {currentNoteFolder?.name || 'بدون پوشه'}
                    </span>
                    <ChevronDown className="w-3 h-3 text-neutral-400 shrink-0" />
                  </button>

                  {/* Hierarchical Folder Dropdown Picker */}
                  {isNoteFolderDropdownOpen && (
                    <div className="absolute top-full mt-1.5 right-0 z-50 bg-white shadow-2xl rounded-xl p-1.5 min-w-[220px] space-y-0.5 animate-ios-popover-open max-h-64 overflow-y-auto">
                      <div className="px-2.5 py-1 text-[10px] font-bold text-neutral-400">
                        انتقال به پوشه:
                      </div>
                      <button
                        type="button"
                        onClick={() => handleAssignFolder(undefined)}
                        className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                          !activeNote.folderId ? 'bg-neutral-100 text-neutral-900 font-bold' : 'hover:bg-neutral-50 text-neutral-700'
                        }`}
                      >
                        <span>عمومی (بدون پوشه)</span>
                        {!activeNote.folderId && <Check className="w-3 h-3" />}
                      </button>
                      {folders.map((f) => {
                        const path = getFolderPath(f.id, folders);
                        return (
                          <button
                            key={f.id}
                            type="button"
                            onClick={() => handleAssignFolder(f.id)}
                            className={`w-full text-right px-2.5 py-1.5 rounded-lg text-xs font-medium flex items-center justify-between cursor-pointer ${
                              activeNote.folderId === f.id
                                ? 'bg-neutral-100 text-neutral-900 font-bold'
                                : 'hover:bg-neutral-50 text-neutral-700'
                            }`}
                          >
                            <span className="flex items-center gap-1.5 truncate">
                              <span
                                className="w-2 h-2 rounded-full shrink-0"
                                style={{ backgroundColor: f.color || '#2563eb' }}
                              />
                              <span className="truncate">
                                {path.map((p) => p.name).join(' › ')}
                              </span>
                            </span>
                            {activeNote.folderId === f.id && <Check className="w-3 h-3 shrink-0" />}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Left Actions: Pin, Copy, Delete */}
              <div className="flex items-center gap-1 shrink-0">
                <button
                  type="button"
                  onClick={() => handleTogglePin(activeNote.id, activeNote.isPinned)}
                  className={`p-1.5 rounded-lg cursor-pointer transition-colors ${
                    activeNote.isPinned
                      ? 'text-amber-500 hover:text-amber-600 bg-amber-50'
                      : 'text-neutral-400 hover:text-neutral-700 hover:bg-neutral-100'
                  }`}
                  title={activeNote.isPinned ? 'برداشتن سنجاق' : 'سنجاق کردن یادداشت'}
                >
                  <Pin className={`w-3.5 h-3.5 ${activeNote.isPinned ? 'fill-amber-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={handleCopyNote}
                  className="px-2 py-1 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-lg cursor-pointer flex items-center gap-1"
                  title="کپی متن"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span className="text-[11px]">{copiedNotification ? 'کپی شد!' : 'کپی'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    onDeleteNote(activeNote.id);
                    setSelectedNoteId(null);
                    setViewMode('overview');
                  }}
                  className="p-1.5 text-neutral-400 hover:text-rose-600 hover:bg-rose-50 rounded-lg cursor-pointer"
                  title="حذف یادداشت"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {/* Rich Editor Toolbar */}
            <EditorToolbar
              onCommand={executeCommand}
              onInsertImageClick={() => setIsImageModalOpen(true)}
              isTextColorOpen={isTextColorOpen}
              setIsTextColorOpen={setIsTextColorOpen}
              isHighlightColorOpen={isHighlightColorOpen}
              setIsHighlightColorOpen={setIsHighlightColorOpen}
              onSelectTextColor={(color) => executeCommand('foreColor', color)}
              onSelectHighlightColor={(color) => executeCommand('hiliteColor', color)}
              isFullscreen={isFullscreen}
              onToggleFullscreen={() => setIsFullscreen((prev) => !prev)}
            />

            {/* Editable Content */}
            <div className="flex-1 flex flex-col p-4 sm:p-8 pb-32 overflow-y-auto max-w-3xl w-full mx-auto" dir="rtl">
              <input
                type="text"
                value={activeNote.title}
                onChange={(e) => handleActiveTitleChange(e.target.value)}
                className="w-full text-lg sm:text-2xl font-black text-neutral-900 border-none outline-none focus:ring-0 mb-3 bg-transparent placeholder:text-neutral-300 text-right tracking-tight"
                dir="rtl"
                placeholder="عنوان یادداشت..."
              />

              <div
                ref={activeEditorRef}
                contentEditable
                suppressContentEditableWarning
                onInput={handleActiveContentInput}
                onPaste={handlePaste}
                onDrop={handleDrop}
                onDragOver={(e) => e.preventDefault()}
                data-placeholder="شروع به نوشتن کنید..."
                dir="rtl"
                className="flex-1 min-h-[250px] outline-none text-neutral-800 leading-relaxed text-sm sm:text-base prose max-w-none focus:outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-neutral-300 empty:before:pointer-events-none text-right prose-p:text-right prose-headings:text-right"
              />
            </div>
          </div>
        ) : (
          /* Empty State */
          <div className="h-full flex flex-col items-center justify-center p-6 text-center text-neutral-400 space-y-4">
            <div className="w-14 h-14 rounded-2xl bg-neutral-100 flex items-center justify-center text-neutral-400">
              <FileEdit className="w-7 h-7 stroke-[1.5]" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-neutral-800">هیچ یادداشتی باز نیست</h3>
              <p className="text-xs text-neutral-400 max-w-xs">
                یک یادداشت از لیست انتخاب کنید یا روی دکمه زیر کلیک کنید.
              </p>
            </div>
            <button
              onClick={handleStartNew}
              className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl cursor-pointer shadow-xs hover:bg-neutral-800 transition-all ios-spring-btn flex items-center gap-1.5"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>ایجاد یادداشت جدید</span>
            </button>
          </div>
        )}
      </div>

      {/* Hierarchical Folder Management Modal */}
      {isFolderModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <form
            onSubmit={handleSaveFolder}
            className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-5 space-y-4 animate-ios-modal"
          >
            <div className="flex items-center justify-between pb-2 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <FolderIcon className="w-4 h-4 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">
                  {editingFolder
                    ? 'ویرایش پوشه'
                    : parentFolderIdInput
                    ? 'افزودن زیرپوشه'
                    : 'ایجاد پوشه اصلی'}
                </h3>
              </div>
              <button
                type="button"
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setEditingFolder(null);
                  setParentFolderIdInput(null);
                }}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 shrink-0 transition-transform ios-spring-btn"
                title="خروج و بستن (Esc)"
                aria-label="خروج و بستن"
              >
                <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-3">
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  نام پوشه:
                </label>
                <input
                  type="text"
                  placeholder="مثال: حقوق مدنی، آزمون وکالت..."
                  value={folderNameInput}
                  onChange={(e) => setFolderNameInput(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:border-neutral-400 focus:outline-none"
                  autoFocus
                />
              </div>

              {/* Parent Folder Selector */}
              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1">
                  پوشه مادر (برای ایجاد زیرمجموعه):
                </label>
                <select
                  value={parentFolderIdInput || ''}
                  onChange={(e) => setParentFolderIdInput(e.target.value ? e.target.value : null)}
                  className="w-full px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:border-neutral-400 focus:outline-none bg-white"
                >
                  <option value="">(پوشه اصلی و سرشاخه - بدون مادر)</option>
                  {folders
                    .filter((f) => !editingFolder || f.id !== editingFolder.id)
                    .map((f) => (
                      <option key={f.id} value={f.id}>
                        {f.parentId ? '  ↳ ' : ''}{f.name}
                      </option>
                    ))}
                </select>
              </div>

              <div>
                <label className="text-xs font-semibold text-neutral-700 block mb-1.5">
                  رنگ اختصاصی:
                </label>
                <div className="grid grid-cols-7 gap-2">
                  {FOLDER_COLORS.map((col) => (
                    <button
                      key={col.value}
                      type="button"
                      onClick={() => setFolderColorInput(col.value)}
                      className={`w-7 h-7 rounded-xl cursor-pointer transition-all flex items-center justify-center border ${
                        folderColorInput === col.value
                          ? 'ring-2 ring-neutral-900 scale-110 border-white'
                          : 'border-transparent hover:scale-105'
                      }`}
                      style={{ backgroundColor: col.value }}
                      title={col.name}
                    >
                      {folderColorInput === col.value && (
                        <Check className="w-3.5 h-3.5 text-white stroke-[3]" />
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-100">
              <button
                type="button"
                onClick={() => {
                  setIsFolderModalOpen(false);
                  setEditingFolder(null);
                  setParentFolderIdInput(null);
                }}
                className="px-3.5 py-1.5 text-xs text-neutral-600 hover:text-neutral-900 hover:bg-neutral-100 rounded-xl cursor-pointer ios-spring-btn"
              >
                انصراف
              </button>
              <button
                type="submit"
                disabled={!folderNameInput.trim()}
                className="px-4 py-1.5 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-40 cursor-pointer shadow-xs ios-spring-btn"
              >
                {editingFolder ? 'ذخیره تغییرات' : 'ایجاد پوشه'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Image Insertion Modal */}
      {isImageModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full p-5 space-y-4 animate-ios-modal">
            <div className="flex items-center justify-between pb-3 border-b border-neutral-100">
              <div className="flex items-center gap-2">
                <ImageIcon className="w-4 h-4 text-neutral-800" />
                <h3 className="text-sm font-bold text-neutral-900">افزودن عکس به یادداشت</h3>
              </div>
              <button
                onClick={() => setIsImageModalOpen(false)}
                className="w-10 h-10 sm:w-11 sm:h-11 rounded-full bg-rose-500 hover:bg-rose-600 active:scale-90 text-white flex items-center justify-center cursor-pointer shadow-lg shadow-rose-500/30 shrink-0 transition-transform ios-spring-btn"
                title="خروج و بستن (Esc)"
                aria-label="خروج و بستن"
              >
                <X className="w-5 h-5 sm:w-5.5 sm:h-5.5 stroke-[2.5]" />
              </button>
            </div>

            <div className="space-y-4">
              {/* Option 1: File Upload */}
              <div
                onClick={() => fileInputRef.current?.click()}
                className="border-2 border-dashed border-neutral-200 hover:border-neutral-400 rounded-xl p-5 text-center cursor-pointer hover:bg-neutral-50/80 ios-spring-card group"
              >
                <Upload className="w-8 h-8 text-neutral-400 group-hover:text-neutral-700 mx-auto mb-2 transition-colors" />
                <p className="text-xs font-bold text-neutral-800">انتخاب فایل عکس از سیستم یا گوشی</p>
                <p className="text-[11px] text-neutral-400 mt-1">فرمت‌های PNG، JPG، WebP، SVG</p>
              </div>

              {/* Option 2: Image URL */}
              <div className="space-y-2 pt-2 border-t border-neutral-100">
                <label className="text-xs font-semibold text-neutral-700 block">
                  یا درج از آدرس اینترنتی (URL):
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="url"
                    placeholder="https://example.com/image.png"
                    value={imageUrlInput}
                    onChange={(e) => setImageUrlInput(e.target.value)}
                    className="flex-1 px-3 py-2 text-xs border border-neutral-200 rounded-xl focus:border-neutral-400 focus:outline-none"
                    dir="ltr"
                  />
                  <button
                    type="button"
                    disabled={!imageUrlInput.trim()}
                    onClick={() => {
                      if (imageUrlInput.trim()) {
                        insertImageIntoEditor(imageUrlInput.trim());
                        setImageUrlInput('');
                        setIsImageModalOpen(false);
                      }
                    }}
                    className="px-4 py-2 bg-neutral-900 text-white text-xs font-semibold rounded-xl hover:bg-neutral-800 disabled:opacity-40 cursor-pointer shadow-xs ios-spring-btn"
                  >
                    درج
                  </button>
                </div>
              </div>

              <div className="text-[11px] text-neutral-400 bg-neutral-50 p-2.5 rounded-xl leading-relaxed">
                💡 همچنین می‌توانید تصاویر را مستقیماً با کشیدن و رها کردن (Drag & Drop) یا با کلید میانبر <span className="font-mono font-bold text-neutral-700">Ctrl+V</span> درون متن پیست کنید!
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// ============================================================================
// Rich Text Editor Toolbar Component
// ============================================================================
interface EditorToolbarProps {
  onCommand: (command: string, value?: string) => void;
  onInsertImageClick: () => void;
  isTextColorOpen: boolean;
  setIsTextColorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  isHighlightColorOpen: boolean;
  setIsHighlightColorOpen: React.Dispatch<React.SetStateAction<boolean>>;
  onSelectTextColor: (color: string) => void;
  onSelectHighlightColor: (color: string) => void;
  isFullscreen: boolean;
  onToggleFullscreen: () => void;
}

const EditorToolbar: React.FC<EditorToolbarProps> = ({
  onCommand,
  onInsertImageClick,
  isTextColorOpen,
  setIsTextColorOpen,
  isHighlightColorOpen,
  setIsHighlightColorOpen,
  onSelectTextColor,
  onSelectHighlightColor,
  isFullscreen,
  onToggleFullscreen,
}) => {
  const handleToolbarMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
  };

  return (
    <div
      onMouseDown={handleToolbarMouseDown}
      className="px-2.5 sm:px-4 py-1.5 bg-neutral-50/95 border-b border-neutral-100 flex items-center gap-1 overflow-x-auto no-scrollbar whitespace-nowrap shrink-0 select-none text-neutral-700"
    >
      {/* Undo & Redo */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onCommand('undo')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-600 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="بازگردانی (Undo)"
        >
          <Undo2 className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('redo')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-600 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="تکرار (Redo)"
        >
          <Redo2 className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Headings & Blocks */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onCommand('formatBlock', '<h1>')}
          className="px-2 py-1 text-xs font-bold hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="تیتر ۱ (H1)"
        >
          H1
        </button>
        <button
          type="button"
          onClick={() => onCommand('formatBlock', '<h2>')}
          className="px-2 py-1 text-xs font-bold hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="تیتر ۲ (H2)"
        >
          H2
        </button>
        <button
          type="button"
          onClick={() => onCommand('formatBlock', '<p>')}
          className="px-2 py-1 text-xs hover:bg-neutral-200/80 rounded-lg text-neutral-600 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="متن عادی (Paragraph)"
        >
          P
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Text Style: Bold, Italic, Underline, Strikethrough */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onCommand('bold')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 font-bold cursor-pointer ios-spring-tool shrink-0"
          title="بولد / پررنگ (Bold - Ctrl+B)"
        >
          <Bold className="w-3.5 h-3.5 stroke-[2.5]" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('italic')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="مورب / ایتالیک (Italic - Ctrl+I)"
        >
          <Italic className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('underline')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="خط زیر (Underline - Ctrl+U)"
        >
          <Underline className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('strikeThrough')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="خط روی متن (Strikethrough)"
        >
          <Strikethrough className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Text Color Picker Popover */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsTextColorOpen((prev) => !prev);
            setIsHighlightColorOpen(false);
          }}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 flex items-center gap-1 cursor-pointer ios-spring-tool shrink-0"
          title="تغییر رنگ متن"
        >
          <Palette className="w-3.5 h-3.5 text-rose-500" />
        </button>

        {isTextColorOpen && (
          <div className="absolute top-full mt-1.5 right-0 z-50 bg-white shadow-2xl rounded-xl p-2.5 w-48 space-y-2 animate-ios-popover-open">
            <span className="text-[11px] font-bold text-neutral-600 block border-b border-neutral-100 pb-1">
              رنگ متن:
            </span>
            <div className="grid grid-cols-5 gap-1.5">
              {TEXT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onSelectTextColor(c.value);
                    setIsTextColorOpen(false);
                  }}
                  className="w-6 h-6 rounded-full hover:scale-115 transition-transform cursor-pointer shadow-sm ios-spring-tool"
                  style={{ backgroundColor: c.value }}
                  title={c.label}
                />
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Highlight Color Picker Popover */}
      <div className="relative shrink-0">
        <button
          type="button"
          onClick={() => {
            setIsHighlightColorOpen((prev) => !prev);
            setIsTextColorOpen(false);
          }}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 flex items-center gap-1 cursor-pointer ios-spring-tool shrink-0"
          title="هایلایت متن"
        >
          <Highlighter className="w-3.5 h-3.5 text-amber-500" />
        </button>

        {isHighlightColorOpen && (
          <div className="absolute top-full mt-1.5 right-0 z-50 bg-white shadow-2xl rounded-xl p-2.5 w-48 space-y-2 animate-ios-popover-open">
            <span className="text-[11px] font-bold text-neutral-600 block border-b border-neutral-100 pb-1">
              رنگ هایلایتر:
            </span>
            <div className="grid grid-cols-4 gap-1.5">
              {HIGHLIGHT_COLORS.map((c) => (
                <button
                  key={c.value}
                  type="button"
                  onClick={() => {
                    onSelectHighlightColor(c.value);
                    setIsHighlightColorOpen(false);
                  }}
                  className="w-7 h-7 rounded-lg border border-neutral-200 hover:scale-110 transition-transform cursor-pointer shadow-2xs flex items-center justify-center text-[10px] ios-spring-tool"
                  style={{ backgroundColor: c.bg }}
                  title={c.label}
                >
                  {c.value === 'transparent' ? '✕' : ''}
                </button>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Lists & Quotes */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onCommand('insertUnorderedList')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="لیست نقطه‌ای (Bullet List)"
        >
          <List className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('insertOrderedList')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="لیست عددی (Numbered List)"
        >
          <ListOrdered className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('formatBlock', '<blockquote>')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="نقل‌قول (Quote)"
        >
          <Quote className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Text Alignment */}
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          type="button"
          onClick={() => onCommand('justifyRight')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="راست‌چین (فارسی)"
        >
          <AlignRight className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('justifyCenter')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="وسط‌چین"
        >
          <AlignCenter className="w-3.5 h-3.5" />
        </button>
        <button
          type="button"
          onClick={() => onCommand('justifyLeft')}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
          title="چپ‌چین (انگلیسی)"
        >
          <AlignLeft className="w-3.5 h-3.5" />
        </button>
      </div>

      <div className="w-px h-4 bg-neutral-200 mx-0.5 shrink-0" />

      {/* Insert Image Button */}
      <button
        type="button"
        onClick={onInsertImageClick}
        className="px-2.5 py-1 text-xs font-semibold bg-white hover:bg-neutral-100 border border-neutral-200 rounded-lg text-neutral-800 flex items-center gap-1.5 cursor-pointer shadow-2xs ios-spring-tool shrink-0"
        title="افزودن تصویر به یادداشت"
      >
        <ImageIcon className="w-3.5 h-3.5 text-sky-600" />
        <span>تصویر</span>
      </button>

      {/* Insert Horizontal Rule */}
      <button
        type="button"
        onClick={() => onCommand('insertHorizontalRule')}
        className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-700 hover:text-neutral-900 cursor-pointer ios-spring-tool shrink-0"
        title="خط جداکننده (Divider)"
      >
        <Minus className="w-3.5 h-3.5" />
      </button>

      {/* Clear Formatting */}
      <button
        type="button"
        onClick={() => onCommand('removeFormat')}
        className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-500 hover:text-neutral-800 cursor-pointer ios-spring-tool shrink-0"
        title="پاک کردن فرمت"
      >
        <RemoveFormatting className="w-3.5 h-3.5" />
      </button>

      {/* Fullscreen Toggle */}
      <div className="mr-auto shrink-0">
        <button
          type="button"
          onClick={onToggleFullscreen}
          className="p-1.5 hover:bg-neutral-200/80 rounded-lg text-neutral-500 hover:text-neutral-800 cursor-pointer ios-spring-tool"
          title={isFullscreen ? 'خروج از تمام‌صفحه' : 'حالت تمام‌صفحه'}
        >
          {isFullscreen ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>
      </div>
    </div>
  );
};
