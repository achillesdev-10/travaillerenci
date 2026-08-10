import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/userSession';

export const metadata = {
  title: 'Tableau de bord',
};

/**
 * /dashboard — point d'entrée du tableau de bord (protégé par middleware).
 * Redirige vers l'espace correspondant au rôle réel de l'utilisateur.
 */
export default async function DashboardPage() {
  const user = await getCurrentUser();

  if (!user) {
    redirect('/login?next=/dashboard/candidate');
  }

  redirect(user.role === 'company' ? '/dashboard/company' : '/dashboard/candidate');
}
