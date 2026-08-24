'use client';

import type { CVData } from '@/types/cv';
import { getSiteHostname } from '@/lib/site';

interface CVPreviewProps {
  cvData: CVData;
}

export default function CVPreview({ cvData }: CVPreviewProps) {
  return (
    <div
      id="cv-preview"
      className="bg-white shadow-2xl mx-auto"
      style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          #cv-preview { box-shadow: none !important; }
        }
      `}</style>

      {/* ── En-tête coloré ── */}
      <header className="bg-[#1a2744] text-white px-[18mm] pt-[16mm] pb-[12mm]">
        <div className="flex items-start gap-6">
          {cvData.photoUrl ? (
            <div className="shrink-0 w-20 h-20 rounded-full overflow-hidden border-[3px] border-white/20 shadow-lg">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={cvData.photoUrl}
                alt={`Photo de ${cvData.fullName || 'profil'}`}
                crossOrigin={cvData.photoUrl.startsWith('http') ? 'anonymous' : undefined}
                className="w-full h-full object-cover"
              />
            </div>
          ) : (
            <div className="shrink-0 w-20 h-20 rounded-full bg-white/10 flex items-center justify-center text-2xl font-bold border-[3px] border-white/20">
              {(cvData.fullName || '?').charAt(0).toUpperCase()}
            </div>
          )}
          <div className="min-w-0 flex-1">
            <h1 className="text-[22px] font-extrabold tracking-tight leading-tight">
              {cvData.fullName || 'Votre Nom Complet'}
            </h1>
            <p className="text-[13px] font-semibold text-emerald-300 mt-1 uppercase tracking-[0.12em]">
              {cvData.jobTitle || 'Titre du poste recherché'}
            </p>
            <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11px] text-white/70">
              {cvData.email && <span>{cvData.email}</span>}
              {cvData.phone && <span>{cvData.phone}</span>}
              {cvData.city && <span>{cvData.city}</span>}
            </div>
          </div>
        </div>
      </header>

      {/* ── Corps ── */}
      <div className="px-[18mm] py-[10mm]">

        {/* Profil */}
        {cvData.summary && (
          <section className="mb-6">
            <SectionTitle label="Profil" />
            <p className="text-[11px] text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">
              {cvData.summary}
            </p>
          </section>
        )}

        {/* Expériences */}
        {cvData.experiences.length > 0 && (
          <section className="mb-6">
            <SectionTitle label="Expériences professionnelles" />
            <div className="space-y-4 mt-2">
              {cvData.experiences.map((exp) => (
                <div key={exp.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="text-[12px] font-bold text-gray-900 leading-tight">
                        {exp.position || 'Poste'}
                      </h3>
                      <p className="text-[11px] font-semibold text-[#1a2744]">
                        {exp.company || 'Entreprise'}
                      </p>
                    </div>
                    <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 shrink-0">
                      {exp.period}
                    </span>
                  </div>
                  {exp.description && (
                    <p className="mt-1.5 text-[10.5px] text-gray-600 leading-relaxed whitespace-pre-wrap">
                      {exp.description}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Formations */}
        {cvData.educations.length > 0 && (
          <section className="mb-6">
            <SectionTitle label="Formation" />
            <div className="space-y-3 mt-2">
              {cvData.educations.map((edu) => (
                <div key={edu.id} className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h3 className="text-[11px] font-bold text-gray-900">
                      {edu.degree || 'Diplôme'}
                    </h3>
                    <p className="text-[10px] text-gray-500">{edu.school || 'École'}</p>
                  </div>
                  <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5 shrink-0">
                    {edu.year}
                  </span>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* Compétences */}
        {cvData.skills.length > 0 && (
          <section className="mb-4">
            <SectionTitle label="Compétences" />
            <div className="flex flex-wrap gap-1.5 mt-2">
              {cvData.skills.map((skill) => (
                <span
                  key={skill}
                  className="px-2.5 py-1 rounded-full bg-[#1a2744]/8 text-[10px] font-semibold text-[#1a2744] border border-[#1a2744]/15"
                >
                  {skill}
                </span>
              ))}
            </div>
          </section>
        )}
      </div>

      {/* ── Footer ── */}
      <div className="px-[18mm] pb-[10mm] mt-auto">
        <div className="border-t border-gray-100 pt-3 text-center">
          <p className="text-[8px] text-gray-300">
            CV généré via <span className="font-semibold text-gray-400">{getSiteHostname()}</span>
          </p>
        </div>
      </div>
    </div>
  );
}

/* ── Sous-composant ── */
function SectionTitle({ label }: { label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.14em] text-[#1a2744] border-b-2 border-[#1a2744] pb-1.5">
      {label}
    </h2>
  );
}
