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
      <div className="container mx-auto px-4 py-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-8">
            <Link href="/" className="text-2xl font-bold text-white">
              Auto<span className="text-purple-500">Mon</span>
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
