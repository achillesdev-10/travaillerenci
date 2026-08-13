'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { LOCAL_IMAGES } from '@/lib/images';
import type { CVData } from '@/types/cv';
import { createEmptyCV, createEmptyExperience, createEmptyEducation } from '@/types/cv';
import dynamic from 'next/dynamic';
import { useLocalStorage } from '@/hooks';

const CVFormDynamic = dynamic(() => import('@/components/cv/CVForm'), { ssr: false });
const CVPreviewDynamic = dynamic(() => import('@/components/cv/CVPreview'), { ssr: false });

/** Largeur naturelle du CV A4 en px (@96dpi : 210mm ≈ 794px). */
const PREVIEW_WIDTH_PX = 794;

const sampleCV: CVData = {
  fullName: 'KOUASSI Jean-Paul',
  jobTitle: 'Développeur Full-Stack Senior',
  email: 'jeanpaul.kouassi@email.ci',
  phone: '+225 07 12 34 56 78',
  city: 'Abidjan, Cocody',
  summary:
    "Développeur Full-Stack passionné avec 6+ années d'expérience dans la conception et le déploiement d'applications web modernes en Côte d'Ivoire. Spécialisé dans les écosystèmes React / Node.js et Java / Spring Boot, j'accompagne les entreprises locales dans leur transformation numérique avec des solutions robustes, scalables et adaptées au marché africain.",
  experiences: [
    {
      id: '1',
      position: 'Développeur Full-Stack Senior',
      company: 'Orange Digital Center Côte d\'Ivoire',
      period: 'Mars 2023 - Aujourd\'hui',
      description:
        "Piloter le développement d'une plateforme de services bancaires mobiles utilisée par +200 000 utilisateurs. Concevoir l'architecture microservices (Spring Boot + Node.js) et superviser une équipe de 5 développeurs juniors. Optimiser les performances APIs qui a réduit la latence moyenne de 40%.",
    },
    {
      id: '2',
      position: 'Développeur Frontend React',
      company: 'MTN Côte d\'Ivoire',
      period: 'Juin 2020 - Février 2023',
      description:
        "Concevoir et déployer les tableaux de bord d'analyse de données pour le département Marketing. Implémenter +30 interfaces réactives avec Next.js et Tailwind CSS. Automatiser les tests E2E avec Cypress, améliorant la qualité de livraison de 60%.",
    },
  ],
  educations: [
    {
      id: '1',
      degree: 'Master en Génie Logiciel',
      school: 'Institut National Polytechnique Félix Houphouët-Boigny (INP-HB)',
      year: '2018 - 2020',
    },
    {
      id: '2',
      degree: 'Licence en Informatique',
      school: 'Université Félix Houphouët-Boigny',
      year: '2015 - 2018',
    },
  ],
  skills: [
    'TypeScript',
    'React / Next.js',
    'Node.js / Express',
    'Java / Spring Boot',
    'PostgreSQL',
    'MongoDB',
    'Docker',
    'AWS',
    'Gestion de projet',
    'Travail d\'équipe',
  ],
};

export default function CVGeneratorPage() {
  const [cvData, setCVData] = useLocalStorage<CVData>('travaillerenci_cv_data', createEmptyCV());
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [isExporting, setIsExporting] = useState(false);
  const [hydrated, setHydrated] = useState(false);
  const [saveState, setSaveState] = useState<'idle' | 'saving' | 'saved'>('idle');
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Aperçu mobile : mise à l'échelle mesurée (scale-to-fit) pour que le CV A4
  // soit toujours entièrement visible et scrollable, quelle que soit la largeur
  // de l'écran (le transform doit être accompagné d'une boîte aux dimensions
  // compensées, sinon l'aperçu est tronqué / mal positionné sur mobile).
  const previewShellRef = useRef<HTMLDivElement | null>(null);
  const previewInnerRef = useRef<HTMLDivElement | null>(null);
  // Échelle initiale calculée dès le premier rendu (largeur de la fenêtre)
  // pour éviter un débordement horizontal avant le recalage ResizeObserver.
  const [previewScale, setPreviewScale] = useState(() => {
    if (typeof window === 'undefined') return 1;
    return Math.min(1, (window.innerWidth - 48) / PREVIEW_WIDTH_PX);
  });
  const [previewSize, setPreviewSize] = useState({ width: PREVIEW_WIDTH_PX, height: 0 });

  useEffect(() => {
    setCVData((prev) => {
      // Les blob: URLs (aperçu local quand Supabase n'est pas configuré) ne
      // survivent pas à un rechargement : on les retire pour éviter une image
      // cassée. Les URL Supabase publiques, elles, restent valides.
      const cleaned = prev.photoUrl?.startsWith('blob:')
        ? { ...prev, photoUrl: '' }
        : prev;

      const isEmpty =
        !cleaned.fullName &&
        !cleaned.jobTitle &&
        !cleaned.email &&
        !cleaned.phone &&
        !cleaned.city &&
        !cleaned.summary &&
        cleaned.experiences.length === 0 &&
        cleaned.educations.length === 0 &&
        cleaned.skills.length === 0 &&
        !cleaned.photoUrl;

      // Première visite (rien en mémoire locale) : charger un CV d'exemple.
      if (isEmpty) {
        return {
          ...sampleCV,
          experiences: sampleCV.experiences.map((e) => ({ ...e, id: crypto.randomUUID() })),
          educations: sampleCV.educations.map((e) => ({ ...e, id: crypto.randomUUID() })),
        };
      }
      return cleaned;
    });
    setHydrated(true);
  }, [setCVData]);

  // Indicateur « sauvegardé » : feedback après chaque modification du CV.
  useEffect(() => {
    if (!hydrated) return;
    setSaveState('saving');
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => setSaveState('saved'), 450);
  }, [cvData, hydrated]);

  useEffect(() => {
    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, []);

  // Recale l'échelle et la hauteur de la zone d'aperçu dès que la largeur du
  // conteneur ou le contenu du CV change (aperçu temps réel mobile + bureau).
  useEffect(() => {
    const shell = previewShellRef.current;
    const inner = previewInnerRef.current;
    if (!shell || !inner) return;

    const update = () => {
      const available = shell.clientWidth;
      const scale = Math.min(1, available / PREVIEW_WIDTH_PX);
      setPreviewScale(scale);
      setPreviewSize({
        width: Math.round(PREVIEW_WIDTH_PX * scale),
        height: Math.round(inner.offsetHeight * scale),
      });
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(shell);
    observer.observe(inner);
    return () => observer.disconnect();
  }, [hydrated, cvData]);

  const exportPDF = async () => {
    setIsExporting(true);
    try {
      // Précharger la photo de profil (URL publique Supabase) pour garantir
      // son rendu dans le PDF — html2canvas re-déclenche le téléchargement
      // avec CORS, la mise en cache évite les images manquantes.
      if (cvData.photoUrl) {
        await new Promise<void>((resolve) => {
          const img = new window.Image();
          img.onload = () => resolve();
          img.onerror = () => resolve();
          img.crossOrigin = 'anonymous';
          img.src = cvData.photoUrl!;
        });
      }

      const html2pdfModule = await import('html2pdf.js');
      const html2pdf = html2pdfModule.default;
      const element = document.getElementById('cv-preview');
      if (!element) throw new Error('Aperçu CV introuvable.');

      const opt = {
        margin: 0 as any,
        filename: `CV_${cvData.fullName.replace(/\s+/g, '_') || 'travaillerenci'}.pdf`,
        image: { type: 'jpeg' as const, quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, letterRendering: true },
        jsPDF: { unit: 'mm' as const, format: 'a4' as const, orientation: 'portrait' as const },
      };
      await html2pdf().set(opt as any).from(element).save();
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  const resetCV = () => {
    if (window.confirm('Réinitialiser tout le CV ? Les données actuelles seront perdues.')) {
      setCVData({
        ...createEmptyCV(),
        experiences: [createEmptyExperience()],
        educations: [createEmptyEducation()],
      });
    }
  };

  return (
    <main className="min-h-screen bg-slate-50 dark:bg-slate-950">
      <section className="relative overflow-hidden border-b border-gray-100 dark:border-slate-800 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-10 md:py-14 relative">
          <div className="grid lg:grid-cols-[1fr_420px] lg:items-center gap-8">
            <div>
              <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-emerald-100 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300 text-xs font-bold mb-4 border border-emerald-200/60 dark:border-emerald-800/40">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M9 3h6M10 3v4a2 2 0 0 1-2 2H4M14 3v4a2 2 0 0 0 2 2h4M5 3h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM19 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2ZM12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 19c0-1.5 1.8-3 4-3s4 1.5 4 3" />
                </svg>
                Propulsé par l'IA — Optimisé pour la Côte d'Ivoire
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-gray-900 dark:text-white font-[var(--font-display)]">
                Générateur de CV IA —{' '}
                <span className="text-primary">travaillerenci</span>
              </h1>
              <p className="mt-3 text-gray-600 dark:text-gray-300 text-base md:text-lg leading-relaxed">
                Créez un CV professionnel en quelques minutes. Optimisez votre contenu avec l'IA
                pour maximiser vos chances auprès des recruteurs ivoiriens.
              </p>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/70 border border-gray-200 dark:border-slate-700 shadow-sm">
                {saveState === 'saving' ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sauvegarde…</span>
                  </>
                ) : saveState === 'saved' ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-emerald-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">Sauvegardé automatiquement</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-gray-400 dark:text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6M9 13h6M9 17h4" />
                    </svg>
                    <span className="text-xs font-semibold text-gray-500 dark:text-gray-400">Sauvegarde automatique</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={resetCV}
                className="px-4 py-2.5 rounded-xl border border-gray-200 dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-gray-700 dark:text-gray-200 hover:bg-gray-50 dark:hover:bg-slate-700 transition-all shadow-sm inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Réinitialiser
              </button>
              <button
                onClick={exportPDF}
                disabled={isExporting || !hydrated}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-emerald-500 text-white text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
              >
                {isExporting ? (
                  <>
                    <svg className="w-4.5 h-4.5 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    Génération du PDF...
                  </>
                ) : (
                  <>
                    <svg className="w-4.5 h-4.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Télécharger mon CV (PDF)
                  </>
                )}
              </button>
              </div>
            </div>
            {/* Illustration — bannière locale optimisée (desktop) */}
            <div className="hidden lg:block relative h-72 rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
              <Image
                src={LOCAL_IMAGES.cvGenerator}
                alt="Générateur de CV IA - travaillerenci"
                fill
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-emerald-950/60 via-transparent to-transparent" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      <section className="container mx-auto px-4 py-6 md:py-8">
        <div className="lg:hidden mb-5">
          <div className="inline-flex p-1.5 rounded-xl bg-gray-100 dark:bg-slate-800 w-full">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
                activeTab === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
              </svg>
              Éditer
            </button>
            <button
              onClick={() => setActiveTab('preview')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
                activeTab === 'preview'
                  ? 'bg-white dark:bg-slate-900 text-gray-900 dark:text-white shadow'
                  : 'text-gray-600 dark:text-gray-400'
              }`}
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
              </svg>
              Aperçu
            </button>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 lg:gap-8">
          <div className={`lg:col-span-5 ${activeTab === 'preview' ? 'hidden lg:block' : ''}`}>
            <div className="lg:sticky lg:top-24 overflow-y-auto max-h-[calc(100vh-8rem)] lg:pr-2 custom-scrollbar">
              {hydrated && <CVFormDynamic cvData={cvData} onChange={setCVData} />}
            </div>
          </div>

          <div className={`lg:col-span-7 ${activeTab === 'edit' ? 'hidden lg:block' : ''}`}>
            <div className="lg:sticky lg:top-24">
              <div className="bg-gray-100 dark:bg-slate-800/50 rounded-2xl p-3 md:p-6 border border-gray-200 dark:border-slate-800 shadow-inner">
                <div className="text-center text-xs text-gray-500 dark:text-gray-400 mb-3 font-semibold">
                  Format A4 — Aperçu en temps réel
                </div>
                <div
                  ref={previewShellRef}
                  className="overflow-auto max-h-[70vh] lg:max-h-[calc(100vh-14rem)] custom-scrollbar rounded-xl shadow-inner bg-slate-200/50 dark:bg-slate-900 p-4"
                >
                  {/* Boîte aux dimensions compensées : largeur/hauteur du CV
                      visuel réel. Sans elle, le transform scale() fait déborder
                      ou tronquer l'aperçu sur mobile. */}
                  <div
                    className="cv-scale-box mx-auto"
                    style={{
                      width: previewSize.width || PREVIEW_WIDTH_PX,
                      height: previewSize.height || undefined,
                    }}
                  >
                    <div
                      ref={previewInnerRef}
                      style={{
                        width: PREVIEW_WIDTH_PX,
                        transform: `scale(${previewScale})`,
                        transformOrigin: 'top left',
                      }}
                    >
                      {hydrated && <CVPreviewDynamic cvData={cvData} />}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar { width: 8px; height: 8px; }
        .custom-scrollbar::-webkit-scrollbar-track { background: transparent; }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(100,116,139,0.3);
          border-radius: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(100,116,139,0.5);
        }
        @media print {
          body * { visibility: hidden; }
          .cv-scale-box, .cv-scale-box > div {
            transform: none !important;
            width: auto !important;
            height: auto !important;
            overflow: visible !important;
          }
          #cv-preview, #cv-preview * { visibility: visible; }
          #cv-preview {
            position: absolute;
            left: 0; top: 0;
            width: 210mm;
            min-height: 297mm;
            padding: 18mm 16mm;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
