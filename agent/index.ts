#!/usr/bin/env npx tsx
/**
 * AutoMon Unified Agent
 *
 * Entry point that dispatches to either:
 *   --mode auto   : Autonomous decision loop (buys packs, joins battles, enters tournaments)
 *   --mode manual : Interactive CLI with slash commands and AI chat (default)
 *
 * Usage:
 *   npm run agent -- --env agent1
 *   npm run agent:auto -- --env agent2
 */

interface CliArgs {
  mode: 'manual' | 'auto';
  envName: string;
}

function parseArgs(): CliArgs {
  const args = process.argv.slice(2);
  let mode: 'manual' | 'auto' = 'manual';
  let envName = 'local';

  const modeIdx = args.indexOf('--mode');
  if (modeIdx !== -1 && args[modeIdx + 1]?.toLowerCase() === 'auto') {
    mode = 'auto';
  }

  const envIdx = args.indexOf('--env');
  if (envIdx !== -1 && args[envIdx + 1]) {
    envName = args[envIdx + 1].toLowerCase();
  }

  return { mode, envName };
}

async function main(): Promise<void> {
  const { mode, envName } = parseArgs();

  // Must be set before importing config-dependent modules.
  process.env.AGENT_ENV = envName;

  if (mode === 'auto') {
    const { runAutoLoop } = await import('./loop');
    await runAutoLoop();
  } else {
    const { runCLI } = await import('./cli');
    await runCLI();
  }
}

main().catch(error => {
  console.error('Fatal error:', error);
  process.exit(1);
});
