import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Apple, ArrowRight, Check, Copy, Download, ExternalLink, Laptop, Monitor, Smartphone, X, Zap } from 'lucide-react';
import { DASHBOARD_URL } from '../lib/api';

let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
}

export function useAppInstall() {
  const [canInstall, setCanInstall] = useState(!!deferredPrompt);

  useEffect(() => {
    const fn = () => setCanInstall(!!deferredPrompt);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  const triggerInstall = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      const choice = await deferredPrompt.userChoice.catch(() => null);
      if (choice?.outcome === 'accepted') {
        deferredPrompt = null;
        setCanInstall(false);
      }
      return true;
    }
    return false;
  };

  return { canInstall, triggerInstall };
}

export default function InstallAppModal({ open, onClose, defaultPlatform = 'android' }) {
  const [tab, setTab] = useState(defaultPlatform);
  const [copied, setCopied] = useState(false);
  const { canInstall, triggerInstall } = useAppInstall();

  useEffect(() => {
    if (open) setTab(defaultPlatform);
  }, [open, defaultPlatform]);

  if (!open) return null;

  const handle1ClickInstall = async () => {
    const installed = await triggerInstall();
    if (!installed) {
      // If native prompt wasn't available, redirect directly to web app dashboard
      window.location.href = `${DASHBOARD_URL}/login?install=1`;
    }
  };

  const copyUrl = () => {
    const url = `${window.location.origin}${DASHBOARD_URL}`;
    navigator.clipboard?.writeText(url).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 3000);
    });
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        {/* Backdrop */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="absolute inset-0 bg-black/80 backdrop-blur-md"
        />

        {/* Modal Window */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: 20 }}
          transition={{ duration: 0.25, ease: 'easeOut' }}
          className="relative w-full max-w-lg overflow-hidden rounded-3xl border border-green-500/30 bg-ink-900/95 p-6 shadow-2xl shadow-green-500/10 backdrop-blur-xl sm:p-8"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-5 right-5 rounded-full p-2 text-zinc-400 transition hover:bg-white/10 hover:text-white"
            aria-label="Close"
          >
            <X className="h-5 w-5" />
          </button>

          {/* Header */}
          <div className="flex items-center gap-3.5">
            <div className="grid h-12 w-12 place-items-center rounded-2xl bg-green-500 text-ink-950 shadow-lg shadow-green-500/30">
              <Zap className="h-6 w-6" fill="currentColor" strokeWidth={1.5} />
            </div>
            <div>
              <h3 className="text-xl font-bold text-white">Download ApexLedger App</h3>
              <p className="text-xs text-zinc-400">Install our verified Web App on your home screen or desktop</p>
            </div>
          </div>

          {/* Quick 1-Click Action */}
          <div className="mt-6 rounded-2xl border border-green-500/25 bg-green-500/10 p-4">
            <div className="flex flex-col items-start justify-between gap-3 sm:flex-row sm:items-center">
              <div>
                <div className="text-xs font-semibold text-green-300">Quick Installation</div>
                <div className="text-[11px] text-zinc-300">Fast, secure & always updated automatically</div>
              </div>
              <button
                onClick={handle1ClickInstall}
                className="btn-primary !py-2 !px-4 text-xs shrink-0 w-full sm:w-auto justify-center"
              >
                <Download className="h-3.5 w-3.5" />
                {canInstall ? 'Install Now (1-Click)' : 'Launch Web App'}
              </button>
            </div>
          </div>

          {/* Platform Tabs */}
          <div className="mt-6 flex gap-1.5 rounded-xl border border-white/5 bg-ink-950/80 p-1">
            {[
              { id: 'android', label: 'Android', icon: Smartphone },
              { id: 'ios', label: 'iPhone / iPad', icon: Apple },
              { id: 'desktop', label: 'Windows / Mac', icon: Monitor },
            ].map((t) => {
              const active = tab === t.id;
              const Icon = t.icon;
              return (
                <button
                  key={t.id}
                  onClick={() => setTab(t.id)}
                  className={`flex flex-1 items-center justify-center gap-1.5 rounded-lg py-2 text-xs font-medium transition ${
                    active ? 'border border-green-500/40 bg-green-500/15 text-white shadow-sm' : 'text-zinc-400 hover:text-white'
                  }`}
                >
                  <Icon className="h-3.5 w-3.5" /> {t.label}
                </button>
              );
            })}
          </div>

          {/* Platform Step-by-Step Instructions */}
          <div className="mt-5 rounded-2xl border border-white/5 bg-ink-950/60 p-4">
            {tab === 'android' && (
              <div className="space-y-3 text-xs text-zinc-300">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Smartphone className="h-4 w-4 text-green-400" /> Android Chrome Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-2 text-zinc-400 pl-1">
                  <li>
                    Tap the <b className="text-white">three dots (⋮)</b> in the top right of Chrome.
                  </li>
                  <li>
                    Select <b className="text-white">“Install app”</b> or <b className="text-white">“Add to Home screen”</b>.
                  </li>
                  <li>Confirm installation — ApexLedger will launch from your home screen like a native app.</li>
                </ol>
              </div>
            )}

            {tab === 'ios' && (
              <div className="space-y-3 text-xs text-zinc-300">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Apple className="h-4 w-4 text-green-400" /> iPhone & iPad (Safari) Instructions:
                </div>
                <ol className="list-decimal list-inside space-y-2 text-zinc-400 pl-1">
                  <li>
                    Open this page in <b className="text-white">Safari</b>.
                  </li>
                  <li>
                    Tap the <b className="text-white">Share icon (square with arrow ↑)</b> at the bottom.
                  </li>
                  <li>
                    Scroll down and tap <b className="text-white">“Add to Home Screen” (+)</b>.
                  </li>
                  <li>Tap <b className="text-white">Add</b> in the top-right corner to finish.</li>
                </ol>
              </div>
            )}

            {tab === 'desktop' && (
              <div className="space-y-3 text-xs text-zinc-300">
                <div className="font-semibold text-white flex items-center gap-2">
                  <Monitor className="h-4 w-4 text-green-400" /> Windows & Mac (Chrome / Edge):
                </div>
                <ol className="list-decimal list-inside space-y-2 text-zinc-400 pl-1">
                  <li>
                    Look at the right side of your browser’s address bar for the <b className="text-white">Install icon (⊕)</b>.
                  </li>
                  <li>
                    Click it and choose <b className="text-white">“Install”</b> to add to your desktop and taskbar.
                  </li>
                  <li>Or click the browser menu (⋮) → <b className="text-white">“Cast, save, and share”</b> → <b className="text-white">“Install page as app”</b>.</li>
                </ol>
              </div>
            )}
          </div>

          {/* Footer Controls */}
          <div className="mt-6 flex flex-col sm:flex-row items-center justify-between gap-3 pt-2">
            <button
              onClick={copyUrl}
              className="flex items-center gap-1.5 text-xs text-zinc-400 hover:text-white transition"
            >
              {copied ? <Check className="h-3.5 w-3.5 text-green-400" /> : <Copy className="h-3.5 w-3.5" />}
              {copied ? 'Link Copied!' : 'Copy Mobile App Link'}
            </button>

            <a
              href={`${DASHBOARD_URL}/login`}
              className="btn-outline !py-2 !px-4 text-xs w-full sm:w-auto justify-center"
            >
              Open in Browser <ExternalLink className="h-3.5 w-3.5" />
            </a>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
