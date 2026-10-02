'use client';

import { useCallback, useEffect, useState } from 'react';
import { REGIONS_CI, SECTORS } from '@/lib/constants';
import { DIPLOMA_FILTERS } from '@/lib/examConstants';
import { cn } from '@/lib/utils';
import type {
  AlertChannel,
  AlertContentType,
  AlertFrequency,
  AlertItem,
} from '@/types/alerts';

const CONTENT_TYPE_OPTIONS: { value: AlertContentType; label: string }[] = [
  { value: 'job', label: 'Emplois' },
  { value: 'internship', label: 'Stages' },
  { value: 'scholarship', label: 'Bourses' },
  { value: 'exam', label: 'Concours' },
];

const FREQUENCY_LABEL: Record<AlertFrequency, string> = {
  immediate: 'Immédiat',
  daily: 'Récapitulatif quotidien',
};

/** Types de contrat filtrables (§8) — même liste que JobContractType. */
const CONTRACT_OPTIONS = ['CDI', 'CDD', 'Stage', 'Prestation', 'Alternance', 'Freelance'] as const;

/** Section « Mes alertes » — création, modification, activation, suppression (§8). */
export default function AlertsSection() {
  const [alerts, setAlerts] = useState<AlertItem[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Formulaire de création / modification.
  const [editingId, setEditingId] = useState<string | null>(null);
  const [label, setLabel] = useState('');
  const [contentTypes, setContentTypes] = useState<AlertContentType[]>([]);
  const [city, setCity] = useState('');
  const [diploma, setDiploma] = useState('');
  const [sector, setSector] = useState('');
  const [contract, setContract] = useState('');
  const [keywords, setKeywords] = useState('');
  const [channels, setChannels] = useState<AlertChannel>('email');
  const [frequency, setFrequency] = useState<AlertFrequency>('immediate');

  function resetForm() {
    setEditingId(null);
    setLabel('');
    setContentTypes([]);
    setCity('');
    setDiploma('');
    setSector('');
    setContract('');
    setKeywords('');
    setChannels('email');
    setFrequency('immediate');
  }

  const load = useCallback(async () => {
    try {
      const res = await fetch('/api/alerts', { cache: 'no-store' });
      if (res.ok) {
        const data = await res.json();
        setAlerts(Array.isArray(data.alerts) ? data.alerts : []);
      }
    } catch {
      // silencieux
    } finally {
      setLoaded(true);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, [load]);

  function toggleContentType(t: AlertContentType) {
    setContentTypes((prev) =>
      prev.includes(t) ? prev.filter((x) => x !== t) : [...prev, t],
    );
  }

  async function create(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!label.trim()) {
      setError('Donnez un nom à votre alerte (ex. « Offres IT à Abidjan »).');
      return;
    }
    setCreating(true);
    try {
      const payload = {
        label: label.trim(),
        content_types: contentTypes,
        city: city || null,
        diploma: diploma || null,
        sector: sector || null,
        contract_type: contract || null,
        keywords: keywords.trim() || null,
        channels,
        frequency,
      };
      const res = await fetch('/api/alerts', {
        method: editingId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(editingId ? { id: editingId, ...payload } : payload),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => null);
        setError(
          data?.error ||
            (editingId ? "Impossible de modifier l'alerte." : "Impossible de créer l'alerte."),
        );
        return;
      }
      // Réinitialise le formulaire + recharge la liste.
      resetForm();
      await load();
    } catch {
      setError('Serveur injoignable. Réessayez.');
    } finally {
      setCreating(false);
    }
  }

  /** Prépare le formulaire pour la modification d'une alerte existante (§8). */
  function startEdit(alert: AlertItem) {
    setError(null);
    setEditingId(alert.id);
    setLabel(alert.label);
    setContentTypes(alert.content_types);
    setCity(alert.city || '');
    setDiploma(alert.diploma || '');
    setSector(alert.sector || '');
    setContract(alert.contract_type || '');
    setKeywords(alert.keywords || '');
    setChannels(alert.channels);
    setFrequency(alert.frequency);
    document.getElementById('alert-form')?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }

  async function toggleActive(alert: AlertItem) {
    await fetch('/api/alerts', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ id: alert.id, active: !alert.active }),
    });
    await load();
  }

  async function remove(alert: AlertItem) {
    await fetch(`/api/alerts?id=${encodeURIComponent(alert.id)}`, { method: 'DELETE' });
    await load();
  }

  return (
    <div className="rounded-3xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-950 p-6 sm:p-8 space-y-6">
      <div>
        <h2 className="text-lg font-bold font-[var(--font-display)] text-gray-900 dark:text-white">
          Mes alertes
        </h2>
        <p className="text-xs text-gray-500 dark:text-slate-400 mt-1">
          Recevez par email ou WhatsApp les nouveaux contenus qui correspondent à vos
          critères — un lien de désinscription figure dans chaque notification.
        </p>
      </div>

      {error ? (
        <div
          role="alert"
          className="rounded-2xl bg-rose-500/10 border border-rose-500/30 p-4 text-xs text-rose-600 dark:text-rose-300"
        >
          {error}
        </div>
      ) : null}

      {/* Liste des alertes */}
      {!loaded ? (
        <div className="py-6 text-center text-sm text-gray-400">Chargement…</div>
      ) : alerts.length > 0 ? (
        <ul className="space-y-2.5">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className={cn(
                'rounded-2xl border p-4 transition-all',
                alert.active
                  ? 'border-gray-200 dark:border-slate-800 bg-gray-50/60 dark:bg-slate-900/60'
                  : 'border-dashed border-gray-200 dark:border-slate-800 opacity-70',
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-[14px] text-gray-900 dark:text-white truncate">
                      {alert.label}
                    </span>
                    <span
                      className={cn(
                        'rounded-full px-2 py-0.5 text-[10px] font-bold',
                        alert.active
                          ? 'bg-emerald-500/10 text-emerald-600 dark:text-emerald-400'
                          : 'bg-gray-100 text-gray-500 dark:bg-slate-800 dark:text-slate-400',
                      )}
                    >
                      {alert.active ? 'Active' : 'Désactivée'}
                    </span>
                  </div>
                  <div className="mt-1.5 flex flex-wrap gap-x-3 gap-y-1 text-[11px] text-gray-500 dark:text-slate-400">
                    <span>
                      {alert.content_types.length === 0
                        ? 'Tous les contenus'
                        : alert.content_types.map((t) => CONTENT_TYPE_OPTIONS.find((o) => o.value === t)?.label).join(', ')}
                    </span>
                    {alert.city ? <span>📍 {alert.city}</span> : null}
                    {alert.diploma ? <span>🎓 {alert.diploma}</span> : null}
                    {alert.sector ? (
                      <span>🏷️ {SECTORS.find((s) => s.slug === alert.sector)?.name ?? alert.sector}</span>
                    ) : null}
                    {alert.contract_type ? <span>📝 {alert.contract_type}</span> : null}
                    {alert.keywords ? <span>🔎 {alert.keywords}</span> : null}
                  </div>
                  <div className="mt-1 text-[11px] text-gray-400">
                    {alert.channels === 'both'
                      ? 'Email + WhatsApp'
                      : alert.channels === 'whatsapp'
                        ? 'WhatsApp'
                        : 'Email'}{' '}
                    · {FREQUENCY_LABEL[alert.frequency]}
                  </div>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <button
                    type="button"
                    onClick={() => startEdit(alert)}
                    aria-label={`Modifier l'alerte ${alert.label}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-primary hover:bg-primary/10 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9" />
                      <path d="M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z" />
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={() => toggleActive(alert)}
                    aria-label={alert.active ? 'Désactiver' : 'Activer'}
                    className={cn(
                      'inline-flex items-center justify-center h-8 w-8 rounded-lg transition-all',
                      alert.active
                        ? 'text-emerald-600 hover:bg-emerald-500/10 dark:text-emerald-400'
                        : 'text-gray-400 hover:bg-gray-100 dark:hover:bg-slate-800',
                    )}
                  >
                    {alert.active ? (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17h.01" />
                        <path d="M15 21H9m5.2-18.3a4 4 0 1 0-5.4 5.5L10 9.5V13l-2 3h8l-2-3V9.5l1.2-1.3a4 4 0 0 0-1-6.5Z" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 17h.01" />
                        <path d="M15 21H9m5.2-18.3a4 4 0 1 0-5.4 5.5L10 9.5V13l-2 3h8l-2-3V9.5l1.2-1.3a4 4 0 0 0-1-6.5Z" />
                      </svg>
                    )}
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(alert)}
                    aria-label={`Supprimer l'alerte ${alert.label}`}
                    className="inline-flex items-center justify-center h-8 w-8 rounded-lg text-gray-400 hover:text-rose-500 hover:bg-rose-500/10 transition-all"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                      <path d="M3 6h18" />
                      <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
                    </svg>
                  </button>
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-sm text-gray-500 dark:text-slate-400 py-2">
          Aucune alerte pour le moment. Créez-en une ci-dessous.
        </p>
      )}

      {/* Formulaire de création / modification (§8) */}
      <form
        id="alert-form"
        onSubmit={create}
        className="space-y-4 rounded-2xl border border-dashed border-gray-300 dark:border-slate-700 bg-gray-50/60 dark:bg-slate-900/50 p-4 sm:p-5"
      >
        <h3 className="text-sm font-bold text-gray-900 dark:text-white">
          {editingId ? 'Modifier l’alerte' : 'Créer une alerte'}
        </h3>

        <div>
          <label
            htmlFor="alert-label"
            className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
          >
            Nom de l&apos;alerte
          </label>
          <input
            id="alert-label"
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Ex. Offres IT à Abidjan"
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          />
        </div>

        <div>
          <span
            id="alert-content-types"
            className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
          >
            Types de contenu
          </span>
          <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="alert-content-types">
            {CONTENT_TYPE_OPTIONS.map((o) => (
              <button
                type="button"
                key={o.value}
                onClick={() => toggleContentType(o.value)}
                className={cn(
                  'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                  contentTypes.includes(o.value)
                    ? 'border-primary bg-primary/10 text-primary'
                    : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                )}
              >
                {o.label}
              </button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div>
            <label
              htmlFor="alert-city"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Ville
            </label>
            <select
              id="alert-city"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            >
              <option value="">Toutes</option>
              {REGIONS_CI.map((r) => (
                <option key={r.slug} value={r.name}>
                  {r.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="alert-diploma"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Diplôme
            </label>
            <select
              id="alert-diploma"
              value={diploma}
              onChange={(e) => setDiploma(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            >
              <option value="">Tous</option>
              {DIPLOMA_FILTERS.map((d) => (
                <option key={d.value} value={d.value}>
                  {d.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="alert-sector"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Secteur
            </label>
            <select
              id="alert-sector"
              value={sector}
              onChange={(e) => setSector(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            >
              <option value="">Tous</option>
              {SECTORS.map((s) => (
                <option key={s.slug} value={s.slug}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label
              htmlFor="alert-contract"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Contrat
            </label>
            <select
              id="alert-contract"
              value={contract}
              onChange={(e) => setContract(e.target.value)}
              className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-3 py-2.5 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
            >
              <option value="">Tous</option>
              {CONTRACT_OPTIONS.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div>
          <label
            htmlFor="alert-keywords"
            className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
          >
            Mots-clés
          </label>
          <input
            id="alert-keywords"
            type="text"
            value={keywords}
            onChange={(e) => setKeywords(e.target.value)}
            placeholder="Ex. développeur, data, cybersécurité"
            aria-describedby="alert-keywords-hint"
            className="w-full rounded-2xl border border-gray-200 dark:border-slate-800 bg-white dark:bg-slate-900 px-4 py-3 text-sm text-gray-900 dark:text-white focus:outline-none focus:border-primary"
          />
          <p id="alert-keywords-hint" className="text-[10px] text-gray-400 mt-1 ml-1">
            Séparés par des virgules — l&apos;offre doit en contenir au moins un.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <span
              id="alert-channels"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Canal
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="alert-channels">
              {(['email', 'whatsapp', 'both'] as AlertChannel[]).map((c) => (
                <button
                  type="button"
                  key={c}
                  onClick={() => setChannels(c)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                    channels === c
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                  )}
                >
                  {c === 'email' ? 'Email' : c === 'whatsapp' ? 'WhatsApp' : 'Email + WhatsApp'}
                </button>
              ))}
            </div>
            {channels !== 'email' ? (
              <p className="text-[10px] text-gray-400 mt-1 ml-1">
                Le numéro WhatsApp est celui de votre profil.
              </p>
            ) : null}
          </div>
          <div>
            <span
              id="alert-frequency"
              className="block text-[10px] font-bold text-gray-600 dark:text-slate-400 uppercase tracking-widest mb-1.5 ml-1"
            >
              Fréquence
            </span>
            <div className="flex flex-wrap gap-1.5" role="group" aria-labelledby="alert-frequency">
              {(['immediate', 'daily'] as AlertFrequency[]).map((f) => (
                <button
                  type="button"
                  key={f}
                  onClick={() => setFrequency(f)}
                  className={cn(
                    'rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-all',
                    frequency === f
                      ? 'border-primary bg-primary/10 text-primary'
                      : 'border-gray-200 bg-white text-gray-600 hover:border-primary/40 dark:border-slate-700 dark:bg-slate-900 dark:text-gray-300',
                  )}
                >
                  {FREQUENCY_LABEL[f]}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2 pt-1">
          {editingId ? (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl border border-gray-200 px-4 py-3 text-xs font-bold text-gray-600 transition-colors hover:border-gray-300 hover:text-gray-900 dark:border-slate-700 dark:text-gray-300"
            >
              Annuler
            </button>
          ) : (
            <span />
          )}
          <button
            type="submit"
            disabled={creating}
            className="rounded-xl bg-primary hover:brightness-110 disabled:opacity-50 text-white px-6 py-3 text-xs font-bold shadow-lg shadow-primary/20 transition-all"
          >
            {creating
              ? editingId
                ? 'Enregistrement…'
                : 'Création…'
              : editingId
                ? 'Enregistrer'
                : 'Créer mon alerte'}
          </button>
        </div>
      </form>
    </div>
  );
}
