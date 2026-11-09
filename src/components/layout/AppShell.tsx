'use client';

import dynamic from 'next/dynamic';
import { usePathname } from 'next/navigation';
import Header from '@/components/layout/Header';
import Footer from '@/components/layout/Footer';
import MobileBottomNav from '@/components/layout/MobileBottomNav';

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
      <div className="flex flex-1 flex-col bg-white pb-[calc(4.5rem_+_env(safe-area-inset-bottom))] dark:bg-slate-950 lg:pb-0">
        <main className="flex-1">{children}</main>
        <Footer />
      </div>
      <MobileBottomNav />
      <AssistantFloat />
    </>
  );
}
