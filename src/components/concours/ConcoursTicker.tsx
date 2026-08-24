'use client';

/**
 *  TravaillerEnCi — ConcoursTicker
 *  Bannière défilante (Marquee/CSS) affichant en temps réel les alertes,
 *  communiqués officiels et dates de clôture imminentes.
 *
 *  Affiche une liste d'alertes en boucle infinie avec animation CSS marquee.
 */

import { useEffect, useState } from 'react';
import type { Exam } from '@/types/exam';
import { examPhase } from '@/lib/examConstants';
import { formatDate } from '@/lib/utils';

interface TickerAlert {
  id: string;
  text: string;
  type: 'urgent' | 'info' | 'result';
}

function examsToAlerts(exams: Exam[]): TickerAlert[] {
  const alerts: TickerAlert[] = [];
  const now = Date.now();

  for (const exam of exams) {
    const phase = examPhase(exam);

    // Deadlines imminentes (< 7 jours)
    if (
      (phase === 'open' || phase === 'upcoming') &&
      exam.registration_end
    ) {
      const end = new Date(exam.registration_end).getTime();
      const daysLeft = Math.ceil((end - now) / (1000 * 60 * 60 * 24));
      if (daysLeft > 0 && daysLeft <= 7) {
        alerts.push({
          id: `deadline-${exam.id}`,
          text: `⏰ Clôture dans ${daysLeft}j : ${exam.title} (${exam.organizer}) — limite le ${formatDate(exam.registration_end)}`,
          type: 'urgent',
        });
      }
    }

    // Résultats récents (< 3 jours)
    if (phase === 'results' && exam.results_date) {
      const resDate = new Date(exam.results_date).getTime();
      const daysAgo = Math.floor((now - resDate) / (1000 * 60 * 60 * 24));
      if (daysAgo >= 0 && daysAgo <= 3) {
        alerts.push({
          id: `results-${exam.id}`,
          text: `✅ Résultats publiés : ${exam.title} (${exam.organizer}) — consultez les résultats`,
          type: 'result',
        });
      }
    }
  }

  // Fallback alerts si pas assez de données réelles
  if (alerts.length === 0) {
    alerts.push(
      {
        id: 'static-1',
        text: '📋 Consultez les concours administratifs en cours et à venir en Côte d\'Ivoire',
        type: 'info',
      },
      {
        id: 'static-2',
        text: '🎓 Préparez votre candidature : tous les concours de la fonction publique centralisés ici',
        type: 'info',
      },
      {
        id: 'static-3',
        text: '🔔 Installez l\'application pour recevoir les alertes concours en temps réel',
        type: 'info',
      },
    );
  }

  return alerts;
}

const TYPE_STYLES: Record<TickerAlert['type'], string> = {
  urgent: 'text-rose-600 dark:text-rose-400',
  info: 'text-primary dark:text-emerald-400',
  result: 'text-emerald-600 dark:text-emerald-400',
};

export default function ConcoursTicker({ exams }: { exams: Exam[] }) {
  const [mounted, setMounted] = useState(false);
  const alerts = examsToAlerts(exams);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMounted(true);
  }, []);

  if (alerts.length === 0) return null;

  return (
    <div
      className="relative overflow-hidden rounded-xl border border-primary/15 bg-gradient-to-r from-primary/5 via-white to-primary/5 dark:from-primary/10 dark:via-slate-900 dark:to-primary/10"
      role="marquee"
      aria-label="Alertes concours en temps réel"
    >
      {/* Gradient fade gauche/droite */}
      <div
        className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-white dark:from-slate-900 to-transparent z-10"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-white dark:from-slate-900 to-transparent z-10"
        aria-hidden="true"
      />

      <div className="flex items-center gap-3 py-2.5 px-4">
        {/* Badge LIVE */}
        <span className="shrink-0 inline-flex items-center gap-1.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wider">
          <span className="h-1.5 w-1.5 rounded-full bg-rose-500 animate-ticker-pulse" />
          Alerte
        </span>

        {/* Ticker défilant */}
        <div className="relative flex-1 overflow-hidden min-h-[20px]">
          <div
            className={`flex gap-12 whitespace-nowrap ${mounted ? 'animate-marquee' : ''}`}
            style={{ animationDuration: `${Math.max(alerts.length * 20, 40)}s` }}
          >
            {/* Double les alertes pour une boucle fluide */}
            {[...alerts, ...alerts].map((alert, i) => (
              <span
                key={`${alert.id}-${i}`}
                className={`inline-flex items-center gap-2 text-[12.5px] font-semibold ${TYPE_STYLES[alert.type]}`}
              >
                <span aria-hidden="true">•</span>
                {alert.text}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
