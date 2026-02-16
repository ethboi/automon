#!/bin/bash
# Run all 3 agents in parallel
# Usage: ./scripts/run-agents.sh

echo "Starting 3 AutoMon agents..."

# Agent 1: Nexus ⚡ (Aggressive Battler)
AGENT_NAME="Nexus ⚡" \
AI_PERSONALITY="Aggressive battler. Seeks fights, takes calculated risks, loves the arena. Bold and competitive." \
npm run agent:auto &
PID1=$!

sleep 5

# Agent 2: Kira 🌙 (Collector)
if [ -z "$AGENT2_PRIVATE_KEY" ] || [ -z "$AGENT2_ADDRESS" ]; then
  echo "Missing AGENT2_PRIVATE_KEY or AGENT2_ADDRESS"
  exit 1
fi

AGENT_PRIVATE_KEY="$AGENT2_PRIVATE_KEY" \
AGENT_ADDRESS="$AGENT2_ADDRESS" \
AGENT_NAME="Kira 🌙" \
AI_PERSONALITY="Careful collector. Hoards rare cards, avoids risky battles, explores for rare spawns. Patient and strategic." \
npm run agent:auto &
PID2=$!

sleep 5

# Agent 3: Sage 🌿 (Farmer/Survivor)
if [ -z "$AGENT3_PRIVATE_KEY" ] || [ -z "$AGENT3_ADDRESS" ]; then
  echo "Missing AGENT3_PRIVATE_KEY or AGENT3_ADDRESS"
  exit 1
fi

AGENT_PRIVATE_KEY="$AGENT3_PRIVATE_KEY" \
AGENT_ADDRESS="$AGENT3_ADDRESS" \
AGENT_NAME="Sage 🌿" \
AI_PERSONALITY="Nature-loving farmer. Focuses on health and sustainability. Farms, fishes, forages. Only fights when fully prepared." \
npm run agent:auto &
PID3=$!

echo ""
echo "Agents running:"
echo "  Nexus ⚡  (PID $PID1) - Aggressive Battler"
echo "  Kira 🌙   (PID $PID2) - Collector"
echo "  Sage 🌿   (PID $PID3) - Farmer"
echo ""
echo "Press Ctrl+C to stop all agents"

trap "kill $PID1 $PID2 $PID3 2>/dev/null; exit" SIGINT SIGTERM
wait
