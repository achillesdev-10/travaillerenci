import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { requireAdminApi } from '@/lib/adminSession';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';
import { getClientIp, isRateLimited } from '@/lib/rateLimit';

/**
 * Bucket public dédié aux images des articles Entreprendre.
 * Créé automatiquement si absent (même pattern que cv-photos / profile-photos).
 */
const BUCKET = 'entreprendre-images';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

// Rate-limit : 20 uploads / 10 min par IP
const UPLOAD_MAX = 20;
const UPLOAD_WINDOW_MS = 10 * 60 * 1000;

export const runtime = 'nodejs';

/**
 * POST /api/admin/entreprendre/upload
 * Body : multipart/form-data avec le champ `file`.
 * Retourne { url } — l'URL publique Supabase de l'image uploadée.
 *
 * L'admin peut ensuite insérer dans le contenu Markdown :
 *   ![Légende de l'image](URL_RETOURNÉE)
 */
export async function POST(request: NextRequest) {
  const auth = await requireAdminApi(request);
  if (auth.error) return auth.error;

  // Rate limiting
  const ip = getClientIp(request);
  if (isRateLimited(`ent-upload:${ip}`, UPLOAD_MAX, UPLOAD_WINDOW_MS)) {
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
      { status: 400 },
    );
  }

  const ext = ALLOWED_MIME[file.type];
  if (!ext) {
    return NextResponse.json(
      { error: 'Format non supporté. Utilisez une image JPG, PNG ou WebP.' },
      { status: 400 },
    );
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: 'Image trop lourde (5 Mo maximum).' },
      { status: 400 },
    );
  }

  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      {
        error: 'Stockage Supabase non configuré. En local, collez directement une URL d\'image dans le contenu.',
        code: 'not_configured',
      },
      { status: 501 },
    );
  }

  const supabase = getSupabaseClient();
  if (!supabase) {
    return NextResponse.json(
      { error: 'Client Supabase indisponible.', code: 'not_configured' },
      { status: 501 },
    );
  }

  // Nom de fichier unique (jamais le nom client)
  const fileName = `articles/${Date.now()}-${crypto.randomUUID()}.${ext}`;
  const buffer = Buffer.from(await file.arrayBuffer());

  let { error } = await supabase.storage
    .from(BUCKET)
    .upload(fileName, buffer, {
      contentType: file.type,
      cacheControl: '31536000', // 1 an (images statiques)
      upsert: false,
    });

  // Auto-create bucket si absent
  if (error && error.message?.toLowerCase().includes('bucket')) {
    const { error: createError } = await supabase.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: MAX_FILE_SIZE,
    });
    if (createError) {
      console.error('[api/admin/entreprendre/upload] createBucket error:', createError);
      return NextResponse.json(
        { error: 'Impossible de créer le stockage d\'images.' },
        { status: 500 },
      );
    }
    ({ error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '31536000',
        upsert: false,
      }));
  }

  if (error) {
    console.error('[api/admin/entreprendre/upload] upload error:', error);
    return NextResponse.json(
      { error: 'Échec de l\'upload de l\'image.' },
      { status: 500 },
    );
  }

  const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
  return NextResponse.json({ url: data.publicUrl });
}
