import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  Download,
  Smartphone,
  CheckCircle2,
  X,
  Copy,
  Check,
  GitBranch,
} from 'lucide-react';
import { AppDatabaseState } from '../domain/ledgerEngine';
import { exportAndroidKotlinRoomProject } from '../utils/exportUtils';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

export function usePWAInstall() {
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [isInstalled, setIsInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    const isStandalone =
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as unknown as { standalone?: boolean }).standalone ===
        true;
    setIsInstalled(isStandalone);

    const userAgent = window.navigator.userAgent.toLowerCase();
    setIsIOS(/iphone|ipad|ipod/.test(userAgent));

    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };

    const handleAppInstalled = () => {
      setIsInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener(
        'beforeinstallprompt',
        handleBeforeInstallPrompt
      );
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  const install = async () => {
    if (!deferredPrompt) return false;
    await deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;
    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
      return true;
    }
    return false;
  };

  return {
    isInstallable: !!deferredPrompt,
    isInstalled,
    isIOS,
    install,
  };
}

interface PWAInstallButtonProps {
  state: AppDatabaseState;
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ state }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const [showModal, setShowModal] = useState(false);
  const [copiedGit, setCopiedGit] = useState(false);

  if (isInstalled) {
    return null;
  }

  const gitCommands = `git init
git add .
git commit -m "Initial commit: Friends Savings & Loan Manager"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main`;

  const handleCopyGit = () => {
    navigator.clipboard?.writeText(gitCommands);
    setCopiedGit(true);
    setTimeout(() => setCopiedGit(false), 2500);
  };

  const handleClick = async () => {
    if (isInstallable) {
      await install();
    } else {
      setShowModal(true);
    }
  };

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        className="px-2.5 sm:px-3.5 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 flex items-center gap-1.5 min-h-[40px]"
      >
        <Smartphone className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
        <span>Get Android APK</span>
      </button>

      {showModal &&
        createPortal(
          <div
            className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 backdrop-blur-xs p-4 overflow-y-auto"
            role="dialog"
            aria-modal="true"
            aria-labelledby="android-install-title"
          >
          <div className="w-full max-w-lg rounded-2xl bg-white border border-slate-200 p-6 shadow-xl my-8">
            <div className="flex items-start justify-between gap-4 pb-4 border-b border-slate-200">
              <div>
                <h3
                  id="android-install-title"
                  className="text-lg font-bold text-slate-900"
                >
                  Download Android APK via GitHub Actions
                </h3>
                <p className="text-xs text-slate-500 mt-0.5">
                  Preconfigured with <code className="font-mono">.github/workflows/build-android-apk.yml</code> &amp; Capacitor Android
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Close install dialog"
                className="p-2 text-slate-400 hover:text-slate-700 rounded-lg min-h-[40px] min-w-[40px] flex items-center justify-center"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="mt-4 space-y-3.5 text-sm text-slate-700">
              {/* Option 1: GitHub Actions Automatic APK Builder */}
              <div className="p-4 rounded-xl bg-emerald-50/70 border border-emerald-200 space-y-2.5">
                <div className="font-bold text-slate-900 flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2">
                    <GitBranch className="w-4 h-4 text-emerald-700 shrink-0" />
                    <span>1. Push to GitHub → Download APK Automatically</span>
                  </span>
                  <button
                    type="button"
                    onClick={handleCopyGit}
                    className="px-2.5 py-1 rounded-lg bg-white border border-emerald-300 text-emerald-800 hover:bg-emerald-100 text-xs font-semibold inline-flex items-center gap-1"
                  >
                    {copiedGit ? (
                      <>
                        <Check className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Copied</span>
                      </>
                    ) : (
                      <>
                        <Copy className="w-3.5 h-3.5" />
                        <span>Copy Git Commands</span>
                      </>
                    )}
                  </button>
                </div>
                <p className="text-xs text-slate-700 leading-relaxed">
                  This project already includes the GitHub Actions workflow{' '}
                  <code className="font-mono font-semibold text-emerald-900">
                    .github/workflows/build-android-apk.yml
                  </code>
                  . As soon as you push to GitHub, it compiles{' '}
                  <strong className="font-mono">Friends-Savings-Loan-Manager.apk</strong>{' '}
                  and attaches it to both <strong>GitHub Releases</strong> and{' '}
                  <strong>Actions Artifacts</strong>.
                </p>
                <pre className="p-3 rounded-lg bg-slate-900 text-slate-100 font-mono text-[11px] overflow-x-auto leading-relaxed">
                  {gitCommands}
                </pre>
                <div className="text-xs text-emerald-900 font-medium">
                  After pushing: Open your GitHub repo → click <strong>Actions</strong> (or <strong>Releases</strong>) → download <strong>Friends-Savings-Loan-Manager.apk</strong>!
                </div>
              </div>

              {/* Option 2: Direct Browser PWA Install */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1.5">
                <div className="font-semibold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>2. Instant Offline Install from Browser</span>
                </div>
                {isIOS ? (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Tap the <strong>Share</strong> button in Safari and select{' '}
                    <strong>Add to Home Screen</strong>.
                  </p>
                ) : (
                  <p className="text-xs text-slate-600 leading-relaxed">
                    In Chrome on Android, tap the menu (<strong>⋮</strong>) and
                    select <strong>Install app / Add to Home screen</strong> for
                    instant offline use.
                  </p>
                )}
              </div>

              {/* Option 3: Native Kotlin + Room SQLite Source */}
              <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-200 space-y-2">
                <div className="font-semibold text-slate-900 flex items-center gap-2 text-xs sm:text-sm">
                  <Download className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>3. Export Native Kotlin + Room SQLite Entities</span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    exportAndroidKotlinRoomProject(state);
                    setShowModal(false);
                  }}
                  className="w-full py-2.5 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold transition-colors flex items-center justify-center gap-2 min-h-[42px]"
                >
                  <Download className="w-4 h-4 text-emerald-400" />
                  <span>Download Kotlin &amp; Room SQLite Schema (.kt)</span>
                </button>
              </div>
            </div>

            <div className="mt-5 flex justify-end">
              <button
                type="button"
                onClick={() => setShowModal(false)}
                className="px-4 py-2 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold transition-colors min-h-[40px]"
              >
                Close
              </button>
            </div>
          </div>
        </div>,
        document.body
      )}
    </>
  );
};
