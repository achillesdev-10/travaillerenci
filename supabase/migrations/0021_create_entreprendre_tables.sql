-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0021
--  Description : tables `entreprendre_articles` et `entreprendre_comments`
--  pour la section "Entreprendre" (guides business + commentaires).
--
--  RLS :
--    • Lecture publique des articles PUBLIÉS uniquement.
--    • Écriture articles réservée admin (via /api/admin/entreprendre,
--      service_role, contourne la RLS).
--    • Commentaires : lecture publique (visibles uniquement), écriture
--      réservée aux utilisateurs authentifiés (via service_role admin pour
--      la modération).
-- ============================================================================

-- --------------------------------------------------------------------------
--  Table entreprendre_articles
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entreprendre_articles (
    id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug           TEXT NOT NULL UNIQUE,
    title          TEXT NOT NULL,
    excerpt        TEXT,
    content        TEXT NOT NULL DEFAULT '',
    cover_image    TEXT,
    sector         TEXT NOT NULL DEFAULT 'autre'
                   CONSTRAINT entreprendre_articles_sector_check CHECK (sector IN (
                     'restauration', 'coiffure-beaute', 'commerce-grossiste',
                     'commerce-detail', 'agroalimentaire', 'it-digital',
                     'transport-logistique', 'btp-immobilier', 'sante',
                     'education-formation', 'tourisme-hotellerie', 'artisanat',
                     'services-professionnels', 'agriculture', 'autre'
                   )),
    budget_range   TEXT NOT NULL DEFAULT 'petit'
                   CONSTRAINT entreprendre_articles_budget_check CHECK (budget_range IN (
                     'petit', 'moyen', 'gros'
                   )),
    reading_time   INTEGER NOT NULL DEFAULT 5,
    status         TEXT NOT NULL DEFAULT 'draft'
                   CONSTRAINT entreprendre_articles_status_check CHECK (status IN (
                     'draft', 'published', 'archived'
                   )),
    featured       BOOLEAN NOT NULL DEFAULT FALSE,
    view_count     INTEGER NOT NULL DEFAULT 0,
    helpful_count  INTEGER NOT NULL DEFAULT 0,
    author         TEXT NOT NULL DEFAULT 'TravaillerenCi',
    meta_description TEXT,
    published_at   TIMESTAMPTZ,
    created_at     TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entreprendre_status_published
    ON public.entreprendre_articles (status, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_entreprendre_slug
    ON public.entreprendre_articles (slug);
CREATE INDEX IF NOT EXISTS idx_entreprendre_sector
    ON public.entreprendre_articles (sector);
CREATE INDEX IF NOT EXISTS idx_entreprendre_featured
    ON public.entreprendre_articles (featured) WHERE featured = TRUE;

COMMENT ON TABLE public.entreprendre_articles
    IS 'Guides business pour encourager l''entrepreneuriat en Côte d''Ivoire.';

-- --------------------------------------------------------------------------
--  RLS : lecture publique des articles PUBLIÉS uniquement
-- --------------------------------------------------------------------------
ALTER TABLE public.entreprendre_articles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "entreprendre_articles lecture publique (publiés)"
    ON public.entreprendre_articles;
CREATE POLICY "entreprendre_articles lecture publique (publiés)"
    ON public.entreprendre_articles FOR SELECT
    USING (status = 'published');

-- Écritures via service_role uniquement (admin API)
DROP POLICY IF EXISTS "entreprendre_articles lecture service_role"
    ON public.entreprendre_articles;
CREATE POLICY "entreprendre_articles lecture service_role"
    ON public.entreprendre_articles FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "entreprendre_articles insertion service_role"
    ON public.entreprendre_articles;
CREATE POLICY "entreprendre_articles insertion service_role"
    ON public.entreprendre_articles FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "entreprendre_articles update service_role"
    ON public.entreprendre_articles;
CREATE POLICY "entreprendre_articles update service_role"
    ON public.entreprendre_articles FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "entreprendre_articles delete service_role"
    ON public.entreprendre_articles;
CREATE POLICY "entreprendre_articles delete service_role"
    ON public.entreprendre_articles FOR DELETE USING (FALSE);

-- --------------------------------------------------------------------------
--  Table entreprendre_comments
-- --------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.entreprendre_comments (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    article_id        UUID NOT NULL REFERENCES public.entreprendre_articles(id) ON DELETE CASCADE,
    user_id           UUID REFERENCES public.users(id) ON DELETE SET NULL,
    user_display_name TEXT,
    content           TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'visible'
                      CONSTRAINT entreprendre_comments_status_check CHECK (status IN (
                        'visible', 'hidden', 'reported'
                      )),
    created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_entreprendre_comments_article
    ON public.entreprendre_comments (article_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_entreprendre_comments_status
    ON public.entreprendre_comments (status);

COMMENT ON TABLE public.entreprendre_comments
    IS 'Commentaires sur les articles de la section Entreprendre (utilisateurs inscrits).';

-- --------------------------------------------------------------------------
--  RLS : lecture des commentaires visibles, écriture via service_role
-- --------------------------------------------------------------------------
ALTER TABLE public.entreprendre_comments ENABLE ROW LEVEL SECURITY;

-- Lecture publique des commentaires visibles
DROP POLICY IF EXISTS "entreprendre_comments lecture publique (visibles)"
    ON public.entreprendre_comments;
CREATE POLICY "entreprendre_comments lecture publique (visibles)"
    ON public.entreprendre_comments FOR SELECT
    USING (status = 'visible');

-- Écritures via service_role uniquement
DROP POLICY IF EXISTS "entreprendre_comments insertion service_role"
    ON public.entreprendre_comments;
CREATE POLICY "entreprendre_comments insertion service_role"
    ON public.entreprendre_comments FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "entreprendre_comments update service_role"
    ON public.entreprendre_comments;
CREATE POLICY "entreprendre_comments update service_role"
    ON public.entreprendre_comments FOR UPDATE USING (FALSE);

DROP POLICY IF EXISTS "entreprendre_comments delete service_role"
    ON public.entreprendre_comments;
CREATE POLICY "entreprendre_comments delete service_role"
    ON public.entreprendre_comments FOR DELETE USING (FALSE);
