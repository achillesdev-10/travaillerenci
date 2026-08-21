'use client';

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

/**
 *  TravaillerEnCi — src/components/layout/InstallPrompt.tsx
 *  Bouton « Installer l'application » basé sur l'événement `beforeinstallprompt`
 *  (Chrome/Android, Edge, Samsung Internet). Discret mais visible :
 *    • Desktop : libellé complet « Installer l'application 📱 ».
 *    • Mobile : icône compacte dans la barre du header.
 *  Masqué automatiquement une fois l'app installée (événement `appinstalled`)
 *  ou si le navigateur ne propose pas l'installation.
 */
export default function InstallPrompt({ compact = false }: { compact?: boolean }) {
  const [deferredPrompt, setDeferredPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [installed, setInstalled] = useState(false);
  const [isIOS, setIsIOS] = useState(false);
  const [showIOSHint, setShowIOSHint] = useState(false);

  useEffect(() => {
    const ua = navigator.userAgent;
    const iOS =
      /iPad|iPhone|iPod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    setIsIOS(iOS);

    const onBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    const onAppInstalled = () => {
      setInstalled(true);
      setDeferredPrompt(null);
    };

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt);
    window.addEventListener('appinstalled', onAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt);
      window.removeEventListener('appinstalled', onAppInstalled);
    };
  }, []);

  async function handleInstall() {
    if (!deferredPrompt) return;
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') setInstalled(true);
    setDeferredPrompt(null);
  }

  // Rien à proposer : déjà installée, ou navigateur non concerné.
  if (installed) return null;
  if (!deferredPrompt && !isIOS) return null;

  // iOS : pas de `beforeinstallprompt`, on guide vers « Partager → Sur l'écran d'accueil ».
  if (isIOS && !deferredPrompt) {
    return (
      <div className="relative">
        <button
          onClick={() => setShowIOSHint((s) => !s)}
          aria-label="Installer l'application"
          title="Installer l'application"
          className="p-2 rounded-xl border border-border bg-gray-50 dark:bg-slate-800 text-gray-700 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-slate-700 transition-colors"
        >
          📱
        </button>
        {showIOSHint && (
          <div className="absolute right-0 top-full mt-2 w-64 p-4 rounded-xl border border-border bg-white dark:bg-slate-900 shadow-xl z-50 text-sm text-gray-700 dark:text-gray-200">
            <p className="font-semibold mb-1">Installer l'application</p>
            <p>
              Sur iOS : touchez le bouton <strong>Partager</strong>{' '}
              <span aria-hidden>⎋</span> puis <strong>« Sur l'écran d'accueil »</strong>.
            </p>
          </div>
        )}
      </div>
    );
  }

  return (
    <button
      onClick={handleInstall}
      aria-label="Installer l'application"
      title="Installer l'application"
      className={
        compact
          ? 'p-2 rounded-xl border border-primary/40 bg-primary/10 text-primary hover:bg-primary/20 transition-colors'
          : 'px-4 py-2 rounded-xl border border-primary/40 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors'
      }
    >
      {compact ? '📱' : "Installer l'application 📱"}
    </button>
  );
}