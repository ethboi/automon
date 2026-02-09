'use client';

import { useEffect, useState } from 'react';
import AgentProfileModal from '@/components/AgentProfileModal';

interface WorldUIProps {
  nearbyBuilding: string | null;
  onEnterBuilding?: () => void;
  onlineAgents?: OnlineAgent[];
  events?: EventData[];
  totalBattles?: number;
  totalCards?: number;
}

interface OnlineAgent {
  address: string;
  name: string;
  personality?: string;
  isAI: boolean;
  online?: boolean;
  stats?: { wins: number; losses: number; cards: number };
}

interface EventData {
  agent: string;
  action: string;
  reason: string;
  location: string | null;
  timestamp: string;
}

type Tab = 'agents' | 'feed';

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m`;
  return `${Math.floor(diff / 3600000)}h`;
}

export function WorldUI({ nearbyBuilding, onEnterBuilding, onlineAgents = [], events = [], totalBattles = 0, totalCards = 0 }: WorldUIProps) {
  const [selectedAgent, setSelectedAgent] = useState<string | null>(null);
  const [tab, setTab] = useState<Tab>('agents');

  const onlineCount = onlineAgents.filter(a => a.online).length;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.key === 'e' || e.key === 'E') && nearbyBuilding && onEnterBuilding) {
        onEnterBuilding();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [nearbyBuilding, onEnterBuilding]);

  return (
    <div className="absolute inset-0 pointer-events-none">
      {/* Top stats bar */}
      <div className="absolute top-4 left-4 right-4 flex justify-between items-start gap-4">
        <div className="flex flex-wrap gap-2 pointer-events-auto">
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
            <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
            <span className="text-sm font-bold text-green-400">{onlineCount}</span>
            <span className="text-xs text-gray-400">online</span>
          </div>
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-sm">⚔️</span>
            <span className="text-sm font-bold text-purple-400">{totalBattles}</span>
            <span className="text-xs text-gray-400">battles</span>
          </div>
          <div className="glass rounded-xl px-3 py-2 flex items-center gap-2">
            <span className="text-sm">🃏</span>
            <span className="text-sm font-bold text-amber-400">{totalCards}</span>
            <span className="text-xs text-gray-400">cards</span>
          </div>
        </div>

        {/* Controls hint */}
        <div className="glass rounded-xl px-4 py-3 hidden sm:block pointer-events-auto">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <div className="flex gap-0.5">
                {['W', 'A', 'S', 'D'].map((key) => (
                  <kbd key={key} className="w-6 h-6 bg-white/10 rounded flex items-center justify-center text-[10px] font-bold text-white border border-white/20">
                    {key}
                  </kbd>
                ))}
              </div>
              <span className="text-gray-400">Move</span>
            </div>
            <div className="w-px h-4 bg-white/10" />
            <div className="flex items-center gap-2">
              <span className="text-gray-400">🖱️ Click</span>
            </div>
          </div>
        </div>
      </div>

      {/* Mini-map */}
      <div className="absolute bottom-4 left-4 pointer-events-auto">
        <div className="glass rounded-2xl p-3">
          <div className="relative w-36 h-36 rounded-xl overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-emerald-900/50 to-green-900/50" />
            <div className="absolute inset-0 opacity-20" style={{
              backgroundImage: 'linear-gradient(rgba(255,255,255,0.1) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.1) 1px, transparent 1px)',
              backgroundSize: '18px 18px'
            }} />
            <div className="absolute inset-0">
              <div className="absolute left-1/2 top-[30%] bottom-[20%] w-3 bg-gray-600/40 -translate-x-1/2 rounded-full" />
              <div className="absolute top-[65%] left-[20%] right-[20%] h-3 bg-gray-600/40 -translate-y-1/2 rounded-full" />
            </div>
            {/* Arena */}
            <div className="absolute w-5 h-5 rounded-full flex items-center justify-center" style={{ left: '50%', top: '25%', transform: 'translate(-50%, -50%)' }}>
              <div className="absolute inset-0 bg-red-500 rounded-full animate-ping opacity-30" />
              <div className="relative w-full h-full bg-gradient-to-br from-red-400 to-red-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center">
                <span className="text-[8px]">⚔️</span>
              </div>
            </div>
            {/* Home */}
            <div className="absolute w-4 h-4 rounded-lg flex items-center justify-center" style={{ left: '25%', top: '65%', transform: 'translate(-50%, -50%)' }}>
              <div className="relative w-full h-full bg-gradient-to-br from-blue-400 to-blue-600 rounded-lg border-2 border-white shadow-lg flex items-center justify-center">
                <span className="text-[8px]">🏠</span>
              </div>
            </div>
            {/* Bank */}
            <div className="absolute w-4 h-4 rounded-lg flex items-center justify-center" style={{ left: '75%', top: '65%', transform: 'translate(-50%, -50%)' }}>
              <div className="relative w-full h-full bg-gradient-to-br from-yellow-400 to-amber-500 rounded-lg border-2 border-white shadow-lg flex items-center justify-center">
                <span className="text-[8px]">🏦</span>
              </div>
            </div>
            {/* Player */}
            <div className="absolute w-3 h-3 rounded-full" style={{ left: '50%', top: '75%', transform: 'translate(-50%, -50%)' }}>
              <div className="absolute inset-0 bg-purple-500 rounded-full animate-ping" />
              <div className="relative w-full h-full bg-purple-500 rounded-full border-2 border-white shadow-lg" />
            </div>
            <div className="absolute text-[9px] text-white font-bold drop-shadow-lg" style={{ left: '50%', top: '12%', transform: 'translateX(-50%)' }}>Arena</div>
            <div className="absolute text-[8px] text-white font-medium drop-shadow-lg" style={{ left: '25%', top: '80%', transform: 'translateX(-50%)' }}>Home</div>
            <div className="absolute text-[8px] text-white font-medium drop-shadow-lg" style={{ left: '75%', top: '80%', transform: 'translateX(-50%)' }}>Shop</div>
          </div>
        </div>
      </div>

      {/* Combined Panel — bottom right */}
      <div className="absolute bottom-4 right-4 pointer-events-auto w-72">
        <div className="glass rounded-2xl overflow-hidden">
          {/* Tabs */}
          <div className="flex border-b border-white/10">
            <button
              onClick={() => setTab('agents')}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === 'agents' ? 'text-cyan-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              🤖 Agents ({onlineCount})
            </button>
            <button
              onClick={() => setTab('feed')}
              className={`flex-1 px-3 py-2 text-xs font-semibold uppercase tracking-wide transition-colors ${
                tab === 'feed' ? 'text-cyan-400 bg-white/5' : 'text-gray-500 hover:text-gray-300'
              }`}
            >
              📡 Live Feed
            </button>
          </div>

          {/* Content */}
          <div className="p-3 max-h-56 overflow-y-auto">
            {tab === 'agents' ? (
              onlineAgents.length === 0 ? (
                <div className="text-xs text-gray-500 italic py-4 text-center">
                  No agents online.<br />
                  <span className="text-gray-600">Run <code className="bg-white/10 px-1 rounded">npm run agent:demo</code></span>
                </div>
              ) : (
                <div className="space-y-1.5">
                  {onlineAgents
                    .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0))
                    .map((agent) => (
                    <button
                      key={agent.address}
                      onClick={() => setSelectedAgent(agent.address)}
                      className="flex items-center justify-between w-full hover:bg-white/5 rounded-lg px-2 py-1.5 transition-colors"
                    >
                      <div className="flex items-center gap-2">
                        <div className={`w-2 h-2 rounded-full ${agent.online ? 'bg-green-500' : 'bg-gray-600'}`} />
                        <span className="text-sm text-cyan-400 font-medium">{agent.name}</span>
                        <span className="text-[10px] text-gray-600">{agent.personality}</span>
                      </div>
                      {agent.stats && (
                        <span className="text-[10px] text-gray-500">
                          {agent.stats.wins}W {agent.stats.losses}L
                        </span>
                      )}
                    </button>
                  ))}
                </div>
              )
            ) : (
              events.length === 0 ? (
                <div className="text-xs text-gray-500 italic py-4 text-center">Waiting for activity...</div>
              ) : (
                <div className="space-y-1">
                  {events.slice(0, 20).map((e, i) => {
                    const agentName = onlineAgents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || e.agent?.slice(0, 8);
                    return (
                      <div key={i} className="text-xs leading-relaxed">
                        <span className="text-gray-600">{timeAgo(e.timestamp)} </span>
                        <span className="text-cyan-400 font-medium">{agentName}</span>
                        <span className="text-gray-400"> {e.action}</span>
                        {e.location && <span className="text-gray-600"> @ {e.location}</span>}
                        {e.reason && (
                          <div className="text-gray-600 italic pl-4 truncate" title={e.reason}>💭 {e.reason}</div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )
            )}
          </div>
        </div>
      </div>

      {/* Interaction prompt */}
      {nearbyBuilding && (
        <div className="absolute bottom-6 left-1/2 transform -translate-x-1/2 pointer-events-auto animate-bounce-subtle">
          <button onClick={onEnterBuilding} className="relative group">
            <div className="absolute inset-0 bg-purple-500/30 blur-xl rounded-2xl" />
            <div className="relative glass-purple rounded-2xl px-8 py-4 flex items-center gap-4 border border-purple-500/30 shadow-xl hover:shadow-purple-500/40 transition-all duration-300 group-hover:scale-105">
              <div className="flex items-center gap-2">
                <kbd className="w-8 h-8 bg-purple-600 rounded-lg flex items-center justify-center text-sm font-bold text-white border border-purple-400">E</kbd>
                <span className="text-gray-400">or</span>
                <span className="text-white font-medium">Click</span>
              </div>
              <div className="w-px h-6 bg-white/20" />
              <span className="text-white font-semibold text-lg">Enter {nearbyBuilding}</span>
            </div>
          </button>
        </div>
      )}

      {/* Agent Profile Modal */}
      {selectedAgent && (
        <AgentProfileModal address={selectedAgent} onClose={() => setSelectedAgent(null)} />
      )}
    </div>
  );
}
