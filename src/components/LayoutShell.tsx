'use client';

import Header from '@/components/Header';

export default function LayoutShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      <Header />
      <main>{children}</main>
      <footer className="w-full py-4 text-center text-xs text-gray-600 border-t border-white/[0.04]">
        Built by{' '}
        <a href="https://x.com/ethboi" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400">@ethboi</a>
        {' '}&{' '}
        <a href="https://x.com/Mocha_byte" target="_blank" rel="noopener noreferrer" className="text-cyan-500 hover:text-cyan-400">@Mocha_byte</a>
      </footer>
    </>
  );
}
