'use client';

import { useState } from 'react';

interface CoverLetterForm {
  companyName: string;
  jobTitle: string;
  candidateName: string;
  skills: string;
  experience: string;
  motivation: string;
}

const inputClass =
  'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all';
const labelClass = 'block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5';

export default function CoverLetterGenerator() {
  const [form, setForm] = useState<CoverLetterForm>({
    companyName: '',
    jobTitle: '',
    candidateName: '',
    skills: '',
    experience: '',
    motivation: '',
  });
  const [result, setResult] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState(false);

  const updateField = (field: keyof CoverLetterForm, value: string) => {
    setForm((prev) => ({ ...prev, [field]: value }));
  };

  const generate = async () => {
    if (!form.companyName.trim() || !form.jobTitle.trim()) {
      setError('Le nom de l\'entreprise et le poste sont obligatoires.');
      return;
    }
    setError('');
    setResult('');
    setLoading(true);

    try {
      const res = await fetch('/api/ai/cover-letter', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (res.ok && data.result) {
        setResult(data.result);
      } else {
        setError(data.error || 'Erreur lors de la génération.');
      }
    } catch {
      setError('Erreur réseau. Veuillez réessayer.');
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = async () => {
    try {
      await navigator.clipboard.writeText(result);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // noop
    }
  };

  const downloadTxt = () => {
    const blob = new Blob([result], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `Lettre_Motivation_${form.companyName.replace(/\s+/g, '_') || 'travaillerenci'}.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-6">
      {/* Formulaire */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center gap-3 mb-5">
          <span className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-indigo-600 text-white flex items-center justify-center text-lg shadow-md shadow-blue-500/20">
            ✉️
          </span>
          <div>
            <h2 className="text-lg font-bold text-gray-900 dark:text-white">
              Lettre de motivation IA
            </h2>
            <p className="text-xs text-gray-500 dark:text-gray-400">
              L&apos;IA rédige une lettre personnalisée pour votre candidature
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Entreprise *</label>
            <input
              type="text"
              placeholder="Ex: Orange Côte d'Ivoire"
              className={inputClass}
              value={form.companyName}
              onChange={(e) => updateField('companyName', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Poste visé *</label>
            <input
              type="text"
              placeholder="Ex: Développeur Full-Stack"
              className={inputClass}
              value={form.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Votre nom</label>
            <input
              type="text"
              placeholder="Ex: KOUASSI Jean-Paul"
              className={inputClass}
              value={form.candidateName}
              onChange={(e) => updateField('candidateName', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Compétences clés</label>
            <input
              type="text"
              placeholder="Ex: React, Node.js, TypeScript"
              className={inputClass}
              value={form.skills}
              onChange={(e) => updateField('skills', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Expérience pertinente</label>
            <textarea
              rows={3}
              placeholder="Décrivez brièvement vos expériances les plus pertinentes pour ce poste..."
              className={inputClass + ' resize-none'}
              value={form.experience}
              onChange={(e) => updateField('experience', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Votre motivation</label>
            <textarea
              rows={2}
              placeholder="Pourquoi ce poste vous intéresse-t-il ?"
              className={inputClass + ' resize-none'}
              value={form.motivation}
              onChange={(e) => updateField('motivation', e.target.value)}
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 rounded-xl bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800/40 px-4 py-2.5">
            <svg className="h-4 w-4 text-red-500 shrink-0" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" />
              <path d="M12 8v4M12 16h.01" />
            </svg>
            <span className="text-xs font-semibold text-red-600 dark:text-red-400">{error}</span>
          </div>
        )}

        <div className="mt-5">
          <button
            onClick={generate}
            disabled={loading || !form.companyName.trim() || !form.jobTitle.trim()}
            className="px-6 py-3 rounded-xl bg-gradient-to-r from-blue-500 to-indigo-600 text-white text-sm font-bold shadow-lg shadow-blue-500/20 hover:shadow-xl hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
          >
            {loading ? (
              <>
                <svg className="w-4 h-4 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                Génération en cours...
              </>
            ) : (
              <>
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
                Générer ma lettre
              </>
            )}
          </button>
        </div>
      </div>

      {/* Résultat */}
      {result && (
        <div className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-base font-bold text-gray-900 dark:text-white flex items-center gap-2">
              <span className="w-7 h-7 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-sm">✓</span>
              Votre lettre de motivation
            </h3>
            <div className="flex items-center gap-2">
              <button
                onClick={copyToClipboard}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5"
              >
                {copied ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    Copié !
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z" />
                    </svg>
                    Copier
                  </>
                )}
              </button>
              <button
                onClick={downloadTxt}
                className="px-3 py-1.5 rounded-lg text-xs font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                Télécharger
              </button>
            </div>
          </div>
          <div className="rounded-xl bg-gray-50 dark:bg-slate-800/50 border border-gray-200 dark:border-slate-700 p-5">
            <pre className="whitespace-pre-wrap text-sm text-gray-700 dark:text-gray-200 leading-relaxed font-[var(--font-body)]">
              {result}
            </pre>
          </div>
          <p className="mt-3 text-[11px] text-gray-400 dark:text-gray-500">
            ✨ Lettre générée par IA. Vérifiez et personnalisez les détails avant de l&apos;envoyer.
          </p>
        </div>
      )}
    </div>
  );
}
