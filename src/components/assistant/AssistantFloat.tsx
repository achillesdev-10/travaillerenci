'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { cn } from '@/lib/utils';
import SimpleMarkdown from '@/components/content/SimpleMarkdown';
import type { AssistantResult, AssistantResponse } from '@/services/assistant/types';

// ---------------------------------------------------------------------------
// Types internes
// ---------------------------------------------------------------------------

interface ChatMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  results?: AssistantResult[];
  seeMoreUrl?: string;
  aiUsed?: boolean;
  error?: boolean;
}

interface Suggestion {
  label: string;
  prompt: string;
}

const SUGGESTIONS: Suggestion[] = [
  { label: '🔎 Trouver un emploi', prompt: 'Je cherche un emploi' },
  { label: '🎓 Trouver un concours', prompt: 'Quels concours sont disponibles ?' },
  { label: '💼 Trouver un stage', prompt: 'Je cherche un stage' },
  { label: '📚 Trouver une bourse', prompt: 'Quelles bourses sont disponibles ?' },
  { label: '📄 Créer mon CV', prompt: 'Comment créer mon CV ?' },
];

/** Nombre max de messages d'historique envoyés au serveur (contexte léger). */
const MAX_SENT_HISTORY = 10;

let messageSeq = 0;
function nextId(): string {
  messageSeq += 1;
  return `m${Date.now()}-${messageSeq}`;
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function BotAvatar({ size = 'md' }: { size?: 'sm' | 'md' }) {
  return (
    <div
      className={cn(
        'flex items-center justify-center rounded-full bg-gradient-to-br from-primary to-primary-dark text-white shadow-md shadow-primary/25 shrink-0',
        size === 'md' ? 'w-8 h-8' : 'w-7 h-7',
      )}
      aria-hidden="true"
    >
      <svg className={size === 'md' ? 'w-4.5 h-4.5' : 'w-4 h-4'} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="11" width="18" height="10" rx="2" />
        <path d="M7 11V7a5 5 0 0 1 10 0v4" />
      </svg>
    </div>
  );
}

function ResultCard({ result }: { result: AssistantResult }) {
  const isExam = result.category === 'exam';
  const isScholarship = result.category === 'scholarship';
  return (
    <Link
      href={result.url}
      prefetch={false}
      className="group block rounded-xl border border-gray-100 dark:border-slate-700/60 bg-white dark:bg-slate-800/80 p-3 transition-all hover:border-primary/40 hover:shadow-md hover:-translate-y-px"
    >
      <div className="flex items-start gap-2.5">
        <div
          className={cn(
            'flex items-center justify-center rounded-lg w-8 h-8 shrink-0 text-base',
            isExam
              ? 'bg-indigo-500/10'
              : isScholarship
                ? 'bg-amber-500/10'
                : 'bg-primary/10',
          )}
          aria-hidden="true"
        >
          {isExam ? '🎓' : isScholarship ? '📚' : '💼'}
        </div>
        <div className="min-w-0 flex-1">
          <div className="text-[13px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary dark:group-hover:text-emerald-400 transition-colors">
            {result.title}
          </div>
          <div className="text-[12px] font-semibold text-primary dark:text-emerald-400 truncate mt-0.5">
            {result.subtitle}
          </div>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-gray-500 dark:text-gray-400">
            {result.location && (
              <span className="inline-flex items-center gap-0.5 min-w-0">
                <svg className="w-3 h-3 shrink-0 text-gray-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                  <circle cx="12" cy="10" r="3" />
                </svg>
                <span className="truncate">{result.location}</span>
              </span>
            )}
            {result.meta && <span className="truncate">{result.meta}</span>}
          </div>
          <div className="mt-1.5 inline-flex items-center gap-1 text-[11.5px] font-bold text-primary dark:text-emerald-400">
            Voir l'offre
            <svg className="w-3 h-3 transition-transform group-hover:translate-x-0.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14" />
              <path d="m12 5 7 7-7 7" />
            </svg>
          </div>
        </div>
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

export default function AssistantFloat() {
  const [open, setOpen] = useState(false);
  const [visible, setVisible] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const initialized = useRef(false);

  // Apparition après un léger délai / défilement (même comportement que le
  // bouton WhatsApp d'origine).
  useEffect(() => {
    const onScroll = () => setVisible(true);
    const timer = setTimeout(() => setVisible(true), 2000);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      clearTimeout(timer);
    };
  }, []);

  // Message d'accueil à la première ouverture.
  useEffect(() => {
    if (open && !initialized.current) {
      initialized.current = true;
      setMessages([
        {
          id: nextId(),
          role: 'assistant',
          text: [
            'Bonjour 👋',
            "Je peux vous aider à trouver un emploi, un stage, une bourse ou un concours sur TravaillerenCi.",
          ].join('\n'),
        },
      ]);
    }
  }, [open]);

  // Fermeture avec la touche Échap.
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open]);

  // Scroll automatique en bas du fil de discussion.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, open, loading]);

  // Focus du champ de saisie à l'ouverture.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => inputRef.current?.focus(), 120);
      return () => clearTimeout(t);
    }
  }, [open]);

  function handleToggle() {
    setOpen((o) => !o);
  }

  async function sendMessage(raw?: string) {
    const text = (raw ?? input).trim();
    if (!text || loading) return;

    const userMessage: ChatMessage = { id: nextId(), role: 'user', text };
    setMessages((prev) => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    // Historique temporaire côté client — seuls les N derniers messages partent au serveur.
    const history = [...messages, userMessage]
      .slice(-MAX_SENT_HISTORY)
      .map((m) => ({ role: m.role, content: m.text }));

    try {
      const res = await fetch('/api/assistant', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: text, history }),
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setMessages((prev) => [
          ...prev,
          {
            id: nextId(),
            role: 'assistant',
            text: data.error || 'Une erreur est survenue. Veuillez réessayer.',
            error: true,
          },
        ]);
        return;
      }

      const data = (await res.json()) as AssistantResponse;
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: data.reply.text,
          results: data.reply.results,
          seeMoreUrl: data.reply.seeMoreUrl,
          aiUsed: data.reply.aiUsed,
        },
      ]);
    } catch {
      setMessages((prev) => [
        ...prev,
        {
          id: nextId(),
          role: 'assistant',
          text: 'Désolé, je rencontre actuellement un problème. Veuillez réessayer dans quelques instants.',
          error: true,
        },
      ]);
    } finally {
      setLoading(false);
    }
  }

  const showWelcome = messages.length === 0 && !loading;

  return (
    <>
      {/* ===================== BOUTON FLOTTANT ===================== */}
      <button
        type="button"
        onClick={handleToggle}
        aria-label={open ? "Fermer l'assistant" : "Ouvrir l'assistant TravaillerenCi"}
        title="Assistant TravaillerenCi"
        className={cn(
          'group fixed bottom-5 right-5 z-50 flex items-center gap-2.5 rounded-full bg-gradient-to-br from-primary to-primary-dark pl-3.5 pr-4 py-3 text-white shadow-xl shadow-primary/30 transition-all duration-300 hover:scale-105 hover:shadow-primary/50',
          visible ? 'translate-y-0 opacity-100' : 'translate-y-16 opacity-0',
        )}
      >
        {open ? (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M6 18L18 6M6 6l12 12" />
          </svg>
        ) : (
          <svg className="h-6 w-6" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <rect x="3" y="11" width="18" height="10" rx="2" />
            <path d="M7 11V7a5 5 0 0 1 10 0v4" />
          </svg>
        )}
        <span className="text-sm font-bold leading-tight">
          {open ? (
            'Fermer'
          ) : (
            <>
              Assistant
              <br />
              TravaillerenCi
            </>
          )}
        </span>
      </button>

      {/* ===================== FENÊTRE DE CHAT ===================== */}
      {open && (
        <div className="fixed z-50 flex flex-col overflow-hidden rounded-2xl sm:rounded-3xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-900 shadow-2xl shadow-black/25 animate-pop"
          style={{
            // Mobile : occupe presque tout l'écran ; desktop : largeur fixe.
            inset: 'auto 0.75rem 5.5rem 0.75rem',
            height: 'min(72vh, 640px)',
          }}
          role="dialog"
          aria-label="Assistant TravaillerenCi"
        >
          {/* En-tête */}
          <div className="flex items-center gap-3 px-4 py-3.5 border-b border-gray-100 dark:border-slate-800 bg-gradient-to-r from-primary to-primary-dark text-white">
            <BotAvatar />
            <div className="min-w-0 flex-1">
              <div className="text-sm font-extrabold font-[var(--font-display)] leading-tight truncate">
                🤖 Assistant TravaillerenCi
              </div>
              <div className="text-[11px] text-white/80 leading-tight truncate">
                Je peux vous aider à trouver une opportunité.
              </div>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              aria-label="Fermer le chat"
              className="flex h-8 w-8 items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M18 6L6 18M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Corps : messages */}
          <div ref={scrollRef} className="flex-1 overflow-y-auto px-3.5 py-4 space-y-3.5 bg-gray-50/70 dark:bg-slate-950/50">
            {showWelcome ? (
              <div className="space-y-3.5">
                <div className="flex items-start gap-2.5 animate-fade-in-up">
                  <BotAvatar />
                  <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-3.5 py-2.5 text-[13px] leading-relaxed text-gray-700 dark:text-gray-200 shadow-sm max-w-[85%]">
                    Bonjour 👋
                    <br />
                    Je peux vous aider à trouver un emploi, un stage, une bourse ou un concours sur TravaillerenCi. Que recherchez-vous ?
                  </div>
                </div>
                <div className="pl-10 grid grid-cols-1 gap-1.5 animate-fade-in-up">
                  {SUGGESTIONS.map((s) => (
                    <button
                      key={s.prompt}
                      type="button"
                      onClick={() => sendMessage(s.prompt)}
                      className="text-left rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-[12.5px] font-semibold text-gray-700 dark:text-gray-200 hover:border-primary/40 hover:bg-primary/5 dark:hover:bg-slate-700 transition-colors"
                    >
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
            ) : (
              messages.map((m) => (
                <div
                  key={m.id}
                  className={cn(
                    'flex items-start gap-2.5 animate-fade-in-up',
                    m.role === 'user' && 'justify-end',
                  )}
                >
                  {m.role === 'assistant' && <BotAvatar size="sm" />}
                  <div
                    className={cn(
                      'max-w-[85%] min-w-0 space-y-2',
                      m.role === 'user' && 'flex flex-col items-end',
                    )}
                  >
                    <div
                      className={cn(
                        'rounded-2xl px-3.5 py-2.5 text-[13px] leading-relaxed shadow-sm',
                        m.role === 'user'
                          ? 'rounded-br-sm bg-primary text-white whitespace-pre-line'
                          : 'rounded-tl-sm bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 text-gray-700 dark:text-gray-200',
                        m.error && 'border-rose-300 dark:border-rose-500/40 text-rose-600 dark:text-rose-400',
                      )}
                    >
                      {m.role === 'assistant' && !m.error ? (
                        <SimpleMarkdown text={m.text} />
                      ) : (
                        <span className="whitespace-pre-line">{m.text}</span>
                      )}
                      {m.aiUsed && (
                        <div className="mt-1.5 text-[10px] text-gray-400 dark:text-gray-500">
                          ✨ Réponse assistée par IA
                        </div>
                      )}
                    </div>

                    {m.results && m.results.length > 0 && (
                      <div className="space-y-1.5 w-full">
                        {m.results.map((r) => (
                          <ResultCard key={`${r.category}-${r.id}`} result={r} />
                        ))}
                      </div>
                    )}

                    {m.seeMoreUrl && (
                      <Link
                        href={m.seeMoreUrl}
                        prefetch={false}
                        className="inline-flex items-center gap-1.5 rounded-xl border border-primary/30 bg-primary/5 px-3.5 py-2 text-[12.5px] font-bold text-primary dark:text-emerald-400 hover:bg-primary/10 transition-colors"
                      >
                        Voir plus de résultats
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14" />
                          <path d="m12 5 7 7-7 7" />
                        </svg>
                      </Link>
                    )}
                  </div>
                </div>
              ))
            )}

            {loading && (
              <div className="flex items-start gap-2.5 animate-fade-in">
                <BotAvatar size="sm" />
                <div className="rounded-2xl rounded-tl-sm bg-white dark:bg-slate-800 border border-gray-100 dark:border-slate-700 px-4 py-3 shadow-sm">
                  <div className="flex gap-1">
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '0ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '120ms' }} />
                    <span className="h-1.5 w-1.5 rounded-full bg-gray-400 dark:bg-gray-500 animate-bounce" style={{ animationDelay: '240ms' }} />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Pied : saisie */}
          <form
            onSubmit={(e) => {
              e.preventDefault();
              sendMessage();
            }}
            className="flex items-center gap-2 border-t border-gray-100 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Écrivez votre demande…"
              maxLength={500}
              aria-label="Votre message"
              autoComplete="off"
              className="flex-1 min-w-0 rounded-xl border border-gray-200 dark:border-slate-700 bg-gray-50 dark:bg-slate-800 px-3.5 py-2.5 text-[13px] text-gray-800 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 transition-all"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              aria-label="Envoyer"
              className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary text-white shadow-md shadow-primary/25 hover:bg-primary-dark active:scale-95 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <svg className="h-4.5 w-4.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 2 11 13" />
                <path d="M22 2 15 22l-4-9-9-4 20-7z" />
              </svg>
            </button>
          </form>
        </div>
      )}
    </>
  );
}
