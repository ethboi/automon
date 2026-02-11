// PM2 config — secrets loaded from .env files, not hardcoded
const path = require('path');
const fs = require('fs');

function loadEnv(file) {
  const env = {};
  try {
    const lines = fs.readFileSync(path.join(__dirname, file), 'utf8').split('\n');
    for (const line of lines) {
      const m = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/);
      if (m) env[m[1]] = m[2];
    }
  } catch {}
  return env;
}

const base = loadEnv('.env.local');
const shared = {
  MONGODB_URI: base.MONGODB_URI,
  ESCROW_CONTRACT_ADDRESS: base.ESCROW_CONTRACT_ADDRESS,
  AUTOMON_NFT_ADDRESS: base.AUTOMON_NFT_ADDRESS,
  ANTHROPIC_API_KEY: base.ANTHROPIC_API_KEY,
  OPENAI_API_KEY: base.OPENAI_API_KEY,
  JWT_SECRET: base.JWT_SECRET,
  NEXT_PUBLIC_MONAD_RPC: base.NEXT_PUBLIC_MONAD_RPC,
  NEXT_PUBLIC_APP_URL: base.NEXT_PUBLIC_APP_URL,
};

module.exports = {
  apps: [
    {
      name: 'nexus',
      script: 'npx',
      args: 'tsx agent/live.ts',
      cwd: __dirname,
      env: { ...shared, AGENT_PRIVATE_KEY: base.AGENT_PRIVATE_KEY },
      max_memory_restart: '256M',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
    },
    {
      name: 'atlas',
      script: 'npx',
      args: 'tsx agent/live.ts',
      cwd: __dirname,
      env: {
        ...shared,
        ...loadEnv('.env.agent1.local'),
        AGENT_NAME: 'Atlas Drift',
        AI_PERSONALITY: 'Bold fighter, aggressive battler',
      },
      max_memory_restart: '256M',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
    },
    {
      name: 'pyre',
      script: 'npx',
      args: 'tsx agent/live.ts',
      cwd: __dirname,
      env: {
        ...shared,
        ...loadEnv('.env.agent3.local'),
        AGENT_NAME: 'Pyre Scout',
        AI_PERSONALITY: 'Cautious strategist, defensive player',
      },
      max_memory_restart: '256M',
      restart_delay: 5000,
      exp_backoff_restart_delay: 1000,
    },
  ],
};
