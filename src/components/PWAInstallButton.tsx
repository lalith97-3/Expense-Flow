import React, { useState } from 'react';
import { Download, Smartphone, X, CheckCircle2, Share2 } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWAInstall';

export const PWAInstallButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // If already running in standalone PWA window, do not render
  if (isInstalled) {
    return null;
  }

  // Chromium / Android / Desktop flow
  if (isInstallable) {
    return (
      <button
        onClick={install}
        className={`flex items-center gap-1.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 font-medium text-emerald-400 hover:bg-emerald-500/25 hover:border-emerald-500/50 transition shadow-sm ${
          compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
        }`}
        title="Install ExpenseFlow on this device"
      >
        <Download className="w-3.5 h-3.5" />
        <span>Install App</span>
      </button>
    );
  }

  // iOS Safari flow (beforeinstallprompt is not supported on WebKit)
  if (isIOS) {
    return (
      <>
        <button
          onClick={() => setShowIOSGuide(true)}
          className={`flex items-center gap-1.5 rounded-xl bg-slate-800/80 border border-slate-700 font-medium text-slate-300 hover:text-white hover:bg-slate-700/80 transition ${
            compact ? 'px-2.5 py-1.5 text-xs' : 'px-3 py-1.5 text-xs sm:text-sm'
          }`}
          title="Add ExpenseFlow to iPhone Home Screen"
        >
          <Smartphone className="w-3.5 h-3.5 text-emerald-400" />
          <span>Add to iPhone</span>
        </button>

        {showIOSGuide && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 backdrop-blur-sm p-4">
            <div className="w-full max-w-sm rounded-2xl bg-[#0F172A] border border-slate-800 p-6 shadow-2xl relative text-slate-200 animate-in fade-in zoom-in-95 duration-150">
              <button
                onClick={() => setShowIOSGuide(false)}
                className="absolute top-4 right-4 text-slate-400 hover:text-white p-1 rounded-lg hover:bg-slate-800 transition"
              >
                <X className="w-5 h-5" />
              </button>

              <div className="flex items-center gap-3 mb-4">
                <div className="w-10 h-10 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center">
                  <Smartphone className="w-5 h-5 text-emerald-400" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-white">Install on iPhone</h3>
                  <p className="text-xs text-slate-400">Launch ExpenseFlow in fullscreen</p>
                </div>
              </div>

              <div className="space-y-3.5 text-sm text-slate-300 py-2">
                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-emerald-400 text-xs font-bold flex items-center justify-center border border-slate-700">
                    1
                  </span>
                  <div>
                    Tap the <strong className="text-white inline-flex items-center gap-1">Share <Share2 className="w-3.5 h-3.5 text-sky-400 inline" /></strong> button in Safari's bottom toolbar.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-emerald-400 text-xs font-bold flex items-center justify-center border border-slate-700">
                    2
                  </span>
                  <div>
                    Scroll down and select <strong className="text-white">"Add to Home Screen"</strong>.
                  </div>
                </div>

                <div className="flex items-start gap-3">
                  <span className="flex-shrink-0 w-6 h-6 rounded-full bg-slate-800 text-emerald-400 text-xs font-bold flex items-center justify-center border border-slate-700">
                    3
                  </span>
                  <div>
                    Tap <strong className="text-white">Add</strong> in the top-right corner.
                  </div>
                </div>
              </div>

              <div className="mt-5 p-3 rounded-xl bg-emerald-500/10 border border-emerald-500/20 text-xs text-emerald-300 flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                <span>Runs smoothly offline with fast standalone navigation.</span>
              </div>

              <button
                onClick={() => setShowIOSGuide(false)}
                className="mt-5 w-full rounded-xl bg-slate-800 hover:bg-slate-700 py-2.5 text-sm font-medium text-white transition border border-slate-700"
              >
                Got It
              </button>
            </div>
          </div>
        )}
      </>
    );
  }

  return null;
};
