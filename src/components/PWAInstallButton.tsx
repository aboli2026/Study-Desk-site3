import React, { useState } from 'react';
import { Download, Share, PlusSquare, Smartphone, Check, X, Sparkles, Laptop, ShieldCheck } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

interface PWAInstallButtonProps {
  className?: string;
  variant?: 'compact' | 'full' | 'sidebar';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({
  className = '',
  variant = 'compact',
}) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);

  // If already installed and running standalone, show a subtle active badge or hide in compact mode
  if (isInstalled && variant === 'compact') {
    return null;
  }

  return (
    <>
      {variant === 'sidebar' ? (
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              install();
            } else {
              setShowModal(true);
            }
          }}
          className={`w-full p-2.5 rounded-xl border border-blue-500/30 bg-gradient-to-r from-blue-600/10 to-indigo-600/10 hover:from-blue-600/20 hover:to-indigo-600/20 text-blue-700 transition-all flex items-center justify-between text-xs font-bold cursor-pointer group ${className}`}
        >
          <div className="flex items-center gap-2">
            <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center shadow-xs">
              {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
            </div>
            <span>{isIOS ? 'نصب روی آیفون (PWA)' : 'نصب نسخه آفلاین PWA'}</span>
          </div>
          <span className="text-[10px] bg-blue-600 text-white px-2 py-0.5 rounded-full font-mono">
            {isInstalled ? 'نصب‌شده' : 'رایگان'}
          </span>
        </button>
      ) : variant === 'full' ? (
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              install();
            } else {
              setShowModal(true);
            }
          }}
          className={`flex items-center gap-2.5 px-4 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white text-xs sm:text-sm font-bold shadow-md shadow-blue-500/20 transition-transform active:scale-95 cursor-pointer ${className}`}
        >
          {isIOS ? <Smartphone className="w-4 h-4" /> : <Download className="w-4 h-4" />}
          <span>{isIOS ? 'راهنمای نصب روی آیفون' : 'نصب مستقیم PWA'}</span>
        </button>
      ) : (
        <button
          type="button"
          onClick={() => {
            if (isInstallable) {
              install();
            } else {
              setShowModal(true);
            }
          }}
          className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-50 text-blue-700 hover:bg-blue-100 transition-colors cursor-pointer border border-blue-200/60 ${className}`}
          title="نصب اپلیکیشن وب آفلاین (PWA)"
        >
          {isIOS ? <Smartphone className="w-3.5 h-3.5" /> : <Download className="w-3.5 h-3.5" />}
          <span className="truncate">{isIOS ? 'نصب روی آیفون' : 'نصب آفلاین'}</span>
        </button>
      )}

      {/* Guide Modal for iPhone/iPad and Desktop */}
      {showModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 overflow-y-auto animate-fade-in"
          dir="rtl"
          onClick={(e) => {
            if (e.target === e.currentTarget) setShowModal(false);
          }}
        >
          <div className="w-full max-w-md bg-white rounded-3xl shadow-2xl p-6 text-neutral-900 border border-neutral-100 relative max-h-[90vh] overflow-y-auto">
            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="absolute left-4 top-4 w-8 h-8 rounded-full bg-neutral-100 hover:bg-neutral-200 text-neutral-600 flex items-center justify-center transition-colors cursor-pointer"
            >
              <X className="w-4 h-4" />
            </button>

            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-600 to-indigo-600 text-white flex items-center justify-center shadow-lg shadow-blue-500/25 shrink-0">
                <Smartphone className="w-6 h-6" />
              </div>
              <div>
                <h3 className="text-base font-bold text-neutral-900">
                  {isIOS ? 'نصب «میز مطالعه» روی آیفون و آیپد' : 'نصب وب‌اپلیکیشن آفلاین (PWA)'}
                </h3>
                <p className="text-xs text-neutral-500 mt-0.5">
                  بدون نیاز به فایل نصبی یا اپ‌استور — کاملاً آفلاین و پرسرعت
                </p>
              </div>
            </div>

            {/* iOS specific visual step guide */}
            {isIOS ? (
              <div className="space-y-3 my-4">
                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۱
                  </div>
                  <div className="text-xs text-neutral-700 leading-relaxed">
                    در مرورگر <strong>Safari</strong> آیفون، روی دکمه اشتراک‌گذاری{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-neutral-200 text-neutral-800 font-sans mx-0.5">
                      <Share className="w-3.5 h-3.5 ml-1 text-blue-600" /> Share
                    </span>{' '}
                    در نوار پایین مرورگر ضربه بزنید.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۲
                  </div>
                  <div className="text-xs text-neutral-700 leading-relaxed">
                    کمی به پایین اسکرول کنید و گزینه{' '}
                    <span className="inline-flex items-center px-1.5 py-0.5 rounded-md bg-neutral-200 text-neutral-800 font-sans mx-0.5">
                      <PlusSquare className="w-3.5 h-3.5 ml-1 text-blue-600" /> Add to Home Screen
                    </span>{' '}
                    (افزودن به صفحه اصلی) را انتخاب کنید.
                  </div>
                </div>

                <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200/80 flex items-start gap-3">
                  <div className="w-7 h-7 rounded-xl bg-blue-600 text-white flex items-center justify-center font-bold text-xs shrink-0 mt-0.5">
                    ۳
                  </div>
                  <div className="text-xs text-neutral-700 leading-relaxed">
                    در بالای صفحه سمت راست روی دکمه <strong>Add (افزودن)</strong> بزنید. آیکون برنامه در کنار سایر برنامه‌های آیفون اضافه می‌شود و تمام‌صفحه و بدون نوار آدرس اجرا خواهد شد!
                  </div>
                </div>
              </div>
            ) : (
              <div className="space-y-3 my-4">
                <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-200 text-xs text-blue-900 leading-relaxed">
                  با نصب نسخه PWA، این برنامه درست مثل یک نرم‌افزار نیتیو در کامپیوتر یا گوشی شما ثبت می‌شود و با یک کلیک و حتی بدون اینترنت باز می‌شود.
                </div>

                {isInstallable ? (
                  <button
                    type="button"
                    onClick={async () => {
                      const res = await install();
                      if (res) setShowModal(false);
                    }}
                    className="w-full py-3 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md transition-all flex items-center justify-center gap-2 cursor-pointer"
                  >
                    <Download className="w-4 h-4" />
                    <span>نصب فوری روی دستگاه</span>
                  </button>
                ) : (
                  <div className="p-3.5 rounded-2xl bg-neutral-50 border border-neutral-200 text-xs text-neutral-700 leading-relaxed">
                    اگر از کروم، اج یا سامسونگ اینترنت استفاده می‌کنید، روی آیکون <strong>Install</strong> در کنار نوار آدرس یا منوی سه‌نقطه ضربه بزنید و <strong>Install app</strong> را انتخاب کنید.
                  </div>
                )}
              </div>
            )}

            {/* Feature Perks */}
            <div className="mt-4 pt-4 border-t border-neutral-100 grid grid-cols-2 gap-2 text-[11px] text-neutral-600">
              <div className="flex items-center gap-1.5">
                <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>۱۰۰٪ آفلاین و پرسرعت</span>
              </div>
              <div className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>بدون اشغال حافظه هارد</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Sparkles className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>نمای تمام‌صفحه نیتیو</span>
              </div>
              <div className="flex items-center gap-1.5">
                <Laptop className="w-3.5 h-3.5 text-emerald-600 shrink-0" />
                <span>پشتیبانی از آیفون، مک و ویندوز</span>
              </div>
            </div>

            <button
              type="button"
              onClick={() => setShowModal(false)}
              className="mt-5 w-full py-2.5 rounded-xl bg-neutral-100 hover:bg-neutral-200 text-neutral-800 text-xs font-bold transition-colors cursor-pointer"
            >
              متوجه شدم
            </button>
          </div>
        </div>
      )}
    </>
  );
};
