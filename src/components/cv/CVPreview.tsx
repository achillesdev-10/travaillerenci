'use client';

import type { CVData } from '@/types/cv';
import { getSiteHostname } from '@/lib/site';

interface CVPreviewProps {
  cvData: CVData;
}

export default function CVPreview({ cvData }: CVPreviewProps) {
  return (
    <div id="cv-preview" className="bg-white shadow-2xl mx-auto overflow-hidden" style={{ width: '210mm', minHeight: '297mm', fontFamily: "'Inter', 'Helvetica Neue', Arial, sans-serif" }}>
      <style>{`
        @media print {
          body { background: white !important; }
          #cv-preview { box-shadow: none !important; }
        }
      `}</style>

      <div className="flex min-h-[297mm]">
        {/* Sidebar gauche */}
        <aside className="w-[72mm] shrink-0 bg-[#1a2744] text-white p-[14mm_6mm_14mm_8mm]">
          {/* Photo + Nom */}
          <div className="text-center mb-8">
            {cvData.photoUrl ? (
              <div className="w-24 h-24 mx-auto mb-4 rounded-full overflow-hidden border-[3px] border-white/20 shadow-lg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={cvData.photoUrl}
                  alt={`Photo de ${cvData.fullName || 'profil'}`}
                  crossOrigin={cvData.photoUrl.startsWith('http') ? 'anonymous' : undefined}
                  className="w-full h-full object-cover"
                />
              </div>
            ) : (
              <div className="w-24 h-24 mx-auto mb-4 rounded-full bg-white/10 flex items-center justify-center text-3xl font-bold border-[3px] border-white/20">
                {(cvData.fullName || '?').charAt(0).toUpperCase()}
              </div>
            )}
            <h1 className="text-[15px] font-bold tracking-wide leading-tight uppercase">
              {cvData.fullName || 'Votre Nom'}
            </h1>
            <p className="text-[10px] text-emerald-300 font-semibold mt-1 uppercase tracking-[0.15em]">
              {cvData.jobTitle || 'Titre du poste'}
            </p>
          </div>

          {/* Contact */}
          <SectionTitle icon={
            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
          } label="Contact" />
          <div className="space-y-2.5 mb-8">
            {cvData.email && (
              <SidebarItem icon={
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              }>
                <span className="break-all">{cvData.email}</span>
              </SidebarItem>
            )}
            {cvData.phone && (
              <SidebarItem icon={
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 5a2 2 0 012-2h3.28a1 1 0 01.948.684l1.498 4.493a1 1 0 01-.502 1.21l-2.257 1.13a11.042 11.042 0 005.516 5.516l1.13-2.257a1 1 0 011.21-.502l4.493 1.498a1 1 0 01.684.949V19a2 2 0 01-2 2h-1C9.716 21 3 14.284 3 6V5z" /></svg>
              }>
                {cvData.phone}
              </SidebarItem>
            )}
            {cvData.city && (
              <SidebarItem icon={
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17.657 16.657L13.414 20.9a1.998 1.998 0 01-2.827 0l-4.244-4.243a8 8 0 1111.314 0z" /><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 11a3 3 0 11-6 0 3 3 0 016 0z" /></svg>
              }>
                {cvData.city}
              </SidebarItem>
            )}
          </div>

          {/* Compétences */}
          {cvData.skills.length > 0 && (
            <>
              <SectionTitle icon={
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" /></svg>
              } label="Compétences" />
              <div className="flex flex-wrap gap-1.5 mb-8">
                {cvData.skills.map((skill) => (
                  <span
                    key={skill}
                    className="px-2.5 py-1 rounded-full bg-white/10 text-[9px] font-medium text-white/90 border border-white/10"
                  >
                    {skill}
                  </span>
                ))}
              </div>
            </>
          )}
        </aside>

        {/* Contenu principal */}
        <main className="flex-1 p-[14mm_14mm_14mm_10mm]">
          {/* Accroche */}
          {cvData.summary && (
            <section className="mb-7">
              <SectionTitleDark label="Profil" icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>
              } />
              <p className="text-[11px] text-gray-600 leading-relaxed mt-2 whitespace-pre-wrap">
                {cvData.summary}
              </p>
            </section>
          )}

          {/* Expériences */}
          {cvData.experiences.length > 0 && (
            <section className="mb-7">
              <SectionTitleDark label="Expériences professionnelles" icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>
              } />
              <div className="space-y-4 mt-2">
                {cvData.experiences.map((exp, idx) => (
                  <div key={exp.id} className="relative pl-4 border-l-2 border-[#1a2744]/20">
                    <div className="absolute -left-[5px] top-0.5 w-2 h-2 rounded-full bg-[#1a2744]" />
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <h3 className="text-[12px] font-bold text-gray-900 leading-tight">
                          {exp.position || 'Poste'}
                        </h3>
                        <p className="text-[11px] font-semibold text-[#1a2744]">
                          {exp.company || 'Entreprise'}
                        </p>
                      </div>
                      <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5">
                        {exp.period}
                      </span>
                    </div>
                    {exp.description && (
                      <p className="mt-1.5 text-[10px] text-gray-600 leading-relaxed whitespace-pre-wrap">
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
            <section className="mb-7">
              <SectionTitleDark label="Formation" icon={
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path d="M12 14l9-5-9-5-9 5 9 5z" /><path d="M12 14l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z" /></svg>
              } />
              <div className="space-y-3 mt-2">
                {cvData.educations.map((edu) => (
                  <div key={edu.id} className="flex items-start justify-between gap-3">
                    <div>
                      <h3 className="text-[11px] font-bold text-gray-900">
                        {edu.degree || 'Diplôme'}
                      </h3>
                      <p className="text-[10px] text-gray-500">{edu.school || 'École'}</p>
                    </div>
                    <span className="text-[9px] font-semibold text-gray-400 bg-gray-50 px-2 py-0.5 rounded-full whitespace-nowrap mt-0.5">
                      {edu.year}
                    </span>
                  </div>
                ))}
              </div>
            </section>
          )}

          <footer className="mt-auto pt-6 border-t border-gray-100">
            <p className="text-[8px] text-gray-300 text-center">
              CV généré via <span className="font-semibold text-gray-400">{getSiteHostname()}</span>
            </p>
          </footer>
        </main>
      </div>
    </div>
  );
}

/* Sous-composants internes pour la sidebar et le contenu */

function SectionTitle({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.18em] text-white/60 mb-3 pb-2 border-b border-white/10">
      {icon}
      {label}
    </h2>
  );
}

function SidebarItem({ icon, children }: { icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-2 text-[9.5px] text-white/80 leading-snug">
      <span className="mt-0.5 shrink-0 text-emerald-300/70">{icon}</span>
      <span>{children}</span>
    </div>
  );
}

function SectionTitleDark({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <h2 className="flex items-center gap-2 text-[12px] font-extrabold uppercase tracking-wider text-[#1a2744] border-b-2 border-[#1a2744] pb-2">
      {icon}
      {label}
    </h2>
  );
}
