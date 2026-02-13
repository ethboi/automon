'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { connectWallet, switchToMonad, getBalance, signInWithEthereum } from '@/lib/wallet';

interface WalletContextType {
  address: string | null;
  balance: string | null;
  tokenBalance: string | null;
  playerName: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
  updatePlayerName: (name: string) => Promise<void>;
  ensureAuthenticated: () => Promise<boolean>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);
const PUBLIC_NETWORK = (process.env.NEXT_PUBLIC_AUTOMON_NETWORK || 'testnet').toLowerCase();
const PUBLIC_TOKEN_ADDRESS = (
  (PUBLIC_NETWORK === 'mainnet'
    ? process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS_MAINNET
    : process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS_TESTNET) ||
  process.env.NEXT_PUBLIC_AUTOMON_TOKEN_ADDRESS ||
  // Fallback: mainnet $AUTOMON token
  '0xCdc26F8b74b9FE1A3B07C5e87C0EF4b3fD0E7777'
).trim();
const _ERC20_ABI = [
  'function balanceOf(address owner) view returns (uint256)',
  'function decimals() view returns (uint8)',
];

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [tokenBalance, setTokenBalance] = useState<string | null>(null);
  const [playerName, setPlayerName] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

  const normalizeAddress = useCallback((value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      return ethers.getAddress(value);
    } catch {
      return value;
    }
  }, []);

  const ensureSiweSession = useCallback(async (walletAddress: string): Promise<boolean> => {
    try {
      const normalized = normalizeAddress(walletAddress) || walletAddress;
      const sessionRes = await fetch('/api/auth/session', { cache: 'no-store', credentials: 'same-origin' });
      if (sessionRes.ok) {
        const sessionData = await sessionRes.json();
        if (
          sessionData?.authenticated &&
          typeof sessionData?.address === 'string' &&
          sessionData.address.toLowerCase() === normalized.toLowerCase()
        ) {
          return true;
        }
      }

      const nonceRes = await fetch('/api/auth/nonce', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ address: normalized }),
      });
      if (!nonceRes.ok) throw new Error('Failed to get nonce');
      const { nonce } = await nonceRes.json();
      if (!nonce) throw new Error('Nonce missing');

      const { message, signature } = await signInWithEthereum(normalized, nonce);
      const verifyRes = await fetch('/api/auth/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ message, signature }),
      });
      if (!verifyRes.ok) throw new Error('Failed to verify SIWE');
      return true;
    } catch (error) {
      console.warn('SIWE session setup failed:', error);
      return false;
    }
  }, [normalizeAddress]);

  const refreshBalance = useCallback(async () => {
    if (address) {
      try {
        const normalized = normalizeAddress(address) || address;
        const bal = await getBalance(normalized);
        setBalance(parseFloat(bal).toFixed(4));

        // Fetch token balance server-side to avoid browser RPC issues
        try {
          const tokenRes = await fetch(`/api/token-balance?address=${normalized}`);
          if (tokenRes.ok) {
            const { balance: tokenBal } = await tokenRes.json();
            setTokenBalance(tokenBal || '0');
          } else {
            setTokenBalance('0');
          }
        } catch {
          setTokenBalance('0');
        }
      } catch (error) {
        console.error('Failed to get balance:', error, 'Token addr:', PUBLIC_TOKEN_ADDRESS);
        setTokenBalance('0');
      }
    }
  }, [address, normalizeAddress]);

  const refreshProfile = useCallback(async () => {
    if (!address) return;
    try {
      const res = await fetch(`/api/users/me?address=${encodeURIComponent(address)}`, { cache: 'no-store', credentials: 'same-origin' });
      if (!res.ok) return;
      const data = await res.json();
      setPlayerName(data?.name ? String(data.name) : null);
    } catch {
      // noop
    }
  }, [address]);

  const pingPresence = useCallback(async () => {
    try {
      await fetch('/api/users/presence', { method: 'POST', credentials: 'same-origin' });
    } catch {
      // noop
    }
  }, []);

  const hydrateAuthedProfile = useCallback(async (walletAddress: string) => {
    const authed = await ensureSiweSession(walletAddress);
    if (!authed) return;
    await refreshProfile();
    await pingPresence();
  }, [ensureSiweSession, pingPresence, refreshProfile]);

  // Restore wallet on page load from MetaMask (skip if user explicitly disconnected)
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      if (localStorage.getItem('automon_disconnected')) return;
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          const saved = localStorage.getItem('automon_wallet');
          const addr = normalizeAddress(accounts[0]);
          if (addr && (!saved || saved.toLowerCase() === addr.toLowerCase())) {
            setAddress(addr);
            void hydrateAuthedProfile(addr);
          }
        }
      }).catch(() => {});
    }
  }, [hydrateAuthedProfile, normalizeAddress]);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  useEffect(() => {
    if (!address) return;
    let mounted = true;
    const run = async () => {
      const authed = await ensureSiweSession(address);
      if (!mounted || !authed) return;
      await refreshProfile();
      await pingPresence();
    };
    void run();
    const iv = setInterval(() => {
      void pingPresence();
    }, 60000);
    return () => {
      mounted = false;
      clearInterval(iv);
    };
  }, [address, ensureSiweSession, pingPresence, refreshProfile]);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setBalance(null);
          setTokenBalance(null);
          localStorage.removeItem('automon_wallet');
        } else {
          const addr = normalizeAddress(accounts[0]);
          setAddress(addr);
          if (addr) {
            localStorage.setItem('automon_wallet', addr);
            void hydrateAuthedProfile(addr);
          }
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());

      return () => {
        window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      };
    }
  }, [hydrateAuthedProfile, normalizeAddress]);

  const connect = async () => {
    setIsConnecting(true);
    localStorage.removeItem('automon_disconnected');
    try {
      await connectWallet();
      try {
        await switchToMonad();
      } catch (error) {
        console.warn('Chain switch failed, continuing:', error);
      }
      const provider = new ethers.BrowserProvider(window.ethereum!);
      const signer = await provider.getSigner();
      const addr = normalizeAddress(await signer.getAddress());
      setAddress(addr);
      if (addr) {
        localStorage.setItem('automon_wallet', addr);
        await ensureSiweSession(addr);
        await refreshProfile();
        await pingPresence();
      }
    } catch (error) {
      console.error('Connection failed:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = () => {
    setAddress(null);
    setBalance(null);
    setTokenBalance(null);
    setPlayerName(null);
    localStorage.removeItem('automon_wallet');
    localStorage.setItem('automon_disconnected', '1');
    void fetch('/api/auth/logout', { method: 'POST', credentials: 'same-origin' }).catch(() => {});
  };

  const updatePlayerName = useCallback(async (name: string) => {
    if (!address) {
      throw new Error('Connect wallet first');
    }
    const normalized = String(name || '').trim();
    const res = await fetch('/api/users/me', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'same-origin',
      body: JSON.stringify({ name: normalized, address }),
    });
    if (!res.ok) {
      const data = await res.json().catch(() => ({}));
      throw new Error(data?.error || 'Failed to update name');
    }
    const data = await res.json();
    setPlayerName(data?.name ? String(data.name) : null);
    void pingPresence();
  }, [address, pingPresence]);

  const ensureAuthenticated = useCallback(async (): Promise<boolean> => {
    if (!address) return false;
    return ensureSiweSession(address);
  }, [address, ensureSiweSession]);

  return (
    <WalletContext.Provider
      value={{ address, balance, tokenBalance, playerName, isConnecting, connect, disconnect, refreshBalance, updatePlayerName, ensureAuthenticated }}
    >
      {children}
    </WalletContext.Provider>
  );
}

export function useWallet() {
  const context = useContext(WalletContext);
  if (context === undefined) {
    throw new Error('useWallet must be used within a WalletProvider');
  }
  return context;
}
