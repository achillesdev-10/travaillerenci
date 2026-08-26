'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';

interface ForumQuestion {
  id: number;
  question: string;
  author: string;
  date: string;
  replies: number;
  views: number;
  category: string;
  categoryColor: string;
  answer?: string;
}

const QUESTIONS: ForumQuestion[] = [
  {
    id: 1,
    question: 'Comment bien préparer un concours administratif à l\'ENA en Côte d\'Ivoire ?',
    author: 'Kouadio M.',
    date: 'Il y a 2 jours',
    replies: 12,
    views: 234,
    category: 'Concours',
    categoryColor: 'bg-indigo-100 text-indigo-700',
    answer: 'Commencez par télécharger les annales des sessions précédentes sur le site officiel de l\'ENA. Concentrez-vous sur la culture générale, les questions de logique et l\'actualité ivoirienne.',
  },
  {
    id: 2,
    question: 'Quels sont les secteurs qui recrutent le plus à Abidjan en 2025 ?',
    author: 'Aya T.',
    date: 'Il y a 5 jours',
    replies: 8,
    views: 187,
    category: 'Emploi',
    categoryColor: 'bg-orange-100 text-orange-700',
    answer: 'Le secteur IT/Digital, la banque-finance, le BTP et l\'industrie pharmaceutique sont les plus dynamiques.',
  },
  {
    id: 3,
    question: 'Je suis étudiant, comment trouver un stage en Côte d\'Ivoire ?',
    author: 'Ibrahim S.',
    date: 'Il y a 1 semaine',
    replies: 15,
    views: 412,
    category: 'Stages',
    categoryColor: 'bg-sky-100 text-sky-700',
    answer: 'Utilisez les plateformes comme TravaillerEnCi, Envie d\'Emploi et LinkedIn. Candidature spontanée auprès des grandes entreprises est aussi efficace.',
  },
  {
    id: 4,
    question: 'Comment créer un CV professionnel qui attire les recruteurs en CI ?',
    author: 'Fatoumata D.',
    date: 'Il y a 3 jours',
    replies: 20,
    views: 563,
    category: 'CV',
    categoryColor: 'bg-purple-100 text-purple-700',
    answer: 'Utilisez le générateur CV de TravaillerEnCi pour un format professionnel. Mettez en avant vos compétences techniques et adaptez le CV au poste.',
  },
  {
    id: 5,
    question: 'Les bourses d\'études disponibles pour les Ivoiriens en 2025 ?',
    author: 'Moussa K.',
    date: 'Il y a 4 jours',
    replies: 6,
    views: 298,
    category: 'Bourses',
    categoryColor: 'bg-emerald-100 text-emerald-700',
    answer: 'Consultez régulièrement la section Bourses de TravaillerEnCi. Les bourses Chevening, Erasmus Mundus, et celles du gouvernement chinois/sud-coréen sont parmi les plus accessibles.',
  },
  {
    id: 6,
    question: 'Est-ce que TravaillerEnCi est fiable pour les offres d\'emploi ?',
    author: 'Christelle A.',
    date: 'Il y a 6 jours',
    replies: 18,
    views: 891,
    category: 'Plateforme',
    categoryColor: 'bg-rose-100 text-rose-700',
    answer: 'Oui, toutes les offres sont vérifiées par notre équipe avant publication. Nous contactons les entreprises pour confirmer la légitimité de chaque offre.',
  },
  {
    id: 7,
    question: 'Comment réussir un entretien d\'embauche en vidéoconférence ?',
    author: 'Jean-Philippe B.',
    date: 'Il y a 1 jour',
    replies: 9,
    views: 156,
    category: 'Conseils',
    categoryColor: 'bg-amber-100 text-amber-700',
    answer: 'Testez votre matériel à l\'avance, assurez-vous d\'avoir un bon éclairage, habillez-vous professionnellement et préparez des réponses concises.',
  },
  {
    id: 8,
    question: 'Quelles compétences digitales sont les plus demandées en 2025 ?',
    author: 'Aminata F.',
    date: 'Il y a 8 jours',
    replies: 14,
    views: 321,
    category: 'Emploi',
    categoryColor: 'bg-orange-100 text-orange-700',
    answer: 'Python, React, analyse de données, marketing digital et gestion de projet Agile sont les compétences les plus recherchées.',
  },
];

export default function ForumSection() {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let scrollPos = 0;
    const speed = 0.4;

    const tick = () => {
      if (!isPaused.current) {
        scrollPos += speed;
        if (scrollPos >= el.scrollHeight / 2) {
          scrollPos = 0;
        }
        el.scrollTop = scrollPos;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, []);

  // Double the list for seamless loop
  const doubled = [...QUESTIONS, ...QUESTIONS];

  return (
    <section className="container mx-auto px-4 mt-10 sm:mt-14 max-w-4xl">
      <div className="flex items-end justify-between gap-3 mb-3">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-emerald-400 mb-1">
            Questions & Réponses
          </p>
          <h2 className="text-base sm:text-xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
            La communauté en parle
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Tout le monde peut consulter. <Link href="/register" className="text-primary font-semibold hover:underline">Inscrivez-vous</Link> pour participer.
          </p>
        </div>
        <Link
          href="/register"
          className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-primary hover:gap-2 transition-all"
        >
          Poser une question
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      {/* Scrollable box with vertical fade */}
      <div
        className="relative rounded-2xl border border-gray-100 dark:border-slate-800 overflow-hidden"
        style={{ maxHeight: '280px' }}
      >
        {/* Top fade */}
        <div className="pointer-events-none absolute top-0 left-0 right-0 h-8 bg-gradient-to-b from-white dark:from-slate-900 to-transparent z-10" />
        {/* Bottom fade */}
        <div className="pointer-events-none absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-white dark:from-slate-900 to-transparent z-10" />

        <div
          ref={scrollRef}
          className="overflow-y-auto"
          style={{ maxHeight: '280px', scrollbarWidth: 'none', msOverflowStyle: 'none' }}
          onMouseEnter={() => { isPaused.current = true; }}
          onMouseLeave={() => { isPaused.current = false; }}
        >
          <style>{`[data-scroll-box]::-webkit-scrollbar { display: none; }`}</style>
          <div data-scroll-box className="divide-y divide-gray-50 dark:divide-slate-800">
            {doubled.map((q, i) => (
              <button
                key={`${q.id}-${i}`}
                onClick={() => setExpandedId(expandedId === `${q.id}-${i}` ? null : `${q.id}-${i}`)}
                className="w-full text-left px-3.5 py-2.5 hover:bg-gray-50/80 dark:hover:bg-slate-800/50 transition-colors"
              >
                <div className="flex items-start gap-2.5">
                  <div className="shrink-0 mt-0.5">
                    <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-[10px]">
                      {q.author.charAt(0)}
                    </div>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-[12px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-1">
                        {q.question}
                      </h3>
                      <span className={`shrink-0 inline-flex items-center rounded-full px-1.5 py-0.5 text-[9px] font-bold ${q.categoryColor}`}>
                        {q.category}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 mt-1 text-[10px] text-gray-400 dark:text-gray-500">
                      <span>{q.author}</span>
                      <span>{q.date}</span>
                      <span className="inline-flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                        </svg>
                        {q.replies}
                      </span>
                      <span className="inline-flex items-center gap-0.5">
                        <svg className="w-2.5 h-2.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                          <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                          <circle cx="12" cy="12" r="3" />
                        </svg>
                        {q.views}
                      </span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mt-4 text-center">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-primary/10 text-primary px-5 py-2.5 text-xs font-bold hover:bg-primary/20 transition-all"
        >
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
            <path d="M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2" />
            <circle cx="9" cy="7" r="4" />
            <line x1="19" y1="8" x2="19" y2="14" />
            <line x1="22" y1="11" x2="16" y2="11" />
          </svg>
          Inscrivez-vous pour poser vos questions
        </Link>
      </div>
    </section>
  );
}
