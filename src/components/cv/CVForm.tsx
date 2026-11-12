'use client';

import Image from 'next/image';
import { useState } from 'react';
import type { CVData, Experience, Education } from '@/types/cv';
import { createEmptyExperience, createEmptyEducation } from '@/types/cv';
import CVIllustration from './CVIllustration';

interface CVFormProps {
  cvData: CVData;
  onChange: (data: CVData) => void;
}

export default function CVForm({ cvData, onChange }: CVFormProps) {
  const [skillInput, setSkillInput] = useState('');
  const [languageInput, setLanguageInput] = useState('');
  const [interestInput, setInterestInput] = useState('');
  const [optimizingField, setOptimizingField] = useState<string | null>(null);

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

  const handleSkillKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addSkill(skillInput);
    } else if (e.key === 'Backspace' && !skillInput && cvData.skills.length > 0) {
      removeSkill(cvData.skills[cvData.skills.length - 1]);
    }
  };

  const addLanguage = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !cvData.languages.includes(trimmed)) {
      updateField('languages', [...cvData.languages, trimmed]);
    }
    setLanguageInput('');
  };

  const removeLanguage = (language: string) => {
    updateField('languages', cvData.languages.filter((l) => l !== language));
  };

  const handleLanguageKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addLanguage(languageInput);
    } else if (e.key === 'Backspace' && !languageInput && cvData.languages.length > 0) {
      removeLanguage(cvData.languages[cvData.languages.length - 1]);
    }
  };

  const addInterest = (value: string) => {
    const trimmed = value.trim();
    if (trimmed && !cvData.interests.includes(trimmed)) {
      updateField('interests', [...cvData.interests, trimmed]);
    }
    setInterestInput('');
  };

  const removeInterest = (interest: string) => {
    updateField('interests', cvData.interests.filter((i) => i !== interest));
  };

  const handleInterestKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault();
      addInterest(interestInput);
    } else if (e.key === 'Backspace' && !interestInput && cvData.interests.length > 0) {
      removeInterest(cvData.interests[cvData.interests.length - 1]);
    }
  };

  const handlePhotoChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;

    if (!file.type.startsWith('image/')) {
      alert('Veuillez choisir un fichier image.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      alert('La photo doit faire moins de 3 Mo.');
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      if (!dataUrl) return;

      const image = new window.Image();
      image.onload = () => {
        const size = 400;
        const canvas = document.createElement('canvas');
        canvas.width = size;
        canvas.height = size;
        const context = canvas.getContext('2d');

        if (!context) {
          updateField('photo', dataUrl);
          return;
        }

        const scale = Math.max(size / image.width, size / image.height);
        const width = image.width * scale;
        const height = image.height * scale;
        context.drawImage(image, (size - width) / 2, (size - height) / 2, width, height);
        updateField('photo', canvas.toDataURL('image/jpeg', 0.85));
      };
      image.onerror = () => updateField('photo', dataUrl);
      image.src = dataUrl;
    };
    reader.onerror = () => alert("Impossible de lire cette image.");
    reader.readAsDataURL(file);
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
    'w-full px-3.5 py-2.5 rounded-xl border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-sm text-black dark:text-white focus:ring-2 focus:ring-primary/30 focus:border-primary outline-none transition-all';
  const labelClass = 'block text-sm font-semibold text-black dark:text-white mb-1.5';
  const sectionTitleClass = 'text-lg font-bold text-black dark:text-white flex items-center gap-2 mb-4';
  const btnSecondary = 'px-3.5 py-2 rounded-xl text-sm font-semibold border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-black dark:text-white hover:bg-brand-soft/50 dark:hover:bg-slate-700 transition-all inline-flex items-center gap-1.5';

  return (
    <div className="space-y-6">
      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-base">👤</span>
          Informations personnelles
        </h2>

        <p className="mb-5 text-sm text-black dark:text-white">
          Les champs sont préremplis avec un exemple : remplacez-les par vos
          informations réelles. Tout est sauvegardé automatiquement.
        </p>

        <div className="mb-6 flex flex-col gap-4 rounded-xl border border-brand/20 bg-brand-soft/70 p-4 dark:border-brand/30 dark:bg-brand/10 sm:flex-row sm:items-center">
          {cvData.photo ? (
            <Image
              src={cvData.photo}
              alt="Photo de profil"
              width={80}
              height={80}
              unoptimized
              className="h-20 w-20 shrink-0 rounded-xl object-cover ring-2 ring-white dark:ring-slate-800"
            />
          ) : (
            <CVIllustration className="h-20 w-20 shrink-0 rounded-xl" />
          )}
          <div className="min-w-0 flex-1">
            <p className="text-sm font-bold text-black dark:text-white">
              Photo d&apos;identité (optionnelle)
            </p>
            <p className="mt-0.5 text-xs text-black dark:text-white">
              Ajoutez une photo professionnelle pour personnaliser votre CV. Sans
              photo, une illustration neutre est utilisée.
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              <label
                htmlFor="cv-photo"
                className="inline-flex cursor-pointer items-center gap-1.5 rounded-lg border border-line bg-white px-3 py-1.5 text-xs font-semibold text-black transition-all hover:bg-brand-soft/60 dark:border-slate-700 dark:bg-slate-800 dark:text-white dark:hover:bg-slate-700"
              >
                Choisir une photo
              </label>
              <input
                id="cv-photo"
                type="file"
                accept="image/*"
                className="sr-only"
                onChange={handlePhotoChange}
              />
              {cvData.photo && (
                <button
                  type="button"
                  onClick={() => updateField('photo', null)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-semibold text-red-600 transition-all hover:bg-red-50 dark:border-red-900/40 dark:bg-slate-800 dark:text-red-400 dark:hover:bg-red-950/30"
                >
                  Retirer la photo
                </button>
              )}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="cv-fullname" className={labelClass}>Nom et Prénom</label>
            <input
              id="cv-fullname"
              type="text"
              placeholder="Ex: KONÉ Awa"
              className={inputClass}
              value={cvData.fullName}
              onChange={(e) => updateField('fullName', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cv-jobtitle" className={labelClass}>Titre du poste</label>
            <input
              id="cv-jobtitle"
              type="text"
              placeholder="Ex: Assistante de Direction"
              className={inputClass}
              value={cvData.jobTitle}
              onChange={(e) => updateField('jobTitle', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cv-email" className={labelClass}>Email</label>
            <input
              id="cv-email"
              type="email"
              placeholder="exemple@gmail.com"
              className={inputClass}
              value={cvData.email}
              onChange={(e) => updateField('email', e.target.value)}
            />
          </div>
          <div>
            <label htmlFor="cv-phone" className={labelClass}>Téléphone</label>
            <input
              id="cv-phone"
              type="tel"
              placeholder="+225 07 00 00 00 00"
              className={inputClass}
              value={cvData.phone}
              onChange={(e) => updateField('phone', e.target.value)}
            />
          </div>
          <div className="sm:col-span-2">
            <label htmlFor="cv-city" className={labelClass}>Ville</label>
            <input
              id="cv-city"
              type="text"
              placeholder="Abidjan, Cocody..."
              className={inputClass}
              value={cvData.city}
              onChange={(e) => updateField('city', e.target.value)}
            />
          </div>
        </div>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-brand-strong dark:text-brand-accent flex items-center justify-center text-base">📝</span>
          Accroche professionnelle
        </h2>
        <p className="mb-4 text-xs text-black dark:text-white">
          Résumez en 2 à 4 lignes votre métier, votre expérience et ce que vous
          recherchez.
        </p>
        <div className="relative">
          <textarea
            id="cv-summary"
            aria-label="Accroche professionnelle"
            rows={4}
            placeholder="Présentez-vous en quelques lignes..."
            className={inputClass + ' pr-32 resize-none'}
            value={cvData.summary}
            onChange={(e) => updateField('summary', e.target.value)}
          />
          <button
            onClick={() => optimizeText(cvData.summary, 'summary')}
            disabled={optimizingField === 'summary' || !cvData.summary.trim()}
            className="absolute top-2.5 right-2.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand to-brand text-white text-xs font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 transition-all inline-flex items-center gap-1.5"
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

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitleClass + ' mb-0'}>
            <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-primary dark:text-brand-accent flex items-center justify-center text-base">💼</span>
            Expériences professionnelles
          </h2>
          <button onClick={addExperience} className={btnSecondary}>
            <span className="text-base leading-none">+</span> Ajouter
          </button>
        </div>
        <p className="mb-4 text-xs text-black dark:text-white">
          Commencez par l&apos;expérience la plus récente. Décrivez 2 à 3
          missions avec un résultat concret quand c&apos;est possible.
        </p>
        <div className="space-y-5">
          {cvData.experiences.length === 0 && (
            <p className="text-sm text-black dark:text-white text-center py-6 border-2 border-dashed border-line dark:border-slate-700 rounded-xl">
              Aucune expérience ajoutée. Cliquez sur "Ajouter" pour commencer.
            </p>
          )}
          {cvData.experiences.map((exp, idx) => (
            <div key={exp.id} className="border border-line dark:border-slate-800 rounded-xl p-4 bg-brand-soft/40 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">
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
                  <label htmlFor={`cv-exp-${idx}-position`} className={labelClass}>Poste</label>
                  <input
                    id={`cv-exp-${idx}-position`}
                    type="text"
                    placeholder="Ex: Chef de projet"
                    className={inputClass}
                    value={exp.position}
                    onChange={(e) => updateExperience(exp.id, 'position', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={`cv-exp-${idx}-company`} className={labelClass}>Entreprise</label>
                  <input
                    id={`cv-exp-${idx}-company`}
                    type="text"
                    placeholder="Ex: Orange Côte d'Ivoire"
                    className={inputClass}
                    value={exp.company}
                    onChange={(e) => updateExperience(exp.id, 'company', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`cv-exp-${idx}-period`} className={labelClass}>Période</label>
                  <input
                    id={`cv-exp-${idx}-period`}
                    type="text"
                    placeholder="Ex: Jan 2022 - Aujourd'hui"
                    className={inputClass}
                    value={exp.period}
                    onChange={(e) => updateExperience(exp.id, 'period', e.target.value)}
                  />
                </div>
              </div>
              <div className="relative">
                <label htmlFor={`cv-exp-${idx}-description`} className={labelClass}>Description</label>
                <textarea
                  id={`cv-exp-${idx}-description`}
                  rows={3}
                  placeholder="Décrivez vos missions..."
                  className={inputClass + ' pr-32 resize-none'}
                  value={exp.description}
                  onChange={(e) => updateExperience(exp.id, 'description', e.target.value)}
                />
                <button
                  onClick={() => optimizeText(exp.description, `exp-${exp.id}`)}
                  disabled={optimizingField === `exp-${exp.id}` || !exp.description.trim()}
                  className="absolute top-7 right-2.5 px-3 py-1.5 rounded-lg bg-gradient-to-r from-brand to-brand text-white text-xs font-bold shadow-sm disabled:opacity-60 disabled:cursor-not-allowed hover:brightness-110 transition-all inline-flex items-center gap-1.5"
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

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <div className="flex items-center justify-between mb-4">
          <h2 className={sectionTitleClass + ' mb-0'}>
            <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-primary dark:text-brand-accent flex items-center justify-center text-base">🎓</span>
            Formations
          </h2>
          <button onClick={addEducation} className={btnSecondary}>
            <span className="text-base leading-none">+</span> Ajouter
          </button>
        </div>
        <p className="mb-4 text-xs text-black dark:text-white">
          Indiquez le diplôme le plus récent en premier, puis les formations
          précédentes.
        </p>
        <div className="space-y-4">
          {cvData.educations.length === 0 && (
            <p className="text-sm text-black dark:text-white text-center py-6 border-2 border-dashed border-line dark:border-slate-700 rounded-xl">
              Aucune formation ajoutée. Cliquez sur "Ajouter" pour commencer.
            </p>
          )}
          {cvData.educations.map((edu, idx) => (
            <div key={edu.id} className="border border-line dark:border-slate-800 rounded-xl p-4 bg-brand-soft/40 dark:bg-slate-800/30">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs font-bold uppercase tracking-wider text-black dark:text-white">
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
                  <label htmlFor={`cv-edu-${idx}-degree`} className={labelClass}>Diplôme</label>
                  <input
                    id={`cv-edu-${idx}-degree`}
                    type="text"
                    placeholder="Ex: Master en Informatique"
                    className={inputClass}
                    value={edu.degree}
                    onChange={(e) => updateEducation(edu.id, 'degree', e.target.value)}
                  />
                </div>
                <div>
                  <label htmlFor={`cv-edu-${idx}-school`} className={labelClass}>École / Université</label>
                  <input
                    id={`cv-edu-${idx}-school`}
                    type="text"
                    placeholder="Ex: INP-HB"
                    className={inputClass}
                    value={edu.school}
                    onChange={(e) => updateEducation(edu.id, 'school', e.target.value)}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor={`cv-edu-${idx}-year`} className={labelClass}>Année</label>
                  <input
                    id={`cv-edu-${idx}-year`}
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

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-primary dark:text-brand-accent flex items-center justify-center text-base">⚡</span>
          Compétences
        </h2>
        <p className="mb-4 text-xs text-black dark:text-white">
          Ajoutez 6 à 10 compétences : outils, savoir-faire métier et qualités
          utiles pour le poste.
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {cvData.skills.map((skill) => (
            <span
              key={skill}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20"
            >
              {skill}
              <button
                onClick={() => removeSkill(skill)}
                aria-label={`Supprimer la compétence ${skill}`}
                className="ml-1 text-primary/60 hover:text-primary font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="cv-skill-input"
          type="text"
          aria-label="Ajouter une compétence"
          placeholder="Tapez une compétence puis appuyez sur Entrée (ex: Microsoft Office, Gestion de projet...)"
          className={inputClass}
          value={skillInput}
          onChange={(e) => setSkillInput(e.target.value)}
          onKeyDown={handleSkillKeyDown}
          onBlur={() => skillInput && addSkill(skillInput)}
        />
        <p className="text-xs text-black dark:text-white mt-2">
          Appuyez sur Entrée ou , pour ajouter une compétence
        </p>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-primary dark:text-brand-accent flex items-center justify-center">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <circle cx="12" cy="12" r="9" />
              <path d="M3 12h18M12 3a14.5 14.5 0 0 1 0 18 14.5 14.5 0 0 1 0-18Z" />
            </svg>
          </span>
          Langues
        </h2>
        <p className="mb-4 text-xs text-black dark:text-white">
          Indiquez vos langues et votre niveau (ex : Français courant, Anglais professionnel).
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {cvData.languages.map((language) => (
            <span
              key={language}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20"
            >
              {language}
              <button
                type="button"
                onClick={() => removeLanguage(language)}
                aria-label={`Supprimer la langue ${language}`}
                className="ml-1 text-primary/60 hover:text-primary font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="cv-language-input"
          type="text"
          aria-label="Ajouter une langue"
          placeholder="Tapez une langue puis appuyez sur Entrée"
          className={inputClass}
          value={languageInput}
          onChange={(e) => setLanguageInput(e.target.value)}
          onKeyDown={handleLanguageKeyDown}
        />
        <p className="text-xs text-black dark:text-white mt-2">
          Appuyez sur Entrée ou , pour ajouter une langue
        </p>
      </section>

      <section className="bg-white dark:bg-slate-900 rounded-2xl border border-line dark:border-slate-800 p-6 shadow-sm">
        <h2 className={sectionTitleClass}>
          <span className="w-8 h-8 rounded-lg bg-brand-soft dark:bg-brand/15 text-primary dark:text-brand-accent flex items-center justify-center">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="m12 3 2.8 5.7 6.2.9-4.5 4.4 1.1 6.2-5.6-2.9-5.6 2.9 1.1-6.2L3 9.6l6.2-.9L12 3Z" />
            </svg>
          </span>
          Centres d&apos;intérêt
        </h2>
        <p className="mb-4 text-xs text-black dark:text-white">
          Ajoutez 2 à 4 activités qui montrent votre personnalité (sport, bénévolat, lecture...).
        </p>
        <div className="flex flex-wrap gap-2 mb-3">
          {cvData.interests.map((interest) => (
            <span
              key={interest}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-primary/10 text-primary text-sm font-semibold border border-primary/20"
            >
              {interest}
              <button
                type="button"
                onClick={() => removeInterest(interest)}
                aria-label={`Supprimer le centre d'intérêt ${interest}`}
                className="ml-1 text-primary/60 hover:text-primary font-bold leading-none"
              >
                ×
              </button>
            </span>
          ))}
        </div>
        <input
          id="cv-interest-input"
          type="text"
          aria-label="Ajouter un centre d'intérêt"
          placeholder="Tapez un centre d'intérêt puis appuyez sur Entrée"
          className={inputClass}
          value={interestInput}
          onChange={(e) => setInterestInput(e.target.value)}
          onKeyDown={handleInterestKeyDown}
        />
        <p className="text-xs text-black dark:text-white mt-2">
          Appuyez sur Entrée ou , pour ajouter un centre d&apos;intérêt
        </p>
      </section>
    </div>
  );
}
