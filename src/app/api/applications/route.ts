/**
 *  TravaillerEnCi — /api/applications
 *
 *  Carnet de candidatures externes (Sprint 1).
 *
 *  • POST  — candidat connecté : enregistre une candidature « à finaliser »
 *            après vérification de l'offre (publiée, non expirée, non archivée)
 *            et de la méthode de candidature (site employeur ou e-mail).
 *            AUCUNE candidature n'est transmise par la plateforme.
 *  • GET   — candidat connecté : liste SON carnet. Le suivi entreprise n'est
 *            pas encore supporté (403 explicite) faute d'identifiant
 *            d'entreprise vérifié dans le schéma actuel.
 *  • PATCH — candidat connecté : met à jour SON statut de suivi
 *            (envoyée, réponse reçue, clôturée).
 *
 *  Sécurité : session candidate obligatoire, rate-limit, filtrage systématique
 *  par user_id, validation stricte des entrées et aucune donnée personnelle
 *  dans les analytics.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/userSession';
import type { UserSession } from '@/lib/sessionToken';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import { CandidateProfileService, type CandidateProfile } from '@/services/candidateProfileService';
import { ApplicationService, type ApplicationResult } from '@/services/applicationService';
import { recordEvent, type AnalyticsEventInput } from '@/services/analyticsService';
import {
  buildJobPath,
  buildMailtoHref,
  isCandidateUpdatableStatus,
  isCoverLetterTooLong,
  isOfferOpen,
  normalizeApplyEmail,
  normalizeCoverLetter,
  normalizeHttpUrl,
  normalizeResumeUrl,
  resolveApplyMethod,
  MAX_COVER_LETTER_LENGTH,
} from '@/lib/applicationRules';
import type { ApplicationRecord } from '@/lib/applicationRules';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';
import type { JobOfferSchema } from '@/types';

export const runtime = 'nodejs';

export interface ApplicationsDeps {
  getSessionUser: () => Promise<UserSession | null>;
  getJob: (id: string) => Promise<JobOfferSchema | null>;
  getProfile: (userId: string) => Promise<CandidateProfile | null>;
  record: (input: {
    userId: string;
    jobId: string;
    applyMethod: 'external' | 'email';
    resumeUrl: string | null;
    coverLetter: string | null;
  }) => Promise<ApplicationResult<ApplicationRecord>>;
  list: (
    userId: string,
    options: { limit?: number; offset?: number },
  ) => Promise<ApplicationResult<ApplicationRecord[]>>;
  updateStatus: (
    id: string,
    userId: string,
    status: string,
  ) => Promise<ApplicationResult<ApplicationRecord>>;
  recordEvent: (input: AnalyticsEventInput) => Promise<boolean>;
  isRateLimited: (key: string, max: number, windowMs: number) => boolean;
  getClientIp: (request: Request) => string;
  now: () => Date;
}

const defaultDeps: ApplicationsDeps = {
  getSessionUser,
  getJob: (id) => JobOfferSchemaService.getById(id),
  getProfile: (userId) => CandidateProfileService.get(userId),
  record: (input) => ApplicationService.record(input),
  list: (userId, options) => ApplicationService.listForUser(userId, options),
  updateStatus: (id, userId, status) =>
    ApplicationService.updateStatusForUser(id, userId, status),
  recordEvent,
  isRateLimited,
  getClientIp,
  now: () => new Date(),
};

const RATE_WINDOW_MS = 10 * 60 * 1000;

function unauthorized(message: string) {
  return NextResponse.json({ error: message }, { status: 401 });
}

function forbidden(message: string) {
  return NextResponse.json({ error: message }, { status: 403 });
}

function dbFailure(result: { reason: string; message?: string }) {
  if (result.reason === 'migration_required') {
    return NextResponse.json(
      {
        error:
          'Le carnet de candidatures n’est pas encore activé sur cette base. Migration 0037 requise.',
      },
      { status: 503 },
    );
  }
  if (result.reason === 'duplicate') {
    return NextResponse.json(
      { error: 'Vous avez déjà enregistré cette candidature dans votre carnet.' },
      { status: 409 },
    );
  }
  if (result.reason === 'not_found') {
    return NextResponse.json({ error: 'Candidature introuvable.' }, { status: 404 });
  }
  // Ne jamais exposer le message technique de la base au navigateur.
  if (result.message) console.error('applications db error:', result.message);
  return NextResponse.json(
    { error: 'Erreur lors de l’accès au carnet de candidatures.' },
    { status: 500 },
  );
}

async function readJson(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const value = await request.json();
    return value && typeof value === 'object' && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

function track(
  deps: ApplicationsDeps,
  event: AnalyticsEventInput['event'],
  userId: string,
  jobId: string,
  path: string,
) {
  // Fire-and-forget : l'analytics ne doit jamais faire échouer une candidature.
  void deps
    .recordEvent({ event, label: jobId, path, userId })
    .catch(() => undefined);
}

export function createApplicationsHandlers(overrides: Partial<ApplicationsDeps> = {}) {
  const deps: ApplicationsDeps = { ...defaultDeps, ...overrides };

  async function POST(request: Request) {
    try {
      const session = await deps.getSessionUser();
      if (!session) {
        return unauthorized('Connectez-vous pour enregistrer une candidature.');
      }
      if (session.role !== 'candidate') {
        return forbidden(
          'Seuls les comptes candidats peuvent enregistrer une candidature dans leur carnet.',
        );
      }

      const ip = deps.getClientIp(request);
      if (
        deps.isRateLimited(`applications:post:${session.userId}`, 12, RATE_WINDOW_MS) ||
        deps.isRateLimited(`applications:post:ip:${ip}`, 30, RATE_WINDOW_MS)
      ) {
        return NextResponse.json(
          { error: 'Trop de candidatures enregistrées. Réessayez dans quelques minutes.' },
          { status: 429 },
        );
      }

      const body = await readJson(request);
      if (!body) {
        return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
      }

      const jobId = typeof body.job_id === 'string' ? body.job_id.trim() : '';
      if (!jobId || jobId.length > 100) {
        return NextResponse.json({ error: 'ID de l’offre requis.' }, { status: 400 });
      }

      if (isCoverLetterTooLong(body.cover_letter)) {
        return NextResponse.json(
          { error: `La lettre de motivation ne doit pas dépasser ${MAX_COVER_LETTER_LENGTH} caractères.` },
          { status: 400 },
        );
      }
      const coverLetter = normalizeCoverLetter(body.cover_letter);

      let resumeUrl: string | null = null;
      if (typeof body.resume_url === 'string' && body.resume_url.trim()) {
        resumeUrl = normalizeResumeUrl(body.resume_url);
        if (!resumeUrl) {
          return NextResponse.json(
            { error: 'Le lien du CV doit être une URL http(s) valide.' },
            { status: 400 },
          );
        }
      } else {
        // Le CV est optionnel : une panne du profil ne doit pas bloquer le carnet.
        try {
          const profile = await deps.getProfile(session.userId);
          resumeUrl = normalizeResumeUrl(profile?.resume_url);
        } catch {
          resumeUrl = null;
        }
      }

      const offer = await deps.getJob(jobId);
      if (!offer) {
        return NextResponse.json({ error: 'Offre introuvable.' }, { status: 404 });
      }
      if (!isOfferOpen(offer, deps.now())) {
        return NextResponse.json(
          { error: 'Cette offre ne reçoit plus de candidatures.' },
          { status: 409 },
        );
      }

      const requestedMethod =
        typeof body.apply_method === 'string' ? body.apply_method : null;
      const applyMethod = resolveApplyMethod(offer, requestedMethod);
      if (!applyMethod) {
        return NextResponse.json(
          { error: 'Cette offre ne propose aucun moyen de candidature valide.' },
          { status: 400 },
        );
      }

      const result = await deps.record({
        userId: session.userId,
        jobId: offer.id,
        applyMethod,
        resumeUrl,
        coverLetter,
      });

      if (!result.ok) {
        if (result.reason === 'migration_required') return dbFailure(result);
        if (result.reason === 'duplicate') return dbFailure(result);
        return dbFailure(result);
      }

      track(
        deps,
        'application_started',
        session.userId,
        offer.id,
        buildJobPath(offer.id),
      );

      return NextResponse.json(
        {
          ok: true,
          message:
            'Candidature enregistrée dans votre carnet. Finalisez-la chez l’employeur.',
          application: result.data,
          apply_method: applyMethod,
          redirect_url:
            applyMethod === 'external'
              ? normalizeHttpUrl(offer.apply_link, 2000)
              : normalizeApplyEmail(offer.apply_email)
                ? buildMailtoHref(
                    normalizeApplyEmail(offer.apply_email)!,
                    offer.title,
                    offer.company,
                  )
                : null,
        },
        { status: 201 },
      );
    } catch (err) {
      console.error('POST /api/applications error:', err);
      return NextResponse.json(
        { error: 'Erreur inattendue lors de l’enregistrement.' },
        { status: 500 },
      );
    }
  }

  async function GET(request: Request) {
    try {
      const session = await deps.getSessionUser();
      if (!session) {
        return unauthorized('Connectez-vous pour consulter votre carnet de candidatures.');
      }
      if (session.role !== 'candidate') {
        return forbidden(
          'Le suivi des candidatures côté entreprise n’est pas encore disponible. Utilisez le lien de candidature de vos offres.',
        );
      }

      const ip = deps.getClientIp(request);
      if (deps.isRateLimited(`applications:get:${ip}`, 120, RATE_WINDOW_MS)) {
        return NextResponse.json(
          { error: 'Trop de requêtes. Réessayez dans quelques minutes.' },
          { status: 429 },
        );
      }

      const { searchParams } = new URL(request.url);
      const limit = searchParams.get('limit') ?? '50';
      const offset = searchParams.get('offset') ?? '0';

      const result = await deps.list(session.userId, { limit: Number(limit), offset: Number(offset) });
      if (!result.ok) return dbFailure(result);

      return NextResponse.json({
        applications: result.data,
        total: result.data.length,
        limit: Number(limit) || 50,
        offset: Number(offset) || 0,
      });
    } catch (err) {
      console.error('GET /api/applications error:', err);
      return NextResponse.json(
        { error: 'Erreur inattendue lors du chargement du carnet.' },
        { status: 500 },
      );
    }
  }

  async function PATCH(request: Request) {
    try {
      const session = await deps.getSessionUser();
      if (!session) {
        return unauthorized('Connectez-vous pour mettre à jour votre carnet.');
      }
      if (session.role !== 'candidate') {
        return forbidden(
          'Le suivi des candidatures côté entreprise n’est pas encore disponible.',
        );
      }

      if (deps.isRateLimited(`applications:patch:${session.userId}`, 40, RATE_WINDOW_MS)) {
        return NextResponse.json(
          { error: 'Trop de mises à jour. Réessayez dans quelques minutes.' },
          { status: 429 },
        );
      }

      const body = await readJson(request);
      if (!body) {
        return NextResponse.json({ error: 'Requête invalide.' }, { status: 400 });
      }

      const applicationId =
        typeof body.application_id === 'string' ? body.application_id.trim() : '';
      const status = typeof body.status === 'string' ? body.status.trim() : '';

      if (!applicationId) {
        return NextResponse.json({ error: 'ID de candidature requis.' }, { status: 400 });
      }
      if (!isCandidateUpdatableStatus(status)) {
        return NextResponse.json(
          {
            error:
              'Statut invalide. Statuts autorisés : sent, response_received, closed.',
          },
          { status: 400 },
        );
      }

      const result = await deps.updateStatus(applicationId, session.userId, status);
      if (!result.ok) return dbFailure(result);

      if (status === 'sent') {
        track(
          deps,
          'application_confirmed',
          session.userId,
          result.data.job_id,
          buildJobPath(result.data.job_id),
        );
      } else if (status === 'response_received') {
        track(
          deps,
          'application_response_received',
          session.userId,
          result.data.job_id,
          buildJobPath(result.data.job_id),
        );
      }

      return NextResponse.json({
        ok: true,
        message:
          status === 'sent'
            ? 'Candidature marquée comme envoyée.'
            : status === 'response_received'
              ? 'Réponse de l’employeur enregistrée.'
              : 'Candidature clôturée.',
        application: result.data,
      });
    } catch (err) {
      console.error('PATCH /api/applications error:', err);
      return NextResponse.json(
        { error: 'Erreur inattendue lors de la mise à jour.' },
        { status: 500 },
      );
    }
  }

  return { POST, GET, PATCH };
}

export const { POST, GET, PATCH } = createApplicationsHandlers();
