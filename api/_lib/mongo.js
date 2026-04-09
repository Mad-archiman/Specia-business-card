import { MongoClient } from 'mongodb';

let cached = globalThis.__speciaMongo;
if (!cached) {
  cached = globalThis.__speciaMongo = { client: null, promise: null };
}

export async function getMongoClient() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    throw new Error('MONGODB_URI 환경 변수가 설정되지 않았습니다.');
  }

  if (cached.client) return cached.client;

  if (!cached.promise) {
    const client = new MongoClient(uri);
    cached.promise = client.connect().then(() => client);
  }

  cached.client = await cached.promise;
  return cached.client;
}

export async function getDb() {
  const client = await getMongoClient();
  const dbName = process.env.MONGODB_DB || undefined; // URI에 포함되어 있으면 undefined로 둬도 됩니다.
  return client.db(dbName);
}

