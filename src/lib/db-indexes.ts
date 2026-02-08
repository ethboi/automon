import { Db } from 'mongodb';

let indexesPromise: Promise<void> | null = null;

export function ensureIndexes(db: Db): Promise<void> {
  if (!indexesPromise) {
    indexesPromise = (async () => {
      await Promise.all([
        db.collection('battles').createIndex({ battleId: 1 }, { unique: true }),
        db.collection('packs').createIndex(
          { purchaseTxHash: 1 },
          { unique: true, sparse: true }
        ),
        db.collection('users').createIndex({ address: 1 }, { unique: true }),
        db.collection('cards').createIndex({ owner: 1 }),
        db.collection('agents').createIndex({ address: 1 }, { unique: true }),
      ]);
    })().catch((error) => {
      indexesPromise = null;
      throw error;
    });
  }

  return indexesPromise;
}
