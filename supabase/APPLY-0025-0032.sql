-- ============================================================================
--  TravaillerEnCi -- Migration unique 0025 a 0032 (a coller dans le SQL Editor)
--
--  Projet Supabase : mgikchcedkstajxpnkox
--  Usage : Dashboard Supabase > SQL Editor > New query > coller ce fichier > Run
--
--  CONTENU (8 migrations, dans l'ordre) :
--    0025  job_offers.sector                      (metier des offres)
--    0026  candidate_profiles : job_title, experience_level, skills,
--          contract_types, bio, resume_url        (profil candidat enrichi)
--    0027  table analytics_events + RLS fermee   (evenements produit)
--    0028  candidate_profiles.profile_visibility  (consentement, defaut private)
--    0029  table newsletter_subscribers + RLS     (architecture newsletter)
--    0030  alerts.contract_type, alerts.keywords  (alertes, section 8)
--    0031  site_visits.source + index             (sources de trafic, section 23)
--    0032  job_offers.is_featured/featured_until,
--          candidate_profiles.plan                (champs neutres, section 29)
--
--  SECURITE :
--    * 100 % ADDITIF : aucune suppression, aucune modification de donnees,
--      aucun drop de table/colonne/index existant.
--    * IDEMPOTENT : tous les objets sont proteges (IF NOT EXISTS /
--      DROP POLICY IF EXISTS) -- relancer ce fichier ne change rien.
--    * Le SQL Editor execute le script dans une transaction : en cas d'erreur,
--      RIEN n'est applique. Corrigez, puis relancez.
--
--  APRES EXECUTION : les 3 blocs de verification en fin de fichier doivent
--  renvoyer 14 lignes, 2 lignes et 6 lignes.
-- ============================================================================

START TRANSACTION;

-- ############################################################################
-- #  0025_add_job_sector.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0025
--  Description : ajoute la colonne `sector` (métier / domaine) à job_offers.
--
--  Objectif : catégoriser les offres par métier pour alimenter les pages SEO
--  (/emplois-informatique, /emplois-comptabilite-abidjan…) et améliorer la
--  pertinence des recommandations candidat.
--
--  Valeurs attendues : slugs de `SECTORS` (src/lib/constants.ts), p. ex.
--    it-digital, banque-finance, btp-immobilier, industrie,
--    commerce-distribution, sante, education-formation, agroalimentaire,
--    telecoms, transport-logistique, tourisme-hotellerie,
--    audiovisuel-medias, audit-conseil, juridique, rh, marketing-communication
--
--  NULL = non classé (repli par mots-clés côté application). Aucune donnée
--  existante n'est supprimée ni modifiée ; la colonne est simplement ajoutée.
-- ============================================================================

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS sector TEXT;

CREATE INDEX IF NOT EXISTS idx_job_offers_sector
    ON public.job_offers (sector);

COMMENT ON COLUMN public.job_offers.sector
    IS 'Slug de métier/domaine (SECTORS de src/lib/constants.ts). NULL = non classé.';


-- ############################################################################
-- #  0026_enrich_candidate_profiles.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0026
--  Description : enrichit candidate_profiles pour un vrai profil candidat
--  (métier recherché, niveau d'expérience, compétences, types de contrat
--   recherchés, présentation, lien CV).
--
--  Objectif (master prompt §9) : profil exploitable à long terme, indicateur
--  « profil complété à X % », meilleures recommandations.
--
--  Tous les champs sont NULLABLES / optionnels — aucune donnée existante n'est
--  modifiée ou supprimée. `resume_url` est un lien externe facultatif (le CV
--  n'est pas stocké ici) — prêt pour une future CVthèque (§30).
-- ============================================================================

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS job_title        TEXT,
    ADD COLUMN IF NOT EXISTS experience_level TEXT,
    ADD COLUMN IF NOT EXISTS skills           TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS contract_types   TEXT[] NOT NULL DEFAULT '{}',
    ADD COLUMN IF NOT EXISTS bio              TEXT,
    ADD COLUMN IF NOT EXISTS resume_url       TEXT;

COMMENT ON COLUMN public.candidate_profiles.job_title
    IS 'Métier / intitulé de poste recherché par le candidat.';
COMMENT ON COLUMN public.candidate_profiles.experience_level
    IS 'Niveau d''expérience (valeurs JOB_LEVELS de src/lib/constants.ts).';
COMMENT ON COLUMN public.candidate_profiles.skills
    IS 'Compétences libres du candidat (tableau texte).';
COMMENT ON COLUMN public.candidate_profiles.contract_types
    IS 'Types de contrat recherchés (valeurs JOB_TYPES de src/lib/constants.ts).';
COMMENT ON COLUMN public.candidate_profiles.bio
    IS 'Courte description professionnelle (texte libre).';
COMMENT ON COLUMN public.candidate_profiles.resume_url
    IS 'Lien facultatif vers un CV externe. Ne pas exposer publiquement sans consentement.';


-- ############################################################################
-- #  0027_create_analytics_events.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0027
--  Description : table des événements produits (master prompt §22).
--
--  Événements : job_view, job_save, job_unsave, signup, profile_complete,
--  cv_upload, alert_create, application_click, search, share.
--
--  CONFIDENTIALITÉ : aucune donnée personnelle n'y est stockée — uniquement
--  un identifiant d'objet (label), un chemin (path), un hash d'IP et l'horodate.
--  Les événements « une fois par utilisateur » sont dédupliqués côté serveur.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.analytics_events (
    id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    event      TEXT        NOT NULL,
    label      TEXT,
    path       TEXT,
    user_id    UUID,
    ip_hash    TEXT,
    user_agent TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_analytics_events_event_created
    ON public.analytics_events (event, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_created
    ON public.analytics_events (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_analytics_events_user_event
    ON public.analytics_events (user_id, event);

-- RLS fermée au client anon : lecture/écriture via le service_role uniquement.
ALTER TABLE public.analytics_events ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "analytics_events lecture service_role" ON public.analytics_events;
CREATE POLICY "analytics_events lecture service_role"
    ON public.analytics_events FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "analytics_events insertion service_role" ON public.analytics_events;
CREATE POLICY "analytics_events insertion service_role"
    ON public.analytics_events FOR INSERT WITH CHECK (FALSE);

COMMENT ON TABLE public.analytics_events
    IS 'Événements produits (mesure §22) — aucune donnée personnelle.';
COMMENT ON COLUMN public.analytics_events.label
    IS 'Identifiant d''objet (id d''offre, id d''alerte, rôle) — jamais de donnée personnelle.';


-- ############################################################################
-- #  0028_add_profile_visibility.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0028
--  Description : consentement de visibilité du profil candidat (CVthèque
--  future — master prompt §30).
--
--  Un candidat devra pouvoir choisir entre « Visible par les recruteurs »
--  et « Profil privé ». Le champ est posé MAINTENANT, par défaut PRIVÉ :
--  aucune donnée n'est exposée sans consentement explicite et explicite.
--
--  Valeurs :
--    'private'     — défaut : profil strictement privé (aucun accès recruteur)
--    'recruiters'  — consentement donné : accessible à la future CVthèque
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS profile_visibility TEXT NOT NULL DEFAULT 'private'
    CONSTRAINT candidate_profiles_visibility_check
        CHECK (profile_visibility IN ('private', 'recruiters'));

CREATE INDEX IF NOT EXISTS idx_candidate_profiles_visibility
    ON public.candidate_profiles (profile_visibility);

COMMENT ON COLUMN public.candidate_profiles.profile_visibility
    IS 'Consentement de visibilité (CVthèque future) : ''private'' par défaut, ''recruiters'' uniquement si le candidat l''a activé explicitement.';


-- ############################################################################
-- #  0029_newsletter_subscribers.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0029
--  Description : architecture newsletter / futures alertes email (§20).
--
--  Aucun service d'envoi n'est mis en place ici : seuls les CHAMPS nécessaires
--  sont créés pour que la newsletter, les alertes email et les notifications
--  puissent être branchés plus tard sans nouvelle migration.
--
--  Champs clés :
--    • email + statut (pending / active / unsubscribed / bounced)
--    • consentement explicite horodaté (texte exact accepté)
--    • source du formulaire et paramètres UTM (origine du trafic, §21)
--    • fréquence d'envoi prévue + jeton de désinscription en un clic
--    • jeton de confirmation (double opt-in prêt à être activé)
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

CREATE TABLE IF NOT EXISTS public.newsletter_subscribers (
    id                UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email             TEXT NOT NULL,
    status            TEXT NOT NULL DEFAULT 'pending'
                      CONSTRAINT newsletter_status_check
                      CHECK (status IN ('pending', 'active', 'unsubscribed', 'bounced')),
    source            TEXT NOT NULL DEFAULT 'footer',
    frequency         TEXT NOT NULL DEFAULT 'hebdomadaire'
                      CONSTRAINT newsletter_frequency_check
                      CHECK (frequency IN ('hebdomadaire', 'mensuelle')),
    consent_text      TEXT,
    consent_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    utm_source        TEXT,
    utm_medium        TEXT,
    utm_campaign      TEXT,
    confirm_token     TEXT UNIQUE,
    confirmed_at      TIMESTAMPTZ,
    unsubscribe_token TEXT NOT NULL UNIQUE,
    unsubscribed_at   TIMESTAMPTZ,
    last_sent_at      TIMESTAMPTZ,
    created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Unicité insensible à la casse : les adresses sont normalisées en minuscules
-- côté applicatif, l'index protège aussi l'entrée brute.
CREATE UNIQUE INDEX IF NOT EXISTS idx_newsletter_email
    ON public.newsletter_subscribers (lower(email));

CREATE INDEX IF NOT EXISTS idx_newsletter_status
    ON public.newsletter_subscribers (status);

-- RLS fermée au client anon : tout passe par les routes serveur (service_role).
ALTER TABLE public.newsletter_subscribers ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "newsletter lecture service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter lecture service_role"
    ON public.newsletter_subscribers FOR SELECT USING (FALSE);

DROP POLICY IF EXISTS "newsletter insertion service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter insertion service_role"
    ON public.newsletter_subscribers FOR INSERT WITH CHECK (FALSE);

DROP POLICY IF EXISTS "newsletter modification service_role" ON public.newsletter_subscribers;
CREATE POLICY "newsletter modification service_role"
    ON public.newsletter_subscribers FOR UPDATE USING (FALSE);

COMMENT ON TABLE public.newsletter_subscribers
    IS 'Abonnés newsletter (§20) — champs préparatoires, aucun envoi automatisé à ce jour.';
COMMENT ON COLUMN public.newsletter_subscribers.consent_text
    IS 'Texte de consentement exact accepté par l''abonné au moment de l''inscription.';
COMMENT ON COLUMN public.newsletter_subscribers.unsubscribe_token
    IS 'Jeton du lien de désinscription en un clic envoyé dans chaque email.';


-- ############################################################################
-- #  0030_alerts_contract_keywords.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0030
--  Description : critères « type de contrat » et « mots-clés » des alertes
--  candidat (master prompt §8).
--
--  Une alerte doit pouvoir filtrer sur :
--    - le type de contrat recherché (CDI, CDD, Stage, Prestation,
--      Alternance, Freelance) ;
--    - une liste de mots-clés (séparés par des virgules) devant apparaître
--      dans l'offre.
--
--  Le matching est appliqué par le digest `scraper/alert_digest.py`
--  (`matches_job`), qui lit les mêmes colonnes. NULL = critère absent.
--
--  Aucune donnée existante n'est modifiée ni supprimée.
-- ============================================================================

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS contract_type TEXT
    CONSTRAINT alerts_contract_type_check
        CHECK (
            contract_type IS NULL
            OR contract_type IN ('CDI', 'CDD', 'Stage', 'Prestation', 'Alternance', 'Freelance')
        );

ALTER TABLE public.alerts
    ADD COLUMN IF NOT EXISTS keywords TEXT;

COMMENT ON COLUMN public.alerts.contract_type
    IS 'Type de contrat recherché (CDI, CDD, Stage, Prestation, Alternance, Freelance). NULL = tous.';
COMMENT ON COLUMN public.alerts.keywords
    IS 'Mots-clés séparés par des virgules ; l''offre doit en contenir au moins un. NULL = aucun filtre.';


-- ############################################################################
-- #  0031_site_visits_source.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0031
--  Description : colonne `source` de `site_visits` (master prompt §23
--  « Sources de trafic »).
--
--  Valeur normalisée par src/lib/trafficSource.ts :
--    • utm_source de la première visite, sinon
--    • domaine d'origine (document.referrer) sans www., sinon
--    • 'direct'  — arrivée sans referer ni UTM
--    • 'interne' — navigation provenant du même domaine
--
--  Aucune donnée existante n'est modifiée ni supprimée ; les visites déjà
--  enregistrées conservent une valeur NULL (= source inconnue, affichée en
--  « direct » côté tableau de bord).
-- ============================================================================

ALTER TABLE public.site_visits
    ADD COLUMN IF NOT EXISTS source TEXT;

CREATE INDEX IF NOT EXISTS idx_site_visits_source
    ON public.site_visits (source);

COMMENT ON COLUMN public.site_visits.source
    IS 'Source de trafic normalisée : utm_source, domaine d''origine, ''direct'' ou ''interne''. NULL = visite antérieure à la migration.';


-- ############################################################################
-- #  0032_monetization_flags.sql
-- ############################################################################
-- ============================================================================
--  TravaillerEnCi — Migration Supabase 0032
--  Description : champs de statut préparant la future monétisation
--  (master prompt §29) — SANS aucun paiement ni affichage commercial.
--
--  §29 : « NE PAS implémenter la monétisation maintenant. Mais construire une
--  architecture qui permettra plus tard : CV mis en avant, offres mises en
--  avant, profils Premium… Prévoir éventuellement des champs de statut ou de
--  visibilité, mais ne pas afficher de boutons de paiement inutiles. »
--
--  Champs posés :
--    • job_offers.is_featured / featured_until → offre « mise en avant »
--      (null = aucune) — permettra une mise en avant temporaire payante ;
--    • candidate_profiles.plan                → 'free' par défaut, 'premium'
--      réservé à une future offre.
--
--  Aucune donnée existante n'est modifiée ni supprimée, aucun bouton de
--  paiement n'est exposé : seuls les champs sont créés, à valeur neutre.
-- ============================================================================

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS is_featured BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE public.job_offers
    ADD COLUMN IF NOT EXISTS featured_until TIMESTAMPTZ;

CREATE INDEX IF NOT EXISTS idx_job_offers_featured
    ON public.job_offers (is_featured DESC, featured_until DESC);

COMMENT ON COLUMN public.job_offers.is_featured
    IS 'Offre mise en avant (future monétisation §29). FALSE partant : aucun tri ni affichage particulier pour l''instant.';
COMMENT ON COLUMN public.job_offers.featured_until
    IS 'Fin de la mise en avant (NULL = pas de mise en avant).';

ALTER TABLE public.candidate_profiles
    ADD COLUMN IF NOT EXISTS plan TEXT NOT NULL DEFAULT 'free'
    CONSTRAINT candidate_profiles_plan_check
        CHECK (plan IN ('free', 'premium'));

COMMENT ON COLUMN public.candidate_profiles.plan
    IS 'Offre du profil (§29) : ''free'' par défaut, ''premium'' réservé à la future monétisation.';

COMMIT;

-- ============================================================================
--  VERIFICATION 1 : 14 lignes attendues (colonnes 0025/0026/0028/0030/0031/0032)
-- ============================================================================
SELECT table_name || '.' || column_name AS colonne
FROM information_schema.columns
WHERE table_schema = 'public'
  AND (
        (table_name = 'job_offers'         AND column_name IN ('sector','is_featured','featured_until'))
     OR (table_name = 'candidate_profiles' AND column_name IN ('job_title','experience_level','skills','contract_types','bio','resume_url','profile_visibility','plan'))
     OR (table_name = 'alerts'             AND column_name IN ('contract_type','keywords'))
     OR (table_name = 'site_visits'        AND column_name IN ('source'))
      )
ORDER BY table_name, column_name;

-- ============================================================================
--  VERIFICATION 2 : 2 lignes attendues (tables 0027 et 0029)
-- ============================================================================
SELECT table_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('analytics_events', 'newsletter_subscribers')
ORDER BY table_name;

-- ============================================================================
--  VERIFICATION 3 : 6 lignes attendues (indexes)
-- ============================================================================
SELECT indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'idx_job_offers_sector',
    'idx_job_offers_featured',
    'idx_site_visits_source',
    'idx_candidate_profiles_visibility',
    'idx_analytics_events_event_created',
    'idx_newsletter_email'
  )
ORDER BY indexname;