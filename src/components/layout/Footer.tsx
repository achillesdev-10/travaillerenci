import Link from 'next/link';
import SocialLinks from '@/components/layout/SocialLinks';
import PWAInstallCTA from '@/components/concours/PWAInstallCTA';

const NAV_LINKS = [
  { label: 'Offres d’emploi', href: '/jobs' },
  { label: 'Bourses', href: '/bourses' },
  { label: 'Concours', href: '/concours' },
  { label: 'Entreprises', href: '/companies' },
  { label: 'Candidats', href: '/candidates' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

export default function Footer() {
  return (
    <footer className="bg-gray-900 text-gray-400 mt-auto">
      <div className="container mx-auto px-4 py-8">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-5">
          <Link href="/" className="flex items-center gap-2.5 w-fit group" aria-label="TravaillerEnCi — Accueil">
            <div className="w-9 h-9 rounded-lg bg-orange-500 flex items-center justify-center shadow-md shadow-orange-500/30 group-hover:shadow-orange-500/50 transition-shadow">
              <span className="text-white font-black text-lg font-[var(--font-display)]">T</span>
            </div>
            <div>
              <div className="text-base font-black font-[var(--font-display)] text-white leading-none">
                <span className="text-white">Travailler</span>
                <span className="text-white">En</span>
                <span className="text-white">Ci</span>
              </div>
              <div className="text-[9px] uppercase tracking-widest text-gray-500 mt-0.5">
                L’emploi en Côte d’Ivoire
              </div>
            </div>
          </Link>

          <nav className="flex flex-wrap items-center gap-x-6 gap-y-2 text-sm">
            {NAV_LINKS.map((link) => (
              <Link key={link.href} href={link.href} className="hover:text-white transition-colors">
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        <div className="border-t border-gray-800 mt-6 pt-4 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-gray-500">
          <div className="flex items-center gap-4">
            <p>
              © {new Date().getFullYear()} TravaillerenCi — Tous droits réservés.
            </p>
            <PWAInstallCTA variant="compact" className="border-gray-700 bg-gray-800 text-gray-300 hover:bg-gray-700" />
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden sm:inline text-[11px]">Télécharger l'App 📱</span>
            <SocialLinks size="sm" variant="dark" className="gap-2" />
          </div>
        </div>
      </div>
    </footer>
  );
}
