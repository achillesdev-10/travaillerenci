import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

/** Bucket public dédié aux photos de CV (voir supabase/migrations/0008). */
const BUCKET = 'cv-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// --- Rate-limit upload photo : 10 uploads / 10 min par IP ---
const PHOTO_UPLOAD_MAX = 10;
const PHOTO_UPLOAD_WINDOW_MS = 10 * 60 * 1000; // 10 minutes

/**
 * POST /api/cv/photo
 * Body : multipart/form-data avec le champ `file`.
 *
 * Réponses :
 *  - 200 { url }                    → photo uploadée, URL publique Supabase
 *  - 400 { error }                  → fichier invalide (type / taille)
 *  - 429 { error }                  → trop d'uploads (rate-limit)
 *  - 501 { error, code }            → Supabase non configuré (le client
 *                                     garde alors un aperçu local blob:)
 */
export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    // --- Rate limiting ---
    const ip = getClientIp(request);
    if (isRateLimited(`cv-photo:${ip}`, PHOTO_UPLOAD_MAX, PHOTO_UPLOAD_WINDOW_MS)) {
      return NextResponse.json(
        { error: 'Trop d\'uploads. Réessayez dans quelques minutes.' },
        { status: 429 },
      );
    }

    const formData = await request.formData();
    const file = formData.get('file');

    if (!(file instanceof File)) {
      return NextResponse.json(
        { error: 'Aucun fichier reçu. Envoyez le champ "file".' },
        { status: 400 }
      );
    }

    const ext = ALLOWED_MIME[file.type];
    if (!ext) {
      return NextResponse.json(
        {
          error:
            'Format non supporté. Utilisez une image JPG, PNG ou WebP.',
        },
        { status: 400 }
      );
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: 'Image trop lourde (5 Mo maximum).' },
        { status: 400 }
      );
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        {
          error:
            'Stockage Supabase non configuré : la photo reste en aperçu local uniquement.',
          code: 'not_configured',
        },
        { status: 501 }
      );
    }

    const supabase = getSupabaseClient();
    if (!supabase) {
      return NextResponse.json(
        { error: 'Client Supabase indisponible.', code: 'not_configured' },
        { status: 501 }
      );
    }

    // Nom de fichier unique (jamais le nom client, pour éviter tout path traversal).
    const fileName = `${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: false,
      });

    // Si le bucket n'existe pas encore (migration SQL non appliquée), on le
    // crée à la volée puis on retente l'upload.
    if (error && error.message?.toLowerCase().includes('bucket')) {
      const { error: createError } = await supabase.storage.createBucket(
        BUCKET,
        { public: true, fileSizeLimit: MAX_FILE_SIZE }
      );
      if (createError) {
        console.error('[api/cv/photo] createBucket error:', createError);
        return NextResponse.json(
          { error: "Impossible de créer le stockage d'images." },
          { status: 500 }
        );
      }
      ({ error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: false,
        }));
    }

    if (error) {
      console.error('[api/cv/photo] upload error:', error);
      return NextResponse.json(
        { error: "Échec de l'upload de la photo." },
        { status: 500 }
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    return NextResponse.json({ url: data.publicUrl });
  } catch (err) {
    console.error('POST /api/cv/photo error:', err);
    return NextResponse.json(
      { error: "Impossible d'uploader la photo." },
      { status: 500 }
    );
  }
}
