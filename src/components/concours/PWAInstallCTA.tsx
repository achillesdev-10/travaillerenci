'use client';

/**
 *  TravaillerEnCi — PWAInstallCTA
 *  Composant d'appel à l'action pour l'installation de la PWA.
 *  Utilise l'événement `beforeinstallprompt` (Chrome/Android, Edge).
 *  Masqué si déjà installé ou si le navigateur ne propose pas l'installation.
 *
 *  Variantes :
 *   • `default` — carte ou bouton avec icône + badge "Accès rapide & Hors-ligne"
 *   • `banner`  — bannière fixe horizontale (page Concours)
 *   • `compact` — icône seule (Footer, Header)
 */

import { useState, useEffect } from 'react';

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

interface PWAInstallCTAProps {
  /** Style d'affichage. */
  variant?: 'default' | 'banner' | 'compact';
  /** Classes CSS supplémentaires. */
  className?: string;
}

export default function PWAInstallCTA({
  variant = 'default',
  className = '',
}: PWAInstallCTAProps) {
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

  if (installed) return null;
  if (!deferredPrompt && !isIOS) return null;

  // iOS : pas de `beforeinstallprompt`, on guide vers « Partager → Sur l'écran d'accueil »
  if (isIOS && !deferredPrompt) {
    return (
      <div className={`relative ${className}`}>
        <button
          onClick={() => setShowIOSHint((s) => !s)}
          className={
            variant === 'compact'
              ? 'p-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors'
              : variant === 'banner'
                ? 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-semibold shadow-md shadow-primary/25 hover:brightness-110 transition-all'
                : 'inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm font-semibold hover:bg-primary/20 transition-colors'
          }
        >
          <span className="text-base">📱</span>
          {variant === 'compact' ? '' : "Télécharger l'App"}
        </button>
        {showIOSHint && (
          <div className="absolute right-0 top-full mt-2 w-64 p-4 rounded-xl border border-border bg-white dark:bg-slate-900 shadow-xl z-50 text-sm text-gray-700 dark:text-gray-200">
            <p className="font-semibold mb-1">Installer l&apos;application</p>
            <p>
              Sur iOS : touchez le bouton <strong>Partager</strong>{' '}
              <span aria-hidden>⎋</span> puis <strong>« Sur l&apos;écran d&apos;accueil »</strong>.
            </p>
          </div>
        )}
      </div>
    );
  }

  // Banner variant: horizontal full-width CTA
  if (variant === 'banner') {
    return (
      <div
        className={`rounded-2xl border border-primary/20 bg-gradient-to-r from-primary/5 via-primary/10 to-emerald-500/5 p-4 sm:p-5 ${className}`}
      >
        <div className="flex flex-col sm:flex-row items-center gap-3 sm:gap-4">
          <div className="flex items-center gap-3 flex-1 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
              <svg
                className="h-5 w-5"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
                <line x1="12" y1="18" x2="12.01" y2="18" />
              </svg>
            </div>
            <div className="min-w-0">
              <p className="text-sm font-bold text-gray-900 dark:text-white leading-snug">
                Restez alerté des dates de concours sur votre téléphone
              </p>
              <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">
                Accès rapide &amp; hors-ligne • Alertes push instantanées
              </p>
            </div>
          </div>
          <button
            onClick={handleInstall}
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all shrink-0"
          >
            <svg
              className="h-4 w-4"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2.5}
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
              <polyline points="7 10 12 15 17 10" />
              <line x1="12" y1="15" x2="12" y2="3" />
            </svg>
            Installer l&apos;App 📱
          </button>
        </div>
      </div>
    );
  }

  // Compact variant: icon only
  if (variant === 'compact') {
    return (
      <button
        onClick={handleInstall}
        aria-label="Installer l'application"
        title="Installer l'application"
        className={`p-2 rounded-xl border border-primary/30 bg-primary/10 text-primary text-sm hover:bg-primary/20 transition-colors ${className}`}
      >
        📱
      </button>
    );
  }

  // Default variant: card with icon + badge
  return (
    <div
      className={`rounded-2xl border border-primary/20 bg-gradient-to-br from-primary/5 to-emerald-500/5 p-4 ${className}`}
    >
      <div className="flex items-center gap-3 mb-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/15 text-primary">
          <svg
            className="h-5 w-5"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <rect x="5" y="2" width="14" height="20" rx="2" ry="2" />
            <line x1="12" y1="18" x2="12.01" y2="18" />
          </svg>
        </div>
        <div>
          <p className="text-sm font-bold text-gray-900 dark:text-white">
            Installer l&apos;application
          </p>
          <div className="flex items-center gap-1.5 mt-0.5">
            <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 text-primary px-2 py-0.5 text-[10px] font-bold">
              ⚡ Accès rapide
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 px-2 py-0.5 text-[10px] font-bold">
              📴 Hors-ligne
            </span>
          </div>
        </div>
      </div>
      <button
        onClick={handleInstall}
        className="w-full inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-bold shadow-md shadow-primary/25 hover:brightness-110 active:scale-[0.98] transition-all"
      >
        <svg
          className="h-4 w-4"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
          <polyline points="7 10 12 15 17 10" />
          <line x1="12" y1="15" x2="12" y2="3" />
        </svg>
        Installer l&apos;App 📱
      </button>
    </div>
  );
}
