import { MongoClient } from 'mongodb';

const uri = process.env.MONGO_URL || 'mongodb://localhost:27017';
const dbName = process.env.DB_NAME || 'netrik_shop';

let cached = global._mongo;
if (!cached) {
  cached = global._mongo = { client: null, promise: null };
}

export async function getDb() {
  if (cached.client) return cached.client.db(dbName);
  if (!cached.promise) {
    cached.promise = MongoClient.connect(uri, { maxPoolSize: 20 }).then((c) => {
      cached.client = c;
      return c;
    });
  }
  const client = await cached.promise;
  return client.db(dbName);
}
