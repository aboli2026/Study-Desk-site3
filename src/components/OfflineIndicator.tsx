import React, { useEffect, useState } from 'react';
import { WifiOff, Wifi } from 'lucide-react';

export const OfflineIndicator: React.FC = () => {
  const [isOnline, setIsOnline] = useState<boolean>(
    typeof navigator !== 'undefined' ? navigator.onLine : true
  );
  const [justCameOnline, setJustCameOnline] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setJustCameOnline(true);
      const timer = setTimeout(() => setJustCameOnline(false), 4000);
      return () => clearTimeout(timer);
    };

    const handleOffline = () => {
      setIsOnline(false);
      setJustCameOnline(false);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  if (isOnline && !justCameOnline) return null;

  return (
    <div
      dir="rtl"
      className={`fixed top-4 left-1/2 -translate-x-1/2 z-50 flex items-center gap-2 px-3.5 py-2 rounded-2xl shadow-xl text-xs font-semibold backdrop-blur-md transition-all duration-300 animate-fade-in ${
        isOnline
          ? 'bg-emerald-600/90 text-white'
          : 'bg-neutral-900/90 border border-neutral-700 text-neutral-200'
      }`}
    >
      {isOnline ? (
        <>
          <Wifi className="w-4 h-4 text-emerald-300" />
          <span>اتصال برقرار شد — آنلاین</span>
        </>
      ) : (
        <>
          <span className="w-2.5 h-2.5 rounded-full bg-amber-400 animate-pulse shrink-0" />
          <WifiOff className="w-4 h-4 text-amber-400 shrink-0" />
          <span>حالت آفلاین فعال است — تمام اسناد و امکانات بدون اینترنت در دسترس هستند</span>
        </>
      )}
    </div>
  );
};
