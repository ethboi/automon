'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface DashboardAgent {
  name: string;
  address: string;
  online: boolean;
  currentAction?: string | null;
  currentLocation?: string | null;
}

interface DashboardEvent {
  agent: string;
  action: string;
  reason: string;
  location?: string | null;
  timestamp: string;
}

interface DashboardChat {
  fromName: string;
  message: string;
  location?: string | null;
  timestamp: string;
}

interface DashboardResponse {
  agents: DashboardAgent[];
  events: DashboardEvent[];
  chat: DashboardChat[];
}

function ago(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

export default function LocationLivePanel({ worldLabel }: { worldLabel: string }) {
  const [data, setData] = useState<DashboardResponse | null>(null);

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch('/api/dashboard', { cache: 'no-store' });
      if (!res.ok) return;
      const json = (await res.json()) as DashboardResponse;
      setData(json);
    } catch {
      // Keep stale data when polling fails.
    }
  }, []);

  useEffect(() => {
    void fetchData();
    const iv = setInterval(() => void fetchData(), 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const onlineHere = useMemo(
    () => (data?.agents || []).filter(a => a.online && a.currentLocation === worldLabel),
    [data?.agents, worldLabel],
  );

  const recentEvents = useMemo(
    () => (data?.events || []).filter(e => e.location === worldLabel).slice(0, 6),
    [data?.events, worldLabel],
  );

  const recentChat = useMemo(
    () => (data?.chat || []).filter(c => c.location === worldLabel).slice(-6).reverse(),
    [data?.chat, worldLabel],
  );

  return (
    <div className="grid lg:grid-cols-3 gap-4">
      <section className="section-card border border-white/10">
        <h2 className="text-lg font-bold text-white mb-3">Agents Here</h2>
        {onlineHere.length === 0 ? (
          <p className="text-sm text-gray-400">No online agents currently at this location.</p>
        ) : (
          <div className="space-y-2">
            {onlineHere.map(agent => (
              <div key={agent.address} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm font-semibold text-cyan-300">{agent.name || `${agent.address.slice(0, 6)}...${agent.address.slice(-4)}`}</div>
                <div className="text-xs text-gray-400 mt-1">{agent.currentAction || 'wandering'}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card border border-white/10">
        <h2 className="text-lg font-bold text-white mb-3">Recent Actions</h2>
        {recentEvents.length === 0 ? (
          <p className="text-sm text-gray-400">No recent actions logged here yet.</p>
        ) : (
          <div className="space-y-2">
            {recentEvents.map((event, idx) => (
              <div key={`${event.agent}-${event.timestamp}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-sm text-white font-medium">{event.action}</div>
                <div className="text-xs text-gray-300 mt-1">{event.reason}</div>
                <div className="text-[11px] text-gray-500 mt-1">{ago(event.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card border border-white/10">
        <h2 className="text-lg font-bold text-white mb-3">Location Chat</h2>
        {recentChat.length === 0 ? (
          <p className="text-sm text-gray-400">No chat messages tagged to this location yet.</p>
        ) : (
          <div className="space-y-2">
            {recentChat.map((msg, idx) => (
              <div key={`${msg.fromName}-${msg.timestamp}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-cyan-300 font-semibold">{msg.fromName}</div>
                <div className="text-sm text-gray-200 mt-1">{msg.message}</div>
                <div className="text-[11px] text-gray-500 mt-1">{ago(msg.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
