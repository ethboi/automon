'use client';

import { usePathname } from 'next/navigation';
import Header from '@/components/Header';
import ChatBox from '@/components/ChatBox';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const isHome = pathname === '/';

  // Homepage is fullscreen — no header/chatbox
  if (isHome) {
    return <>{children}</>;
  }

  return (
    <>
      <Header />
      <main>{children}</main>
      <ChatBox />
    </>
  );
}
