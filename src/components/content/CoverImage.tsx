'use client';

import { useState, useCallback } from 'react';
import Image from 'next/image';

/**
 * Image de couverture optimisée avec next/image :
 * - Conversion automatique WebP/AVIF via l'optimiseur Next.js
 * - Repli gracieux : si l'URL est cassée, on affiche un visuel SVG
 *   aux couleurs du site plutôt qu'une icône d'image cassée.
 * - Utilise le mode `fill` : le parent DOIT avoir `relative` + dimensions fixes.
 */

/** SVG de repli aux couleurs de la marque (vert → emeraude). */
const FALLBACK_SRC =
  'data:image/svg+xml;charset=utf-8,' +
  encodeURIComponent(
    '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1200 630">' +
      '<defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#064e3b"/><stop offset="1" stop-color="#009639"/>' +
      '</linearGradient></defs>' +
      '<rect width="1200" height="630" fill="url(#g)"/>' +
      '<circle cx="600" cy="315" r="110" fill="#ffffff" opacity="0.18"/>' +
      '<text x="600" y="372" font-family="Poppins, Arial, sans-serif" font-size="150" ' +
      'font-weight="800" fill="#ffffff" text-anchor="middle">CI</text>' +
      '</svg>',
  );

interface CoverImageProps {
  src: string;
  alt: string;
  className?: string;
}

export default function CoverImage({ src, alt, className = '' }: CoverImageProps) {
  const [imgSrc, setImgSrc] = useState(src);
  const [hasError, setHasError] = useState(false);

  const handleError = useCallback(() => {
    if (!hasError) {
      setHasError(true);
      setImgSrc(FALLBACK_SRC);
    }
  }, [hasError]);

  // Le fallback SVG est une data URI — next/image ne peut pas l'optimiser,
  // on utilise un <img> natif dans ce cas pour éviter une erreur de build.
  if (hasError) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={imgSrc}
        alt={alt}
        className={className}
        aria-hidden={alt === '' ? 'true' : undefined}
      />
    );
  }

  return (
    <Image
      src={imgSrc}
      alt={alt}
      fill
      sizes="(max-width: 640px) 100vw, (max-width: 1024px) 50vw, 33vw"
      className={`object-cover ${className}`}
      onError={handleError}
      unoptimized={imgSrc.startsWith('data:')}
      referrerPolicy="no-referrer"
    />
  );
}
