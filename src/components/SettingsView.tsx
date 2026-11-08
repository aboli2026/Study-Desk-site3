import React, { useState, useRef } from 'react';
import {
  HardDrive,
  Download,
  Upload,
  Trash2,
  CheckCircle2,
  AlertCircle,
  X,
} from 'lucide-react';
import { NoteItem } from '../types';
import { saveAllNotesToStorage, getAllNotesFromStorage } from '../utils/fileStorage';

interface SettingsViewProps {
  notesCount?: number;
  notes?: NoteItem[];
  onClose?: () => void;
  onDataRestored?: () => Promise<void> | void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
  notesCount = 0,
  notes = [],
  onClose,
  onDataRestored,
}) => {
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<{ text: string; type: 'success' | 'error' } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 1. Export Notes to standard JSON file
  const handleExportNotes = async () => {
    try {
      setIsExporting(true);
      // Ensure we get latest notes directly from storage
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

  // 2. Import Notes from JSON file
  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    try {
      setIsImporting(true);
      const text = await file.text();
      const parsed = JSON.parse(text);

      let importedNotes: NoteItem[] = [];
      if (Array.isArray(parsed)) {
        importedNotes = parsed;
      } else if (parsed && Array.isArray(parsed.notes)) {
        importedNotes = parsed.notes;
      }

      if (importedNotes.length > 0) {
        // Save to IndexedDB and LocalStorage
        await saveAllNotesToStorage(importedNotes);
        try {
          localStorage.setItem('study_workspace_notes', JSON.stringify(importedNotes));
        } catch {}

        if (onDataRestored) {
          await onDataRestored();
        }

        setStatusMessage({
          text: `تعداد ${importedNotes.length} یادداشت با موفقیت بازیابی شد.`,
          type: 'success',
        });
        setTimeout(() => setStatusMessage(null), 4500);
      } else {
        setStatusMessage({ text: 'هیچ یادداشتی در این فایل یافت نشد.', type: 'error' });
      }
    } catch (err) {
      console.warn('Import error:', err);
      setStatusMessage({ text: 'قالب فایل انتخابی معتبر نیست (باید فایل JSON یادداشت‌ها باشد).', type: 'error' });
    } finally {
      setIsImporting(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  // 3. Clear all notes
  const handleClearAllNotes = async () => {
    if (window.confirm('آیا مطمئن هستید که می‌خواهید تمام یادداشت‌ها را پاک کنید؟ این عملیات غیرقابل بازگشت است.')) {
      try {
        await saveAllNotesToStorage([]);
        try {
          localStorage.removeItem('study_workspace_notes');
        } catch {}
        if (onDataRestored) {
          await onDataRestored();
        }
        setStatusMessage({ text: 'تمامی یادداشت‌ها با موفقیت پاک شدند.', type: 'success' });
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
            <h2 className="text-xs sm:text-sm font-bold text-neutral-900">مدیریت و انتقال نوت‌ها</h2>
            <p className="text-[10px] text-neutral-400">
              اکسپورت و ایمپورت فایل JSON یادداشت‌ها
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
      <div className="flex-1 p-3 sm:p-4 overflow-y-auto max-w-xl mx-auto w-full space-y-2.5">
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

        {/* 1. Export Card (Compact) */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-600 flex items-center justify-center shrink-0">
                <Download className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-neutral-900">خروجی یادداشت‌ها (Export)</h3>
                <p className="text-[10px] text-neutral-400 truncate">
                  دانلود فایل پشتیبان استاندارد JSON
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
              <span>{isExporting ? 'در حال خروجی...' : 'دانلود JSON'}</span>
            </button>
          </div>
        </div>

        {/* 3. Import Card (Compact) */}
        <div className="bg-white rounded-xl border border-neutral-200/80 p-2.5 sm:p-3 shadow-2xs">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-2.5 min-w-0 flex-1">
              <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-600 flex items-center justify-center shrink-0">
                <Upload className="w-3.5 h-3.5" />
              </div>
              <div className="min-w-0">
                <h3 className="text-xs font-bold text-neutral-900">بازیابی یادداشت‌ها (Import)</h3>
                <p className="text-[10px] text-neutral-400 truncate">
                  انتخاب و خواندن فایل JSON پشتیبان
                </p>
              </div>
            </div>

            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isImporting}
              className="px-3 py-1.5 rounded-lg bg-neutral-900 hover:bg-neutral-800 text-white font-bold text-xs flex items-center gap-1.5 shadow-xs active:scale-95 cursor-pointer shrink-0"
            >
              <Upload className="w-3.5 h-3.5" />
              <span>{isImporting ? 'در حال بازیابی...' : 'انتخاب فایل'}</span>
            </button>
          </div>
        </div>

        {/* 4. Clear Notes Danger Zone */}
        <div className="pt-2 border-t border-neutral-100 flex items-center justify-between">
          <div>
            <h4 className="text-[11px] font-bold text-rose-600">پاکسازی کامل نوت‌ها</h4>
            <p className="text-[10px] text-neutral-400">
              حذف تمامی یادداشت‌ها از حافظه مرورگر
            </p>
          </div>
          <button
            type="button"
            onClick={handleClearAllNotes}
            className="flex items-center gap-1 px-2.5 py-1 rounded-lg border border-rose-200 text-rose-600 hover:bg-rose-50 text-[11px] font-medium transition cursor-pointer"
          >
            <Trash2 className="w-3 h-3" />
            <span>پاکسازی</span>
          </button>
        </div>
      </div>
    </div>
  );
};
