'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlatformSettings } from '@/services/platformSettingsService';

interface SettingsClientProps {
  initialSettings: PlatformSettings;
}

const SCRAPER_SOURCE_LABELS: Record<string, string> = {
  educarriere: 'Educarriere.ci',
  emploici: 'Emploici.net',
  boursedetude: 'Bourse d\'étude',
};

const NOTIFICATION_TYPE_LABELS: Record<string, string> = {
  scraper_failure: 'Échec du scraper',
  new_report: 'Nouveau signalement',
  new_company: 'Nouvelle entreprise à vérifier',
  new_comment: 'Nouveau commentaire signalé',
};

const CHANNEL_OPTIONS: Array<{ value: string; label: string }> = [
  { value: 'both', label: 'Email + WhatsApp' },
  { value: 'email', label: 'Email uniquement' },
  { value: 'whatsapp', label: 'WhatsApp uniquement' },
  { value: 'off', label: 'Désactivé' },
];

export default function SettingsClient({ initialSettings }: SettingsClientProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [settings, setSettings] = useState<PlatformSettings>(initialSettings);
  const [feedback, setFeedback] = useState<{ tone: 'success' | 'error'; text: string } | null>(null);
  const [activeTab, setActiveTab] = useState<'taxonomies' | 'scraper' | 'notifications'>('taxonomies');

  // --- Taxonomies state ---
  const [newSector, setNewSector] = useState('');
  const [newCity, setNewCity] = useState('');
  const [newContractType, setNewContractType] = useState('');
  const [newBudgetRange, setNewBudgetRange] = useState('');

  // --- Scraper state ---
  const [threshold, setThreshold] = useState(settings.scraper_alert_threshold);

  async function saveSettings(updates: Partial<PlatformSettings>) {
    setFeedback(null);
    try {
      const res = await fetch('/api/admin/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (res.status === 401) {
        router.replace('/cz7tk/login?next=/cz7tk/settings');
        return;
      }
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Erreur');
      setSettings(data.settings);
      setFeedback({ tone: 'success', text: 'Paramètres enregistrés.' });
      startTransition(() => { router.refresh(); });
    } catch (err) {
      setFeedback({ tone: 'error', text: err instanceof Error ? err.message : 'Erreur inconnue' });
    }
  }

  // --- Taxonomy helpers ---
  function addToArray(key: keyof PlatformSettings, value: string, setter: (v: string) => void) {
    const arr = settings[key] as string[];
    if (!value.trim() || arr.includes(value.trim())) return;
    saveSettings({ [key]: [...arr, value.trim()] });
    setter('');
  }

  function removeFromArray(key: keyof PlatformSettings, value: string) {
    const arr = settings[key] as string[];
    saveSettings({ [key]: arr.filter((v) => v !== value) });
  }

  // --- Scraper helpers ---
  function toggleSource(source: string) {
    const current = settings.scraper_sources[source] ?? true;
    saveSettings({ scraper_sources: { ...settings.scraper_sources, [source]: !current } });
  }

  function saveThreshold() {
    saveSettings({ scraper_alert_threshold: threshold });
  }

  // --- Notification helpers ---
  function setChannel(type: string, channel: string) {
    saveSettings({ notification_channels: { ...settings.notification_channels, [type]: channel as 'email' | 'whatsapp' | 'both' | 'off' } });
  }

  const inputClass = 'w-full rounded-2xl border border-slate-800 bg-slate-950 px-4 py-3 text-sm text-white focus:outline-none focus:border-primary transition-colors';
  const labelClass = 'block text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1.5 ml-1';

  return (
    <div className="space-y-8 pb-24">
      {/* Header */}
      <div>
        <h1 className="text-2xl lg:text-3xl font-extrabold tracking-tight text-white font-[var(--font-display)]">
          Réglages de la plateforme
        </h1>
        <p className="text-sm text-slate-400 mt-1">
          Taxonomies, scraper, notifications — modifiables sans redéploiement.
        </p>
      </div>

      {/* Feedback */}
      {feedback && (
        <div className={`rounded-2xl border px-4 py-3 text-sm ${
          feedback.tone === 'success'
            ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
            : 'border-rose-500/30 bg-rose-500/10 text-rose-300'
        }`}>
          {feedback.text}
        </div>
      )}

      {/* Tabs */}
      <div className="flex flex-wrap gap-2">
        {(['taxonomies', 'scraper', 'notifications'] as const).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`px-4 py-2.5 rounded-2xl text-xs font-bold transition-all ${
              activeTab === tab
                ? 'bg-primary text-slate-950'
                : 'bg-slate-900 text-slate-300 hover:bg-slate-800'
            }`}
          >
            {tab === 'taxonomies' ? '📂 Taxonomies' : tab === 'scraper' ? '🕷 Scraper' : '🔔 Notifications'}
          </button>
        ))}
      </div>

      {/* ===== Tab: Taxonomies ===== */}
      {activeTab === 'taxonomies' && (
        <div className="grid gap-6 lg:grid-cols-2">
          {/* Secteurs */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Secteurs d&apos;activité</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.sectors.map((s) => (
                <span key={s} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                  {s}
                  <button onClick={() => removeFromArray('sectors', s)} className="text-slate-500 hover:text-rose-400 ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newSector} onChange={(e) => setNewSector(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToArray('sectors', newSector, setNewSector)} placeholder="Nouveau secteur…" className={inputClass} />
              <button onClick={() => addToArray('sectors', newSector, setNewSector)} className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-slate-950 hover:brightness-110">+</button>
            </div>
          </div>

          {/* Villes */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Villes</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.cities.map((c) => (
                <span key={c} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                  {c}
                  <button onClick={() => removeFromArray('cities', c)} className="text-slate-500 hover:text-rose-400 ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newCity} onChange={(e) => setNewCity(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToArray('cities', newCity, setNewCity)} placeholder="Nouvelle ville…" className={inputClass} />
              <button onClick={() => addToArray('cities', newCity, setNewCity)} className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-slate-950 hover:brightness-110">+</button>
            </div>
          </div>

          {/* Types de contrat */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Types de contrat</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.contract_types.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                  {t}
                  <button onClick={() => removeFromArray('contract_types', t)} className="text-slate-500 hover:text-rose-400 ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newContractType} onChange={(e) => setNewContractType(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToArray('contract_types', newContractType, setNewContractType)} placeholder="Nouveau type…" className={inputClass} />
              <button onClick={() => addToArray('contract_types', newContractType, setNewContractType)} className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-slate-950 hover:brightness-110">+</button>
            </div>
          </div>

          {/* Budgets */}
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Budgets de démarrage (Entreprendre)</h3>
            <div className="flex flex-wrap gap-2 mb-4">
              {settings.budget_ranges.map((b) => (
                <span key={b} className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-3 py-1.5 text-xs text-slate-300">
                  {b}
                  <button onClick={() => removeFromArray('budget_ranges', b)} className="text-slate-500 hover:text-rose-400 ml-1">&times;</button>
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <input value={newBudgetRange} onChange={(e) => setNewBudgetRange(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && addToArray('budget_ranges', newBudgetRange, setNewBudgetRange)} placeholder="Nouveau budget…" className={inputClass} />
              <button onClick={() => addToArray('budget_ranges', newBudgetRange, setNewBudgetRange)} className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-slate-950 hover:brightness-110">+</button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Tab: Scraper ===== */}
      {activeTab === 'scraper' && (
        <div className="space-y-6">
          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Sources actives</h3>
            <p className="text-xs text-slate-400 mb-4">Activez ou désactivez chaque source de scraping individuellement.</p>
            <div className="space-y-3">
              {Object.entries(SCRAPER_SOURCE_LABELS).map(([key, label]) => (
                <div key={key} className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                  <div>
                    <span className="text-sm font-semibold text-white">{label}</span>
                    <span className="ml-2 text-xs text-slate-500">({key})</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => toggleSource(key)}
                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                      settings.scraper_sources[key] !== false ? 'bg-emerald-500' : 'bg-slate-700'
                    }`}
                  >
                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                      settings.scraper_sources[key] !== false ? 'translate-x-6' : 'translate-x-1'
                    }`} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
            <h3 className="text-sm font-bold text-white mb-4">Seuil d&apos;alerte</h3>
            <p className="text-xs text-slate-400 mb-4">
              Nombre minimal d&apos;offres attendu par source avant de déclencher une alerte.
            </p>
            <div className="flex items-center gap-3 max-w-xs">
              <label className={labelClass}>Min. offres / source</label>
              <input
                type="number"
                min={1}
                max={100}
                value={threshold}
                onChange={(e) => setThreshold(parseInt(e.target.value) || 5)}
                className={inputClass}
              />
              <button onClick={saveThreshold} disabled={isPending} className="shrink-0 rounded-2xl bg-primary px-4 py-3 text-xs font-bold text-slate-950 hover:brightness-110 disabled:opacity-50">
                Enregistrer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ===== Tab: Notifications ===== */}
      {activeTab === 'notifications' && (
        <div className="rounded-3xl border border-slate-800 bg-slate-950 p-6 shadow-xl">
          <h3 className="text-sm font-bold text-white mb-4">Canaux de notification</h3>
          <p className="text-xs text-slate-400 mb-6">Choisissez comment être notifié pour chaque type d&apos;événement.</p>
          <div className="space-y-4">
            {Object.entries(NOTIFICATION_TYPE_LABELS).map(([type, label]) => (
              <div key={type} className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="text-sm font-semibold text-white">{label}</span>
                <select
                  value={settings.notification_channels[type] || 'off'}
                  onChange={(e) => setChannel(type, e.target.value)}
                  className="rounded-2xl border border-slate-800 bg-slate-950 px-4 py-2 text-sm text-white focus:outline-none focus:border-primary"
                >
                  {CHANNEL_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
