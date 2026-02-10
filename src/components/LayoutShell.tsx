'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import ChatBox from '@/components/ChatBox';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const normalizedPath = (pathname || '').replace(/\/+$/, '') || '/';
  const isWorldRoute = normalizedPath === '/' || normalizedPath === '/index';

  return (
    <>
      <Header />
      <main>{children}</main>
      {!isWorldRoute && <ChatBox />}
    </>
  );
}
