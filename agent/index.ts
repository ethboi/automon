#!/usr/bin/env npx tsx
/**
 * AutoMon Unified Agent
 *
 * Entry point that dispatches to either:
 *   --mode auto   : Autonomous decision loop (buys packs, joins battles, enters tournaments)
 *   --mode manual : Interactive CLI with slash commands and AI chat (default)
 *
 * Usage:
 *   npm run agent          # interactive CLI (default)
 *   npm run agent:auto     # autonomous loop
 */

import { runCLI } from './cli';
import { runAutoLoop } from './loop';

// Parse --mode argument
function getMode(): 'manual' | 'auto' {
  const args = process.argv.slice(2);
  const modeIdx = args.indexOf('--mode');
  if (modeIdx !== -1 && args[modeIdx + 1]) {
    const mode = args[modeIdx + 1].toLowerCase();
    if (mode === 'auto') return 'auto';
  }
  return 'manual';
}

const mode = getMode();

if (mode === 'auto') {
  runAutoLoop().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
} else {
  runCLI().catch(error => {
    console.error('Fatal error:', error);
    process.exit(1);
  });
}
