'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import Link from 'next/link';
import { fetchCurrentUser, type StoredUser } from '@/lib/clientAuth';
import { trackEvent } from '@/lib/analyticsClient';
import { cn } from '@/lib/utils';
import {
  buildApplyReturnPath,
  buildMailtoHref,
  isOfferOpen,
  normalizeApplyEmail,
  normalizeHttpUrl,
  normalizeResumeUrl,
  resolveApplyMethod,
  statusLabel,
  MAX_COVER_LETTER_LENGTH,
  type ApplicationMethod,
  type ApplicationRecord,
} from '@/lib/applicationRules';

export interface ApplyPanelJob {
  id: string;
  title: string;
  company: string;
  apply_link: string | null;
  apply_email: string | null;
  status: string;
  is_archived: boolean;
  is_expired: boolean;
  deadline: string | null;
}

interface ApplyPanelProps {
  job: ApplyPanelJob;
  variant?: 'horizontal' | 'vertical' | 'compact';
  /** Ouvre le panneau au retour d'inscription (?postuler=1). Un seul panneau doit l'activer. */
  autoOpen?: boolean;
}

interface ProfileResume {
  resume_url: string | null;
}

export default function ApplyPanel({ job, variant, autoOpen = false }: ApplyPanelProps) {
  const [open, setOpen] = useState(false);
  const [preferredMethod, setPreferredMethod] = useState<ApplicationMethod | null>(null);
  const [mounted, setMounted] = useState(false);
  const [sessionChecked, setSessionChecked] = useState(false);
  const [user, setUser] = useState<StoredUser | null>(null);
  const [profile, setProfile] = useState<ProfileResume | null>(null);
  const [profileLoading, setProfileLoading] = useState(false);
  const [method, setMethod] = useState<ApplicationMethod | null>(null);
  const [coverLetter, setCoverLetter] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [recorded, setRecorded] = useState<ApplicationRecord | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [externalOpened, setExternalOpened] = useState(false);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  const offerOpen = isOfferOpen(job);
  const externalUrl = normalizeHttpUrl(job.apply_link, 2000);
  const applyEmail = normalizeApplyEmail(job.apply_email);
  const availableMethod = resolveApplyMethod(job, preferredMethod);
  const nextPath = buildApplyReturnPath(job.id);

  // Portail client + ouverture automatique au retour d'inscription (?postuler=1).
  // Ces états dépendent de window, indisponible au rendu serveur.
  /* eslint-disable react-hooks/set-state-in-effect */
  useEffect(() => {
    setMounted(true);
    if (typeof window === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    if (autoOpen && params.get('postuler') === '1' && offerOpen) {
      setOpen(true);
      setMethod(resolveApplyMethod(job, null));
    }
  }, [autoOpen, offerOpen, job]);
  /* eslint-enable react-hooks/set-state-in-effect */

  const close = useCallback(() => {
    setOpen(false);
    setError(null);
    if (typeof window !== 'undefined') {
      const url = new URL(window.location.href);
      if (url.searchParams.has('postuler')) {
        url.searchParams.delete('postuler');
        window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
      }
    }
  }, []);

  useEffect(() => {
    if (!open) return;
    closeButtonRef.current?.focus();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') close();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener('keydown', onKeyDown);
    };
  }, [open, close]);

  useEffect(() => {
    if (!open || sessionChecked) return;
    let cancelled = false;
    // Marqueurs de chargement locaux : synchronisés avec l'ouverture du panneau.
    /* eslint-disable react-hooks/set-state-in-effect */
    setSessionChecked(true);
    setProfileLoading(true);
    /* eslint-enable react-hooks/set-state-in-effect */

    fetchCurrentUser()
      .then(async (current) => {
        if (cancelled) return;
        setUser(current);
        if (current?.role === 'candidate') {
          try {
            const res = await fetch('/api/candidate/profile', { cache: 'no-store' });
            if (!res.ok) return;
            const data = (await res.json()) as { profile?: ProfileResume | null };
            if (!cancelled) setProfile(data.profile ?? null);
          } catch {
            // Le CV est optionnel : une erreur de profil ne bloque jamais le carnet.
          }
        }
      })
      .catch(() => {
        if (!cancelled) setUser(null);
      })
      .finally(() => {
        if (!cancelled) setProfileLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [open, sessionChecked]);

  function openPanel(preferred?: ApplicationMethod) {
    setPreferredMethod(preferred ?? null);
    setMethod(preferred ?? availableMethod);
    setRecorded(null);
    setError(null);
    setOpen(true);
  }

  function removePostulerParam() {
    if (typeof window === 'undefined') return;
    const url = new URL(window.location.href);
    if (url.searchParams.has('postuler')) {
      url.searchParams.delete('postuler');
      window.history.replaceState({}, '', `${url.pathname}${url.search}${url.hash}`);
    }
  }

  function markExternalRedirect() {
    trackEvent('application_external_redirect', {
      label: job.id,
      path: `/jobs/${job.id}`,
    });
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!user || user.role !== 'candidate' || !method || loading) return;
    if (coverLetter.trim().length > MAX_COVER_LETTER_LENGTH) {
      setError(`La lettre de motivation ne doit pas dépasser ${MAX_COVER_LETTER_LENGTH} caractères.`);
      return;
    }

    setError(null);
    setLoading(true);

    // Fenêtre ouverte pendant le clic (sinon le navigateur bloque le popup).
    let popup: Window | null = null;
    if (method === 'external' && externalUrl) {
      popup = window.open('about:blank', '_blank');
      if (popup) {
        popup.opener = null;
        try {
          popup.document.title = 'Redirection vers l’employeur…';
          popup.document.body.textContent =
            'Enregistrement de votre candidature dans votre carnet…';
        } catch {
          // Certains navigateurs limitent l'accès au document vierge.
        }
      }
    }

    try {
      const res = await fetch('/api/applications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          job_id: job.id,
          apply_method: method,
          cover_letter: coverLetter.trim() || undefined,
        }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        application?: ApplicationRecord;
        error?: string;
        apply_method?: ApplicationMethod;
      };

      if (!res.ok) {
        popup?.close();
        setError(data.error || 'Impossible d’enregistrer la candidature.');
        return;
      }

      const savedMethod = data.apply_method ?? method;
      setRecorded(data.application ?? null);
      setMethod(savedMethod);
      removePostulerParam();

      if (savedMethod === 'external' && externalUrl) {
        if (popup && !popup.closed) {
          popup.location.href = externalUrl;
          markExternalRedirect();
          setExternalOpened(true);
        } else {
          // Popup bloqué : ne pas compter une redirection qui n'a pas eu lieu.
          // Le lien « Ouvrir l'offre » déclenchera la mesure au clic réel.
          setExternalOpened(false);
        }
      } else if (savedMethod === 'email' && applyEmail) {
        popup?.close();
        window.location.assign(buildMailtoHref(applyEmail, job.title, job.company));
      } else {
        popup?.close();
      }
    } catch {
      popup?.close();
      setError('Erreur réseau : la candidature n’a pas été enregistrée.');
    } finally {
      setLoading(false);
    }
  }

  async function markSent() {
    if (!recorded || confirmLoading) return;
    setConfirmLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/applications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ application_id: recorded.id, status: 'sent' }),
      });
      const data = (await res.json().catch(() => ({}))) as {
        application?: ApplicationRecord;
        error?: string;
      };
      if (!res.ok) {
        setError(data.error || 'Impossible de mettre à jour le statut.');
        return;
      }
      setRecorded(data.application ?? { ...recorded, status: 'sent' });
    } catch {
      setError('Erreur réseau : le statut n’a pas été mis à jour.');
    } finally {
      setConfirmLoading(false);
    }
  }

  const triggerDisabled = !offerOpen || !availableMethod;
  const triggerLabel = !offerOpen
    ? 'Offre clôturée'
    : availableMethod === 'email'
      ? 'Postuler par email'
      : 'Postuler';

  const trigger = (compact = false) => (
    <button
      type="button"
      onClick={() => openPanel(availableMethod ?? undefined)}
      disabled={triggerDisabled}
      className={cn(
        'inline-flex items-center justify-center gap-2 rounded-xl bg-primary font-bold text-white shadow-lg shadow-primary/25 transition-all hover:bg-primary-dark active:scale-[0.99] disabled:cursor-not-allowed disabled:opacity-50',
        compact ? 'w-full px-3 py-3 text-[13px]' : 'w-full px-4 py-3 text-sm',
      )}
    >
      <svg
        className="h-4 w-4 shrink-0"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m3 7 9 6 9-6" />
      </svg>
      <span className="truncate">{triggerLabel}</span>
    </button>
  );

  const modal =
    mounted && open
      ? createPortal(
          <div className="fixed inset-0 z-[80] flex items-end justify-center sm:items-center">
            <button
              type="button"
              aria-label="Fermer le panneau de candidature"
              onClick={close}
              className="absolute inset-0 bg-black/55 backdrop-blur-[2px]"
            />
            <div
              role="dialog"
              aria-modal="true"
              aria-labelledby="apply-panel-title"
              className="relative max-h-[92vh] w-full overflow-y-auto rounded-t-3xl border border-line bg-white p-5 shadow-2xl dark:border-slate-700 dark:bg-slate-900 sm:max-w-lg sm:rounded-3xl sm:p-6"
            >
              <div className="mb-4 flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <h2
                    id="apply-panel-title"
                    className="text-lg font-bold text-black dark:text-white"
                  >
                    {recorded ? 'Candidature enregistrée' : 'Postuler à cette offre'}
                  </h2>
                  <p className="mt-1 line-clamp-2 text-xs text-black/70 dark:text-white/70">
                    {job.title} · {job.company}
                  </p>
                </div>
                <button
                  ref={closeButtonRef}
                  type="button"
                  onClick={close}
                  aria-label="Fermer"
                  className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border border-line text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-white"
                >
                  <svg
                    className="h-4 w-4"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth={2}
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    aria-hidden="true"
                  >
                    <path d="M18 6 6 18M6 6l12 12" />
                  </svg>
                </button>
              </div>

              <p className="rounded-2xl border border-primary/20 bg-primary/5 p-3 text-[12px] leading-relaxed text-black dark:text-white">
                TravaillerEnCi ne transmet pas votre candidature. Nous la gardons dans
                votre carnet, puis vous êtes redirigé vers l’employeur pour la
                finaliser.
              </p>

              {error ? (
                <p
                  role="alert"
                  className="mt-3 rounded-xl border border-rose-500/30 bg-rose-500/10 p-3 text-xs font-semibold text-rose-700 dark:text-rose-300"
                >
                  {error}
                </p>
              ) : null}

              {recorded ? (
                <div className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-line p-4 dark:border-slate-700">
                    <p className="text-xs font-bold text-black dark:text-white">
                      Statut : {statusLabel(recorded.status)}
                    </p>
                    <p className="mt-1 text-[12px] text-black/60 dark:text-white/70">
                      {recorded.apply_method === 'email'
                        ? 'Votre email de candidature est prêt. Envoyez-le depuis votre messagerie.'
                        : 'Votre candidature est dans votre carnet. Finalisez-la sur le site de l’employeur.'}
                    </p>
                  </div>

                  {recorded.status === 'to_finalize' || recorded.status === 'pending' ? (
                    <button
                      type="button"
                      onClick={markSent}
                      disabled={confirmLoading}
                      className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-dark disabled:opacity-50"
                    >
                      {confirmLoading ? 'Enregistrement…' : 'J’ai postulé'}
                    </button>
                  ) : null}

                  <div className="flex flex-col gap-2 sm:flex-row">
                    {recorded.apply_method === 'external' && externalUrl ? (
                      <a
                        href={externalUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={() => {
                          if (!externalOpened) markExternalRedirect();
                          setExternalOpened(true);
                        }}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-dark"
                      >
                        Ouvrir l’offre
                      </a>
                    ) : recorded.apply_method === 'email' && applyEmail ? (
                      <a
                        href={buildMailtoHref(applyEmail, job.title, job.company)}
                        className="inline-flex flex-1 items-center justify-center gap-2 rounded-xl bg-primary px-4 py-3 text-sm font-bold text-white transition-all hover:bg-primary-dark"
                      >
                        Rouvrir l’email
                      </a>
                    ) : null}
                    <Link
                      href="/dashboard/candidate#candidatures"
                      className="inline-flex flex-1 items-center justify-center rounded-xl border border-line px-4 py-3 text-sm font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-white"
                    >
                      Voir mon carnet
                    </Link>
                  </div>
                </div>
              ) : !sessionChecked ? (
                <p className="mt-6 text-center text-sm text-black/60 dark:text-white/70">
                  Chargement de votre session…
                </p>
              ) : !user ? (
                <div className="mt-5 space-y-3">
                  <p className="text-[13px] text-black/70 dark:text-white/70">
                    Créez un compte gratuit pour enregistrer cette candidature et la
                    retrouver plus tard dans votre carnet.
                  </p>
                  <Link
                    href={`/register?next=${encodeURIComponent(nextPath)}`}
                    className="block w-full rounded-xl bg-primary px-4 py-3 text-center text-sm font-bold text-white transition-all hover:bg-primary-dark"
                  >
                    Créer mon compte
                  </Link>
                  <Link
                    href={`/login?next=${encodeURIComponent(nextPath)}`}
                    className="block w-full rounded-xl border border-line px-4 py-3 text-center text-sm font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:text-white"
                  >
                    J’ai déjà un compte
                  </Link>
                  {externalUrl ? (
                    <a
                      href={externalUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      data-apply={job.id}
                      className="block px-2 py-2 text-center text-xs font-semibold text-primary hover:underline"
                    >
                      Continuer sans compte sur le site de l’employeur
                    </a>
                  ) : applyEmail ? (
                    <a
                      href={buildMailtoHref(applyEmail, job.title, job.company)}
                      data-apply={job.id}
                      className="block px-2 py-2 text-center text-xs font-semibold text-primary hover:underline"
                    >
                      Écrire à l’employeur sans compte
                    </a>
                  ) : null}
                </div>
              ) : user.role !== 'candidate' ? (
                <p className="mt-5 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-800 dark:text-amber-200">
                  Ce compte est un compte entreprise. Connectez-vous avec un compte
                  candidat pour enregistrer une candidature dans un carnet.
                </p>
              ) : (
                <form onSubmit={handleSubmit} className="mt-5 space-y-4">
                  <div className="rounded-2xl border border-line p-3.5 dark:border-slate-700">
                    <p className="text-[11px] font-bold uppercase tracking-wide text-black/50 dark:text-white/60">
                      CV associé
                    </p>
                    {profileLoading ? (
                      <p className="mt-1 text-xs text-black/60 dark:text-white/70">
                        Chargement du profil…
                      </p>
                    ) : normalizeResumeUrl(profile?.resume_url) ? (
                      <a
                        href={normalizeResumeUrl(profile?.resume_url) ?? '#'}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="mt-1 inline-block break-all text-xs font-semibold text-primary hover:underline"
                      >
                        {normalizeResumeUrl(profile?.resume_url)}
                      </a>
                    ) : (
                      <p className="mt-1 text-xs text-black/60 dark:text-white/70">
                        Aucun CV associé.{' '}
                        <Link
                          href="/dashboard/candidate#profil"
                          className="font-semibold text-primary hover:underline"
                        >
                          Ajoutez votre lien CV
                        </Link>{' '}
                        depuis votre profil.
                      </p>
                    )}
                  </div>

                  {externalUrl && applyEmail ? (
                    <fieldset>
                      <legend className="mb-2 text-[11px] font-bold uppercase tracking-wide text-black/50 dark:text-white/60">
                        Comment finaliser ?
                      </legend>
                      <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
                        {(
                          [
                            ['external', 'Site de l’employeur'],
                            ['email', 'Par email'],
                          ] as const
                        ).map(([value, label]) => (
                          <button
                            key={value}
                            type="button"
                            onClick={() => setMethod(value)}
                            aria-pressed={method === value}
                            className={cn(
                              'rounded-xl border px-3 py-2.5 text-left text-xs font-bold transition-all',
                              method === value
                                ? 'border-primary bg-primary/10 text-primary dark:text-brand-accent'
                                : 'border-line text-black hover:border-primary/40 dark:border-slate-700 dark:text-white',
                            )}
                          >
                            {label}
                          </button>
                        ))}
                      </div>
                    </fieldset>
                  ) : (
                    <p className="text-[12px] text-black/60 dark:text-white/70">
                      Finalisation :{' '}
                      <strong className="text-black dark:text-white">
                        {method === 'email' ? 'par email' : 'sur le site de l’employeur'}
                      </strong>
                    </p>
                  )}

                  <div>
                    <label
                      htmlFor="apply-cover-letter"
                      className="mb-1.5 block text-[11px] font-bold uppercase tracking-wide text-black/50 dark:text-white/60"
                    >
                      Lettre de motivation (facultatif)
                    </label>
                    <textarea
                      id="apply-cover-letter"
                      value={coverLetter}
                      onChange={(event) => setCoverLetter(event.target.value)}
                      maxLength={MAX_COVER_LETTER_LENGTH}
                      rows={4}
                      placeholder="Quelques lignes pour votre suivi personnel (elles ne sont pas envoyées automatiquement)."
                      className="w-full resize-y rounded-xl border border-line bg-surface px-3 py-2.5 text-sm text-black outline-none transition-colors focus:border-primary dark:border-slate-700 dark:bg-slate-950 dark:text-white"
                    />
                    <p className="mt-1 text-right text-[10px] text-black/50 dark:text-white/50">
                      {coverLetter.trim().length}/{MAX_COVER_LETTER_LENGTH}
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={loading || !method}
                    className="w-full rounded-xl bg-primary px-4 py-3.5 text-sm font-bold text-white shadow-lg shadow-primary/20 transition-all hover:bg-primary-dark disabled:opacity-50"
                  >
                    {loading
                      ? 'Enregistrement…'
                      : method === 'email'
                        ? 'Enregistrer et préparer l’email'
                        : 'Enregistrer et continuer vers l’employeur'}
                  </button>
                  <p className="text-center text-[10px] leading-relaxed text-black/50 dark:text-white/50">
                    En continuant, vous acceptez de finaliser votre candidature
                    directement auprès de {job.company}. TravaillerEnCi n’est pas
                    l’employeur.
                  </p>
                </form>
              )}
            </div>
          </div>,
          document.body,
        )
      : null;

  if (variant === 'compact') {
    return (
      <>
        <div className="flex min-w-0 items-stretch gap-2">
          {trigger(true)}
          {externalUrl && applyEmail ? (
            <button
              type="button"
              onClick={() => openPanel('email')}
              disabled={triggerDisabled}
              aria-label="Postuler par email"
              title="Postuler par email"
              className="flex shrink-0 items-center justify-center rounded-xl border border-line px-3 text-black transition-colors hover:border-primary/40 hover:text-primary disabled:opacity-50 dark:border-slate-700 dark:text-white"
            >
              <svg
                className="h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <rect x="3" y="5" width="18" height="14" rx="2" />
                <path d="m3 7 9 6 9-6" />
              </svg>
            </button>
          ) : null}
        </div>
        {modal}
      </>
    );
  }

  if (variant === 'horizontal') {
    return (
      <>
        <div className="flex flex-col gap-3 rounded-2xl border border-line bg-white/90 p-3 shadow-sm dark:border-slate-800 dark:bg-slate-900/90 sm:flex-row sm:items-center sm:gap-4 sm:p-4">
          <div className="flex-1 text-[13px] text-black dark:text-white sm:text-sm">
            <span className="font-semibold">Prêt à postuler ?</span>{' '}
            <span className="text-black/60 dark:text-white/70">
              Enregistrez la candidature, puis finalisez-la chez {job.company}.
            </span>
          </div>
          <div className="sm:w-56">{trigger()}</div>
        </div>
        {modal}
      </>
    );
  }

  return (
    <>
      <div className="rounded-2xl border border-line bg-white p-5 dark:border-slate-800 dark:bg-slate-900">
        <div className="mb-4 flex items-center gap-2">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary dark:text-brand-accent">
            <svg
              className="h-5 w-5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M20 7h-3a2 2 0 0 1-2-2V2" />
              <path d="M9 18a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h5l5 5v9a2 2 0 0 1-2 2h-1" />
              <path d="M9 18H7a2 2 0 0 0-2 2 2 2 0 0 0 2 2h10a2 2 0 0 0 2-2 2 2 0 0 0-2-2" />
            </svg>
          </div>
          <div>
            <div className="font-bold text-black dark:text-white">Postuler maintenant</div>
            <div className="text-xs text-black/60 dark:text-white/60">
              Carnet + redirection employeur
            </div>
          </div>
        </div>
        {trigger()}
        <p className="mt-4 text-[11px] leading-relaxed text-black/60 dark:text-white/70">
          Votre candidature est d’abord enregistrée dans votre carnet, puis vous
          finalisez la démarche chez {job.company}. TravaillerEnCi n’est pas
          l’employeur et ne participe pas au recrutement.
        </p>
      </div>
      {modal}
    </>
  );
}
