'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { JobOfferSchema, JobOfferSchemaStatus, ContentCategory } from '@/types';
import { cleanDescription } from '@/lib/descriptionCleaner';

const CATEGORY_TABS: Array<{ value: ContentCategory | 'all'; label: string }> = [
  { value: 'all', label: 'Tous' },
  { value: 'job', label: 'Emplois' },
  { value: 'internship', label: 'Stages' },
  { value: 'scholarship', label: 'Bourses' },
  { value: 'exam', label: 'Concours' },
];

const CATEGORY_BADGES: Record<ContentCategory, { label: string; className: string }> = {
  job: { label: 'Emploi', className: 'bg-sky-500/15 text-sky-400 border-sky-500/30' },
  internship: { label: 'Stage', className: 'bg-violet-500/15 text-violet-400 border-violet-500/30' },
  scholarship: { label: 'Bourse', className: 'bg-amber-500/15 text-amber-400 border-amber-500/30' },
  exam: { label: 'Concours', className: 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30' },
};

/** ISO 8601 → valeur pour un <input type="datetime-local">. */
function toDatetimeLocal(iso: string) {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function formatDeadline(deadline: string | null) {
  if (!deadline) return null;
  const d = new Date(deadline);
  if (Number.isNaN(d.getTime())) return deadline;
  return new Intl.DateTimeFormat('fr-FR', { dateStyle: 'long' }).format(d);
}

function isDeadlinePassed(deadline: string | null) {
  if (!deadline) return false;
  const d = new Date(deadline);
  return !Number.isNaN(d.getTime()) && d.getTime() < Date.now();
}

export default function AdminJobsClient({
  initialJobs,
  duplicateIds = [],
}: {
  initialJobs: JobOfferSchema[];
  duplicateIds?: string[];
}) {
  const router = useRouter();
  const [jobs, setJobs] = useState<JobOfferSchema[]>(initialJobs);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | JobOfferSchemaStatus | 'verified' | 'unverified'>('pending');
  const [categoryFilter, setCategoryFilter] = useState<ContentCategory | 'all'>('all');
  const [contractFilter, setContractFilter] = useState<string>('all');
  const [cityFilter, setCityFilter] = useState<string>('all');
  const [duplicatesOnly, setDuplicatesOnly] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [, startTransition] = useTransition();

  // Modal d'édition & SEO
  const [editingJob, setEditingJob] = useState<JobOfferSchema | null>(null);
  const [isCreating, setIsCreating] = useState(false);
  const [modalNotice, setModalNotice] = useState<string | null>(null);
  const [isAiRewriting, setIsAiRewriting] = useState(false);
  const [editForm, setEditForm] = useState({
    category: 'job' as ContentCategory,
    title: '',
    company: '',
    location: '',
    contract_type: 'CDI' as JobOfferSchema['contract_type'],
    description: '',
    status: 'pending' as JobOfferSchemaStatus,
    deadline: '',
    seo_title: '',
    seo_description: '',
    seo_keywords: '',
    slug: '',
    source_url: '',
    source_website: '',
  });

  async function readError(res: Response): Promise<string> {
    try {
      const data = await res.json();
      if (data?.error) return data.error;
    } catch {
      // réponse non-JSON
    }
    return `Erreur serveur (${res.status}).`;
  }

  function redirectToLogin() {
    router.replace('/admin/login?next=/admin/jobs');
  }

  const filteredJobs = jobs.filter((job) => {
    const matchesSearch =
      job.title.toLowerCase().includes(search.toLowerCase()) ||
      job.company.toLowerCase().includes(search.toLowerCase()) ||
      job.location.toLowerCase().includes(search.toLowerCase());

    const matchesStatus =
      statusFilter === 'all'
        ? true
        : statusFilter === 'pending'
        ? job.status === 'pending'
        : statusFilter === 'published'
        ? job.status === 'published'
        : statusFilter === 'rejected'
        ? job.status === 'rejected'
        : statusFilter === 'archived'
        ? job.status === 'archived'
        : statusFilter === 'verified'
        ? job.is_verified
        : !job.is_verified;

    const matchesCategory =
      categoryFilter === 'all' ? true : (job.category || 'job') === categoryFilter;

    const matchesContract =
      contractFilter === 'all' ? true : job.contract_type === contractFilter;

    const matchesCity =
      cityFilter === 'all' ? true : job.location.toLowerCase().includes(cityFilter.toLowerCase());

    const matchesDuplicate = duplicatesOnly ? duplicateIds.includes(job.id) : true;

    return (
      matchesSearch &&
      matchesStatus &&
      matchesCategory &&
      matchesContract &&
      matchesCity &&
      matchesDuplicate
    );
  });

  async function handleUpdateStatus(job: JobOfferSchema, newStatus: JobOfferSchemaStatus) {
    const isVerified = newStatus === 'published' ? true : job.is_verified;
    setJobs((prev) =>
      prev.map((j) => (j.id === job.id ? { ...j, status: newStatus, is_verified: isVerified } : j))
    );

    try {
      const res = await fetch(`/api/admin/jobs/${job.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status: newStatus, is_verified: isVerified }),
      });

      if (res.status === 401) {
        setJobs((prev) =>
          prev.map((j) => (j.id === job.id ? { ...j, status: job.status, is_verified: job.is_verified } : j))
        );
        redirectToLogin();
        return;
      }

      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setJobs((prev) =>
        prev.map((j) => (j.id === job.id ? { ...j, status: job.status, is_verified: job.is_verified } : j))
      );
      alert(err instanceof Error && err.message ? err.message : 'Impossible de modifier le statut de l’offre.');
    }
  }

  async function handleDelete(id: string) {
    if (!confirm('Êtes-vous sûr de vouloir supprimer cette offre ?')) return;
    const previousJobs = [...jobs];
    setJobs((prev) => prev.filter((j) => j.id !== id));
    try {
      const res = await fetch(`/api/admin/jobs/${id}`, { method: 'DELETE' });
      if (res.status === 401) {
        setJobs(previousJobs);
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(await readError(res));
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setJobs(previousJobs);
      alert(err instanceof Error && err.message ? err.message : 'Impossible de supprimer cette offre.');
    }
  }

  async function handleBulkAction(action: 'delete' | 'publish' | 'archive' | 'clean') {
    if (selectedIds.length === 0) return;
    if (action === 'delete' && !confirm(`Supprimer ${selectedIds.length} offres ?`)) return;
    if (action === 'clean' && !confirm(`Nettoyer la description de ${selectedIds.length} offre(s) ?`)) return;

    const targetStatus: JobOfferSchemaStatus = action === 'publish' ? 'published' : action === 'archive' ? 'archived' : 'pending';

    try {
      const res = await fetch('/api/admin/jobs/bulk', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(
          action === 'clean'
            ? { action: 'clean', ids: selectedIds }
            : {
                action: action === 'delete' ? 'delete' : 'update',
                ids: selectedIds,
                data: action === 'delete' ? {} : { status: targetStatus, is_verified: action === 'publish' },
              }
        ),
      });

      if (res.status === 401) {
        redirectToLogin();
        return;
      }

      if (!res.ok) throw new Error(await readError(res));

      if (action === 'delete') {
        setJobs((prev) => prev.filter((j) => !selectedIds.includes(j.id)));
      } else if (action === 'clean') {
        // La liste locale ne reflète pas les descriptions → on recharge.
        startTransition(() => { router.refresh(); });
        setSelectedIds([]);
        return;
      } else {
        setJobs((prev) =>
          prev.map((j) =>
            selectedIds.includes(j.id)
              ? {
                  ...j,
                  status: targetStatus,
                  is_verified: action === 'publish' ? true : j.is_verified,
                }
              : j
          )
        );
      }
      setSelectedIds([]);
      startTransition(() => { router.refresh(); });
    } catch {
      alert('Une erreur est survenue lors de l’action en masse.');
    }
  }

  const toggleSelectAll = () => {
    if (selectedIds.length === filteredJobs.length && filteredJobs.length > 0) {
      setSelectedIds([]);
    } else {
      setSelectedIds(filteredJobs.map((j) => j.id));
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const cities = Array.from(new Set(jobs.map((j) => {
    const parts = j.location.split('-');
    return parts[0].trim();
  }))).sort();

  function closeModal() {
    setEditingJob(null);
    setIsCreating(false);
    setModalNotice(null);
  }

  function openCreateModal() {
    setIsCreating(true);
    setEditingJob(null);
    setModalNotice(null);
    setEditForm({
      category: categoryFilter !== 'all' ? categoryFilter : 'job',
      title: '',
      company: '',
      location: 'Abidjan',
      contract_type: 'CDI',
      description: '',
      status: 'pending',
      deadline: '',
      seo_title: '',
      seo_description: '',
      seo_keywords: '',
      slug: '',
      source_url: '',
      source_website: '',
    });
  }

  function openEditModal(job: JobOfferSchema) {
    setEditingJob(job);
    setIsCreating(false);
    setModalNotice(null);
    setEditForm({
      category: job.category || 'job',
      title: job.title,
      company: job.company,
      location: job.location,
      contract_type: job.contract_type,
      description: job.description,
      status: job.status || 'pending',
      deadline: job.deadline || '',
      seo_title: job.seo_title || '',
      seo_description: job.seo_description || '',
      seo_keywords: job.seo_keywords || '',
      slug: job.slug || '',
      source_url: job.source_url || '',
      source_website: job.source_website || '',
    });
  }

  async function handleSaveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!editingJob && !isCreating) return;
    try {
      const res = await fetch(
        isCreating ? '/api/admin/jobs' : `/api/admin/jobs/${editingJob!.id}`,
        {
          method: isCreating ? 'POST' : 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(editForm),
        }
      );
      const data = await res.json();
      if (res.status === 401) {
        closeModal();
        redirectToLogin();
        return;
      }
      if (!res.ok) {
        throw new Error(
          data.error || (isCreating ? 'Erreur lors de la création' : 'Erreur lors de la modification')
        );
      }
      if (isCreating && data.job) {
        setJobs((prev) => [data.job, ...prev]);
      } else if (!isCreating && editingJob) {
        setJobs((prev) =>
          prev.map((j) => (j.id === editingJob.id ? { ...j, ...editForm } : j))
        );
      }
      closeModal();
      startTransition(() => { router.refresh(); });
    } catch (err: unknown) {
      alert(err instanceof Error ? err.message : 'Erreur inconnue');
    }
  }

  /** Nettoie la description (retire header/footer/publicités) côté client. */
  function handleCleanDescription() {
    const cleaned = cleanDescription(editForm.description, editForm.title);
    if (cleaned === editForm.description.trim()) {
      setModalNotice('La description semble déjà propre.');
      return;
    }
    setEditForm((f) => ({ ...f, description: cleaned }));
    setModalNotice('✓ Description nettoyée — vérifiez le résultat puis enregistrez.');
  }

  /** Réécriture IA (optionnelle — nécessite GEMINI_API_KEY côté serveur). */
  async function handleAiRewrite() {
    if (isAiRewriting) return;
    if (!editForm.title || !editForm.company || !editForm.description) {
      setModalNotice('Renseignez d’abord titre, entreprise et description.');
      return;
    }
    setIsAiRewriting(true);
    setModalNotice(null);
    try {
      const res = await fetch('/api/admin/jobs/ai-rewrite', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: editForm.title,
          company: editForm.company,
          description: editForm.description,
        }),
      });
      const data = await res.json();
      if (res.status === 401) {
        closeModal();
        redirectToLogin();
        return;
      }
      if (!res.ok) throw new Error(data.error || 'Erreur IA inconnue.');
      setEditForm((f) => ({ ...f, description: data.rewritten }));
      setModalNotice('✓ Description réécrite par l’IA — vérifiez puis enregistrez.');
    } catch (err) {
      setModalNotice(err instanceof Error ? err.message : 'Erreur IA inconnue.');
    } finally {
      setIsAiRewriting(false);
    }
  }

  const pendingCount = jobs.filter((j) => j.status === 'pending').length;
  const duplicateCount = jobs.filter((j) => duplicateIds.includes(j.id)).length;
  const categoryCount = (cat: ContentCategory | 'all') =>
    cat === 'all' ? jobs.length : jobs.filter((j) => (j.category || 'job') === cat).length;

  return (
    <div className="space-y-8 pb-24">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
            Modération des contenus (offres, stages, bourses, concours)
          </h1>
          <p className="text-sm text-slate-400 mt-1">
            Examinez les contenus collectés par le scraper, modérez-les (valider / publier / rejeter / supprimer) et gérez le référencement SEO.
          </p>
        </div>
        <button
          type="button"
          onClick={openCreateModal}
          className="inline-flex items-center gap-2 rounded-2xl bg-primary px-5 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20"
        >
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
            <path d="M12 5v14M5 12h14" />
          </svg>
          Nouveau contenu
        </button>
      </div>

      {/* Onglets de Catégorie (Emploi / Stage / Bourse / Concours) */}
      <div className="flex flex-wrap gap-2">
        {CATEGORY_TABS.map((tab) => (
          <button
            key={tab.value}
            onClick={() => setCategoryFilter(tab.value)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
              categoryFilter === tab.value
                ? 'bg-primary text-slate-950 shadow-lg shadow-primary/20'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            <span>{tab.label}</span>
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {categoryCount(tab.value)}
            </span>
          </button>
        ))}
      </div>

      {/* Onglets de Statut */}
      <div className="flex flex-wrap gap-2 border-b border-slate-800 pb-4">
        <button
          onClick={() => setStatusFilter('pending')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            statusFilter === 'pending'
              ? 'bg-amber-500 text-slate-950 shadow-lg shadow-amber-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>Offres en attente</span>
          {pendingCount > 0 && (
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {pendingCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('published')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            statusFilter === 'published'
              ? 'bg-emerald-500 text-slate-950 shadow-lg shadow-emerald-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Publiées
        </button>
        <button
          onClick={() => setStatusFilter('rejected')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            statusFilter === 'rejected'
              ? 'bg-rose-500 text-white shadow-lg shadow-rose-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Rejetées
        </button>
        <button
          onClick={() => setStatusFilter('archived')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            statusFilter === 'archived'
              ? 'bg-slate-700 text-white'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Archivées
        </button>
        <button
          onClick={() => { setStatusFilter('all'); setDuplicatesOnly((v) => !v); }}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all flex items-center gap-2 ${
            duplicatesOnly
              ? 'bg-fuchsia-500 text-white shadow-lg shadow-fuchsia-500/20'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          <span>Doublons</span>
          {duplicateCount > 0 && (
            <span className="bg-slate-950/40 px-2 py-0.5 rounded-full text-[10px] text-white">
              {duplicateCount}
            </span>
          )}
        </button>
        <button
          onClick={() => setStatusFilter('all')}
          className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
            statusFilter === 'all'
              ? 'bg-primary text-slate-950'
              : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
          }`}
        >
          Toutes ({jobs.length})
        </button>
      </div>

      {/* Barre de recherche et filtres */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 p-5 shadow-xl flex flex-col md:flex-row gap-4 items-center justify-between">
        <div className="w-full md:w-80 relative">
          <svg className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-slate-400" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
          </svg>
          <input
            type="text"
            placeholder="Rechercher par titre, entreprise..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full rounded-2xl border border-slate-800 bg-slate-900 pl-11 pr-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors"
          />
        </div>

        <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
          <select
            value={cityFilter}
            onChange={(e) => setCityFilter(e.target.value)}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="all">Toutes les villes</option>
            {cities.map(city => (
              <option key={city} value={city}>{city}</option>
            ))}
          </select>

          <select
            value={contractFilter}
            onChange={(e) => setContractFilter(e.target.value)}
            className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3 text-sm text-slate-200 focus:outline-none focus:border-primary"
          >
            <option value="all">Tous les contrats</option>
            <option value="CDI">CDI</option>
            <option value="CDD">CDD</option>
            <option value="Stage">Stage</option>
            <option value="Freelance">Freelance</option>
            <option value="Alternance">Alternance</option>
            <option value="Prestation">Prestation</option>
          </select>
        </div>
      </div>

      {/* Tableau des offres */}
      <div className="rounded-3xl border border-slate-800 bg-slate-950 overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="border-b border-slate-800 bg-slate-900/50 text-xs font-semibold text-slate-400 uppercase tracking-wider">
                <th className="py-4 px-6 w-10 text-center">
                  <input
                    type="checkbox"
                    checked={selectedIds.length > 0 && selectedIds.length === filteredJobs.length}
                    onChange={toggleSelectAll}
                    className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary h-4 w-4"
                  />
                </th>
                <th className="py-4 px-6">Titre / Organisme / Source</th>
                <th className="py-4 px-6">Lieu</th>
                <th className="py-4 px-6">Contrat</th>
                <th className="py-4 px-6">Date limite</th>
                <th className="py-4 px-6">Statut</th>
                <th className="py-4 px-6 text-right">Actions de Modération</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-sm">
              {filteredJobs.length === 0 ? (
                <tr><td colSpan={6} className="py-12 text-center text-slate-500">Aucune offre trouvée dans cette vue.</td></tr>
              ) : (
                filteredJobs.map((job) => (
                  <tr key={job.id} className={`hover:bg-slate-900/40 transition-colors ${selectedIds.includes(job.id) ? 'bg-primary/5' : ''}`}>
                    <td className="py-4 px-6 text-center">
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(job.id)}
                        onChange={() => toggleSelect(job.id)}
                        className="rounded border-slate-700 bg-slate-900 text-primary focus:ring-primary h-4 w-4"
                      />
                    </td>
                    <td className="py-4 px-6">
                      <div className="font-bold text-white max-w-xs truncate flex items-center gap-2">
                        <span
                          className={`shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-bold ${CATEGORY_BADGES[job.category || 'job'].className}`}
                        >
                          {CATEGORY_BADGES[job.category || 'job'].label}
                        </span>
                        <span className="truncate">{job.title}</span>
                        {duplicateIds.includes(job.id) && (
                          <span className="shrink-0 inline-flex items-center gap-1 rounded-full bg-fuchsia-500/15 border border-fuchsia-500/30 px-2 py-0.5 text-[10px] font-bold text-fuchsia-400">
                            Doublon probable
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-400 truncate mt-0.5">
                        {job.company} {job.source_website && <span className="text-primary/80 font-medium">· Source: {job.source_website}</span>}
                      </div>
                    </td>
                    <td className="py-4 px-6 text-slate-300 text-xs">{job.location}</td>
                    <td className="py-4 px-6">
                      <span className="inline-flex rounded-full bg-slate-800 px-2.5 py-1 text-xs font-semibold text-slate-300">
                        {job.contract_type}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-xs whitespace-nowrap">
                      {job.deadline ? (
                        <span
                          className={`inline-flex items-center gap-1.5 ${
                            isDeadlinePassed(job.deadline)
                              ? 'text-rose-400'
                              : 'text-slate-300'
                          }`}
                        >
                          {isDeadlinePassed(job.deadline) && (
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
                          )}
                          {formatDeadline(job.deadline)}
                        </span>
                      ) : (
                        <span className="text-slate-500">—</span>
                      )}
                    </td>
                    <td className="py-4 px-6">
                      <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold border ${
                        job.status === 'published'
                          ? 'bg-emerald-500/15 text-emerald-400 border-emerald-500/30'
                          : job.status === 'rejected'
                          ? 'bg-rose-500/15 text-rose-400 border-rose-500/30'
                          : job.status === 'archived'
                          ? 'bg-slate-700/30 text-slate-400 border-slate-600/30'
                          : 'bg-amber-500/15 text-amber-400 border-amber-500/30'
                      }`}>
                        <span className={`h-1.5 w-1.5 rounded-full ${
                          job.status === 'published' ? 'bg-emerald-400' : job.status === 'rejected' ? 'bg-rose-400' : job.status === 'archived' ? 'bg-slate-400' : 'bg-amber-400'
                        }`} />
                        {job.status === 'published' ? 'Publiée' : job.status === 'rejected' ? 'Rejetée' : job.status === 'archived' ? 'Archivée' : 'En attente'}
                      </span>
                    </td>
                    <td className="py-4 px-6 text-right space-x-2 whitespace-nowrap">
                      {job.status !== 'published' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(job, 'published')}
                          className="px-3 py-1.5 rounded-xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20"
                        >
                          Valider & Publier
                        </button>
                      )}
                      {job.status !== 'rejected' && (
                        <button
                          type="button"
                          onClick={() => handleUpdateStatus(job, 'rejected')}
                          className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20"
                        >
                          Rejeter
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => openEditModal(job)}
                        className="px-3 py-1.5 rounded-xl bg-slate-800 text-slate-200 hover:bg-slate-700 text-xs font-semibold"
                      >
                        Examiner / Éditer
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(job.id)}
                        className="px-3 py-1.5 rounded-xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-semibold"
                      >
                        Supprimer
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Actions en masse */}
      {selectedIds.length > 0 && (
        <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-40 w-[calc(100%-2rem)] max-w-2xl">
          <div className="bg-slate-900 border border-primary/30 shadow-2xl shadow-primary/20 rounded-3xl p-4 flex items-center justify-between backdrop-blur-md">
            <div className="hidden sm:block pl-2">
              <span className="text-sm font-bold text-white">
                {selectedIds.length} sélectionnée{selectedIds.length > 1 ? 's' : ''}
              </span>
            </div>
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <button onClick={() => handleBulkAction('publish')} className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-emerald-500/10 text-emerald-400 hover:bg-emerald-500/20 text-xs font-bold border border-emerald-500/20">Publier</button>
              <button onClick={() => handleBulkAction('clean')} className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-sky-500/10 text-sky-400 hover:bg-sky-500/20 text-xs font-bold border border-sky-500/20">Nettoyer</button>
              <button onClick={() => handleBulkAction('archive')} className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-slate-800 text-slate-300 hover:bg-slate-700 text-xs font-bold border border-slate-700">Archiver</button>
              <button onClick={() => handleBulkAction('delete')} className="flex-1 sm:flex-none px-4 py-2.5 rounded-2xl bg-rose-500/10 text-rose-400 hover:bg-rose-500/20 text-xs font-bold border border-rose-500/20">Supprimer</button>
              <button onClick={() => setSelectedIds([])} className="p-2.5 rounded-2xl bg-slate-800 text-slate-400 hover:text-white transition-colors">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" /></svg>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Modal d'édition / création & Panneau SEO */}
      {(editingJob || isCreating) && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 backdrop-blur-sm p-4 overflow-y-auto">
          <div className="w-full max-w-3xl rounded-3xl border border-slate-800 bg-slate-900 p-6 lg:p-8 shadow-2xl space-y-6 my-8">
            <div className="flex items-center justify-between border-b border-slate-800 pb-4">
              <div>
                <h3 className="text-xl font-bold text-white font-[var(--font-display)]">
                  {isCreating ? 'Créer un contenu' : "Examiner & Éditer le contenu"}
                </h3>
                <p className="text-xs text-slate-400 mt-0.5">
                  {isCreating
                    ? 'Créez un contenu (emploi, stage, bourse ou concours) en attente de validation.'
                    : 'Modifiez le contenu, nettoyez ou réécrivez la description, ajustez le SEO.'}
                </p>
              </div>
              <button type="button" onClick={closeModal} className="text-slate-400 hover:text-white text-xl font-bold">&times;</button>
            </div>

            <form onSubmit={handleSaveEdit} className="space-y-6">
              {/* Informations Générales */}
              <div className="space-y-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">1. Informations principales</h4>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Catégorie</label>
                    <select
                      value={editForm.category}
                      onChange={(e) =>
                        setEditForm({ ...editForm, category: e.target.value as ContentCategory })
                      }
                      className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                    >
                      <option value="job">Emploi</option>
                      <option value="internship">Stage</option>
                      <option value="scholarship">Bourse d'études</option>
                      <option value="exam">Concours / Examen</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Titre</label>
                    <input type="text" required value={editForm.title} onChange={(e) => setEditForm({ ...editForm, title: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                      {editForm.category === 'scholarship' ? 'Bailleur' : editForm.category === 'exam' ? 'Organisme' : 'Entreprise'}
                    </label>
                    <input type="text" required value={editForm.company} onChange={(e) => setEditForm({ ...editForm, company: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Lieu / Ville / Pays</label>
                    <input type="text" required value={editForm.location} onChange={(e) => setEditForm({ ...editForm, location: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    {editForm.category === 'job' || editForm.category === 'internship' ? (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Type de contrat</label>
                        <select value={editForm.contract_type} onChange={(e) => setEditForm({ ...editForm, contract_type: e.target.value as any })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary">
                          <option value="CDI">CDI</option><option value="CDD">CDD</option><option value="Stage">Stage</option><option value="Freelance">Freelance</option><option value="Alternance">Alternance</option><option value="Prestation">Prestation</option>
                        </select>
                      </>
                    ) : (
                      <>
                        <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Type de contrat</label>
                        <div className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-xs text-slate-400">
                          Sans objet pour cette catégorie
                        </div>
                      </>
                    )}
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Statut</label>
                    <select value={editForm.status} onChange={(e) => setEditForm({ ...editForm, status: e.target.value as any })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary">
                      <option value="pending">En attente (Pending)</option>
                      <option value="published">Publié (Published)</option>
                      <option value="rejected">Rejeté (Rejected)</option>
                      <option value="archived">Archivé (Archived)</option>
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">
                    Date limite de candidature
                  </label>
                  <input
                    type="datetime-local"
                    value={toDatetimeLocal(editForm.deadline)}
                    onChange={(e) =>
                      setEditForm({
                        ...editForm,
                        deadline: e.target.value
                          ? new Date(e.target.value).toISOString()
                          : '',
                      })
                    }
                    className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary"
                  />
                  <p className="mt-1 text-[10px] text-slate-500 ml-1">
                    Optionnelle — l'offre sera automatiquement marquée comme
                    expirée après cette date.
                  </p>
                </div>

                <div>
                  <div className="flex flex-wrap items-center justify-between gap-2 mb-1.5 ml-1">
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest">Description (Markdown)</label>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={handleCleanDescription}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-[11px] font-bold text-slate-200 hover:bg-slate-700 transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6" />
                        </svg>
                        Nettoyer la description
                      </button>
                      <button
                        type="button"
                        onClick={handleAiRewrite}
                        disabled={isAiRewriting}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-fuchsia-500/15 border border-fuchsia-500/30 px-3 py-1.5 text-[11px] font-bold text-fuchsia-300 hover:bg-fuchsia-500/25 transition-colors disabled:opacity-50 disabled:cursor-wait"
                      >
                        <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                          <path d="M12 3l1.9 5.7a2 2 0 0 0 1.3 1.3L21 12l-5.8 1.9a2 2 0 0 0-1.3 1.3L12 21l-1.9-5.8a2 2 0 0 0-1.3-1.3L3 12l5.8-1.9a2 2 0 0 0 1.3-1.3L12 3z" />
                        </svg>
                        {isAiRewriting ? 'Réécriture…' : 'Réécrire avec l’IA'}
                      </button>
                    </div>
                  </div>
                  {modalNotice && (
                    <p className="text-[11px] text-amber-300/90 bg-amber-500/10 border border-amber-500/20 rounded-xl px-3 py-2 mb-2">
                      {modalNotice}
                    </p>
                  )}
                  <textarea rows={6} required value={editForm.description} onChange={(e) => setEditForm({ ...editForm, description: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-4 text-sm text-white focus:outline-none focus:border-primary font-mono text-xs" />
                </div>
              </div>

              {/* Source & Liens */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">2. Source & Application</h4>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">URL d'origine (Source URL)</label>
                    <input type="text" value={editForm.source_url} onChange={(e) => setEditForm({ ...editForm, source_url: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Site d'origine</label>
                    <input type="text" value={editForm.source_website} onChange={(e) => setEditForm({ ...editForm, source_website: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              {/* Panneau SEO */}
              <div className="space-y-4 border-t border-slate-800 pt-4">
                <h4 className="text-sm font-bold text-primary uppercase tracking-wider">3. Panneau SEO & Référencement</h4>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SEO Title (Titre pour moteurs de recherche)</label>
                  <input type="text" value={editForm.seo_title} onChange={(e) => setEditForm({ ...editForm, seo_title: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                </div>
                <div>
                  <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SEO Description (Max 160 caractères - Google / WhatsApp)</label>
                  <textarea rows={2} maxLength={160} value={editForm.seo_description} onChange={(e) => setEditForm({ ...editForm, seo_description: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 p-3 text-sm text-white focus:outline-none focus:border-primary" />
                  <div className="text-right text-[10px] text-slate-500 mt-1">{editForm.seo_description.length}/160 car.</div>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">SEO Keywords</label>
                    <input type="text" value={editForm.seo_keywords} onChange={(e) => setEditForm({ ...editForm, seo_keywords: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                  <div>
                    <label className="block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Slug URL canonique</label>
                    <input type="text" value={editForm.slug} onChange={(e) => setEditForm({ ...editForm, slug: e.target.value })} className="w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary" />
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-800">
                <button type="button" onClick={closeModal} className="rounded-2xl bg-slate-800 px-5 py-3 text-xs font-bold text-slate-300 hover:bg-slate-700 transition-colors">Annuler</button>
                <button type="submit" className="rounded-2xl bg-primary px-6 py-3 text-xs font-bold text-slate-950 hover:brightness-110 transition-all shadow-lg shadow-primary/20">
                  {isCreating ? 'Créer l’offre' : 'Enregistrer les modifications'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
