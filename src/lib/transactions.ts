import { getDb } from './mongodb';

export type TxType = 'mint_pack' | 'open_pack' | 'battle_create' | 'battle_settle' | 'battle_join' | 'nft_mint' | 'escrow_deposit' | 'escrow_settle';

export interface TxLog {
  txHash: string;
  type: TxType;
  from: string;
  description: string;
  metadata?: Record<string, unknown>;
  timestamp: Date;
}

const EXPLORER_BASE = 'https://testnet.monadexplorer.com/tx';

export function explorerUrl(txHash: string): string {
  return `${EXPLORER_BASE}/${txHash}`;
}

export async function logTransaction(tx: Omit<TxLog, 'timestamp'>): Promise<void> {
  try {
    const db = await getDb();
    await db.collection('transactions').insertOne({
      ...tx,
      from: tx.from.toLowerCase(),
      timestamp: new Date(),
    });
  } catch (error) {
    console.error('Failed to log transaction:', error);
  }
}

export async function getRecentTransactions(limit = 20): Promise<TxLog[]> {
  const db = await getDb();
  return db.collection('transactions')
    .find({})
    .sort({ timestamp: -1 })
    .limit(limit)
    .toArray() as unknown as TxLog[];
}
