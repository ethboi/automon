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

  const checkSession = useCallback(async () => {
    try {
      const res = await fetch('/api/auth/session');
      const data = await res.json();

      if (data.authenticated) {
        setAddress(normalizeAddress(data.address));
        setIsAuthenticated(true);
      }
    } catch (error) {
      console.error('Session check failed:', error);
    }
  }, [normalizeAddress]);

  useEffect(() => {
    checkSession();
  }, [checkSession]);

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

  const connect = async () => {
    setIsConnecting(true);
    try {
      await connectWallet();
      try {
        await switchToMonad();
      } catch (error) {
        // Some wallets/providers may not support programmatic chain switching.
        // Keep going so user can still connect/sign-in manually.
        console.warn('Chain switch failed, continuing with current network:', error);
      }

      const provider = window.ethereum ? new ethers.BrowserProvider(window.ethereum) : null;
      const signer = provider ? await provider.getSigner() : null;
      const signerAddress = signer ? await signer.getAddress() : null;
      const addr = normalizeAddress(signerAddress) || signerAddress;
      if (!addr) throw new Error('Could not resolve wallet address');
      setAddress(addr);

      // Get nonce
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

      // Sign message
      const { message, signature } = await signInWithEthereum(addr, nonce);

      // Verify and get token
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
      setAddress(normalizeAddress(verifiedAddress));
      setIsAuthenticated(true);
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
  };

  return (
    <WalletContext.Provider
      value={{
        address,
        balance,
        isConnecting,
        isAuthenticated,
        connect,
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
