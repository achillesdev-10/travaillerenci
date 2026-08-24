'use client';

import { useState, useRef } from 'react';
import type { CVData, Experience, Education } from '@/types/cv';
import { createEmptyExperience, createEmptyEducation } from '@/types/cv';

const MAX_PHOTO_SIZE = 5 * 1024 * 1024; // 5 Mo

interface CVFormProps {
  cvData: CVData;
  onChange: (data: CVData) => void;
}

export default function CVForm({ cvData, onChange }: CVFormProps) {
  const [skillInput, setSkillInput] = useState('');
  const [optimizingField, setOptimizingField] = useState<string | null>(null);
  const [photoUploading, setPhotoUploading] = useState(false);
  const [photoMessage, setPhotoMessage] = useState<{
    type: 'error' | 'info';
    text: string;
  } | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const photoInputRef = useRef<HTMLInputElement>(null);

  const updateField = <K extends keyof CVData>(field: K, value: CVData[K]) => {
    onChange({ ...cvData, [field]: value });
  };

  const updateExperience = (id: string, field: keyof Experience, value: string) => {
    const updated = cvData.experiences.map((exp) =>
      exp.id === id ? { ...exp, [field]: value } : exp
    );
    updateField('experiences', updated);
  };

  const addExperience = () => {
    updateField('experiences', [...cvData.experiences, createEmptyExperience()]);
  };

  const removeExperience = (id: string) => {
    updateField('experiences', cvData.experiences.filter((e) => e.id !== id));
  };

  const updateEducation = (id: string, field: keyof Education, value: string) => {
    const updated = cvData.educations.map((edu) =>
      edu.id === id ? { ...edu, [field]: value } : edu
    );
    updateField('educations', updated);
  };

  const addEducation = () => {
    updateField('educations', [...cvData.educations, createEmptyEducation()]);
  };

  const removeEducation = (id: string) => {
    updateField('educations', cvData.educations.filter((e) => e.id !== id));
  };

  const addSkill = (skill: string) => {
    const trimmed = skill.trim();
    if (trimmed && !cvData.skills.includes(trimmed)) {
      updateField('skills', [...cvData.skills, trimmed]);
    }
    setSkillInput('');
  };

  const removeSkill = (skill: string) => {
    updateField('skills', cvData.skills.filter((s) => s !== skill));
  };

  const handlePhotoFile = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) {
      setPhotoMessage({
        type: 'error',
        text: 'Format non supporté. Choisissez une image (JPG, PNG, WebP).',
      });
      return;
    }
    if (file.size > MAX_PHOTO_SIZE) {
      setPhotoMessage({ type: 'error', text: 'Image trop lourde (5 Mo maximum).' });
      return;
    }
    setPhotoMessage(null);
    setPhotoUploading(true);

    // Aperçu immédiat via un blob local, puis upload Supabase en arrière-plan.
    const localUrl = URL.createObjectURL(file);
    updateField('photoUrl', localUrl);

    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await fetch('/api/cv/photo', { method: 'POST', body: formData });
      const data = await res.json();
      if (res.ok && data.url) {
        updateField('photoUrl', data.url);
      } else if (data.code === 'not_configured') {
        setPhotoMessage({
          type: 'info',
          text: 'Aperçu local uniquement — stockage Supabase non configuré.',
        });
      } else {
        setPhotoMessage({
          type: 'error',
          text: data.error || "Échec de l'upload de la photo.",
        });
      }
    } catch {
      setPhotoMessage({
        type: 'error',
        text: "Erreur lors de l'upload de la photo.",
      });
    } finally {
      setPhotoUploading(false);
    }
  };

  const removePhoto = () => {
    const current = cvData.photoUrl;
    if (current?.startsWith('blob:')) URL.revokeObjectURL(current);
    updateField('photoUrl', '');
    setPhotoMessage(null);
    if (photoInputRef.current) photoInputRef.current.value = '';
  };

  const handlePhotoDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handlePhotoFile(e.dataTransfer.files?.[0]);
  };

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === 'Backspace' && !skillInput && cvData.skills.length > 0) {
      removeSkill(cvData.skills[cvData.skills.length - 1]);
    }
  };

  const optimizeText = async (text: string, fieldKey: string) => {
    if (!text.trim()) return;
    setOptimizingField(fieldKey);
    try {
      const res = await fetch('/api/ai/optimize-cv', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text, jobTitle: cvData.jobTitle || 'Poste en Côte d\'Ivoire' }),
      });
      const data = await res.json();
      if (data.result) {
        if (fieldKey === 'summary') {
          updateField('summary', data.result);
        } else if (fieldKey.startsWith('exp-')) {
          const expId = fieldKey.replace('exp-', '');
          updateExperience(expId, 'description', data.result);
        }
      } else if (data.error) {
        alert(data.error);
      }
    } catch (e) {
      console.error(e);
      alert('Erreur lors de l\'optimisation IA.');
    } finally {
      setOptimizingField(null);
    }
  };

  const inputClass =
    'w-full px-3.5 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-gray-900 dark:text-gray-100 focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all';
  const labelClass = 'block text-sm font-semibold text-gray-800 dark:text-gray-200 mb-1.5';
  const sectionTitleClass = 'text-lg font-bold text-gray-900 dark:text-white flex items-center gap-2 mb-4';
  const btnSecondary = 'px-3.5 py-2 rounded-xl text-sm font-semibold border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5';

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">👤</span>
          Informations personnelles
        </h2>

        {/* --- Photo de profil --- */}
        <div className="mb-6 flex flex-col sm:flex-row items-center gap-5">
          <div className="relative shrink-0">
            <div className="w-28 h-28 rounded-full overflow-hidden border-4 border-primary/15 bg-gray-100 dark:bg-slate-800 shadow-inner flex items-center justify-center">
              {cvData.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={cvData.photoUrl}
                  alt="Photo de profil"
                  crossOrigin={
                    cvData.photoUrl.startsWith('http')
                      ? 'anonymous'
                      : undefined
                  }
                  className="w-full h-full object-cover"
                />
              ) : (
                <svg
                  className="w-12 h-12 text-gray-300 dark:text-slate-600"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={1.5}
                    d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
                  />
                </svg>
              )}
            </div>
            {cvData.photoUrl && !photoUploading && (
              <button
                onClick={removePhoto}
                title="Retirer la photo"
                className="absolute -top-1.5 -right-1.5 w-7 h-7 rounded-full bg-red-500 hover:bg-red-600 text-white text-sm font-bold shadow-md flex items-center justify-center transition-all hover:scale-110"
              >
                ✕
              </button>
            )}
          </div>

          <div className="flex-1 min-w-0 w-full">
            <label className={labelClass}>Photo de profil</label>
            <input
              ref={photoInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="hidden"
              onChange={(e) => {
                handlePhotoFile(e.target.files?.[0]);
                e.target.value = '';
              }}
            />
            <div
              onClick={() => photoInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setIsDragging(true);
              }}
              onDragLeave={() => setIsDragging(false)}
              onDrop={handlePhotoDrop}
              className={`flex items-center justify-center gap-2 px-4 py-3.5 rounded-xl border-2 border-dashed border-gray-300 dark:border-slate-600 bg-gray-50 dark:bg-slate-800/50 text-sm font-semibold text-gray-600 dark:text-gray-300 cursor-pointer transition-all hover:border-primary hover:bg-primary/5 ${
                isDragging
                  ? 'border-primary bg-primary/10 scale-[1.01] ring-2 ring-primary/20'
                  : ''
              }`}
            >
              {photoUploading ? (
                <>
                  <svg
                    className="w-4 h-4 animate-spin text-primary"
                    fill="none"
                    viewBox="0 0 24 24"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    ></circle>
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    ></path>
                  </svg>
                  Upload en cours...
                </>
              ) : (
                <>📷 Télécharger une photo ou glisser-déposer</>
              )}
            </div>
            {photoMessage && (
              <p
                className={`mt-2 text-xs font-semibold ${
                  photoMessage.type === 'error'
                    ? 'text-red-500'
                    : 'text-amber-500'
                }`}
              >
                {photoMessage.text}
              </p>
            )}
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
              Conseil : photo récente, fond neutre et visage bien visible.
              JPG, PNG ou WebP — 5 Mo max.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className={labelClass}>Nom et Prénom</label>
            <input
              type="text"
              placeholder="Ex: KOUASSI Jean-Paul"
              className={inputClass}
              value={cvData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Titre du poste</label>
            <input
              type="text"
              placeholder="Ex: Développeur Full-Stack"
              className={inputClass}
              value={cvData.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Email</label>
            <input
              type="email"
              placeholder="exemple@gmail.com"
              className={inputClass}
              value={cvData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div>
            <label className={labelClass}>Téléphone</label>
            <input
              type="tel"
              placeholder="+225 07 00 00 00 00"
              className={inputClass}
              value={cvData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label className={labelClass}>Ville</label>
            <input
              type="text"
              placeholder="Abidjan, Cocody..."
              className={inputClass}
              value={cvData.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-400 flex items-center justify-center text-base">📝</span>
          Accroche professionnelle
        </h2>
        <div className="relative">
          <textarea
            rows={4}
            placeholder="Présentez-vous en quelques lignes..."
            className={inputClass + ' pr-32 resize-none'}
            value={cvData.summary}
            onChange={(e) => updateField('summary', e.target.value)}
          />
          <button
            onClick={() => optimizeText(cvData.summary, 'summary')}
            disabled={optimizingField === 'summary' || !cvData.summary.trim()}
            className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 transition-all inline-flex items-center gap-1.5"
          >
            {optimizingField === 'summary' ? (
              <>
                <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                </svg>
                Optimisation...
              </>
            ) : (
              <>Optimiser avec l'IA ✨</>
            )}
          </button>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitleClass + ' mb-0'}>
            <span className="w-8 h-8 rounded-lg bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 flex items-center justify-center text-base">💼</span>
            Expériences professionnelles
          </h2>
          <button onClick={addExperience} className={btnSecondary}>
            <span className="text-base leading-none">+</span> Ajouter
          </button>
        </div>
        <div className="space-y-5">
          {cvData.experiences.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
              Aucune expérience ajoutée. Cliquez sur "Ajouter" pour commencer.
            </p>
          )}
          {cvData.experiences.map((exp, idx) => (
            <div key={exp.id} className="border border-gray-100 dark:border-slate-800 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Expérience {idx + 1}
                </span>
                <button
                  onClick={() => removeExperience(exp.id)}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  ✕ Supprimer
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
                <div>
                  <label className={labelClass}>Poste</label>
                  <input
                    type="text"
                    placeholder="Ex: Chef de projet"
                    className={inputClass}
                    value={exp.position}
                    onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>Entreprise</label>
                  <input
                    type="text"
                    placeholder="Ex: Orange Côte d'Ivoire"
                    className={inputClass}
                    value={exp.company}
                    onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Période</label>
                  <input
                    type="text"
                    placeholder="Ex: Jan 2022 - Aujourd'hui"
                    className={inputClass}
                    value={exp.period}
                    onChange={(e) => updateExperience(exp.id, 'period', e.target.value)}
                  />
                </div>
              </div>
              <div className="relative">
                <label className={labelClass}>Description</label>
                <textarea
                  rows={3}
                  placeholder="Décrivez vos missions..."
                  className={inputClass + ' pr-32 resize-none'}
                  value={exp.description}
                  onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                />
                <button
                  onClick={() => optimizeText(exp.description, `exp-${exp.id}`)}
                  disabled={optimizingField === `exp-${exp.id}` || !exp.description.trim()}
                  className="absolute top-7 right-2.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-emerald-500 to-teal-500 text-white text-xs font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 transition-all inline-flex items-center gap-1.5"
                >
                  {optimizingField === `exp-${exp.id}` ? (
                    <>
                      <svg className="w-3.5 h-3.5 animate-spin" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                      </svg>
                      IA...
                    </>
                  ) : (
                    <>IA ✨</>
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitleClass + ' mb-0'}>
            <span className="w-8 h-8 rounded-lg bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400 flex items-center justify-center text-base">🎓</span>
            Formations
          </h2>
          <button onClick={addEducation} className={btnSecondary}>
            <span className="text-base leading-none">+</span> Ajouter
          </button>
        </div>
        <div className="space-y-4">
          {cvData.educations.length === 0 && (
            <p className="text-sm text-gray-500 dark:text-gray-400 text-center py-6 border-2 border-dashed border-gray-200 dark:border-slate-700 rounded-xl">
              Aucune formation ajoutée. Cliquez sur "Ajouter" pour commencer.
            </p>
          )}
          {cvData.educations.map((edu, idx) => (
            <div key={edu.id} className="border border-gray-100 dark:border-slate-800 rounded-xl p-4 bg-gray-50/50 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                  Formation {idx + 1}
                </span>
                <button
                  onClick={() => removeEducation(edu.id)}
                  className="text-xs text-red-500 hover:text-red-600 font-semibold px-2 py-1 rounded-lg hover:bg-red-50 dark:hover:bg-red-900/20 transition-all"
                >
                  ✕ Supprimer
                </button>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className={labelClass}>Diplôme</label>
                  <input
                    type="text"
                    placeholder="Ex: Master en Informatique"
                    className={inputClass}
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                  />
                </div>
                <div>
                  <label className={labelClass}>École / Université</label>
                  <input
                    type="text"
                    placeholder="Ex: INP-HB"
                    className={inputClass}
                    value={edu.school}
                    onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className={labelClass}>Année</label>
                  <input
                    type="text"
                    placeholder="Ex: 2020 - 2022"
                    className={inputClass}
                    value={edu.year}
                    onChange={(e) => updateEducation(edu.id, 'year', e.target.value)}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-gray-100 dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-amber-100 dark:bg-amber-900/30 text-amber-700 dark:text-amber-400 flex items-center justify-center text-base">⚡</span>
          Compétences
        </h2>
        <div className="flex flex-wrap gap-2 mb-3">
          {cvData.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                className="ml-1 text-primary/60 hover:text-primary font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          type="text"
          placeholder="Tapez une compétence puis appuyez sur Entrée (ex: React, Java, Gestion de projet...)"
          className={inputClass}
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          onBlur={() => skillInput && addSkill(skillInput)}
        />
        <p className="text-xs text-gray-500 dark:text-gray-400 mt-2">
          Appuyez sur Entrée ou , pour ajouter une compétence
        </p>
      </section>
    </div>
  );
}
