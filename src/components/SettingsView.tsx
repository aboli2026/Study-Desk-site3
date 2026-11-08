import React, { useState, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
  StickyNote,
  Layers,
  FileText,
} from 'lucide-react';
import { NoteItem, StudyFile, StickyNoteItem } from '../types';
import {
  saveAllNotesToStorage,
  getAllNotesFromStorage,
  saveStudyFileToStorage,
  saveFileEditsToStorage,
  getAllStudyFiles,
  saveAllTasksToStorage,
  clearStudyFilesAndEditsStorage,
} from '../utils/fileStorage';
import {
  BACKUP_SIGNATURE,
  restoreFullWorkspaceBackup,
  downloadFullWorkspaceBackupFile,
} from '../utils/backupService';

interface SettingsViewProps {
  notesCount?: number;
  notes?: NoteItem[];
  studyFiles?: StudyFile[];
  stickyNotesCount?: number;
  onClose?: () => void;
  onDataRestored?: () => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  notesCount = 0,
  notes = [],
  studyFiles = [],
  stickyNotesCount = 0,
  onClose,
  onDataRestored,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isExportingFull, setIsExportingFull] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export Notes only to JSON file
  const handleExportNotes = async () => {
    try {
      setIsExporting(true);
      let allNotes = notes;
      if (!allNotes || allNotes.length === 0) {
        allNotes = await getAllNotesFromStorage();
      }

      const backupPayload = {
        app: 'StudyNotesPWA',
        version: '1.0',
        exportedAt: new Date().toISOString(),
        notesCount: allNotes.length,
        notes: allNotes,
      };

      const jsonStr = JSON.stringify(backupPayload, null, 2);
      const blob = new Blob([jsonStr], { type: 'application/json;charset=utf-8' });
      const url = URL.createObjectURL(blob);

      const downloadAnchor = document.createElement('a');
      const dateStr = new Date().toISOString().slice(0, 10);
      downloadAnchor.href = url;
      downloadAnchor.download = `notes-backup-${dateStr}.json`;
      document.body.appendChild(downloadAnchor);
      downloadAnchor.click();
      downloadAnchor.remove();
      URL.revokeObjectURL(url);

      setStatusMessage({
        text: `فایل پشتیبان شامل ${allNotes.length} یادداشت با موفقیت دانلود شد.`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 4000);
    } catch (err) {
      console.warn('Export error:', err);
      setStatusMessage({ text: 'خطا در خروجی گرفتن از یادداشت‌ها.', type: 'error' });
    } finally {
      setIsExporting(false);
    }
  };

  // 2. Export Full Workspace Backup (Files + Sticky Notes + Notes + Tasks)
  const handleExportFullBackup = async () => {
    try {
      setIsExportingFull(true);
      setStatusMessage({ text: 'در حال بسته‌بندی فایل‌ها، استیکی‌نوت‌ها و یادداشت‌ها...', type: 'success' });
      const res = await downloadFullWorkspaceBackupFile();
      setStatusMessage({
        text: `پشتیبان کامل شامل ${res.stats.notesCount} یادداشت و ${res.stats.stickyNotesCount} استیکی‌نوت با موفقیت دانلود شد.`,
        type: 'success',
      });
      setTimeout(() => setStatusMessage(null), 5000);
    } catch (err) {
      console.warn('Full backup export error:', err);
      setStatusMessage({ text: 'خطا در ایجاد فایل پشتیبان کامل.', type: 'error' });
    } finally {
      setIsExportingFull(false);
    }
  };

  // 3. Universal Import: Reads Full Backup, Sticky Notes, or Regular Notes
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      setStatusMessage({ text: 'در حال خواندن و تحلیل فایل پشتیبان...', type: 'success' });
      const text = await file.text();
      const parsed = JSON.parse(text);

      let restoredNotesCount = 0;
      let restoredStickyNotesCount = 0;
      let restoredFilesCount = 0;

      // Case A: Full Workspace Backup (with signature or files list)
      if (
        parsed.signature === BACKUP_SIGNATURE ||
        Array.isArray(parsed.files) ||
        (parsed.stats && (parsed.stats.filesCount > 0 || parsed.stats.stickyNotesCount > 0))
      ) {
        setStatusMessage({ text: 'در حال بازیابی فایل‌ها، استیکی‌نوت‌ها و یادداشت‌ها...', type: 'success' });
        const result = await restoreFullWorkspaceBackup(text, { mode: 'merge', restoreSettings: true });
        restoredNotesCount = result.notesRestored;
        restoredStickyNotesCount = result.stickyNotesRestored;
        restoredFilesCount = result.filesRestored;
      } else {
        // Case B: General or Custom JSON backup
        
        // 1. Extract and restore Notes
        let importedNotes: NoteItem[] = [];
        if (Array.isArray(parsed)) {
          importedNotes = parsed.filter(
            (item) => item && item.title !== undefined && item.pageNumber === undefined
          );
        } else if (parsed && Array.isArray(parsed.notes)) {
          importedNotes = parsed.notes;
        }

        if (importedNotes.length > 0) {
          const existingNotes = await getAllNotesFromStorage();
          const existingIds = new Set(existingNotes.map((n) => n.id));
          const merged = [...existingNotes];
          for (const n of importedNotes) {
            if (!existingIds.has(n.id)) {
              merged.push(n);
              existingIds.add(n.id);
            }
          }
          await saveAllNotesToStorage(merged);
          try {
            localStorage.setItem('study_workspace_notes', JSON.stringify(merged));
          } catch {}
          restoredNotesCount = importedNotes.length;
        }

        // 2. Extract and restore Sticky Notes
        let rawStickyNotes: any[] = [];
        if (Array.isArray(parsed.stickyNotes)) {
          rawStickyNotes = parsed.stickyNotes;
        } else if (Array.isArray(parsed)) {
          const stickyItems = parsed.filter(
            (item) =>
              item &&
              (item.pageNumber !== undefined ||
                item.textColor !== undefined ||
                item.color !== undefined ||
                (item.x !== undefined && item.y !== undefined))
          );
          if (stickyItems.length > 0) {
            rawStickyNotes = stickyItems;
          }
        } else if (parsed.edits && Array.isArray(parsed.edits.stickyNotes)) {
          rawStickyNotes = parsed.edits.stickyNotes;
        }

        if (rawStickyNotes.length > 0) {
          const validStickyNotes: StickyNoteItem[] = rawStickyNotes.map((s, idx) => ({
            id: s.id || `sticky_${Date.now()}_${idx}`,
            pageNumber: typeof s.pageNumber === 'number' ? s.pageNumber : 1,
            x: typeof s.x === 'number' ? s.x : 0.2,
            y: typeof s.y === 'number' ? s.y : 0.2,
            title: s.title || `استیکی نوت ${idx + 1}`,
            content: s.content || '',
            color: s.color || '#fef08a',
            textColor: s.textColor || '#171717',
            isBold: Boolean(s.isBold),
            createdAt: s.createdAt || new Intl.DateTimeFormat('fa-IR').format(new Date()),
            imageUrl: s.imageUrl,
            images: s.images || (s.imageUrl ? [s.imageUrl] : []),
          }));

          const fileId = parsed.fileId || 'imported_sticky_workspace';
          const fileName = parsed.fileName || 'استیکی‌نوت‌های وارد شده از کامپیوتر';

          const existingFiles = await getAllStudyFiles();
          const targetFile: StudyFile = existingFiles.find((f) => f.id === fileId) || {
            id: fileId,
            name: fileName,
            size: 0,
            data: new ArrayBuffer(0),
            uploadDate: new Date().toISOString(),
            pageCount: Math.max(...validStickyNotes.map((n) => n.pageNumber), 1),
            currentPage: 1,
            stickyNotes: validStickyNotes,
            pageStrokes: {},
          };

          const mergedSticky = [...(targetFile.stickyNotes || [])];
          const existingStickyIds = new Set(mergedSticky.map((s) => s.id));
          for (const s of validStickyNotes) {
            if (!existingStickyIds.has(s.id)) {
              mergedSticky.push(s);
              existingStickyIds.add(s.id);
            }
          }

          targetFile.stickyNotes = mergedSticky;
          await saveStudyFileToStorage(targetFile);
          await saveFileEditsToStorage(fileId, {
            fileId,
            stickyNotes: mergedSticky,
            pageStrokes: {},
            updatedAt: new Date().toISOString(),
          });

          restoredStickyNotesCount = validStickyNotes.length;
        }

        // 3. Extract and restore Tasks
        if (Array.isArray(parsed.tasks) && parsed.tasks.length > 0) {
          await saveAllTasksToStorage(parsed.tasks);
        }
      }

      // Notify parent to refresh in-memory state
      if (onDataRestored) {
        await onDataRestored();
      }

      if (restoredNotesCount > 0 || restoredStickyNotesCount > 0 || restoredFilesCount > 0) {
        const parts: string[] = [];
        if (restoredStickyNotesCount > 0) parts.push(`${restoredStickyNotesCount} استیکی‌نوت`);
        if (restoredNotesCount > 0) parts.push(`${restoredNotesCount} یادداشت`);
        if (restoredFilesCount > 0) parts.push(`${restoredFilesCount} فایل`);

        setStatusMessage({
          text: `بازیابی با موفقیت انجام شد: ${parts.join(' و ')} به برنامه اضافه شدند!`,
          type: 'success',
        });
        setTimeout(() => setStatusMessage(null), 5500);
      } else {
        setStatusMessage({
          text: 'هیچ یادداشت یا استیکی‌نوتی در فایل انتخابی شناسایی نشد.',
          type: 'error',
        });
      }
    } catch (err) {
      console.warn('Import error:', err);
      setStatusMessage({
        text: 'خطا در بارگذاری یا قالب فایل انتخابی نامعتبر است (باید فایل JSON معتبر باشد).',
        type: 'error',
      });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 4. Clear all data
  const handleClearAllData = async () => {
    if (
      window.confirm(
        'آیا از پاکسازی تمام یادداشت‌ها، استیکی‌نوت‌ها و فایل‌ها مطمئن هستید؟ این عملیات غیرقابل بازگشت است.'
      )
    ) {
      try {
        await Promise.all([
          saveAllNotesToStorage([]),
          clearStudyFilesAndEditsStorage(),
        ]);
        try {
          localStorage.removeItem('study_workspace_notes');
          localStorage.removeItem('study_workspace_sessions');
        } catch {}
        if (onDataRestored) {
          await onDataRestored();
        }
        setStatusMessage({ text: 'تمامی داده‌ها و استیکی‌نوت‌ها با موفقیت پاک شدند.', type: 'success' });
        setTimeout(() => setStatusMessage(null), 3500);
      } catch (err) {
        console.warn('Clear error:', err);
        setStatusMessage({ text: 'خطا در پاکسازی داده‌ها.', type: 'error' });
      }
    }
  };

  return (
    <div className="w-full h-full bg-white flex flex-col select-none overflow-hidden" dir="rtl">
      {/* Hidden File Input for Import */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileImport}
        accept=".json,application/json"
        className="hidden"
      />

      {/* Header */}
      <div className="px-3.5 sm:px-5 py-2.5 border-b border-neutral-100 flex items-center justify-between bg-neutral-50/70 shrink-0">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shadow-xs shrink-0">
            <HardDrive className="w-4 h-4 text-blue-400" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-neutral-900">پشتیبان‌گیری و انتقال داده‌ها</h2>
            <p className="text-[10px] text-neutral-400">
              مدیریت و بازیابی یادداشت‌ها، استیکی‌نوت‌ها و فایل‌های درسی
            </p>
          </div>
        </div>

        {onClose && (
          <button
            type="button"
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition cursor-pointer"
            title="بستن پنجره"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-w-xl mx-auto w-full space-y-3">
        {/* Current Workspace Stats */}
        <div className="grid grid-cols-2 gap-2 p-2.5 bg-neutral-50/80 rounded-2xl border border-neutral-200/60">
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-6 h-6 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center shrink-0">
              <FileText className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 block">یادداشت‌های متنی</span>
              <span className="text-xs font-bold text-neutral-900 font-mono">{notesCount} عدد</span>
            </div>
          </div>
          <div className="flex items-center gap-2 px-2 py-1">
            <div className="w-6 h-6 rounded-lg bg-amber-100 text-amber-600 flex items-center justify-center shrink-0">
              <StickyNote className="w-3.5 h-3.5" />
            </div>
            <div>
              <span className="text-[10px] text-neutral-500 block">استیکی‌نوت‌ها</span>
              <span className="text-xs font-bold text-neutral-900 font-mono">{stickyNotesCount} عدد</span>
            </div>
          </div>
        </div>

        {/* Status Toast Message */}
        {statusMessage && (
          <div
            className={`p-2.5 rounded-xl text-xs font-semibold flex items-center gap-2 shadow-2xs animate-fade-in ${
              statusMessage.type === 'success'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                : 'bg-rose-50 text-rose-800 border border-rose-200'
            }`}
          >
            {statusMessage.type === 'success' ? (
              <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
            ) : (
              <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            )}
            <span>{statusMessage.text}</span>
          </div>
        )}

        {/* 1. Universal Import Card (Primary Action for PC Backup File) */}
        <div className="bg-white rounded-2xl border-2 border-emerald-500/20 p-3 shadow-xs bg-linear-to-b from-emerald-50/20 to-white">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-start gap-2.5 min-w-0 flex-1">
              <div className="w-8 h-8 rounded-xl bg-emerald-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-0.5">
                <Upload className="w-4 h-4" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs sm:text-sm font-bold text-neutral-900">
                  بازیابی فایل پشتیبان کامپیوتر (Import)
                </h3>
                <p className="text-[11px] text-neutral-500 mt-0.5 leading-relaxed">
                  فایل JSON دانلود شده از کامپیوتر را انتخاب کنید تا تمامی <strong>استیکی‌نوت‌ها</strong>، یادداشت‌ها، تسک‌ها و اسناد به‌طور خودکار و کامل در آیفون بارگذاری شوند.
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs flex items-center justify-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <Upload className="w-4 h-4" />
              <span>{isImporting ? 'در حال بازیابی...' : 'انتخاب فایل JSON'}</span>
            </button>
          </div>
        </div>

        {/* 2. Full Workspace Export Card */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-neutral-900 text-white flex items-center justify-center shrink-0">
                <Layers className="w-3.5 h-3.5 text-blue-400" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-neutral-900">خروجی کامل محیط مطالعه (Full Backup)</h3>
                <p className="text-[10px] text-neutral-400 truncate">
                  شامل تمام فایل‌ها، استیکی‌نوت‌ها، خط‌کشی‌ها و یادداشت‌ها
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportFullBackup}
              disabled={isExportingFull}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExportingFull ? 'در حال خروجی...' : 'پشتیبان کامل'}</span>
            </button>
          </div>
        </div>

        {/* 3. Notes-Only Export Card */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-neutral-900">خروجی یادداشت‌های متنی</h3>
                <p className="text-[10px] text-neutral-400 truncate">
                  فقط متن یادداشت‌های دفترچه به صورت JSON سبک
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={handleExportNotes}
              disabled={isExporting}
              className="px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <Download className="w-3.5 h-3.5" />
              <span>{isExporting ? 'در حال خروجی...' : 'دانلود نوت‌ها'}</span>
            </button>
          </div>
        </div>

        {/* 4. Clear Danger Zone */}
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <div>
            <h4 className="text-[11px] font-bold text-rose-600">پاکسازی داده‌های محلی</h4>
            <p className="text-[10px] text-neutral-400">
              حذف یادداشت‌ها، استیکی‌نوت‌ها و فایل‌ها از حافظه مرورگر
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearAllData}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-medium transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>پاکسازی همه</span>
          </button>
        </div>
      </div>
    </div>
  );
};
