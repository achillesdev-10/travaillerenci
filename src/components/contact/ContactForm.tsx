'use client';

import { useState } from 'react';
import { SITE_CONFIG } from '@/lib/constants';

const SUBJECTS = [
  'Question générale',
  "Signaler une offre / un problème",
  'Partenariat / Recruteur',
  'Proposer un contenu (blog)',
  'Presse / Médias',
];

const inputClass =
  'w-full rounded-xl border border-line dark:border-slate-700 bg-brand-soft/50 dark:bg-slate-800/60 px-4 py-3 text-sm text-black dark:text-white placeholder:text-black/40 dark:placeholder:text-white/40 focus:outline-none focus:border-primary focus:ring-2 focus:ring-primary/15 transition-all';
const labelClass =
  'block text-xs font-bold uppercase tracking-widest text-black dark:text-white mb-1.5';

export default function ContactForm() {
  const [form, setForm] = useState({
    name: '',
    email: '',
    subject: SUBJECTS[0],
    message: '',
  });
  const [error, setError] = useState<string | null>(null);
  const [launched, setLaunched] = useState(false);

  const update = (key: keyof typeof form, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (form.name.trim().length < 2) {
      setError('Veuillez saisir votre nom complet.');
      return;
    }

    const email = form.email.trim();
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Veuillez saisir une adresse email valide.');
      return;
    }
    if (form.message.trim().length < 10) {
      setError('Votre message doit contenir au moins 10 caractères.');
      return;
    }

    const subject = encodeURIComponent(`${form.subject} — ${form.name.trim()}`);
    const body = encodeURIComponent(
      `Bonjour TravaillerenCi,\n\n${form.message.trim()}\n\n— ${form.name.trim()}\n${email}`
    );
    window.location.href = `mailto:${SITE_CONFIG.supportEmail}?subject=${subject}&body=${body}`;
    setLaunched(true);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-3xl border border-border bg-white dark:bg-slate-900 p-6 sm:p-8 shadow-xl shadow-black/5"
      noValidate
    >
      <div className="space-y-5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          <div>
            <label htmlFor="contact-name" className={labelClass}>
              Nom complet *
            </label>
            <input
              id="contact-name"
              type="text"
              required
              autoComplete="name"
              placeholder="Ex : Aya Koné"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label htmlFor="contact-email" className={labelClass}>
              Adresse email *
            </label>
            <input
              id="contact-email"
              type="email"
              required
              autoComplete="email"
              placeholder="vous@exemple.com"
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              className={inputClass}
            />
          </div>
        </div>

        <div>
          <label htmlFor="contact-subject" className={labelClass}>
            Sujet
          </label>
          <select
            id="contact-subject"
            value={form.subject}
            onChange={(e) => update('subject', e.target.value)}
            className={`${inputClass} appearance-none cursor-pointer`}
          >
            {SUBJECTS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label htmlFor="contact-message" className={labelClass}>
            Votre message *
          </label>
          <textarea
            id="contact-message"
            required
            rows={6}
            placeholder="Décrivez votre demande…"
            value={form.message}
            onChange={(e) => update('message', e.target.value)}
            className={`${inputClass} resize-y`}
          />
        </div>

        {error && (
          <p className="text-sm font-semibold text-red-500 bg-red-500/10 border border-red-500/20 rounded-xl px-4 py-2.5">
            {error}
          </p>
        )}

        {launched && (
          <div className="text-sm font-semibold text-brand dark:text-brand-accent bg-brand/10 border border-brand/20 rounded-xl px-4 py-2.5 flex items-start gap-2">
            <svg className="w-4 h-4 mt-0.5 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 13l4 4L19 7" />
            </svg>
            Votre application mail s&apos;est ouverte avec le message pré-rempli. Il ne reste
            plus qu&apos;à cliquer sur « Envoyer » !
          </div>
        )}

        <button
          type="submit"
          className="w-full inline-flex items-center justify-center gap-2 rounded-xl bg-primary px-6 py-3.5 text-white font-bold text-sm hover:brightness-110 active:brightness-95 shadow-lg shadow-primary/25 transition-all"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <path d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
          </svg>
          Envoyer le message
        </button>

        <p className="text-center text-xs text-black/50 dark:text-white flex items-center justify-center gap-1.5">
          <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
            <rect x="3" y="11" width="18" height="11" rx="2" />
            <path d="M7 11V7a5 5 0 0110 0v4" />
          </svg>
          Votre client mail s&apos;ouvre avec le message pré-rempli — aucune donnée n&apos;est stockée.
        </p>
      </div>
    </form>
  );
}
