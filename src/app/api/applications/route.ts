/** 
 *  TravaillerEnCi — /api/applications
 * 
 *  • POST    — candidat postule à une offre (vérifie connexion,
 *    existence offre, pas de doublon, offre publiée). Enregistre en BDD
 *    + notification admin.
 *  • GET     — entreprise voit les candidatures de ses offres (filtres,
 *    pagination).
 *  • PATCH   — entreprise modifie le statut d'une candidature.
 */

import { NextResponse } from 'next/server';
import { getSessionUser } from '@/lib/userSession';
import { JobOfferSchemaService } from '@/services/jobOfferSchemaService';
import type { JobOfferSchema } from '@/types';

export const runtime = 'nodejs';

// Statuses valides pour une candidature
const VALID_APPLICATION_STATUSES = [
  'submitted',
  'reviewing',
  'shortlisted',
  'interview',
  'rejected',
  'hired',
] as const;

// ---------------------------------------------------------------------------
// POST /api/applications — candidat postule
// ---------------------------------------------------------------------------

export async function POST(request: Request) {
  try {
    const session = await getSessionUser();

    // 1. Vérifier que l'utilisateur est connecté en tant que candidat
    if (!session || session.role !== 'candidate') {
      return NextResponse.json(
        { error: 'Non autorisé. Seuls les candidats peuvent postuler.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      job_id: string;
      cover_letter?: string;
      resume_url?: string;
    };

    if (!body.job_id) {
      return NextResponse.json(
        { error: 'ID de l\'offre requis.' },
        { status: 400 }
      );
    }

    // 2. Vérifier que l'offre existe
    const offer = await JobOfferSchemaService.getById(body.job_id);
    if (!offer) {
      return NextResponse.json(
        { error: 'Offre introuvable.' },
        { status: 404 }
      );
    }

    // 3. Vérifier que l'offre est publiée (accepte les candidatures)
    if (offer.status !== 'published') {
      return NextResponse.json(
        { error: 'Cette offre ne reçoit plus de candidatures.' },
        { status: 400 }
      );
    }

    // 4. Enregistrer la candidature via Supabase
    const supabase = (await import('@/lib/supabase')).getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase non configuré.' },
        { status: 500 }
      );
    }

    const { data, error } = await supabase
      .from('applications')
      .insert({
        job_id: body.job_id,
        candidate_id: session.userId,
        cover_letter: body.cover_letter || null,
        resume_url: body.resume_url || null,
        status: 'submitted' as const,
      })
      .select()
      .single();

    if (error) {
      // Contrainte UNIQUE violée → doublon
      if (String(error.code) === '23505') {
        return NextResponse.json(
          { error: 'Vous avez déjà postulé à cette offre.' },
          { status: 409 }
        );
      }
      console.error('Applications POST error:', error);
      return NextResponse.json(
        { error: error.message || 'Erreur lors de l\'enregistrement.' },
        { status: 500 }
      );
    }

    // 5. Notification admin (fire-and-forget)
    try {
      const { AdminNotificationService } = await import('@/services/adminNotificationService');
      await AdminNotificationService.create(
        'new_application',
        `Nouvelle candidature pour "${offer.title}" — ${session.name || ''}`,
        `/cz7tk/jobs/${offer.id}`
      );
    } catch {
      // Silently ignore — notification non critique
    }

    return NextResponse.json(
      { 
        ok: true, 
        message: 'Votre candidature a été envoyée avec succès !',
        application: data 
      }, 
      { status: 201 }
    );
  } catch (err: unknown) {
    console.error('POST /api/applications error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inattendue' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// GET /api/applications — entreprise voit ses candidatures
// ---------------------------------------------------------------------------

export async function GET(request: Request) {
  try {
    const session = await getSessionUser();

    // 1. Vérifier que l'utilisateur est connecté en tant qu'entreprise
    if (!session || session.role !== 'company') {
      return NextResponse.json(
        { error: 'Non autorisé. Seules les entreprises peuvent voir les candidatures.' },
        { status: 401 }
      );
    }

    const { searchParams } = new URL(request.url);
    const offerId = searchParams.get('offer_id') || undefined;
    const statusFilter = searchParams.get('status') || undefined;
    const limit = Number(searchParams.get('limit') || '20');
    const offset = Number(searchParams.get('offset') || '0');

    const supabase = (await import('@/lib/supabase')).getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase non configuré.' },
        { status: 500 }
      );
    }

    // 2. Construire la requête : on filtre par company via les job_offers
    // L'entreprise est identifiée par son nom dans la session
    const companyName = session.name;

    let query = supabase
      .from('applications')
      .select('*, job_offers(title, company, contract_type, status, is_featured), candidates(id, full_name, avatar_url)', { count: 'exact' })
      .eq('job_offers.company', companyName);

    // Filtre par offre spécifique
    if (offerId) {
      query = query.eq('job_id', offerId);
    }

    // Filtre par statut
    if (statusFilter && VALID_APPLICATION_STATUSES.includes(statusFilter as 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'rejected' | 'hired')) {
      query = query.eq('status', statusFilter);
    }

    // Ordre et pagination
    query = query
      .order('applied_at', { ascending: false })
      .range(offset, offset + limit - 1);

    const { data, error, count } = await query;

    if (error) {
      console.error('Applications GET error:', error);
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la récupération.' },
        { status: 500 }
      );
    }

    return NextResponse.json({
      applications: data || [],
      total: count || 0,
      limit,
      offset,
    });
  } catch (err: unknown) {
    console.error('GET /api/applications error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inattendue' },
      { status: 500 }
    );
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/applications — entreprise modifie le statut
// ---------------------------------------------------------------------------

export async function PATCH(request: Request) {
  try {
    const session = await getSessionUser();

    // 1. Vérifier que l'utilisateur est connecté en tant qu'entreprise
    if (!session || session.role !== 'company') {
      return NextResponse.json(
        { error: 'Non autorisé. Seules les entreprises peuvent modifier les candidatures.' },
        { status: 401 }
      );
    }

    const body = (await request.json()) as {
      application_id: string;
      status: string;
    };

    if (!body.application_id || !body.status) {
      return NextResponse.json(
        { error: 'ID de candidature et nouveau statut requis.' },
        { status: 400 }
      );
    }

    // 2. Vérifier que le statut est valide
    if (!VALID_APPLICATION_STATUSES.includes(body.status as 'submitted' | 'reviewing' | 'shortlisted' | 'interview' | 'rejected' | 'hired')) {
      return NextResponse.json(
        { error: `Statut invalide. Statuts valides : ${VALID_APPLICATION_STATUSES.join(', ')}` },
        { status: 400 }
      );
    }

    const supabase = (await import('@/lib/supabase')).getSupabaseClient();

    if (!supabase) {
      return NextResponse.json(
        { error: 'Supabase non configuré.' },
        { status: 500 }
      );
    }

    // 3. Récupérer la candidature avec le job_id pour vérifier la propriété
    const { data: appData, error: appError } = await supabase
      .from('applications')
      .select('*, job_offers(company)')
      .eq('id', body.application_id)
      .single();

    if (appError || !appData) {
      return NextResponse.json(
        { error: 'Candidature introuvable.' },
        { status: 404 }
      );
    }

    // 4. Vérifier que l'offre appartient à cette entreprise
    if (appData.job_offers.company !== session.name) {
      return NextResponse.json(
        { error: 'Non autorisé à modifier cette candidature.' },
        { status: 403 }
      );
    }

    // 5. Mettre à jour le statut
    const { data, error } = await supabase
      .from('applications')
      .update({ status: body.status, updated_at: new Date().toISOString() })
      .eq('id', body.application_id)
      .select()
      .single();

    if (error) {
      console.error('Applications PATCH error:', error);
      return NextResponse.json(
        { error: error.message || 'Erreur lors de la mise à jour.' },
        { status: 500 }
      );
    }

    // 6. Notification au candidat (le système existant gère les notifications)
    try {
      const { AdminNotificationService } = await import('@/services/adminNotificationService');
      await AdminNotificationService.create(
        'status_update',
        `Votre candidature pour "${appData.job_offers.title}" est maintenant "${body.status}".`,
        `/candidates/dashboard`
      );
    } catch {
      // Silently ignore
    }

    return NextResponse.json({
      ok: true,
      message: 'Statut mis à jour avec succès.',
      application: data,
    });
  } catch (err: unknown) {
    console.error('PATCH /api/applications error:', err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : 'Erreur inattendue' },
      { status: 500 }
    );
  }
}