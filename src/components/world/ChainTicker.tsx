'use client';

import { useState, useEffect, useRef } from 'react';

const TX_ICONS: Record<string, string> = {
  mint_pack: '📦',
  open_pack: '🎴',
  battle_create: '⚔️',
  battle_settle: '🏆',
  battle_join: '🤝',
  nft_mint: '💎',
  escrow_deposit: '🔒',
  escrow_settle: '🔓',
};

interface TxData {
  txHash: string;
  type: string;
  from: string;
  description: string;
  explorerUrl: string;
  timestamp: string;
  amount?: string | null;
}

interface Agent {
  name?: string;
  address?: string;
}

function shortAddr(addr?: string) {
  if (!addr) return '???';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export function ChainTicker({ transactions, agents }: { transactions: TxData[]; agents: Agent[] }) {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const prevTxRef = useRef<string | null>(null);

  // Notable txs: settles, mints, escrow deposits
  const notable = transactions.filter(t => 
    ['battle_settle', 'mint_pack', 'escrow_deposit', 'battle_join'].includes(t.type)
  ).slice(0, 10);

  useEffect(() => {
    if (notable.length === 0) return;

    // Check if new tx appeared
    const latestHash = notable[0]?.txHash;
    if (latestHash && latestHash !== prevTxRef.current) {
      prevTxRef.current = latestHash;
      setIsAnimating(true);
      setCurrentIndex(0);
      setTimeout(() => setIsAnimating(false), 500);
    }

    // Rotate through txs every 5s
    const timer = setInterval(() => {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentIndex(prev => (prev + 1) % notable.length);
        setIsAnimating(false);
      }, 300);
    }, 5000);

    return () => clearInterval(timer);
  }, [notable.length, notable[0]?.txHash]);

  if (notable.length === 0) return null;

  const tx = notable[currentIndex];
  if (!tx) return null;

  const agentName = agents.find(a => a.address?.toLowerCase() === tx.from?.toLowerCase())?.name || shortAddr(tx.from);
  const icon = TX_ICONS[tx.type] || '📝';

  return (
    <div className="absolute top-2 left-1/2 -translate-x-1/2 z-30 pointer-events-auto">
      <a
        href={tx.explorerUrl}
        target="_blank"
        rel="noopener noreferrer"
        className={`flex items-center gap-2 bg-black/70 backdrop-blur-md border border-white/10 rounded-full px-3 py-1.5 sm:px-4 sm:py-2 transition-all duration-300 hover:border-purple-500/50 ${
          isAnimating ? 'opacity-0 translate-y-2' : 'opacity-100 translate-y-0'
        }`}
      >
        <span className="text-sm">{icon}</span>
        <span className="text-xs sm:text-sm text-gray-300">
          <span className="text-cyan-400 font-medium">{agentName}</span>
          {' · '}
          <span>{tx.description}</span>
        </span>
        {tx.amount && (
          <span className={`text-xs font-mono font-bold ${tx.type === 'battle_settle' ? 'text-emerald-400' : 'text-yellow-400'}`}>
            {tx.amount} MON
          </span>
        )}
        <span className="text-[10px] text-gray-600 font-mono">{tx.txHash.slice(0, 8)}…</span>
      </a>
    </div>
  );
}
