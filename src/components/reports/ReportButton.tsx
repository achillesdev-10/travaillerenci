'use client';

import { useEffect, useState } from 'react';

type ReportItemType = 'job' | 'internship' | 'scholarship' | 'exam';

const REASONS: Array<{
  value: 'frais_demandes' | 'contenu_frauduleux' | 'info_inexacte' | 'contenu_inapproprie' | 'autre';
  label: string;
  description: string;
}> = [
  {
    value: 'frais_demandes',
    label: 'Frais demandés',
    description: "On demande de l'argent : frais de dossier, formation obligatoire, kit de recrutement…",
  },
  {
    value: 'contenu_frauduleux',
    label: 'Contenu frauduleux',
    description: "Fausse offre, usurpation d'identité d'une entreprise ou d'un organisme.",
  },
  {
    value: 'info_inexacte',
    label: 'Informations inexactes',
    description: 'Annonce obsolète, conditions trompeuses, dates erronées.',
  },
  {
    value: 'contenu_inapproprie',
    label: 'Contenu inapproprié',
    description: 'Propos offensants, contenu choquant ou illégal.',
  },
  {
    value: 'autre',
    label: 'Autre motif',
    description: 'Un autre problème sur ce contenu.',
  },
];

export default function ReportButton({
  itemType,
  itemId,
  itemLabel = 'ce contenu',
  label = 'Signaler',
  className = '',
}: {
  itemType: ReportItemType;
  itemId: string;
  itemLabel?: string;
  label?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState<string>('');
  const [details, setDetails] = useState('');
  const [reporterEmail, setReporterEmail] = useState('');
  const [state, setState] = useState<'idle' | 'submitting' | 'done' | 'error'>('idle');
  const [errorMsg, setErrorMsg] = useState('');

  function close() {
    setOpen(false);
    // Réinitialise après fermeture pour un prochain signalement propre.
    setReason('');
    setDetails('');
    setReporterEmail('');
    setState('idle');
    setErrorMsg('');
  }

  // Modal : fermeture sur Échap + verrouillage du scroll de fond.
  useEffect(() => {
    if (!open) return;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') close();
    }
    window.addEventListener('keydown', onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!reason) {
      setErrorMsg('Merci de choisir un motif de signalement.');
      return;
    }
    setState('submitting');
    setErrorMsg('');
    try {
      const res = await fetch('/api/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          item_type: itemType,
          item_id: itemId,
          reason,
          details: details.trim() || undefined,
          reporter_email: reporterEmail.trim() || undefined,
        }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        setState('error');
        setErrorMsg(data?.error || 'Une erreur est survenue. Réessayez dans un instant.');
        return;
      }
      setState('done');
    } catch {
      setState('error');
      setErrorMsg('Connexion impossible. Vérifiez votre connexion et réessayez.');
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300 ${className}`}
      >
        <svg
          className="h-3.5 w-3.5"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden="true"
        >
          <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
          <path d="M12 9v4" />
          <path d="M12 17h.01" />
        </svg>
        {label}
      </button>

      {open && (
        <div
          className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/70 backdrop-blur-sm p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="report-title"
          onClick={(e) => {
            if (e.target === e.currentTarget) close();
          }}
        >
          <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-2xl dark:border-slate-700 dark:bg-slate-900">
            {state === 'done' ? (
              <div className="py-6 text-center">
                <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-emerald-500/15">
                  <svg
                    className="h-7 w-7 text-emerald-600 dark:text-emerald-400"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2.5}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
                    <path d="m9 11 3 3L22 4" />
                  </svg>
                </div>
                <h3 className="mt-4 text-lg font-bold text-gray-900 dark:text-white">
                  Merci, signalement enregistré
                </h3>
                <p className="mt-1.5 text-sm text-gray-600 dark:text-gray-300">
                  Notre équipe vérifiera « {itemLabel} » rapidement. Le contenu
                  pourra être retiré s&apos;il s&apos;avère frauduleux.
                </p>
                <button
                  type="button"
                  onClick={close}
                  className="mt-5 rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-white hover:brightness-110 transition-all"
                >
                  Fermer
                </button>
              </div>
            ) : (
              <>
                <div className="flex items-start justify-between gap-3 border-b border-slate-100 pb-4 dark:border-slate-800">
                  <div>
                    <h3 id="report-title" className="text-lg font-bold text-gray-900 dark:text-white">
                      Signaler ce contenu
                    </h3>
                    <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">
                      « {itemLabel} » — votre signalement reste confidentiel.
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="Fermer"
                    className="text-gray-400 hover:text-gray-700 dark:hover:text-white text-xl font-bold leading-none"
                  >
                    &times;
                  </button>
                </div>

                <form onSubmit={handleSubmit} className="mt-4 space-y-4">
                  <fieldset>
                    <legend className="text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400">
                      Motif du signalement
                    </legend>
                    <div className="mt-2 space-y-2">
                      {REASONS.map((r) => (
                        <label
                          key={r.value}
                          className={`flex cursor-pointer items-start gap-3 rounded-2xl border p-3 transition-colors ${
                            reason === r.value
                              ? 'border-emerald-500/50 bg-emerald-50 dark:bg-emerald-500/10'
                              : 'border-slate-200 hover:border-slate-300 dark:border-slate-700 dark:hover:border-slate-600'
                          }`}
                        >
                          <input
                            type="radio"
                            name="reason"
                            value={r.value}
                            checked={reason === r.value}
                            onChange={(e) => setReason(e.target.value)}
                            className="mt-0.5 h-4 w-4 accent-emerald-600"
                          />
                          <span className="min-w-0">
                            <span className="block text-sm font-semibold text-gray-900 dark:text-white">
                              {r.label}
                            </span>
                            <span className="block text-xs text-gray-500 dark:text-gray-400">
                              {r.description}
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </fieldset>

                  <div>
                    <label
                      htmlFor="report-details"
                      className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    >
                      Précisions (optionnel)
                    </label>
                    <textarea
                      id="report-details"
                      value={details}
                      onChange={(e) => setDetails(e.target.value)}
                      rows={3}
                      maxLength={1000}
                      placeholder="Ex. : l'annonce demande 5 000 FCFA de frais de dossier par email…"
                      className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  <div>
                    <label
                      htmlFor="report-email"
                      className="block text-[11px] font-bold uppercase tracking-widest text-slate-500 dark:text-slate-400"
                    >
                      Votre email (optionnel, pour le suivi)
                    </label>
                    <input
                      id="report-email"
                      type="email"
                      value={reporterEmail}
                      onChange={(e) => setReporterEmail(e.target.value)}
                      placeholder="vous@exemple.com"
                      className="mt-1.5 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-gray-900 focus:outline-none focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white dark:placeholder:text-slate-500"
                    />
                  </div>

                  {state === 'error' && errorMsg && (
                    <p className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-2.5 text-xs font-semibold text-rose-600 dark:text-rose-400">
                      {errorMsg}
                    </p>
                  )}

                  <div className="flex items-center justify-end gap-3 border-t border-slate-100 pt-4 dark:border-slate-800">
                    <button
                      type="button"
                      onClick={close}
                      className="rounded-2xl bg-slate-100 px-5 py-3 text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors dark:bg-slate-800 dark:text-slate-300 dark:hover:bg-slate-700"
                    >
                      Annuler
                    </button>
                    <button
                      type="submit"
                      disabled={state === 'submitting'}
                      className="rounded-2xl bg-rose-600 px-6 py-3 text-xs font-bold text-white hover:bg-rose-700 shadow-lg shadow-rose-600/20 transition-all disabled:opacity-50 disabled:cursor-wait"
                    >
                      {state === 'submitting' ? 'Envoi…' : 'Envoyer le signalement'}
                    </button>
                  </div>
                </form>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
