import Link from 'next/link';
import SocialLinks from '@/components/layout/SocialLinks';
import PWAInstallCTA from '@/components/concours/PWAInstallCTA';
import NewsletterForm from '@/components/layout/NewsletterForm';

const NAV_LINKS = [
  { label: 'Offres d’emploi', href: '/jobs' },
  { label: 'Stages', href: '/stages' },
  { label: 'Bourses', href: '/bourses' },
  { label: 'Concours', href: '/concours' },
  { label: 'Entreprises', href: '/companies' },
  { label: 'Candidats', href: '/candidates' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

const LEGAL_LINKS = [
  { label: 'Mentions légales', href: '/mentions-legales' },
  { label: 'Conditions d’utilisation', href: '/conditions-utilisation' },
  { label: 'Politique de confidentialité', href: '/confidentialite' },
  { label: 'Politique de cookies', href: '/cookies' },
];

export default function Footer() {
  return (
    <footer className="mt-auto border-t border-line bg-white text-ink-soft dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">
      <div className="mx-auto max-w-7xl px-4 py-10 sm:px-6 lg:px-8 lg:py-12">
        <div className="grid gap-9 lg:grid-cols-[1.35fr_1fr_1.25fr]">
          <div className="min-w-0">
            <Link href="/" className="group flex w-fit items-center gap-2.5" aria-label="TravaillerEnCi — Accueil">
              <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand text-lg font-black text-white shadow-card transition-transform group-hover:scale-[1.03]">
                T
              </span>
              <span>
                <span className="block text-lg font-black leading-none tracking-tight text-ink dark:text-white">
                  TravaillerEn<span className="text-brand dark:text-brand-accent">Ci</span>
                </span>
                <span className="mt-1 block text-[9px] font-semibold uppercase tracking-[0.16em] text-muted dark:text-slate-400">
                  L’emploi en Côte d’Ivoire
                </span>
              </span>
            </Link>
            <p className="mt-4 max-w-xs text-sm leading-relaxed text-muted dark:text-slate-400">
              Emplois, stages, bourses et concours pour construire votre parcours professionnel en Côte d’Ivoire.
            </p>
            <SocialLinks size="sm" className="mt-5 gap-2" />
          </div>

          <nav aria-label="Liens du pied de page" className="min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted dark:text-slate-400">
              Explorer
            </h2>
            <ul className="mt-4 grid grid-cols-2 gap-x-5 gap-y-2.5 text-sm">
              {NAV_LINKS.map((link) => (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    className="inline-flex min-h-8 items-center text-ink-soft transition-colors hover:text-brand dark:text-slate-300 dark:hover:text-brand-accent"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>

          <div className="min-w-0">
            <h2 className="text-[11px] font-bold uppercase tracking-[0.16em] text-muted dark:text-slate-400">
              Newsletter
            </h2>
            <p className="mt-4 text-sm leading-relaxed text-muted dark:text-slate-400">
              Inscrivez-vous pour recevoir les prochaines opportunités.
            </p>
            <NewsletterForm className="mt-4 max-w-md" />
          </div>
        </div>

        <div className="mt-9 border-t border-line pt-5 dark:border-slate-800">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-xs text-muted dark:text-slate-400">
              <p>© {new Date().getFullYear()} TravaillerenCi — Tous droits réservés.</p>
              <span className="hidden h-3 w-px bg-line dark:bg-slate-700 sm:block" aria-hidden="true" />
              <div className="flex items-center gap-2">
                <PWAInstallCTA
                  variant="compact"
                  className="border-line bg-surface text-brand hover:bg-brand-soft dark:border-slate-700 dark:bg-slate-900 dark:text-brand-accent dark:hover:bg-slate-800"
                />
                <span className="text-[11px]">Installer l’application</span>
              </div>
            </div>

            <nav aria-label="Liens légaux" className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {LEGAL_LINKS.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  className="inline-flex min-h-8 items-center text-[11px] text-muted transition-colors hover:text-brand dark:text-slate-400 dark:hover:text-brand-accent"
                >
                  {link.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>
      </div>
    </footer>
  );
}
