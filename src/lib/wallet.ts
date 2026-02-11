'use client';

import { ethers } from 'ethers';
import { SiweMessage } from 'siwe';
import { CHAIN_CONFIG } from './blockchain';
import { getEscrowContractAddress, getNftContractAddress } from './network';

declare global {
  interface Window {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    ethereum?: any;
  }
}

export async function connectWallet(): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found. Please install MetaMask.');
  }

  const accounts = await window.ethereum.request({
    method: 'eth_requestAccounts',
  });

  return ethers.getAddress(accounts[0]);
}

export async function switchToMonad(): Promise<void> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  try {
    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: CHAIN_CONFIG.chainIdHex }],
    });
  } catch (error) {
    // Chain not added, add it
    const err = error as { code?: number };
    if (err.code === 4902) {
      await window.ethereum.request({
        method: 'wallet_addEthereumChain',
        params: [
          {
            chainId: CHAIN_CONFIG.chainIdHex,
            chainName: CHAIN_CONFIG.chainName,
            nativeCurrency: CHAIN_CONFIG.nativeCurrency,
            rpcUrls: CHAIN_CONFIG.rpcUrls,
            blockExplorerUrls: CHAIN_CONFIG.blockExplorerUrls,
          },
        ],
      });
    } else {
      throw error;
    }
  }
}

export async function signInWithEthereum(address: string, nonce: string): Promise<{ message: string; signature: string }> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const signerAddress = ethers.getAddress(await signer.getAddress());
  const normalizedAddress = ethers.getAddress(address);
  const messageAddress = signerAddress.toLowerCase() === normalizedAddress.toLowerCase()
    ? signerAddress
    : normalizedAddress;
  const domain = window.location.host;
  const origin = window.location.origin;

  const message = new SiweMessage({
    domain,
    address: messageAddress,
    statement: 'Sign in to AutoMon',
    uri: origin,
    version: '1',
    chainId: CHAIN_CONFIG.chainId,
    nonce,
  });

  const messageToSign = message.prepareMessage();
  const signature = await signer.signMessage(messageToSign);

  return { message: messageToSign, signature };
}

export async function getBalance(address: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const balance = await provider.getBalance(ethers.getAddress(address));

  return ethers.formatEther(balance);
}

export function getEscrowContract() {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const contractAddress = getEscrowContractAddress();

  const abi = [
    'function createBattle(bytes32 battleId) external payable',
    'function joinBattle(bytes32 battleId) external payable',
    'function cancelBattle(bytes32 battleId) external',
    'function battles(bytes32) external view returns (address player1, address player2, uint256 wager, bool settled)',
  ];

  return new ethers.Contract(contractAddress, abi, provider);
}

async function resolveNFTContractAddress(): Promise<string> {
  try {
    return getNftContractAddress();
  } catch {
    // Fall through to server-assisted config fetch.
  }

  const res = await fetch('/api/config/nft', { cache: 'no-store' });
  const data = await res.json();
  if (!res.ok || !data?.address) {
    throw new Error(data?.error || 'NFT contract not configured');
  }
  return data.address as string;
}

export async function getNFTContract() {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const contractAddress = await resolveNFTContractAddress();

  const abi = [
    'function buyPack() external payable',
  ];

  return new ethers.Contract(contractAddress, abi, provider);
}

export async function buyPackOnChain(packPriceWei: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = (await getNFTContract()).connect(signer) as ethers.Contract;
  const value = packPriceWei.includes('.') ? ethers.parseEther(packPriceWei) : BigInt(packPriceWei);

  const tx = await contract.buyPack({ value });
  const receipt = await tx.wait();
  return receipt.hash;
}

export async function createBattleOnChain(battleId: string, wager: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = getEscrowContract().connect(signer) as ethers.Contract;

  const battleIdBytes = ethers.id(battleId);
  const tx = await contract.createBattle(battleIdBytes, {
    value: ethers.parseEther(wager),
  });

  const receipt = await tx.wait();
  return receipt.hash;
}

export async function joinBattleOnChain(battleId: string, wager: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = getEscrowContract().connect(signer) as ethers.Contract;

  const battleIdBytes = ethers.id(battleId);
  const tx = await contract.joinBattle(battleIdBytes, {
    value: ethers.parseEther(wager),
  });

  const receipt = await tx.wait();
  return receipt.hash;
}

export async function cancelBattleOnChain(battleId: string): Promise<string> {
  if (!window.ethereum) {
    throw new Error('No wallet found');
  }

  const provider = new ethers.BrowserProvider(window.ethereum);
  const signer = await provider.getSigner();
  const contract = getEscrowContract().connect(signer) as ethers.Contract;

  const battleIdBytes = ethers.id(battleId);
  const tx = await contract.cancelBattle(battleIdBytes);

  const receipt = await tx.wait();
  return receipt.hash;
}
