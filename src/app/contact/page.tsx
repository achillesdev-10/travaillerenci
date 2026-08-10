import Link from 'next/link';
import ContactForm from '@/components/contact/ContactForm';
import { SITE_CONFIG } from '@/lib/constants';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Nous contacter — TravaillerenCi',
  description:
    "Une question, une suggestion ou un partenariat ? Contactez l'équipe TravaillerenCi par email : achillesdev10@gmail.com. Réponse sous 24-48h.",
};

const INFO_ITEMS = [
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M3 8l7.89 5.26a2 2 0 0 0 2.22 0L21 8" />
        <path d="M5 19h14a2 2 0 0 0 2-2V7a2 2 0 0 0-2-2H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2Z" />
      </svg>
    ),
    title: 'Email',
    value: SITE_CONFIG.supportEmail,
    href: `mailto:${SITE_CONFIG.supportEmail}`,
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M12 21s-7-4.5-7-10a7 7 0 0 1 14 0c0 5.5-7 10-7 10Z" />
        <circle cx="12" cy="11" r="2.5" />
      </svg>
    ),
    title: 'Localisation',
    value: 'Abidjan, Côte d\u2019Ivoire',
  },
  {
    icon: (
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" className="h-6 w-6">
        <path d="M13 2 3 14h9l-1 8 10-12h-9l1-8Z" />
      </svg>
    ),
    title: 'Temps de réponse',
    value: 'Sous 24 à 48 heures ouvrées',
  },
];

export default function ContactPage() {
  return (
    <main className="min-h-screen bg-gray-50 dark:bg-slate-950">
      {/* ===== En-tête ===== */}
      <section className="relative overflow-hidden border-b border-border/40 bg-primary/5 dark:bg-primary/10">
        <div className="container mx-auto px-4 py-12 sm:py-16 relative z-10 max-w-4xl text-center">
          <div className="inline-flex items-center gap-2 bg-primary/10 text-primary dark:text-emerald-400 px-3.5 py-1.5 rounded-full text-xs sm:text-sm font-semibold mb-5">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden="true">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2Z" />
            </svg>
            Nous contacter
          </div>
          <h1 className="text-3xl sm:text-4xl lg:text-5xl font-extrabold tracking-tight font-[var(--font-display)] text-gray-900 dark:text-white">
            Parlons-en&nbsp;!
          </h1>
          <p className="mt-4 text-base sm:text-lg text-gray-600 dark:text-gray-300 max-w-2xl mx-auto leading-relaxed">
            Une question sur une offre, une suggestion pour améliorer la plateforme, un
            partenariat&nbsp;? Écrivez-nous, on vous répond rapidement.
          </p>
        </div>
      </section>

      {/* ===== Contenu : infos + formulaire ===== */}
      <section className="container mx-auto px-4 py-10 sm:py-14 max-w-6xl">
        <div className="grid grid-cols-1 lg:grid-cols-[0.9fr_1.1fr] gap-8 lg:gap-12 items-start">
          {/* Colonne infos */}
          <div className="space-y-4 lg:sticky lg:top-24">
            {INFO_ITEMS.map((item) => (
              <div
                key={item.title}
                className="flex items-center gap-4 rounded-2xl border border-border bg-white dark:bg-slate-900 p-5 shadow-sm hover:border-primary/30 transition-colors"
              >
                <div className="shrink-0 w-12 h-12 rounded-xl bg-primary/10 border border-primary/10 flex items-center justify-center text-primary">
                  <span aria-hidden="true">{item.icon}</span>
                </div>
                <div className="min-w-0">
                  <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500">
                    {item.title}
                  </div>
                  {item.href ? (
                    <a
                      href={item.href}
                      className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white hover:text-primary transition-colors break-all"
                    >
                      {item.value}
                    </a>
                  ) : (
                    <div className="text-sm sm:text-base font-semibold text-gray-900 dark:text-white">
                      {item.value}
                    </div>
                  )}
                </div>
              </div>
            ))}

            {/* Réseaux sociaux */}
            <div className="rounded-2xl border border-border bg-white dark:bg-slate-900 p-5 shadow-sm">
              <div className="text-xs font-bold uppercase tracking-widest text-gray-400 dark:text-gray-500 mb-3">
                Suivez-nous
              </div>
              <div className="flex items-center gap-3">
                <a
                  href={SITE_CONFIG.social.facebook}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="Facebook"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M22 12c0-5.523-4.477-10-10-10S2 6.477 2 12c0 4.991 3.657 9.128 8.438 9.878v-6.987h-2.54V12h2.54V9.797c0-2.506 1.492-3.89 3.777-3.89 1.094 0 2.238.195 2.238.195v2.46h-1.26c-1.243 0-1.63.771-1.63 1.562V12h2.773l-.443 2.89h-2.33v6.988C18.343 21.128 22 16.991 22 12z" />
                  </svg>
                </a>
                <a
                  href={SITE_CONFIG.social.tiktok}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="TikTok"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5 20.1a6.34 6.34 0 0 0 10.86-4.43v-7a8.16 8.16 0 0 0 4.77 1.52v-3.4a4.85 4.85 0 0 1-1-.1z" />
                  </svg>
                </a>
                <a
                  href={SITE_CONFIG.social.linkedin}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="LinkedIn"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                  </svg>
                </a>
                <a
                  href={SITE_CONFIG.social.whatsapp}
                  target="_blank"
                  rel="noreferrer"
                  aria-label="WhatsApp"
                  className="w-10 h-10 rounded-full bg-gray-100 dark:bg-slate-800 hover:bg-primary hover:text-white flex items-center justify-center transition-colors"
                >
                  <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 24 24">
                    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 0 1-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 0 1-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 0 1 2.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0 0 12.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 0 0 5.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 0 0-3.48-8.413z" />
                  </svg>
                </a>
              </div>
            </div>

            {/* CTA emploi */}
            <Link
              href="/jobs"
              className="group flex items-center justify-between gap-4 rounded-2xl bg-primary p-5 text-white shadow-lg shadow-primary/20 hover:brightness-110 transition-all"
            >
              <div>
                <div className="font-bold font-[var(--font-display)]">Envie de trouver un job ?</div>
                <div className="text-sm text-white/80">Parcourez les offres vérifiées</div>
              </div>
              <svg className="w-5 h-5 shrink-0 transition-transform group-hover:translate-x-1" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round">
                <path d="M5 12h14" />
                <path d="m12 5 7 7-7 7" />
              </svg>
            </Link>
          </div>

          {/* Colonne formulaire */}
          <ContactForm />
        </div>
      </section>
    </main>
  );
}
