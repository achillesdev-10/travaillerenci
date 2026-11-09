'use client';

import Image from 'next/image';
import { useState, useEffect, useRef } from 'react';
import { LOCAL_IMAGES } from '@/lib/images';
import type { CVData } from '@/types/cv';
import {
  createEmptyCV,
  createEmptyExperience,
  createEmptyEducation,
  createSampleCV,
} from '@/types/cv';
import dynamic from 'next/dynamic';
import { useLocalStorage } from '@/hooks';

const CVFormDynamic = dynamic(() => import('@/components/cv/CVForm'), { ssr: false });
const CVPreviewDynamic = dynamic(() => import('@/components/cv/CVPreview'), { ssr: false });
const CoverLetterDynamic = dynamic(() => import('@/components/cv/CoverLetterGenerator'), { ssr: false });

/** Largeur naturelle du CV A4 en px (@96dpi : 210mm ≈ 794px). */
const PREVIEW_WIDTH_PX = 794;

export default function CVGeneratorPage() {
  const [cvData, setCVData] = useLocalStorage<CVData>('travaillerenci_cv_data', createSampleCV());
  const [activeTab, setActiveTab] = useState<'edit' | 'preview'>('edit');
  const [mode, setMode] = useState<'cv' | 'letter'>('cv');
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
      const isEmpty =
        !prev.fullName &&
        !prev.jobTitle &&
        !prev.email &&
        !prev.phone &&
        !prev.city &&
        !prev.summary &&
        prev.experiences.length === 0 &&
        prev.educations.length === 0 &&
        prev.skills.length === 0;

      if (isEmpty) return createSampleCV();
      return prev;
    });
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setHydrated(true);
  }, [setCVData]);

  // Indicateur « sauvegardé » : feedback après chaque modification du CV.
  useEffect(() => {
    if (!hydrated) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
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
      // Sur mobile, l'onglet Éditer est actif par défaut et le CV preview
      // est masqué via `hidden`. Pour garantir la capture, on bascule
      // temporairement sur l'onglet Aperçu, on attend le rendu, puis on
      // restaure l'état d'origine dans un finally.
      const wasOnEdit = activeTab === 'edit';
      if (wasOnEdit) {
        setActiveTab('preview');
        // Attendre que l'élément #cv-preview soit réellement présent et visible
        // dans le DOM (2 frames ne suffisent pas toujours sur mobile).
        await new Promise<void>((resolve) => {
          let tries = 0;
          const check = () => {
            const el = document.getElementById('cv-preview');
            if (el && el.offsetHeight > 0) return resolve();
            if (++tries > 30) return resolve(); // sécurité : max 500ms
            requestAnimationFrame(check);
          };
          requestAnimationFrame(check);
        });
      }

      const [{ default: html2canvas }, { jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      const element = document.getElementById('cv-preview');
      if (!element) throw new Error('Aperçu CV introuvable.');

      // Retirer temporairement le transform scale pour que html2canvas
      // capture le CV à sa taille réelle A4 (794px) et non à l'échelle réduite.
      const originalTransform = element.style.transform;
      const originalTransformOrigin = element.style.transformOrigin;
      element.style.transform = 'none';
      element.style.transformOrigin = 'top left';

      try {
        const canvas = await html2canvas(element, {
          scale: 2,
          useCORS: true,
        });
        const imgData = canvas.toDataURL('image/jpeg', 0.98);
        const pdf = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
        const pdfWidth = pdf.internal.pageSize.getWidth();
        const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
        pdf.addImage(imgData, 'JPEG', 0, 0, pdfWidth, pdfHeight);
        pdf.save(`CV_${cvData.fullName.replace(/\s+/g, '_') || 'travaillerenci'}.pdf`);
      } finally {
        // Restaurer le transform scale d'origine
        element.style.transform = originalTransform;
        element.style.transformOrigin = originalTransformOrigin;
        // Toujours restaurer l'onglet Éditer, même si save() échoue ou ne se résout pas.
        if (wasOnEdit) setActiveTab('edit');
      }
    } catch (err) {
      console.error(err);
      alert('Erreur lors de l\'export PDF. Veuillez réessayer.');
    } finally {
      setIsExporting(false);
    }
  };

  const loadExample = () => {
    if (
      window.confirm(
        "Charger le CV d'exemple ? Vos modifications actuelles seront remplacées.",
      )
    ) {
      setCVData(createSampleCV());
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
      <section className="relative overflow-hidden border-b border-line dark:border-slate-800 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-10 md:py-14 relative">
          <div className="grid lg:grid-cols-[1fr_420px] lg:items-center gap-8">
            <div>
              <div className="max-w-2xl">
              <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-brand-soft dark:bg-brand/15 text-brand-strong dark:text-brand-accent text-xs font-bold mb-4 border border-brand/25 dark:border-brand/25">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
                  <path d="M9 3h6M10 3v4a2 2 0 0 1-2 2H4M14 3v4a2 2 0 0 0 2 2h4M5 3h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2ZM19 11h2a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2h-2a2 2 0 0 1-2-2v-2a2 2 0 0 1 2-2ZM12 13a1.5 1.5 0 1 0 0-3 1.5 1.5 0 0 0 0 3ZM8 19c0-1.5 1.8-3 4-3s4 1.5 4 3" />
                </svg>
                Propulsé par l'IA — Optimisé pour la Côte d'Ivoire
              </div>
              <h1 className="text-3xl sm:text-4xl md:text-5xl font-black tracking-tight text-black dark:text-white font-[var(--font-display)]">
                Générateur de CV IA —{' '}
                <span className="text-primary">travaillerenci</span>
              </h1>
              <p className="mt-3 text-black dark:text-white text-base md:text-lg leading-relaxed">
                Créez un CV professionnel en quelques minutes. Optimisez votre contenu avec l'IA
                pour maximiser vos chances auprès des recruteurs ivoiriens.
              </p>
              </div>
              <div className="mt-4 inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/80 dark:bg-slate-800/70 border border-line dark:border-slate-700 shadow-sm">
                {saveState === 'saving' ? (
                  <>
                    <svg className="w-3.5 h-3.5 animate-spin text-primary" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"></path>
                    </svg>
                    <span className="text-xs font-semibold text-black dark:text-white">Sauvegarde…</span>
                  </>
                ) : saveState === 'saved' ? (
                  <>
                    <svg className="w-3.5 h-3.5 text-brand" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M5 13l4 4L19 7" />
                    </svg>
                    <span className="text-xs font-semibold text-brand dark:text-brand-accent">Sauvegardé automatiquement</span>
                  </>
                ) : (
                  <>
                    <svg className="w-3.5 h-3.5 text-black/50 dark:text-white" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a2 2 0 012-2h8l6 6v10a2 2 0 01-2 2H6a2 2 0 01-2-2V5z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 3v6h6M9 13h6M9 17h4" />
                    </svg>
                    <span className="text-xs font-semibold text-black dark:text-white">Sauvegarde automatique</span>
                  </>
                )}
              </div>
              <div className="flex flex-wrap gap-3 mt-6">
                <button
                  onClick={loadExample}
                  className="px-4 py-2.5 rounded-xl border border-brand/30 bg-brand-soft text-sm font-semibold text-brand-strong hover:bg-brand/15 transition-all shadow-sm inline-flex items-center gap-2 dark:border-brand/30 dark:bg-brand/10 dark:text-brand-accent"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 3l1.9 4.6L18.5 9.5l-4.6 1.9L12 16l-1.9-4.6L5.5 9.5l4.6-1.9L12 3zM19 15l.9 2.1 2.1.9-2.1.9L19 21l-.9-2.1-2.1-.9 2.1-.9L19 15z" />
                  </svg>
                  Charger l&apos;exemple
                </button>
                <button
                  onClick={resetCV}
                className="px-4 py-2.5 rounded-xl border border-line dark:border-slate-700 bg-white dark:bg-slate-800 text-sm font-semibold text-black dark:text-white hover:bg-brand-soft/50 dark:hover:bg-slate-700 transition-all shadow-sm inline-flex items-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
                Réinitialiser
              </button>
              <button
                onClick={exportPDF}
                disabled={isExporting || !hydrated}
                className="px-5 py-2.5 rounded-xl bg-gradient-to-r from-primary to-brand text-white text-sm font-bold shadow-lg shadow-primary/20 hover:shadow-xl hover:shadow-primary/30 hover:brightness-110 disabled:opacity-60 disabled:cursor-not-allowed transition-all inline-flex items-center gap-2"
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
            <div className="hidden lg:block relative h-[220px] rounded-3xl overflow-hidden shadow-2xl ring-1 ring-black/5">
              <Image
                src={LOCAL_IMAGES.cvGenerator}
                alt="Générateur de CV IA - travaillerenci"
                fill
                sizes="(min-width: 1024px) 420px, 100vw"
                className="object-cover object-center"
              />
              <div className="absolute inset-0 bg-gradient-to-tr from-brand-strong/60 via-transparent to-transparent" aria-hidden="true" />
            </div>
          </div>
        </div>
      </section>

      {/* Mode toggle : CV / Lettre de motivation */}
      <div className="container mx-auto px-4 pt-6 max-w-6xl">
        <div className="inline-flex p-1.5 rounded-xl bg-brand-soft dark:bg-slate-800 w-full sm:w-auto">
          <button
            onClick={() => setMode('cv')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
              mode === 'cv'
                ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow'
                : 'text-black dark:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8Z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14 2v6h6M9 13h6M9 17h4" />
            </svg>
            Générateur de CV
          </button>
          <button
            onClick={() => setMode('letter')}
            className={`flex-1 sm:flex-none px-5 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
              mode === 'letter'
                ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow'
                : 'text-black dark:text-white'
            }`}
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
            </svg>
            Lettre de motivation IA
          </button>
        </div>
      </div>

      {mode === 'letter' ? (
        <section className="container mx-auto px-4 py-6 md:py-8 max-w-3xl">
          <CoverLetterDynamic
            initialName={cvData.fullName}
            initialSkills={cvData.skills}
            initialExperience={cvData.experiences.map((e) => `${e.position} chez ${e.company} (${e.period})`).join('\n')}
          />
        </section>
      ) : (
      <section className="container mx-auto px-4 py-6 md:py-8">
        <div className="lg:hidden mb-5">
          <div className="inline-flex p-1.5 rounded-xl bg-brand-soft dark:bg-slate-800 w-full">
            <button
              onClick={() => setActiveTab('edit')}
              className={`flex-1 px-4 py-2.5 rounded-lg text-sm font-bold transition-all inline-flex items-center justify-center gap-2 ${
                activeTab === 'edit'
                  ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow'
                  : 'text-black dark:text-white'
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
                  ? 'bg-white dark:bg-slate-900 text-black dark:text-white shadow'
                  : 'text-black dark:text-white'
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

              {/* Aperçu lettre de motivation — lien vers le mode lettre */}
              <div className="mt-4 rounded-xl border border-brand/20 bg-brand-soft p-4 dark:border-brand/30 dark:bg-brand/10">
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-base">✉️</span>
                  <h3 className="text-sm font-bold text-black dark:text-white">Lettre de motivation</h3>
                </div>
                <p className="text-[12px] text-black dark:text-white mb-3">
                  Vos infos du CV sont automatiquement utilisées pour pré-remplir la lettre. Ajoutez le nom de l'entreprise et le poste visé pour générer une lettre personnalisée.
                </p>
                <button
                  onClick={() => setMode('letter')}
                  className="inline-flex items-center gap-1.5 text-[12px] font-bold text-primary dark:text-brand-accent hover:gap-2.5 transition-all"
                >
                  Ouvrir le générateur de lettre
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" /><path d="m12 5 7 7-7 7" />
                  </svg>
                </button>
              </div>
            </div>
          </div>

          <div className={`lg:col-span-7 ${activeTab === 'edit' ? 'hidden lg:block' : ''}`}>
            <div className="lg:sticky lg:top-24">
              <div className="bg-brand-soft dark:bg-slate-800/50 rounded-2xl p-3 md:p-6 border border-line dark:border-slate-800 shadow-inner">
                <div className="text-center text-xs text-black dark:text-white mb-3 font-semibold">
                  Format A4 — Aperçu en temps réel
                </div>
                <div
                  ref={previewShellRef}
                  className="overflow-auto max-h-[70vh] lg:max-h-[calc(100vh-14rem)] custom-scrollbar rounded-xl shadow-inner bg-brand-soft dark:bg-slate-900 p-4"
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
                      id="cv-preview"
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
              {/* Bouton de téléchargement sous le CV */}
              <div className="mt-4 text-center">
                <button
                  onClick={exportPDF}
                  disabled={isExporting || !hydrated}
                  className="px-6 py-3 rounded-xl bg-primary text-white text-sm font-bold shadow-lg shadow-primary/20 hover:bg-primary-dark hover:shadow-xl transition-all disabled:opacity-60 disabled:cursor-not-allowed inline-flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                  </svg>
                  {isExporting ? 'Génération…' : 'Télécharger le CV (PDF)'}
                </button>
              </div>
            </div>
          </div>
        </div>
      </section>
      )}

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
            padding: 0;
            box-shadow: none !important;
            margin: 0 !important;
          }
        }
      `}</style>
    </main>
  );
}
