'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import type { Notification, NotificationType } from '@/services/notificationsService';

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: string; color: string; label: string }
> = {
  alert_match: {
    icon: '🔔',
    color: 'bg-amber-500/10 text-amber-600 dark:text-amber-400',
    label: 'Alerte',
  },
  saved_update: {
    icon: '⭐',
    color: 'bg-blue-500/10 text-blue-600 dark:text-blue-400',
    label: 'Sauvegarde',
  },
  account_event: {
    icon: '👤',
    color: 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400',
    label: 'Compte',
  },
  system: {
    icon: '📢',
    color: 'bg-purple-500/10 text-purple-600 dark:text-purple-400',
    label: 'Système',
  },
};

/** Affiche une date relative (il y a X minutes / heures / jours). */
function relativeTime(dateStr: string): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  const diffH = Math.floor(diffMin / 60);
  const diffD = Math.floor(diffH / 24);

  if (diffMin < 1) return "à l'instant";
  if (diffMin < 60) return `il y a ${diffMin} min`;
  if (diffH < 24) return `il y a ${diffH}h`;
  if (diffD < 7) return `il y a ${diffD}j`;
  return date.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' });
}

/**
 * Section « Notifications récentes » du dashboard candidat.
 * Affiche les alertes déclenchées, événements de compte, etc.
 */
export default function NotificationsSection() {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [unreadCount, setUnreadCount] = useState(0);
  const [loaded, setLoaded] = useState(false);
  const [markingAll, setMarkingAll] = useState(false);

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/notifications', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setNotifications(Array.isArray(data.notifications) ? data.notifications : []);
        setUnreadCount(data.unread_count ?? 0);
      }
    } catch {
      // silencieux
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  async function markAsRead(notification: Notification) {
    if (notification.read) return;
    // Optimistic update
    setNotifications((prev) =>
      prev.map((n) => (n.id === notification.id ? { ...n, read: true } : n)),
    );
    setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: notification.id }),
      });
    } catch {
      // rollback si échec
      setNotifications((prev) =>
        prev.map((n) => (n.id === notification.id ? { ...n, read: false } : n)),
      );
      setUnreadCount((prev) => prev + 1);
    }
  }

  async function markAllAsRead() {
    setMarkingAll(true);
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ mark_all: true }),
      });
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      setUnreadCount(0);
    } catch {
      // silencieux
    } finally {
      setMarkingAll(false);
    }
  }

  async function removeNotification(notification: Notification) {
    // Optimistic update
    setNotifications((prev) => prev.filter((n) => n.id !== notification.id));
    if (!notification.read) setUnreadCount((prev) => Math.max(0, prev - 1));
    try {
      await fetch(`/api/notifications?id=${encodeURIComponent(notification.id)}`, {
        method: 'DELETE',
      });
    } catch {
      // rollback
      load();
    }
  }

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8">
      {/* En-tête */}
      <div className="mb-5 flex items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
            Notifications
          </h2>
          {unreadCount > 0 && (
            <span className="inline-flex items-center justify-center min-w-[20px] h-5 rounded-full bg-rose-500 text-white text-[10px] font-black px-1.5">
              {unreadCount > 99 ? '99+' : unreadCount}
            </span>
          )}
        </div>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={markAllAsRead}
            disabled={markingAll}
            className="text-[11px] font-semibold text-primary hover:underline disabled:opacity-50 shrink-0"
          >
            Tout marquer comme lu
          </button>
        )}
      </div>

      {/* Contenu */}
      {!loaded ? (
        <div className="py-10 text-center text-sm text-gray-400">Chargement…</div>
      ) : notifications.length === 0 ? (
        <div className="py-6 text-center">
          <div className="mx-auto mb-4 w-14 h-14 rounded-2xl bg-gray-100 dark:bg-slate-800 text-gray-400 flex items-center justify-center">
            <svg className="w-7 h-7" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M18 8A6 6 0 006 8c0 7-3 9-3 9h18s-3-2-3-9" />
              <path d="M13.73 21a2 2 0 01-3.46 0" />
            </svg>
          </div>
          <p className="text-sm text-gray-500 dark:text-slate-400 max-w-xs mx-auto">
            Aucune notification pour le moment. Créez des alertes pour être notifié
            de nouvelles opportunités.
          </p>
        </div>
      ) : (
        <ul className="space-y-2">
          {notifications.map((notif) => {
            const config = TYPE_CONFIG[notif.type] || TYPE_CONFIG.system;
            return (
              <li
                key={notif.id}
                className={cn(
                  'group relative flex items-start gap-3 rounded-2xl border p-4 transition-all',
                  notif.read
                    ? 'border-gray-100 dark:border-slate-800/50 bg-white dark:bg-slate-950'
                    : 'border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60',
                )}
              >
                {/* Indicateur non-lu */}
                {!notif.read && (
                  <span className="absolute top-4 left-1.5 w-1.5 h-1.5 rounded-full bg-rose-500 shrink-0" />
                )}

                {/* Icône de type */}
                <div
                  className={cn(
                    'w-9 h-9 rounded-xl flex items-center justify-center text-sm shrink-0',
                    config.color,
                  )}
                >
                  {config.icon}
                </div>

                {/* Contenu */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p
                        className={cn(
                          'text-[13px] leading-snug',
                          notif.read
                            ? 'text-gray-700 dark:text-gray-300'
                            : 'font-bold text-gray-900 dark:text-white',
                        )}
                      >
                        {notif.link ? (
                          <Link
                            href={notif.link}
                            onClick={() => markAsRead(notif)}
                            className="hover:text-primary transition-colors"
                          >
                            {notif.title}
                          </Link>
                        ) : (
                          notif.title
                        )}
                      </p>
                      {notif.body && (
                        <p className="text-[12px] text-gray-500 dark:text-slate-400 mt-0.5 line-clamp-2">
                          {notif.body}
                        </p>
                      )}
                    </div>

                    {/* Actions */}
                    <div className="flex items-center gap-1 shrink-0 opacity-0 group-hover:opacity-100 transition-opacity">
                      {!notif.read && (
                        <button
                          type="button"
                          onClick={() => markAsRead(notif)}
                          aria-label="Marquer comme lu"
                          className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-gray-400 hover:text-emerald-500 hover:bg-emerald-500/10 transition-all"
                          title="Marquer comme lu"
                        >
                          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                            <path d="M9 12l2 2 4-4" />
                            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2z" />
                          </svg>
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => removeNotification(notif)}
                        aria-label="Supprimer la notification"
                        className="inline-flex items-center justify-center h-7 w-7 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M18 6L6 18" />
                          <path d="M6 6l12 12" />
                        </svg>
                      </button>
                    </div>
                  </div>

                  {/* Timestamp + badge type */}
                  <div className="mt-1.5 flex items-center gap-2">
                    <span className="text-[10px] text-gray-400 dark:text-slate-500">
                      {relativeTime(notif.created_at)}
                    </span>
                    <span
                      className={cn(
                        'inline-flex items-center rounded-md px-1.5 py-0.5 text-[9px] font-bold uppercase tracking-wider',
                        config.color,
                      )}
                    >
                      {config.label}
                    </span>
                  </div>
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
