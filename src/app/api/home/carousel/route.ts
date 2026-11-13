import { NextResponse } from 'next/server';
import { buildCarouselSlides } from '@/lib/homeCarousel';

export const revalidate = 3600;

export type { CarouselSlide } from '@/lib/homeCarousel';

// -----------------------------------------------------------------------------
// Route API du carrousel « À la une » — logique déplacée dans
// src/lib/homeCarousel.ts pour être réutilisée par la home en rendu serveur
// (les titres des opportunités sont alors présents dans le HTML brut).
// -----------------------------------------------------------------------------
export async function GET() {
  const { slides } = await buildCarouselSlides({ withOgImages: false, maxSlides: 8 });
  return NextResponse.json({ slides });
}
