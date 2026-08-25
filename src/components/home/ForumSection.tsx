'use client';

import Link from 'next/link';
import { useState } from 'react';

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
    answer: 'Commencez par télécharger les annales des sessions précédentes sur le site officiel de l\'ENA. Concentrez-vous sur la culture générale, les questions de logique et l\'actualité ivoirienne. Rejoignez aussi des groupes Telegram de préparation.',
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
    answer: 'Le secteur IT/Digital, la banque-finance, le BTP et l\'industrie pharmaceutique sont les plus dynamiques. Les compétences en数据分析, marketing digital et gestion de projet sont très recherchées.',
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
    answer: 'Utilisez les plateformes comme TravaillerEnCi, Envie d\'Emploi et LinkedIn. Candidature spontanée auprès des grandes entreprises (Orange, MTN, NSIA) est aussi efficace. Préparez un CV percutant avec le générateur IA.',
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
    answer: 'Utilisez le générateur CV de TravaillerEnCi pour un format professionnel. Mettez en avant vos compétences techniques, adaptez le CV au poste, et n\'oubliez pas la photo professionnelle.',
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
    answer: 'Consultez régulièrement la section Bourses de TravaillerEnCi. Les bourses Chevening, Erasmus Mundus, et celles du gouvernement chinois/sud-coréen sont parmi les plus accessibles pour les Ivoiriens.',
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
    answer: 'Oui, toutes les offres sont vérifiées par notre équipe avant publication. Nous contactons les entreprises pour confirmer la légitimité de chaque offre. Zéro spam garanti.',
  },
];

export default function ForumSection() {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  return (
    <section className="container mx-auto px-4 mt-10 sm:mt-14 max-w-6xl">
      <div className="flex items-end justify-between gap-3 mb-4 sm:mb-5">
        <div>
          <p className="text-[11px] font-bold uppercase tracking-widest text-primary dark:text-emerald-400 mb-1">
            Questions & Réponses
          </p>
          <h2 className="text-lg sm:text-2xl font-bold text-gray-900 dark:text-white font-[var(--font-display)] leading-tight">
            La communauté en parle
          </h2>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-1">
            Tout le monde peut consulter. <Link href="/register" className="text-primary font-semibold hover:underline">Inscrivez-vous</Link> pour participer.
          </p>
        </div>
        <Link
          href="/register"
          className="shrink-0 inline-flex items-center gap-1 text-xs sm:text-sm font-semibold text-primary hover:gap-2 transition-all"
        >
          Poser une question
          <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12h14" />
            <path d="m12 5 7 7-7 7" />
          </svg>
        </Link>
      </div>

      <div className="space-y-3">
        {QUESTIONS.map((q) => (
          <div
            key={q.id}
            className="rounded-2xl border border-gray-100 bg-white dark:bg-slate-900 dark:border-slate-800 shadow-sm hover:shadow-md hover:border-primary/20 transition-all duration-200"
          >
            <button
              onClick={() => setExpandedId(expandedId === q.id ? null : q.id)}
              className="w-full text-left p-4 sm:p-5 flex items-start gap-3"
            >
              <div className="shrink-0 mt-0.5">
                <div className="w-8 h-8 rounded-full bg-primary/10 flex items-center justify-center text-primary font-bold text-sm">
                  {q.author.charAt(0)}
                </div>
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-[13px] sm:text-sm font-bold text-gray-900 dark:text-white leading-snug">
                    {q.question}
                  </h3>
                  <span className={`shrink-0 inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${q.categoryColor}`}>
                    {q.category}
                  </span>
                </div>
                <div className="flex items-center gap-3 mt-2 text-[11px] text-gray-400 dark:text-gray-500">
                  <span>{q.author}</span>
                  <span>{q.date}</span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
                    </svg>
                    {q.replies} réponses
                  </span>
                  <span className="inline-flex items-center gap-1">
                    <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                    {q.views}
                  </span>
                </div>
              </div>
              <svg
                className={`shrink-0 w-4 h-4 text-gray-400 mt-1 transition-transform duration-200 ${expandedId === q.id ? 'rotate-180' : ''}`}
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="m6 9 6 6 6-6" />
              </svg>
            </button>

            {expandedId === q.id && q.answer && (
              <div className="px-4 sm:px-5 pb-4 sm:pb-5 pt-0">
                <div className="ml-11 pl-3 border-l-2 border-primary/30">
                  <div className="flex items-center gap-2 mb-2">
                    <div className="w-6 h-6 rounded-full bg-emerald-100 flex items-center justify-center">
                      <svg className="w-3 h-3 text-emerald-600" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5}>
                        <path d="M20 6 9 17l-5-5" />
                      </svg>
                    </div>
                    <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                      Réponse de la communauté
                    </span>
                  </div>
                  <p className="text-[12px] sm:text-[13px] text-gray-600 dark:text-gray-300 leading-relaxed">
                    {q.answer}
                  </p>
                </div>
                <div className="ml-11 mt-3 flex items-center gap-2">
                  <Link
                    href="/register"
                    className="inline-flex items-center gap-1.5 text-[11px] font-bold text-primary hover:gap-2 transition-all"
                  >
                    Répondre
                    <svg className="h-3 w-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M5 12h14" />
                      <path d="m12 5 7 7-7 7" />
                    </svg>
                  </Link>
                </div>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="mt-6 text-center">
        <Link
          href="/register"
          className="inline-flex items-center gap-2 rounded-xl bg-primary/10 text-primary px-6 py-3 text-sm font-bold hover:bg-primary/20 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
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
