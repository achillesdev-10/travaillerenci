'use client';

import type { CVData } from '@/types/cv';
import { getSiteHostname } from '@/lib/site';
import CVIllustration from './CVIllustration';

interface CVPreviewProps {
  cvData: CVData;
}

export default function CVPreview({ cvData }: CVPreviewProps) {
  const hasContact = Boolean(cvData.email || cvData.phone || cvData.city);

  return (
    <div
      data-cv-preview=""
      className="mx-auto flex flex-col bg-white shadow-2xl"
      style={{
        width: '210mm',
        minHeight: '297mm',
        fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif",
      }}
    >
      <style>{`
        @media print {
          body { background: white !important; }
          #cv-preview { box-shadow: none !important; }
        }
      `}</style>

      <header className="relative overflow-hidden bg-[#111827] px-[16mm] pb-[10mm] pt-[14mm] text-white">
        <div className="absolute -right-10 -top-12 h-44 w-44 rounded-full bg-[#f97316]/20" aria-hidden="true" />
        <div className="absolute -bottom-16 right-20 h-36 w-36 rounded-full bg-[#f97316]/10" aria-hidden="true" />
        <div className="relative flex items-center gap-6">
          <CVIllustration className="h-28 w-28 shrink-0 rounded-2xl ring-2 ring-white/20" />
          <div className="min-w-0 flex-1">
            <p className="text-[8.5px] font-bold uppercase tracking-[0.32em] text-[#fb923c]">
              Curriculum Vitae
            </p>
            <h1 className="mt-1 break-words text-[26px] font-black leading-none tracking-tight">
              {cvData.fullName || 'Votre Nom Complet'}
            </h1>
            <p className="mt-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-[#fdba74]">
              {cvData.jobTitle || 'Titre du poste recherché'}
            </p>
            {hasContact && (
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[9.5px] text-white/80">
                {cvData.email && <span>{cvData.email}</span>}
                {cvData.phone && <span>{cvData.phone}</span>}
                {cvData.city && <span>{cvData.city}</span>}
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 gap-[8mm] px-[16mm] py-[10mm]">
        <aside className="w-[54mm] shrink-0 border-r border-[#e5e7eb] pr-[6mm]">
          {cvData.skills.length > 0 && (
            <section>
              <SectionTitle label="Compétences" />
              <div className="mt-3 flex flex-wrap gap-1.5">
                {cvData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="rounded-md border border-[#fed7aa] bg-[#fff7ed] px-2 py-1 text-[9px] font-semibold leading-none text-[#9a3412]"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </section>
          )}

          <section className="mt-7">
            <SectionTitle label="Contact" />
            <div className="mt-3 space-y-2 text-[9.5px] leading-relaxed text-[#374151]">
              {cvData.email && (
                <p>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                    Email
                  </span>
                  <span className="break-all">{cvData.email}</span>
                </p>
              )}
              {cvData.phone && (
                <p>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                    Téléphone
                  </span>
                  <span>{cvData.phone}</span>
                </p>
              )}
              {cvData.city && (
                <p>
                  <span className="block text-[8px] font-bold uppercase tracking-[0.12em] text-[#9ca3af]">
                    Localisation
                  </span>
                  <span>{cvData.city}</span>
                </p>
              )}
            </div>
          </section>

          <div className="mt-7 rounded-xl border border-[#fed7aa] bg-[#fff7ed] p-3">
            <p className="text-[8px] font-extrabold uppercase tracking-[0.14em] text-[#9a3412]">
              Conseil
            </p>
            <p className="mt-1 text-[9px] leading-relaxed text-[#7c2d12]">
              Adaptez votre accroche et vos expériences à chaque offre pour retenir
              l&apos;attention du recruteur.
            </p>
          </div>
        </aside>

        <div className="min-w-0 flex-1">
          {cvData.summary && (
            <section className="mb-6">
              <SectionTitle label="Profil" />
              <p className="mt-2 whitespace-pre-wrap rounded-r-xl border-l-4 border-[#f97316] bg-[#fff7ed] px-4 py-3 text-[10.5px] leading-relaxed text-[#374151]">
                {cvData.summary}
              </p>
            </section>
          )}

          {cvData.experiences.length > 0 && (
            <section className="mb-6">
              <SectionTitle label="Expériences professionnelles" />
              <div className="mt-3 space-y-5">
                {cvData.experiences.map((exp) => (
                  <article
                    key={exp.id}
                    className="relative break-inside-avoid border-l-2 border-[#fed7aa] pl-3"
                  >
                    <span className="absolute -left-[4px] top-1.5 h-1.5 w-1.5 rounded-full bg-[#f97316]" aria-hidden="true" />
                    <div className="flex items-baseline justify-between gap-3">
                      <div className="min-w-0">
                        <h3 className="text-[12px] font-extrabold leading-tight text-[#111827]">
                          {exp.position || 'Poste'}
                        </h3>
                        <p className="text-[10.5px] font-semibold text-[#c2410c]">
                          {exp.company || 'Entreprise'}
                        </p>
                      </div>
                      <span className="shrink-0 whitespace-nowrap text-[9px] font-bold text-[#6b7280]">
                        {exp.period}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="mt-1.5 whitespace-pre-wrap text-[10px] leading-relaxed text-[#374151]">
                        {exp.description}
                      </p>
                    )}
                  </article>
                ))}
              </div>
            </section>
          )}

          {cvData.educations.length > 0 && (
            <section>
              <SectionTitle label="Formation" />
              <div className="mt-3 space-y-4">
                {cvData.educations.map((edu) => (
                  <div
                    key={edu.id}
                    className="flex items-baseline justify-between gap-3 break-inside-avoid border-b border-[#f3f4f6] pb-2 last:border-0 last:pb-0"
                  >
                    <div className="min-w-0">
                      <h3 className="text-[11.5px] font-extrabold leading-tight text-[#111827]">
                        {edu.degree || 'Diplôme'}
                      </h3>
                      <p className="text-[10px] text-[#4b5563]">{edu.school || 'École'}</p>
                    </div>
                    <span className="shrink-0 whitespace-nowrap text-[9px] font-bold text-[#6b7280]">
                      {edu.year}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      </div>

      <footer className="px-[16mm] pb-[8mm]">
        <div className="flex items-center justify-between border-t border-[#e5e7eb] pt-2 text-[8px] text-[#9ca3af]">
          <span>
            CV généré via{' '}
            <span className="font-bold text-[#4b5563]">{getSiteHostname()}</span>
          </span>
          <span>Document confidentiel</span>
        </div>
      </footer>
    </div>
  );
}

function SectionTitle({ label }: { label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[10px] font-extrabold uppercase tracking-[0.16em] text-[#111827]">
      <span className="h-2 w-2 rounded-sm bg-[#f97316]" aria-hidden="true" />
      {label}
    </h2>
  );
}
