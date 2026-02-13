// @ts-nocheck
/**
 * Trading service for nad.fun — pure viem, no SDK dependency.
 * Handles buy/sell of $AUTOMON token on bonding curve.
 */
import { createPublicClient, createWalletClient, http, parseEther, formatEther, erc20Abi, defineChain, parseGwei, type Address } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';

const NETWORK = (process.env.AUTOMON_NETWORK || process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase() === 'mainnet'
  ? 'mainnet'
  : 'testnet';
const NETWORK_SUFFIX = NETWORK === 'mainnet' ? 'MAINNET' : 'TESTNET';
const envForNetwork = (baseKey: string) => {
  const suffixed = (process.env[`${baseKey}_${NETWORK_SUFFIX}`] || '').trim();
  if (suffixed) return suffixed;
  if (NETWORK === 'mainnet') return '';
  return (process.env[baseKey] || '').trim();
};

const TESTNET_DEFAULTS: Record<string, Address> = {
  NAD_BONDING_CURVE_ROUTER: '0x865054F0F6A288adaAc30261731361EA7E908003',
  NAD_LENS: '0xB056d79CA5257589692699a46623F901a3BB76f1',
  NAD_CURVE: '0x1228b0dc9481C11D3071E7A924B794CfB038994e',
  NAD_WMON: '0x5a4E0bFDeF88C9032CB4d24338C5EB3d3870BfDd',
};

function requireAddress(name: string): Address {
  const value = envForNetwork(name);
  if (value) return value as Address;
  if (NETWORK === 'testnet' && TESTNET_DEFAULTS[name]) return TESTNET_DEFAULTS[name];
  throw new Error(`${name}_${NETWORK_SUFFIX} is required`);
}

const CONFIG = {
  chainId: Number(envForNetwork('NEXT_PUBLIC_CHAIN_ID') || (NETWORK === 'mainnet' ? '143' : '10143')),
  rpcUrl: envForNetwork('MONAD_RPC_URL') || (NETWORK === 'mainnet' ? 'https://rpc.monad.xyz' : 'https://monad-testnet.drpc.org'),
  apiUrl: envForNetwork('NAD_FUN_API_URL') || (NETWORK === 'mainnet' ? 'https://api.nad.fun' : 'https://dev-api.nad.fun'),
  BONDING_CURVE_ROUTER: requireAddress('NAD_BONDING_CURVE_ROUTER'),
  LENS: requireAddress('NAD_LENS'),
  CURVE: requireAddress('NAD_CURVE'),
  WMON: requireAddress('NAD_WMON'),
};

if (!CONFIG.rpcUrl) console.warn('⚠ MONAD_RPC_URL not configured for trading');

const chain = defineChain({
  id: CONFIG.chainId,
  name: NETWORK === 'mainnet' ? 'Monad Mainnet' : 'Monad Testnet',
  nativeCurrency: { name: 'MON', symbol: 'MON', decimals: 18 },
  rpcUrls: { default: { http: [CONFIG.rpcUrl] } },
});

// --- ABIs (minimal, from nad.fun/abi.md) ---
const lensAbi = [
  {
    type: 'function', name: 'getAmountOut', stateMutability: 'view',
    inputs: [
      { name: '_token', type: 'address' },
      { name: '_amountIn', type: 'uint256' },
      { name: '_isBuy', type: 'bool' },
    ],
    outputs: [
      { name: 'router', type: 'address' },
      { name: 'amountOut', type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'getProgress', stateMutability: 'view',
    inputs: [{ name: '_token', type: 'address' }],
    outputs: [{ name: 'progress', type: 'uint256' }],
  },
  {
    type: 'function', name: 'getInitialBuyAmountOut', stateMutability: 'view',
    inputs: [{ name: 'amountIn', type: 'uint256' }],
    outputs: [{ type: 'uint256' }],
  },
] as const;

const routerAbi = [
  {
    type: 'function', name: 'buy', stateMutability: 'payable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
  {
    type: 'function', name: 'sell', stateMutability: 'nonpayable',
    inputs: [{
      name: 'params', type: 'tuple',
      components: [
        { name: 'amountIn', type: 'uint256' },
        { name: 'amountOutMin', type: 'uint256' },
        { name: 'token', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'deadline', type: 'uint256' },
      ],
    }],
    outputs: [{ name: 'amountOut', type: 'uint256' }],
  },
] as const;

const curveAbi = [
  {
    type: 'function', name: 'curves', stateMutability: 'view',
    inputs: [{ name: 'token', type: 'address' }],
    outputs: [
      { name: 'realMonReserve', type: 'uint256' },
      { name: 'realTokenReserve', type: 'uint256' },
      { name: 'virtualMonReserve', type: 'uint256' },
      { name: 'virtualTokenReserve', type: 'uint256' },
      { name: 'k', type: 'uint256' },
      { name: 'targetTokenAmount', type: 'uint256' },
      { name: 'initVirtualMonReserve', type: 'uint256' },
      { name: 'initVirtualTokenReserve', type: 'uint256' },
    ],
  },
  {
    type: 'function', name: 'feeConfig', stateMutability: 'view',
    inputs: [],
    outputs: [
      { name: 'deployFeeAmount', type: 'uint256' },
      { name: 'graduateFeeAmount', type: 'uint256' },
      { name: 'protocolFee', type: 'uint24' },
    ],
  },
] as const;

const bondingCurveRouterAbi = [{
  type: 'function', name: 'create', stateMutability: 'payable',
  inputs: [{
    name: 'params', type: 'tuple',
    components: [
      { name: 'name', type: 'string' },
      { name: 'symbol', type: 'string' },
      { name: 'tokenURI', type: 'string' },
      { name: 'amountOut', type: 'uint256' },
      { name: 'salt', type: 'bytes32' },
      { name: 'actionId', type: 'uint8' },
    ],
  }],
  outputs: [
    { name: 'token', type: 'address' },
    { name: 'pool', type: 'address' },
  ],
}] as const;

// --- Client cache per private key ---
const clientCache = new Map<string, {
  publicClient: ReturnType<typeof createPublicClient>;
  walletClient: ReturnType<typeof createWalletClient>;
  account: ReturnType<typeof privateKeyToAccount>;
}>();

function getClients(privateKey: string) {
  if (clientCache.has(privateKey)) return clientCache.get(privateKey)!;
  const account = privateKeyToAccount(privateKey as `0x${string}`);
  const publicClient = createPublicClient({ chain, transport: http(CONFIG.rpcUrl) });
  const walletClient = createWalletClient({ account, chain, transport: http(CONFIG.rpcUrl) });
  const entry = { publicClient, walletClient, account };
  clientCache.set(privateKey, entry);
  return entry;
}

const GAS_OVERRIDE_GWEI = envForNetwork('MAX_FEE_GWEI') || (NETWORK === 'testnet' ? '105' : '');
const GAS_OVERRIDE = GAS_OVERRIDE_GWEI ? parseGwei(GAS_OVERRIDE_GWEI) : undefined;

// --- Public API ---

export async function getTokenPrice(privateKey: string, tokenAddress: string): Promise<number> {
  const { publicClient } = getClients(privateKey);
  const token = tokenAddress as Address;
  try {
    const [, amountOut] = await publicClient.readContract({
      address: CONFIG.LENS, abi: lensAbi, functionName: 'getAmountOut',
      args: [token, parseEther('0.01'), true],
    });
    if (amountOut === BigInt(0)) return 0;
    return 0.01 / Number(formatEther(amountOut));
  } catch (e) {
    console.error('[trading] getTokenPrice error:', e);
    return 0;
  }
}

export async function getTokenBalance(privateKey: string, tokenAddress: string): Promise<bigint> {
  const { publicClient, account } = getClients(privateKey);
  try {
    return await publicClient.readContract({
      address: tokenAddress as Address, abi: erc20Abi, functionName: 'balanceOf',
      args: [account.address],
    });
  } catch {
    return BigInt(0);
  }
}

export async function getCurveInfo(privateKey: string, tokenAddress: string) {
  const { publicClient } = getClients(privateKey);
  const token = tokenAddress as Address;
  try {
    const [realMonReserve, realTokenReserve, virtualMonReserve, virtualTokenReserve] =
      await publicClient.readContract({ address: CONFIG.CURVE, abi: curveAbi, functionName: 'curves', args: [token] });
    const progress = await publicClient.readContract({ address: CONFIG.LENS, abi: lensAbi, functionName: 'getProgress', args: [token] });
    return {
      realMonReserve: formatEther(realMonReserve),
      realTokenReserve: formatEther(realTokenReserve),
      virtualMonReserve: formatEther(virtualMonReserve),
      virtualTokenReserve: formatEther(virtualTokenReserve),
      progress: Number(progress) / 100,
    };
  } catch (e) {
    console.error('[trading] getCurveInfo error:', e);
    return null;
  }
}

export async function buyToken(privateKey: string, tokenAddress: string, monAmount: string): Promise<{ txHash: string; tokensReceived: string; monSpent: string } | null> {
  const { publicClient, walletClient, account } = getClients(privateKey);
  const token = tokenAddress as Address;
  const value = parseEther(monAmount);

  try {
    const [router, amountOut] = await publicClient.readContract({
      address: CONFIG.LENS, abi: lensAbi, functionName: 'getAmountOut',
      args: [token, value, true],
    });
    console.log(`[trading] BUY quote: ${monAmount} MON → ${formatEther(amountOut)} tokens (router: ${router})`);

    const amountOutMin = (amountOut * BigInt(98)) / BigInt(100);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    const hash = await walletClient.writeContract({
    // @ts-ignore viem strict typing
      address: router as Address, abi: routerAbi, functionName: 'buy',
      args: [{ amountOutMin, token, to: account.address, deadline }],
      value, ...(GAS_OVERRIDE ? { maxFeePerGas: GAS_OVERRIDE } : {}),
    });
    console.log(`[trading] BUY tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash, tokensReceived: formatEther(amountOut), monSpent: monAmount };
  } catch (e) {
    console.error('[trading] buyToken error:', e);
    return null;
  }
}

export async function sellToken(privateKey: string, tokenAddress: string, tokenAmount?: bigint): Promise<{ txHash: string; monReceived: string; tokensSold: string } | null> {
  const { publicClient, walletClient, account } = getClients(privateKey);
  const token = tokenAddress as Address;

  try {
    const amountIn = tokenAmount ?? await publicClient.readContract({
      address: token, abi: erc20Abi, functionName: 'balanceOf', args: [account.address],
    });
    if (amountIn === BigInt(0)) { console.log('[trading] No tokens to sell'); return null; }

    const [router, amountOut] = await publicClient.readContract({
      address: CONFIG.LENS, abi: lensAbi, functionName: 'getAmountOut',
      args: [token, amountIn, false],
    });
    console.log(`[trading] SELL quote: ${formatEther(amountIn)} tokens → ${formatEther(amountOut)} MON (router: ${router})`);

    // Approve router
    const approveTx = await walletClient.writeContract({
      address: token, abi: erc20Abi, functionName: 'approve',
      args: [router as Address, amountIn], ...(GAS_OVERRIDE ? { maxFeePerGas: GAS_OVERRIDE } : {}),
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });

    const amountOutMin = (amountOut * BigInt(98)) / BigInt(100);
    const deadline = BigInt(Math.floor(Date.now() / 1000) + 300);

    const hash = await walletClient.writeContract({
    // @ts-ignore viem strict typing
      address: router as Address, abi: routerAbi, functionName: 'sell',
      args: [{ amountIn, amountOutMin, token, to: account.address, deadline }],
      ...(GAS_OVERRIDE ? { maxFeePerGas: GAS_OVERRIDE } : {}),
    });
    console.log(`[trading] SELL tx: ${hash}`);
    await publicClient.waitForTransactionReceipt({ hash });
    return { txHash: hash, monReceived: formatEther(amountOut), tokensSold: formatEther(amountIn) };
  } catch (e) {
    console.error('[trading] sellToken error:', e);
    return null;
  }
}

// --- Token Creation ---
export async function createToken(
  privateKey: string,
  name: string,
  symbol: string,
  description: string,
  imageBuffer?: Buffer,
): Promise<{ tokenAddress: string; txHash: string } | null> {
  if (!CONFIG.apiUrl) {
    throw new Error('NAD_FUN_API_URL_MAINNET is required for token launch in mainnet mode');
  }
  const { publicClient, walletClient, account } = getClients(privateKey);
  const headers: Record<string, string> = {};

  try {
    // 1. Upload image
    let image_uri = '';
    if (imageBuffer) {
      const imgRes = await fetch(`${CONFIG.apiUrl}/agent/token/image`, {
        method: 'POST', headers: { 'Content-Type': 'image/png', ...headers }, body: imageBuffer,
      });
      const imgData = await imgRes.json() as { image_uri: string };
      image_uri = imgData.image_uri;
    }

    // 2. Upload metadata
    const metaRes = await fetch(`${CONFIG.apiUrl}/agent/token/metadata`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ image_uri, name, symbol, description }),
    });
    const { metadata_uri } = await metaRes.json() as { metadata_uri: string };

    // 3. Mine salt
    const saltRes = await fetch(`${CONFIG.apiUrl}/agent/salt`, {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ creator: account.address, name, symbol, metadata_uri }),
    });
    const { salt } = await saltRes.json() as { salt: string; address: string };

    // 4. Get deploy fee
    const [deployFeeAmount] = await publicClient.readContract({
      address: CONFIG.CURVE, abi: curveAbi, functionName: 'feeConfig',
    });

    // 5. Create on-chain (no initial buy)
    const createArgs = {
      name, symbol, tokenURI: metadata_uri,
      amountOut: BigInt(0), salt: salt as `0x${string}`, actionId: 1,
    };

    const estimatedGas = await publicClient.estimateContractGas({
      address: CONFIG.BONDING_CURVE_ROUTER, abi: bondingCurveRouterAbi, functionName: 'create',
      args: [createArgs], account: account.address, value: deployFeeAmount,
    });

    const hash = await walletClient.writeContract({
    // @ts-ignore viem strict typing
      address: CONFIG.BONDING_CURVE_ROUTER, abi: bondingCurveRouterAbi, functionName: 'create',
      args: [createArgs], value: deployFeeAmount,
      gas: estimatedGas + estimatedGas / BigInt(10),
      ...(GAS_OVERRIDE ? { maxFeePerGas: GAS_OVERRIDE } : {}),
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash });

    // Find token address from CurveCreate event logs
    let tokenAddress = '';
    for (const log of receipt.logs) {
      if (log.topics[0] && log.topics[2]) {
        tokenAddress = `0x${log.topics[2].slice(26)}`;
        break;
      }
    }

    console.log(`[trading] Token created: ${tokenAddress} tx: ${hash}`);
    return { tokenAddress, txHash: hash };
  } catch (e) {
    console.error('[trading] createToken error:', e);
    return null;
  }
}
