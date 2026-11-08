import { useState, useEffect, useCallback, useMemo } from 'react';
import { Settings, FileText, StickyNote } from 'lucide-react';
import { NoteItem, StudyFile, StickyNoteItem } from './types';
import { NotesView } from './components/NotesView';
import { SettingsView } from './components/SettingsView';
import { OfflineIndicator } from './components/OfflineIndicator';
import {
  getAllNotesFromStorage,
  saveAllNotesToStorage,
  getAllStudyFiles,
  saveFileEditsToStorage,
  getFileEditsFromStorage,
} from './utils/fileStorage';

const STORAGE_KEYS = {
  NOTES: 'study_workspace_notes',
};

export default function App() {
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [targetNoteIdToOpen, setTargetNoteIdToOpen] = useState<string | null>(null);
  const [studyFiles, setStudyFiles] = useState<StudyFile[]>([]);

  // Load notes from localStorage as initial state, then hydrate from IndexedDB
  const [notes, setNotes] = useState<NoteItem[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEYS.NOTES);
      if (saved) return JSON.parse(saved);
    } catch {}
    return [
      {
        id: '1',
        title: 'خوش آمدید به نسخه موبایل و PWA',
        content: 'این برنامه به صورت ۱۰۰٪ آفلاین روی آیفون، آیپد و کامپیوتر اجرا می‌شود. می‌توانید یادداشت‌های درسی، خلاصه نکات و فرمول‌های خود را در پوشه‌های مجزا ثبت و جستجو کنید.',
        createdAt: new Intl.DateTimeFormat('fa-IR').format(new Date()),
        updatedAt: new Intl.DateTimeFormat('fa-IR').format(new Date()),
        isPinned: true,
      },
    ];
  });

  // Calculate total sticky notes across all study files
  const totalStickyNotesCount = useMemo(() => {
    return studyFiles.reduce((acc, f) => acc + (f.stickyNotes?.length || 0), 0);
  }, [studyFiles]);

  // Hydrate notes and study files from IndexedDB on startup
  useEffect(() => {
    let isCancelled = false;
    const loadAllData = async () => {
      try {
        const [idbNotes, idbFiles] = await Promise.all([
          getAllNotesFromStorage(),
          getAllStudyFiles(),
        ]);
        if (isCancelled) return;

        if (idbNotes && idbNotes.length > 0) {
          setNotes(idbNotes);
          try {
            localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(idbNotes));
          } catch {}
        } else {
          // If IndexedDB empty, check localStorage
          const savedLocal = localStorage.getItem(STORAGE_KEYS.NOTES);
          if (savedLocal) {
            const parsed = JSON.parse(savedLocal);
            if (Array.isArray(parsed) && parsed.length > 0) {
              await saveAllNotesToStorage(parsed);
              if (!isCancelled) setNotes(parsed);
            }
          }
        }

        if (idbFiles && idbFiles.length > 0) {
          setStudyFiles(idbFiles);
        }
      } catch (err) {
        console.warn('Failed to load notes or files from IndexedDB:', err);
      }
    };

    loadAllData();
    return () => {
      isCancelled = true;
    };
  }, []);

  // Save notes to both IndexedDB and localStorage whenever notes change
  const persistNotes = useCallback(async (updatedNotes: NoteItem[]) => {
    setNotes(updatedNotes);
    try {
      localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(updatedNotes));
    } catch {}
    try {
      await saveAllNotesToStorage(updatedNotes);
    } catch (err) {
      console.warn('Failed to persist notes to IndexedDB:', err);
    }
  }, []);

  const handleAddNote = useCallback(
    (noteData: Omit<NoteItem, 'id' | 'createdAt' | 'updatedAt'>) => {
      const now = new Intl.DateTimeFormat('fa-IR').format(new Date());
      const newNote: NoteItem = {
        ...noteData,
        id: `note_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        createdAt: now,
        updatedAt: now,
      };

      const updated = [newNote, ...notes];
      persistNotes(updated);
      setTargetNoteIdToOpen(newNote.id);
    },
    [notes, persistNotes]
  );

  const handleUpdateNote = useCallback(
    (id: string, title: string, content: string, extra?: Partial<NoteItem>) => {
      const now = new Intl.DateTimeFormat('fa-IR').format(new Date());
      const updated = notes.map((n) =>
        n.id === id ? { ...n, title, content, updatedAt: now, ...(extra || {}) } : n
      );
      persistNotes(updated);
    },
    [notes, persistNotes]
  );

  const handleDeleteNote = useCallback(
    (id: string) => {
      const updated = notes.filter((n) => n.id !== id);
      persistNotes(updated);
      if (targetNoteIdToOpen === id) {
        setTargetNoteIdToOpen(null);
      }
    },
    [notes, persistNotes, targetNoteIdToOpen]
  );

  // Update a single sticky note inside a study file and persist
  const handleUpdateStickyNote = useCallback(
    async (fileId: string, stickyNote: StickyNoteItem) => {
      setStudyFiles((prevFiles) =>
        prevFiles.map((file) => {
          if (file.id !== fileId) return file;
          const currentNotes = file.stickyNotes || [];
          const exists = currentNotes.some((sn) => sn.id === stickyNote.id);
          const updatedNotes = exists
            ? currentNotes.map((sn) => (sn.id === stickyNote.id ? stickyNote : sn))
            : [...currentNotes, stickyNote];
          return { ...file, stickyNotes: updatedNotes };
        })
      );

      try {
        const edits = await getFileEditsFromStorage(fileId);
        const currentNotes = edits?.stickyNotes || [];
        const exists = currentNotes.some((sn) => sn.id === stickyNote.id);
        const updatedNotes = exists
          ? currentNotes.map((sn) => (sn.id === stickyNote.id ? stickyNote : sn))
          : [...currentNotes, stickyNote];

        await saveFileEditsToStorage(fileId, {
          ...(edits || { fileId, pageStrokes: {}, updatedAt: new Date().toISOString() }),
          stickyNotes: updatedNotes,
          updatedAt: new Intl.DateTimeFormat('fa-IR').format(new Date()),
        });
      } catch (err) {
        console.warn('Failed to update sticky note in storage:', err);
      }
    },
    []
  );

  // Delete a single sticky note from a study file and persist
  const handleDeleteStickyNote = useCallback(
    async (fileId: string, stickyNoteId: string) => {
      setStudyFiles((prevFiles) =>
        prevFiles.map((file) => {
          if (file.id !== fileId) return file;
          return {
            ...file,
            stickyNotes: (file.stickyNotes || []).filter((sn) => sn.id !== stickyNoteId),
          };
        })
      );

      try {
        const edits = await getFileEditsFromStorage(fileId);
        if (edits) {
          await saveFileEditsToStorage(fileId, {
            ...edits,
            stickyNotes: (edits.stickyNotes || []).filter((sn) => sn.id !== stickyNoteId),
            updatedAt: new Intl.DateTimeFormat('fa-IR').format(new Date()),
          });
        }
      } catch (err) {
        console.warn('Failed to delete sticky note in storage:', err);
      }
    },
    []
  );

  const handleRefreshAllData = useCallback(async () => {
    try {
      const [idbNotes, idbFiles] = await Promise.all([
        getAllNotesFromStorage(),
        getAllStudyFiles(),
      ]);
      if (idbNotes && idbNotes.length > 0) {
        setNotes(idbNotes);
        localStorage.setItem(STORAGE_KEYS.NOTES, JSON.stringify(idbNotes));
      }
      if (idbFiles) {
        setStudyFiles(idbFiles);
      }
    } catch (e) {
      console.warn('Refresh error:', e);
    }
  }, []);

  return (
    <div
      dir="rtl"
      className="flex flex-col bg-neutral-100 text-neutral-900 h-[100dvh] w-full select-none overflow-hidden relative"
      style={{
        paddingTop: 'max(env(safe-area-inset-top, 0px), 10px)',
        paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 10px)',
        paddingRight: 'max(env(safe-area-inset-right, 0px), 8px)',
        paddingLeft: 'max(env(safe-area-inset-left, 0px), 8px)',
      }}
    >
      {/* Offline Status Connectivity Banner */}
      <OfflineIndicator />

      {/* Sleek Minimalist Top Header with Settings Icon */}
      <header className="px-3 sm:px-4 py-2 bg-white border border-neutral-200/80 flex items-center justify-between shrink-0 shadow-xs rounded-2xl mb-2">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs">
            <FileText className="w-4 h-4 text-blue-400" />
          </div>
          <h1 className="text-xs sm:text-sm font-bold text-neutral-900">دفترچه یادداشت</h1>
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] sm:text-[11px] font-mono font-bold bg-neutral-100 text-neutral-600 px-2 py-0.5 rounded-full" title="تعداد یادداشت‌ها">
              {notes.length} یادداشت
            </span>
            {totalStickyNotesCount > 0 && (
              <span className="text-[10px] sm:text-[11px] font-mono font-bold bg-amber-100 text-amber-800 px-2 py-0.5 rounded-full flex items-center gap-1" title="تعداد استیکی‌نوت‌ها">
                <StickyNote className="w-3 h-3 text-amber-600" />
                {totalStickyNotesCount} استیکی
              </span>
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {/* Settings Icon Button */}
          <button
            type="button"
            onClick={() => setIsSettingsOpen(true)}
            className="w-8 h-8 rounded-xl bg-neutral-100 hover:bg-neutral-200 active:scale-90 text-neutral-700 flex items-center justify-center transition-all cursor-pointer shadow-2xs"
            title="تنظیمات، پشتیبان‌گیری، استیکی‌نوت‌ها و یادداشت‌ها"
            aria-label="تنظیمات و پشتیبان‌گیری"
          >
            <Settings className="w-4 h-4 text-neutral-700" />
          </button>
        </div>
      </header>

      {/* Main Full-Screen Notes Workspace */}
      <main className="flex-1 h-full overflow-hidden relative flex flex-col bg-white rounded-2xl shadow-md border border-neutral-200/80">
        <NotesView
          notes={notes}
          onAddNote={handleAddNote}
          onUpdateNote={handleUpdateNote}
          onDeleteNote={handleDeleteNote}
          studyFiles={studyFiles}
          onUpdateStickyNote={handleUpdateStickyNote}
          onDeleteStickyNote={handleDeleteStickyNote}
          initialNoteId={targetNoteIdToOpen}
        />
      </main>

      {/* Settings & Data Transfer Modal (Opens cleanly upon tapping Settings Icon) */}
      {isSettingsOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-fade-in"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setIsSettingsOpen(false);
          }}
        >
          <div className="w-full max-w-lg bg-white rounded-2xl sm:rounded-3xl shadow-2xl overflow-hidden max-h-[90vh] flex flex-col border border-neutral-100 animate-ios-modal">
            <SettingsView
              notesCount={notes.length}
              notes={notes}
              studyFiles={studyFiles}
              stickyNotesCount={totalStickyNotesCount}
              onClose={() => setIsSettingsOpen(false)}
              onDataRestored={handleRefreshAllData}
            />
          </div>
        </div>
      )}
    </div>
  );
}
