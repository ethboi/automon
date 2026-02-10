'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useWallet } from '@/context/WalletContext';
import { useState } from 'react';

export default function Header() {
  const { address, balance, isConnecting, connect, disconnect } = useWallet();
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  const navLinks = [
    { href: '/collection', label: 'Collection', icon: '📚' },
    { href: '/shop', label: 'Shop', icon: '🛒' },
    { href: '/battle', label: 'Battle', icon: '⚔️' },
    { href: '/tournament', label: 'Tournaments', icon: '🏆' },
    { href: '/agent', label: 'AI Agent', icon: '🤖' },
  ];

  const isActive = (href: string) => pathname === href;

  return (
    <header className="sticky top-0 z-50 glass border-b border-white/5">
      {/* Gradient accent line */}
      <div className="absolute top-0 left-0 right-0 h-[2px] bg-gradient-to-r from-purple-500 via-cyan-500 to-purple-500 animate-gradient" />

      <div className="px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 sm:h-18">
          {/* Logo */}
          <div className="flex items-center gap-6 lg:gap-10">
            <Link href="/" className="flex items-center gap-3 group">
              {/* Monster icon with glow effect */}
              <div className="relative">
                <div className="absolute inset-0 bg-purple-500/50 rounded-xl blur-xl opacity-0 group-hover:opacity-100 transition-opacity duration-500" />
                <div className="relative w-10 h-10 sm:w-11 sm:h-11 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-110 transition-all duration-300">
                  <svg viewBox="0 0 32 32" className="w-6 h-6 sm:w-7 sm:h-7" fill="none">
                    <circle cx="16" cy="16" r="12" fill="#a855f7" />
                    <circle cx="11" cy="14" r="3" fill="white" />
                    <circle cx="21" cy="14" r="3" fill="white" />
                    <circle cx="12" cy="14" r="1.5" fill="#1f2937" />
                    <circle cx="22" cy="14" r="1.5" fill="#1f2937" />
                    <path d="M10 20 Q16 25 22 20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                    <path d="M6 8 L10 12 L8 6 Z" fill="#c084fc" />
                    <path d="M26 8 L22 12 L24 6 Z" fill="#c084fc" />
                  </svg>
                </div>
                <div className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-[#050508] animate-pulse" />
              </div>

              {/* Logo text */}
              <div className="font-[var(--font-orbitron)] text-xl sm:text-2xl font-black tracking-wide hidden xs:block">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent">
                  AUTO
                </span>
                <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent">
                  MON
                </span>
              </div>
            </Link>

            {/* Desktop Navigation */}
            {address && (
              <nav className="hidden lg:flex items-center gap-1">
                {navLinks.map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`
                      relative px-4 py-2 rounded-lg text-sm font-medium transition-all duration-300
                      ${isActive(link.href)
                        ? 'text-white bg-white/10'
                        : 'text-gray-400 hover:text-white hover:bg-white/5'
                      }
                    `}
                  >
                    <span className="flex items-center gap-2">
                      <span className="text-base">{link.icon}</span>
                      {link.label}
                    </span>
                    {isActive(link.href) && (
                      <span className="absolute bottom-0 left-1/2 -translate-x-1/2 w-1/2 h-0.5 bg-gradient-to-r from-purple-500 to-cyan-500 rounded-full" />
                    )}
                  </Link>
                ))}
              </nav>
            )}
          </div>

        {/* Right side */}
        <div className="flex items-center gap-3 sm:gap-4">
            {address ? (
              <>
                {/* Balance pill */}
                <div className="hidden sm:flex items-center gap-2 glass-purple rounded-full px-4 py-2">
                  <span className="text-yellow-400 text-lg">💰</span>
                  <span className="text-white font-semibold">{parseFloat(balance || '0').toFixed(2)}</span>
                  <span className="text-purple-300 text-sm">MON</span>
                </div>

                {/* Address pill */}
                <div className="glass rounded-full px-4 py-2 flex items-center gap-2">
                  <div className="w-2 h-2 rounded-full animate-pulse bg-emerald-400" />
                  <span className="text-purple-300 font-mono text-sm">
                    {formatAddress(address)}
                  </span>
                </div>

                {/* Disconnect button */}
                <button
                  onClick={disconnect}
                  className="hidden sm:block text-gray-400 hover:text-white text-sm transition-colors duration-300 px-3 py-2 hover:bg-white/5 rounded-lg"
                >
                  Disconnect
                </button>

                {/* Mobile menu button */}
                <button
                  onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
                  className="lg:hidden p-2 text-gray-400 hover:text-white hover:bg-white/5 rounded-lg transition-colors"
                >
                  <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    {mobileMenuOpen ? (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                    ) : (
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                    )}
                  </svg>
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="btn-primary disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span className="flex items-center gap-2">
                  {isConnecting ? (
                    <>
                      <div className="w-4 h-4 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                      <span>Connecting...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13.828 10.172a4 4 0 00-5.656 0l-4 4a4 4 0 105.656 5.656l1.102-1.101m-.758-4.899a4 4 0 005.656 0l4-4a4 4 0 00-5.656-5.656l-1.1 1.1" />
                      </svg>
                      <span>Connect Wallet</span>
                    </>
                  )}
                </span>
              </button>
            )}
          </div>
        </div>

        {/* Mobile Navigation */}
        {address && mobileMenuOpen && (
          <nav className="lg:hidden py-4 border-t border-white/5 animate-fade-in-up">
            <div className="flex flex-col gap-1">
              {navLinks.map((link) => (
                <Link
                  key={link.href}
                  href={link.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={`
                    flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-medium transition-all duration-300
                    ${isActive(link.href)
                      ? 'text-white bg-purple-500/20 border border-purple-500/30'
                      : 'text-gray-400 hover:text-white hover:bg-white/5'
                    }
                  `}
                >
                  <span className="text-lg">{link.icon}</span>
                  {link.label}
                </Link>
              ))}

              {/* Mobile balance display */}
              <div className="flex items-center justify-between px-4 py-3 mt-2 glass rounded-xl">
                <span className="text-gray-400 text-sm">Balance</span>
                <span className="text-white font-semibold">{parseFloat(balance || '0').toFixed(2)} MON</span>
              </div>

              {/* Mobile disconnect */}
              <button
                onClick={() => {
                  disconnect();
                  setMobileMenuOpen(false);
                }}
                className="px-4 py-3 text-left text-red-400 hover:text-red-300 text-sm font-medium transition-colors"
              >
                Disconnect Wallet
              </button>
            </div>
          </nav>
        )}
      </div>
    </header>
  );
}
