'use client';

import { useEffect } from 'react';

/**
 * Enregistre une vue unique par session de navigation. Le ping est volontairement
 * silencieux : il ne doit jamais bloquer la lecture de l'article.
 */
export default function ArticleViewPing({ slug }: { slug: string }) {
  useEffect(() => {
    if (!slug) return;
    const key = `tec:view:${slug}`;
    try {
      if (window.sessionStorage.getItem(key)) return;
      window.sessionStorage.setItem(key, '1');
    } catch {
      // sessionStorage indisponible (mode privé strict) : on continue.
    }

    const timer = window.setTimeout(() => {
      fetch(`/api/news/${encodeURIComponent(slug)}/view`, {
        method: 'POST',
        keepalive: true,
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
      }).catch(() => undefined);
    }, 2500);

    return () => window.clearTimeout(timer);
  }, [slug]);

  return null;
}
