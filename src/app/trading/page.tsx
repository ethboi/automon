'use client';

import { useEffect, useState, useCallback } from 'react';

interface Trade {
  address: string;
  type: string;
  amount: string;
  txHash: string | null;
  details: { token?: string; tokensReceived?: string; monReceived?: string };
  createdAt: string;
  agentName?: string;
}

interface AgentHolding {
  address: string;
  name: string;
  tokenBalance: string;
  monBalance: string;
}

const PUBLIC_NETWORK = (process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase();
const TOKEN_ADDRESS = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS_MAINNET
    : process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS_TESTNET) ||
  process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS ||
  ''
);
const NAD_BASE = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_NAD_BASE_URL_MAINNET
    : process.env.NEXT_PUBLIC_NAD_BASE_URL_TESTNET) ||
  process.env.NEXT_PUBLIC_NAD_BASE_URL ||
  'https://testnet.nad.fun'
).replace(/\/+$/, '');
const EXPLORER_BASE = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_MAINNET
    : process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL_TESTNET) ||
  process.env.NEXT_PUBLIC_BLOCK_EXPLORER_URL ||
  'https://testnet.monadexplorer.com'
).replace(/\/+$/, '');

function timeAgo(d: string): string {
  const s = Math.floor((Date.now() - new Date(d).getTime()) / 1000);
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortAddr(a: string) { return `${a.slice(0, 6)}…${a.slice(-4)}`; }

export default function TradingPage() {
  const [trades, setTrades] = useState<Trade[]>([]);
  const [agents, setAgents] = useState<AgentHolding[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    try {
      const [txRes, agentsRes] = await Promise.all([
        fetch('/api/transactions?type=token_buy,token_sell&limit=50'),
        fetch('/api/dashboard'),
      ]);

      if (txRes.ok) {
        const txData = await txRes.json();
        setTrades(txData.transactions || []);
      }

      if (agentsRes.ok) {
        const dashData = await agentsRes.json();
        const agentList = (dashData.agents || []).map((a: Record<string, unknown>) => ({
          address: a.address as string,
          name: a.name as string,
          tokenBalance: (a.tokenBalance as string) || '0',
          monBalance: (a.balance as string) || '0',
        }));
        setAgents(agentList);
      }
    } catch (e) {
      console.error('Failed to fetch trading data:', e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchData();
    const iv = setInterval(fetchData, 15000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const totalHoldings = agents.reduce((sum, a) => sum + parseFloat(a.tokenBalance || '0'), 0);
  const buyCount = trades.filter(t => t.type === 'token_buy').length;
  const sellCount = trades.filter(t => t.type === 'token_sell').length;
  const totalVolume = trades.reduce((sum, t) => sum + parseFloat(t.amount || '0'), 0);

  if (loading) return (
    <div className="page-container flex items-center justify-center min-h-[60vh]">
      <div className="text-center">
        <div className="spinner mb-4" />
        <p className="text-gray-500 text-sm">Loading trading data…</p>
      </div>
    </div>
  );

  return (
    <div className="page-container page-transition">
      {/* Header */}
      <div className="mb-6 sm:mb-8">
        <div className="flex items-center gap-3 mb-2">
          <span className="text-3xl">📈</span>
          <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
            $AUTOMON Trading
          </h1>
        </div>
        <p className="text-sm text-gray-400">Agents trade tokens on the nad.fun bonding curve</p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-4 mb-6">
        <StatCard icon="💰" label="Total Holdings" value={totalHoldings > 0 ? `${totalHoldings.toFixed(0)}` : '—'} sub="$AUTOMON" color="text-emerald-400" />
        <StatCard icon="📊" label="Total Volume" value={totalVolume > 0 ? `${totalVolume.toFixed(3)}` : '—'} sub="MON traded" color="text-yellow-400" />
        <StatCard icon="📈" label="Buys" value={String(buyCount)} sub="transactions" color="text-green-400" />
        <StatCard icon="📉" label="Sells" value={String(sellCount)} sub="transactions" color="text-red-400" />
      </div>

      {/* Token Info */}
      {TOKEN_ADDRESS && (
        <div className="bg-gradient-to-r from-emerald-500/10 to-cyan-500/10 border border-emerald-500/20 rounded-xl p-4 mb-6">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div>
              <div className="text-sm font-semibold text-white mb-1">$AUTOMON Token</div>
              <div className="text-xs text-gray-400 font-mono">{TOKEN_ADDRESS}</div>
            </div>
            <a
              href={`${NAD_BASE}/token/${TOKEN_ADDRESS}`}
              target="_blank"
              rel="noopener noreferrer"
              className="bg-emerald-600 hover:bg-emerald-500 text-white text-sm font-semibold px-4 py-2 rounded-lg transition"
            >
              View on nad.fun ↗
            </a>
          </div>
        </div>
      )}

      {!TOKEN_ADDRESS && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 rounded-xl p-4 mb-6 text-center">
          <div className="text-lg mb-1">🚀</div>
          <div className="text-sm font-semibold text-yellow-400">Token Launch Pending</div>
          <p className="text-xs text-gray-400 mt-1">$AUTOMON will be launched on nad.fun soon. Agents are ready to trade!</p>
        </div>
      )}

      <div className="grid lg:grid-cols-3 gap-4 sm:gap-6">
        {/* Agent Holdings */}
        <div className="lg:col-span-1">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            🤖 Agent Holdings
          </h2>
          <div className="space-y-2">
            {agents.map(agent => {
              const tokenBal = parseFloat(agent.tokenBalance || '0');
              const monBal = parseFloat(agent.monBalance || '0');
              return (
                <div key={agent.address} className="bg-gray-900/60 border border-white/5 rounded-xl p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-bold text-white">{agent.name || shortAddr(agent.address)}</span>
                    <span className="text-xs text-gray-500 font-mono">{shortAddr(agent.address)}</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2 text-center">
                    <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                      <div className="text-sm font-bold text-yellow-400">{monBal.toFixed(3)}</div>
                      <div className="text-[10px] text-gray-500">MON</div>
                    </div>
                    <div className="bg-white/[0.03] rounded-lg px-2 py-1.5">
                      <div className={`text-sm font-bold ${tokenBal > 0 ? 'text-emerald-400' : 'text-gray-500'}`}>
                        {tokenBal > 0 ? tokenBal.toFixed(0) : '0'}
                      </div>
                      <div className="text-[10px] text-gray-500">$AUTOMON</div>
                    </div>
                  </div>
                </div>
              );
            })}
            {agents.length === 0 && (
              <div className="text-center py-8 text-gray-500 text-sm">No agents online</div>
            )}
          </div>
        </div>

        {/* Trade History */}
        <div className="lg:col-span-2">
          <h2 className="text-lg font-bold text-white mb-3 flex items-center gap-2">
            📜 Trade History
          </h2>
          {trades.length === 0 ? (
            <div className="bg-gray-900/60 border border-white/5 rounded-xl p-8 text-center">
              <div className="text-4xl mb-3 opacity-50">📊</div>
              <h3 className="text-base font-semibold text-white mb-1">No trades yet</h3>
              <p className="text-sm text-gray-400">Agents will start trading once $AUTOMON launches</p>
            </div>
          ) : (
            <div className="bg-gray-900/60 border border-white/5 rounded-xl overflow-hidden">
              <div className="divide-y divide-white/5">
                {trades.map((trade, i) => {
                  const isBuy = trade.type === 'token_buy';
                  const agentName = trade.agentName || shortAddr(trade.address);
                  return (
                    <div key={i} className="px-3 sm:px-4 py-3 hover:bg-white/[0.02] transition">
                      <div className="flex items-center justify-between gap-2 mb-1">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className={`text-sm ${isBuy ? 'text-green-400' : 'text-red-400'}`}>
                            {isBuy ? '📈' : '📉'}
                          </span>
                          <span className="text-sm font-semibold text-white truncate">{agentName}</span>
                          <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${
                            isBuy ? 'bg-green-500/20 text-green-400' : 'bg-red-500/20 text-red-400'
                          }`}>
                            {isBuy ? 'BUY' : 'SELL'}
                          </span>
                        </div>
                        <span className="text-[10px] text-gray-600 shrink-0">{timeAgo(trade.createdAt)}</span>
                      </div>
                      <div className="flex items-center gap-3 text-xs text-gray-400">
                        {isBuy ? (
                          <span>Spent <span className="text-yellow-400 font-semibold">{trade.amount} MON</span> → <span className="text-emerald-400 font-semibold">{trade.details.tokensReceived || '?'} $AUTOMON</span></span>
                        ) : (
                          <span>Sold <span className="text-emerald-400 font-semibold">{trade.amount} $AUTOMON</span> → <span className="text-yellow-400 font-semibold">{trade.details.monReceived || '?'} MON</span></span>
                        )}
                      </div>
                      {trade.txHash && (
                        <a
                          href={`${EXPLORER_BASE}/tx/${trade.txHash}`}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[10px] text-purple-500 hover:text-purple-400 mt-1 inline-block"
                          onClick={e => e.stopPropagation()}
                        >
                          view tx ↗
                        </a>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ icon, label, value, sub, color }: { icon: string; label: string; value: string; sub: string; color: string }) {
  return (
    <div className="bg-gray-900/60 border border-white/5 rounded-xl p-3 text-center">
      <div className="text-lg mb-1">{icon}</div>
      <div className={`text-xl sm:text-2xl font-bold ${color}`}>{value}</div>
      <div className="text-[10px] text-gray-500 uppercase tracking-wider">{sub}</div>
      <div className="text-[10px] text-gray-600 mt-0.5">{label}</div>
    </div>
  );
}
