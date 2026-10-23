import { useEffect, useState } from 'react';
import { Download } from 'lucide-react';
import { Modal } from './ui';

// Chrome/Edge/Android fire `beforeinstallprompt` once; keep it for whenever the user clicks.
let deferredPrompt = null;
const listeners = new Set();
if (typeof window !== 'undefined') {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault();
    deferredPrompt = e;
    listeners.forEach((fn) => fn());
  });
}

const isStandalone = () => window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;

export default function InstallButton({ className = '' }) {
  const [, force] = useState(0);
  const [help, setHelp] = useState(false);

  useEffect(() => {
    const fn = () => force((n) => n + 1);
    listeners.add(fn);
    return () => listeners.delete(fn);
  }, []);

  if (isStandalone()) return null;

  const install = async () => {
    if (deferredPrompt) {
      deferredPrompt.prompt();
      await deferredPrompt.userChoice.catch(() => {});
      deferredPrompt = null;
      force((n) => n + 1);
    } else {
      setHelp(true);
    }
  };

  return (
    <>
      <button onClick={install} className={`btn btn-outline btn-sm !py-2 ${className}`}>
        <Download className="h-4 w-4" /> Install App
      </button>
      <Modal open={help} onClose={() => setHelp(false)} title="Install the investor portal">
        <div className="space-y-4 text-sm text-zinc-300">
          <div>
            <div className="font-semibold text-white">iPhone & iPad (Safari)</div>
            <p className="mt-1 text-zinc-400">Tap the Share button, then choose “Add to Home Screen”.</p>
          </div>
          <div>
            <div className="font-semibold text-white">Android (Chrome)</div>
            <p className="mt-1 text-zinc-400">Open the ⋮ menu and choose “Install app” or “Add to Home screen”.</p>
          </div>
          <div>
            <div className="font-semibold text-white">Windows & macOS (Chrome / Edge)</div>
            <p className="mt-1 text-zinc-400">Click the install icon at the right of the address bar, or open the browser menu and choose “Install”.</p>
          </div>
        </div>
      </Modal>
    </>
  );
}
