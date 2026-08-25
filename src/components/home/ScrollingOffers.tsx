'use client';

import { useEffect, useRef } from 'react';
import Link from 'next/link';
import type { JobOfferSchema } from '@/types';

interface ScrollingOffersProps {
  offers: JobOfferSchema[];
}

export default function ScrollingOffers({ offers }: ScrollingOffersProps) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const isPaused = useRef(false);

  useEffect(() => {
    const el = scrollRef.current;
    if (!el) return;

    let animId: number;
    let scrollPos = 0;
    const speed = 0.5; // pixels per frame (~30px/s at 60fps)

    const tick = () => {
      if (!isPaused.current) {
        scrollPos += speed;
        // Reset to start when reaching the midpoint (we duplicate items for seamless loop)
        if (scrollPos >= el.scrollWidth / 2) {
          scrollPos = 0;
        }
        el.scrollLeft = scrollPos;
      }
      animId = requestAnimationFrame(tick);
    };

    animId = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(animId);
  }, [offers]);

  if (!offers.length) return null;

  // Duplicate the list for seamless infinite scroll
  const doubled = [...offers, ...offers];

  function contractBadge(type?: string | null) {
    if (!type) return null;
    const colors: Record<string, string> = {
      CDI: 'bg-emerald-100 text-emerald-700',
      CDD: 'bg-orange-100 text-orange-700',
      Stage: 'bg-sky-100 text-sky-700',
      Alternance: 'bg-purple-100 text-purple-700',
      Freelance: 'bg-rose-100 text-rose-700',
      'Temps partiel': 'bg-amber-100 text-amber-700',
    };
    return (
      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold ${colors[type] || 'bg-gray-100 text-gray-700'}`}>
        {type}
      </span>
    );
  }

  return (
    <div
      className="relative overflow-hidden"
      onMouseEnter={() => { isPaused.current = true; }}
      onMouseLeave={() => { isPaused.current = false; }}
    >
      {/* Fade edges */}
      <div className="pointer-events-none absolute inset-y-0 left-0 w-12 bg-gradient-to-r from-gray-50 to-transparent dark:from-slate-950 z-10" />
      <div className="pointer-events-none absolute inset-y-0 right-0 w-12 bg-gradient-to-l from-gray-50 to-transparent dark:from-slate-950 z-10" />

      <div
        ref={scrollRef}
        className="flex gap-4 overflow-hidden py-2"
        style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
      >
        {doubled.map((offer, i) => (
          <Link
            key={`${offer.id}-${i}`}
            href={`/jobs/${offer.id}`}
            className="shrink-0 w-[280px] sm:w-[320px] rounded-2xl border border-gray-100 bg-white dark:bg-slate-900 dark:border-slate-800 p-4 shadow-sm hover:shadow-md hover:border-primary/30 transition-all duration-200 group"
          >
            <div className="flex items-start justify-between gap-2 mb-2">
              <h3 className="text-[13px] font-bold text-gray-900 dark:text-white leading-snug line-clamp-2 group-hover:text-primary transition-colors">
                {offer.title}
              </h3>
              {contractBadge(offer.contract_type)}
            </div>
            <p className="text-[11px] text-gray-500 dark:text-gray-400 mb-2 line-clamp-1">
              {offer.company || 'Entreprise'}
            </p>
            <div className="flex items-center gap-2 text-[10px] text-gray-400 dark:text-gray-500">
              {offer.location && (
                <span className="inline-flex items-center gap-1">
                  <svg className="w-3 h-3" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                    <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z" />
                    <circle cx="12" cy="10" r="3" />
                  </svg>
                  {offer.location}
                </span>
              )}
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
