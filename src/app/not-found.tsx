import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-[70vh] flex-1 items-center justify-center bg-white px-4 py-16 text-black dark:bg-slate-950 dark:text-white">
      <div className="mx-auto w-full max-w-md text-center">
        <p className="text-[64px] font-black leading-none tracking-tight text-primary sm:text-[88px]">
          404
        </p>
        <h1 className="mt-4 text-2xl font-extrabold tracking-tight font-[var(--font-display)] sm:text-3xl">
          Page introuvable
        </h1>
        <p className="mx-auto mt-3 max-w-sm text-sm leading-relaxed text-black/70 dark:text-white/70 sm:text-base">
          Cette page n&apos;existe pas ou a été déplacée. Retrouvez les offres,
          concours et bourses disponibles sur TravaillerEnCi.
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <Link
            href="/"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-bold text-white transition-colors hover:bg-primary-dark sm:w-auto"
          >
            Retour à l&apos;accueil
          </Link>
          <Link
            href="/jobs"
            className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-line bg-white px-5 py-3 text-sm font-bold text-black transition-colors hover:border-primary/40 hover:text-primary dark:border-slate-700 dark:bg-slate-900 dark:text-white sm:w-auto"
          >
            Voir les offres
          </Link>
        </div>
        <div className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-[12.5px] font-semibold text-black/60 dark:text-white/60">
          <Link href="/concours" className="transition-colors hover:text-primary">
            Concours
          </Link>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-black/20 dark:bg-white/20" />
          <Link href="/bourses" className="transition-colors hover:text-primary">
            Bourses
          </Link>
          <span aria-hidden="true" className="h-1 w-1 rounded-full bg-black/20 dark:bg-white/20" />
          <Link href="/blog" className="transition-colors hover:text-primary">
            Blog
          </Link>
        </div>
      </div>
    </main>
  );
}
