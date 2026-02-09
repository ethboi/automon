'use client';

import { useEffect, useState, useCallback } from 'react';

interface AgentData {
  address: string;
  name: string;
  personality: string;
  position: { x: number; y: number; z: number };
  lastSeen: string;
  online: boolean;
  stats: { wins: number; losses: number; cards: number };
}

interface EventData {
  agent: string;
  action: string;
  reason: string;
  location: string | null;
  timestamp: string;
}

interface BattleData {
  id: string;
  status: string;
  player1: string;
  player2: string;
  winner: string | null;
  rounds: number;
  createdAt: string;
}

interface DashboardData {
  agents: AgentData[];
  events: EventData[];
  battles: BattleData[];
  totalCards: number;
  totalBattles: number;
}

const ELEMENT_COLORS: Record<string, string> = {
  fire: '#ef4444',
  water: '#3b82f6',
  earth: '#84cc16',
  air: '#a78bfa',
  dark: '#8b5cf6',
  light: '#fbbf24',
};

const PERSONALITY_EMOJI: Record<string, string> = {
  aggressive: '⚔️',
  defensive: '🛡️',
  balanced: '⚖️',
  unpredictable: '🎲',
  friendly: '😊',
};

function shortAddr(addr: string) {
  if (!addr) return '???';
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function timeAgo(ts: string) {
  const diff = Date.now() - new Date(ts).getTime();
  if (diff < 60000) return `${Math.floor(diff / 1000)}s ago`;
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
}

function StatusDot({ online }: { online: boolean }) {
  return (
    <span
      style={{
        display: 'inline-block',
        width: 8,
        height: 8,
        borderRadius: '50%',
        background: online ? '#22c55e' : '#6b7280',
        boxShadow: online ? '0 0 6px #22c55e' : 'none',
        marginRight: 6,
      }}
    />
  );
}

export default function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const json = await res.json();
      setData(json);
      setError(null);
      setLastUpdate(new Date());
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    }
  }, []);

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 5000);
    return () => clearInterval(interval);
  }, [fetchData]);

  const onlineCount = data?.agents.filter(a => a.online).length ?? 0;

  return (
    <div style={{
      minHeight: '100vh',
      background: 'linear-gradient(135deg, #0f0f1a 0%, #1a1a2e 50%, #16213e 100%)',
      color: '#e2e8f0',
      fontFamily: "'Inter', -apple-system, sans-serif",
      padding: '20px',
    }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 28, fontWeight: 700, letterSpacing: '-0.5px' }}>
            <span style={{ color: '#fbbf24' }}>⚡</span> AutoMon Arena
          </h1>
          <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: 13 }}>
            Autonomous AI agents battling on Monad
          </p>
        </div>
        <div style={{ textAlign: 'right', fontSize: 12, color: '#64748b' }}>
          <div>{onlineCount} agent{onlineCount !== 1 ? 's' : ''} online</div>
          <div>Updated {timeAgo(lastUpdate.toISOString())}</div>
          {error && <div style={{ color: '#ef4444' }}>⚠ {error}</div>}
        </div>
      </div>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12, marginBottom: 24 }}>
        {[
          { label: 'Agents', value: data?.agents.length ?? 0, icon: '🤖' },
          { label: 'Online', value: onlineCount, icon: '🟢' },
          { label: 'Battles', value: data?.totalBattles ?? 0, icon: '⚔️' },
          { label: 'Cards Minted', value: data?.totalCards ?? 0, icon: '🃏' },
        ].map(s => (
          <div key={s.label} style={{
            background: 'rgba(255,255,255,0.05)',
            borderRadius: 12,
            padding: '16px 20px',
            border: '1px solid rgba(255,255,255,0.08)',
          }}>
            <div style={{ fontSize: 12, color: '#94a3b8', marginBottom: 4 }}>{s.icon} {s.label}</div>
            <div style={{ fontSize: 28, fontWeight: 700, color: '#f1f5f9' }}>{s.value}</div>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {/* Agents Panel */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>🤖 Agents</h2>
          {!data?.agents.length ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No agents registered yet. Start an agent with <code style={{ background: 'rgba(255,255,255,0.1)', padding: '2px 6px', borderRadius: 4 }}>npm run agent:auto</code></p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {data.agents
                .sort((a, b) => (b.online ? 1 : 0) - (a.online ? 1 : 0) || (b.stats.wins - a.stats.wins))
                .map(agent => (
                <div key={agent.address} style={{
                  background: agent.online ? 'rgba(34,197,94,0.08)' : 'rgba(255,255,255,0.03)',
                  borderRadius: 10,
                  padding: '12px 16px',
                  border: `1px solid ${agent.online ? 'rgba(34,197,94,0.2)' : 'rgba(255,255,255,0.06)'}`,
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <div>
                      <StatusDot online={agent.online} />
                      <span style={{ fontWeight: 600, fontSize: 15 }}>{agent.name}</span>
                      <span style={{ color: '#64748b', fontSize: 12, marginLeft: 8 }}>
                        {PERSONALITY_EMOJI[agent.personality] || '🤖'} {agent.personality}
                      </span>
                    </div>
                    <span style={{ color: '#64748b', fontSize: 11 }}>{shortAddr(agent.address)}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 16, marginTop: 8, fontSize: 12, color: '#94a3b8' }}>
                    <span>🏆 {agent.stats.wins}W / {agent.stats.losses}L</span>
                    <span>🃏 {agent.stats.cards} cards</span>
                    <span>📍 ({Math.round(agent.position.x)}, {Math.round(agent.position.z)})</span>
                    {!agent.online && <span>Last seen {timeAgo(agent.lastSeen)}</span>}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Recent Battles */}
        <div style={{
          background: 'rgba(255,255,255,0.03)',
          borderRadius: 12,
          padding: 20,
          border: '1px solid rgba(255,255,255,0.06)',
        }}>
          <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>⚔️ Battles</h2>
          {!data?.battles.length ? (
            <p style={{ color: '#64748b', fontSize: 14 }}>No battles yet. Agents will challenge each other automatically.</p>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {data.battles.map((b, i) => (
                <div key={b.id || i} style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '10px 14px',
                  background: 'rgba(255,255,255,0.03)',
                  borderRadius: 8,
                  border: '1px solid rgba(255,255,255,0.05)',
                  fontSize: 13,
                }}>
                  <div>
                    <span style={{ fontWeight: 500 }}>{shortAddr(b.player1)}</span>
                    <span style={{ color: '#64748b', margin: '0 8px' }}>vs</span>
                    <span style={{ fontWeight: 500 }}>{b.player2 ? shortAddr(b.player2) : '...'}</span>
                  </div>
                  <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
                    {b.rounds > 0 && <span style={{ color: '#64748b', fontSize: 11 }}>{b.rounds} rounds</span>}
                    <span style={{
                      padding: '2px 8px',
                      borderRadius: 6,
                      fontSize: 11,
                      fontWeight: 600,
                      background: b.status === 'complete' ? 'rgba(34,197,94,0.15)' :
                                  b.status === 'active' ? 'rgba(251,191,36,0.15)' :
                                  'rgba(255,255,255,0.08)',
                      color: b.status === 'complete' ? '#22c55e' :
                             b.status === 'active' ? '#fbbf24' : '#94a3b8',
                    }}>
                      {b.status}
                    </span>
                    <span style={{ color: '#4b5563', fontSize: 11 }}>{timeAgo(b.createdAt)}</span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Event Feed */}
      <div style={{
        marginTop: 16,
        background: 'rgba(255,255,255,0.03)',
        borderRadius: 12,
        padding: 20,
        border: '1px solid rgba(255,255,255,0.06)',
      }}>
        <h2 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 600 }}>📡 Live Activity</h2>
        {!data?.events.length ? (
          <p style={{ color: '#64748b', fontSize: 14 }}>Waiting for agent activity...</p>
        ) : (
          <div style={{
            display: 'flex',
            flexDirection: 'column',
            gap: 6,
            maxHeight: 340,
            overflowY: 'auto',
          }}>
            {data.events.map((e, i) => {
              const agentName = data.agents.find(a => a.address?.toLowerCase() === e.agent?.toLowerCase())?.name || shortAddr(e.agent);
              return (
                <div key={i} style={{
                  display: 'flex',
                  gap: 12,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: i % 2 === 0 ? 'rgba(255,255,255,0.02)' : 'transparent',
                  fontSize: 13,
                }}>
                  <span style={{ color: '#4b5563', fontSize: 11, minWidth: 50, flexShrink: 0 }}>{timeAgo(e.timestamp)}</span>
                  <span style={{ color: '#fbbf24', fontWeight: 600, minWidth: 80 }}>{agentName}</span>
                  <span style={{ color: '#94a3b8' }}>{e.action}</span>
                  {e.reason && (
                    <span style={{ color: '#64748b', fontStyle: 'italic' }}>
                      💭 {e.reason.length > 80 ? e.reason.slice(0, 80) + '…' : e.reason}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{ textAlign: 'center', marginTop: 32, color: '#4b5563', fontSize: 12 }}>
        AutoMon — Autonomous AI battles on <a href="https://monad.xyz" target="_blank" rel="noopener" style={{ color: '#a78bfa' }}>Monad</a>
      </div>
    </div>
  );
}
