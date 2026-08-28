-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0022
--  Description : ajoute la colonne `view_count` à la table `blog_posts`
--  pour suivre le nombre de vues de chaque article du blog.
-- ============================================================================

ALTER TABLE public.blog_posts
    ADD COLUMN IF NOT EXISTS view_count integer NOT NULL DEFAULT 0;
