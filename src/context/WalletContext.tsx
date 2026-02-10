'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { connectWallet, switchToMonad, signInWithEthereum, getBalance } from '@/lib/wallet';

interface WalletContextType {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  isAuthenticated: boolean;
  connect: () => Promise<void>;
  authenticate: () => Promise<void>;
  disconnect: () => Promise<void>;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  const normalizeAddress = useCallback((value: string | null | undefined): string | null => {
    if (!value) return null;
    try {
      return ethers.getAddress(value);
    } catch {
      return value;
    }
  }, []);

  const refreshBalance = useCallback(async () => {
    if (address) {
      try {
        const bal = await getBalance(address);
        setBalance(parseFloat(bal).toFixed(4));
      } catch (error) {
        console.error('Failed to get balance:', error);
      }
    }
  }, [address]);

  // Restore wallet on page load — check MetaMask for already-connected accounts
  const restoreWallet = useCallback(async () => {
    // First try SIWE session
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();
      if (data.authenticated && data.address) {
        setAddress(normalizeAddress(data.address));
        setIsAuthenticated(true);
        return;
      }
    } catch { /* session check failed, try MetaMask */ }

    // Fall back to MetaMask — eth_accounts returns connected accounts without prompting
    if (typeof window !== 'undefined' && window.ethereum) {
      try {
        const accounts: string[] = await window.ethereum.request({ method: 'eth_accounts' });
        if (accounts.length > 0) {
          const saved = localStorage.getItem('automon_wallet');
          const addr = normalizeAddress(accounts[0]);
          // Only restore if this was the last connected wallet
          if (addr && (!saved || saved.toLowerCase() === addr.toLowerCase())) {
            setAddress(addr);
            // Not SIWE authenticated, but wallet is connected
          }
        }
      } catch { /* no MetaMask */ }
    }
  }, [normalizeAddress]);

  useEffect(() => {
    restoreWallet();
  }, [restoreWallet]);

  useEffect(() => {
    if (address) {
      refreshBalance();
    }
  }, [address, refreshBalance]);

  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.on('accountsChanged', (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setIsAuthenticated(false);
        } else if (accounts[0].toLowerCase() !== (address || '').toLowerCase()) {
          setAddress(null);
          setIsAuthenticated(false);
        }
      });

      window.ethereum.on('chainChanged', () => {
        window.location.reload();
      });
    }
  }, [address]);

  const authenticate = useCallback(async () => {
    const provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null;
    const signer = provider ? await provider.getSigner() : null;
    const signerAddress = signer ? await signer.getAddress() : null;
    const addr = normalizeAddress(signerAddress) || signerAddress;
    if (!addr) throw new Error('Could not resolve wallet address');
    setAddress(addr);

    const nonceRes = await fetch('/api/auth/nonce', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ address: addr }),
    });
    if (!nonceRes.ok) {
      throw new Error(`Nonce request failed (${nonceRes.status})`);
    }
    const { nonce } = await nonceRes.json();
    if (!nonce) {
      throw new Error('Nonce missing from auth response');
    }

    const { message, signature } = await signInWithEthereum(addr, nonce);
    const verifyRes = await fetch('/api/auth/verify', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message, signature }),
    });
    if (!verifyRes.ok) {
      const data = await verifyRes.json().catch(() => ({}));
      const reason = data?.error ? `: ${data.error}` : '';
      throw new Error(`Verification failed (${verifyRes.status})${reason}`);
    }

    const { address: verifiedAddress } = await verifyRes.json();
    const finalAddr = normalizeAddress(verifiedAddress);
    setAddress(finalAddr);
    setIsAuthenticated(true);
    if (finalAddr) localStorage.setItem('automon_wallet', finalAddr);
  }, [normalizeAddress]);

  const connect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
      try {
        await switchToMonad();
      } catch (error) {
        console.warn('Chain switch failed, continuing with current network:', error);
      }
      await authenticate();
    } catch (error) {
      setIsAuthenticated(false);
      console.error('Connection failed:', error);
      throw error;
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await fetch('/api/auth/logout', { method: 'POST' });
    } catch (error) {
      console.error('Logout failed:', error);
    }
    setAddress(null);
    setBalance(null);
    setIsAuthenticated(false);
    localStorage.removeItem('automon_wallet');
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        isConnecting,
        isAuthenticated,
        connect,
        authenticate,
        disconnect,
        refreshBalance,
      }}
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
