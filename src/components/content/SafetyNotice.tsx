import { SITE_CONFIG } from '@/lib/constants';

/**
 *  TravaillerEnCi — Mention anti-arnaque (fiches de détail)
 *
 *  Un avertissement INFORMATIF et rassurant, pas alarmiste : encadré discret,
 *  icône bouclier, ton positif. Rappelle que postuler / s'inscrire est
 *  gratuit et permet de signaler un abus par email (mécanisme léger en
 *  attendant un vrai module de signalement).
 *
 *  Variantes :
 *    • job         — emploi & stages (frais de dossier, formation, kit…)
 *    • scholarship — bourses d'études
 *    • exam        — concours de la fonction publique (canaux officiels)
 */
export default function SafetyNotice({
  variant = 'job',
  itemLabel = 'cette offre',
  itemUrl = '',
  className = '',
}: {
  variant?: 'job' | 'scholarship' | 'exam';
  /** Libellé de la cible pour le mail de signalement (titre de l'annonce…). */
  itemLabel?: string;
  /** URL publique de la fiche, incluse dans le mail de signalement. */
  itemUrl?: string;
  className?: string;
}) {
  const reportSubject = encodeURIComponent(
    `Signalement d'un abus — ${itemLabel} (TravaillerEnCi)`,
  );
  const reportBody = encodeURIComponent(
    `Bonjour,\n\nJe souhaite signaler un contenu suspect sur TravaillerEnCi :\n- Lien : ${itemUrl}\n- Motif : (frais demandés / contenu frauduleux / autre)\n\nMerci.`,
  );
  const reportHref = `mailto:${SITE_CONFIG.supportEmail}?subject=${reportSubject}&body=${reportBody}`;

  const content: Record<
    'job' | 'scholarship' | 'exam',
    { title: string; text: string; report: string }
  > = {
    job: {
      title: 'Postuler est toujours gratuit',
      text: "Ne payez jamais de frais de dossier, de formation ou de « kit de recrutement » pour un emploi ou un stage. Si une entreprise vous en demande, ce n'est pas une pratique légitime.",
      report: 'Signaler cette offre',
    },
    scholarship: {
      title: 'Candidater à une bourse est gratuit',
      text: "Aucune bourse sérieuse ne demande d'argent pour traiter un dossier. Si un organisme réclame des frais « d'étude », de « garantie » ou de « traitement accéléré », méfiez-vous et signalez-le.",
      report: 'Signaler ce contenu',
    },
    exam: {
      title: 'L\u2019inscription se fait par les canaux officiels',
      text: "L'inscription aux concours de la fonction publique passe uniquement par les communiqués officiels (ministères, écoles, sites gouvernementaux). Méfiez-vous des intermédiaires qui promettent une place ou une note contre de l'argent.",
      report: 'Signaler ce contenu',
    },
  };

  const c = content[variant];

  return (
    <aside
      className={`rounded-2xl border border-emerald-500/25 bg-emerald-50/70 dark:bg-emerald-500/5 p-4 sm:p-5 ${className}`}
      role="note"
    >
      <div className="flex items-start gap-3">
        <div className="mt-0.5 shrink-0">
          <svg
            className="h-5 w-5 text-emerald-600 dark:text-emerald-400"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth={2}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
          >
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10Z" />
            <path d="m9 12 2 2 4-4" />
          </svg>
        </div>
        <div className="min-w-0 text-sm leading-relaxed">
          <p className="font-bold text-emerald-800 dark:text-emerald-300">
            {c.title}
          </p>
          <p className="mt-0.5 text-emerald-900/80 dark:text-emerald-200/80">
            {c.text}
          </p>
          <a
            href={reportHref}
            className="mt-2 inline-flex items-center gap-1.5 text-[13px] font-bold text-emerald-700 underline-offset-2 hover:underline dark:text-emerald-300"
          >
            <svg
              className="h-3.5 w-3.5"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth={2}
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
              <path d="M10.29 3.86 1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0Z" />
            </svg>
            {c.report}
          </a>
        </div>
      </div>
      <p className="mt-2 text-[11px] text-emerald-700/60 dark:text-emerald-300/50">
        Un doute sur une annonce ? Écrivez-nous, notre équipe la vérifie
        rapidement.
      </p>
    </aside>
  );
}
