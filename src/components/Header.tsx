'use client';

import Link from 'next/link';
import { useWallet } from '@/context/WalletContext';

export default function Header() {
  const { address, balance, isConnecting, isAuthenticated, connect, disconnect } = useWallet();

  const formatAddress = (addr: string) => {
    return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
  };

  return (
    <header className="bg-gray-900 border-b border-gray-800">
      <div className="px-6 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="flex items-center gap-3 group">
              {/* Monster icon */}
              <div className="relative">
                <div className="w-11 h-11 bg-gradient-to-br from-purple-500 via-purple-600 to-indigo-600 rounded-xl flex items-center justify-center shadow-lg shadow-purple-500/30 group-hover:shadow-purple-500/50 group-hover:scale-110 transition-all duration-300">
                  {/* Simple monster face */}
                  <svg viewBox="0 0 32 32" className="w-7 h-7" fill="none">
                    {/* Face */}
                    <circle cx="16" cy="16" r="12" fill="#a855f7" />
                    {/* Eyes */}
                    <circle cx="11" cy="14" r="3" fill="white" />
                    <circle cx="21" cy="14" r="3" fill="white" />
                    <circle cx="12" cy="14" r="1.5" fill="#1f2937" />
                    <circle cx="22" cy="14" r="1.5" fill="#1f2937" />
                    {/* Smile */}
                    <path d="M10 20 Q16 25 22 20" stroke="white" strokeWidth="2" fill="none" strokeLinecap="round" />
                    {/* Ears/horns */}
                    <path d="M6 8 L10 12 L8 6 Z" fill="#c084fc" />
                    <path d="M26 8 L22 12 L24 6 Z" fill="#c084fc" />
                  </svg>
                </div>
                <div className="absolute -top-1 -right-1 w-3 h-3 bg-green-400 rounded-full border-2 border-gray-900 animate-pulse" />
              </div>
              {/* Logo text with cool font */}
              <div className="font-[var(--font-orbitron)] text-2xl font-black tracking-wide">
                <span className="bg-gradient-to-r from-white via-gray-100 to-gray-300 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(255,255,255,0.3)]">
                  AUTO
                </span>
                <span className="bg-gradient-to-r from-purple-400 via-purple-500 to-fuchsia-500 bg-clip-text text-transparent drop-shadow-[0_0_10px_rgba(168,85,247,0.5)]">
                  MON
                </span>
              </div>
            </Link>

            {isAuthenticated && (
              <nav className="hidden md:flex items-center gap-6">
                <Link href="/collection" className="text-gray-300 hover:text-white transition">
                  Collection
                </Link>
                <Link href="/shop" className="text-gray-300 hover:text-white transition">
                  Shop
                </Link>
                <Link href="/battle" className="text-gray-300 hover:text-white transition">
                  Battle
                </Link>
                <Link href="/tournament" className="text-gray-300 hover:text-white transition">
                  Tournaments
                </Link>
                <Link href="/agent" className="text-gray-300 hover:text-white transition">
                  AI Agent
                </Link>
              </nav>
            )}
          </div>

          <div className="flex items-center gap-4">
            {isAuthenticated && address ? (
              <>
                <div className="hidden sm:block text-sm">
                  <span className="text-gray-400">Balance: </span>
                  <span className="text-white font-medium">{balance || '0'} MON</span>
                </div>
                <div className="bg-gray-800 px-4 py-2 rounded-lg">
                  <span className="text-purple-400 font-mono text-sm">
                    {formatAddress(address)}
                  </span>
                </div>
                <button
                  onClick={disconnect}
                  className="text-gray-400 hover:text-white text-sm transition"
                >
                  Disconnect
                </button>
              </>
            ) : (
              <button
                onClick={connect}
                disabled={isConnecting}
                className="bg-purple-600 hover:bg-purple-700 disabled:bg-purple-800 disabled:cursor-not-allowed px-6 py-2 rounded-lg font-medium transition"
              >
                {isConnecting ? 'Connecting...' : 'Connect Wallet'}
              </button>
            )}
          </div>
        </div>

        {/* Mobile nav */}
        {isAuthenticated && (
          <nav className="md:hidden flex items-center gap-4 mt-4 overflow-x-auto pb-2">
            <Link href="/collection" className="text-gray-300 hover:text-white transition whitespace-nowrap">
              Collection
            </Link>
            <Link href="/shop" className="text-gray-300 hover:text-white transition whitespace-nowrap">
              Shop
            </Link>
            <Link href="/battle" className="text-gray-300 hover:text-white transition whitespace-nowrap">
              Battle
            </Link>
            <Link href="/tournament" className="text-gray-300 hover:text-white transition whitespace-nowrap">
              Tournaments
            </Link>
            <Link href="/agent" className="text-gray-300 hover:text-white transition whitespace-nowrap">
              AI Agent
            </Link>
          </nav>
        )}
      </div>
    </header>
  );
}
