-- Migration: Photo de profil utilisateur
-- Path: supabase/migrations/0019_add_avatar_url.sql
--
-- Ajoute la colonne avatar_url à la table users pour stocker l'URL
-- de la photo de profil (Supabase Storage). Crée aussi le bucket
-- profile-photos (public) pour le stockage des images.

-- Ajouter la colonne avatar_url
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS avatar_url TEXT;

-- Créer le bucket public profile-photos pour les photos de profil
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
    'profile-photos',
    'profile-photos',
    true,
    5242880, -- 5 Mo
    ARRAY['image/jpeg', 'image/png', 'image/webp']
)
ON CONFLICT (id) DO NOTHING;

-- Politiques RLS pour le bucket profile-photos
-- Lecture publique (les photos de profil sont visibles par tous)
CREATE POLICY "profile-photos lecture publique"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'profile-photos');

-- Insertion : seul le service_role peut uploader (via les routes API)
CREATE POLICY "profile-photos insertion service_role"
    ON storage.objects FOR INSERT
    WITH CHECK (bucket_id = 'profile-photos' AND auth.role() = 'service_role');

-- Mise à jour : seul le service_role peut modifier
CREATE POLICY "profile-photos update service_role"
    ON storage.objects FOR UPDATE
    USING (bucket_id = 'profile-photos' AND auth.role() = 'service_role');

-- Suppression : seul le service_role peut supprimer
CREATE POLICY "profile-photos delete service_role"
    ON storage.objects FOR DELETE
    USING (bucket_id = 'profile-photos' AND auth.role() = 'service_role');
