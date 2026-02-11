/**
 * Trading Service — wraps nad.fun SDK for agent token trading
 */
import { initSDK, parseEther, formatEther, type NadFunSDK } from '@nadfun/sdk';
import type { Address, Hex } from 'viem';

const RPC_URL = process.env.MONAD_RPC_URL || 'https://testnet-rpc.monad.xyz';
const NETWORK = 'testnet' as const;

// Token address — set after launch
const TOKEN_ADDRESS = (process.env.AUTOMON_TOKEN_ADDRESS || '') as Address;

// Cache SDK instances per key
const sdkCache = new Map<string, NadFunSDK>();

function getSDK(privateKey: string): NadFunSDK {
  if (sdkCache.has(privateKey)) return sdkCache.get(privateKey)!;
  const sdk = initSDK({
    rpcUrl: RPC_URL,
    privateKey: privateKey as `0x${string}`,
    network: NETWORK,
  });
  sdkCache.set(privateKey, sdk);
  return sdk;
}

export interface TokenQuote {
  price: string;       // price per token in MON
  amountOut: string;   // tokens you'd get for 0.01 MON
}

export interface TradeResult {
  txHash: string;
  amountIn: string;
  estimatedOut: string;
  action: 'buy' | 'sell';
}

/**
 * Get current token price (quote for a small buy)
 */
export async function getTokenPrice(privateKey: string): Promise<TokenQuote> {
  if (!TOKEN_ADDRESS) throw new Error('AUTOMON_TOKEN_ADDRESS not set');
  const sdk = getSDK(privateKey);

  // Quote: how many tokens for 0.01 MON?
  const smallAmount = parseEther('0.01');
  const quote = await sdk.getAmountOut(TOKEN_ADDRESS, smallAmount, true);
  const tokensOut = parseFloat(formatEther(quote.amount));
  const pricePerToken = tokensOut > 0 ? 0.01 / tokensOut : 0;

  return {
    price: pricePerToken.toFixed(8),
    amountOut: formatEther(quote.amount),
  };
}

/**
 * Get agent's $AUTOMON token balance
 */
export async function getTokenBalance(privateKey: string, address?: string): Promise<string> {
  if (!TOKEN_ADDRESS) return '0';
  const sdk = getSDK(privateKey);
  const [, formatted] = await sdk.getBalanceFormatted(TOKEN_ADDRESS, address as Address | undefined);
  return formatted;
}

/**
 * Buy $AUTOMON tokens
 */
export async function buyToken(
  privateKey: string,
  amountMON: string,
  slippage = 5
): Promise<TradeResult> {
  if (!TOKEN_ADDRESS) throw new Error('AUTOMON_TOKEN_ADDRESS not set');
  const sdk = getSDK(privateKey);
  const amountIn = parseEther(amountMON);

  // Get quote first
  const quote = await sdk.getAmountOut(TOKEN_ADDRESS, amountIn, true);

  const txHash = await sdk.simpleBuy({
    token: TOKEN_ADDRESS,
    amountIn,
    slippagePercent: slippage,
  });

  return {
    txHash,
    amountIn: amountMON,
    estimatedOut: formatEther(quote.amount),
    action: 'buy',
  };
}

/**
 * Sell $AUTOMON tokens
 */
export async function sellToken(
  privateKey: string,
  amountTokens: string,
  slippage = 5
): Promise<TradeResult> {
  if (!TOKEN_ADDRESS) throw new Error('AUTOMON_TOKEN_ADDRESS not set');
  const sdk = getSDK(privateKey);
  const amountIn = parseEther(amountTokens);

  // Get quote
  const quote = await sdk.getAmountOut(TOKEN_ADDRESS, amountIn, false);

  const txHash = await sdk.simpleSell({
    token: TOKEN_ADDRESS,
    amountIn,
    slippagePercent: slippage,
  });

  return {
    txHash,
    amountIn: amountTokens,
    estimatedOut: formatEther(quote.amount),
    action: 'sell',
  };
}

/**
 * Get curve state (reserves, progress)
 */
export async function getCurveInfo(privateKey: string) {
  if (!TOKEN_ADDRESS) throw new Error('AUTOMON_TOKEN_ADDRESS not set');
  const sdk = getSDK(privateKey);
  const state = await sdk.getCurveState(TOKEN_ADDRESS);
  const progress = await sdk.getProgress(TOKEN_ADDRESS);
  const graduated = await sdk.isGraduated(TOKEN_ADDRESS);

  return {
    realMonReserve: formatEther(state.realMonReserve),
    realTokenReserve: formatEther(state.realTokenReserve),
    progress: Number(progress) / 100, // percentage
    graduated,
  };
}
