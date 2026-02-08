import { MongoClient, Db } from 'mongodb';
import { ensureIndexes } from './db-indexes';

const MONGODB_URI = process.env.MONGODB_URI;

// Only throw during runtime, not during build
if (!MONGODB_URI && typeof window === 'undefined' && process.env.NODE_ENV !== 'production') {
  console.warn('MONGODB_URI not set - database operations will fail');
}

const uri = MONGODB_URI || 'mongodb://localhost:27017/automon';
const options = {};

let client: MongoClient;
let clientPromise: Promise<MongoClient>;

declare global {
  // eslint-disable-next-line no-var
  var _mongoClientPromise: Promise<MongoClient> | undefined;
}

if (process.env.NODE_ENV === 'development') {
  if (!global._mongoClientPromise) {
    client = new MongoClient(uri, options);
    global._mongoClientPromise = client.connect();
  }
  clientPromise = global._mongoClientPromise;
} else {
  client = new MongoClient(uri, options);
  clientPromise = client.connect();
}

export async function getDb(): Promise<Db> {
  const client = await clientPromise;
  const db = client.db('automon');
  await ensureIndexes(db);
  return db;
}

export default clientPromise;
