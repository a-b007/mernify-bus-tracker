import { MongoClient } from 'mongodb';
import env from './env.js';

let client;
let db;

/**
 * Connect to MongoDB and set up collections + indexes.
 * Returns { db, client }.
 */
export async function connectDB() {
  client = new MongoClient(env.MONGODB_URI);
  await client.connect();
  db = client.db(env.DB_NAME);

  await ensureCollections(db);
  await ensureIndexes(db);

  console.log(`[db] Connected to MongoDB: ${env.DB_NAME}`);
  return { db, client };
}

async function ensureCollections(db) {
  const existing = (await db.listCollections().toArray()).map(c => c.name);

  // Time-series collection for positions
  if (!existing.includes('positions')) {
    await db.createCollection('positions', {
      timeseries: {
        timeField: 'ts',
        metaField: 'meta',
        granularity: 'seconds',
      },
      expireAfterSeconds: env.POSITIONS_TTL,
    });
  }

  // Standard collections — createCollection is idempotent for non-TS
  const standardColls = ['stops', 'routes', 'buses', 'bus_state', 'arrivals', 'stop_hourly_stats', 'alerts', 'users'];
  for (const name of standardColls) {
    if (!existing.includes(name)) {
      await db.createCollection(name);
    }
  }
}

async function ensureIndexes(db) {
  // stops
  await db.collection('stops').createIndex({ loc: '2dsphere' });
  await db.collection('stops').createIndex({ name: 'text' });

  // routes
  await db.collection('routes').createIndex({ routeNo: 1 });

  // buses
  await db.collection('buses').createIndex({ routeId: 1 });
  await db.collection('buses').createIndex({ type: 1 });

  // bus_state
  await db.collection('bus_state').createIndex({ routeId: 1 });
  await db.collection('bus_state').createIndex({ loc: '2dsphere' });

  // arrivals
  await db.collection('arrivals').createIndex(
    { busId: 1, tripId: 1, stopId: 1 },
    { unique: true }
  );
  await db.collection('arrivals').createIndex({ stopId: 1, ts: 1 });
  await db.collection('arrivals').createIndex(
    { ts: 1 },
    { expireAfterSeconds: env.ARRIVALS_TTL }
  );

  // stop_hourly_stats
  await db.collection('stop_hourly_stats').createIndex(
    { stopId: 1, routeId: 1, dayType: 1, hour: 1 },
    { unique: true }
  );

  // alerts
  await db.collection('alerts').createIndex(
    { ts: 1 },
    { expireAfterSeconds: env.ALERTS_TTL }
  );
  await db.collection('alerts').createIndex({ ts: 1 });

  // users
  await db.collection('users').createIndex({ email: 1 }, { unique: true });
}

export function getDB() {
  if (!db) throw new Error('Database not connected. Call connectDB() first.');
  return db;
}

export function getClient() {
  return client;
}
