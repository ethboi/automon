// In-memory store for online agents (positions are ephemeral)

interface AgentData {
  address: string;
  name: string;
  personality: string;
  isAI: boolean;
  position: { x: number; y: number; z: number };
  lastSeen: Date;
}

const agents = new Map<string, AgentData>();

// Clean up agents not seen in 30 seconds
setInterval(() => {
  const now = Date.now();
  for (const [address, agent] of agents) {
    if (now - agent.lastSeen.getTime() > 30000) {
      agents.delete(address);
    }
  }
}, 10000);

export function registerAgent(
  address: string,
  name: string,
  personality: string
): AgentData {
  const agent: AgentData = {
    address: address.toLowerCase(),
    name,
    personality,
    isAI: true,
    position: { x: 0, y: 0, z: 8 },
    lastSeen: new Date(),
  };
  agents.set(address.toLowerCase(), agent);
  return agent;
}

export function updateAgentPosition(
  address: string,
  position: { x: number; y: number; z: number }
): boolean {
  const agent = agents.get(address.toLowerCase());
  if (agent) {
    agent.position = position;
    agent.lastSeen = new Date();
    return true;
  }
  return false;
}

export function getOnlineAgents(): AgentData[] {
  const thirtySecondsAgo = Date.now() - 30000;
  return Array.from(agents.values()).filter(
    (agent) => agent.lastSeen.getTime() > thirtySecondsAgo
  );
}
