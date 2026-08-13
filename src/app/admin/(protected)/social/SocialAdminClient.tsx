'use client';

import { useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import type {
  SocialConfigSummary,
  SocialConnectionStatus,
  SocialPlatform,
  SocialPost,
  SocialPostStatus,
  SocialPreviewPayload,
  SocialStats,
} from '@/types/social';

const STATUS_TABS: Array<{ value: SocialPostStatus | 'all'; label: string }> = [
  { value: 'queued', label: 'En attente' },
  { value: 'scheduled', label: 'Programmées' },
  { value: 'published', label: 'Publiées' },
  { value: 'failed', label: 'Échouées' },
  { value: 'ignored', label: 'Ignorées' },
  { value: 'all', label: 'Toutes' },
];

const STATUS_LABEL: Record<SocialPostStatus, string> = {
  queued: 'En attente',
  scheduled: 'Programmée',
  publishing: 'En cours',
  published: 'Publiée',
  failed: 'Échec',
  ignored: 'Ignorée',
  cancelled: 'Annulée',
};

const PLATFORM_LABEL: Record<SocialPlatform, string> = {
  facebook: 'Facebook',
  linkedin: 'LinkedIn',
};

const STATUS_BADGE: Record<SocialPostStatus, string> = {
  queued: 'border-amber-500/30 bg-amber-500/15 text-amber-400',
  scheduled: 'border-sky-500/30 bg-sky-500/15 text-sky-400',
  publishing: 'border-violet-500/30 bg-violet-500/15 text-violet-400',
  published: 'border-emerald-500/30 bg-emerald-500/15 text-emerald-400',
  failed: 'border-rose-500/30 bg-rose-500/15 text-rose-400',
  ignored: 'border-slate-600/30 bg-slate-700/30 text-slate-400',
  cancelled: 'border-slate-600/30 bg-slate-700/30 text-slate-400',
};

const CONNECTION_DOT: Record<string, string> = {
  configured: 'bg-emerald-400',
  not_configured: 'bg-rose-500',
  expired: 'bg-amber-400',
  error: 'bg-rose-500',
};

const CONNECTION_TEXT: Record<string, string> = {
  configured: 'text-emerald-400',
  not_configured: 'text-rose-400',
  expired: 'text-amber-400',
  error: 'text-rose-400',
};

function formatDateTime(iso: string | null): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '—';
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'short', timeStyle: 'short' }).format(d);
}

function toDatetimeInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export default function SocialAdminClient({
  initialPosts,
  initialTotal,
  initialStats,
  initialConnections,
  initialConfig,
}: {
  initialPosts: SocialPost[];
  initialTotal: number;
  initialStats: SocialStats;
  initialConnections: SocialConnectionStatus[];
  initialConfig: SocialConfigSummary;
}) {
  const router = useRouter();
  const [posts, setPosts] = useState<SocialPost[]>(initialPosts);
  const [total, setTotal] = useState(initialTotal);
  const [stats, setStats] = useState<SocialStats>(initialStats);
  const [connections, setConnections] = useState<SocialConnectionStatus[]>(initialConnections);
  const [config, setConfig] = useState<SocialConfigSummary>(initialConfig);
  const [statusFilter, setStatusFilter] = useState<SocialPostStatus | 'all'>('all');
  const [platformFilter, setPlatformFilter] = useState<SocialPlatform | 'all'>('all');
  const [busy, setBusy] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [preview, setPreview] = useState<{ post: SocialPost; payload: SocialPreviewPayload } | null>(null);
  const [editing, setEditing] = useState<SocialPost | null>(null);
  const [editText, setEditText] = useState('');
  const [scheduling, setScheduling] = useState<SocialPost | null>(null);
  const [scheduleValue, setScheduleValue] = useState('');
  const [checkingConnections, setCheckingConnections] = useState(false);

  const filtered = useMemo(
    () =>
      posts.filter(
        (p) =>
          (statusFilter === 'all' || p.status === statusFilter) &&
          (platformFilter === 'all' || p.platform === platformFilter),
      ),
    [posts, statusFilter, platformFilter],
  );

  function redirectToLogin() {
    router.replace('/admin/login?next=/admin/social');
  }

  async function refresh() {
    const res = await fetch('/api/admin/social?limit=200');
    if (res.status === 401) {
      redirectToLogin();
      return;
    }
    if (res.ok) {
      const data = await res.json();
      setPosts(data.posts || []);
      setTotal(data.total || 0);
      setStats(data.stats);
      setConnections(data.connections);
      setConfig(data.config);
    }
  }

  async function refreshConnections() {
    setCheckingConnections(true);
    try {
      const res = await fetch('/api/admin/social?limit=1');
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      if (res.ok) {
        const data = await res.json();
        setConnections(data.connections);
        setConfig(data.config);
      }
    } finally {
      setCheckingConnections(false);
    }
  }

  async function handleScan() {
    setBusy('scan');
    setNotice(null);
    try {
      const res = await fetch('/api/admin/social', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'scan' }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur pendant l’enfilement.');
      setNotice(`Enfilement terminé : ${data.enqueued} nouvelle(s) tâche(s), ${data.scheduled} programmée(s).`);
      await refresh();
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Erreur pendant l’enfilement.');
    } finally {
      setBusy(null);
    }
  }

  async function handleAction(post: SocialPost, action: string, extra?: Record<string, unknown>) {
    setBusy(`${action}:${post.id}`);
    setNotice(null);
    try {
      const res = await fetch(`/api/admin/social/${post.id}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action, ...extra }),
      });
      if (res.status === 401) {
        redirectToLogin();
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Action impossible.');
      if (action === 'preview' && data.payload) {
        setPreview({ post, payload: data.payload });
      } else {
        await refresh();
      }
      if (action === 'publish') setNotice(`Publication lancée pour « ${post.content_title} ».`);
    } catch (err) {
      alert(err instanceof Error ? err.message : 'Action impossible.');
    } finally {
      setBusy(null);
    }
  }

  function openEdit(post: SocialPost) {
    setEditing(post);
    setEditText(post.text || '');
  }

  async function saveEdit() {
    if (!editing) return;
    await handleAction(editing, 'edit', { text: editText });
    setEditing(null);
  }

  function openSchedule(post: SocialPost) {
    setScheduling(post);
    setScheduleValue(toDatetimeInput(post.scheduled_at));
  }

  async function saveSchedule() {
    if (!scheduling) return;
    const d = new Date(scheduleValue);
    if (Number.isNaN(d.getTime())) {
      alert('Date invalide.');
      return;
    }
    await handleAction(scheduling, 'schedule', { scheduledAt: d.toISOString() });
    setScheduling(null);
  }

  const countFor = (s: SocialPostStatus | 'all') =>
    s === 'all' ? total : stats[s];

  return (
    <div className="space-y-8 pb-24">
      {/* En-tête */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-[var(--font-display)] text-2xl font-extrabold tracking-tight text-white lg:text-3xl">
            Réseaux sociaux
          </h1>
          <p className="mt-1 text-sm text-slate-400">
            Distribution automatique des contenus publiés sur TravaillerEnCi vers
            Facebook et LinkedIn — file d'attente, limites quotidiennes, retries.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void handleScan()}
          disabled={busy !== null}
          className="inline-flex items-center gap-2 self-start rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-slate-950 shadow-lg shadow-primary/20 transition-all hover:brightness-110 disabled:opacity-50"
        >
          {busy === 'scan' ? (
            <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-950 border-t-transparent" />
          ) : (
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 12a9 9 0 1 1-2.64-6.36" />
              <path d="M21 3v6h-6" />
            </svg>
          )}
          Enfiler les contenus publiés
        </button>
      </div>

      {notice && (
        <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 px-4 py-3 text-sm text-emerald-300">
          {notice}
        </div>
      )}

      {config.dryRun && (
        <div className="rounded-2xl border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-300">
          ⚠️ Mode <strong>DRY-RUN</strong> actif (SOCIAL_DRY_RUN=true) : aucun envoi réel
          n'est effectué — les tâches sont marquées « publiées » avec le payload généré.
        </div>
      )}

      {/* Statut des connexions */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        {connections.map((conn) => (
          <div key={conn.platform} className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <span className={`h-2.5 w-2.5 rounded-full ${CONNECTION_DOT[conn.state]}`} />
                <span className="text-sm font-extrabold uppercase tracking-wider text-white">
                  {PLATFORM_LABEL[conn.platform]}
                </span>
                <span className={`text-sm font-bold ${CONNECTION_TEXT[conn.state]}`}>
                  {conn.label}
                </span>
              </div>
              <button
                type="button"
                onClick={() => void refreshConnections()}
                disabled={checkingConnections}
                className="rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-semibold text-slate-300 transition-colors hover:bg-slate-700 disabled:opacity-50"
              >
                {checkingConnections ? 'Vérification…' : 'Vérifier'}
              </button>
            </div>
            <p className="mt-3 text-xs leading-relaxed text-slate-400">{conn.detail}</p>
          </div>
        ))}
      </div>

      {/* Configuration */}
      <div className="grid grid-cols-2 gap-3 rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl sm:grid-cols-4">
        <ConfigItem label="Limite Facebook / jour" value={String(config.facebookDailyLimit)} />
        <ConfigItem label="Limite LinkedIn / jour" value={String(config.linkedinDailyLimit)} />
        <ConfigItem label="Retries max" value={String(config.maxRetries)} />
        <ConfigItem label="Créneaux de publication" value={config.publishSlots.join(' · ')} />
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3 sm:grid-cols-7">
        <StatCard label="En attente" value={stats.queued} tone="text-amber-400" />
        <StatCard label="Programmées" value={stats.scheduled} tone="text-sky-400" />
        <StatCard label="En cours" value={stats.publishing} tone="text-violet-400" />
        <StatCard label="Publiées" value={stats.published} tone="text-emerald-400" />
        <StatCard label="Échouées" value={stats.failed} tone="text-rose-400" />
        <StatCard label="Ignorées" value={stats.ignored} tone="text-slate-400" />
        <StatCard label="Total" value={stats.total} tone="text-white" />
      </div>

      {/* Filtres */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        {STATUS_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setStatusFilter(tab.value)}
            className={`inline-flex items-center gap-2 rounded-2xl px-4 py-2.5 text-xs font-bold transition-all ${
              statusFilter === tab.value
                ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab.label}
            <span className="rounded-full bg-slate-950/40 px-2 py-0.5 text-[10px] text-white">
              {countFor(tab.value)}
            </span>
          </button>
        ))}
        <select
          value={platformFilter}
          onChange={(e) => setPlatformFilter(e.target.value as SocialPlatform | 'all')}
          className="ml-auto rounded-2xl border border-slate-800 bg-slate-900 px-4 py-2.5 text-xs font-semibold text-slate-200 focus:border-primary focus:outline-none"
        >
          <option value="all">Toutes plateformes</option>
          <option value="facebook">Facebook</option>
          <option value="linkedin">LinkedIn</option>
        </select>
      </div>

      {/* Tableau */}
      <div className="overflow-hidden rounded-3xl border border-slate-800 bg-slate-950 shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-left">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <th className="px-6 py-4">Publication</th>
                <th className="px-6 py-4">Plateforme</th>
                <th className="px-6 py-4">Statut</th>
                <th className="px-6 py-4">Programmée</th>
                <th className="px-6 py-4">Publiée</th>
                <th className="px-6 py-4">Tentatives</th>
                <th className="px-6 py-4 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-12 text-center text-slate-500">
                    Aucune publication sociale dans cette vue. Lancez « Enfiler les contenus publiés »
                    pour créer les tâches depuis les contenus validés.
                  </td>
                </tr>
              ) : (
                filtered.map((post) => (
                  <tr key={post.id} className="transition-colors hover:bg-slate-900/40">
                    <td className="max-w-xs px-6 py-4">
                      <div className="line-clamp-2 font-bold text-white">{post.content_title}</div>
                      <div className="mt-0.5 truncate text-[10px] text-slate-500">
                        {post.content_type} · {post.priority} pts
                        {post.error_message && (
                          <span className="ml-1 text-rose-400/80" title={post.error_message}>
                            · {post.error_message.slice(0, 60)}
                            {post.error_message.length > 60 ? '…' : ''}
                          </span>
                        )}
                      </div>
                      {post.dry_run && (
                        <span className="mt-1 inline-block rounded bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-bold text-amber-400">
                          DRY-RUN
                        </span>
                      )}
                    </td>
                    <td className="px-6 py-4">
                      <span className="inline-flex rounded-full border border-slate-700 bg-slate-800 px-2.5 py-1 text-[11px] font-bold text-slate-200">
                        {PLATFORM_LABEL[post.platform]}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold ${STATUS_BADGE[post.status]}`}>
                        {STATUS_LABEL[post.status]}
                      </span>
                      {post.external_post_id && post.external_post_id !== 'dry-run' && (
                        <div className="mt-1 max-w-[140px] truncate text-[9px] text-slate-500" title={post.external_post_id}>
                          {post.external_post_id}
                        </div>
                      )}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-300">
                      {formatDateTime(post.scheduled_at)}
                    </td>
                    <td className="whitespace-nowrap px-6 py-4 text-xs text-slate-300">
                      {formatDateTime(post.published_at)}
                    </td>
                    <td className="px-6 py-4 text-xs text-slate-400">{post.attempt_count}</td>
                    <td className="whitespace-nowrap px-6 py-4 text-right">
                      <div className="inline-flex flex-wrap justify-end gap-1.5">
                        <RowButton
                          disabled={busy !== null}
                          onClick={() => void handleAction(post, 'preview')}
                          className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                        >
                          Voir
                        </RowButton>
                        {post.status !== 'published' && (
                          <>
                            <RowButton
                              disabled={busy !== null}
                              onClick={() => void handleAction(post, 'publish')}
                              className="bg-emerald-500/15 text-emerald-400 hover:bg-emerald-500/25"
                            >
                              Publier maintenant
                            </RowButton>
                            <RowButton
                              disabled={busy !== null}
                              onClick={() => openSchedule(post)}
                              className="bg-sky-500/15 text-sky-400 hover:bg-sky-500/25"
                            >
                              Programmer
                            </RowButton>
                            <RowButton
                              disabled={busy !== null}
                              onClick={() => openEdit(post)}
                              className="bg-slate-800 text-slate-200 hover:bg-slate-700"
                            >
                              Modifier
                            </RowButton>
                            {(post.status === 'failed' || post.status === 'ignored') && (
                              <RowButton
                                disabled={busy !== null}
                                onClick={() => void handleAction(post, 'retry')}
                                className="bg-violet-500/15 text-violet-400 hover:bg-violet-500/25"
                              >
                                Réessayer
                              </RowButton>
                            )}
                            <RowButton
                              disabled={busy !== null}
                              onClick={() => {
                                if (confirm(`Ignorer « ${post.content_title} » (${PLATFORM_LABEL[post.platform]}) ?`)) {
                                  void handleAction(post, 'ignore');
                                }
                              }}
                              className="bg-amber-500/15 text-amber-400 hover:bg-amber-500/25"
                            >
                              Ignorer
                            </RowButton>
                            <RowButton
                              disabled={busy !== null}
                              onClick={() => void handleAction(post, 'cancel')}
                              className="bg-rose-500/15 text-rose-400 hover:bg-rose-500/25"
                            >
                              Annuler
                            </RowButton>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal aperçu */}
      {preview && (
        <Modal title={`Aperçu ${PLATFORM_LABEL[preview.post.platform]} — ${preview.post.content_title || ''}`} onClose={() => setPreview(null)}>
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            <div>
              <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Image</h4>
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={preview.payload.imageDataUri}
                alt="Aperçu de l'image sociale"
                className="w-full rounded-2xl border border-slate-800"
              />
            </div>
            <div className="space-y-4">
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Texte</h4>
                <pre className="whitespace-pre-wrap rounded-2xl border border-slate-800 bg-slate-950 p-4 font-sans text-xs leading-relaxed text-slate-200">
                  {preview.payload.text}
                </pre>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">URL</h4>
                <a
                  href={preview.payload.linkUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="break-all text-xs font-semibold text-primary hover:underline"
                >
                  {preview.payload.linkUrl}
                </a>
              </div>
              <div>
                <h4 className="mb-2 text-xs font-bold uppercase tracking-wider text-slate-400">Payload plateforme</h4>
                <pre className="max-h-48 overflow-auto rounded-2xl border border-slate-800 bg-slate-950 p-4 font-mono text-[10px] leading-relaxed text-slate-400">
                  {JSON.stringify(preview.payload.platformPayload, null, 2)}
                </pre>
              </div>
            </div>
          </div>
        </Modal>
      )}

      {/* Modal modifier texte */}
      {editing && (
        <Modal title={`Modifier le texte — ${PLATFORM_LABEL[editing.platform]}`} onClose={() => setEditing(null)}>
          <textarea
            rows={10}
            value={editText}
            onChange={(e) => setEditText(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 font-sans text-xs leading-relaxed text-white focus:border-primary focus:outline-none"
          />
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setEditing(null)} className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700">
              Annuler
            </button>
            <button type="button" onClick={() => void saveEdit()} className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110">
              Enregistrer
            </button>
          </div>
        </Modal>
      )}

      {/* Modal programmer */}
      {scheduling && (
        <Modal title={`Programmer — ${PLATFORM_LABEL[scheduling.platform]}`} onClose={() => setScheduling(null)}>
          <input
            type="datetime-local"
            value={scheduleValue}
            onChange={(e) => setScheduleValue(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:border-primary focus:outline-none"
          />
          <p className="mt-2 text-[11px] text-slate-500">
            Respecte les limites quotidiennes : la publication ne partira que si le quota du jour le permet.
          </p>
          <div className="mt-4 flex justify-end gap-3">
            <button type="button" onClick={() => setScheduling(null)} className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700">
              Annuler
            </button>
            <button type="button" onClick={() => void saveSchedule()} className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110">
              Programmer
            </button>
          </div>
        </Modal>
      )}
    </div>
  );
}

function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: React.ReactNode }) {
  return (
    <div className="fixed inset-0 z-50 overflow-y-auto bg-slate-950/80 p-4 backdrop-blur-sm">
      <div className="mx-auto my-8 w-full max-w-5xl space-y-6 rounded-3xl border border-slate-800 bg-slate-900 p-6 shadow-2xl lg:p-8">
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <h3 className="font-[var(--font-display)] text-lg font-bold text-white">{title}</h3>
          <button type="button" onClick={onClose} className="text-xl font-bold text-slate-400 hover:text-white">
            &times;
          </button>
        </div>
        {children}
      </div>
    </div>
  );
}

function RowButton({
  children,
  onClick,
  disabled,
  className,
}: {
  children: React.ReactNode;
  onClick: () => void;
  disabled?: boolean;
  className?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`rounded-xl px-3 py-1.5 text-xs font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${className || ''}`}
    >
      {children}
    </button>
  );
}

function StatCard({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-3xl border border-slate-800 bg-slate-950 p-4 shadow-xl">
      <div className={`text-xl font-extrabold ${tone}`}>{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}

function ConfigItem({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="text-sm font-extrabold text-white">{value}</div>
      <div className="mt-0.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</div>
    </div>
  );
}
