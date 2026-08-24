'use client';

import type { CVData } from '@/types/cv';
import { getSiteHostname } from '@/lib/site';

interface CVPreviewProps {
  cvData: CVData;
}

export default function CVPreview({ cvData }: CVPreviewProps) {
  return (
    <div id="cv-preview" className="bg-white shadow-2xl mx-auto" style={{ width: '210mm', minHeight: '297mm', padding: '18mm 16mm' }}>
      <style>{`
        @media print {
          body { background: white !important; }
          #cv-preview { box-shadow: none !important; }
        }
      `}</style>

      <header className="mb-6 pb-5 border-b-2 border-gray-900">
        <div className="flex items-start justify-between gap-6">
          <div className="min-w-0 flex-1">
            <h1 className="text-3xl font-black text-gray-900 tracking-tight font-[var(--font-display)]">
              {cvData.fullName || 'Votre Nom Complet'}
            </h1>
            <p className="mt-1.5 text-lg font-semibold text-primary">
              {cvData.jobTitle || 'Titre du poste recherché'}
            </p>
            <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1.5 text-sm text-gray-700">
              {cvData.email && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                  </svg>
                  {cvData.email}
                </span>
              )}
              {cvData.phone && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" />
                  </svg>
                  {cvData.phone}
                </span>
              )}
              {cvData.city && (
                <span className="inline-flex items-center gap-1.5">
                  <svg className="w-3.5 h-3.5 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" />
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                  {cvData.city}
                </span>
              )}
            </div>
          </div>

          {cvData.photoUrl && (
            <div className="shrink-0">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cvData.photoUrl}
                alt={`Photo de ${cvData.fullName || 'profil'}`}
                crossOrigin={
                  cvData.photoUrl.startsWith('http') ? 'anonymous' : undefined
                }
                className="w-28 h-28 rounded-full object-cover border-[3px] border-gray-900"
              />
            </div>
          )}
        </div>
      </header>

      {cvData.summary && (
        <section className="mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Profil
          </h2>
          <p className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
            {cvData.summary}
          </p>
        </section>
      )}

      {cvData.experiences.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Expériences professionnelles
          </h2>
          <div className="space-y-4">
            {cvData.experiences.map((exp) => (
              <div key={exp.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 className="text-base font-bold text-gray-900">
                      {exp.position || 'Poste'}
                    </h3>
                    <p className="text-sm font-semibold text-primary">
                      {exp.company || 'Entreprise'}
                    </p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {exp.period}
                  </span>
                </div>
                {exp.description && (
                  <p className="mt-1.5 text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">
                    {exp.description}
                  </p>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {cvData.educations.length > 0 && (
        <section className="mb-6">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Formation
          </h2>
          <div className="space-y-3">
            {cvData.educations.map((edu) => (
              <div key={edu.id}>
                <div className="flex items-baseline justify-between gap-3">
                  <div>
                    <h3 className="text-sm font-bold text-gray-900">
                      {edu.degree || 'Diplôme'}
                    </h3>
                    <p className="text-sm text-gray-600">{edu.school || 'École'}</p>
                  </div>
                  <span className="text-xs font-semibold text-gray-500 whitespace-nowrap">
                    {edu.year}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </section>
      )}

      {cvData.skills.length > 0 && (
        <section className="mb-2">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-900 border-b border-gray-200 pb-2 mb-3">
            Compétences
          </h2>
          <div className="flex flex-wrap gap-2">
            {cvData.skills.map((skill) => (
              <span
                key={skill}
                className="px-2.5 py-1 rounded-md bg-gray-100 text-gray-800 text-xs font-semibold border border-gray-200"
              >
                {skill}
              </span>
            ))}
          </div>
        </section>
      )}

      <footer className="mt-10 pt-4 border-t border-gray-100 text-center">
        <p className="text-xs text-gray-400">
          CV généré via <span className="font-semibold">{getSiteHostname()}</span>
        </p>
      </footer>
    </div>
  );
}
