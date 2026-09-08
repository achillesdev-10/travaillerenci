'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';

// Assistant : jamais critique au premier affichage (bouton invisible pendant
// ~2 s puis chat sur demande). Chargé après hydratation → son JS/CSS (dont
// SimpleMarkdown) sort du bundle initial de chaque page.
const AssistantFloat = dynamic(() => import('@/components/assistant/AssistantFloat'), {
  ssr: false,
});

export default function AppShell({
  children,
}: {
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const isAdminRoute = pathname.startsWith('/cz7tk');

  if (isAdminRoute) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main className="flex-1">{children}</main>
      <Footer />
      <AssistantFloat />
    </>
  );
}
