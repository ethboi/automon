'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';

interface DashboardAgent {
  name: string;
  address: string;
  online: boolean;
  currentAction?: string | null;
  currentLocation?: string | null;
}

interface ActionEvent {
  agent: string;
  action: string;
  reason: string;
  location?: string | null;
  timestamp: string;
  healthDelta?: number;
  moodDelta?: number;
}

interface ChatMsg {
  fromName: string;
  message: string;
  location?: string | null;
  timestamp: string;
}

function ago(value: string): string {
  const ms = Date.now() - new Date(value).getTime();
  const s = Math.max(1, Math.floor(ms / 1000));
  if (s < 60) return `${s}s ago`;
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  return `${Math.floor(s / 86400)}d ago`;
}

function shortAddr(addr: string): string {
  if (!addr) return 'Agent';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

export default function LocationLivePanel({ worldLabel }: { worldLabel: string }) {
  const [agents, setAgents] = useState<DashboardAgent[]>([]);
  const [events, setEvents] = useState<ActionEvent[]>([]);
  const [chat, setChat] = useState<ChatMsg[]>([]);

  const fetchData = useCallback(async () => {
    try {
      // Fetch agents from dashboard (for who's online)
      const [dashRes, locRes] = await Promise.all([
        fetch('/api/dashboard', { cache: 'no-store' }),
        fetch(`/api/location?name=${encodeURIComponent(worldLabel)}&limit=50`, { cache: 'no-store' }),
      ]);
      if (dashRes.ok) {
        const dashData = await dashRes.json();
        setAgents(dashData.agents || []);
      }
      if (locRes.ok) {
        const locData = await locRes.json();
        setEvents(locData.actions || []);
        setChat(locData.chat || []);
      }
    } catch {
      // Keep stale data
    }
  }, [worldLabel]);

  useEffect(() => {
    void fetchData();
    const iv = setInterval(() => void fetchData(), 10000);
    return () => clearInterval(iv);
  }, [fetchData]);

  const nameByAddress = useMemo(
    () => new Map((agents || []).map(a => [a.address.toLowerCase(), a.name || shortAddr(a.address)])),
    [agents],
  );

  const onlineHere = useMemo(
    () => agents.filter(a => a.online && a.currentLocation === worldLabel),
    [agents, worldLabel],
  );

  const visitsByAgent = useMemo(() => {
    const agentMap = new Map<string, { name: string; address: string; visits: ActionEvent[] }>();
    for (const event of events) {
      const key = (event.agent || '').toLowerCase();
      if (!key) continue;
      if (!agentMap.has(key)) {
        agentMap.set(key, {
          name: nameByAddress.get(key) || shortAddr(event.agent),
          address: event.agent,
          visits: [],
        });
      }
      const entry = agentMap.get(key)!;
      if (entry.visits.length < 10) entry.visits.push(event);
    }
    return Array.from(agentMap.values());
  }, [events, nameByAddress]);

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
                <div className="text-sm font-semibold text-cyan-300">{agent.name || shortAddr(agent.address)}</div>
                <div className="text-xs text-gray-400 mt-1">{agent.currentAction || 'wandering'}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card border border-white/10">
        <h2 className="text-lg font-bold text-white mb-3">Recent Actions ({events.length})</h2>
        {events.length === 0 ? (
          <p className="text-sm text-gray-400">No actions logged here yet.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {events.slice(0, 30).map((event, idx) => (
              <div key={`${event.agent}-${event.timestamp}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center gap-2">
                  <span className="text-xs text-cyan-300 font-semibold">{nameByAddress.get(event.agent?.toLowerCase()) || shortAddr(event.agent)}</span>
                  <span className="text-xs text-purple-400">{event.action === 'trading_token' ? 'trading $AUTOMON' : event.action}</span>
                  {event.healthDelta != null && event.healthDelta !== 0 && (
                    <span className={`text-[10px] font-mono ${event.healthDelta > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {event.healthDelta > 0 ? '+' : ''}{event.healthDelta}HP
                    </span>
                  )}
                  {event.moodDelta != null && event.moodDelta !== 0 && (
                    <span className={`text-[10px] font-mono ${event.moodDelta > 0 ? 'text-blue-400' : 'text-orange-400'}`}>
                      {event.moodDelta > 0 ? '+' : ''}{event.moodDelta} 😊
                    </span>
                  )}
                </div>
                <div className="text-xs text-gray-300 mt-1">{event.reason}</div>
                <div className="text-[11px] text-gray-500 mt-1">{ago(event.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card border border-white/10">
        <h2 className="text-lg font-bold text-white mb-3">Location Chat ({chat.length})</h2>
        {chat.length === 0 ? (
          <p className="text-sm text-gray-400">No chat messages at this location yet.</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {chat.map((msg, idx) => (
              <div key={`${msg.fromName}-${msg.timestamp}-${idx}`} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="text-xs text-cyan-300 font-semibold">{msg.fromName}</div>
                <div className="text-sm text-gray-200 mt-1">{msg.message}</div>
                <div className="text-[11px] text-gray-500 mt-1">{ago(msg.timestamp)}</div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section className="section-card border border-white/10 lg:col-span-3">
        <h2 className="text-lg font-bold text-white mb-3">Visits by Agent</h2>
        {visitsByAgent.length === 0 ? (
          <p className="text-sm text-gray-400">No visits logged at this location yet.</p>
        ) : (
          <div className="grid md:grid-cols-2 xl:grid-cols-3 gap-3">
            {visitsByAgent.map((agent) => (
              <div key={agent.address} className="rounded-xl border border-white/10 bg-white/[0.02] p-3">
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="text-sm font-semibold text-cyan-300">{agent.name}</div>
                  <div className="text-[11px] text-gray-500">{agent.visits.length} visits</div>
                </div>
                <div className="space-y-1.5">
                  {agent.visits.map((visit, idx) => (
                    <div key={`${visit.timestamp}-${idx}`} className="rounded-lg border border-white/5 bg-black/20 px-2 py-1.5">
                      <div className="text-xs text-white">{visit.action === 'trading_token' ? 'trading $AUTOMON' : visit.action}</div>
                      <div className="text-[11px] text-gray-400 mt-0.5 line-clamp-2">{visit.reason}</div>
                      <div className="text-[10px] text-gray-600 mt-0.5">{ago(visit.timestamp)}</div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
