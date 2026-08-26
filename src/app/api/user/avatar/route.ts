import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';
import { getCurrentUser } from '@/lib/userSession';
import { getSupabaseClient, isSupabaseConfigured } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET = 'profile-photos';
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 Mo
const ALLOWED_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
};

/**
 * POST /api/user/avatar
 * Body : multipart/form-data avec le champ `file`.
 *
 * Réponses :
 *  - 200 { avatar_url }          → photo uploadée, URL publique Supabase
 *  - 400 { error }               → fichier invalide (type / taille)
 *  - 401 { error }               → non connecté
 *  - 501 { error, code }         → Supabase non configuré
 */
export async function POST(request: NextRequest) {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
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
          error: 'Stockage Supabase non configuré. La photo de profil n\'est pas disponible.',
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

    // Nom de fichier unique (jamais le nom client, pour éviter tout path traversal).
    const fileName = `${user.id}/${Date.now()}-${crypto.randomUUID()}.${ext}`;
    const buffer = Buffer.from(await file.arrayBuffer());

    let { error } = await supabase.storage
      .from(BUCKET)
      .upload(fileName, buffer, {
        contentType: file.type,
        cacheControl: '3600',
        upsert: true, // Écrase la photo précédente du même user
      });

    // Si le bucket n'existe pas encore, on le crée à la volée puis on retente.
    if (error && error.message?.toLowerCase().includes('bucket')) {
      const { error: createError } = await supabase.storage.createBucket(BUCKET, {
        public: true,
        fileSizeLimit: MAX_FILE_SIZE,
      });
      if (createError) {
        console.error('[api/user/avatar] createBucket error:', createError);
        return NextResponse.json(
          { error: "Impossible de créer le stockage d'images." },
          { status: 500 },
        );
      }
      ({ error } = await supabase.storage
        .from(BUCKET)
        .upload(fileName, buffer, {
          contentType: file.type,
          cacheControl: '3600',
          upsert: true,
        }));
    }

    if (error) {
      console.error('[api/user/avatar] upload error:', error);
      return NextResponse.json(
        { error: "Échec de l'upload de la photo." },
        { status: 500 },
      );
    }

    const { data } = supabase.storage.from(BUCKET).getPublicUrl(fileName);
    const avatarUrl = data.publicUrl;

    // Mettre à jour l'URL dans la table users
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: avatarUrl, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('[api/user/avatar] update user error:', updateError);
      return NextResponse.json(
        { error: 'Photo uploadée mais impossible de la sauvegarder au profil.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ avatar_url: avatarUrl });
  } catch (err) {
    console.error('POST /api/user/avatar error:', err);
    return NextResponse.json(
      { error: "Impossible d'uploader la photo." },
      { status: 500 },
    );
  }
}

/**
 * DELETE /api/user/avatar
 * Supprime la photo de profil de l'utilisateur.
 */
export async function DELETE() {
  try {
    const user = await getCurrentUser();
    if (!user) {
      return NextResponse.json({ error: 'Non connecté.' }, { status: 401 });
    }

    if (!isSupabaseConfigured()) {
      return NextResponse.json(
        { error: 'Stockage Supabase non configuré.', code: 'not_configured' },
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

    // Supprimer les fichiers de ce user dans le bucket
    const { data: files } = await supabase.storage.from(BUCKET).list(user.id);
    if (files && files.length > 0) {
      const paths = files.map((f) => `${user.id}/${f.name}`);
      await supabase.storage.from(BUCKET).remove(paths);
    }

    // Mettre à jour le user
    const { error: updateError } = await supabase
      .from('users')
      .update({ avatar_url: null, updated_at: new Date().toISOString() })
      .eq('id', user.id);

    if (updateError) {
      console.error('[api/user/avatar] delete update error:', updateError);
      return NextResponse.json(
        { error: 'Impossible de supprimer la photo du profil.' },
        { status: 500 },
      );
    }

    return NextResponse.json({ avatar_url: null });
  } catch (err) {
    console.error('DELETE /api/user/avatar error:', err);
    return NextResponse.json(
      { error: "Impossible de supprimer la photo." },
      { status: 500 },
    );
  }
}
