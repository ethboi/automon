#!/bin/bash
# Run all 3 agents in parallel
# Usage: ./scripts/run-agents.sh

echo "Starting 3 AutoMon agents..."

# Agent 1: Nexus ⚡ (Aggressive Battler)
AGENT_NAME="Nexus ⚡" \
AI_PERSONALITY="Aggressive battler. Seeks fights, takes calculated risks, loves the arena. Bold and competitive." \
npm run agent:live &
PID1=$!

sleep 5

# Agent 2: Kira 🌙 (Collector)
AGENT_PRIVATE_KEY="0xe127ef027ce1997152b9ba84af64856b2269fbffb0429e1f3663a39f29ed73b9" \
AGENT_ADDRESS="0xEf86E433E13C3D898b2e730F87667f81e0619AeC" \
AGENT_NAME="Kira 🌙" \
AI_PERSONALITY="Careful collector. Hoards rare cards, avoids risky battles, explores for rare spawns. Patient and strategic." \
npm run agent:live &
PID2=$!

sleep 5

# Agent 3: Sage 🌿 (Farmer/Survivor)
AGENT_PRIVATE_KEY="0x08ca12512dd2f77989e394084f074b4b4819f6c35f5f09235c8b33e5af1ec7c9" \
AGENT_ADDRESS="0x8BEb4B395D5F1F53Bb51964228E3D4cBF8b3ac22" \
AGENT_NAME="Sage 🌿" \
AI_PERSONALITY="Nature-loving farmer. Focuses on health and sustainability. Farms, fishes, forages. Only fights when fully prepared." \
npm run agent:live &
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
