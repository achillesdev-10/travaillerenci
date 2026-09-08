'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCallback, useEffect, useRef, useState } from 'react';
import type { CarouselSlide } from '@/lib/homeCarousel';

const TYPE_LABEL: Record<CarouselSlide['type'], string> = {
  offre: 'Offre d\u2019emploi',
  stage: 'Stage',
  bourse: "Bourse d'\u00e9tudes",
  concours: 'Concours',
  blog: 'Actualit\u00e9',
};

function faviconUrl(domain: string): string {
  // sz=32 au lieu de 96 : le favicon n'est affiché qu'à ~14-16 px,
  // le télécharger en 96 px était du gaspillage (audit images Lighthouse).
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(domain)}&sz=32`;
}

function SlideMedia({ slide }: { slide: CarouselSlide }) {
  if (slide.image) {
    // Optimisation via next/image UNIQUEMENT pour les URLs Unsplash connues :
    // les cover_image des articles scrapés peuvent être des URLs arbitraires
    // (http, chemins relatifs, data: URI…) que l'optimiseur ne sait pas traiter
    // — dans ce cas on rend l'image brute (comportement identique à avant).
    const optimize = slide.image.startsWith('https://images.unsplash.com');
    return (
      <Image
        src={slide.image}
        alt={slide.title}
        fill
        sizes="(min-width: 1024px) 560px, 92vw"
        unoptimized={!optimize}
        className="object-cover transition-transform duration-700 group-hover:scale-105"
      />
    );
  }
  return (
    <div className={`absolute inset-0 ${slide.fallback.color}`}>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="text-6xl sm:text-7xl font-black text-white/90 font-[var(--font-display)] drop-shadow-lg">
          {slide.fallback.initial}
        </span>
      </div>
    </div>
  );
}

/**
 * Carrousel « À la une ». Les slides sont construites côté serveur
 * (src/lib/homeCarousel.ts) et passées en props : le contenu est donc
 * présent dans le HTML rendu par le serveur (SEO), ce composant ne gère
 * plus que l'aspect interactif (défilement, flèches, indicateurs).
 */
export default function HomeCarousel({ slides }: { slides: CarouselSlide[] }) {
  const [index, setIndex] = useState(0);
  const [paused, setPaused] = useState(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const go = useCallback(
    (next: number) => {
      if (slides.length === 0) return;
      setIndex(((next % slides.length) + slides.length) % slides.length);
    },
    [slides.length],
  );

  useEffect(() => {
    if (paused || slides.length <= 1) return;
    timerRef.current = setInterval(() => go(index + 1), 5000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
  }, [paused, slides.length, index, go]);

  // Index borné : si la liste de slides change (revalidation ISR) et rétrécit,
  // on évite qu'aucune slide ne soit active (index hors bornes).
  const current = slides.length > 0 ? index % slides.length : 0;

  if (slides.length === 0) {
    return (
      <div className="w-full overflow-hidden rounded-2xl bg-primary shadow-lg h-56 sm:h-72">
        <div className="flex h-full items-center justify-center px-6 text-white">
          <div className="text-center">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" className="h-12 w-12 mx-auto opacity-90" aria-hidden="true">
              <circle cx="12" cy="12" r="10" />
              <path d="M2 12h20" />
              <path d="M12 2a15.3 15.3 0 0 1 0 20 15.3 15.3 0 0 1 0-20Z" />
            </svg>
            <p className="mt-3 text-sm sm:text-base font-semibold">
              Aucune opportunité à la une pour le moment
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div
      className="group relative w-full overflow-hidden rounded-2xl sm:rounded-3xl shadow-xl shadow-primary/10 bg-slate-900"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
      aria-roledescription="carrousel"
      aria-label="Opportunités à la une"
    >
      <div className="relative h-56 sm:h-72 lg:h-80">
        {/* Slide active */}
        {slides.map((s, i) => (
          <div
            key={s.id}
            className={`absolute inset-0 transition-opacity duration-700 ${
              i === current ? 'opacity-100 z-10' : 'opacity-0 z-0'
            }`}
            aria-hidden={i !== current || undefined}
            // Slides inactives : invisibles mais présentes dans le DOM (SEO).
            // `inert` retire leurs liens du parcours clavier — corrige
            // l'audit « aria-hidden ne doit pas contenir d'éléments focusables ».
            inert={i !== current || undefined}
          >
            <Link href={s.href} className="block h-full w-full">
              <SlideMedia slide={s} />
              <div className="absolute inset-0 bg-gradient-to-t from-slate-950/90 via-slate-950/40 to-transparent" />

              <div className="absolute inset-x-0 bottom-0 p-4 sm:p-6">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="inline-flex items-center rounded-full bg-orange-700 px-2.5 py-1 text-[10px] font-extrabold uppercase tracking-wide text-white shadow">
                    {TYPE_LABEL[s.type]}
                  </span>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-white/15 px-2.5 py-1 text-[10px] font-semibold text-white backdrop-blur">
                    <Image
                      src={faviconUrl(s.fallback.domain)}
                      alt=""
                      width={14}
                      height={14}
                      unoptimized
                      className="h-3.5 w-3.5 rounded-sm"
                    />
                    <span className="max-w-[140px] truncate sm:max-w-[200px]">{s.fallback.domain}</span>
                  </span>
                </div>
                <h3 className="font-[var(--font-display)] text-base sm:text-xl lg:text-2xl font-extrabold text-white leading-snug line-clamp-2 drop-shadow">
                  {s.title}
                </h3>
                <p className="mt-1 text-xs sm:text-sm text-gray-200/90 truncate">{s.subtitle}</p>
                <span className="mt-3 inline-flex items-center gap-1.5 rounded-full bg-white px-3.5 py-1.5 text-xs font-bold text-slate-900 transition-transform group-hover:gap-2.5">
                  Découvrir
                  <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14" />
                    <path d="m12 5 7 7-7 7" />
                  </svg>
                </span>
              </div>
            </Link>
          </div>
        ))}

        {/* Flèches */}
        {slides.length > 1 && (
          <>
            <button
              onClick={() => go(current - 1)}
              aria-label="Slide précédente"
              className="absolute left-2 sm:left-4 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5" />
                <path d="m12 19-7-7 7-7" />
              </svg>
            </button>
            <button
              onClick={() => go(current + 1)}
              aria-label="Slide suivante"
              className="absolute right-2 sm:right-4 top-1/2 z-20 -translate-y-1/2 flex h-9 w-9 items-center justify-center rounded-full bg-white/90 text-slate-800 shadow-lg opacity-0 transition-opacity group-hover:opacity-100 hover:bg-white"
            >
              <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </button>
          </>
        )}
      </div>

      {/* Indicateurs — zone cliquable de 24x24 px (audit cible tactile),
          le point visuel reste petit */}
      {slides.length > 1 && (
        <div className="absolute bottom-1 left-1/2 z-20 flex -translate-x-1/2 gap-0.5 sm:bottom-2">
          {slides.map((s, i) => (
            <button
              key={s.id}
              onClick={() => go(i)}
              aria-label={`Aller à la slide ${i + 1}`}
              aria-current={i === current}
              className="flex h-6 w-6 items-center justify-center"
            >
              <span
                className={`block h-1.5 rounded-full transition-all duration-300 ${
                  i === current ? 'w-4 bg-white' : 'w-1.5 bg-white/50 hover:bg-white/80'
                }`}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
