'use client';

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { ethers } from 'ethers';
import { connectWallet, switchToMonad, getBalance } from '@/lib/wallet';

interface WalletContextType {
  address: string | null;
  balance: string | null;
  isConnecting: boolean;
  connect: () => Promise<void>;
  disconnect: () => void;
  refreshBalance: () => Promise<void>;
}

const WalletContext = createContext<WalletContextType | undefined>(undefined);

export function WalletProvider({ children }: { children: React.ReactNode }) {
  const [address, setAddress] = useState<string | null>(null);
  const [balance, setBalance] = useState<string | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);

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

  // Restore wallet on page load from MetaMask
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      window.ethereum.request({ method: 'eth_accounts' }).then((accounts: string[]) => {
        if (accounts.length > 0) {
          const saved = localStorage.getItem('automon_wallet');
          const addr = normalizeAddress(accounts[0]);
          if (addr && (!saved || saved.toLowerCase() === addr.toLowerCase())) {
            setAddress(addr);
          }
        }
      }).catch(() => {});
    }
  }, [normalizeAddress]);

  useEffect(() => {
    if (address) refreshBalance();
  }, [address, refreshBalance]);

  // Listen for account/chain changes
  useEffect(() => {
    if (typeof window !== 'undefined' && window.ethereum) {
      const handleAccountsChanged = (accounts: string[]) => {
        if (accounts.length === 0) {
          setAddress(null);
          setBalance(null);
          localStorage.removeItem('automon_wallet');
        } else {
          const addr = normalizeAddress(accounts[0]);
          setAddress(addr);
          if (addr) localStorage.setItem('automon_wallet', addr);
        }
      };

      window.ethereum.on('accountsChanged', handleAccountsChanged);
      window.ethereum.on('chainChanged', () => window.location.reload());

      return () => {
        window.ethereum?.removeListener?.('accountsChanged', handleAccountsChanged);
      };
    }
  }, [normalizeAddress]);

  const connect = async () => {
    setIsConnecting(true);
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
      if (addr) localStorage.setItem('automon_wallet', addr);
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
    localStorage.removeItem('automon_wallet');
  };

  return (
    <WalletContext.Provider
      value={{ address, balance, isConnecting, connect, disconnect, refreshBalance }}
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
