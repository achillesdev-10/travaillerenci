-- =============================================================================
--  TravaillerEnCi — migration 0019 : social_posts
--  File d'attente de distribution sociale (Facebook / LinkedIn).
--
--  Principes :
--   • Un contenu publié sur TravaillerEnCi est enfilé UNE fois par plateforme
--     (contrainte UNIQUE (content_type, content_id, platform) = anti-doublon).
--   • Le worker (/api/cron/social-publisher) réclame les tâches avec un
--     verrou atomique (status 'queued'|'scheduled' → 'publishing') pour
--     garantir l'idempotence même avec des exécutions simultanées.
--   • Aucun secret n'est stocké ici : les tokens restent dans les variables
--     d'environnement Vercel, côté serveur uniquement.
-- =============================================================================

create table if not exists public.social_posts (
  id               uuid primary key default gen_random_uuid(),
  content_type     text not null check (content_type in ('job','internship','scholarship','exam')),
  content_id       text not null,
  content_title    text,
  platform         text not null check (platform in ('facebook','linkedin')),
  status           text not null default 'queued' check (status in ('queued','scheduled','publishing','published','failed','ignored','cancelled')),
  priority         integer not null default 0,
  text             text,
  image_url        text,
  link_url         text,
  scheduled_at     timestamptz,
  published_at     timestamptz,
  external_post_id text,
  error_code       text,
  error_message    text,
  attempt_count    integer not null default 0,
  next_attempt_at  timestamptz,
  dry_run          boolean not null default false,
  payload_json     jsonb,
  created_at       timestamptz not null default now(),
  updated_at       timestamptz not null default now(),
  constraint social_posts_unique_content_platform unique (content_type, content_id, platform)
);

create index if not exists idx_social_posts_status     on public.social_posts (status);
create index if not exists idx_social_posts_scheduled  on public.social_posts (scheduled_at);
create index if not exists idx_social_posts_platform   on public.social_posts (platform, status);
